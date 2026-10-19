import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../lib/mailer.js";
import { renderCorporateEmail, calloutBox } from "../../lib/email-layout.js";
import { escapeHtml } from "../../lib/email-html.js";
import { tryNormalizeEmailForStorage } from "../../lib/email-identity-normalize.js";
import { authLog } from "../../lib/auth-log.js";

/**
 * Giriş koruması — IP sınırının (loginLimiter) tamamlayıcısı. IP VPN ile değişebilir;
 * bu yüzden sayaç HESABA (e-postaya) bağlıdır:
 *  • 5 yanlış denemeden sonra hesap kısa süre kilitlenir; her yeni yanlışta süre ikiye katlanır
 *    (1 → 2 → 4 → 8 → en çok 15 dk). Doğru girişte sayaç sıfırlanır, 30 dk sessizlikte de sıfırlanır.
 *  • 3 yanlıştan sonra (TURNSTILE_SECRET_KEY tanımlıysa) bot doğrulaması istenir.
 *  • Kilitlenme anında hesap sahibine tek bir uyarı e-postası gider.
 * Kilit tavanı 15 dk tutulur: başkası kasten yanlış deneyip sahibini uzun süre dışarıda bırakamasın.
 * Olmayan e-postalar da sayılır — aksi halde kilit mesajı "bu hesap var" bilgisini sızdırırdı.
 * Sayaç bellekte tutulur (tek sunucu); yeniden başlatmada sıfırlanması kabul edilmiştir.
 */

export const FREE_ATTEMPTS = 5;
export const CAPTCHA_AFTER_FAILS = 3;
const BASE_LOCK_MS = 60_000;
const MAX_LOCK_MS = 15 * 60_000;
const IDLE_RESET_MS = 30 * 60_000;
const ALERT_COOLDOWN_MS = 60 * 60_000;

type State = { fails: number; lastFailAt: number; lockedUntil: number; alertedAt: number };
const store = new Map<string, State>();

function keyOf(email: string): string {
  return tryNormalizeEmailForStorage(email) ?? email.trim().toLowerCase();
}

function prune(now: number) {
  if (store.size < 10_000) return;
  for (const [k, s] of store) {
    if (s.lockedUntil < now && now - s.lastFailAt > IDLE_RESET_MS) store.delete(k);
  }
}

function fresh(email: string, now: number): State | undefined {
  const s = store.get(keyOf(email));
  if (!s) return undefined;
  if (s.lockedUntil < now && now - s.lastFailAt > IDLE_RESET_MS) {
    store.delete(keyOf(email));
    return undefined;
  }
  return s;
}

export function lockDurationMs(fails: number): number {
  if (fails < FREE_ATTEMPTS) return 0;
  return Math.min(BASE_LOCK_MS * 2 ** (fails - FREE_ATTEMPTS), MAX_LOCK_MS);
}

/** Hesap kilitliyse kalan saniye, değilse 0. */
export function lockSecondsRemaining(email: string, now = Date.now()): number {
  const s = fresh(email, now);
  if (!s || s.lockedUntil <= now) return 0;
  return Math.ceil((s.lockedUntil - now) / 1000);
}

export function captchaRequired(email: string, now = Date.now()): boolean {
  return (fresh(email, now)?.fails ?? 0) >= CAPTCHA_AFTER_FAILS;
}

/** Başarısız denemeyi kaydeder. `alert` true ise hesap sahibine uyarı gitmelidir. */
export function registerFailure(email: string, now = Date.now()): { fails: number; lockMs: number; alert: boolean } {
  prune(now);
  const k = keyOf(email);
  const s = fresh(email, now) ?? { fails: 0, lastFailAt: now, lockedUntil: 0, alertedAt: Number.NEGATIVE_INFINITY };
  s.fails += 1;
  s.lastFailAt = now;
  const lockMs = lockDurationMs(s.fails);
  if (lockMs > 0) s.lockedUntil = now + lockMs;
  const alert = lockMs > 0 && now - s.alertedAt > ALERT_COOLDOWN_MS;
  if (alert) s.alertedAt = now;
  store.set(k, s);
  return { fails: s.fails, lockMs, alert };
}

export function registerSuccess(email: string): void {
  store.delete(keyOf(email));
}

/** Yalnızca testler için. */
export function _resetLoginGuard(): void {
  store.clear();
}

// ─── Bot doğrulaması (Cloudflare Turnstile) ──────────────────────────────────

export function captchaEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyCaptcha(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    // Doğrulama servisine ulaşılamazsa kullanıcıyı kilitlemeyiz; IP + hesap kilidi yine geçerli.
    authLog.warn("captcha verify unreachable", { message: (error as Error).message });
    return true;
  }
}

// ─── Hesap sahibine uyarı ────────────────────────────────────────────────────

/** Hata fırlatmaz; e-posta gidemese bile giriş akışı etkilenmez. */
export async function sendLockoutAlert(email: string, ip?: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { email: keyOf(email) } });
    if (!user) return;
    const tr = user.preferredLanguage === "tr";
    const subject = tr ? "Hesabınıza çok sayıda hatalı giriş denemesi" : "Multiple failed sign-in attempts on your account";
    const intro = tr
      ? "Hesabınıza art arda hatalı şifreyle giriş denendi. Güvenliğiniz için hesap kısa süreliğine kilitlendi."
      : "Several sign-in attempts with a wrong password were made on your account. For your safety it has been locked for a short time.";
    const note = tr
      ? "Bu denemeleri siz yaptıysanız birkaç dakika sonra tekrar deneyebilir ya da giriş ekranındaki “Şifremi unuttum” bağlantısını kullanabilirsiniz. Siz yapmadıysanız şifrenizi hemen değiştirmenizi öneririz."
      : "If this was you, try again in a few minutes or use “Forgot password”. If it was not you, we recommend changing your password right away.";
    const ipLine = ip ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">IP: ${escapeHtml(ip)}</p>` : "";
    const html = renderCorporateEmail({
      eyebrow: tr ? "Güvenlik" : "Security",
      title: subject,
      intro,
      bodyHtml: `${calloutBox(escapeHtml(subject), escapeHtml(note))}${ipLine}`,
      footerText: "PDF PLATFORM — NB Global Studio",
      productName: "PDF PLATFORM",
    });
    await sendMail({ to: user.email, subject, html, text: `${subject}\n\n${intro}\n\n${note}${ip ? `\nIP: ${ip}` : ""}` });
  } catch (error) {
    authLog.warn("lockout alert mail failed", { message: (error as Error).message });
  }
}
