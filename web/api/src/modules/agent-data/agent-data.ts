import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";
import { sendMail } from "../../lib/mailer.js";
import { periodReport } from "../social/gsc.service.js";

/**
 * YAPAY ZEKÂ AJANLARI İÇİN SALT-OKUNUR VERİ UÇLARI (GitHub Actions çağırır).
 *
 * Yetki: `Authorization: Bearer <AGENT_DATA_TOKEN>`; token tanımlı değil ya da 32 karakterden kısaysa uçlar KAPALI (404).
 * Gizli anahtarlar (Search Console servis hesabı vb.) GitHub'a KOPYALANMAZ: ajan yalnız bu uçlardan işlenmiş veriyi alır.
 *
 * Kurallar:
 *  - GET uçları yalnız okur; hiçbir şey yazmaz/paylaşmaz.
 *  - POST /internal/agent/mail yalnızca YÖNETİCİ adresine (env.ADMIN_EMAIL) gönderir; alıcı dışarıdan verilemez.
 *  - Kişisel veri yok: paylaşım metinleri ve arama verisi herkese açık içeriktir.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function agentTokenOk(request: Request): boolean {
  const expected = (process.env.AGENT_DATA_TOKEN ?? "").trim();
  if (expected.length < 32) return false;
  const h = String(request.headers.authorization ?? "");
  const provided = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token yoksa/yanlışsa uç yokmuş gibi davranır (404). */
function guard(request: Request, response: Response): boolean {
  if (!agentTokenOk(request)) {
    response.status(404).json({ error: "not_found" });
    return false;
  }
  return true;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Search Console: son 7 gün ve ondan önceki 7 gün (veri 2-3 gün gecikir). */
export async function agentGscController(request: Request, response: Response): Promise<void> {
  if (!guard(request, response)) return;
  const lag = 3;
  const end = new Date(Date.now() - lag * DAY_MS);
  const curFrom = new Date(end.getTime() - 6 * DAY_MS);
  const prevTo = new Date(curFrom.getTime() - DAY_MS);
  const prevFrom = new Date(prevTo.getTime() - 6 * DAY_MS);
  const [current, previous] = await Promise.all([
    periodReport(ymd(curFrom), ymd(end)),
    periodReport(ymd(prevFrom), ymd(prevTo)),
  ]);
  response.status(200).json({ current, previous });
}

/** Sosyal medya: son N günün paylaşımları (yalnız okuma; gizli anahtar ve hesap bilgisi YOK). */
export async function agentSocialPostsController(request: Request, response: Response): Promise<void> {
  if (!guard(request, response)) return;
  const days = Math.min(120, Math.max(1, Number.parseInt(String(request.query.days ?? "45"), 10) || 45));
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await prisma.socialPost.findMany({
    where: { createdAt: { gte: since }, clearedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { platform: true, lang: true, title: true, linkUrl: true, body: true, status: true, scheduledAt: true, publishedAt: true },
  });
  response.status(200).json({
    days,
    count: rows.length,
    posts: rows.map((r) => ({
      platform: r.platform,
      lang: r.lang,
      title: r.title.slice(0, 160),
      link: r.linkUrl,
      text: r.body.slice(0, 600),
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    })),
  });
}

let mailsToday = { day: "", n: 0 };

/** Yönetici sabah özeti e-postası: alıcı SABİT (yönetici), günde en fazla 10 gönderim. */
export async function agentMailController(request: Request, response: Response): Promise<void> {
  if (!guard(request, response)) return;
  const body = (request.body ?? {}) as { subject?: unknown; text?: unknown };
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 150) : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 20000) : "";
  if (!subject || !text) {
    response.status(400).json({ error: "subject_and_text_required" });
    return;
  }
  const today = ymd(new Date());
  if (mailsToday.day !== today) mailsToday = { day: today, n: 0 };
  if (mailsToday.n >= 10) {
    response.status(429).json({ error: "daily_limit" });
    return;
  }
  mailsToday.n += 1;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;white-space:pre-wrap">${esc(text)}</div>`;
  try {
    await sendMail({ to: env.ADMIN_EMAIL, subject, html, text });
    response.status(200).json({ ok: true });
  } catch (e) {
    logger.warn("agent", "[agent-mail] gönderilemedi", e instanceof Error ? e.message : e);
    response.status(502).json({ error: "mail_failed" });
  }
}
