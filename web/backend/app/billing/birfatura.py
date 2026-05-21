"""BirFatura OutEBelgeV2 API billing provider.

Mimari:
  Paraşüt gibi siz BirFatura'yı çağırırsınız.
  Auth: X-Api-Key / X-Secret-Key / X-Integration-Key header'ları ile.

Satış faturası akışı:
  1. GibUserList → vergi numarasına göre e-fatura mükellefi mi kontrol et.
  2. SendBasicInvoiceFromModel → SADECE "Satış" tipi fatura (E-Fatura / E-Arşiv).
     İskonto: discountIsPercentUnit + discountRateUnit + discountUnitTaxExcluding/Including.
  3. GetOutBoxDocumentStatusesWithUUIDs → belge "SUCCEED" olana dek poll.
  4. GetPDFLinkByUUID → PDF linkini al.
  5. SendDocumentAnswer (IPTAL) → iptal akışı için.

İade faturası akışı (IADE tipi — SendBasicInvoiceFromModel desteklemez):
  1. GibUserList → mükellefiyet kontrolü (e-fatura / e-arşiv tespiti).
  2. SendDocument + UBL-TR XML (InvoiceTypeCode=IADE) → iade faturası gönder.
  3. GetOutBoxDocumentStatusesWithUUIDs → durum takibi.
  4. GetPDFLinkByUUID → PDF linki.

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

import base64
import io
import logging
import os
import time
import uuid
import zipfile
from datetime import date, datetime
from typing import Any
from xml.etree import ElementTree as ET

import requests
from tenacity import before_sleep_log, retry, stop_after_attempt, wait_exponential

from .base import BillingProviderBase
from .models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo

logger = logging.getLogger(__name__)

_DEFAULT_BASE = "https://uygulama.edonustur.com/api/OutEBelgeV2"
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
            "PkGbTypeCode": tax_number,
            "PageNumber": 1,
            "PageSize": 10,
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
        now_time = datetime.now().strftime("%H:%M:%S")
        ci = customer_info
        pi = payment_info

        is_e_invoice = customer_id.startswith("efatura:")
        receiver_tag = customer_id.split(":", 1)[1] if is_e_invoice else ""

        # KDV Kanunu Md.25: iskonto matrahtan düşülür; unit_price zaten iskonto sonrası net fiyat.
        # Faturada iskonto ayrıca gösterilmeli → original_unit_price ve discount_percent kullan.
        total_excl = round(sum(i.quantity * i.unit_price for i in items), 2)
        total_incl = round(sum(
            i.quantity * i.unit_price * (1 + i.vat_rate / 100) for i in items
        ), 2)

        # İskontolu kalemler: productsTotalTax = liste fiyatı, discountTotal = fark
        has_any_discount = any(
            i.discount_percent > 0 and i.original_unit_price is not None for i in items
        )
        if has_any_discount:
            products_total_excl = round(sum(
                i.quantity * (float(i.original_unit_price) if i.original_unit_price else i.unit_price)
                for i in items
            ), 2)
            products_total_incl = round(sum(
                i.quantity * (float(i.original_unit_price) if i.original_unit_price else i.unit_price)
                * (1 + i.vat_rate / 100)
                for i in items
            ), 2)
            discount_total_excl = round(products_total_excl - total_excl, 2)
            discount_total_incl = round(products_total_incl - total_incl, 2)
        else:
            products_total_excl = total_excl
            products_total_incl = total_incl
            discount_total_excl = 0.0
            discount_total_incl = 0.0

        # TCMB alış kurunu kullan; TRY ödemelerde 1.0
        currency_code = (pi.currency or "TRY").upper()
        currency_rate = pi.currency_rate if currency_code not in ("TRY", "TRL") else 1.0

        # İhracat istisnası açıklaması
        export_note = "İhracat İstisnası (KDV K. Mad. 12)" if ci.is_export else ""

        order_details = []
        for item in items:
            has_discount = item.discount_percent > 0 and item.original_unit_price is not None

            if has_discount:
                orig = float(item.original_unit_price)
                # BirFatura iskonto alanları: birim fiyat liste fiyatı (iskonto öncesi),
                # iskonto tutarı ayrı alanlarda iletilir — KDV Kanunu Md.25 uyumu.
                disc_per_unit = round(orig * item.discount_percent / 100, 4)
                orig_excl = round(orig, 4)
                orig_incl = round(orig * (1 + item.vat_rate / 100), 4)
                disc_incl = round(disc_per_unit * (1 + item.vat_rate / 100), 4)
                note = (
                    f"İskonto %{item.discount_percent} uygulandı. "
                    f"Liste fiyatı: {orig:.2f} TL | "
                    f"İskonto: {disc_per_unit:.2f} TL | "
                    f"Matrah: {item.unit_price:.2f} TL"
                )
                order_details.append({
                    "productCode": item.name.replace(" ", "_")[:20],
                    "productName": item.name,
                    "productNote": note,
                    "productQuantityType": item.unit,
                    "productQuantity": item.quantity,
                    "vatRate": int(item.vat_rate),
                    "productUnitPriceTaxExcluding": orig_excl,
                    "productUnitPriceTaxIncluding": orig_incl,
                    "discountIsPercentUnit": 1,
                    "discountRateUnit": float(item.discount_percent),
                    "discountUnitTaxExcluding": disc_per_unit,
                    "discountUnitTaxIncluding": disc_incl,
                })
            else:
                note = item.description or export_note
                price_excl = round(float(item.unit_price), 4)
                price_incl = round(item.unit_price * (1 + item.vat_rate / 100), 4)
                order_details.append({
                    "productCode": item.name.replace(" ", "_")[:20],
                    "productName": item.name,
                    "productNote": note,
                    "productQuantityType": item.unit,
                    "productQuantity": item.quantity,
                    "vatRate": int(item.vat_rate),
                    "productUnitPriceTaxExcluding": price_excl,
                    "productUnitPriceTaxIncluding": price_incl,
                    "discountIsPercentUnit": 0,
                    "discountRateUnit": 0,
                    "discountUnitTaxExcluding": 0,
                    "discountUnitTaxIncluding": 0,
                })

        doc_uuid = str(uuid.uuid4())

        invoice_payload: dict[str, Any] = {
            "ettn": doc_uuid,
            "invoiceDate": today,
            "invoiceTime": now_time,
            "orderDate": today,
            "OrderCode": pi.payment_id,
            "isDocumentNoAuto": True,
            "invoiceExplanation": "PDF Platform",
            "billingName": ci.name,
            "billingAddress": ci.address or "",
            "billingCity": ci.city or "",
            "billingMobilePhone": ci.phone or "",
            "email": ci.email,
            "paymentType": "iyzico",
            "currency": currency_code,
            "currencyRate": currency_rate,
            "totalPaidTaxExcluding": total_excl,
            "totalPaidTaxIncluding": total_incl,
            "productsTotalTaxExcluding": products_total_excl,
            "productsTotalTaxIncluding": products_total_incl,
            "discountTotalTaxExcluding": discount_total_excl,
            "discountTotalTaxIncluding": discount_total_incl,
            "orderDetails": order_details,
        }

        # VKN (10 hane, kurumsal) veya TCKN (11 hane, bireysel) — her ikisi de taxNo alanına gider
        if ci.tax_number:
            invoice_payload["taxNo"] = ci.tax_number
            invoice_payload["taxOffice"] = ci.tax_office or ""
        elif ci.national_id:
            invoice_payload["taxNo"] = ci.national_id

        if is_e_invoice and receiver_tag:
            invoice_payload["receiverTag"] = receiver_tag
            invoice_payload["eInvoiceId"] = receiver_tag

        data = self._post("SendBasicInvoiceFromModel", {"invoice": invoice_payload})
        result_data = self._check_api_response(data, "SendBasicInvoiceFromModel")

        invoice_no: str | None = None
        pdf_link: str | None = None
        if isinstance(result_data, dict):
            invoice_no = result_data.get("invoiceNo") or result_data.get("InvoiceNo")
            pdf_link = result_data.get("pdfLink") or result_data.get("PdfLink")

        logger.info(
            "birfatura: fatura gönderildi uuid=%s invoiceNo=%s tip=%s pdfLink=%s",
            doc_uuid, invoice_no, "e_invoice" if is_e_invoice else "e_archive", bool(pdf_link),
        )

        return InvoiceResult(
            success=True,
            invoice_id=doc_uuid,
            invoice_number=invoice_no,
            pdf_url=pdf_link,
            e_document_type="e_invoice" if is_e_invoice else "e_archive",
            issued_at=today,
        )

    # ------------------------------------------------------------------
    # publish_invoice — GİB durumunu bekler
    # ------------------------------------------------------------------

    def publish_invoice(self, invoice_id: str) -> InvoiceResult:
        """Belge durumu SUCCEED olana dek poll eder; invoice numarasını da döner."""
        doc_uuid = invoice_id
        max_attempts = self._max_attempts or _POLL_MAX

        for attempt in range(1, max_attempts + 1):
            data = self._post("GetOutBoxDocumentStatusesWithUUIDs", {"Uuids": [doc_uuid]})
            result = self._check_api_response(data, "GetOutBoxDocumentStatusesWithUUIDs")

            statuses = result if isinstance(result, list) else []
            if statuses:
                rec = statuses[0]
                status = rec.get("Status", "").upper()
                doc_no = (
                    rec.get("DocumentNo") or rec.get("documentNo")
                    or rec.get("InvoiceNo") or rec.get("invoiceNo")
                    or rec.get("DocNo") or rec.get("docNo")
                    or rec.get("BelgeNo") or rec.get("belgeNo")
                    or rec.get("EBelgeNo") or rec.get("eBelgeNo")
                    or rec.get("FaturaNo") or rec.get("faturaNo")
                    or rec.get("Number") or rec.get("number")
                )
                logger.info(
                    "birfatura: belge durum=%s docNo=%s uuid=%s tüm_alanlar=%s (deneme %s/%s)",
                    status, doc_no, doc_uuid, list(rec.keys()), attempt, max_attempts,
                )
                if status in ("SUCCEED", "SUCCESS", "BASARILI", "COMPLETED", "IMZALANDI", "ILETILDI", "KABUL"):
                    return InvoiceResult(
                        success=True,
                        invoice_id=doc_uuid,
                        invoice_number=doc_no,
                        issued_at=date.today().isoformat(),
                    )
                if status in ("ERROR", "FAILED", "BASARISIZ", "CANCELLED", "IPTAL"):
                    raise RuntimeError(f"BirFatura belge başarısız: status={status} uuid={doc_uuid}")
            time.sleep(self._interval)

        raise TimeoutError(
            f"BirFatura belge {doc_uuid} {max_attempts * self._interval}s içinde tamamlanmadı"
        )

    def _fetch_invoice_number_by_uuid(self, doc_uuid: str) -> str | None:
        """UUID ile BirFatura'dan belge numarasını sorgular."""
        try:
            data = self._post("GetOutBoxDocumentStatusesWithUUIDs", {"Uuids": [doc_uuid]})
            result = self._check_api_response(data, "GetOutBoxDocumentStatusesWithUUIDs")
            statuses = result if isinstance(result, list) else []
            if statuses:
                rec = statuses[0]
                doc_no = (
                    rec.get("DocumentNo") or rec.get("documentNo")
                    or rec.get("InvoiceNo") or rec.get("invoiceNo")
                    or rec.get("DocNo") or rec.get("docNo")
                    or rec.get("BelgeNo") or rec.get("belgeNo")
                    or rec.get("EBelgeNo") or rec.get("eBelgeNo")
                    or rec.get("FaturaNo") or rec.get("faturaNo")
                    or rec.get("Number") or rec.get("number")
                )
                logger.info(
                    "birfatura: UUID=%s → belge no=%s tüm_alanlar=%s",
                    doc_uuid, doc_no, list(rec.keys()),
                )
                return doc_no
        except Exception as exc:
            logger.warning("birfatura: belge no sorgulanamadı uuid=%s hata=%s", doc_uuid, exc)
        return None

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
                    "Uuids": [doc_uuid],
                    "SystemType": system_type,
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
                "DocumentUUID": invoice_id,
                "AcceptOrRejectCode": "IPTAL",
                "AcceptOrRejectReason": "Kullanıcı talebiyle iptal",
                "SystemTypeCodes": "EARSIV",
            })
            result = self._check_api_response(data, "SendDocumentAnswer")
            success = result.get("Success", False) if isinstance(result, dict) else False
            logger.info("birfatura: fatura iptal edildi uuid=%s success=%s", invoice_id, success)
            return bool(success)
        except Exception as exc:
            logger.error("birfatura: fatura iptali başarısız uuid=%s hata=%s", invoice_id, exc)
            return False

    # ------------------------------------------------------------------
    # create_credit_note — iade faturası oluştur (SendDocument + UBL XML)
    # ------------------------------------------------------------------

    def create_credit_note(
        self,
        original_invoice_id: str,
        customer_info: CustomerInfo,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
        reason: str = "Kullanıcı talebiyle iade",
        original_invoice_no: str = "",
        original_invoice_date: str = "",
    ) -> InvoiceResult:
        """
        BirFatura'da iade faturası SendDocument + UBL-TR XML ile gönderilir.
        SendBasicInvoiceFromModel yalnızca basit satış faturası destekler;
        iade (IADE) tipi için tam UBL XML zorunludur.
        """
        try:
            customer_id = self.find_or_create_customer(customer_info)
        except Exception as exc:
            return InvoiceResult(success=False, error=f"Müşteri bulunamadı: {exc}")

        is_e_invoice = customer_id.startswith("efatura:")
        receiver_tag = customer_id.split(":", 1)[1] if is_e_invoice else ""
        system_type = "EFATURA" if is_e_invoice else "EARSIV"

        today = payment_info.payment_date or date.today().isoformat()
        doc_uuid = str(uuid.uuid4())

        # original_invoice_no boş ya da 16 karakter değilse UUID ile BirFatura'dan sorgula
        resolved_invoice_no = original_invoice_no.strip()
        if (not resolved_invoice_no or len(resolved_invoice_no) != 16) and original_invoice_id:
            fetched = self._fetch_invoice_number_by_uuid(original_invoice_id)
            if fetched and len(fetched.strip()) == 16:
                resolved_invoice_no = fetched.strip()
                logger.info(
                    "birfatura: orijinal fatura no UUID'den alındı uuid=%s no=%s",
                    original_invoice_id, resolved_invoice_no,
                )

        if not resolved_invoice_no or len(resolved_invoice_no) != 16:
            logger.error(
                "birfatura: iade faturası iptal — 16 haneli orijinal fatura no bulunamadı "
                "uuid=%s no=%r", original_invoice_id, resolved_invoice_no,
            )
            return InvoiceResult(
                success=False,
                error=f"Orijinal fatura numarası (16 hane) bulunamadı. "
                      f"UUID={original_invoice_id}, no={resolved_invoice_no!r}",
            )

        try:
            xml_str = self._build_credit_note_xml(
                doc_uuid=doc_uuid,
                issue_date=today,
                original_invoice_no=resolved_invoice_no,
                original_invoice_date=original_invoice_date or today,
                customer_info=customer_info,
                receiver_tag=receiver_tag,
                items=items,
                payment_info=payment_info,
                reason=reason,
                is_e_invoice=is_e_invoice,
            )
        except Exception as exc:
            return InvoiceResult(success=False, error=f"XML oluşturulamadı: {exc}")

        document_bytes = self._compress_xml(xml_str)

        payload: dict[str, Any] = {
            "DocumentBytes": document_bytes,
            "SystemTypeCodes": system_type,
            "IsDocumentNoAuto": True,
        }
        if receiver_tag:
            payload["ReceiverTag"] = receiver_tag

        try:
            data = self._post("SendDocument", payload)
            result_data = self._check_api_response(data, "SendDocument IADE")
        except Exception as exc:
            return InvoiceResult(success=False, error=f"İade faturası gönderilemedi: {exc}")

        invoice_no: str | None = None
        pdf_link: str | None = None
        if isinstance(result_data, dict):
            invoice_no = result_data.get("invoiceNo") or result_data.get("InvoiceNo")
            pdf_link = result_data.get("pdfLink") or result_data.get("PdfLink")

        logger.info(
            "birfatura: iade faturası gönderildi uuid=%s invoiceNo=%s orijinal=%s tip=%s",
            doc_uuid, invoice_no, original_invoice_no or original_invoice_id, system_type,
        )

        # GİB durum bekle (hata olursa faturayı engelleme)
        try:
            self.publish_invoice(doc_uuid)
        except Exception as pub_exc:
            logger.warning(
                "birfatura: iade belge durum beklenemedi uuid=%s hata=%s",
                doc_uuid, pub_exc,
            )

        if not pdf_link:
            try:
                pdf_link = self.get_invoice_pdf_url(doc_uuid)
            except Exception as pdf_exc:
                logger.warning("birfatura: iade PDF URL alınamadı uuid=%s hata=%s", doc_uuid, pdf_exc)

        return InvoiceResult(
            success=True,
            invoice_id=doc_uuid,
            invoice_number=invoice_no,
            pdf_url=pdf_link,
            e_document_type="e_invoice" if is_e_invoice else "e_archive",
            issued_at=today,
        )

    # ------------------------------------------------------------------
    # _build_credit_note_xml — UBL-TR IADE fatura XML'i oluşturur
    # ------------------------------------------------------------------

    def _build_credit_note_xml(
        self,
        doc_uuid: str,
        issue_date: str,
        original_invoice_no: str,
        original_invoice_date: str,
        customer_info: CustomerInfo,
        receiver_tag: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
        reason: str,
        is_e_invoice: bool,
    ) -> str:
        from xml.sax.saxutils import escape as _esc

        now_time = datetime.now().strftime("%H:%M:%S.0000000+03:00")
        currency = (payment_info.currency or "TRY").upper()
        if currency in ("TRL", ""):
            currency = "TRY"

        total_excl = round(sum(i.quantity * i.unit_price for i in items), 2)
        tax_amount = round(sum(
            i.quantity * i.unit_price * (i.vat_rate / 100) for i in items
        ), 2)
        total_incl = round(total_excl + tax_amount, 2)
        vat_rate = items[0].vat_rate if items else 20

        sup_vkn      = _esc(os.getenv("BIRFATURA_SUPPLIER_VKN", ""))
        sup_name     = _esc(os.getenv("BIRFATURA_SUPPLIER_NAME", os.getenv("COMPANY_NAME", "")))
        sup_address  = _esc(os.getenv("BIRFATURA_SUPPLIER_ADDRESS", ""))
        sup_city     = _esc(os.getenv("BIRFATURA_SUPPLIER_CITY", ""))
        sup_tax_off  = _esc(os.getenv("BIRFATURA_SUPPLIER_TAX_OFFICE", ""))
        sup_phone    = _esc(os.getenv("BIRFATURA_SUPPLIER_PHONE", ""))
        sup_email    = _esc(os.getenv("BIRFATURA_SUPPLIER_EMAIL", ""))

        ci = customer_info
        cust_id_scheme = "VKN" if ci.tax_number else "TCKN"
        cust_id_value  = _esc(ci.tax_number or ci.national_id or "")
        cust_name      = _esc(ci.name)
        cust_address   = _esc(ci.address or "")
        cust_city      = _esc(ci.city or "")
        cust_country   = _esc(ci.country or "Türkiye")
        cust_phone     = _esc(ci.phone or "")
        cust_email     = _esc(ci.email)
        cust_tax_off   = _esc(ci.tax_office or "")

        recvpk = _esc(f"urn:mail:{receiver_tag}" if receiver_tag else "urn:mail:defaultpk@birfatura.com")
        reason_esc = _esc(reason)

        billing_ref_xml = ""
        if original_invoice_no:
            oin  = _esc(original_invoice_no)
            oid  = _esc(original_invoice_date)
            oettn = _esc(original_invoice_id)   # orijinal faturanın ETTN/UUID'si
            billing_ref_xml = f"""
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>{oin}</cbc:ID>
      <cbc:UUID>{oettn}</cbc:UUID>
      <cbc:IssueDate>{oid}</cbc:IssueDate>
      <cbc:DocumentTypeCode>IADE</cbc:DocumentTypeCode>
      <cbc:DocumentType>IADE</cbc:DocumentType>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>"""

        # Ana Note alanına iade ve orijinal fatura bilgisini ekle
        if original_invoice_no:
            reason_esc = _esc(f"{reason} - Iadeye Konu Fatura: {original_invoice_no} ({original_invoice_date})")

        cust_tax_scheme_xml = ""
        if ci.tax_number:
            cust_tax_scheme_xml = f"""
        <cac:PartyTaxScheme>
          <cac:TaxScheme><cbc:Name>{cust_tax_off}</cbc:Name></cac:TaxScheme>
        </cac:PartyTaxScheme>"""

        # UBL-TR Schematron: TCKN olduğunda cac:Person zorunlu
        cust_person_xml = ""
        if cust_id_scheme == "TCKN":
            name_parts = ci.name.strip().rsplit(" ", 1)
            p_first  = _esc(name_parts[0]) if len(name_parts) > 1 else _esc(ci.name)
            p_family = _esc(name_parts[1]) if len(name_parts) > 1 else ""
            cust_person_xml = f"""
      <cac:Person>
        <cbc:FirstName>{p_first}</cbc:FirstName>
        <cbc:FamilyName>{p_family}</cbc:FamilyName>
      </cac:Person>"""

        lines_xml = ""
        for idx, item in enumerate(items, start=1):
            line_excl = round(item.quantity * item.unit_price, 2)
            line_tax  = round(line_excl * item.vat_rate / 100, 2)
            item_name = _esc(item.name)
            item_desc = _esc(item.description or reason)
            lines_xml += f"""
  <cac:InvoiceLine>
    <cbc:ID>{idx}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">{item.quantity:.4f}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="{currency}">{line_excl:.2f}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="{currency}">{line_tax:.2f}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="{currency}">{line_excl:.2f}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="{currency}">{line_tax:.2f}</cbc:TaxAmount>
        <cbc:Percent>{item.vat_rate}</cbc:Percent>
        <cac:TaxCategory>
          <cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>{item_desc}</cbc:Description>
      <cbc:Name>{item_name}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="{currency}">{item.unit_price:.6f}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>"""

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:ubltr="urn:oasis:names:specification:ubl:schema:xsd:TurkishCustomizationExtensionComponents"
         xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xmlns:ccts="urn:un:unece:uncefact:documentation:2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
         xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2"
         xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent> </ext:ExtensionContent></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>{"TEMELFATURA" if is_e_invoice else "EARSIVFATURA"}</cbc:ProfileID>
  <cbc:ID>{"EFA" if is_e_invoice else "ARS"}0000000000001</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>{doc_uuid}</cbc:UUID>
  <cbc:IssueDate>{issue_date}</cbc:IssueDate>
  <cbc:IssueTime>{now_time}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>IADE</cbc:InvoiceTypeCode>
  <cbc:Note>{reason_esc}</cbc:Note>
  <cbc:DocumentCurrencyCode>{currency}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>{len(items)}</cbc:LineCountNumeric>{billing_ref_xml}
  <cac:AdditionalDocumentReference>
    <cbc:ID>{doc_uuid}</cbc:ID>
    <cbc:IssueDate>{issue_date}</cbc:IssueDate>
    <cbc:DocumentTypeCode>CUST_INV_ID</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>0100</cbc:ID>
    <cbc:IssueDate>{issue_date}</cbc:IssueDate>
    <cbc:DocumentTypeCode>OUTPUT_TYPE</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ELEKTRONIK</cbc:ID>
    <cbc:IssueDate>{issue_date}</cbc:IssueDate>
    <cbc:DocumentTypeCode>EREPSENDT</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>{recvpk}</cbc:ID>
    <cbc:IssueDate>{issue_date}</cbc:IssueDate>
    <cbc:DocumentTypeCode>recvpk</cbc:DocumentTypeCode>
  </cac:AdditionalDocumentReference>
  <cac:Signature>
    <cbc:ID schemeID="VKN_TCKN">{sup_vkn}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">{sup_vkn}</cbc:ID></cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>{sup_address}</cbc:StreetName>
        <cbc:CitySubdivisionName/>
        <cbc:CityName>{sup_city}</cbc:CityName>
        <cac:Country><cbc:Name>TÜRKİYE</cbc:Name></cac:Country>
      </cac:PostalAddress>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference><cbc:URI>#Signature</cbc:URI></cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification><cbc:ID schemeID="VKN">{sup_vkn}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>{sup_name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{sup_address}</cbc:StreetName>
        <cbc:CitySubdivisionName/>
        <cbc:CityName>{sup_city}</cbc:CityName>
        <cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cac:TaxScheme><cbc:Name>{sup_tax_off}</cbc:Name></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:Contact>
        <cbc:Telephone>{sup_phone}</cbc:Telephone>
        <cbc:ElectronicMail>{sup_email}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="{cust_id_scheme}">{cust_id_value}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName><cbc:Name>{cust_name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{cust_address}</cbc:StreetName>
        <cbc:CitySubdivisionName/>
        <cbc:CityName>{cust_city}</cbc:CityName>
        <cac:Country><cbc:Name>{cust_country}</cbc:Name></cac:Country>
      </cac:PostalAddress>{cust_tax_scheme_xml}
      <cac:Contact>
        <cbc:Telephone>{cust_phone}</cbc:Telephone>
        <cbc:ElectronicMail>{cust_email}</cbc:ElectronicMail>
      </cac:Contact>{cust_person_xml}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="{currency}">{tax_amount:.2f}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="{currency}">{total_excl:.2f}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="{currency}">{tax_amount:.2f}</cbc:TaxAmount>
      <cbc:Percent>{vat_rate}</cbc:Percent>
      <cac:TaxCategory>
        <cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="{currency}">{total_excl:.2f}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="{currency}">{total_excl:.2f}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="{currency}">{total_incl:.2f}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="{currency}">0.00</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="{currency}">{total_incl:.2f}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>{lines_xml}
</Invoice>"""

    # ------------------------------------------------------------------
    # _compress_xml — XML'i ZIP sıkıştırıp base64'e çevirir
    # ------------------------------------------------------------------

    @staticmethod
    def _compress_xml(xml_str: str) -> str:
        xml_bytes = xml_str.encode("utf-8")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("invoice.xml", xml_bytes)
        return base64.b64encode(buf.getvalue()).decode("ascii")

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

        # Durum bekle (hata olursa faturayı engelleme)
        initial_pdf_url = result.pdf_url
        initial_invoice_no = result.invoice_number
        saved_uuid = result.invoice_id
        try:
            pub_result = self.publish_invoice(saved_uuid)  # type: ignore[arg-type]
            # publish_invoice'dan gelen invoice numarasını koru
            if pub_result.invoice_number:
                result.invoice_number = pub_result.invoice_number
        except Exception as pub_exc:
            logger.warning(
                "birfatura: belge durum beklenemedi (fatura gönderildi) uuid=%s hata=%s",
                saved_uuid, pub_exc,
            )

        # invoice_number hala yoksa status'tan doğrudan al
        if not result.invoice_number:
            result.invoice_number = self._fetch_invoice_number_by_uuid(saved_uuid) or initial_invoice_no

        # SendBasicInvoiceFromModel zaten pdfLink döndürdüyse tekrar sorgulamaya gerek yok
        if initial_pdf_url:
            result.pdf_url = initial_pdf_url
        else:
            try:
                result.pdf_url = self.get_invoice_pdf_url(saved_uuid)  # type: ignore[arg-type]
            except Exception as pdf_exc:
                logger.warning(
                    "birfatura: PDF URL alınamadı (fatura geçerli) uuid=%s hata=%s",
                    saved_uuid, pdf_exc,
                )

        result.invoice_id = saved_uuid
        result.success = True
        return result
