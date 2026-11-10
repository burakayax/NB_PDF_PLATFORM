"""Yurt dışı satış: İSTİSNA (hizmet ihracatı) faturası — SendDocument + UBL-TR XML."""
import base64
import io
import zipfile
from unittest.mock import patch
from xml.etree import ElementTree as ET

import pytest

from app.billing.models import CustomerInfo, InvoiceItem, PaymentInfo

from .test_birfatura_fields import provider  # noqa: F401  (aynı fixture)

NS = {"cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"}


def _cust(company=False):
    return CustomerInfo(name="Acme GmbH" if company else "John Doe", email="j@d.com", address="1 Main St",
                        city="Berlin", country="Germany", country_code="DE", is_export=True,
                        contact_type="company" if company else "person")


ITEMS = [InvoiceItem(name="PDF PLATFORM Pro (1 ay)", quantity=1, unit_price=10.0, vat_rate=0, unit="Ay", is_export=True)]
PI = PaymentInfo(payment_id="paytr:abc123", amount_paid=10.0, currency="USD", payment_date="2026-11-10", currency_rate=34.0)


def _xml_from_payload(payload):
    raw = base64.b64decode(payload["DocumentBytes"])
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        return ET.fromstring(zf.read("invoice.xml"))


def _run(provider, cust, monkeypatch, enabled=True):
    if enabled:
        monkeypatch.setenv("BIRFATURA_EXPORT_ISTISNA", "1")
    else:
        monkeypatch.setenv("BIRFATURA_EXPORT_ISTISNA", "0")
    sent = {}

    def fake_post(path, body):
        sent["path"], sent["body"] = path, body
        return {"Success": True, "Message": "ok", "Result": {"invoiceNo": "EA1", "pdfLink": "x"}}

    with patch.object(provider, "_post", side_effect=fake_post), \
            patch.object(provider, "publish_invoice", return_value=None):
        res = provider.full_invoice_flow(cust, ITEMS, PI)
    return res, sent


def test_istisna_xml_alanlari(provider, monkeypatch):
    res, sent = _run(provider, _cust(), monkeypatch)
    assert res.success and sent["path"] == "SendDocument"
    assert sent["body"]["SystemTypeCodes"] == "EARSIV"
    root = _xml_from_payload(sent["body"])
    t = lambda p: root.findtext(p, namespaces=NS)  # noqa: E731
    assert t("cbc:InvoiceTypeCode") == "ISTISNA"
    assert t("cbc:ProfileID") == "EARSIVFATURA"
    assert root.findtext(".//cac:TaxTotal/cbc:TaxAmount", namespaces=NS) == "0.00"
    assert root.findtext(".//cac:TaxCategory/cbc:TaxExemptionReasonCode", namespaces=NS) == "302"
    assert root.findtext(".//cac:TaxCategory/cbc:TaxExemptionReason", namespaces=NS) == "302-11/1-a Hizmet İhracatı"
    assert root.findtext(".//cac:TaxSubtotal/cbc:Percent", namespaces=NS) == "0"
    notes = [n.text for n in root.findall("cbc:Note", NS)]
    assert any("Vergi İstisna Muafiyet Sebebi: 302-11/1-a Hizmet İhracatı" in n for n in notes)
    assert any("KDVK 11/1-a kapsamında hizmet ihracatı" in n for n in notes)
    assert root.findtext(".//cac:InvoiceLine/cac:Item/cbc:Description", namespaces=NS) == "KDVK 11/1-a kapsamında hizmet ihracatı"
    assert root.findtext(".//cac:LegalMonetaryTotal/cbc:PayableAmount", namespaces=NS) == "10.00"


@pytest.mark.parametrize("company,scheme,value", [(False, "TCKN", "11111111111"), (True, "VKN", "2222222222")])
def test_yurt_disi_alici_yer_tutucu(provider, monkeypatch, company, scheme, value):
    _, sent = _run(provider, _cust(company), monkeypatch)
    root = _xml_from_payload(sent["body"])
    pid = root.find("cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID", NS)
    assert pid.get("schemeID") == scheme and pid.text == value


def test_bayrak_0_iken_eski_yol(provider, monkeypatch):
    with patch.object(provider, "find_or_create_customer", return_value="earsiv:j@d.com"):
        _, sent = _run(provider, _cust(), monkeypatch, enabled=False)
    assert sent["path"] == "SendBasicInvoiceFromModel"


def test_yurt_ici_musteri_etkilenmez(provider, monkeypatch):
    tr = CustomerInfo(name="Ada Test", email="a@b.co", national_id="10000000146", address="x", city="Ankara")
    monkeypatch.setenv("BIRFATURA_EXPORT_ISTISNA", "1")
    with patch.object(provider, "find_or_create_customer", return_value="earsiv:a@b.co"):
        _, sent = _run(provider, tr, monkeypatch)
    assert sent["path"] == "SendBasicInvoiceFromModel"


def test_bayrak_yazilmamissa_varsayilan_acik(provider, monkeypatch):
    monkeypatch.delenv("BIRFATURA_EXPORT_ISTISNA", raising=False)
    with patch.object(provider, "_post", return_value={"Success": True, "Message": "ok", "Result": {}}) as m,             patch.object(provider, "publish_invoice", return_value=None):
        provider.full_invoice_flow(_cust(), ITEMS, PI)
    assert m.call_args_list[0][0][0] == "SendDocument"
