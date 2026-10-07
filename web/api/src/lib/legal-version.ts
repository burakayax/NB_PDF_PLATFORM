/**
 * Yürürlükteki Hizmet Şartları / Gizlilik Politikası sürümü (yürürlük tarihi).
 * Şartlar esaslı biçimde değişirse BURASI ve legalContent.mjs `effectiveDate` birlikte güncellenir;
 * her yeni hesap, açıldığı andaki sürümle kaydedilir (itiraz dosyasında görünür).
 */
export const TERMS_VERSION = "2026-10-07";

export type LegalAcceptanceVia = "email" | "google";

/** Kayıtta kullanıcıdan alınan ZORUNLU onaylar. Aydınlatma bir bilgilendirmedir (rıza değil): "okudum" olarak kaydedilir. */
export function legalAcceptanceRows(via: LegalAcceptanceVia, ctx?: { ip?: string | null; userAgent?: string | null }) {
  const base = { version: TERMS_VERSION, via, ip: ctx?.ip ?? null, userAgent: ctx?.userAgent ? ctx.userAgent.slice(0, 500) : null };
  return [
    { kind: "terms_and_privacy", ...base },
    { kind: "privacy_notice_read", ...base },
    { kind: "age_18", ...base },
  ];
}
