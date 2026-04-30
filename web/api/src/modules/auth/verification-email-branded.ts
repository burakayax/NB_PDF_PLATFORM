import { escapeHtmlAttr } from "../../lib/email-html.js";

/**
 * PLATFORM — SaaS verification email (icon placeholders included)
 */
export function renderBrandedVerificationEmailHtml(
  verificationUrl: string,
): string {
  const href = escapeHtmlAttr(verificationUrl);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>NB PDF PLATFORM</title>
</head>

<body style="margin:0;padding:0;width:100%;background-color:#f8fafc;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-collapse:collapse;background-color:#f8fafc;">

    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="padding:26px 32px;border-bottom:1px solid #e2e8f0;">

              <div style="display:flex;align-items:center;gap:10px;font-family:Arial;font-weight:700;color:#2563eb;font-size:18px;">

                <!-- BURAYA İKON (LOGO) -->
                <img src="/web/frontend/public/logo.png" width="24" height="24" style="display:inline-block;" />

                PLATFORM
              </div>

            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:34px 32px 10px 32px;">
              <h1 style="margin:0;font-family:Arial;font-size:20px;font-weight:700;color:#0f172a;">
                E-posta adresinizi doğrulayın
              </h1>

              <p style="margin:12px 0 0 0;font-family:Arial;font-size:15px;line-height:1.6;color:#334155;">
                PLATFORM hesabınızı aktifleştirmek için doğrulamayı tamamlamanız gerekiyor.
              </p>

              <p style="margin:10px 0 0 0;font-family:Arial;font-size:13px;color:#64748b;">
                Bu bağlantı güvenlik nedeniyle sınırlı süre geçerlidir.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:24px 32px 10px 32px;">

              <a href="${href}" target="_blank"
                style="display:inline-flex;align-items:center;gap:8px;background-color:#2563eb;color:#fff;text-decoration:none;
                padding:14px 26px;border-radius:8px;font-family:Arial;font-size:15px;font-weight:700;">

                <!-- BURAYA İKON (BUTON ICON) -->
                <img src="BURAYA_BUTTON_ICON_URL" width="16" height="16" />

                E-posta adresimi doğrula
              </a>

            </td>
          </tr>

          <!-- FALLBACK -->
          <tr>
            <td style="padding:10px 32px 24px 32px;">
              <p style="margin:0;font-family:Arial;font-size:12px;color:#64748b;">
                Buton çalışmıyorsa linki kopyalayın:
              </p>

              <p style="margin:6px 0 0 0;font-family:Arial;font-size:12px;color:#2563eb;word-break:break-all;">
                ${href}
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
              <p style="margin:0;font-family:Arial;font-size:12px;color:#64748b;">
                Bu işlemi siz yapmadıysanız dikkate almayabilirsiniz.
              </p>

              <p style="margin:8px 0 0 0;font-family:Arial;font-size:12px;color:#94a3b8;">
                NB PDF PLATFORM © 2026
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>

  </table>

</body>
</html>`;
}
