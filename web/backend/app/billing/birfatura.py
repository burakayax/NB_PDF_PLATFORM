"""
BirFatura entegrasyonu — reverse-pull modeli.

Mimari:
  BirFatura'nın API'si SIZI çağırır (pull), siz BirFatura'yı değil.
  BirFatura belirli aralıklarla sizdeki /orders/ endpoint'ini sorgular,
  sipariş bulunca fatura keser, hazır olunca /invoiceLinkUpdate/ çağırır.

  Bu adapter:
  1. Bekleyen siparişleri thread-safe bir bellekte tutar.
  2. BirFatura'nın beklediği 5 endpoint'i bir FastAPI router olarak sağlar.
  3. full_invoice_flow() çağrıldığında siparişi kuyruğa ekler ve
     BirFatura'nın callback'ini BIRFATURA_POLL_TIMEOUT_SEC saniyelik
     döngüyle bekler.

FastAPI entegrasyonu:
  from app.billing.birfatura import birfatura_router
  app.include_router(birfatura_router, prefix="/api/birfatura")

Gerekli env değişkenleri:
  BIRFATURA_API_TOKEN=<BirFatura panelinde tanımladığınız GUID token>
  BIRFATURA_POLL_TIMEOUT_SEC=600   # varsayılan 10 dakika
  BIRFATURA_POLL_INTERVAL_SEC=15   # varsayılan 15 saniye
"""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from .base import BillingProviderBase
from .models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Thread-safe sipariş deposu
# ---------------------------------------------------------------------------

