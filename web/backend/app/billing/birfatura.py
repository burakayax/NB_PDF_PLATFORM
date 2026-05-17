"""BirFatura OutEBelgeV2 API billing provider.

Mimari:
  Paraşüt gibi siz BirFatura'yı çağırırsınız.
  Auth: X-Api-Key / X-Secret-Key / X-Integration-Key header'ları ile.

Akış:
  1. GibUserList → vergi numarasına göre e-fatura mükellefi mi kontrol et.
  2. SendBasicInvoiceFromModel → fatura oluştur + GİB'e gönder (UUID döner).
  3. GetOutBoxDocumentStatusesWithUUIDs → belge "SUCCEED" olana dek poll.
  4. GetPDFLinkByUUID → PDF linkini al.
  5. SendDocumentAnswer (IPTAL) → iptal akışı için.

Gerekli env değişkenleri:
  BIRFATURA_API_KEY       — BirFatura panelindeki API anahtarı
  BIRFATURA_SECRET_KEY    — Güvenlik gizli anahtarı
  BIRFATURA_INTEGRATION_KEY — Entegrasyon anahtarı

İsteğe bağlı:
  BIRFATURA_BASE_URL      — varsayılan https://uygulama.edonustur.com
  BIRFATURA_POLL_TIMEOUT_SEC  — varsayılan 300 (5 dakika)
  BIRFATURA_POLL_INTERVAL_SEC — varsayılan 10 saniye
"""

from __future__ import annotations

import logging
import os
import time
from datetime import date
from typing import Any

import requests
from tenacity import before_sleep_log, retry, stop_after_attempt, wait_exponential

from .base import BillingProviderBase
from .models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo

logger = logging.getLogger(__name__)

_DEFAULT_BASE = "https://uygulama.edonustur.com"
_POLL_INTERVAL = 10
_POLL_MAX = 30


