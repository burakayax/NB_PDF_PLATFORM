import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";

/**
 * MİSAFİR PDF SIKIŞTIR — yönetim panelinden ayarlanan değerler.
 *
 * Eskiden bu değerler Render ortam değişkenindeydi (her değişiklik panelden çıkıp yeniden
 * dağıtım gerektiriyordu). Artık veritabanındaki `SiteSetting` kaydı tek kaynak: PDF servisi
 * (Python) bunu dahili uçtan okur ve ~30 sn içinde yeni değeri uygular.
 *
 * ACİL KAPATMA: `enabled=false` ya da `dailyLimit=0` ya da `globalDailyLimit=0` → misafir kapısı
 * KAPALI (herkes üyelik kapısını görür). Hiçbir değer "sınırsız misafir erişimi" anlamına gelmez.
 */
export type GuestCompressConfig = {
  /** Ana anahtar. Kapalıysa misafir sıkıştıramaz (acil kapatma). */
  enabled: boolean;
  /** Kişi başı (IP özeti başına) günlük hak. */
  dailyLimit: number;
  /** Tüm misafirlerin toplam günlük üst sınırı — IP döndürerek sunucuyu bedavaya yormayı sınırlar. */
  globalDailyLimit: number;
  /** Misafir için en büyük PDF boyutu (MB). */
  maxMB: number;
};

export const GUEST_COMPRESS_DEFAULTS: GuestCompressConfig = {
  enabled: true,
  dailyLimit: 1,
  globalDailyLimit: 400,
  maxMB: 20,
};

/** Sınırlar: panelde yanlış bir değer (ör. 9999) misafir kapısını fiilen açmasın. */
export const GUEST_COMPRESS_BOUNDS = {
  dailyLimit: { min: 0, max: 20 },
  globalDailyLimit: { min: 0, max: 100_000 },
  maxMB: { min: 1, max: 100 },
} as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Ham (eksik/bozuk olabilen) kayıttan güvenli ayar üretir. */
export function normalizeGuestCompressConfig(
  raw: Partial<Record<keyof GuestCompressConfig, unknown>> | null | undefined,
): GuestCompressConfig {
  const r = raw ?? {};
  const b = GUEST_COMPRESS_BOUNDS;
  const d = GUEST_COMPRESS_DEFAULTS;
  return {
    // Yalnızca açıkça `false` kapatır; eksik/bozuk kayıt "açık, varsayılan limitlerle" demektir.
    enabled: r.enabled !== false,
    dailyLimit: clampInt(r.dailyLimit, b.dailyLimit.min, b.dailyLimit.max, d.dailyLimit),
    globalDailyLimit: clampInt(r.globalDailyLimit, b.globalDailyLimit.min, b.globalDailyLimit.max, d.globalDailyLimit),
    maxMB: clampInt(r.maxMB, b.maxMB.min, b.maxMB.max, d.maxMB),
  };
}

/** Misafir kapısı fiilen kapalı mı? (ana anahtar kapalı ya da herhangi bir sınır 0) */
export function isGuestCompressClosed(cfg: GuestCompressConfig): boolean {
  return !cfg.enabled || cfg.dailyLimit <= 0 || cfg.globalDailyLimit <= 0;
}

export async function readGuestCompressConfig(): Promise<GuestCompressConfig> {
  const raw = await getSettingWithFallback<Partial<GuestCompressConfig>>(SITE_SETTING_KEYS.GUEST_COMPRESS, {});
  return normalizeGuestCompressConfig(raw);
}

export async function writeGuestCompressConfig(
  patch: Partial<GuestCompressConfig>,
): Promise<GuestCompressConfig> {
  const next = normalizeGuestCompressConfig({ ...(await readGuestCompressConfig()), ...patch });
  await setSetting(SITE_SETTING_KEYS.GUEST_COMPRESS, next);
  return next;
}
