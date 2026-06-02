"""
BirFatura provider testleri.

BirFatura'nın reverse-pull mimarisi simüle edilir:
  1. full_invoice_flow() siparişi kuyruğa ekler ve callback'i bekler.
  2. Testlerde ayrı thread'de BirFatura'nın /orders/ + /invoiceLinkUpdate/ çağrıları taklit edilir.
  3. FastAPI test client ile endpoint'ler doğrudan test edilir.
"""

from __future__ import annotations

import threading
import time
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.billing.birfatura as bf_module

# BirFatura artık reverse-pull router yerine doğrudan API çağrısı yapar
# (bkz. CLAUDE.md). Router tabanlı bu eski testler, gerekli semboller
# kaldırıldığı için artık geçerli değildir — modül atlanır.
pytest.importorskip("app.billing.birfatura")
try:
    from app.billing.birfatura import (
        BirFaturaProvider,
        birfatura_router,
        _store,
        _PendingOrder,
    )
except ImportError:
    pytest.skip(
        "BirFatura router mimarisi kaldırıldı; bu eski testler artık geçerli değil.",
        allow_module_level=True,
    )
from app.billing.models import CustomerInfo, InvoiceItem, InvoiceResult, PaymentInfo


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_store():
    """Her testten önce/sonra depoyu temizle."""
    yield
    with _store._lock:
        _store._orders.clear()


@pytest.fixture
def test_app():
    """birfatura_router kayıtlı minimal FastAPI uygulaması."""
    app = FastAPI()
    app.include_router(birfatura_router)
    return app


@pytest.fixture
def client(test_app):
    return TestClient(test_app)


@pytest.fixture
def provider():
    p = BirFaturaProvider()
    p._timeout = 5.0   # testlerde kısa timeout
    p._interval = 0.5
    return p


@pytest.fixture
def customer():
    return CustomerInfo(
        name="Ahmet Yılmaz",
        email="ahmet@example.com",
        phone="+905551234567",
        national_id="12345678901",
        address="Test Cad. No:1",
        city="İstanbul",
    )


@pytest.fixture
def items():
    return [
        InvoiceItem(name="Pro Plan", quantity=1, unit_price=83.33, vat_rate=20),
    ]


@pytest.fixture
def payment():
    return PaymentInfo(
        payment_id="PAY-BF-001",
        amount_paid=100.00,
        currency="TRL",
        payment_date="2026-05-13",
    )


# ---------------------------------------------------------------------------
# FastAPI endpoint testleri
# ---------------------------------------------------------------------------

