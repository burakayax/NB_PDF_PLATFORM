"""BirFatura SendBasicInvoiceFromModel — gönderilen alanlar (developers.birfatura.com şemasına göre)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.billing.birfatura import BirFaturaProvider, _product_code, _split_payment_id
from app.billing.models import CustomerInfo, InvoiceItem, PaymentInfo


@pytest.fixture()
def provider(monkeypatch):
    monkeypatch.setenv("BIRFATURA_API_KEY", "k")
    monkeypatch.setenv("BIRFATURA_SECRET_KEY", "s")
    return BirFaturaProvider()


def _send(provider, payment_id: str):
    sent: dict = {}

    def fake_post(path, body):
        sent["path"], sent["body"] = path, body
        return {"Success": True, "Message": "ok", "Result": {"invoiceNo": "A1", "pdfLink": "x"}}

    ci = CustomerInfo(name="Ada Test", email="a@b.co", phone="+905550000000", national_id="10000000146",
                      address="Adres 1", city="Ankara", district="Çankaya")
    items = [InvoiceItem(name="PDF PLATFORM Pro (1 ay)", quantity=1, unit_price=332.5, vat_rate=20, unit="Ay")]
    pi = PaymentInfo(payment_id=payment_id, amount_paid=399.0, currency="TRY", payment_date="2026-10-27")
    with patch.object(provider, "_post", side_effect=fake_post):
        provider._build_and_send_invoice(ci, "earsiv:a@b.co", items, pi)
    return sent["body"]["invoice"]


def test_paytr_payment_fills_order_and_description(provider):
    inv = _send(provider, "paytr:3f2b8c1e9a474d6b8e210c5f7a9d1b34")
    assert inv["OrderCode"] == "3f2b8c1e9a474d6b8e210c5f7a9d1b34"
    assert inv["PaymentType"] == "Kredi Kartı"
    assert inv["BillingTown"] == "Çankaya"
    assert inv["BillingCity"] == "Ankara"
    assert "PayTR" in inv["InvoiceExplanation"]
    assert "PDF PLATFORM Pro (1 ay)" in inv["InvoiceExplanation"]
    line = inv["OrderDetails"][0]
    assert line["ProductCode"] == "PDF-PLATFORM-PRO-1-AY"
    assert line["ProductBrand"] == "PDF PLATFORM"
    assert "Sipariş No: 3f2b8c1e9a474d6b8e210c5f7a9d1b34" in line["ProductNote"]


def test_iyzico_payment_unchanged_order_code(provider):
    inv = _send(provider, "12345678")
    assert inv["OrderCode"] == "12345678"
    assert "iyzico" in inv["InvoiceExplanation"]


def test_helpers():
    assert _product_code("Ek AI Hizmet Bedeli (50 kredi)") == "EK-AI-HIZMET-BEDELI-50-KREDI"
    assert _product_code("") == "HIZMET"
    assert _split_payment_id("PAYTR:abc") == ("PayTR", "abc")
    assert _split_payment_id("") == ("iyzico", "")


def test_export_buyer_gets_taxno_placeholder(provider):
    sent: dict = {}

    def fake_post(path, body):
        sent["body"] = body
        return {"Success": True, "Message": "ok", "Result": {"invoiceNo": "A1", "pdfLink": "x"}}

    items = [InvoiceItem(name="PDF PLATFORM Pro (1 ay)", quantity=1, unit_price=9.99, vat_rate=0, unit="Ay", is_export=True)]
    pi = PaymentInfo(payment_id="paytr:abc", amount_paid=9.99, currency="USD", payment_date="2026-10-27", currency_rate=34.0)
    person = CustomerInfo(name="John Doe", email="j@d.com", address="1 Main St", city="Berlin", country="Germany",
                          country_code="DE", is_export=True)
    firm = CustomerInfo(name="Acme GmbH", email="a@d.com", address="1 Main St", city="Berlin", country="Germany",
                        country_code="DE", is_export=True, contact_type="company")
    with patch.object(provider, "_post", side_effect=fake_post):
        provider._build_and_send_invoice(person, "earsiv:j@d.com", items, pi)
        assert sent["body"]["invoice"]["TaxNo"] == "11111111111"
        provider._build_and_send_invoice(firm, "earsiv:a@d.com", items, pi)
        assert sent["body"]["invoice"]["TaxNo"] == "2222222222"
