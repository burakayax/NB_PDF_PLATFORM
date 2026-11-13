"""Fatura PDF'ini müşteriye e-posta ile gönderir."""

from __future__ import annotations

import html as html_lib
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

# Fatura e-postalarında marka sabittir: ortam değişkenindeki (COMPANY_NAME / EMAIL_FROM_NAME) "NB Global Studio"
# müşteriye gösterilmez. Konu ve gönderen adı: "PDF PLATFORM Fatura Departmanı".
_BRAND = "PDF PLATFORM"


def _dept(locale: str = "tr") -> str:
    return f"{_BRAND} Fatura Departmanı" if locale == "tr" else f"{_BRAND} Billing Department"


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
    """Fatura e-postası — site/hesap e-postalarıyla aynı açık, kurumsal tasarım (tablo + satır içi CSS)."""
    esc = html_lib.escape
    company = esc(_BRAND)
    origin = os.getenv("FRONTEND_ORIGIN", "").rstrip("/") or "https://www.pdfplatform.app"
    support = esc(os.getenv("SUPPORT_EMAIL", "info@pdfplatform.app"))
    pdf_url = invoice_result.pdf_url or ""
    has_link = bool(pdf_url) and not pdf_url.startswith(_MOCK_PDF_PREFIX) and _PARASUT_PRINT_HOST not in pdf_url

    ink, body_c, muted, faint = "#0f172a", "#334155", "#64748b", "#94a3b8"
    line, page, soft = "#e2e8f0", "#f1f5f9", "#f8fafc"
    brand, brand_soft = "#4338ca", "#eef2ff"
    font = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

    # Belge türü
    doc_type_raw = (invoice_result.e_document_type or "invoice").replace("_", " ").title()
    if locale == "tr":
        doc_type = {"E Invoice": "E-Fatura", "E Archive": "E-Arşiv"}.get(doc_type_raw, doc_type_raw)
    else:
        doc_type = doc_type_raw

    greeting = _t(locale, f"Merhaba {esc(customer_info.name)},", f"Hello {esc(customer_info.name)},")
    eyebrow = _t(locale, "Fatura", "Invoice")
    title_text = _t(locale, "Faturanız hazır", "Your invoice is ready")
    intro = _t(
        locale,
        "Ödemeniz için düzenlenen faturanızın bilgileri aşağıdadır. Bu belgeyi muhasebe kayıtlarınız için saklayabilirsiniz.",
        "Here are the details of the invoice issued for your payment. Keep this document for your accounting records.",
    )
    label_no = _t(locale, "Fatura no", "Invoice no")
    label_date = _t(locale, "Fatura tarihi", "Invoice date")
    label_type = _t(locale, "Belge türü", "Document type")
    preheader = _t(
        locale,
        f"Faturanız düzenlendi — fatura no: {invoice_result.invoice_number or '-'}",
        f"Your invoice has been issued — invoice no: {invoice_result.invoice_number or '-'}",
    )
    help_text = _t(
        locale,
        f'Faturayla ilgili bir sorunuz varsa <a href="mailto:{support}" style="color:{brand};text-decoration:none;font-weight:600;">{support}</a> adresine yazabilirsiniz.',
        f'If you have any question about this invoice, write to <a href="mailto:{support}" style="color:{brand};text-decoration:none;font-weight:600;">{support}</a>.',
    )
    footer_note = _t(
        locale,
        "Bu e-posta otomatik olarak oluşturulmuştur; lütfen bu adrese yanıt yazmayın.",
        "This email was generated automatically; please do not reply to this address.",
    )

    # Eylem: bağlantı varsa düğme, yoksa ek bilgisi
    if has_link:
        cta_label = _t(locale, "Faturayı görüntüle", "View invoice")
        action = (
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">'
            f'<tr><td align="center" bgcolor="{brand}" style="background-color:{brand};border-radius:8px;">'
            f'<a href="{esc(pdf_url)}" target="_blank" style="display:inline-block;padding:14px 30px;'
            f'font-family:{font};font-size:15px;font-weight:700;line-height:1;color:#ffffff;'
            f'text-decoration:none;border-radius:8px;">{cta_label}</a></td></tr></table>'
        )
    else:
        action = (
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:22px 0 4px;">'
            f'<tr><td style="padding:14px 18px;background-color:{brand_soft};border-radius:10px;'
            f'font-family:{font};font-size:14px;line-height:1.6;color:{body_c};">'
            + _t(locale, "Faturanız bu e-postaya <strong>PDF olarak eklenmiştir</strong>.",
                 "Your invoice is <strong>attached to this email as a PDF</strong>.")
            + "</td></tr></table>"
        )

    rows = [
        (label_no, esc(invoice_result.invoice_number or "-")),
        (label_date, esc(invoice_result.issued_at or "-")),
        (label_type, esc(doc_type)),
    ]
    rows_html = ""
    for i, (lbl, val) in enumerate(rows):
        border = f"border-bottom:1px solid {line};" if i < len(rows) - 1 else ""
        rows_html += (
            f'<tr><td style="padding:12px 16px;width:38%;font-family:{font};font-size:12px;font-weight:700;'
            f'letter-spacing:0.06em;text-transform:uppercase;color:{muted};vertical-align:top;{border}">{lbl}</td>'
            f'<td style="padding:12px 16px;font-family:{font};font-size:15px;line-height:1.5;color:{ink};'
            f'vertical-align:top;{border}">{val}</td></tr>'
        )

    pre = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;'
        f'line-height:1px;color:#ffffff;">{esc(preheader)}{"&nbsp;&zwnj;" * 40}</div>'
    )

    return f"""<!DOCTYPE html>
<html lang="{locale}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>{company}</title>
</head>
<body style="margin:0;padding:0;background-color:{page};font-family:{font};-webkit-text-size-adjust:100%;">
{pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{page};border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;width:100%;background:#ffffff;border:1px solid {line};border-radius:12px;border-collapse:separate;overflow:hidden;">

        <tr><td style="height:4px;background-color:{brand};font-size:0;line-height:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:24px 36px 18px;border-bottom:1px solid {line};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;width:52px;">
                  <a href="{origin}" target="_blank" style="text-decoration:none;">
                    <img src="{origin}/emblem.png" width="40" height="40" alt="{company}" style="display:block;width:40px;height:40px;border:0;border-radius:9px;" />
                  </a>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-family:{font};font-size:16px;font-weight:700;color:{ink};letter-spacing:0.01em;">{company}</div>
                  <div style="font-family:{font};font-size:12px;color:{muted};margin-top:2px;">{esc(_dept(locale))}</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:5px 10px;border:1px solid {line};border-radius:999px;font-family:{font};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:{brand};">{eyebrow}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 36px 8px;">
            <h1 style="margin:0 0 12px;font-family:{font};font-size:26px;font-weight:700;line-height:1.25;color:{ink};">{title_text}</h1>
            <p style="margin:0 0 6px;font-family:{font};font-size:16px;line-height:1.65;color:{body_c};">{greeting}</p>
            <p style="margin:0;font-family:{font};font-size:16px;line-height:1.65;color:{muted};">{intro}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 36px 36px;font-family:{font};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
              style="width:100%;border-collapse:separate;border:1px solid {line};border-radius:10px;background:{soft};">
              <tbody>{rows_html}</tbody>
            </table>

            {action}

            <p style="margin:24px 0 0;font-family:{font};font-size:14px;line-height:1.7;color:{muted};">{help_text}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 36px 26px;border-top:1px solid {line};background-color:{soft};">
            <div style="font-family:{font};font-size:12px;font-weight:700;letter-spacing:0.06em;color:{body_c};">NB GLOBAL STUDIO</div>
            <div style="margin-top:6px;font-family:{font};font-size:11px;line-height:1.6;color:{faint};">{footer_note}</div>
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
    company = _BRAND
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
    from_name = _dept("tr")

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
    from_name = _dept("tr")

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
    from_name = _dept("tr")

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
        invoice_number = invoice_result.invoice_number or "FATURA"
        if locale == "tr":
            subject = f"{_dept('tr')} — Fatura #{invoice_number}"
            filename = f"fatura_{invoice_number}.pdf"
        else:
            subject = f"{_dept('en')} — Invoice #{invoice_number}"
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
