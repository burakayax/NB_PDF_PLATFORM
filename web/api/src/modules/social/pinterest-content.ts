/**
 * Pinterest pin içeriği kuralları (görsel ve video pin için ortak).
 *
 * Alan sınırları Pinterest'in resmî OpenAPI tanımından alındı (v5.28): başlık 100, açıklama 800,
 * alt metin 500, bağlantı 2048 karakter.
 *
 * Saf işlevler: ağ/veritabanı yok, bu yüzden testlenebilir.
 */

import type { PinKeywords } from "./social.service.js";

export const PIN_LIMITS = { title: 100, description: 800, altText: 500, link: 2048 } as const;
/** Açıklamada en fazla bu kadar etiket kalır (etiket yığını sıralamaya yardım etmez). */
export const PIN_MAX_TAGS = 3;

const ACRONYMS = new Set(["pdf", "cv", "ocr", "ats", "jpg", "jpeg", "png", "udf", "ai", "html", "pptx", "docx", "xlsx", "qr"]);

/** Anahtar kelimeyi başlık biçimine sokar: ilk harf büyük, kısaltmalar (pdf, cv…) tam büyük. */
export function titleCaseKeyword(text: string, lang: "tr" | "en" = "tr"): string {
  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => {
      if (ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
      return i === 0 ? w.charAt(0).toLocaleUpperCase(locale) + w.slice(1) : w;
    })
    .join(" ");
}

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Metni sözcük sınırında keser; kesilirse "…" eklenmez (başlıkta noktalama istemiyoruz). */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/, "");
}

/**
 * Başlık: ana anahtar kelime BAŞTA olur. Başlık zaten onunla başlıyorsa dokunulmaz.
 * "PDF Sıkıştır: büyük dosyayı küçült" + "pdf sıkıştırma" → "PDF sıkıştırma – Büyük dosyayı küçült".
 */
export function buildPinTitle(title: string, keywords: PinKeywords | null, lang: "tr" | "en" = "tr"): string {
  const clean = title.replace(/\s+/g, " ").trim();
  const main = keywords?.main?.trim();
  if (!main) return cutAtWord(clean, PIN_LIMITS.title);
  if (fold(clean).startsWith(fold(main))) return cutAtWord(clean, PIN_LIMITS.title);
  // "Araç adı: açıklama" biçiminde ise açıklama kısmı kuyruk olur (araç adı zaten ana kelimeyle aynı konudur).
  const colon = clean.indexOf(":");
  const tailRaw = colon > 0 ? clean.slice(colon + 1).trim() : clean;
  const tail = tailRaw.charAt(0).toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US") + tailRaw.slice(1);
  const head = titleCaseKeyword(main, lang);
  return cutAtWord(`${head} – ${tail}`, PIN_LIMITS.title);
}

/** Açıklamadaki etiketleri en fazla `PIN_MAX_TAGS` ile sınırlar (fazlası silinir, metin korunur). */
export function limitTags(text: string, max = PIN_MAX_TAGS): string {
  let seen = 0;
  return text
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, (m, lead: string) => (++seen <= max ? m : lead))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

const CTA = { tr: "Ücretsiz dene: pdfplatform.app", en: "Try it free: pdfplatform.app" } as const;

/**
 * Açıklama: 2–3 doğal cümle (metni yazan modelden gelir), sonunda kısa çağrı, en fazla 3 etiket.
 * Çağrı zaten varsa tekrarlanmaz. 800 karakteri geçmez; çağrı her zaman korunur.
 */
export function buildPinDescription(body: string, lang: "tr" | "en" = "tr"): string {
  const cta = CTA[lang];
  const cleaned = limitTags(body.replace(/https?:\/\/\S+/g, "").trim());
  // Etiketler çağrıdan SONRA gelsin: çağrı cümle akışının sonu, etiketler en altta.
  const tagMatch = cleaned.match(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u);
  const tags = tagMatch ? tagMatch[0].trim() : "";
  let text = tagMatch ? cleaned.slice(0, tagMatch.index).trim() : cleaned;
  const hasCta = /pdfplatform\.app/i.test(text);
  const tail = `${hasCta ? "" : `\n\n${cta}`}${tags ? `\n\n${tags}` : ""}`;
  const room = PIN_LIMITS.description - tail.length;
  if (text.length > room) text = cutAtWord(text, Math.max(room, 0));
  return `${text}${tail}`.trim();
}

/** Alt metin: görselde ne olduğunu anlatan kısa cümle (başlık + ana kelime). */
export function buildPinAltText(title: string, keywords: PinKeywords | null, lang: "tr" | "en" = "tr"): string {
  const main = keywords?.main?.trim();
  const lead = lang === "tr" ? "PDF Platform kapak görseli:" : "PDF Platform cover image:";
  const text = main ? `${lead} ${title} (${main})` : `${lead} ${title}`;
  return cutAtWord(text, PIN_LIMITS.altText);
}
