"""E-posta servisi testleri — gerçek SMTP/SendGrid çağrısı yapılmaz."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from app.billing.email_service import (
    _build_html_body,
    _build_plain_body,
    send_invoice_email,
)
from app.billing.models import CustomerInfo, InvoiceResult


@pytest.fixture
def customer() -> CustomerInfo:
    return CustomerInfo(
        name="Ahmet Yılmaz",
        email="ahmet@example.com",
        phone="+905551234567",
    )


@pytest.fixture
def good_result() -> InvoiceResult:
    return InvoiceResult(
        success=True,
        invoice_id="inv-001",
        invoice_number="E-ARŞ-2026-001",
        pdf_url="https://example.com/invoice.pdf",
        e_document_type="e_archive",
        issued_at="2026-05-13",
    )


@pytest.fixture
def failed_result() -> InvoiceResult:
    return InvoiceResult(success=False, error="provider_error")


# ---- Gövde oluşturma ----

def test_html_body_contains_customer_name(customer, good_result):
    html = _build_html_body(customer, good_result)
    assert customer.name in html


def test_html_body_contains_invoice_number(customer, good_result):
    html = _build_html_body(customer, good_result)
    assert good_result.invoice_number in html


def test_plain_body_contains_invoice_number(customer, good_result):
    plain = _build_plain_body(customer, good_result)
    assert good_result.invoice_number in plain


def test_html_body_contains_date(customer, good_result):
    html = _build_html_body(customer, good_result)
    assert "2026-05-13" in html


def test_html_body_contains_company_name(monkeypatch, customer, good_result):
    monkeypatch.setenv("COMPANY_NAME", "TestŞirket")
    html = _build_html_body(customer, good_result)
    assert "TestŞirket" in html


# ---- send_invoice_email — başarısız sonuç ----

def test_send_returns_false_on_failed_result(customer, failed_result):
    result = send_invoice_email(customer, failed_result)
    assert result is False


def test_send_returns_false_when_no_pdf_url(customer):
    result_no_url = InvoiceResult(success=True, invoice_id="x", invoice_number="N", pdf_url=None)
    assert send_invoice_email(customer, result_no_url) is False


# ---- send_invoice_email — SMTP backend ----

def test_send_via_smtp_success(monkeypatch, customer, good_result):
    monkeypatch.setenv("EMAIL_BACKEND", "smtp")
    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "test@gmail.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("EMAIL_FROM", "test@gmail.com")

    fake_pdf = b"%PDF-1.4 fake"

    with (
        patch("app.billing.email_service._download_pdf", return_value=fake_pdf),
        patch("app.billing.email_service._send_via_smtp") as mock_smtp,
    ):
        result = send_invoice_email(customer, good_result)

    assert result is True
    mock_smtp.assert_called_once()
    _, kwargs_or_args = mock_smtp.call_args[0], mock_smtp.call_args
    # Alıcı e-postanın doğru iletildiğini kontrol et
    call_args = mock_smtp.call_args[0]
    assert call_args[0] == customer.email


# ---- send_invoice_email — SendGrid backend ----

def test_send_via_sendgrid_success(monkeypatch, customer, good_result):
    monkeypatch.setenv("EMAIL_BACKEND", "sendgrid")
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.fake")
    monkeypatch.setenv("EMAIL_FROM", "billing@app.com")

    fake_pdf = b"%PDF-1.4 fake"

    with (
        patch("app.billing.email_service._download_pdf", return_value=fake_pdf),
        patch("app.billing.email_service._send_via_sendgrid") as mock_sg,
    ):
        result = send_invoice_email(customer, good_result)

    assert result is True
    mock_sg.assert_called_once()


# ---- PDF indirme hatası ----

def test_pdf_download_error_returns_false(monkeypatch, customer, good_result):
    monkeypatch.setenv("EMAIL_BACKEND", "smtp")
    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "test@gmail.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")

    with patch("app.billing.email_service._download_pdf", side_effect=ConnectionError("timeout")):
        result = send_invoice_email(customer, good_result)

    assert result is False


# ---- SMTP gönderim hatası ----

def test_smtp_send_error_returns_false(monkeypatch, customer, good_result):
    monkeypatch.setenv("EMAIL_BACKEND", "smtp")
    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "test@gmail.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")

    with (
        patch("app.billing.email_service._download_pdf", return_value=b"fake"),
        patch("app.billing.email_service._send_via_smtp", side_effect=Exception("auth_fail")),
    ):
        result = send_invoice_email(customer, good_result)

    assert result is False
