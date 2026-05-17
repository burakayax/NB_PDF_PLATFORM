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


def _build_html_body(customer_info: CustomerInfo, invoice_result: InvoiceResult) -> str:
    company = os.getenv("COMPANY_NAME", "Uygulama")
    pdf_url = invoice_result.pdf_url or ""
    has_link = bool(pdf_url) and not pdf_url.startswith("https://mock-pdf-url")
    pdf_section = (
        f'<p><a href="{pdf_url}" style="background:#1a73e8;color:white;padding:10px 20px;'
        f'text-decoration:none;border-radius:4px;display:inline-block;">Faturayı Görüntüle</a></p>'
        if has_link else
        "<p>Faturanız PDF olarak bu e-postaya eklenmiştir.</p>"
    )
    return f"""<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><style>
  body {{ font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }}
  .header {{ background: #1a73e8; color: white; padding: 24px; text-align: center; }}
  .content {{ padding: 24px; }}
  .invoice-box {{ background: #f8f9fa; border-left: 4px solid #1a73e8; padding: 16px; margin: 16px 0; }}
  .footer {{ color: #888; font-size: 12px; padding: 16px; text-align: center; border-top: 1px solid #eee; }}
</style></head>
<body>
  <div class="header">
    <h1>{company}</h1>
    <p>Fatura Bildirimi</p>
  </div>
  <div class="content">
    <p>Sayin {customer_info.name},</p>
    <p>Odemeniz alinmis ve faturaniz duzenlenmiştir. Ayrintilar asagidadir:</p>
    <div class="invoice-box">
      <strong>Fatura No:</strong> {invoice_result.invoice_number or '-'}<br>
      <strong>Fatura Tarihi:</strong> {invoice_result.issued_at or '-'}<br>
      <strong>Belge Turu:</strong> {(invoice_result.e_document_type or 'Fatura').replace('_', ' ').title()}<br>
    </div>
    {pdf_section}
    <p>Herhangi bir sorunuz olursa bizimle iletisime gecebilirsiniz.</p>
    <p>Saygilarimizla,<br><strong>{company} Ekibi</strong></p>
  </div>
  <div class="footer">
    Bu e-posta otomatik olarak olusturulmustur. Lutfen yanitlamayiniz.
  </div>
</body>
</html>"""


def _build_plain_body(customer_info: CustomerInfo, invoice_result: InvoiceResult) -> str:
    company = os.getenv("COMPANY_NAME", "Uygulama")
    pdf_url = invoice_result.pdf_url or ""
    link_line = f"Fatura Linki : {pdf_url}\n" if pdf_url and not pdf_url.startswith("https://mock-pdf-url") else ""
    return (
        f"Sayin {customer_info.name},\n\n"
        f"Odemeniz alinmis ve faturaniz duzenlenmiştir.\n\n"
        f"Fatura No   : {invoice_result.invoice_number or '-'}\n"
        f"Tarih       : {invoice_result.issued_at or '-'}\n"
        f"Belge Turu  : {invoice_result.e_document_type or 'Fatura'}\n"
        f"{link_line}\n"
        f"Saygilarimizla,\n{company} Ekibi"
    )


def _download_pdf(pdf_url: str) -> bytes:
    resp = requests.get(pdf_url, timeout=60)
    resp.raise_for_status()
    return resp.content


def _send_via_smtp_no_attachment(to_email: str, subject: str, html_body: str, plain_body: str) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]
    from_email = os.getenv("EMAIL_FROM", username)
    from_name = os.getenv("EMAIL_FROM_NAME", os.getenv("COMPANY_NAME", "Uygulama"))

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
    from_name = os.getenv("EMAIL_FROM_NAME", os.getenv("COMPANY_NAME", "Uygulama"))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    # MIMEMultipart("mixed") ile sarmala
    outer = MIMEMultipart("mixed")
    outer["Subject"] = subject
    outer["From"] = f"{from_name} <{from_email}>"
    outer["To"] = to_email
    outer.attach(msg)
    outer.attach(attachment)

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        server.starttls()
        server.login(username, password)
        server.sendmail(from_email, [to_email], outer.as_string())

    logger.info("email: SMTP ile gönderildi -> %s", to_email)


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
    from_name = os.getenv("EMAIL_FROM_NAME", os.getenv("COMPANY_NAME", "Uygulama"))

    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": from_name},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": plain_body},
            {"type": "text/html", "value": html_body},
        ],
        "attachments": [
            {
                "content": base64.b64encode(pdf_bytes).decode(),
                "type": "application/pdf",
                "filename": filename,
                "disposition": "attachment",
            }
        ],
    }

    resp = requests.post(
        "https://api.sendgrid.com/v3/mail/send",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    resp.raise_for_status()
    logger.info("email: SendGrid ile gönderildi -> %s", to_email)


_PARASUT_PRINT_HOST = "uygulama.parasut.com"
_MOCK_PDF_PREFIX = "https://mock-pdf-url"


def _is_downloadable_pdf_url(url: str) -> bool:
    """Gercek indirilebilir PDF URL'i mi yoksa bir web sayfasi mi?"""
    if not url:
        return False
    if url.startswith(_MOCK_PDF_PREFIX):
        return False
    # Parasut print ve portal/preview URL'leri HTML sayfa; PDF degil
    if _PARASUT_PRINT_HOST in url:
        return False
    return True


def send_invoice_email(customer_info: CustomerInfo, invoice_result: InvoiceResult) -> bool:
    """
    Fatura PDF'ini (veya fatura linkini) mussteriye e-posta ile gonderir.
    EMAIL_BACKEND=smtp (varsayilan) veya sendgrid.
    Hata durumunda False doner, hicbir zaman exception firlatmaz.
    """
    if not invoice_result.success:
        logger.warning("email: basarisiz invoice_result, e-posta gonderilmedi")
        return False

    try:
        company = os.getenv("COMPANY_NAME", "Uygulama")
        invoice_number = invoice_result.invoice_number or "FATURA"
        subject = f"{company} - Fatura #{invoice_number}"
        filename = f"fatura_{invoice_number}.pdf"

        html_body = _build_html_body(customer_info, invoice_result)
        plain_body = _build_plain_body(customer_info, invoice_result)
        backend = os.getenv("EMAIL_BACKEND", "smtp").strip().lower()

        pdf_url = invoice_result.pdf_url or ""
        if _is_downloadable_pdf_url(pdf_url):
            logger.info("email: PDF indiriliyor url=%s", pdf_url)
            pdf_bytes = _download_pdf(pdf_url)
        else:
            # e-Arsiv aktif degil veya mock — PDF eki olmadan gonder
            if pdf_url:
                logger.info("email: PDF eki yok (print/mock URL), e-posta link ile gonderiliyor url=%s", pdf_url)
            else:
                logger.info("email: PDF URL yok, e-posta eksiz gonderiliyor")
            pdf_bytes = b""

        if not pdf_bytes and backend == "smtp":
            # PDF eki olmayan SMTP gonderimi — attachment'siz yolla
            _send_via_smtp_no_attachment(customer_info.email, subject, html_body, plain_body)
        elif backend == "sendgrid":
            _send_via_sendgrid(customer_info.email, subject, html_body, plain_body, pdf_bytes, filename)
        else:
            _send_via_smtp(customer_info.email, subject, html_body, plain_body, pdf_bytes, filename)

        return True

    except Exception:
        logger.exception("email: fatura e-postasi gonderilemedi musteri=%s", customer_info.email)
        return False
