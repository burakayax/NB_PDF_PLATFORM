import type { FeatureKey } from "../modules/subscription/subscription.config.js";
import { getResolvedTOOLSBusinessConfig } from "../modules/subscription/tools-config-runtime.js";

/**
 * `TOOLS.config.disabledFeatures` — tüm kullanıcılar için geçici kapatılan araçlar (SiteSetting, önbellekli).
 */
export async function isFeatureGloballyDisabled(featureKey: FeatureKey): Promise<boolean> {
  const cfg = await getResolvedTOOLSBusinessConfig();
  return cfg.globallyDisabledFeatures.has(featureKey);
}

/**
 * `TOOLS.config.adminOnlyFeatures` — henüz herkese açılmamış, yalnız yöneticinin kullanabildiği araçlar.
 * Çağıran, yönetici kontrolünü KENDİSİ önce yapmalıdır (yönetici bu kapıdan geçmez).
 */
export async function isFeatureAdminOnly(featureKey: FeatureKey): Promise<boolean> {
  const cfg = await getResolvedTOOLSBusinessConfig();
  return cfg.adminOnlyFeatures.has(featureKey);
}
