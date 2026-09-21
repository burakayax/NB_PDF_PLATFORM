/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  OTOMATİK ÜRETİLİR — ELLE DÜZENLEMEYİN
 *  Kaynak: scripts/fetch-tool-ratings.mjs (prebuild/predev adımında çalışır)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Araç sayfalarının yıldızları (aggregateRating) buradan gelir. İki taraf da
 *  AYNI dosyayı okur:
 *    - scripts/generate-seo-files.mjs → Google'ın gördüğü statik HTML
 *    - src/seo/jsonLd.ts              → uygulama açıldığında basılan işaretleme
 *
 *  İKİSİNİN DE OKUMASI ŞART: Uygulama, yeniden basacağı türdeki hazır
 *  işaretleme bloğunu siliyor. Yıldız yalnızca statik HTML'de olsaydı, sayfa
 *  açıldığı anda o blok silinir ve yıldızlar kaybolurdu.
 *
 *  Yalnızca eşiği geçen araçlar burada yer alır; eşiği geçmeyenin ortalaması
 *  yayınlanmaz. Puan yoksa nesne boştur ve hiçbir sayfaya yıldız basılmaz —
 *  uydurma ortalama ÜRETİLMEZ.
 */

export const TOOL_RATINGS = {};

export const TOOL_RATINGS_FETCHED_AT = "2026-09-21T19:35:49.097Z";

export const RATING_BEST = 5;
export const RATING_WORST = 1;
