"""Paraşüt V4 API billing provider."""

from __future__ import annotations

import logging
import os
import time
from datetime import date, datetime, timedelta
from typing import Any

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, before_sleep_log

from .base import BillingProviderBase
from .models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo

logger = logging.getLogger(__name__)

_PARASUT_BASE = "https://api.parasut.com"
_TOKEN_URL = f"{_PARASUT_BASE}/oauth/token"
_POLL_INTERVAL = 3       # saniye
_POLL_MAX = 10           # maksimum deneme


def _api_base(company_id: str) -> str:
    return f"{_PARASUT_BASE}/v4/{company_id}"


class ParasutProvider(BillingProviderBase):
    """Paraşüt V4 JSON:API entegrasyonu."""

    def __init__(self) -> None:
        self._client_id = os.environ["PARASUT_CLIENT_ID"]
        self._client_secret = os.environ["PARASUT_CLIENT_SECRET"]
        self._username = os.environ["PARASUT_USERNAME"]
        self._password = os.environ["PARASUT_PASSWORD"]
        self._company_id = os.environ["PARASUT_COMPANY_ID"]
        self._base = _api_base(self._company_id)

        self._access_token: str | None = None
        self._token_expires_at: datetime = datetime.min

        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json", "Accept": "application/json"})

    # ------------------------------------------------------------------
    # Token yönetimi
    # ------------------------------------------------------------------

    def _refresh_token(self) -> None:
        logger.debug("parasut: OAuth token yenileniyor")
        resp = self._session.post(
            _TOKEN_URL,
            data={
                "grant_type": "password",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "username": self._username,
                "password": self._password,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        self._access_token = data["access_token"]
        expires_in = int(data.get("expires_in", 7200))
        # 60 saniye önceden yenile
        self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)
        self._session.headers["Authorization"] = f"Bearer {self._access_token}"
        logger.debug("parasut: token alındı, geçerlilik=%ss", expires_in)

    def _ensure_token(self) -> None:
        if self._access_token is None or datetime.utcnow() >= self._token_expires_at:
            self._refresh_token()

    # ------------------------------------------------------------------
    # HTTP yardımcıları (retry ile)
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _get(self, path: str, params: dict | None = None) -> dict:
        self._ensure_token()
        url = f"{self._base}/{path.lstrip('/')}"
        logger.debug("parasut GET %s params=%s", url, params)
        resp = self._session.get(url, params=params, timeout=30)
        logger.debug("parasut GET %s → %s", url, resp.status_code)
        resp.raise_for_status()
        return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _post(self, path: str, body: dict) -> dict:
        self._ensure_token()
        url = f"{self._base}/{path.lstrip('/')}"
        logger.debug("parasut POST %s body=%s", url, body)
        resp = self._session.post(url, json=body, timeout=30)
        logger.debug("parasut POST %s → %s", url, resp.status_code)
        resp.raise_for_status()
        return resp.json()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=4),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )
    def _delete(self, path: str) -> bool:
        self._ensure_token()
        url = f"{self._base}/{path.lstrip('/')}"
        logger.debug("parasut DELETE %s", url)
        resp = self._session.delete(url, timeout=30)
        logger.debug("parasut DELETE %s → %s", url, resp.status_code)
        resp.raise_for_status()
        return True

    # ------------------------------------------------------------------
    # find_or_create_customer
    # ------------------------------------------------------------------

    def find_or_create_customer(self, customer_info: CustomerInfo) -> str:
        # Önce e-posta ile ara
        data = self._get("contacts", params={"filter[email]": customer_info.email})
        contacts = data.get("data", [])
        if contacts:
            contact_id = contacts[0]["id"]
            logger.info("parasut: mevcut müşteri bulundu id=%s email=%s", contact_id, customer_info.email)
            return contact_id

        # Vergi numarası ile ara (şirket)
        if customer_info.tax_number:
            data2 = self._get("contacts", params={"filter[tax_number]": customer_info.tax_number})
            contacts2 = data2.get("data", [])
            if contacts2:
                contact_id = contacts2[0]["id"]
                logger.info("parasut: vergi no ile müşteri bulundu id=%s", contact_id)
                return contact_id

        # Oluştur
        contact_type = customer_info.contact_type  # "person" | "company"
        attrs: dict[str, Any] = {
            "name": customer_info.name,
            "email": customer_info.email,
            "contact_type": contact_type,
            "account_type": "customer",
        }
        if customer_info.phone:
            attrs["phone"] = customer_info.phone
        if customer_info.tax_number:
            attrs["tax_number"] = customer_info.tax_number
        if customer_info.tax_office:
            attrs["tax_office"] = customer_info.tax_office
        if customer_info.national_id and contact_type == "person":
            attrs["id_number"] = customer_info.national_id
        if customer_info.address:
            attrs["city"] = customer_info.city or ""
            attrs["district"] = ""
            attrs["address"] = customer_info.address
            attrs["country"] = customer_info.country

        body = {"data": {"type": "contacts", "attributes": attrs}}
        result = self._post("contacts", body)
        contact_id = result["data"]["id"]
        logger.info("parasut: yeni müşteri oluşturuldu id=%s email=%s", contact_id, customer_info.email)
        return contact_id

    # ------------------------------------------------------------------
    # e-fatura kutusu kontrolü
    # ------------------------------------------------------------------

    def _is_e_invoice_subscriber(self, tax_number: str | None) -> bool:
        if not tax_number:
            return False
        try:
            data = self._get("e_invoice_inboxes", params={"filter[vkn]": tax_number})
            inboxes = data.get("data", [])
            return len(inboxes) > 0
        except Exception:
            logger.warning("parasut: e-fatura kutusu sorgulanamadı, e-arşiv kullanılacak")
            return False

    # ------------------------------------------------------------------
    # create_invoice
    # ------------------------------------------------------------------

    def create_invoice(
        self,
        customer_id: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        today = payment_info.payment_date or date.today().isoformat()

        details_data = []
        for item in items:
            details_data.append({
                "type": "sales_invoice_details",
                "attributes": {
                    "name": item.name,
                    "description": item.description or "",
                    "quantity": str(item.quantity),
                    "unit_price": str(item.unit_price),
                    "vat_rate": str(item.vat_rate),
                    "unit": item.unit,
                },
            })

        body: dict[str, Any] = {
            "data": {
                "type": "sales_invoices",
                "attributes": {
                    "item_type": "invoice",
                    "description": f"Ödeme #{payment_info.payment_id}",
                    "issue_date": today,
                    "due_date": today,
                    "cash_sale": True,
                    "payment_date": today,
                    "payment_account_id": None,
                    "currency": payment_info.currency,
                },
                "relationships": {
                    "contact": {"data": {"type": "contacts", "id": customer_id}},
                    "details": {"data": details_data},
                },
            }
        }

        result = self._post("sales_invoices", body)
        invoice_id = result["data"]["id"]
        invoice_number = result["data"]["attributes"].get("invoice_no", "")
        logger.info("parasut: fatura oluşturuldu id=%s no=%s", invoice_id, invoice_number)

        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            issued_at=today,
        )

    # ------------------------------------------------------------------
    # publish_invoice
    # ------------------------------------------------------------------

    def publish_invoice(self, invoice_id: str) -> InvoiceResult:
        # Faturayı getir — müşteri vergi nosunu öğren
        inv_data = self._get(f"sales_invoices/{invoice_id}")
        contact_id = (
            inv_data.get("data", {})
            .get("relationships", {})
            .get("contact", {})
            .get("data", {})
            .get("id")
        )
        tax_number: str | None = None
        if contact_id:
            try:
                c_data = self._get(f"contacts/{contact_id}")
                tax_number = c_data["data"]["attributes"].get("tax_number")
            except Exception:
                pass

        use_e_invoice = self._is_e_invoice_subscriber(tax_number)

        if use_e_invoice:
            return self._publish_e_invoice(invoice_id)
        else:
            return self._publish_e_archive(invoice_id)

    def _publish_e_archive(self, invoice_id: str) -> InvoiceResult:
        body: dict[str, Any] = {
            "data": {
                "type": "e_archives",
                "relationships": {
                    "sales_invoice": {"data": {"type": "sales_invoices", "id": invoice_id}}
                },
            }
        }
        result = self._post("e_archives", body)
        e_doc_id = result["data"]["id"]
        logger.info("parasut: e-arşiv gönderildi id=%s fatura=%s", e_doc_id, invoice_id)

        # "done" olana dek bekle
        self._poll_e_document("e_archives", e_doc_id)

        inv_no = result["data"]["attributes"].get("tracking_number", "")
        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            invoice_number=inv_no,
            e_document_type="e_archive",
            issued_at=date.today().isoformat(),
        )

    def _publish_e_invoice(self, invoice_id: str) -> InvoiceResult:
        body: dict[str, Any] = {
            "data": {
                "type": "e_invoices",
                "attributes": {"scenario": "commercial"},
                "relationships": {
                    "invoice": {"data": {"type": "sales_invoices", "id": invoice_id}}
                },
            }
        }
        result = self._post("e_invoices", body)
        e_doc_id = result["data"]["id"]
        logger.info("parasut: e-fatura gönderildi id=%s fatura=%s", e_doc_id, invoice_id)

        self._poll_e_document("e_invoices", e_doc_id)

        inv_no = result["data"]["attributes"].get("tracking_number", "")
        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            invoice_number=inv_no,
            e_document_type="e_invoice",
            issued_at=date.today().isoformat(),
        )

    def _poll_e_document(self, doc_type: str, doc_id: str) -> None:
        """e-belge durumu 'done' olana dek bekler."""
        for attempt in range(1, _POLL_MAX + 1):
            data = self._get(f"{doc_type}/{doc_id}")
            status = data["data"]["attributes"].get("status", "")
            logger.debug("parasut: %s/%s durum=%s (deneme %s/%s)", doc_type, doc_id, status, attempt, _POLL_MAX)
            if status == "done":
                return
            if status in ("error", "failed", "cancelled"):
                raise RuntimeError(f"Paraşüt {doc_type} başarısız: status={status}")
            time.sleep(_POLL_INTERVAL)
        raise TimeoutError(f"Paraşüt {doc_type}/{doc_id} {_POLL_MAX * _POLL_INTERVAL}s içinde tamamlanmadı")

    # ------------------------------------------------------------------
    # get_invoice_pdf_url
    # ------------------------------------------------------------------

    def get_invoice_pdf_url(self, invoice_id: str) -> str:
        # Faturayı ve active_e_document'i getir
        inv_data = self._get(f"sales_invoices/{invoice_id}", params={"include": "active_e_document"})

        included = inv_data.get("included", [])
        e_doc: dict | None = None
        for inc in included:
            if inc.get("type") in ("e_archives", "e_invoices"):
                e_doc = inc
                break

        if e_doc is None:
            # relationship üzerinden bul
            rel = (
                inv_data.get("data", {})
                .get("relationships", {})
                .get("active_e_document", {})
                .get("data")
            )
            if rel:
                e_doc_type = rel["type"]
                e_doc_id = rel["id"]
            else:
                raise RuntimeError(f"Fatura {invoice_id} için aktif e-belge bulunamadı")
        else:
            e_doc_type = e_doc["type"]
            e_doc_id = e_doc["id"]

        return self._poll_pdf_url(e_doc_type, e_doc_id)

    def _poll_pdf_url(self, doc_type: str, doc_id: str) -> str:
        for attempt in range(1, _POLL_MAX + 1):
            data = self._get(f"{doc_type}/{doc_id}/pdf")
            url = data.get("data", {}).get("attributes", {}).get("url")
            logger.debug("parasut: PDF URL deneme=%s/%s url=%s", attempt, _POLL_MAX, url)
            if url:
                return url
            time.sleep(_POLL_INTERVAL)
        raise TimeoutError(f"Paraşüt PDF {doc_type}/{doc_id} {_POLL_MAX * _POLL_INTERVAL}s içinde hazır olmadı")

    # ------------------------------------------------------------------
    # cancel_invoice
    # ------------------------------------------------------------------

    def cancel_invoice(self, invoice_id: str) -> bool:
        try:
            self._delete(f"sales_invoices/{invoice_id}/cancel")
            logger.info("parasut: fatura iptal edildi id=%s", invoice_id)
            return True
        except Exception as exc:
            logger.error("parasut: fatura iptali başarısız id=%s hata=%s", invoice_id, exc)
            return False
