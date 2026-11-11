import { getSetting } from "./site-config.service.js";
import { SITE_SETTING_KEYS } from "./site-setting-keys.js";

/**
 * Admin "Sistem Kontrol" anahtarları (`global.flags.featureFlags`) — sunucu tarafı okuyucular.
 * Kural "Ödemeleri kapat" ile aynı: anahtar AÇIKÇA `false` yazılmadıkça durdurma geçerlidir
 * (okuma hatası / kayıt yok / bozuk veri → güvenli taraf).
 */
async function readFeatureFlag(key: string): Promise<unknown> {
  try {
    const raw = await getSetting(SITE_SETTING_KEYS.GLOBAL_FLAGS);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const ff = (raw as Record<string, unknown>).featureFlags;
      if (ff && typeof ff === "object" && !Array.isArray(ff)) {
        return (ff as Record<string, unknown>)[key];
      }
    }
  } catch {
    /* okuma hatası → güvenli taraf */
  }
  return undefined;
}

function envTruthy(name: string): boolean {
  return ["1", "true", "yes", "on"].includes((process.env[name] ?? "").trim().toLowerCase());
}

/**
 * Fatura ve iade faturası kesilmesin mi?
 * Durur: Render'da INVOICE_GENERATION_PAUSED=1 ise YA DA admin anahtarı `invoicingPaused` açık/yok ise.
 * Yalnız admin anahtarı açıkça `false` ve env boşsa fatura kesilir.
 */
export async function invoicingPaused(): Promise<boolean> {
  if (envTruthy("INVOICE_GENERATION_PAUSED")) return true;
  return (await readFeatureFlag("invoicingPaused")) !== false;
}

/**
 * Yurt dışı müşteriye İhracat İstisnası (KDV %0) uygulansın mı?
 * Kartın yerli/yabancı olduğu PayTR'dan öğrenilene kadar KAPALI: herkese KDV'li fatura.
 * Anahtar `exportExemptionDisabled` ters anlamlıdır (diğerleri gibi, sekme kaydında varsayılan AÇIK=durdur):
 * yalnız AÇIKÇA `false` yazılırsa istisna açılır.
 */
export async function exportExemptionOpen(): Promise<boolean> {
  return (await readFeatureFlag("exportExemptionDisabled")) === false;
}
