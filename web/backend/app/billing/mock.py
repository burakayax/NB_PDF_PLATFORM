"""Mock billing provider - gercek API cagrisi yapmaz, test/gelistirme icin."""

from __future__ import annotations

import logging
import uuid
from datetime import date

from .base import BillingProviderBase
from .models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo

logger = logging.getLogger(__name__)


class MockProvider(BillingProviderBase):
    """Tum islemleri loglar ve sahte veriler doner; Parasut hesabi gerekmez."""

    def find_or_create_customer(self, customer_info: CustomerInfo) -> str:
        customer_id = str(uuid.uuid4())
        logger.info("[MOCK] Creating customer: %s (%s) -> id=%s", customer_info.name, customer_info.email, customer_id)
        return customer_id

    def create_invoice(
        self,
        customer_id: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        invoice_id = str(uuid.uuid4())
        invoice_number = f"MOCK-{date.today().strftime('%Y%m%d')}-{invoice_id[:6].upper()}"
        logger.info("[MOCK] Creating invoice for customer_id=%s -> invoice_id=%s", customer_id, invoice_id)
        for item in items:
            logger.debug("[MOCK]   item: %s qty=%s price=%s vat=%s%%", item.name, item.quantity, item.unit_price, item.vat_rate)
        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            issued_at=payment_info.payment_date or date.today().isoformat(),
        )

    def publish_invoice(self, invoice_id: str) -> InvoiceResult:
        logger.info("[MOCK] Publishing invoice: %s", invoice_id)
        invoice_number = f"MOCK-PUB-{invoice_id[:6].upper()}"
        return InvoiceResult(
            success=True,
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            e_document_type="e_archive",
            issued_at=date.today().isoformat(),
        )

    def get_invoice_pdf_url(self, invoice_id: str) -> str:
        url = f"https://mock-pdf-url/invoice-{invoice_id}.pdf"
        logger.info("[MOCK] Invoice PDF URL: %s", url)
        return url

    def cancel_invoice(self, invoice_id: str) -> bool:
        logger.info("[MOCK] Cancelling invoice: %s", invoice_id)
        return True

    def full_invoice_flow(
        self,
        customer_info: CustomerInfo,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        logger.info("[MOCK] Starting full invoice flow for %s (%s)", customer_info.name, customer_info.email)
        result = super().full_invoice_flow(customer_info, items, payment_info)
        logger.info(
            "[MOCK] Full flow complete - invoice_id=%s number=%s pdf=%s",
            result.invoice_id,
            result.invoice_number,
            result.pdf_url,
        )
        return result