def test_order_status_no_token(client):
    resp = client.post("/orderStatus/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert all("Id" in item and "Value" in item for item in data)


def test_payment_methods_no_token(client):
    resp = client.post("/paymentMethods/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_orders_empty_store(client):
    resp = client.post("/orders/", json={})
    assert resp.status_code == 200
    assert resp.json() == []


def test_orders_with_pending_order(client, customer, items, payment):
    order_id = str(uuid.uuid4())
    po = _PendingOrder(order_id, customer, items, payment)
    _store.add(po)

    resp = client.post("/orders/", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    order = data[0]
    assert order["OrderId"] == order_id
    assert order["BillingName"] == customer.name
    assert order["Email"] == customer.email
    assert len(order["OrderDetails"]) == 1
    assert order["OrderDetails"][0]["ProductName"] == "Pro Plan"


def test_orders_marks_fetched(client, customer, items, payment):
    order_id = str(uuid.uuid4())
    po = _PendingOrder(order_id, customer, items, payment)
    _store.add(po)

    client.post("/orders/", json={})
    assert po.fetched is True

    # İkinci çağrıda aynı sipariş gelmemeli
    resp2 = client.post("/orders/", json={})
    assert resp2.json() == []


def test_invoice_link_update_valid(client, customer, items, payment):
    order_id = str(uuid.uuid4())
    po = _PendingOrder(order_id, customer, items, payment)
    _store.add(po)

    resp = client.post("/invoiceLinkUpdate/", json={
        "orderId": order_id,
        "faturaUrl": "https://cdn.birfatura.com/invoice.pdf",
        "faturaNo": "E-ARŞ-2026-001",
        "faturaTarihi": "2026-05-13",
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert po.invoice_result is not None
    assert po.invoice_result.pdf_url == "https://cdn.birfatura.com/invoice.pdf"
    assert po.invoice_result.invoice_number == "E-ARŞ-2026-001"


def test_invoice_link_update_unknown_order(client):
    resp = client.post("/invoiceLinkUpdate/", json={
        "orderId": "nonexistent-id",
        "faturaUrl": "https://example.com/inv.pdf",
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is False


def test_cargo_update(client):
    resp = client.post("/orderCargoUpdate/", json={
        "orderId": 123,
        "orderStatusId": 2,
        "cargoTrackingCode": "KARGO123",
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_token_validation_rejects_wrong_token(monkeypatch, test_app):
    monkeypatch.setenv("BIRFATURA_API_TOKEN", "correct-token")
    c = TestClient(test_app)

    resp = c.post("/orderStatus/", headers={"token": "wrong-token"})
    assert resp.status_code == 401


def test_token_validation_accepts_correct_token(monkeypatch, test_app):
    monkeypatch.setenv("BIRFATURA_API_TOKEN", "my-secret-token")
    c = TestClient(test_app)

    resp = c.post("/orderStatus/", headers={"token": "my-secret-token"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Provider entegrasyon testleri (callback simülasyonu)
# ---------------------------------------------------------------------------

def _simulate_birfatura_callback(order_id: str, delay: float = 0.5) -> None:
    """Gerçek BirFatura'nın invoiceLinkUpdate callback'ini taklit eder."""
    time.sleep(delay)
    po = _store.get(order_id)
    if po:
        result = InvoiceResult(
            success=True,
            invoice_id=order_id,
            invoice_number="E-ARŞ-2026-TEST",
            pdf_url=f"https://cdn.birfatura.com/invoice-{order_id}.pdf",
            e_document_type="e_archive",
            issued_at="2026-05-13",
        )
        po.notify_invoice_ready(result)


def test_full_flow_with_callback(provider, customer, items, payment):
    """Callback zamanında gelirse full_invoice_flow başarılı sonuç döner."""
    result_holder: list[InvoiceResult] = []

    def run_flow():
        r = provider.full_invoice_flow(customer, items, payment)
        result_holder.append(r)

    # Akışı thread'de çalıştır
    t = threading.Thread(target=run_flow)
    t.start()

    # Kuyruğa eklenene dek bekle
    deadline = time.time() + 3.0
    order_id = None
    while time.time() < deadline:
        with _store._lock:
            if _store._orders:
                order_id = next(iter(_store._orders))
                break
        time.sleep(0.05)

    assert order_id is not None, "Sipariş kuyruğa eklenmedi"

    # BirFatura callback'ini simüle et
    _simulate_birfatura_callback(order_id, delay=0.2)

    t.join(timeout=5)
    assert not t.is_alive(), "full_invoice_flow zaman aşımına uğradı"

    assert len(result_holder) == 1
    result = result_holder[0]
    assert result.success is True
    assert result.pdf_url is not None
    assert result.invoice_number == "E-ARŞ-2026-TEST"


def test_full_flow_timeout(provider, customer, items, payment):
    """Callback gelmezse timeout hatasıyla döner."""
    provider._timeout = 0.3  # çok kısa timeout

    result = provider.full_invoice_flow(customer, items, payment)

    assert result.success is False
    assert result.error is not None
    assert "callback" in result.error.lower() or "timeout" in result.error.lower() or "gelmedi" in result.error


def test_cancel_invoice_removes_from_store(provider, customer, items, payment):
    order_id = str(uuid.uuid4())
    po = _PendingOrder(order_id, customer, items, payment)
    _store.add(po)

    ok = provider.cancel_invoice(order_id)
    assert ok is True
    assert _store.get(order_id) is None


def test_company_customer_includes_tax_fields(client):
    company = CustomerInfo(
        name="Test A.Ş.",
        email="fatura@test.com",
        tax_number="1234567890",
        tax_office="Kadıköy",
        contact_type="company",
    )
    items = [InvoiceItem(name="Hizmet", quantity=1, unit_price=100.0, vat_rate=20)]
    payment = PaymentInfo(payment_id="P1", amount_paid=120.0, payment_date="2026-05-13")

    order_id = str(uuid.uuid4())
    po = _PendingOrder(order_id, company, items, payment)
    _store.add(po)

    resp = client.post("/orders/", json={})
    data = resp.json()
    assert len(data) == 1
    order = data[0]
    assert order.get("TaxNo") == "1234567890"
    assert order.get("TaxOffice") == "Kadıköy"


def test_multiple_items_in_order(client, customer, payment):
    items = [
        InvoiceItem(name="Pro Plan", quantity=1, unit_price=83.33, vat_rate=20),
        InvoiceItem(name="Ek Depolama", quantity=2, unit_price=10.0, vat_rate=20),
    ]
    order_id = str(uuid.uuid4())
    po = _PendingOrder(order_id, customer, items, payment)
    _store.add(po)

    resp = client.post("/orders/", json={})
    data = resp.json()
    assert len(data[0]["OrderDetails"]) == 2
