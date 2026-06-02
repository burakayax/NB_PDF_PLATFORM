"""Shared data models for the billing layer."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CustomerInfo:
    name: str
    email: str
    phone: str | None = None
    tax_number: str | None = None     # Vergi kimlik no (10 hane, şirketler)
    national_id: str | None = None    # TC kimlik no (11 hane, bireyler)
    tax_office: str | None = None     # Vergi dairesi
    address: str | None = None
    city: str | None = None
    country: str = "Turkey"
    contact_type: str = "person"      # "person" | "company"
    country_code: str = "TR"          # ISO 3166-1 alpha-2
    is_export: bool = False           # Yabancı müşteri = True (ihracat istisnası)


@dataclass
class InvoiceItem:
    name: str
    quantity: float
    unit_price: float                 # KDV HARİÇ fiyat (iskonto sonrası)
    vat_rate: int                     # 0, 10 veya 20
    description: str | None = None
    unit: str = "Adet"
    is_export: bool = False
    discount_percent: int = 0         # İskonto yüzdesi — KDV Kanunu Md.25 uyumu
    original_unit_price: float | None = None  # İskonto öncesi KDV hariç birim fiyat


@dataclass
class PaymentInfo:
    payment_id: str                   # iyzico ödeme ID
    amount_paid: float                # KDV dahil toplam ödenen tutar
    currency: str = "TRY"
    payment_date: str = ""            # YYYY-MM-DD
    currency_rate: float = 1.0        # 1 birim döviz = X TRY (TCMB alış kuru)


@dataclass
class InvoiceResult:
    success: bool
    invoice_id: str | None = None
    invoice_number: str | None = None
    pdf_url: str | None = None
    e_document_type: str | None = None  # "e_archive" | "e_invoice"
    issued_at: str | None = None
    error: str | None = None
