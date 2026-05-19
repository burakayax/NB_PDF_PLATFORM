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

    _cached_account_id: str | None = None
    _cached_category_id: str | None = None
    _CATEGORY_NAME = "PDF PLATFORM"

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
        # Token endpoint form-encoded istiyor; session'daki application/json header'ini
        # override etmek icin session'i bypass edip dogrudan requests.post kullaniyoruz.
        resp = requests.post(
            _TOKEN_URL,
            data={
                "grant_type": "password",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "username": self._username,
                "password": self._password,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            timeout=30,
        )
        if not resp.ok:
            logger.error(
                "parasut: OAuth token alinamadi status=%s body=%s",
                resp.status_code,
                resp.text[:500],
            )
        resp.raise_for_status()
        data = resp.json()
        self._access_token = data["access_token"]
        expires_in = int(data.get("expires_in", 7200))
        # 60 saniye onceden yenile
        self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)
        self._session.headers["Authorization"] = f"Bearer {self._access_token}"
        logger.info("parasut: OAuth token alindi, gecerlilik=%ss", expires_in)

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
        logger.debug("parasut GET %s status=%s", url, resp.status_code)
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
        logger.info("parasut POST %s request_body=%s", url, body)
        resp = self._session.post(url, json=body, timeout=30)
        logger.info("parasut POST %s status=%s response_body=%s", url, resp.status_code, resp.text[:2000])
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
        logger.debug("parasut DELETE %s status=%s", url, resp.status_code)
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
        if contact_type == "person":
            if customer_info.national_id:
                attrs["id_number"] = customer_info.national_id
            elif customer_info.is_export:
                attrs["id_number"] = "1111111111"   # GİB yabancı müşteri fallback (10 hane)
            else:
                attrs["id_number"] = "11111111111"  # GİB TC fallback bireyler için (11 hane)
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
    # Kategori bul/olustur
    # ------------------------------------------------------------------

    def _get_category_id(self) -> str | None:
        """'PDF PLATFORM' kategorisini bulur; yoksa olusturur. Hata varsa None doner."""
        try:
            if self.__class__._cached_category_id:
                return self.__class__._cached_category_id
            data = self._get("item_categories", params={"filter[name]": self._CATEGORY_NAME})
            cats = data.get("data", [])
            if cats:
                cid = cats[0]["id"]
            else:
                body: dict[str, Any] = {
                    "data": {
                        "type": "item_categories",
                        "attributes": {"name": self._CATEGORY_NAME, "bg_color": "#1a73e8", "text_color": "#ffffff"},
                    }
                }
                result = self._post("item_categories", body)
                cid = result["data"]["id"]
                logger.info("parasut: kategori olusturuldu id=%s name=%s", cid, self._CATEGORY_NAME)
            self.__class__._cached_category_id = cid
            return cid
        except Exception as exc:
            logger.warning("parasut: kategori alinamadi, atlanıyor hata=%s", exc)
            return None

    # ------------------------------------------------------------------
    # Varsayilan tahsilat hesabi
    # ------------------------------------------------------------------

    def _get_default_account_id(self) -> str:
        """Sirketin ilk aktif banka/kasa hesabini doner; sonucu cache'ler."""
        if self.__class__._cached_account_id:
            return self.__class__._cached_account_id
        data = self._get("accounts", params={"filter[account_type]": "cash"})
        accounts = data.get("data", [])
        if not accounts:
            # Kasa yoksa banka dene
            data = self._get("accounts")
            accounts = data.get("data", [])
        if not accounts:
            raise RuntimeError("Parasut hesabi bulunamadi; once Parasut panelinden bir kasa/banka hesabi olusturun.")
        account_id = accounts[0]["id"]
        logger.info("parasut: varsayilan hesap secildi id=%s", account_id)
        self.__class__._cached_account_id = account_id
        return account_id

    # ------------------------------------------------------------------
    # find_or_create_product
    # ------------------------------------------------------------------

    def _find_or_create_product(self, name: str, unit_price: float, vat_rate: int, unit: str) -> str:
        """Parasut'ta urun bul; yoksa olustur. Urun ID'sini doner."""
        data = self._get("products", params={"filter[name]": name})
        products = data.get("data", [])
        if products:
            pid = products[0]["id"]
            logger.debug("parasut: mevcut urun bulundu id=%s name=%s", pid, name)
            return pid

        product_body: dict[str, Any] = {
            "data": {
                "type": "products",
                "attributes": {
                    "name": name,
                    "unit": unit,
                    "vat_rate": str(vat_rate),
                    "sales_vat_rate": str(vat_rate),
                    "unit_price": str(unit_price),
                    "currency": "TRL",
                    "buying_currency": "TRL",
                },
            }
        }
        result = self._post("products", product_body)
        pid = result["data"]["id"]
        logger.info("parasut: yeni urun olusturuldu id=%s name=%s", pid, name)
        return pid

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

        # Parasut kendi ic kodu olarak "TRL" kullanir (ISO 4217 "TRY" degil)
        raw_currency = payment_info.currency.upper()
        # TRY veya bos gelirse TRL'ye cevir; diger dovizler oldugu gibi kalsin
        parasut_currency = "TRL" if raw_currency in ("TRY", "TRL", "") else raw_currency

        category_id = self._get_category_id()

        # Her kalem icin Parasut urun bul/olustur, sonra detail'a bagla
        details_data = []
        for item in items:
            product_id = self._find_or_create_product(
                name=item.name,
                unit_price=float(item.unit_price),
                vat_rate=int(item.vat_rate),
                unit=item.unit,
            )
            details_data.append({
                "type": "sales_invoice_details",
                "attributes": {
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "vat_rate": int(item.vat_rate),
                    "unit": item.unit,
                    "description": item.description or "",
                },
                "relationships": {
                    "product": {"data": {"type": "products", "id": product_id}},
                },
            })

        # Dövizli faturalarda Paraşüt exchange_rate alanı zorunlu (1 birim döviz = X TRY)
        exchange_rate = payment_info.currency_rate if parasut_currency != "TRL" else 1.0

        body: dict[str, Any] = {
            "data": {
                "type": "sales_invoices",
                "attributes": {
                    "item_type": "invoice",
                    "description": f"Odeme #{payment_info.payment_id}",
                    "issue_date": today,
                    "due_date": today,
                    "currency": parasut_currency,
                    "exchange_rate": exchange_rate,
                    "cash_sale": True,
                    "payment_account_id": int(self._get_default_account_id()),
                    "payment_date": today,
                    "payment_description": f"iyzico #{payment_info.payment_id}",
                },
                "relationships": {
                    "contact": {"data": {"type": "contacts", "id": customer_id}},
                    "details": {"data": details_data},
                    **({
                        "category": {"data": {"type": "item_categories", "id": category_id}}
                    } if category_id else {}),
                },
            }
        }

        result = self._post("sales_invoices", body)
        attrs = result["data"]["attributes"]
        invoice_id = result["data"]["id"]
        invoice_number = attrs.get("invoice_no", "")
        # Musteri acisindan acik (login gerektirmeyen) portal linki
        sharing_url = attrs.get("sharing_preview_url") or ""
        logger.info("parasut: fatura oluşturuldu id=%s no=%s portal=%s", invoice_id, invoice_number, sharing_url)

        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            issued_at=today,
            pdf_url=sharing_url or None,
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
        try:
            result = self._post("e_archives", body)
        except Exception as exc:
            # e-Arsiv entegrasyonu aktif degilse retry yapma, direk yukari firlat
            if "e-Arşiv" in str(exc) or "entegrasyon" in str(exc):
                raise
            raise
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
    # full_invoice_flow override — e-belge yoksa yine de basarili don
    # ------------------------------------------------------------------

    def full_invoice_flow(self, customer_info, items, payment_info):  # type: ignore[override]
        from .models import InvoiceResult as _IR
        try:
            customer_id = self.find_or_create_customer(customer_info)
            result = self.create_invoice(customer_id, items, payment_info)
            if not result.success:
                return result
        except Exception as exc:
            return _IR(success=False, error=str(exc))

        # publish ve PDF — e-belge entegrasyonu yoksa uyar ama engelleme
        try:
            result = self.publish_invoice(result.invoice_id)  # type: ignore[arg-type]
            if result.success:
                try:
                    result.pdf_url = self.get_invoice_pdf_url(result.invoice_id)  # type: ignore[arg-type]
                except Exception as pdf_exc:
                    logger.warning("parasut: PDF URL alinamadi (fatura gecerli) hata=%s", pdf_exc)
        except Exception as pub_exc:
            err_str = str(pub_exc)
            if "e-Arşiv" in err_str or "e-Fatura" in err_str or "entegrasyon" in err_str:
                logger.warning(
                    "parasut: e-belge entegrasyonu aktif degil, fatura taslak kalacak. "
                    "invoice_id=%s hata=%s", result.invoice_id, pub_exc
                )
            else:
                logger.error("parasut: publish_invoice hatasi invoice_id=%s hata=%s", result.invoice_id, pub_exc)
            # Her durumda abonelik bloke olmasin; Parasut print URL'ini fallback olarak kullan
            result.success = True
            if result.invoice_id and not result.pdf_url:
                result.pdf_url = (
                    f"https://uygulama.parasut.com/{self._company_id}"
                    f"/sales_invoices/{result.invoice_id}/print"
                )

        return result

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

    # ------------------------------------------------------------------
    # create_credit_note — iade faturası oluştur ve e-belge olarak gönder
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
        Orijinal faturayı iptal eder, ardından iade faturası (credit note) oluşturur.
        Paraşüt'te iade faturası: item_type='refund' + orijinal fatura ilişkisi.
        """
        today = date.today().isoformat()
        raw_currency = payment_info.currency.upper()
        parasut_currency = "TRL" if raw_currency in ("TRY", "TRL", "") else raw_currency
        exchange_rate = payment_info.currency_rate if parasut_currency != "TRL" else 1.0
        category_id = self._get_category_id()

        # Müşteri bul/oluştur
        try:
            customer_id = self.find_or_create_customer(customer_info)
        except Exception as exc:
            return InvoiceResult(success=False, error=f"Müşteri bulunamadı: {exc}")

        # Ürün satırları
        details_data = []
        for item in items:
            product_id = self._find_or_create_product(
                name=item.name,
                unit_price=float(item.unit_price),
                vat_rate=int(item.vat_rate),
                unit=item.unit,
            )
            details_data.append({
                "type": "sales_invoice_details",
                "attributes": {
                    "quantity": float(item.quantity),
                    "unit_price": float(item.unit_price),
                    "vat_rate": int(item.vat_rate),
                    "unit": item.unit,
                    "description": reason,
                },
                "relationships": {
                    "product": {"data": {"type": "products", "id": product_id}},
                },
            })

        body: dict[str, Any] = {
            "data": {
                "type": "sales_invoices",
                "attributes": {
                    "item_type": "refund",
                    "description": f"İade - {reason} | Orijinal Ödeme #{payment_info.payment_id}",
                    "issue_date": today,
                    "due_date": today,
                    "currency": parasut_currency,
                    "exchange_rate": exchange_rate,
                    "cash_sale": True,
                    "payment_account_id": int(self._get_default_account_id()),
                    "payment_date": today,
                    "payment_description": f"iade iyzico #{payment_info.payment_id}",
                },
                "relationships": {
                    "contact": {"data": {"type": "contacts", "id": customer_id}},
                    "details": {"data": details_data},
                    "invoice": {"data": {"type": "sales_invoices", "id": original_invoice_id}},
                    **({
                        "category": {"data": {"type": "item_categories", "id": category_id}}
                    } if category_id else {}),
                },
            }
        }

        try:
            result = self._post("sales_invoices", body)
        except Exception as exc:
            return InvoiceResult(success=False, error=f"İade faturası oluşturulamadı: {exc}")

        credit_note_id = result["data"]["id"]
        attrs = result["data"]["attributes"]
        invoice_no = attrs.get("invoice_no", "")
        logger.info(
            "parasut: iade faturası oluşturuldu id=%s no=%s orijinal=%s",
            credit_note_id, invoice_no, original_invoice_id,
        )

        # e-belge olarak gönder
        try:
            pub_result = self.publish_invoice(credit_note_id)
            if pub_result.success:
                try:
                    pub_result.pdf_url = self.get_invoice_pdf_url(credit_note_id)
                except Exception as pdf_exc:
                    logger.warning("parasut: iade PDF URL alınamadı hata=%s", pdf_exc)
            return pub_result
        except Exception as pub_exc:
            logger.warning(
                "parasut: iade e-belge gönderilemedi (iade faturası taslak) id=%s hata=%s",
                credit_note_id, pub_exc,
            )
            return InvoiceResult(
                success=True,
                invoice_id=credit_note_id,
                invoice_number=invoice_no,
                issued_at=today,
                pdf_url=f"https://uygulama.parasut.com/{self._company_id}/sales_invoices/{credit_note_id}/print",
            )

