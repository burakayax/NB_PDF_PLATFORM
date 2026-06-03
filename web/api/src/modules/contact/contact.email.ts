import { escapeHtml } from "../../lib/email-html.js";

type ContactEmailTemplateInput = {
  name: string;
  email: string;
  message: string;
};

/**
 * İletişim formu e-postası: konu ve düz metin gövdesi ürün gereksinimlerine göre sabit şablondur.
 * HTML sürümü aynı içeriği güvenli kaçışla sunar.
 */
export function createContactEmailTemplate({ name, email, message }: ContactEmailTemplateInput) {
  const subject = `Yeni İletişim Mesajı - ${name}`;

  const text = [
    `Ad: ${name}`,
    `Email: ${email}`,
    `Tarih: ${new Date().toLocaleString('tr-TR')}`,
    "",
    "Mesaj:",
    message,
  ].join("\n");

  const escapedName = escapeHtml(name);
  const escapedEmail = escapeHtml(email);
  const escapedMessage = escapeHtml(message);

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #e2e8f0;">
  <div style="max-width: 600px; margin: 40px auto; background: #e8eef7; border-radius: 8px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">✉️ Yeni İletişim Mesajı</h1>
    </div>
    <div style="padding: 32px 24px; background: white;">
      <div style="margin-bottom: 24px;">
        <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px;">Gönderen Adı</span>
        <div style="font-size: 15px; color: #0f172a; line-height: 1.6;">${escapedName}</div>
      </div>
      <div style="margin-bottom: 24px;">
        <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px;">E-posta Adresi</span>
        <div style="font-size: 15px; color: #0f172a; line-height: 1.6;"><a href="mailto:${escapedEmail}" style="color: #3b82f6; text-decoration: none;">${escapedEmail}</a></div>
      </div>
      <div style="margin-bottom: 24px;">
        <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px;">Gönderim Tarihi</span>
        <div style="font-size: 15px; color: #0f172a; line-height: 1.6;">${new Date().toLocaleString('tr-TR')}</div>
      </div>
      <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 4px; margin-top: 24px;">
        <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 12px;">Mesaj İçeriği</span>
        <pre style="white-space: pre-wrap; word-break: break-word; font-size: 14px; color: #0f172a; line-height: 1.6; margin: 0; font-family: inherit;">${escapedMessage}</pre>
      </div>
    </div>
    <div style="background: #e8eef7; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #d1d5db;">
      <p style="margin: 0;">Bu mesaj PDF PLATFORM iletişim formu aracılığıyla gönderilmiştir.</p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    html,
    text,
  };
}
