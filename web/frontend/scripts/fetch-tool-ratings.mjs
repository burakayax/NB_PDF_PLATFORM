/**
 * Araç puanlarını derleme anında çeker ve src/seo/toolRatings.mjs dosyasını
 * tazeler. prebuild/predev adımında, sayfa üretiminden ÖNCE çalışır.
 *
 * NEDEN DERLEME ANINDA: Yıldızlar hem Google'ın gördüğü statik HTML'e hem de
 * uygulamanın bastığı işaretlemeye giriyor. Statik HTML derleme anında
 * yazıldığı için puanın o an elde olması gerekiyor. Sonuç: yıldızlar canlı
 * değil, SÜRÜM bazlı tazelenir — site yeniden yayınlandığında güncellenir.
 *
 * HİÇBİR KOŞULDA DERLEMEYİ DÜŞÜRMEZ. Adres yoksa, ağ yoksa, sunucu hata
 * verirse ya da yanıt beklenen biçimde değilse: mevcut dosya OLDUĞU GİBİ
 * bırakılır ve uyarı basılır. Puanların tazelenememesi yayını engellememeli;
 * en kötü ihtimalle bir önceki sürümün puanları görünür.
 *
 * Adres sırası: TOOL_RATINGS_API → VITE_SAAS_API_BASE.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "src", "seo", "toolRatings.mjs");
const TIMEOUT_MS = 15000;

function uyar(mesaj) {
  // Uyarı, hata değil: çağıran adım başarıyla biter.
  console.warn(`[puanlar] ${mesaj} — mevcut toolRatings.mjs korunuyor.`);
}

function apiTabani() {
  const raw = process.env.TOOL_RATINGS_API || process.env.VITE_SAAS_API_BASE || "";
  return raw.trim().replace(/\/$/, "");
}

/** Yanıtı doğrular; tek bir bozuk satır bile olsa tamamını reddeder. */
function ozetleriAyikla(govde) {
  if (!govde || typeof govde !== "object" || !Array.isArray(govde.tools)) return null;
  const cikti = {};
  for (const t of govde.tools) {
    if (!t || typeof t !== "object") return null;
    const slug = t.toolSlug;
    const value = t.ratingValue;
    const count = t.ratingCount;
    if (typeof slug !== "string" || !/^[a-z0-9-]{2,64}$/.test(slug)) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) return null;
    // Sunucu zaten eşiği uyguluyor; yine de yayınlanabilir olmayanı almayalım.
    if (t.publishable === false) continue;
    cikti[slug] = { ratingValue: value, ratingCount: count };
  }
  return cikti;
}

function dosyaYaz(ratings, best, worst) {
  const mevcut = readFileSync(OUT, "utf8");
  // Başlıktaki açıklama bloğu korunur; yalnızca veri satırları değişir.
  const baslikSonu = mevcut.indexOf("export const TOOL_RATINGS");
  const baslik = baslikSonu > 0 ? mevcut.slice(0, baslikSonu) : "";
  const siralı = Object.keys(ratings).sort();
  const govde =
    siralı.length === 0
      ? "export const TOOL_RATINGS = {};\n"
      : "export const TOOL_RATINGS = {\n" +
        siralı
          .map(
            (s) =>
              `  ${JSON.stringify(s)}: { ratingValue: ${ratings[s].ratingValue}, ratingCount: ${ratings[s].ratingCount} },`,
          )
          .join("\n") +
        "\n};\n";
  writeFileSync(
    OUT,
    `${baslik}${govde}\nexport const TOOL_RATINGS_FETCHED_AT = ${JSON.stringify(new Date().toISOString())};\n\nexport const RATING_BEST = ${best};\nexport const RATING_WORST = ${worst};\n`,
    "utf8",
  );
}

async function main() {
  const base = apiTabani();
  if (!base) {
    uyar("API adresi tanımlı değil (TOOL_RATINGS_API / VITE_SAAS_API_BASE)");
    return;
  }

  let govde;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/tool-rating`, { signal: ac.signal });
      if (!res.ok) {
        uyar(`sunucu ${res.status} döndü`);
        return;
      }
      govde = await res.json();
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    uyar(`puanlar çekilemedi (${e instanceof Error ? e.message : "bilinmeyen hata"})`);
    return;
  }

  const ratings = ozetleriAyikla(govde);
  if (!ratings) {
    uyar("yanıt beklenen biçimde değil");
    return;
  }

  const best = Number.isFinite(govde.bestRating) ? govde.bestRating : 5;
  const worst = Number.isFinite(govde.worstRating) ? govde.worstRating : 1;
  dosyaYaz(ratings, best, worst);

  const adet = Object.keys(ratings).length;
  console.log(
    adet === 0
      ? "[puanlar] Henüz yayınlanabilir puanı olan araç yok — hiçbir sayfaya yıldız basılmayacak."
      : `[puanlar] ${adet} aracın yıldızı işaretlemeye yazıldı.`,
  );
}

await main();
