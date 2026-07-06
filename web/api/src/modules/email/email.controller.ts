import type { Request, Response } from "express";
import { unsubscribeByToken } from "./email-unsubscribe.service.js";

/**
 * Abonelikten çıkış — token ile (giriş gerekmez).
 *  - POST: RFC 8058 tek-tık (Gmail/Yahoo). Boş 200 döner.
 *  - GET:  kullanıcı e-postadaki bağlantıya tıklar → çıkarır + onay sayfası.
 */
export async function unsubscribeController(req: Request, res: Response): Promise<void> {
  const token = String(req.query.token ?? (req.body as { token?: string } | undefined)?.token ?? "");
  const ok = await unsubscribeByToken(token);

  if (req.method === "POST") {
    res.status(200).json({ ok });
    return;
  }

  const title = ok ? "Abonelikten çıkarıldınız" : "Bağlantı geçersiz";
  const msg = ok
    ? "Bundan sonra size tanıtım/pazarlama e-postası göndermeyeceğiz. İşlemsel e-postalar (hesap, fatura) gelmeye devam eder."
    : "Abonelikten çıkış bağlantısı geçersiz ya da süresi dolmuş. Lütfen bize ulaşın.";
  res
    .status(200)
    .type("html")
    .send(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#eef2f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:520px;margin:60px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 8px 30px rgba(15,23,42,.06);">
  <div style="height:4px;width:56px;margin:0 auto 20px;background:linear-gradient(90deg,#06b6d4,#4f46e5);border-radius:4px;"></div>
  <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${title}</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">${msg}</p>
  <a href="https://www.pdfplatform.app" style="display:inline-block;padding:12px 26px;background:linear-gradient(135deg,#fb923c,#ea580c);color:#fff;font-weight:700;text-decoration:none;border-radius:10px;">PDF Platform'a dön →</a>
</div>
</body></html>`);
}
