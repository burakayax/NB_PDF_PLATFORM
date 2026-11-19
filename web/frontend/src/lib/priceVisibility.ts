/**
 * Fiyatların sitede gösterilip gösterilmeyeceği — TEK ANAHTAR.
 *
 * `true` iken ücretli planların, kredi paketlerinin ve ek kişi fiyatının rakamları hiçbir yerde
 * görünmez; yerine "Yakında" yazılır. Fiyat araştırması bitip fiyatlar belli olunca yalnız bunu
 * `false` yapmak yeter (fiyat verisi ve hesaplar yerinde durur, silinmedi).
 */
export let PRICES_HIDDEN = true;

/**
 * Yönetim panelindeki "Fiyatlar" anahtarı (global.flags.featureFlags.pricesHidden) çalışma zamanında bunu günceller.
 * Güvenli varsayılan: anahtar yoksa fiyatlar GİZLİ; yalnız açıkça `false` yazılırsa görünür.
 * (ES "canlı bağlama": bu dosyayı içe aktaran bileşenler güncel değeri görür.)
 */
export function applyPricesHiddenFlag(featureFlags?: Record<string, boolean> | null): void {
  PRICES_HIDDEN = featureFlags?.pricesHidden !== false;
}

/** Rakamın yerine gösterilecek metin. */
export function priceComingSoonLabel(tr: boolean): string {
  return tr ? "Yakında" : "Coming soon";
}

/**
 * Plus kartındaki "En Popüler" rozeti gizli: henüz satış yok, kanıtsız iddia olur.
 * İlk satışlar ve gerçek veri gelince `false` yapılır (şirket kurulunca yapılacaklar listesinde).
 */
export const POPULAR_BADGE_HIDDEN = true;
