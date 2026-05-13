"""iyzico webhook handler testleri."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from app.billing.webhook_handler import handle_iyzico_webhook

# Mock provider'ı zorla — gerçek API çağrısı yapılmasın
os.environ.setdefault("BILLING_PROVIDER", "mock")


def _make_payload(**overrides) -> dict:
    base = {
        "paymentId": "12345678",
        "status": "SUCCESS",
        "price": "100.00",
        "paidPrice": "100.00",
        "currency": "TRL",
        "buyer": {
            "name": "Ahmet",
            "surname": "Yılmaz",
            "email": "ahmet@example.com",
            "gsmNumber": "+905551234567",
            "identityNumber": "12345678901",
            "registrationAddress": "Atatürk Cad. No:1",
            "city": "İstanbul",
        },
        "basketItems": [
            {"name": "Pro Plan", "price": "100.00", "itemType": "VIRTUAL"},
        ],
    }
    base.update(overrides)
    return base


# ---- Başarılı ödeme ----

_SEND_EMAIL = "app.billing.webhook_handler.send_invoice_email"


def test_successful_payment_returns_success():
    with patch(_SEND_EMAIL, return_value=True):
        result = handle_iyzico_webhook(_make_payload(), {})

    assert result["success"] is True
    assert "invoice_id" in result
    assert result["invoice_id"] is not None
    assert "pdf_url" in result


def test_successful_payment_email_sent_flag():
    with patch(_SEND_EMAIL, return_value=True):
        result = handle_iyzico_webhook(_make_payload(), {})
    assert result.get("email_sent") is True


def test_successful_payment_email_fail_still_returns_success():
    with patch(_SEND_EMAIL, return_value=False):
        result = handle_iyzico_webhook(_make_payload(), {})
    assert result["success"] is True
    assert result.get("email_sent") is False


# ---- Başarısız ödeme ----

def test_failed_payment_returns_error():
    payload = _make_payload(status="FAILURE")
    result = handle_iyzico_webhook(payload, {})
    assert result["success"] is False
    assert "payment_not_successful" in result["error"]


def test_pending_payment_returns_error():
    payload = _make_payload(status="PENDING")
    result = handle_iyzico_webhook(payload, {})
    assert result["success"] is False


# ---- Eksik alanlar ----

def test_missing_payment_id_returns_error():
    payload = _make_payload()
    del payload["paymentId"]
    result = handle_iyzico_webhook(payload, {})
    assert result["success"] is False
    assert "missing_fields" in result["error"]


def test_missing_status_returns_error():
    payload = _make_payload()
    del payload["status"]
    result = handle_iyzico_webhook(payload, {})
    assert result["success"] is False


def test_missing_buyer_email_returns_error():
    payload = _make_payload()
    payload["buyer"].pop("email", None)
    result = handle_iyzico_webhook(payload, {})
    assert result["success"] is False
    assert result["error"] == "missing_buyer_email"


# ---- Boş sepet ----

def test_empty_basket_uses_single_line_item():
    payload = _make_payload(basketItems=[])
    with patch(_SEND_EMAIL, return_value=True):
        result = handle_iyzico_webhook(payload, {})
    assert result["success"] is True


# ---- Çoklu sepet kalemi ----

def test_multiple_basket_items():
    payload = _make_payload(
        basketItems=[
            {"name": "Pro Plan", "price": "83.33", "itemType": "VIRTUAL"},
            {"name": "Ek Depolama", "price": "16.67", "itemType": "VIRTUAL"},
        ]
    )
    with patch(_SEND_EMAIL, return_value=True):
        result = handle_iyzico_webhook(payload, {})
    assert result["success"] is True


# ---- Provider hatası ----

def test_provider_error_returns_false():
    mock_provider = MagicMock()
    from app.billing.models import InvoiceResult
    mock_provider.full_invoice_flow.return_value = InvoiceResult(
        success=False, error="provider_error"
    )
    with (
        patch("app.billing.webhook_handler.get_provider", return_value=mock_provider),
        patch("app.billing.email_service.send_invoice_email", return_value=False),
    ):
        result = handle_iyzico_webhook(_make_payload(), {})
    assert result["success"] is False
    assert "provider_error" in result["error"]


# ---- Beklenmedik exception ----

def test_unexpected_exception_never_raises():
    with patch("app.billing.webhook_handler._process", side_effect=RuntimeError("boom")):
        result = handle_iyzico_webhook({}, {})
    assert result["success"] is False
    assert result["error"] == "internal_error"
