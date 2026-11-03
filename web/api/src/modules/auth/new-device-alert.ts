import { prisma } from "../../lib/prisma.js";
import { sendMail } from "../../lib/mailer.js";
import { renderCorporateEmail, calloutBox } from "../../lib/email-layout.js";
import { escapeHtml } from "../../lib/email-html.js";
import { authLog } from "../../lib/auth-log.js";

/**
 * YENİ CİHAZ UYARISI — hesap sahibine bilgi (engel YOK).
 *
 * Hesabın zaten en az `ESIK` bilinen cihazı varsa ve giriş daha önce görülmemiş bir cihazdan geliyorsa
 * sahibine tek bir e-posta gider: "siz değilseniz şifrenizi değiştirin". Normal kullanıcı (bilgisayar,
 * telefon, bir yedek) hiç e-posta görmez; hesabı çok kişiyle paylaşan, her yeni kişide uyarı düşürür.
 *
 * Yalnız ÇEREZ tabanlı cihaz anahtarları (`c_` ön ekli) sayılır: eski UA+IP anahtarları IP değişince
 * şişer, uyarıyı yanlış tetikler.
 */
export const BILINEN_CIHAZ_ESIGI = 3;
const PENCERE_GUN = 90;
const SAAT_BASINA_AZAMI = 1; // aynı hesaba en çok 1 uyarı / saat (sunucu belleğinde)
const sonUyari = new Map<string, number>();

export const CEREZ_ANAHTAR_ONEKI = "c_";

/** Saf karar: bilinen çerez-cihazları ve bu girişin anahtarı → uyarı gerekir mi? */
export function yeniCihazUyarisiGerekli(bilinen: string[], buAnahtar: string | null): boolean {
  if (!buAnahtar || !buAnahtar.startsWith(CEREZ_ANAHTAR_ONEKI)) return false;
  const set = new Set(bilinen.filter((k) => k.startsWith(CEREZ_ANAHTAR_ONEKI)));
  if (set.has(buAnahtar)) return false;
  return set.size >= BILINEN_CIHAZ_ESIGI;
}

/** Hesabın bilinen çerez-cihaz anahtarları (girişten ÖNCE çağrılmalı). */
export async function bilinenCihazAnahtarlari(userId: string): Promise<string[]> {
  const since = new Date(Date.now() - PENCERE_GUN * 24 * 3600 * 1000);
  const rows = await prisma.refreshToken.findMany({
    where: { userId, createdAt: { gte: since }, deviceKey: { startsWith: CEREZ_ANAHTAR_ONEKI } },
    select: { deviceKey: true },
    distinct: ["deviceKey"],
  });
  return rows.map((r) => r.deviceKey!).filter(Boolean);
}

function tarayiciOzeti(ua?: string | null): string {
  const u = ua ?? "";
  const tarayici = /Edg\//.test(u) ? "Edge" : /OPR\//.test(u) ? "Opera" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "";
  const sistem = /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iOS" : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "macOS" : /Linux/.test(u) ? "Linux" : "";
  return [tarayici, sistem].filter(Boolean).join(" · ");
}

/** Hata fırlatmaz; e-posta gidemese bile giriş etkilenmez. */
export async function sendNewDeviceAlert(user: { id: string; email: string; preferredLanguage: string }, userAgent?: string | null): Promise<void> {
  try {
    const now = Date.now();
    const last = sonUyari.get(user.id) ?? 0;
    if (now - last < (3600 * 1000) / SAAT_BASINA_AZAMI) return;
    sonUyari.set(user.id, now);
    const tr = user.preferredLanguage === "tr";
    const cihaz = tarayiciOzeti(userAgent);
    const subject = tr ? "Hesabınıza yeni bir cihazdan girildi" : "New device signed in to your account";
    const intro = tr
      ? "Hesabınıza daha önce kullanmadığınız bir cihazdan giriş yapıldı."
      : "Your account was signed in to from a device you haven't used before.";
    const note = tr
      ? "Bu giriş size aitse bir şey yapmanız gerekmiyor. Siz yapmadıysanız şifrenizi hemen değiştirin ve hesap ayarlarındaki oturum listesinden diğer oturumları kapatın."
      : "If this was you, nothing to do. If it wasn't, change your password right away and close your other sessions from the sessions list in your account settings.";
    const html = renderCorporateEmail({
      eyebrow: tr ? "Güvenlik" : "Security",
      title: subject,
      intro,
      bodyHtml: `${calloutBox(escapeHtml(subject), escapeHtml(note))}${cihaz ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">${tr ? "Cihaz" : "Device"}: ${escapeHtml(cihaz)}</p>` : ""}`,
      footerText: "PDF PLATFORM — NB Global Studio",
      productName: "PDF PLATFORM",
    });
    await sendMail({ to: user.email, subject, html, text: `${subject}\n\n${intro}\n\n${note}${cihaz ? `\n${tr ? "Cihaz" : "Device"}: ${cihaz}` : ""}` });
  } catch (error) {
    authLog.warn("new device alert mail failed", { message: (error as Error).message });
  }
}
