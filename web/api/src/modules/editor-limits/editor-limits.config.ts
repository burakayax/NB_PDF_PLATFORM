import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";

/**
 * PDF DÜZENLE — günlük düzenleme hakları (yönetim panelinden ayarlanır).
 *
 * Plus, Pro, Business ve yönetici SINIRSIZDIR; burada yalnız sınırlı gruplar tutulur.
 * Değer 0 = o grup için düzenleme KAPALI (acil kapatma). Kayıt yoksa/bozuksa varsayılanlar
 * (ve eski ortam değişkenleri) kullanılır → mevcut kurulumlar davranış değiştirmez.
 */
export type EditorLimitsConfig = {
  /** Üyeliksiz ziyaretçi (IP özeti başına) günlük hak. */
  guest: number;
  /** Ücretsiz üye günlük hak. */
  free: number;
  /** Başlangıç planı günlük hak. */
  starter: number;
};

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

export const EDITOR_LIMITS_DEFAULTS: EditorLimitsConfig = {
  guest: envInt("EDITOR_GUEST_DAILY_LIMIT", 1),
  free: envInt("EDITOR_FREE_DAILY_LIMIT", 2),
  starter: envInt("EDITOR_STARTER_DAILY_LIMIT", 10),
};

/** Panelde yanlış bir değer (ör. 9999) kapıyı fiilen açmasın. */
export const EDITOR_LIMITS_BOUNDS = { min: 0, max: 100 } as const;

function clampInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(EDITOR_LIMITS_BOUNDS.max, Math.max(EDITOR_LIMITS_BOUNDS.min, Math.trunc(n)));
}

export function normalizeEditorLimits(
  raw: Partial<Record<keyof EditorLimitsConfig, unknown>> | null | undefined,
): EditorLimitsConfig {
  const r = raw ?? {};
  const d = EDITOR_LIMITS_DEFAULTS;
  return {
    guest: clampInt(r.guest, d.guest),
    free: clampInt(r.free, d.free),
    starter: clampInt(r.starter, d.starter),
  };
}

export async function readEditorLimits(): Promise<EditorLimitsConfig> {
  try {
    const raw = await getSettingWithFallback<Partial<EditorLimitsConfig>>(SITE_SETTING_KEYS.EDITOR_LIMITS, {});
    return normalizeEditorLimits(raw);
  } catch {
    return { ...EDITOR_LIMITS_DEFAULTS };
  }
}

export async function writeEditorLimits(patch: Partial<EditorLimitsConfig>): Promise<EditorLimitsConfig> {
  const next = normalizeEditorLimits({ ...(await readEditorLimits()), ...patch });
  await setSetting(SITE_SETTING_KEYS.EDITOR_LIMITS, next);
  return next;
}