class _PendingOrder:
    def __init__(
        self,
        order_id: str,
        customer_info: CustomerInfo,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> None:
        self.order_id = order_id
        self.customer_info = customer_info
        self.items = items
        self.payment_info = payment_info
        self.fetched = False           # BirFatura tarafından çekildi mi
        self.invoice_result: InvoiceResult | None = None
        self._event = threading.Event()

    def notify_invoice_ready(self, result: InvoiceResult) -> None:
        self.invoice_result = result
        self._event.set()

    def wait_for_invoice(self, timeout: float) -> bool:
        """Invoice callback gelene dek bekler. Timeout dolunca False döner."""
        return self._event.wait(timeout=timeout)


class _OrderStore:
    """Tüm bekleyen ve tamamlanan siparişler için thread-safe depo."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._orders: dict[str, _PendingOrder] = {}

    def add(self, order: _PendingOrder) -> None:
        with self._lock:
            self._orders[order.order_id] = order
        logger.debug("birfatura store: sipariş eklendi order_id=%s", order.order_id)

    def get(self, order_id: str) -> _PendingOrder | None:
        with self._lock:
            return self._orders.get(order_id)

    def pending(self) -> list[_PendingOrder]:
        """BirFatura henüz çekmediği siparişler."""
        with self._lock:
            return [o for o in self._orders.values() if not o.fetched]

    def mark_fetched(self, order_id: str) -> None:
        with self._lock:
            if order_id in self._orders:
                self._orders[order_id].fetched = True

    def remove(self, order_id: str) -> None:
        with self._lock:
            self._orders.pop(order_id, None)


_store = _OrderStore()


# ---------------------------------------------------------------------------
# FastAPI router — BirFatura bu endpoint'leri çağırır
# ---------------------------------------------------------------------------

birfatura_router = APIRouter(tags=["BirFatura"])


def _verify_token(token: str | None) -> None:
    """Header'daki token doğrulama. Hatalıysa 401."""
    expected = os.getenv("BIRFATURA_API_TOKEN", "").strip()
    if not expected:
        logger.warning("birfatura: BIRFATURA_API_TOKEN tanımlanmamış — token doğrulama atlanıyor")
        return
    if token != expected:
        logger.warning("birfatura: geçersiz token girişimi")
        raise HTTPException(status_code=401, detail="Geçersiz token")


@birfatura_router.post("/orderStatus/")
async def bf_order_status(token: str | None = Header(default=None)) -> JSONResponse:
    """Sipariş durumu listesi — BirFatura bu listeyi kullanarak sipariş filtreleme yapar."""
    _verify_token(token)
    statuses = [
        {"Id": 1, "Value": "Bekliyor"},
        {"Id": 2, "Value": "Tamamlandı"},
        {"Id": 3, "Value": "İptal"},
    ]
    return JSONResponse(statuses)


@birfatura_router.post("/paymentMethods/")
async def bf_payment_methods(token: str | None = Header(default=None)) -> JSONResponse:
    """Ödeme yöntemi listesi."""
    _verify_token(token)
    methods = [
        {"Id": 1, "Value": "Kredi Kartı"},
        {"Id": 2, "Value": "Havale/EFT"},
        {"Id": 3, "Value": "Kapıda Ödeme"},
    ]
    return JSONResponse(methods)


@birfatura_router.post("/orders/")
async def bf_orders(request: Request, token: str | None = Header(default=None)) -> JSONResponse:
    """
    BirFatura periyodik olarak bu endpoint'i sorgular.
    Bekleyen siparişleri BirFatura'nın beklediği formatta döner.
    """
    _verify_token(token)

    pending = _store.pending()
    if not pending:
        return JSONResponse([])

    orders_payload: list[dict[str, Any]] = []
    for po in pending:
        ci = po.customer_info
        pi = po.payment_info

        total_excl = sum(item.quantity * item.unit_price for item in po.items)
        total_incl = sum(
            item.quantity * item.unit_price * (1 + item.vat_rate / 100)
            for item in po.items
        )

        details = []
        for item in po.items:
            price_incl = item.unit_price * (1 + item.vat_rate / 100)
            details.append({
                "ProductId": str(uuid.uuid4())[:8],
                "ProductCode": item.name[:20],
                "ProductName": item.name,
                "ProductQuantityType": item.unit,
                "ProductQuantity": item.quantity,
                "VatRate": item.vat_rate,
                "ProductUnitPriceTaxExcluding": item.unit_price,
                "ProductUnitPriceTaxIncluding": round(price_incl, 4),
                "ProductNote": item.description or "",
            })

        order: dict[str, Any] = {
            "OrderId": po.order_id,
            "OrderCode": f"ORD-{po.order_id[:8].upper()}",
            "OrderDate": pi.payment_date or date.today().strftime("%d.%m.%Y %H:%M:%S"),
            "BillingName": ci.name,
            "BillingAddress": ci.address or "",
            "BillingTown": "",
            "BillingCity": ci.city or "",
            "BillingMobilePhone": ci.phone or "",
            "ShippingName": ci.name,
            "ShippingAddress": ci.address or "",
            "ShippingTown": "",
            "ShippingCity": ci.city or "",
            "Email": ci.email,
            "PaymentTypeId": 1,
            "PaymentType": "Kredi Kartı",
            "Currency": pi.currency,
            "CurrencyRate": 1.0,
            "TotalPaidTaxExcluding": round(total_excl, 2),
            "TotalPaidTaxIncluding": round(total_incl, 2),
            "ProductsTotalTaxExcluding": round(total_excl, 2),
            "ProductsTotalTaxIncluding": round(total_incl, 2),
            "OrderDetails": details,
        }

        if ci.tax_number:
            order["TaxNo"] = ci.tax_number
            order["TaxOffice"] = ci.tax_office or ""
        if ci.national_id:
            order["SSNTCNo"] = ci.national_id

        orders_payload.append(order)
        _store.mark_fetched(po.order_id)
        logger.info("birfatura: sipariş BirFatura'ya gönderildi order_id=%s", po.order_id)

    return JSONResponse(orders_payload)


@birfatura_router.post("/orderCargoUpdate/")
async def bf_order_cargo_update(
    request: Request,
    token: str | None = Header(default=None),
) -> JSONResponse:
    """BirFatura kargo bilgisini güncellediğinde bu endpoint'i çağırır."""
    _verify_token(token)
    body = await request.json()
    order_id = str(body.get("orderId", ""))
    tracking = body.get("cargoTrackingCode", "")
    logger.info("birfatura: kargo güncellendi order_id=%s tracking=%s", order_id, tracking)
    return JSONResponse({"success": True})


@birfatura_router.post("/invoiceLinkUpdate/")
async def bf_invoice_link_update(
    request: Request,
    token: str | None = Header(default=None),
) -> JSONResponse:
    """
    BirFatura fatura oluşturduğunda bu endpoint'i çağırır.
    order_id ile bekleyen siparişe eşleştirir ve event'i tetikler.
    """
    _verify_token(token)
    body = await request.json()

    order_id = str(body.get("orderId", ""))
    fatura_url = body.get("faturaUrl", "")
    fatura_no = body.get("faturaNo", "")
    fatura_tarihi = body.get("faturaTarihi", date.today().isoformat())

    logger.info(
        "birfatura: fatura callback alındı order_id=%s no=%s url=%s",
        order_id, fatura_no, fatura_url,
    )

    po = _store.get(order_id)
    if po is None:
        logger.warning("birfatura: bilinmeyen order_id callback order_id=%s", order_id)
        return JSONResponse({"success": False, "error": "order_not_found"})

    result = InvoiceResult(
        success=True,
        invoice_id=order_id,
        invoice_number=fatura_no or None,
        pdf_url=fatura_url or None,
        e_document_type="e_archive",
        issued_at=fatura_tarihi,
    )
    po.notify_invoice_ready(result)
    return JSONResponse({"success": True})


# ---------------------------------------------------------------------------
# BillingProviderBase uygulaması
# ---------------------------------------------------------------------------

class BirFaturaProvider(BillingProviderBase):
    """
    BirFatura billing provider.

    full_invoice_flow() siparişi kuyruğa ekler ve BirFatura callback'ini bekler.
    Timeout dolunca InvoiceResult(success=False, error="timeout") döner.

    NOT: Bu provider'ın çalışabilmesi için uygulamanıza birfatura_router'ı
    kaydetmeniz ve BIRFATURA_API_TOKEN ile public URL'yi BirFatura panelinize
    girmeniz gerekir.
    """

    def __init__(self) -> None:
        self._timeout = float(os.getenv("BIRFATURA_POLL_TIMEOUT_SEC", "600"))
        self._interval = float(os.getenv("BIRFATURA_POLL_INTERVAL_SEC", "15"))

    # ------------------------------------------------------------------
    # find_or_create_customer — BirFatura customer yönetimini kendi üstlenir.
    # Biz sadece müşteri bilgisini sipariş içine gömeriz; order_id döneriz.
    # ------------------------------------------------------------------

    def find_or_create_customer(self, customer_info: CustomerInfo) -> str:
        customer_id = customer_info.email  # BirFatura'da ayrı müşteri ID yok
        logger.info("birfatura: müşteri hazırlandı email=%s", customer_info.email)
        return customer_id

    # ------------------------------------------------------------------
    # create_invoice — siparişi bekleyen kuyruğa ekler
    # ------------------------------------------------------------------

    def create_invoice(
        self,
        customer_id: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        # customer_id burada e-posta adresidir; CustomerInfo'yu yeniden oluşturmak
        # için order_id'yi taşıyıcı olarak kullanıyoruz.
        order_id = str(uuid.uuid4())
        logger.info(
            "birfatura: sipariş oluşturuldu order_id=%s customer=%s",
            order_id, customer_id,
        )
        return InvoiceResult(
            success=True,
            invoice_id=order_id,
            invoice_number=None,
            issued_at=payment_info.payment_date or date.today().isoformat(),
        )

    # ------------------------------------------------------------------
    # publish_invoice — BirFatura bunu otomatik halleder; no-op
    # ------------------------------------------------------------------

    def publish_invoice(self, invoice_id: str) -> InvoiceResult:
        logger.debug("birfatura: publish_invoice no-op order_id=%s", invoice_id)
        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            e_document_type="e_archive",
            issued_at=date.today().isoformat(),
        )

    # ------------------------------------------------------------------
    # get_invoice_pdf_url — callback event'ini bekler
    # ------------------------------------------------------------------

    def get_invoice_pdf_url(self, invoice_id: str) -> str:
        po = _store.get(invoice_id)
        if po is None:
            raise RuntimeError(f"order_id={invoice_id} depoda bulunamadı")

        logger.info(
            "birfatura: invoice callback bekleniyor order_id=%s timeout=%ss",
            invoice_id, self._timeout,
        )
        arrived = po.wait_for_invoice(timeout=self._timeout)

        if not arrived or po.invoice_result is None:
            raise TimeoutError(
                f"BirFatura fatura callback'i {self._timeout}s içinde gelmedi "
                f"(order_id={invoice_id})"
            )

        url = po.invoice_result.pdf_url or ""
        _store.remove(invoice_id)
        return url

    # ------------------------------------------------------------------
    # cancel_invoice
    # ------------------------------------------------------------------

    def cancel_invoice(self, invoice_id: str) -> bool:
        po = _store.get(invoice_id)
        if po is not None:
            _store.remove(invoice_id)
            logger.info("birfatura: bekleyen sipariş kaldırıldı order_id=%s", invoice_id)
        return True

    # ------------------------------------------------------------------
    # full_invoice_flow — override: CustomerInfo'yu depoya gömer
    # ------------------------------------------------------------------

    def full_invoice_flow(
        self,
        customer_info: CustomerInfo,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        try:
            order_id = str(uuid.uuid4())
            po = _PendingOrder(order_id, customer_info, items, payment_info)
            _store.add(po)

            logger.info(
                "birfatura: tam akış başlatıldı order_id=%s müşteri=%s",
                order_id, customer_info.email,
            )

            # BirFatura'nın /orders/ endpoint'ini çağırmasını ve
            # /invoiceLinkUpdate/ callback'ini bekle
            arrived = po.wait_for_invoice(timeout=self._timeout)

            if not arrived or po.invoice_result is None:
                _store.remove(order_id)
                return InvoiceResult(
                    success=False,
                    invoice_id=order_id,
                    error=(
                        f"BirFatura fatura callback'i {self._timeout:.0f}s içinde gelmedi. "
                        "BirFatura panelinde mağaza ayarlarını ve public URL'yi kontrol edin."
                    ),
                )

            result = po.invoice_result
            _store.remove(order_id)
            logger.info(
                "birfatura: tam akış tamamlandı order_id=%s no=%s pdf=%s",
                order_id, result.invoice_number, result.pdf_url,
            )
            return result

        except Exception as exc:
            logger.exception("birfatura: full_invoice_flow hatası")
            return InvoiceResult(success=False, error=str(exc))
