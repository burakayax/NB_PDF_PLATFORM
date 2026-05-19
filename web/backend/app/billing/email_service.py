"""Fatura PDF'ini müşteriye e-posta ile gönderir."""

from __future__ import annotations

import logging
import os
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests

from .models import CustomerInfo, InvoiceResult

logger = logging.getLogger(__name__)

_PARASUT_PRINT_HOST = "uygulama.parasut.com"
_MOCK_PDF_PREFIX = "https://mock-pdf-url"

# ---------------------------------------------------------------------------
# Şablon yardımcıları
# ---------------------------------------------------------------------------

def _logo_url() -> str:
    origin = os.getenv("FRONTEND_ORIGIN", "").rstrip("/")
    return f"{origin}/logo.png" if origin else ""


def _t(locale: str, tr_text: str, en_text: str) -> str:
    return tr_text if locale == "tr" else en_text


def _build_html_body(
    customer_info: CustomerInfo,
    invoice_result: InvoiceResult,
    locale: str = "tr",
) -> str:
    company = os.getenv("COMPANY_NAME", "PDF PLATFORM")
    logo_url = _logo_url()
    pdf_url = invoice_result.pdf_url or ""
    has_link = bool(pdf_url) and not pdf_url.startswith(_MOCK_PDF_PREFIX) and _PARASUT_PRINT_HOST not in pdf_url

    # Logo bloğu
    if logo_url:
        logo_block = (
            f'<img src="{logo_url}" width="38" height="38" alt="{company}" '
            f'style="display:block;border-radius:10px;border:1px solid rgba(139,92,246,0.35);" />'
        )
    else:
        logo_block = (
            f'<div style="width:38px;height:38px;border-radius:10px;border:1px dashed #8b5cf6;'
            f'background:rgba(139,92,246,0.12);display:inline-block;line-height:38px;text-align:center;'
            f'font-size:9px;font-weight:800;letter-spacing:0.1em;color:#a78bfa;">PDF</div>'
        )

    # CTA butonu
    if has_link:
        cta_label = _t(locale, "Faturayı Görüntüle", "View Invoice")
        cta_section = (
            f'<a href="{pdf_url}" target="_blank" '
            f'style="display:inline-block;padding:14px 30px;margin:16px 0 0;'
            f'background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);'
            f'color:#ffffff;text-decoration:none;border-radius:12px;'
            f'font-family:Arial;font-size:15px;font-weight:800;letter-spacing:0.02em;'
            f'border:1px solid rgba(167,139,250,0.3);">{cta_label}</a>'
        )
    else:
        cta_section = (
            f'<p style="margin:16px 0 0;font-family:Arial;font-size:14px;line-height:1.6;color:#94a3b8;">'
            + _t(locale, "Faturanız bu e-postaya PDF olarak eklenmiştir.", "Your invoice has been attached as a PDF to this email.")
            + "</p>"
        )

    # Belge türü
    doc_type_raw = (invoice_result.e_document_type or "invoice").replace("_", " ").title()
    if locale == "tr":
        doc_type = {"E Invoice": "E-Fatura", "E Archive": "E-Arşiv"}.get(doc_type_raw, doc_type_raw)
    else:
        doc_type = doc_type_raw

    # İçerik çevirileri
    greeting = _t(locale, f"Sayın {customer_info.name},", f"Dear {customer_info.name},")
    intro = _t(
        locale,
        "Ödemeniz onaylandı ve faturanız düzenlendi. Ayrıntılar aşağıdadır:",
        "Your payment has been confirmed and your invoice has been issued. Details are below:",
    )
    label_no = _t(locale, "Fatura No", "Invoice No")
    label_date = _t(locale, "Fatura Tarihi", "Invoice Date")
    label_type = _t(locale, "Belge Türü", "Document Type")
    contact = _t(locale, "Herhangi bir sorunuz olursa bizimle iletişime geçebilirsiniz.", "If you have any questions, feel free to contact us.")
    regards = _t(locale, f"Saygılarımızla,<br><strong>{company} Ekibi</strong>", f"Best regards,<br><strong>{company} Team</strong>")
    footer_note = _t(locale, "Bu e-posta otomatik olarak oluşturulmuştur. Lütfen yanıtlamayın.", "This email was generated automatically. Please do not reply.")
    eyebrow = _t(locale, "FATURA", "INVOICE")
    title_text = _t(locale, "Ödemeniz alındı", "Payment received")

    return f"""<!DOCTYPE html>
<html lang="{locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{company}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0f1e;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#0a0f1e;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0"
        style="max-width:620px;width:100%;background:#111827;border:1px solid #1e2d45;border-radius:20px;overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1040 0%,#0d1b35 50%,#0a1628 100%);
            padding:30px 36px 26px;border-bottom:1px solid #1e2d45;">

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td style="vertical-align:middle;padding-right:14px;">{logo_block}</td>
                <td style="vertical-align:middle;">
                  <div style="font-size:15px;font-weight:800;color:#e2e8f0;letter-spacing:0.04em;">{company}</div>
                  <div style="font-size:10px;font-weight:700;color:#8b5cf6;letter-spacing:0.18em;text-transform:uppercase;margin-top:3px;">{eyebrow}</div>
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;line-height:1.25;
              background:linear-gradient(135deg,#f8fafc 0%,#c4b5fd 100%);
              -webkit-background-clip:text;-webkit-text-fill-color:transparent;
              background-clip:text;color:#f8fafc;">{title_text}</h1>

          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:32px 36px;">

            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#e2e8f0;">{greeting}</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#94a3b8;">{intro}</p>

            <!-- Invoice detail box -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
              style="width:100%;border-collapse:collapse;border:1px solid #1e2d45;border-radius:16px;
                background:linear-gradient(135deg,#0f172a 0%,#0d1b35 100%);padding:20px 24px;">
              <tbody>
                <tr>
                  <td style="padding:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;
                    color:#6b7280;text-transform:uppercase;">{label_no}</td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px;font-size:17px;line-height:1.6;color:#f1f5f9;
                    border-bottom:1px solid #1e2d45;">{invoice_result.invoice_number or "-"}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;
                    color:#6b7280;text-transform:uppercase;">{label_date}</td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;
                    border-bottom:1px solid #1e2d45;">{invoice_result.issued_at or "-"}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;
                    color:#6b7280;text-transform:uppercase;">{label_type}</td>
                </tr>
                <tr>
                  <td style="padding:0;font-size:15px;line-height:1.6;color:#cbd5e1;">{doc_type}</td>
                </tr>
              </tbody>
            </table>

            {cta_section}

            <p style="margin:24px 0 6px;font-size:14px;line-height:1.6;color:#6b7280;">{contact}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#94a3b8;">{regards}</p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0d1117;border-top:1px solid #1e2d45;padding:18px 36px;">
            <div style="font-size:12px;font-weight:700;color:#374151;letter-spacing:0.05em;">NB GLOBAL STUDIO</div>
            <div style="margin-top:6px;font-size:12px;line-height:1.5;color:#1f2937;">{footer_note}</div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>"""


