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
