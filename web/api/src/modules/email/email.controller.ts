import type { Request, Response } from "express";
import {
  resubscribeByToken,
  saveUnsubscribeFeedback,
  unsubscribeByToken,
  UNSUBSCRIBE_REASONS,
} from "./email-unsubscribe.service.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function ctx(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

function tokenOf(req: Request): string {
  return String(req.query.token ?? (req.body as { token?: string } | undefined)?.token ?? "");
}

function page(title: string, inner: string): string {
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;background:#eef2f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 30px;box-shadow:0 8px 30px rgba(15,23,42,.06);">
  <div style="height:4px;width:56px;margin:0 0 20px;background:linear-gradient(90deg,#1d4ed8,#4f46e5);border-radius:4px;"></div>
  ${inner}
</div>
</body></html>`;
}

const BTN_MAIN =
  "display:inline-block;padding:12px 26px;background:#ea580c;color:#fff;font-weight:700;font-size:15px;text-decoration:none;border:0;border-radius:10px;cursor:pointer;font-family:inherit;";
const BTN_ALT =
  "display:inline-block;padding:11px 22px;background:#fff;color:#1d4ed8;font-weight:700;font-size:14px;border:2px solid #1d4ed8;border-radius:10px;cursor:pointer;font-family:inherit;";

/** "Yeniden abone ol" düğmesi — kendi formu; yalnız kullanıcının tıklamasıyla (POST) çalışır. */
function resubscribeForm(token: string): string {
  return `<form method="post" action="/api/email/unsubscribe/resubscribe" style="margin:22px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;">
    <p style="margin:0 0 10px;font-size:14px;color:#475569;">Yanlışlıkla mı çıktınız?</p>
    <input type="hidden" name="token" value="${esc(token)}">
    <button type="submit" style="${BTN_ALT}">Yeniden abone ol</button>
  </form>`;
}

function backLink(): string {
  return `<p style="margin:22px 0 0;"><a href="https://www.pdfplatform.app" style="${BTN_MAIN}">PDF Platform'a dön →</a></p>`;
}

function feedbackForm(token: string): string {
  const radios = Object.entries(UNSUBSCRIBE_REASONS)
    .map(
      ([key, label]) =>
        `<label style="display:block;margin:0 0 8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;cursor:pointer;"><input type="radio" name="reason" value="${key}" required style="margin-right:8px;">${esc(label)}</label>`,
    )
    .join("");
  return `<form method="post" action="/api/email/unsubscribe/feedback" style="margin:24px 0 0;">
    <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0f172a;">Ayrılma nedeninizi paylaşır mısınız? <span style="font-weight:400;color:#64748b;">(isteğe bağlı)</span></p>
    <input type="hidden" name="token" value="${esc(token)}">
    ${radios}
    <label for="comment" style="display:block;margin:14px 0 6px;font-size:14px;color:#475569;">Eklemek istediğiniz bir şey var mı?</label>
    <textarea id="comment" name="comment" rows="3" maxlength="1000" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;"></textarea>
    <p style="margin:14px 0 0;"><button type="submit" style="${BTN_MAIN}">Gönder</button></p>
  </form>`;
}

/**
 * Abonelikten çıkış — token ile (giriş gerekmez).
 *  - POST: RFC 8058 tek-tık (Gmail/Yahoo). Boş 200 döner.
 *  - GET:  kullanıcı e-postadaki bağlantıya tıklar → ANINDA çıkarır; sayfada isteğe bağlı
 *          neden formu ve "Yeniden abone ol" düğmesi gösterilir.
 *
 * Çıkış, neden formundan bağımsızdır: kullanıcıya hiçbir ek adım yüklenmez
 * (mevzuat: ret ücretsiz ve kolay olmalı, en geç 3 iş günü içinde işlenmeli).
 */
export async function unsubscribeController(req: Request, res: Response): Promise<void> {
  const token = tokenOf(req);
  const ok = await unsubscribeByToken(token, ctx(req));

  if (req.method === "POST") {
    res.status(200).json({ ok });
    return;
  }

  if (!ok) {
    res.status(200).type("html").send(
      page(
        "Bağlantı geçersiz",
        `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Bağlantı geçersiz</h1>
         <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Abonelikten çıkış bağlantısı geçersiz ya da süresi dolmuş. Lütfen bize ulaşın.</p>${backLink()}`,
      ),
    );
    return;
  }

  res.status(200).type("html").send(
    page(
      "Abonelikten çıkarıldınız",
      `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Abonelikten çıkarıldınız</h1>
       <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Bundan sonra size tanıtım/pazarlama e-postası göndermeyeceğiz. İşlemsel e-postalar (hesap, fatura) gelmeye devam eder.</p>
       ${feedbackForm(token)}
       ${resubscribeForm(token)}`,
    ),
  );
}

/** Neden formu: nedeni kaydeder ve yöneticiye e-posta gönderir. Çıkış zaten yapılmıştır. */
export async function unsubscribeFeedbackController(req: Request, res: Response): Promise<void> {
  const token = tokenOf(req);
  const body = (req.body ?? {}) as { reason?: unknown; comment?: unknown };
  const ok = await saveUnsubscribeFeedback(token, { reason: body.reason, comment: body.comment });

  res.status(ok ? 200 : 400).type("html").send(
    page(
      ok ? "Teşekkürler" : "İstek işlenemedi",
      ok
        ? `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Teşekkürler</h1>
           <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Geri bildiriminiz bize ulaştı. Tanıtım e-postası listesinden çıkarıldınız.</p>
           ${resubscribeForm(token)}${backLink()}`
        : `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">İstek işlenemedi</h1>
           <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Lütfen bir neden seçip tekrar deneyin. Listeden çıkışınız etkilenmedi.</p>${backLink()}`,
    ),
  );
}

/** "Yeniden abone ol": kullanıcının kendi tıklamasıyla tanıtım iznini geri açar. */
export async function resubscribeController(req: Request, res: Response): Promise<void> {
  const ok = await resubscribeByToken(tokenOf(req), ctx(req));
  res.status(ok ? 200 : 400).type("html").send(
    page(
      ok ? "Tekrar abone oldunuz" : "Bağlantı geçersiz",
      ok
        ? `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Tekrar abone oldunuz</h1>
           <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Tanıtım e-postalarını yeniden alacaksınız. İstediğiniz zaman her e-postanın altındaki bağlantıdan ya da Hesap ayarlarından çıkabilirsiniz.</p>${backLink()}`
        : `<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Bağlantı geçersiz</h1>
           <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">Bağlantı geçersiz ya da süresi dolmuş. Hesap ayarlarından tanıtım e-postası anahtarını açabilirsiniz.</p>${backLink()}`,
    ),
  );
}
