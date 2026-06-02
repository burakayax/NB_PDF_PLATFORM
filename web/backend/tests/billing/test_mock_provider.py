"""Mock provider tam akış testleri."""

from __future__ import annotations

import pytest

from app.billing.mock import MockProvider
from app.billing.models import CustomerInfo, InvoiceItem, PaymentInfo


@pytest.fixture
def provider() -> MockProvider:
    return MockProvider()


@pytest.fixture
def customer() -> CustomerInfo:
    return CustomerInfo(
        name="Ahmet Yılmaz",
        email="ahmet@example.com",
        phone="+905551234567",
        national_id="12345678901",
        address="Atatürk Cad. No:1",
        city="İstanbul",
    )


@pytest.fixture
def items() -> list[InvoiceItem]:
    return [
        InvoiceItem(name="Pro Plan Aboneliği", quantity=1, unit_price=83.33, vat_rate=20),
    ]


@pytest.fixture
def payment() -> PaymentInfo:
    return PaymentInfo(
        payment_id="PAY-001",
        amount_paid=100.00,
        currency="TRL",
        payment_date="2026-05-13",
    )


def test_find_or_create_customer_returns_string(provider, customer):
    cid = provider.find_or_create_customer(customer)
    assert isinstance(cid, str)
    assert len(cid) > 0


def test_create_invoice_success(provider, customer, items, payment):
    cid = provider.find_or_create_customer(customer)
    result = provider.create_invoice(cid, items, payment)

    assert result.success is True
    assert result.invoice_id is not None
    assert result.invoice_number is not None


def test_publish_invoice_success(provider, customer, items, payment):
    cid = provider.find_or_create_customer(customer)
    create_result = provider.create_invoice(cid, items, payment)
    publish_result = provider.publish_invoice(create_result.invoice_id)

    assert publish_result.success is True
    assert publish_result.e_document_type == "e_archive"


def test_get_invoice_pdf_url(provider, customer, items, payment):
    cid = provider.find_or_create_customer(customer)
    create_result = provider.create_invoice(cid, items, payment)
    url = provider.get_invoice_pdf_url(create_result.invoice_id)

    assert url.startswith("https://")
    assert create_result.invoice_id in url


def test_cancel_invoice(provider, customer, items, payment):
    cid = provider.find_or_create_customer(customer)
    create_result = provider.create_invoice(cid, items, payment)
    ok = provider.cancel_invoice(create_result.invoice_id)
    assert ok is True


def test_full_invoice_flow(provider, customer, items, payment):
    result = provider.full_invoice_flow(customer, items, payment)

    assert result.success is True
    assert result.invoice_id is not None
    assert result.invoice_number is not None
    assert result.pdf_url is not None
    assert result.pdf_url.startswith("https://")
    assert result.error is None


def test_full_invoice_flow_multiple_items(provider, customer, payment):
    items = [
        InvoiceItem(name="Pro Plan", quantity=1, unit_price=83.33, vat_rate=20),
        InvoiceItem(name="Ek Depolama", quantity=2, unit_price=10.00, vat_rate=20),
    ]
    result = provider.full_invoice_flow(customer, items, payment)
    assert result.success is True


def test_full_invoice_flow_company_customer(provider, items, payment):
    company_customer = CustomerInfo(
        name="Örnek A.Ş.",
        email="fatura@ornek.com",
        tax_number="1234567890",
        tax_office="Kadıköy",
        contact_type="company",
    )
    result = provider.full_invoice_flow(company_customer, items, payment)
    assert result.success is True