class BirFaturaProvider(BillingProviderBase):
    """BirFatura OutEBelgeV2 API entegrasyonu."""

    def __init__(self) -> None:
        self._api_key = os.environ["BIRFATURA_API_KEY"]
        self._secret_key = os.environ["BIRFATURA_SECRET_KEY"]
        self._integration_key = os.getenv("BIRFATURA_INTEGRATION_KEY", "")
        self._base = os.getenv("BIRFATURA_BASE_URL", _DEFAULT_BASE).rstrip("/")
        self._timeout = int(os.getenv("BIRFATURA_POLL_TIMEOUT_SEC", "300"))
        self._interval = int(os.getenv("BIRFATURA_POLL_INTERVAL_SEC", str(_POLL_INTERVAL)))
        self._max_attempts = max(1, self._timeout // self._interval)

        self._session = requests.Session()
        headers = {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "X-Api-Key": self._api_key,
            "X-Secret-Key": self._secret_key,
        }
        if self._integration_key:
            headers["X-Integration-Key"] = self._integration_key
        self._session.headers.update(headers)

    # ------------------------------------------------------------------
    # HTTP yardımcıları
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _post(self, path: str, body: dict) -> dict:
        url = f"{self._base}/{path.lstrip('/')}"
        logger.info("birfatura POST %s body=%s", url, body)
        resp = self._session.post(url, json=body, timeout=30)
        logger.info("birfatura POST %s status=%s response=%s", url, resp.status_code, resp.text[:2000])
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            raise RuntimeError(
                f"BirFatura JSON yanıt beklendi, {content_type!r} geldi "
                f"(url={resp.url}, status={resp.status_code}): {resp.text[:500]}"
            )
        return resp.json()

    def _check_api_response(self, data: dict, endpoint: str) -> Any:
        """ApiResponse wrapper'ından Result alanını çıkarır; Success=False ise hata fırlatır."""
        if not data.get("Success", False):
            msg = data.get("Message", "Bilinmeyen hata")
            code = data.get("Code", "")
            raise RuntimeError(f"BirFatura {endpoint} başarısız: [{code}] {msg}")
        return data.get("Result")

    # ------------------------------------------------------------------
    # find_or_create_customer — e-fatura mükellefiyetini kontrol eder
    # ------------------------------------------------------------------

    def find_or_create_customer(self, customer_info: CustomerInfo) -> str:
        """
        BirFatura'da ayrı müşteri kaydı yoktur; vergi nosunu döner.
        E-fatura mükellefiyeti kontrol edilir ve customer_id olarak döner
        (format: 'efatura:<receiver_tag>' veya 'earsiv:<email>').
        """
        if customer_info.tax_number:
            try:
                receiver_tag = self._get_e_invoice_receiver_tag(customer_info.tax_number)
                if receiver_tag:
                    logger.info(
                        "birfatura: e-fatura mükellefi bulundu vkn=%s tag=%s",
                        customer_info.tax_number, receiver_tag,
                    )
                    return f"efatura:{receiver_tag}"
            except Exception as exc:
                logger.warning("birfatura: GibUserList sorgulanamadı, e-arşiv kullanılacak hata=%s", exc)

        return f"earsiv:{customer_info.email}"

    def _get_e_invoice_receiver_tag(self, tax_number: str) -> str | None:
        """Vergi numarasına göre GİB e-fatura alıcı etiketini döner; yoksa None."""
        data = self._post("GibUserList", {
            "pkGbTypeCode": tax_number,
            "pageNumber": 1,
            "pageSize": 10,
        })
        result = self._check_api_response(data, "GibUserList")
        if result and isinstance(result, list) and len(result) > 0:
            # İlk kaydın identifier (PK etiketi) alanını döner
            return result[0].get("identifier") or result[0].get("pkGbTurKod") or tax_number
        return None

    # ------------------------------------------------------------------
    # create_invoice — SendBasicInvoiceFromModel ile fatura gönder
    # ------------------------------------------------------------------

    def create_invoice(
        self,
        customer_id: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        # customer_id: 'efatura:<tag>' veya 'earsiv:<email>'
        # CustomerInfo bu noktada mevcut olmadığından customer_id encode edilir.
        # full_invoice_flow override ile doğrudan müşteri bilgisi geçirilir.
        raise NotImplementedError(
            "BirFaturaProvider.create_invoice() doğrudan kullanılamaz; "
            "full_invoice_flow() kullanın."
        )

    def _build_and_send_invoice(
        self,
        customer_info: CustomerInfo,
        customer_id: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        """
        SendBasicInvoiceFromModel ile fatura oluşturur ve GİB'e gönderir.
        Dönen UUID ile durum takibi yapılır.
        """
        today = payment_info.payment_date or date.today().isoformat()
        ci = customer_info
        pi = payment_info

        is_e_invoice = customer_id.startswith("efatura:")
        receiver_tag = customer_id.split(":", 1)[1] if is_e_invoice else ""

        total_excl = round(sum(i.quantity * i.unit_price for i in items), 2)
        total_incl = round(sum(
            i.quantity * i.unit_price * (1 + i.vat_rate / 100) for i in items
        ), 2)

        # TCMB alış kurunu kullan; TRY ödemelerde 1.0
        currency_code = (pi.currency or "TRY").upper()
        currency_rate = pi.currency_rate if currency_code not in ("TRY", "TRL") else 1.0

        # İhracat istisnası açıklaması
        export_note = "İhracat İstisnası (KDV K. Mad. 12)" if ci.is_export else ""

        order_details = []
        for item in items:
            price_incl = round(item.unit_price * (1 + item.vat_rate / 100), 4)
            order_details.append({
                "productCode": item.name[:20],
                "productName": item.name,
                "productNote": item.description or export_note,
                "productQuantityType": item.unit,
                "productQuantity": item.quantity,
                "vatRate": int(item.vat_rate),
                "productUnitPriceTaxExcluding": round(float(item.unit_price), 4),
                "productUnitPriceTaxIncluding": price_incl,
            })

        invoice_payload: dict[str, Any] = {
            "invoiceDate": today,
            "isDocumentNoAuto": True,
            "billingName": ci.name,
            "billingAddress": ci.address or "",
            "billingCity": ci.city or "",
            "billingMobilePhone": ci.phone or "",
            "email": ci.email,
            "paymentType": "Kredi Kartı",
            "currency": currency_code,
            "currencyRate": currency_rate,
            "totalPaidTaxExcluding": total_excl,
            "totalPaidTaxIncluding": total_incl,
            "productsTotalTaxExcluding": total_excl,
            "productsTotalTaxIncluding": total_incl,
            "orderDetails": order_details,
        }

        if ci.tax_number:
            invoice_payload["taxNo"] = ci.tax_number
            invoice_payload["taxOffice"] = ci.tax_office or ""
        if ci.national_id:
            invoice_payload["taxNo"] = ci.national_id

        if is_e_invoice and receiver_tag:
            invoice_payload["receiverTag"] = receiver_tag
            invoice_payload["eInvoiceId"] = receiver_tag

        data = self._post("SendBasicInvoiceFromModel", {"invoice": invoice_payload})
        result_data = self._check_api_response(data, "SendBasicInvoiceFromModel")

        doc_uuid: str = ""
        if isinstance(result_data, list) and result_data:
            doc_uuid = result_data[0].get("uuid") or result_data[0].get("UUID") or ""
        elif isinstance(result_data, dict):
            doc_uuid = result_data.get("uuid") or result_data.get("UUID") or ""
        elif isinstance(result_data, str):
            doc_uuid = result_data

        logger.info(
            "birfatura: fatura gönderildi uuid=%s tip=%s",
            doc_uuid, "e_invoice" if is_e_invoice else "e_archive",
        )

        return InvoiceResult(
            success=True,
            invoice_id=doc_uuid,
            invoice_number=None,
            e_document_type="e_invoice" if is_e_invoice else "e_archive",
            issued_at=today,
        )

    # ------------------------------------------------------------------
    # publish_invoice — GİB durumunu bekler
    # ------------------------------------------------------------------

    def publish_invoice(self, invoice_id: str) -> InvoiceResult:
        """Belge durumu SUCCEED olana dek poll eder."""
        doc_uuid = invoice_id
        max_attempts = self._max_attempts or _POLL_MAX

        for attempt in range(1, max_attempts + 1):
            data = self._post("GetOutBoxDocumentStatusesWithUUIDs", {"uuids": [doc_uuid]})
            result = self._check_api_response(data, "GetOutBoxDocumentStatusesWithUUIDs")

            statuses = result if isinstance(result, list) else []
            if statuses:
                status = statuses[0].get("Status", "").upper()
                logger.debug(
                    "birfatura: belge durum=%s uuid=%s (deneme %s/%s)",
                    status, doc_uuid, attempt, max_attempts,
                )
                if status in ("SUCCEED", "SUCCESS", "BASARILI", "COMPLETED"):
                    return InvoiceResult(
                        success=True,
                        invoice_id=doc_uuid,
                        issued_at=date.today().isoformat(),
                    )
                if status in ("ERROR", "FAILED", "BASARISIZ", "CANCELLED", "IPTAL"):
                    raise RuntimeError(f"BirFatura belge başarısız: status={status} uuid={doc_uuid}")
            time.sleep(self._interval)

        raise TimeoutError(
            f"BirFatura belge {doc_uuid} {max_attempts * self._interval}s içinde tamamlanmadı"
        )

    # ------------------------------------------------------------------
    # get_invoice_pdf_url — GetPDFLinkByUUID
    # ------------------------------------------------------------------

    def get_invoice_pdf_url(self, invoice_id: str) -> str:
        doc_uuid = invoice_id
        # Önce sistem tipini bul: e_invoice → EFATURA, e_archive → EARSIV
        # Basit yaklaşım: ikisini de dene
        for system_type in ("EFATURA", "EARSIV"):
            try:
                data = self._post("GetPDFLinkByUUID", {
                    "uuids": [doc_uuid],
                    "systemType": system_type,
                })
                result = self._check_api_response(data, "GetPDFLinkByUUID")
                items = result if isinstance(result, list) else []
                for item in items:
                    pdf_link = item.get("pdfLink") or item.get("PdfLink") or ""
                    if pdf_link:
                        logger.info(
                            "birfatura: PDF linki alındı uuid=%s systemType=%s url=%s",
                            doc_uuid, system_type, pdf_link,
                        )
                        return pdf_link
            except Exception as exc:
                logger.debug("birfatura: GetPDFLinkByUUID systemType=%s hata=%s", system_type, exc)

        raise RuntimeError(f"BirFatura PDF linki alınamadı uuid={doc_uuid}")

    # ------------------------------------------------------------------
    # cancel_invoice — SendDocumentAnswer IPTAL
    # ------------------------------------------------------------------

    def cancel_invoice(self, invoice_id: str) -> bool:
        try:
            data = self._post("SendDocumentAnswer", {
                "documentUUID": invoice_id,
                "acceptOrRejectCode": "IPTAL",
                "acceptOrRejectReason": "Kullanıcı talebiyle iptal",
                "systemTypeCodes": "EARSIV",
            })
            result = self._check_api_response(data, "SendDocumentAnswer")
            success = result.get("Success", False) if isinstance(result, dict) else False
            logger.info("birfatura: fatura iptal edildi uuid=%s success=%s", invoice_id, success)
            return bool(success)
        except Exception as exc:
            logger.error("birfatura: fatura iptali başarısız uuid=%s hata=%s", invoice_id, exc)
            return False

    # ------------------------------------------------------------------
    # full_invoice_flow — tüm akışı yönetir
    # ------------------------------------------------------------------

    def full_invoice_flow(
        self,
        customer_info: CustomerInfo,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        try:
            customer_id = self.find_or_create_customer(customer_info)
            result = self._build_and_send_invoice(customer_info, customer_id, items, payment_info)
            if not result.success:
                return result
        except Exception as exc:
            logger.error("birfatura: fatura oluşturma başarısız hata=%s", exc)
            return InvoiceResult(success=False, error=str(exc))

        # Durum bekle + PDF al (hata olursa faturayı engelleme)
        try:
            result = self.publish_invoice(result.invoice_id)  # type: ignore[arg-type]
        except Exception as pub_exc:
            logger.warning(
                "birfatura: belge durum beklenemedi (fatura gönderildi) uuid=%s hata=%s",
                result.invoice_id, pub_exc,
            )

        try:
            result.pdf_url = self.get_invoice_pdf_url(result.invoice_id)  # type: ignore[arg-type]
        except Exception as pdf_exc:
            logger.warning(
                "birfatura: PDF URL alınamadı (fatura geçerli) uuid=%s hata=%s",
                result.invoice_id, pdf_exc,
            )

        result.success = True
        return result
