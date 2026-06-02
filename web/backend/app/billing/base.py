"""Abstract base class for all billing providers."""

from __future__ import annotations

from abc import ABC, abstractmethod

from .models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo


class BillingProviderBase(ABC):
    """Her provider bu arayüzü tam olarak uygulamalıdır."""

    @abstractmethod
    def find_or_create_customer(self, customer_info: CustomerInfo) -> str:
        """Müşteri/iletişim ID'sini döner; önce e-posta/TC ile arar, yoksa oluşturur."""

    @abstractmethod
    def create_invoice(
        self,
        customer_id: str,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        """Provider'da taslak satış faturası oluşturur."""

    @abstractmethod
    def publish_invoice(self, invoice_id: str) -> InvoiceResult:
        """Faturayı e-arşiv veya e-fatura olarak yayımlar."""

    @abstractmethod
    def get_invoice_pdf_url(self, invoice_id: str) -> str:
        """PDF hazır olana dek bekler ve indirme URL'sini döner."""

    @abstractmethod
    def cancel_invoice(self, invoice_id: str) -> bool:
        """Yayımlanmış faturayı iptal eder; başarıysa True döner."""

    def full_invoice_flow(
        self,
        customer_info: CustomerInfo,
        items: list[InvoiceItem],
        payment_info: PaymentInfo,
    ) -> InvoiceResult:
        """
        Tam akışı orkestre eder:
          find_or_create_customer → create_invoice → publish_invoice → get_invoice_pdf_url

        Herhangi bir adımda hata olursa InvoiceResult(success=False, error=...) döner.
        """
        try:
            customer_id = self.find_or_create_customer(customer_info)

            result = self.create_invoice(customer_id, items, payment_info)
            if not result.success:
                return result

            result = self.publish_invoice(result.invoice_id)  # type: ignore[arg-type]
            if not result.success:
                return result

            pdf_url = self.get_invoice_pdf_url(result.invoice_id)  # type: ignore[arg-type]
            result.pdf_url = pdf_url
            return result

        except Exception as exc:
            return InvoiceResult(success=False, error=str(exc))
