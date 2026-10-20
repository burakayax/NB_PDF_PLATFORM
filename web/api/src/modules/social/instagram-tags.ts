/**
 * Instagram hashtag seçimi (@pdfplatformapp içerik kuralları, bölüm 7).
 *
 * KURALLAR
 * - Gönderi başına 3–5 etiket, hepsi Türkçe ve konuyla doğrudan ilgili.
 * - Genel etiketler yasak: #İpucu #PDF #Verimlilik #OfficeTips.
 * - #PDFPlatform her gönderide değil, ortalama 3 gönderide 1.
 * - Art arda iki gönderide aynı etiket seti kullanılmaz.
 * - Etiketler aşağıdaki konu havuzlarından seçilir; model uydurmaz (havuz elle yazıldı).
 *
 * Seçim SABİT'tir (yazının adresinden türer): aynı gönderi önizlemede de yayında da aynı etiketleri alır.
 */

export type TagPool = "cv" | "ogrenci" | "pdf" | "evrak";

const POOLS: Record<TagPool, string[]> = {
  cv: ["cvhazırlama", "özgeçmiş", "cvörneği", "işbaşvurusu", "işarıyorum", "kariyertavsiyeleri", "mülakat", "yenimezun"],
  ogrenci: ["üniversiteöğrencisi", "ödev", "tez", "öğrencihayatı", "kpss", "stajyer"],
  pdf: ["pdfküçültme", "pdfbirleştirme", "pdfdönüştürme", "wordtopdf", "belgetarama", "dijitalbelge"],
  evrak: ["edevlet", "resmievrak", "dilekçe", "başvuru"],
};

/** Yalnız o meslekle ilgili gönderide kullanılır. */
const PROFESSION_TAGS: [RegExp, string][] = [
  [/ogretmen/, "öğretmen"],
  [/satis-danismani/, "satışdanışmanı"],
  [/lojistik|depo/, "lojistik"],
  [/hemsire/, "hemşire"],
  [/muhasebe/, "muhasebe"],
];

/** Hiçbir koşulda kullanılmayan genel etiketler (küçük harf, `#` olmadan). */
export const BANNED_TAGS = new Set(["ipucu", "i̇pucu", "pdf", "verimlilik", "officetips"]);

const BRAND = "PDFPlatform";

const fold = (s: string): string =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Gönderinin konusuna göre ana ve ikinci havuz. `key` adres/slug, `text` başlık + özet. */
export function poolsFor(key: string, text = ""): { main: TagPool; side: TagPool } {
  const hay = fold(`${key} ${text}`);
  if (/(^|[^a-z])cv([^a-z]|$)|ozgecmis|is-basvuru|isbasvuru|mulakat|linkedin|ats-uyumlu|kariyer/.test(hay)) {
    return { main: "cv", side: "evrak" };
  }
  if (/odev|tez\b|staj|universite|akademik|makale|ogrenci|osym|kpss|ders/.test(hay)) {
    return { main: "ogrenci", side: "pdf" };
  }
  if (/edevlet|dilekce|resmi|vize|uyap|udf|basvuru|evrak|ihale|sozlesme|kira|belge-yukleme/.test(hay)) {
    return { main: "evrak", side: "pdf" };
  }
  return { main: "pdf", side: "evrak" };
}

/** "#a #b" metninden etiket adlarını (küçük harf, `#`siz) çıkarır. */
export function parseTags(text: string): string[] {
  return (text.match(/#[^\s#]+/gu) ?? []).map((t) => t.slice(1).toLocaleLowerCase("tr"));
}

/**
 * Etiket listesi (örn. ["#cvhazırlama", ...]).
 * @param key   yazının sabit anahtarı (adres) — seçimi sabitler
 * @param avoid bir önceki Instagram gönderisinin etiketleri; mümkün olduğunca tekrar edilmez
 */
export function instagramHashtags(opts: { key: string; text?: string; avoid?: string[] }): string[] {
  const { key, text = "", avoid = [] } = opts;
  const seed = hash(key);
  const { main, side } = poolsFor(key, text);
  const prev = new Set(avoid.map((t) => t.replace(/^#/, "").toLocaleLowerCase("tr")));
  const ok = (t: string) => !BANNED_TAGS.has(t.toLocaleLowerCase("tr"));

  const profession = PROFESSION_TAGS.find(([re]) => re.test(fold(key)))?.[1];
  const useBrand = seed % 3 === 0;
  // 4 ya da 5 etiket; marka seçildiyse onun yeri düşülür (üst sınır 5).
  const total = 4 + (seed % 2);
  const out: string[] = [];
  const add = (t: string | undefined) => {
    if (!t || !ok(t) || out.includes(t) || out.length >= total) return;
    out.push(t);
  };

  if (profession) add(profession);
  // Önce bir önceki gönderide KULLANILMAMIŞ etiketler; yetmezse tekrar serbest.
  const rotate = (pool: string[]) => {
    const start = seed % pool.length;
    return pool.map((_, i) => pool[(start + i) % pool.length] as string);
  };
  const mainList = rotate(POOLS[main]);
  const sideList = rotate(POOLS[side]);
  const fresh = (list: string[]) => list.filter((t) => !prev.has(t));
  const reserve = useBrand ? 1 : 0;
  const room = () => total - reserve - out.length;

  // İkinci havuz yalnız ANA havuz yetmediğinde (küçük havuzlarda) devreye girer: etiketler konuyla doğrudan ilgili kalsın.
  for (const t of fresh(mainList)) if (room() > 0) add(t);
  for (const t of fresh(sideList)) if (room() > 0) add(t);
  for (const t of mainList) if (room() > 0) add(t);
  for (const t of sideList) if (room() > 0) add(t);
  if (useBrand) add(BRAND);
  return out.slice(0, 5).map((t) => `#${t}`);
}