def _build_plain_body(
    customer_info: CustomerInfo,
    invoice_result: InvoiceResult,
    locale: str = "tr",
) -> str:
    company = os.getenv("COMPANY_NAME", "PDF PLATFORM")
    pdf_url = invoice_result.pdf_url or ""
    link_line = f"Link: {pdf_url}\n" if pdf_url and not pdf_url.startswith(_MOCK_PDF_PREFIX) else ""

    if locale == "tr":
        return (
            f"Sayin {customer_info.name},\n\n"
            f"Odemeniz onaylandi ve faturaniz duzenlendi.\n\n"
            f"Fatura No   : {invoice_result.invoice_number or '-'}\n"
            f"Tarih       : {invoice_result.issued_at or '-'}\n"
            f"Belge Turu  : {invoice_result.e_document_type or 'Fatura'}\n"
            f"{link_line}\n"
            f"Saygilarimizla,\n{company} Ekibi"
        )
    return (
        f"Dear {customer_info.name},\n\n"
        f"Your payment has been confirmed and your invoice has been issued.\n\n"
        f"Invoice No  : {invoice_result.invoice_number or '-'}\n"
        f"Date        : {invoice_result.issued_at or '-'}\n"
        f"Type        : {invoice_result.e_document_type or 'Invoice'}\n"
        f"{link_line}\n"
        f"Best regards,\n{company} Team"
    )


def _download_pdf(pdf_url: str) -> bytes:
    resp = requests.get(pdf_url, timeout=60)
    resp.raise_for_status()
    return resp.content


def _is_downloadable_pdf_url(url: str) -> bool:
    if not url:
        return False
    if url.startswith(_MOCK_PDF_PREFIX):
        return False
    if _PARASUT_PRINT_HOST in url:
        return False
    return True


