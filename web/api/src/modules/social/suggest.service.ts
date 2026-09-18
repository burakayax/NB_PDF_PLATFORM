/**
 * Google otomatik tamamlama — insanların arama kutusuna GERÇEKTEN yazdığı
 * ifadeler.
 *
 * NEDEN BU KAYNAK: Ücretsiz keyword sitelerini (Ubersuggest, Keyword Tool…)
 * programla okumak üç sebeple sürdürülemez: kullanım şartları buna izin
 * vermiyor, robot koruması birkaç istekten sonra engelliyor, ve ücretsiz
 * sürümler gerçek rakamı zaten gizliyor. Otomatik tamamlama ise Google'ın
 * arama kutusunu besleyen açık uç: anahtar istemiyor, ücretsiz, ve dönen
 * liste POPÜLERLİK SIRASINDA geliyor.
 *
 * NE VERİR, NE VERMEZ: Kesin arama hacmi vermez. "Hangi ifade daha çok
 * yazılıyor" sıralamasını verir — etiket ve metin seçimi için gereken de bu.
 * Gerçek tıklama sayısı için Search Console kullanılıyor ([[gsc.service]]).
 */

import { logger } from "../../lib/file-log.js";

const SUGGEST_URL = "https://suggestqueries.google.com/complete/search";
const TIMEOUT_MS = 8_000;

/** Tek bir tohum için en fazla kaç öneri alınır. */
const PER_SEED = 10;
/** Bir çağrıda en fazla kaç tohum sorgulanır (nezaket sınırı). */
const MAX_SEEDS = 6;

/**
 * Tek bir tohum kelimenin önerileri.
 *
 * Google burada JSON döndürüyor ama içerik türünü metin olarak işaretliyor;
 * bu yüzden gövde elle çözümleniyor. Biçim: [sorgu, [öneriler], …]
 */
async function suggestOne(seed: string, lang: "tr" | "en"): Promise<string[]> {
  const params = new URLSearchParams({
    client: "firefox", // sade JSON döndüren istemci kipi
    hl: lang,
    gl: lang === "tr" ? "tr" : "us",
    // Bu uç varsayılan olarak UTF-8 DÖNDÜRMÜYOR. İstenmezse Türkçe harfler
    // bozuk geliyor ("programı" → "program?"), etiketler de onunla birlikte.
    ie: "utf-8",
    oe: "utf-8",
    q: seed,
  });

  const res = await fetch(`${SUGGEST_URL}?${params.toString()}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const parsed: unknown = JSON.parse(await res.text());
  if (!Array.isArray(parsed) || !Array.isArray(parsed[1])) return [];
  return (parsed[1] as unknown[])
    .filter((v): v is string => typeof v === "string")
    .slice(0, PER_SEED);
}

/**
 * Tohum ifadeler için önerileri toplar.
 *
 * SIRA KORUNUR: Dönen dizide önce ilk tohumun en popüler önerileri gelir.
 * Çağıran taraf baştan kestiğinde en güçlü ifadeleri almış olur.
 *
 * HATA YUTULUR: Bu kaynak "olursa iyi olur" niteliğinde. Google yanıt vermezse
 * ya da biçimi değiştirirse otomasyon durmaz, yalnızca bu katkı boş kalır.
 */
export async function suggestTerms(seeds: string[], lang: "tr" | "en"): Promise<string[]> {
  const picked = seeds
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 60)
    .slice(0, MAX_SEEDS);
  if (picked.length === 0) return [];

  // Tohumlar birbirinden bağımsız; sırayla beklemek gereksiz gecikme olurdu.
  const results = await Promise.all(
    picked.map(async (seed) => {
      try {
        return await suggestOne(seed, lang);
      } catch (err) {
        logger.warn("social", `otomatik tamamlama alınamadı (${seed}): ${String(err)}`);
        return [];
      }
    }),
  );

  // Tohum sırasını koruyarak düzleştir.
  return results.flat();
}
