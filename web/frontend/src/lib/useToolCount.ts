import { useOptionalSettings } from "../contexts/SettingsContext";
import { TOOLS } from "./toolCatalog";
import { ARAC_SAYISI, TOOL_SLUGS } from "../seo/seoLight.mjs";

/**
 * Sitede şu an kullanılabilir araç sayısı — ekranda ÇALIŞMA ANINDA hesaplanır.
 *
 * Araç listesinden (yapay zekâ araçları DAHİL) şu düşülür:
 *  - panelden kapatılan araçlar (TOOLS.config.disabledFeatures, veritabanındaki ayar);
 * Panelden bir aracı kapatınca sayı yeniden yayın yapmadan değişir.
 * Ayar henüz gelmediyse / SettingsProvider yoksa derleme zamanı değeri (ARAC_SAYISI) gösterilir.
 */
export function useToolCount(): number {
  const settings = useOptionalSettings();
  if (!settings || !settings.runtimeHydrated || settings.error) return ARAC_SAYISI;
  const disabled = new Set(settings.TOOLSPublic.disabledFeatures);
  return TOOL_SLUGS.filter((s) => !disabled.has(s)).length;
}

/**
 * Üyeliksiz (misafirin kullanabildiği) araç sayısı — katalogdaki `free` işaretinden, panelden
 * kapatılanlar düşülerek çalışma anında hesaplanır. Ayar gelmediyse kapatılan yok sayılır.
 */
export function useGuestToolCount(): number {
  const disabled = new Set(useOptionalSettings()?.TOOLSPublic.disabledFeatures ?? []);
  return TOOLS.filter((t) => t.free && !disabled.has(t.id)).length;
}

/** Metindeki `{toolCount}` ve `{freeCount}` yer tutucularını gerçek sayıyla değiştirir. */
export const fillToolCount = (text: string, n: number, freeCount?: number): string =>
  text.replace(/\{toolCount\}/g, String(n)).replace(/\{freeCount\}/g, String(freeCount ?? ""));
