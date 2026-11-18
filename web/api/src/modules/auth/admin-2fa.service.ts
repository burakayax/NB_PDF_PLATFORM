import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { sendMail } from "../../lib/mailer.js";
import { getSettingDirect, setSetting } from "../../lib/site-config.service.js";

/**
 * YÖNETİCİ İKİNCİ DOĞRULAMA (e-posta kodu).
 *
 * Giriş yöntemi (şifre / Google / çalıntı oturum) ne olursa olsun, yönetim ucuna ulaşmak için
 * bu tarayıcının "kod doğrulandı" kanıtı gerekir (HttpOnly çerez, 12 saat).
 *
 * Güvenlik özellikleri:
 *  - Kod 6 haneli, kriptografik rastgele; veritabanında DÜZ METİN SAKLANMAZ — sunucu sırrıyla HMAC'lenmiş özeti tutulur.
 *  - 10 dakika geçerli, TEK KULLANIMLIK, en fazla 5 yanlış denemede iptal olur.
 *  - Yeni kod isteme: 60 sn bekleme + saatte en çok 5; yeni kod eskisini iptal eder.
 *  - Karşılaştırma sabit zamanlıdır (timingSafeEqual).
 *  - Kanıt çerezi imzalıdır ve YALNIZ o yöneticinin kimliğine bağlıdır; kod e-postada ve DB'de kanıt olarak kullanılamaz.
 */

export const ADMIN_2FA_COOKIE = "nb_admin_2fa";
export const ADMIN_2FA_PROOF_HOURS = 12;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
export const MAX_ATTEMPTS = 5;

type CodeRecord = { hash: string; expiresAt: number; attempts: number; sentAt: number; sends: number[] };

const key = (userId: string) => `admin2fa.code.${userId}`;

/** Acil durum anahtarı: e-posta sistemi bozulursa Render'da ADMIN_2FA_DISABLED=true yapılır. */
export function isAdmin2faEnabled(): boolean {
  return (process.env.ADMIN_2FA_DISABLED ?? "").trim().toLowerCase() !== "true";
}

function hmacKey(): string {
  return crypto.createHash("sha256").update(`admin2fa:${env.JWT_REFRESH_SECRET}`).digest("hex");
}

function hashCode(userId: string, code: string): string {
  return crypto.createHmac("sha256", hmacKey()).update(`${userId}:${code}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function readRecord(userId: string): Promise<CodeRecord | null> {
  const raw = await getSettingDirect(key(userId));
  if (!raw || typeof raw !== "object") return null;
  return raw as CodeRecord;
}

export async function sendAdminCode(user: { id: string; email: string }, ip?: string): Promise<{ cooldownSeconds: number }> {
  const now = Date.now();
  const prev = await readRecord(user.id);
  const sends = (prev?.sends ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (prev && now - prev.sentAt < RESEND_COOLDOWN_MS) {
    throw new HttpError(429, `Yeni kod için ${Math.ceil((RESEND_COOLDOWN_MS - (now - prev.sentAt)) / 1000)} saniye bekleyin.`);
  }
  if (sends.length >= MAX_SENDS_PER_HOUR) {
    throw new HttpError(429, "Bu saat içinde çok fazla kod istendi. Lütfen daha sonra tekrar deneyin.");
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const record: CodeRecord = {
    hash: hashCode(user.id, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
    sends: [...sends, now],
  };
  await setSetting(key(user.id), record);

  const saat = new Date(now).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const text =
    `Yönetim paneli doğrulama kodunuz: ${code}\n\nKod 10 dakika geçerlidir ve tek kullanımlıktır.\n` +
    `İstek: ${saat}${ip ? ` · IP ${ip}` : ""}\n\n` +
    `Bu isteği siz yapmadıysanız kodu kimseyle paylaşmayın ve şifrenizi hemen değiştirin.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a">` +
    `<h2 style="margin:0 0 12px">Yönetim paneli doğrulama kodu</h2>` +
    `<p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:16px 0">${code}</p>` +
    `<p style="margin:0 0 8px">Kod <b>10 dakika</b> geçerlidir ve tek kullanımlıktır.</p>` +
    `<p style="margin:0 0 8px;color:#475569;font-size:13px">İstek: ${saat}${ip ? ` · IP ${ip}` : ""}</p>` +
    `<p style="margin:16px 0 0;color:#b45309;font-size:13px">Bu isteği siz yapmadıysanız kodu kimseyle paylaşmayın ve şifrenizi hemen değiştirin.</p></div>`;
  try {
    await sendMail({ to: user.email, subject: "Yönetim paneli doğrulama kodu", html, text });
  } catch {
    await setSetting(key(user.id), { ...record, expiresAt: 0 });
    throw new HttpError(503, "Kod e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
  }
  return { cooldownSeconds: RESEND_COOLDOWN_MS / 1000 };
}

/** Kod doğruysa imzalı kanıt döner; yanlış/süresi geçmiş/tükenmişse HttpError. */
export async function verifyAdminCode(userId: string, rawCode: string): Promise<string> {
  const generic = () => new HttpError(400, "Kod hatalı veya süresi dolmuş.");
  const digits = String(rawCode ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) throw generic();

  const rec = await readRecord(userId);
  if (!rec || rec.expiresAt <= Date.now() || rec.attempts >= MAX_ATTEMPTS) throw generic();

  if (!safeEqualHex(hashCode(userId, digits), rec.hash)) {
    const attempts = rec.attempts + 1;
    // Son denemede kodu tamamen iptal et: tahminle ilerlenemez.
    await setSetting(key(userId), attempts >= MAX_ATTEMPTS ? { ...rec, attempts, expiresAt: 0 } : { ...rec, attempts });
    throw generic();
  }

  // Tek kullanımlık: doğrulanınca hemen iptal.
  await setSetting(key(userId), { ...rec, expiresAt: 0, attempts: MAX_ATTEMPTS });
  return signProof(userId);
}

function proofSecret(): string {
  return `${hmacKey()}:proof`;
}

export function signProof(userId: string): string {
  return jwt.sign({ typ: "admin2fa" }, proofSecret(), { subject: userId, expiresIn: `${ADMIN_2FA_PROOF_HOURS}h` });
}

/** Çerezdeki kanıt bu yöneticiye ait ve süresi dolmamış mı? */
export function hasValidProof(token: string | undefined, userId: string): boolean {
  if (!token) return false;
  try {
    const d = jwt.verify(token, proofSecret()) as jwt.JwtPayload;
    return d.typ === "admin2fa" && d.sub === userId;
  } catch {
    return false;
  }
}
