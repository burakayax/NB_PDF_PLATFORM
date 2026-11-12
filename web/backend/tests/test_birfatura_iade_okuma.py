"""Gelen kutudaki iade faturasını tanıyan ayrıştırıcı (BirFatura)."""

import base64

from app.billing.birfatura import _iter_xml_strings, parse_return_invoice_xml

IADE = """<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
 <cbc:ID>ABC2026000000007</cbc:ID>
 <cbc:UUID>11111111-2222-3333-4444-555555555555</cbc:UUID>
 <cbc:IssueDate>2026-11-20</cbc:IssueDate>
 <cbc:InvoiceTypeCode>IADE</cbc:InvoiceTypeCode>
 <cac:BillingReference><cac:InvoiceDocumentReference>
   <cbc:ID>XYZ2026000000001</cbc:ID><cbc:UUID>aaaaaaaa-0000-0000-0000-000000000001</cbc:UUID>
 </cac:InvoiceDocumentReference></cac:BillingReference>
 <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">66.50</cbc:TaxAmount>
   <cac:TaxSubtotal><cbc:TaxAmount>1.00</cbc:TaxAmount></cac:TaxSubtotal></cac:TaxTotal>
</Invoice>"""


def test_iade_faturasi_taninir():
    r = parse_return_invoice_xml(IADE)
    assert r is not None
    assert r["invoice_no"] == "ABC2026000000007"
    assert r["original_invoice_no"] == "XYZ2026000000001"
    assert r["original_invoice_uuid"] == "aaaaaaaa-0000-0000-0000-000000000001"
    assert r["kdv_amount"] == "66.50"


def test_satis_faturasi_iade_sayilmaz():
    assert parse_return_invoice_xml(IADE.replace("IADE", "SATIS")) is None
    assert parse_return_invoice_xml("<html/>") is None


def test_base64_icindeki_xml_bulunur():
    enc = base64.b64encode(IADE.encode()).decode()
    found = list(_iter_xml_strings({"Result": {"objects": [{"jsonData": enc}]}}))
    assert len(found) == 1 and parse_return_invoice_xml(found[0]) is not None
