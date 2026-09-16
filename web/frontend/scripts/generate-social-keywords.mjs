/**
 * Sosyal medya otomasyonu için anahtar kelime bankası (`/social-keywords.json`).
 *
 * NEDEN: Gönderi etiketlerini yapay zekânın kendi belleğinden uydurmasını
 * istemiyoruz. Sitenin SEO'da zaten hedeflediği GERÇEK arama terimleri var —
 * her araç sayfasının `keywords` listesi ve her yazının kendi etiketleri.
 * Bunları tek bir dosyada toplayıp otomasyona veriyoruz; etiketler böylece
 * sitenin arama stratejisiyle aynı hizada kalıyor.
 *
 * NEDEN AYRI DOSYA (beslemeye gömmek yerine): RSS gerçek okuyucular ve
 * doğrulayıcılar tarafından da okunuyor; oraya kelime listesi doldurmak hem
 * standart dışı hem de spam görüntüsü verir.
 *
 * Anahtar = yazının TAM ADRESİ (RSS <guid> ile birebir aynı) → otomasyon
 * beslemeden okuduğu yazıyı doğrudan eşleştirebiliyor.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getBlogPostsSorted } from "../src/blog/blogContent.mjs";
import { TOOL_SEO } from "../src/seo/seoContent.mjs";
import { localizedPath } from "../src/seo/enSlugs.mjs";

/** Bir dilde, yinelenenleri ayıklayarak en fazla `max` terim. */
function dedupe(values, max) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    const key = value.toLocaleLowerCase("tr");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

/** `post.tool` ("/tools/crop-pdf") → o aracın SEO anahtar kelimeleri. */
function toolKeywords(toolPath, lang) {
  if (!toolPath) return [];
  const slug = String(toolPath).split("/").filter(Boolean).pop();
  return TOOL_SEO[slug]?.[lang]?.keywords ?? [];
}

const MAX_PER_LANG = 12;

export function writeSocialKeywords({ publicDir, baseUrl }) {
  /** @type {Record<string, { tr: string[], en: string[], tool: string | null }>} */
  const bank = {};

  for (const post of getBlogPostsSorted()) {
    for (const lang of ["tr", "en"]) {
      if (!post[lang]?.title) continue;

      const url = `${baseUrl}${localizedPath(`/blog/${post.slug}`, lang)}`;
      // Önce yazının kendi etiketleri (en dar, en alakalı), sonra aracın
      // genel arama terimleri.
      const terms = dedupe(
        [...(post.tags?.[lang] ?? []), ...toolKeywords(post.tool, lang)],
        MAX_PER_LANG,
      );

      bank[url] = {
        tr: lang === "tr" ? terms : dedupe([...(post.tags?.tr ?? []), ...toolKeywords(post.tool, "tr")], MAX_PER_LANG),
        en: lang === "en" ? terms : dedupe([...(post.tags?.en ?? []), ...toolKeywords(post.tool, "en")], MAX_PER_LANG),
        tool: post.tool ?? null,
      };
    }
  }

  const outPath = join(publicDir, "social-keywords.json");
  writeFileSync(outPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  return { path: "/social-keywords.json", count: Object.keys(bank).length };
}
