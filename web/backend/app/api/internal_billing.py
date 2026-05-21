"""Dahili fatura tetikleme endpoint'leri — Node.js payment callback'inden çağrılır."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.billing import get_provider
from app.billing.birfatura import BirFaturaProvider
from app.billing.models import CustomerInfo, InvoiceItem, PaymentInfo
from app.billing.parasut import ParasutProvider
from app.billing.webhook_handler import handle_iyzico_webhook

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/invoice")
async def trigger_invoice(request: Request) -> JSONResponse:
    """
    Node.js payment callback'i ödeme doğrulandıktan sonra bu endpoint'i çağırır.
    Fatura oluşturmayı tetikler; hata olursa bile her zaman HTTP 200 döner —
    fatura hatası asla abonelik aktivasyonunu bloke etmez.
    """
    try:
        payload: dict[str, Any] = await request.json()
        headers = dict(request.headers)
        result = handle_iyzico_webhook(payload, headers)
        return JSONResponse(content=result)
    except Exception:
        logger.exception("internal_billing: beklenmedik hata")
        return JSONResponse(content={"success": False, "error": "internal_error"})


@router.post("/credit-note")
async def trigger_credit_note(request: Request) -> JSONResponse:
    """
    İade sonrası iade faturası oluşturur.

    Beklenen payload:
    {
      "originalInvoiceId": "...",   # provider'daki orijinal fatura ID'si
      "paymentId": "...",           # iyzico ödeme ID'si
      "reason": "...",              # iade gerekçesi (opsiyonel)
      "buyer": {                    # triggerInvoiceGeneration ile aynı format
        "name": "...", "surname": "...", "email": "...",
        "gsmNumber": "...", "identityNumber": "...",
        "registrationAddress": "...", "city": "...", "country": "...",
        "invoiceType": "individual"|"corporate",
        "taxId": "...", "taxOffice": "..."
      },
      "basketItems": [...],
      "paidPrice": 178.8,
      "currency": "TRY",
      "kdvRate": 20
    }
    """
    try:
        payload: dict[str, Any] = await request.json()

        original_invoice_id = payload.get("originalInvoiceId", "")
        original_invoice_ettn = payload.get("originalInvoiceEttn", original_invoice_id)
        original_invoice_no = str(payload.get("originalInvoiceNo", ""))
        original_invoice_date = str(payload.get("originalInvoiceDate", ""))
        payment_id = str(payload.get("paymentId", ""))
        reason = str(payload.get("reason", "Kullanıcı talebiyle iade"))
        buyer: dict = payload.get("buyer", {})
        basket_items: list[dict] = payload.get("basketItems", [])
        paid_price = float(payload.get("paidPrice", 0))
        currency = str(payload.get("currency", "TRY")).upper()
        if currency in ("TRL", ""):
            currency = "TRY"
        kdv_rate = int(payload.get("kdvRate", 20))
        discount_percent = int(payload.get("discountPercent", 0) or 0)
        original_net_amount = payload.get("originalNetAmount")

        if not original_invoice_id:
            return JSONResponse(content={"success": False, "error": "originalInvoiceId zorunlu"})

        # Müşteri bilgisi
        invoice_type = buyer.get("invoiceType", "individual")
        is_corporate = invoice_type == "corporate"
        first = (buyer.get("name") or "").strip()
        last = (buyer.get("surname") or "").strip()
        full_name = f"{first} {last}".strip() or "Bilinmeyen Müşteri"
        tax_id = (buyer.get("taxId") or "").strip()
        tax_office = (buyer.get("taxOffice") or "").strip()
        national_id = buyer.get("identityNumber") or None

        buyer_country = buyer.get("country", "Turkey")
        is_export = buyer_country.upper() not in ("TURKEY", "TÜRKİYE", "TR")

        customer_info = CustomerInfo(
            name=full_name,
            email=buyer.get("email", ""),
            phone=buyer.get("gsmNumber"),
            national_id=national_id if (not is_corporate and not is_export) else None,
            tax_number=tax_id if (is_corporate and tax_id) else None,
            tax_office=tax_office if (is_corporate and tax_office) else None,
            address=buyer.get("registrationAddress"),
            city=buyer.get("city"),
            country=buyer_country,
            contact_type="company" if is_corporate else "person",
            is_export=is_export,
        )

        # Fatura kalemleri
        # netAmount/kdvAmount DB'den geliyorsa yeniden hesaplama yapma — daha güvenilir
        invoice_items: list[InvoiceItem] = []
        if basket_items:
            for bi in basket_items:
                stored_net = bi.get("netAmount")
                gross = float(bi.get("grossAmount") or bi.get("price") or paid_price)
                if stored_net is not None:
                    unit_price = float(stored_net)
                else:
                    unit_price = round(gross / (1 + kdv_rate / 100), 2) if kdv_rate > 0 else gross
                orig_net = float(original_net_amount) if (discount_percent > 0 and original_net_amount) else None
                invoice_items.append(InvoiceItem(
                    name=bi.get("name", "Dijital Hizmet İadesi"),
                    quantity=1,
                    unit_price=unit_price,
                    vat_rate=kdv_rate,
                    discount_percent=discount_percent,
                    original_unit_price=orig_net,
                ))
        else:
            unit_price = round(paid_price / (1 + kdv_rate / 100), 2) if kdv_rate > 0 else paid_price
            invoice_items.append(InvoiceItem(
                name="Dijital Hizmet İadesi",
                quantity=1,
                unit_price=unit_price,
                vat_rate=kdv_rate,
            ))

        payment_info = PaymentInfo(
            payment_id=payment_id,
            amount_paid=paid_price,
            currency=currency,
            payment_date=date.today().isoformat(),
        )

        provider = get_provider()

        if not isinstance(provider, (ParasutProvider, BirFaturaProvider)):
            logger.warning(
                "credit_note: provider=%s iade faturasını desteklemiyor, atlanıyor",
                type(provider).__name__,
            )
            return JSONResponse(content={
                "success": False,
                "error": f"provider {type(provider).__name__} iade faturasını desteklemiyor",
            })

        logger.info(
            "credit_note: iade faturası başlatılıyor provider=%s originalInvoiceId=%s paymentId=%s",
            type(provider).__name__, original_invoice_id, payment_id,
        )

        result = provider.create_credit_note(
            original_invoice_id=original_invoice_ettn,
            customer_info=customer_info,
            items=invoice_items,
            payment_info=payment_info,
            reason=reason,
            original_invoice_no=original_invoice_no,
            original_invoice_date=original_invoice_date,
        )

        logger.info(
            "credit_note: sonuç success=%s id=%s no=%s",
            result.success, result.invoice_id, result.invoice_number,
        )

        return JSONResponse(content={
            "success": result.success,
            "creditNoteId": result.invoice_id,
            "creditNoteNo": result.invoice_number,
            "pdfUrl": result.pdf_url,
            "error": result.error,
        })

    except Exception:
        logger.exception("credit_note: beklenmedik hata")
        return JSONResponse(content={"success": False, "error": "internal_error"})
