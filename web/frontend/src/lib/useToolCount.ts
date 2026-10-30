import { useOptionalSettings } from "../contexts/SettingsContext";
import { TOOLS } from "./toolCatalog";
import { AI_COMING_SOON_SLUGS, ARAC_SAYISI, TOOL_SLUGS } from "../seo/seoContent.mjs";

const AI_SOON = new Set<string>(AI_COMING_SOON_SLUGS);

/**
 * Sitede şu an kullanılabilir araç sayısı — ekranda ÇALIŞMA ANINDA hesaplanır.
 *
 * Araç listesinden iki şey düşülür:
 *  - panelden kapatılan araçlar (TOOLS.config.disabledFeatures, veritabanındaki ayar);
 *  - yapay zekâ araçları henüz halka açık değilken ("Çok yakında") onlar.
 * Panelden bir aracı kapatınca ya da yapay zekâ açılınca sayı yeniden yayın yapmadan değişir.
 * Ayar henüz gelmediyse / SettingsProvider yoksa derleme zamanı değeri (ARAC_SAYISI) gösterilir.
 */
export function useToolCount(): number {
  const settings = useOptionalSettings();
  if (!settings || !settings.runtimeHydrated || settings.error) return ARAC_SAYISI;
  const disabled = new Set(settings.TOOLSPublic.disabledFeatures);
  const aiNotOpen = settings.flags.featureFlags?.paymentsDisabled !== false;
  return TOOL_SLUGS.filter((s) => !disabled.has(s) && !(aiNotOpen && AI_SOON.has(s))).length;
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
