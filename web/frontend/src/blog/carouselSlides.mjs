/**
 * INSTAGRAM CAROUSEL — slayt içeriğini blog yazısından çıkarır.
 *
 * NEDEN CAROUSEL: Tek görselli gönderi çoğunlukla zaten takipçilere gösterilir;
 * takipçi olmayanlara erişim paylaşım, kaydetme ve izleme/okuma süresi gibi
 * etkileşim sinyalleriyle gelir (Instagram'ın kendi sıralama açıklaması).
 * Kaydırmalı, adım adım içerik hem kaydetmeyi hem kaydırma süresini artırır.
 *
 * İÇERİK UYDURULMAZ: Slaytlardaki her cümle yazının KENDİ metninden alınır.
 * Önce yazının adım listesi (steps), yoksa başlık + ilk cümle çiftleri kullanılır.
 * Yeterli içerik çıkmazsa (2 slayttan az) carousel üretilmez; gönderi tek görselle
 * çıkmaya devam eder.
 */

/** Kapak + içerik + kapanış dahil Instagram carousel üst sınırı 10; biz daha kısa tutuyoruz. */
export const MAX_CONTENT_SLIDES = 5;
export const MIN_CONTENT_SLIDES = 2;

const SENTENCE_END = /(?<=[.!?…])\s+/;

/** Metni sade hâle getirir: çoklu boşluk, kalın işaretleri, sondaki iki nokta. */
function clean(text) {
  return String(text ?? "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** İlk cümleyi alır; uzunsa sözcük sınırında kısaltır. */
export function firstSentence(text, max = 150) {
  const t = clean(text);
  if (!t) return "";
  const first = t.split(SENTENCE_END)[0] ?? t;
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  // Önce anlam sınırında (virgül/noktalı virgül/iki nokta) kes: "…forma imza…" gibi
  // yarım kalmış bir ifade yerine tamamlanmış bir öbekle bitsin.
  const clause = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf("; "), cut.lastIndexOf(": "));
  if (clause > max * 0.5) return `${cut.slice(0, clause).replace(/[\s.,;:]+$/, "")}…`;
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, "");
  return `${base}…`;
}

/** Başlıktan sondaki iki noktayı ve tırnakları atar. */
function cleanTitle(title, max = 70) {
  const t = clean(title).replace(/[:：]+$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

const SKIP_HEADINGS = /sık sorulan|sorulan sorular|faq|frequently asked|sonuç|conclusion/i;

/**
 * @param {Array<{t:string, x?:string, items?: unknown[]}>} blocks Yazının blokları
 * @returns {Array<{ title: string, text: string }>} İçerik slaytları (kapak/kapanış hariç)
 */
export function extractContentSlides(blocks) {
  return extractCarousel(blocks).slides;
}

/** "1. Başlık" → "Başlık". */
const stripNumber = (t) => String(t ?? "").replace(/^\s*\d+[.)]\s*/, "");

/** Başlığın altındaki ilk paragrafın ilk cümlesi; araya başka blok girerse (liste, adım) null. */
function textUnderHeading(blocks, i) {
  const next = blocks.slice(i + 1).find((n) => n?.t === "p" || n?.t === "h2" || n?.t === "steps" || n?.t === "ul");
  return next?.t === "p" ? firstSentence(next.x, 210) : "";
}

/**
 * Slayt içeriği + etiket türü.
 *  kind "steps"  → "ADIM n/m" (gerçek adım listesi)
 *  kind "points" → "n/m"      (yazının numaralı bölümleri / ana başlıkları)
 *
 * ÖNCELİK: yazının numaralı bölümleri ("1. …", "2. …") yazının ANA fikridir; sondaki
 * küçük "adımlar" kutusu (ör. göndermeden önce son kontrol) çoğu zaman yalnızca bir
 * ekidir. Bu yüzden numaralı bölümler varsa onlar kullanılır.
 */
export function extractCarousel(blocks) {
  if (!Array.isArray(blocks)) return { slides: [], kind: "steps" };

  // 1) Numaralı bölümler: en az 3 tane "N. Başlık" h2.
  const numbered = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b?.t === "h2" && /^\s*\d+[.)]\s/.test(b.x ?? "") && !SKIP_HEADINGS.test(b.x ?? ""));
  if (numbered.length >= 3) {
    const slides = numbered
      .map(({ b, i }) => ({ title: cleanTitle(stripNumber(b.x)), text: textUnderHeading(blocks, i) }))
      .filter((s) => s.title && s.text)
      .slice(0, MAX_CONTENT_SLIDES);
    if (slides.length >= MIN_CONTENT_SLIDES) return { slides, kind: "points" };
  }

  // 2) Yazının adım listesi.
  const steps = blocks.find((b) => b?.t === "steps" && Array.isArray(b.items) && b.items.length >= MIN_CONTENT_SLIDES);
  if (steps) {
    const slides = steps.items
      .map((it) => ({ title: cleanTitle(it?.title), text: firstSentence(it?.x) }))
      .filter((s) => s.title && s.text)
      .slice(0, MAX_CONTENT_SLIDES);
    if (slides.length >= MIN_CONTENT_SLIDES) return { slides, kind: "steps" };
  }

  // 3) Başlık + hemen altındaki ilk paragrafın ilk cümlesi.
  const slides = [];
  for (let i = 0; i < blocks.length && slides.length < MAX_CONTENT_SLIDES; i++) {
    const b = blocks[i];
    if (b?.t !== "h2" || SKIP_HEADINGS.test(b.x ?? "")) continue;
    const text = textUnderHeading(blocks, i);
    const title = cleanTitle(b.x);
    if (title && text) slides.push({ title, text });
  }
  return slides.length >= MIN_CONTENT_SLIDES ? { slides, kind: "points" } : { slides: [], kind: "points" };
}

/** Slayt metinleri (kapanış slaytı dahil) — dile göre sabit ifadeler. */
export const CAROUSEL_COPY = {
  tr: {
    guide: "PDF REHBERİ",
    kicker: "REHBER",
    swipe: "Kaydırın",
    stepLabel: (n, total) => `ADIM ${n}/${total}`,
    pointLabel: (n, total) => `${n}/${total}`,
    ctaTitle: "İşinize yaradıysa kaydedin",
    ctaBody: "Lazım olduğunda kolayca ulaşın; aynı işi yapan meslektaşlarınıza da iletin.",
    ctaTry: "Ücretsiz deneyin",
  },
  en: {
    guide: "PDF GUIDE",
    kicker: "GUIDE",
    swipe: "Swipe",
    stepLabel: (n, total) => `STEP ${n}/${total}`,
    pointLabel: (n, total) => `${n}/${total}`,
    ctaTitle: "Save it for later",
    ctaBody: "Find it when you need it. Send it to someone who does this job.",
    ctaTry: "Try it free",
  },
};
