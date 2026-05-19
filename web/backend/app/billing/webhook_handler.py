"""iyzico ödeme webhook işleyicisi — framework bağımsız."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from . import get_provider
from .email_service import send_invoice_email
from .models import CustomerInfo, InvoiceItem, PaymentInfo
from .tcmb import get_rate

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

    # ---- Ülke / KDV tespiti — çok-sinyal güvenli taraf ----
    declared_country = str(payload.get("customerCountry", "") or "").upper().strip()
    payment_currency = str(payload.get("currency", "TRY") or "TRY").upper().strip()
    if payment_currency in ("TRL", ""):
        payment_currency = "TRY"

    # iyzico kart ülkesi (varsa) — en güvenilir sinyal
    card_country_raw = str(payload.get("cardCountry", "") or "").upper().strip()
    is_tr_card = card_country_raw in ("TURKEY", "TR")

    # Güvenli taraf kuralı:
    #   1. TRY ödeme → daima TR
    #   2. TR kart → TR (VPN'e karşı koruma)
    #   3. Beyan edilen ülke TR ya da boş → TR (safe harbor)
    #   4. Hepsi yabancı → ihracat
    if payment_currency == "TRY":
        country_code = "TR"
        logger.info("webhook: TRY ödeme → KDV zorunlu (safe-harbor)")
    elif is_tr_card:
        country_code = "TR"
        logger.warning(
            "webhook: TR kart + yabancı para birimi tespit edildi — KDV uygulanıyor "
            "payment_currency=%s card_country=%s conversationId=%s",
            payment_currency, card_country_raw, payment_id,
        )
    elif declared_country and declared_country != "TR":
        country_code = declared_country
    else:
        # Bilinmiyor veya TR → güvenli taraf: KDV
        country_code = "TR"
        if not declared_country:
            logger.info("webhook: ülke beyanı yok → KDV uygulanıyor (safe-harbor)")

    is_export = country_code != "TR"
    kdv_rate = 0 if is_export else 20

    # ---- Müşteri bilgisi ----
    buyer: dict = payload.get("buyer", {})
    first = (buyer.get("name") or "").strip()
    last = (buyer.get("surname") or "").strip()
    invoice_type = buyer.get("invoiceType", "individual")
    tax_id = (buyer.get("taxId") or "").strip()       # Kurumsal VKN
    tax_office = (buyer.get("taxOffice") or "").strip()

    # Kurumsal müşteride şirket adı full_name olarak gelir (TS tarafında ayarlandı)
    full_name = f"{first} {last}".strip() or "Bilinmeyen Müşteri"

    # TC No — asla loglanmaz
    national_id_raw = buyer.get("identityNumber")
    national_id_masked = f"***{national_id_raw[-4:]}" if national_id_raw and len(national_id_raw) >= 4 else "***"
    logger.info(
        "webhook: buyer invoice_type=%s national_id present=%s masked=%s tax_id present=%s",
        invoice_type, bool(national_id_raw), national_id_masked, bool(tax_id),
    )

    is_corporate = invoice_type == "corporate"

    customer_info = CustomerInfo(
        name=full_name,
        email=buyer.get("email", ""),
        phone=buyer.get("gsmNumber"),
        national_id=national_id_raw if (not is_export and not is_corporate) else None,
        tax_number=tax_id if (is_corporate and tax_id) else None,
        tax_office=tax_office if (is_corporate and tax_office) else None,
        address=buyer.get("registrationAddress"),
        city=buyer.get("city"),
        country="Turkey" if country_code == "TR" else country_code,
        contact_type="company" if is_corporate else "person",
        country_code=country_code,
        is_export=is_export,
    )

    if not customer_info.email:
        logger.error("webhook: müşteri e-postası yok payment_id=%s", payment_id)
        return {"success": False, "error": "missing_buyer_email"}

    # ---- Fatura kalemleri ----
    basket_items: list[dict] = payload.get("basketItems", [])
    # iyzico "TRL" gönderebilir; Paraşüt ISO 4217 "TRY" bekliyor
    _raw_currency = str(payload.get("currency", "TRY") or "TRY").upper()
    currency = "TRY" if _raw_currency in ("TRL", "TRY", "") else _raw_currency
    paid_price = float(payload.get("paidPrice") or payload.get("price", 0))
    payment_date = date.today().isoformat()

    # Kupon / iskonto bilgisi — KDV Kanunu Md.25: faturada ayrıca gösterilmeli
    discount_percent = int(payload.get("discountPercent", 0) or 0)
    original_net_amount = payload.get("originalNetAmount")  # KDV hariç, iskonto öncesi
    original_net = float(original_net_amount) if original_net_amount else None

    invoice_items: list[InvoiceItem] = []

    # İhracat istisnası açıklaması — KDV Kanunu Madde 12 kapsamı
    export_description = "İhracat İstisnası (KDV K. Mad. 12)" if is_export else ""

    if basket_items:
        for bi in basket_items:
            item_price = float(bi.get("price", 0))
            if is_export:
                unit_price_excl_vat = item_price  # İhracatta KDV yok
            else:
                unit_price_excl_vat = round(item_price / 1.20, 2)
            invoice_items.append(
                InvoiceItem(
                    name=bi.get("name", "Hizmet"),
                    quantity=1,
                    unit_price=unit_price_excl_vat,
                    vat_rate=kdv_rate,
                    description=export_description,
                    is_export=is_export,
                    discount_percent=discount_percent,
                    original_unit_price=original_net,
                )
            )
    else:
        # Sepet boşsa tek satır
        if is_export:
            unit_price_excl_vat = paid_price
        else:
            unit_price_excl_vat = round(paid_price / 1.20, 2)
        invoice_items.append(
            InvoiceItem(
                name="Dijital Hizmet",
                quantity=1,
                unit_price=unit_price_excl_vat,
                vat_rate=kdv_rate,
                description=export_description,
                is_export=is_export,
                discount_percent=discount_percent,
                original_unit_price=original_net,
            )
        )

    # TCMB günlük alış kuru — TRY dışı ödemelerde Paraşüt/BirFatura için gerekli
    currency_rate = get_rate(currency)

    payment_info = PaymentInfo(
        payment_id=payment_id,
        amount_paid=paid_price,
        currency=currency,
        payment_date=payment_date,
        currency_rate=currency_rate,
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
    locale = "tr" if country_code == "TR" else "en"
    email_sent = send_invoice_email(customer_info, invoice_result, locale=locale)
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
