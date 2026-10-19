/**
 * Blog kapakları (site paylaşım görseli, kare, dikey) ve kaydırmalı gönderinin İLK SLAYDI.
 *
 * Her yazı KENDİNE ÖZGÜ görünür: sekiz düzenden biri (`cover-engine.mjs`, yan yana gelmesin diye atanır),
 * konusuna özel çizim (`heroes.mjs`, slug'dan seçilir) ve yazının kendi vurgu rengi (`accent`).
 *
 * BAŞLIK KURALI: "Başlık: alt başlık" ya da "Soru? alt başlık" biçimindeki başlık otomatik bölünür; alt başlık
 * renkli bantta görünür. Kapak yazının kendi başlığından üretilir; içerik uydurulmaz. Logo her zaman SOL ÜSTTE.
 */

import { assignLayouts, renderCover } from "./cover-engine.mjs";
import { heroFor } from "./heroes.mjs";

/** "CV Nasıl Hazırlanır? Adım Adım Rehber" → { head: "CV Nasıl Hazırlanır?", tag: "Adım Adım Rehber" } */
export function splitTitle(title) {
  const t = String(title).trim();
  const m = /^(.{6,}?)(:|\?|\s[-–—]\s)\s*(.{4,})$/.exec(t);
  if (!m) return { head: t, tag: "" };
  const [, before, sep, after] = m;
  if (after.length > 64) return { head: t, tag: "" };
  return { head: sep === "?" ? `${before}?` : before, tag: after };
}

const STOP_TAIL = new Set(["olarak", "ve", "ile", "için", "ya", "da", "ne", "bir", "bu", "gibi", "mi", "mı"]);
const realWords = (t) => String(t).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));

/**
 * Kaydırmalı gönderinin ilk slaydı: tek, merak uyandıran başlık, EN FAZLA 8 kelime (Instagram içerik kuralları).
 * Anlam bozulmasın diye kırpmadan önce doğal sınırlar denenir: soruyla biten cümle → ilk cümle → iki nokta/soru
 * işaretinden önceki kısım (alt başlık sığıyorsa o da kalır). Hiçbiri yoksa ilk 8 kelime alınır, sondaki bağlaç atılır.
 */
export function fitHook(title, max = 8) {
  const t = String(title).trim();
  if (realWords(t).length <= max) return t;
  const sentences = t.split(/(?<=[.?!])\s+/).filter(Boolean);
  const fits = sentences.filter((x) => realWords(x).length <= max);
  const question = fits.find((x) => x.endsWith("?"));
  if (question) return question;
  if (sentences.length > 1 && fits[0]) return fits[0].replace(/[.]$/, "");
  const { head, tag } = splitTitle(t);
  if (tag) {
    const both = `${head} ${tag}`;
    if (realWords(both).length <= max) return t;
    if (realWords(head).length <= max) return head;
  }
  const words = t.split(/\s+/);
  const kept = [];
  let n = 0;
  for (const w of words) {
    if (/[\p{L}\p{N}]/u.test(w)) n++;
    if (n > max) break;
    kept.push(w);
  }
  while (kept.length > 1 && STOP_TAIL.has(kept[kept.length - 1].toLocaleLowerCase("tr").replace(/[^\p{L}]/gu, ""))) kept.pop();
  return kept.join(" ");
}

/**
 * Yazılardan düzen haritası: slug → düzen. `posts` EN YENİDEN eskiye sıralı gelir; atama eskiden yeniye yapılır,
 * böylece yeni yazı eklenince eski yazıların düzeni değişmez.
 */
export function blogLayoutMap(posts) {
  return assignLayouts(posts.map((p) => p.slug).reverse());
}

/** Bir yazının kapağı. `post`: { slug, accent, tool }. */
export function renderBlogCover({ title, post, layout, w, h, key, cta, format = "png", publicDir, quality = 88 }) {
  const { head, tag } = splitTitle(title);
  return renderCover({
    layout,
    title: head,
    tag,
    hero: heroFor(post.slug, post.tool),
    accent: post.accent,
    w,
    h,
    key,
    cta,
    format,
    publicDir,
    quality,
  });
}