def _send_via_smtp_no_attachment(
    to_email: str, subject: str, html_body: str, plain_body: str
) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    from_email = os.getenv("EMAIL_FROM", username)
    from_name = os.getenv("EMAIL_FROM_NAME", os.getenv("COMPANY_NAME", "PDF PLATFORM"))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        server.starttls()
        server.login(username, password)
        server.sendmail(from_email, [to_email], msg.as_string())

    logger.info("email: SMTP (eksiz) ile gonderildi -> %s", to_email)


def _send_via_smtp(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: str,
    pdf_bytes: bytes,
    filename: str,
) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    from_email = os.getenv("EMAIL_FROM", username)
    from_name = os.getenv("EMAIL_FROM_NAME", os.getenv("COMPANY_NAME", "PDF PLATFORM"))

    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText(plain_body, "plain", "utf-8"))
    alt.attach(MIMEText(html_body, "html", "utf-8"))

    outer = MIMEMultipart("mixed")
    outer["Subject"] = subject
    outer["From"] = f"{from_name} <{from_email}>"
    outer["To"] = to_email
    outer.attach(alt)

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    outer.attach(attachment)

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        server.starttls()
        server.login(username, password)
        server.sendmail(from_email, [to_email], outer.as_string())

    logger.info("email: SMTP ile gonderildi -> %s", to_email)


def _send_via_sendgrid(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: str,
    pdf_bytes: bytes,
    filename: str,
) -> None:
    import base64

    api_key = os.environ["SENDGRID_API_KEY"]
    from_email = os.environ["EMAIL_FROM"]
    from_name = os.getenv("EMAIL_FROM_NAME", os.getenv("COMPANY_NAME", "PDF PLATFORM"))

    payload: dict = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": from_name},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": plain_body},
            {"type": "text/html", "value": html_body},
        ],
    }
    if pdf_bytes:
        payload["attachments"] = [{
            "content": base64.b64encode(pdf_bytes).decode(),
            "type": "application/pdf",
            "filename": filename,
            "disposition": "attachment",
        }]

    resp = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    resp.raise_for_status()
    logger.info("email: SendGrid ile gonderildi -> %s", to_email)


def send_invoice_email(
    customer_info: CustomerInfo,
    invoice_result: InvoiceResult,
    locale: str = "tr",
) -> bool:
    """
    Fatura PDF'ini (veya linkini) müşteriye e-posta ile gönderir.
    EMAIL_BACKEND=smtp (varsayılan) veya sendgrid.
    Hata durumunda False döner, asla exception fırlatmaz.
    """
    if not invoice_result.success:
        logger.warning("email: basarisiz invoice_result, e-posta gonderilmedi")
        return False

    try:
        company = os.getenv("COMPANY_NAME", "PDF PLATFORM")
        invoice_number = invoice_result.invoice_number or "FATURA"
        if locale == "tr":
            subject = f"{company} — Fatura #{invoice_number}"
            filename = f"fatura_{invoice_number}.pdf"
        else:
            subject = f"{company} — Invoice #{invoice_number}"
            filename = f"invoice_{invoice_number}.pdf"

        html_body = _build_html_body(customer_info, invoice_result, locale)
        plain_body = _build_plain_body(customer_info, invoice_result, locale)
        backend = os.getenv("EMAIL_BACKEND", "smtp").strip().lower()

        pdf_url = invoice_result.pdf_url or ""
        if _is_downloadable_pdf_url(pdf_url):
            logger.info("email: PDF indiriliyor url=%s", pdf_url)
            pdf_bytes = _download_pdf(pdf_url)
        else:
            if pdf_url:
                logger.info("email: PDF eki yok (print/mock URL), link ile gonderiliyor url=%s", pdf_url)
            else:
                logger.info("email: PDF URL yok, eksiz gonderiliyor")
            pdf_bytes = b""

        if not pdf_bytes and backend == "smtp":
            _send_via_smtp_no_attachment(customer_info.email, subject, html_body, plain_body)
        elif backend == "sendgrid":
            _send_via_sendgrid(customer_info.email, subject, html_body, plain_body, pdf_bytes, filename)
        else:
            _send_via_smtp(customer_info.email, subject, html_body, plain_body, pdf_bytes, filename)

        return True

    except Exception:
        logger.exception("email: fatura e-postasi gonderilemedi musteri=%s", customer_info.email)
        return False
