import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";

/**
 * HATA İZLEME — yönetim panelinden ayarlanan değerler.
 *
 * Hata toplama, sahte hata eleme, önem derecesi ve e-posta bildirimi (yapay zekâ YOK, Claude kullanmaz).
 */
export type Severity = "low" | "medium" | "high" | "critical";
export const SEVERITIES: readonly Severity[] = ["low", "medium", "high", "critical"];

export type AutoHealConfig = {
  /** Ana anahtar: kapalıysa hata analizi ve bildirim durur. */
  enabled: boolean;
  /** Bu önem derecesi ve üstü için e-posta gönderilir. */
  emailMinSeverity: Severity;
};

export const AUTOHEAL_DEFAULTS: AutoHealConfig = {
  enabled: true,
  emailMinSeverity: "medium",
};

export function normalizeAutoHealConfig(raw: unknown): AutoHealConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = AUTOHEAL_DEFAULTS;
  return {
    // Yalnızca açıkça `false` kapatır; eksik kayıt "açık" demektir.
    enabled: r.enabled !== false,
    emailMinSeverity: SEVERITIES.includes(r.emailMinSeverity as Severity) ? (r.emailMinSeverity as Severity) : d.emailMinSeverity,
  };
}

export async function readAutoHealConfig(): Promise<AutoHealConfig> {
  return normalizeAutoHealConfig(await getSettingWithFallback<unknown>(SITE_SETTING_KEYS.AUTOHEAL_CONFIG, {}));
}

export async function writeAutoHealConfig(patch: Partial<AutoHealConfig>): Promise<AutoHealConfig> {
  const next = normalizeAutoHealConfig({ ...(await readAutoHealConfig()), ...patch });
  await setSetting(SITE_SETTING_KEYS.AUTOHEAL_CONFIG, next);
  return next;
}
