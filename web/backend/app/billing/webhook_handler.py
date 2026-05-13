"""iyzico ödeme webhook işleyicisi — framework bağımsız."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from . import get_provider
from .email_service import send_invoice_email
from .models import CustomerInfo, InvoiceItem, PaymentInfo

logger = logging.getLogger(__name__)


def handle_iyzico_webhook(payload: dict[str, Any], headers: dict[str, Any]) -> dict[str, Any]:
    """
    iyzico ödeme webhook'unu işler.

    Başarılı ödeme → müşteri oluştur/bul → fatura kes → PDF e-postala.
    Hata durumunda asla exception fırlatmaz; iyzico'nun 200 beklediği nedeniyle
    her zaman bir dict döner.

    Returns:
        {"success": True,  "invoice_id": ..., "pdf_url": ...}
        {"success": False, "error": ...}
    """
    try:
        return _process(payload, headers)
    except Exception:
        logger.exception("webhook: beklenmedik hata — payload=%s", payload)
        return {"success": False, "error": "internal_error"}


def _process(payload: dict[str, Any], headers: dict[str, Any]) -> dict[str, Any]:
    # ---- Temel alan kontrolü ----
    required = {"paymentId", "status"}
    missing = required - set(payload.keys())
    if missing:
        logger.warning("webhook: eksik alanlar=%s", missing)
        return {"success": False, "error": f"missing_fields: {missing}"}

    status = payload.get("status", "")
    payment_id = str(payload["paymentId"])

    if status != "SUCCESS":
        logger.info("webhook: ödeme başarısız status=%s payment_id=%s", status, payment_id)
        return {"success": False, "error": f"payment_not_successful: status={status}"}

    logger.info("webhook: başarılı ödeme payment_id=%s işleniyor", payment_id)

    # ---- Müşteri bilgisi ----
    buyer: dict = payload.get("buyer", {})
    first = (buyer.get("name") or "").strip()
    last = (buyer.get("surname") or "").strip()
    full_name = f"{first} {last}".strip() or "Bilinmeyen Müşteri"

    customer_info = CustomerInfo(
        name=full_name,
        email=buyer.get("email", ""),
        phone=buyer.get("gsmNumber"),
        national_id=buyer.get("identityNumber"),
        address=buyer.get("registrationAddress"),
        city=buyer.get("city"),
        contact_type="person",
    )

    if not customer_info.email:
        logger.error("webhook: müşteri e-postası yok payment_id=%s", payment_id)
        return {"success": False, "error": "missing_buyer_email"}

    # ---- Fatura kalemleri ----
    basket_items: list[dict] = payload.get("basketItems", [])
    currency = payload.get("currency", "TRL")
    paid_price = float(payload.get("paidPrice") or payload.get("price", 0))
    payment_date = date.today().isoformat()

    invoice_items: list[InvoiceItem] = []

    if basket_items:
        for bi in basket_items:
            item_price = float(bi.get("price", 0))
            # KDV'siz fiyat: price / 1.20 (Türkiye 2024 — %20 KDV)
            unit_price_excl_vat = round(item_price / 1.20, 2)
            invoice_items.append(
                InvoiceItem(
                    name=bi.get("name", "Hizmet"),
                    quantity=1,
                    unit_price=unit_price_excl_vat,
                    vat_rate=20,
                    description=bi.get("itemType"),
                )
            )
    else:
        # Sepet boşsa tek satır
        unit_price_excl_vat = round(paid_price / 1.20, 2)
        invoice_items.append(
            InvoiceItem(
                name="Dijital Hizmet",
                quantity=1,
                unit_price=unit_price_excl_vat,
                vat_rate=20,
            )
        )

    payment_info = PaymentInfo(
        payment_id=payment_id,
        amount_paid=paid_price,
        currency=currency,
        payment_date=payment_date,
    )

    # ---- Fatura akışı ----
    provider = get_provider()
    logger.info("webhook: provider=%s ile fatura akışı başlatılıyor", type(provider).__name__)

    invoice_result = provider.full_invoice_flow(customer_info, invoice_items, payment_info)

    if not invoice_result.success:
        logger.error("webhook: fatura akışı başarısız — %s", invoice_result.error)
        return {"success": False, "error": invoice_result.error}

    logger.info(
        "webhook: fatura oluşturuldu id=%s no=%s pdf=%s",
        invoice_result.invoice_id,
        invoice_result.invoice_number,
        invoice_result.pdf_url,
    )

    # ---- E-posta gönder ----
    email_sent = send_invoice_email(customer_info, invoice_result)
    if not email_sent:
        logger.warning("webhook: fatura e-postası gönderilemedi müşteri=%s", customer_info.email)

    return {
        "success": True,
        "invoice_id": invoice_result.invoice_id,
        "invoice_number": invoice_result.invoice_number,
        "pdf_url": invoice_result.pdf_url,
        "e_document_type": invoice_result.e_document_type,
        "email_sent": email_sent,
    }


# ---------------------------------------------------------------------------
# Framework entegrasyon örnekleri
# ---------------------------------------------------------------------------

# FastAPI:
# from fastapi import Request
# from fastapi.responses import JSONResponse
#
# @app.post("/webhooks/iyzico")
# async def iyzico_webhook(request: Request):
#     payload = await request.json()
#     result = handle_iyzico_webhook(payload, dict(request.headers))
#     return JSONResponse(result)

# Django:
# import json
# from django.http import JsonResponse
# from django.views.decorators.csrf import csrf_exempt
#
# @csrf_exempt
# def iyzico_webhook(request):
#     payload = json.loads(request.body)
#     result = handle_iyzico_webhook(payload, dict(request.headers))
#     return JsonResponse(result)
