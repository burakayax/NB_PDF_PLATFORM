import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../lib/jwt.js";
import { resolveRoleFromEmail } from "../../lib/role-policy.js";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";

/**
 * "Ödemeleri kapat" kill-switch'i — `global.flags.featureFlags.paymentsDisabled`.
 *
 *   === false  → ödemeler AÇIK (admin kill-switch'i bilinçle KAPATMIŞ).
 *   true / yok / hata → ödemeler KAPALI (ücretsiz lansman modu).
 *
 * Anlam bilinçli olarak TERS (kill-switch): admin "Sistem Kontrol" sekmesindeki
 * bayraklar varsayılan AÇIK gelir; yeni bir bayrak sekme kaydında `true` yazılır.
 * Bu yüzden "Ödemeleri kapat" AÇIK = güvenli varsayılan; admin yanlışlıkla
 * kaydetse bile ödemeler KAPALI kalır. Sadece anahtar açıkça KAPATILINCA
 * (`paymentsDisabled === false`) ödemeler aktive olur.
 */
export async function arePaymentsEnabled(): Promise<boolean> {
  try {
    const raw = await getSetting(SITE_SETTING_KEYS.GLOBAL_FLAGS);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const ff = (raw as Record<string, unknown>).featureFlags;
      if (ff && typeof ff === "object" && !Array.isArray(ff)) {
        return (ff as Record<string, unknown>).paymentsDisabled === false;
      }
    }
  } catch {
    /* okuma hatası → güvenli taraf: kapalı */
  }
  return false;
}

/**
 * İstek geçerli bir ADMIN oturumundan mı geliyor? Kapı kimlik doğrulamasından ÖNCE çalıştığı için
 * jeton burada ayrıca doğrulanır (imza + süre). Geçersiz/eksik jeton → false (kapalı kalır).
 * Amaç: ödemeler kullanıcılara kapalıyken yöneticinin gerçek akışı (PayTR test modu dahil) deneyebilmesi.
 */
function isAdminRequest(req: Request): boolean {
  try {
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) return false;
    const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
    return resolveRoleFromEmail(payload.email) === "ADMIN";
  } catch {
    return false;
  }
}

/**
 * Ödeme BAŞLATMA uçlarını (initialize / create / credit-checkout start) korur.
 * Bayrak kapalıyken 503 + no-op.routes ile aynı gövdeyi döner; frontend
 * (`api/payment.ts` → `ensureOk`) bu gövdeyi okuyup kullanıcıya net mesaj verir.
 *
 * Yönetici (ADMIN) oturumu kapalıyken de geçer — kullanıcılara açmadan canlı deneme için.
 *
 * DİKKAT: callback / webhook / iade uçlarına UYGULANMAZ — in-flight veya gerçek
 * ödemelerin bildirimleri her zaman erişilebilir kalmalı.
 */
export async function requirePaymentsEnabled(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (await arePaymentsEnabled() || isAdminRequest(req)) {
    next();
    return;
  }
  res.status(503).json({
    error: "payments_disabled",
    enabled: false,
    provider: null,
    message:
      "Payments are not active yet. The service is currently in free-launch mode.",
  });
}
