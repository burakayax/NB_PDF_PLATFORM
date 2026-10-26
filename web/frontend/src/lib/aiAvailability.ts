import { useOptionalSettings } from "../contexts/SettingsContext";
import { AI_COMING_SOON_SLUGS } from "../seo/seoContent.mjs";

/**
 * Yapay zekâ araçları halka henüz açık değilse (ödemeler kapalıyken "Çok yakında") true.
 * Landing ve çalışma alanındaki `aiComingSoon` ile aynı sinyal; yetkili kullanıcı ayrımı yapılmaz
 * çünkü bu yalnız pazarlama metinlerini (hediye işlem vb.) doğru zamanlı yazmak içindir.
 */
export function useAiNotOpen(): boolean {
  // SettingsProvider dışında (ör. izole test/önizleme) ayar yoktur: güvenli varsayım "AI henüz açık değil".
  const flags = useOptionalSettings()?.flags;
  return flags?.featureFlags?.paymentsDisabled !== false;
}

const GIFT_RE = /hediye|welcome gift|free AI operation/i;

/** AI açılana kadar "hoş geldin hediyesi" vaadini "AI açıldığında" diye zamanlar. */
export function softenGiftLine(line: string, tr: boolean, aiNotOpen: boolean): string {
  if (!aiNotOpen || !GIFT_RE.test(line)) return line;
  return tr ? "✨ Yapay zekâ açıldığında: 3 hediye işlem" : "✨ When AI opens: 3 free AI operations";
}

export function softenGiftLines(lines: readonly string[], tr: boolean, aiNotOpen: boolean): string[] {
  return lines.map((l) => softenGiftLine(l, tr, aiNotOpen));
}

/** Halka açık olmayan (Çok yakında) yapay zekâ araçları — landing rozeti "Çok yakında" yazar. */
export const AI_SOON_TOOL_IDS = new Set<string>(AI_COMING_SOON_SLUGS);
