/**
 * Fiyatların sitede gösterilip gösterilmeyeceği — TEK ANAHTAR.
 *
 * `true` iken ücretli planların, kredi paketlerinin ve ek kişi fiyatının rakamları hiçbir yerde
 * görünmez; yerine "Yakında" yazılır. Fiyat araştırması bitip fiyatlar belli olunca yalnız bunu
 * `false` yapmak yeter (fiyat verisi ve hesaplar yerinde durur, silinmedi).
 */
export const PRICES_HIDDEN = true;

/** Rakamın yerine gösterilecek metin. */
export function priceComingSoonLabel(tr: boolean): string {
  return tr ? "Yakında" : "Coming soon";
}

/**
 * Plus kartındaki "En Popüler" rozeti gizli: henüz satış yok, kanıtsız iddia olur.
 * İlk satışlar ve gerçek veri gelince `false` yapılır (şirket kurulunca yapılacaklar listesinde).
 */
export const POPULAR_BADGE_HIDDEN = true;
