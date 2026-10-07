/**
 * Instagram carousel slaytları (1080×1350, 4:5).
 *
 * NEDEN: Tek görselli gönderiler çoğunlukla takipçilere gösterilir. Kaydırmalı,
 * adım adım içerik kaydetme ve kaydırma süresi üretir; takipçi olmayanlara erişimi
 * belirleyen sinyaller bunlardır. Slayt metinleri yazının KENDİ adımlarından alınır
 * (bkz. src/blog/carouselSlides.mjs) — uydurma içerik yok.
 *
 * NEDEN BUILD'DE VE GİT DIŞINDA: ~700 küçük JPEG depoyu şişirirdi. Dosyalar her
 * yayında `public/social/carousel/` altında üretilir (gitignore'da), Instagram
 * bunları sitenin kendi adresinden indirir. İmza değişmediyse yeniden çizilmez
 * (yerel geliştirmede hızlı).
 *
 * YAZI: Vektör yola çevrilir (generate-covers ile aynı yöntem) — sunucuda font
 * kurulu olması gerekmez, Türkçe karakterler sorunsuz çizilir.
 *
 * FORMAT: Instagram carousel'de tüm görseller ilk görselin oranına kırpılır; 4:5
 * akışta en çok alanı kaplayan orandır. Yalnızca JPEG (Instagram API şartı).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";

import { getBlogPostsSorted } from "../src/blog/blogContent.mjs";
import { CAROUSEL_COPY, extractContentSlides } from "../src/blog/carouselSlides.mjs";
import { localizedPath } from "../src/seo/enSlugs.mjs";
import { BG, FOOTER_COLOR, TITLE_COLOR, accentPair, loadFont, measure, textPath, wrap } from "./generate-covers.mjs";

const W = 1080;
const H = 1350;
const M = 84; // kenar boşluğu
const DESIGN_VERSION = 2;
/**
 * Hangi dillerde carousel üretilir? Otomasyon yalnızca besleme dilinde
 * (PRIMARY_FEED_LANG = "tr") paylaşıyor; İngilizce slaytlar kullanılmayacak, boşuna
 * build süresi harcatırdı. Besleme dili değişirse buraya da eklenmeli.
 */
const LANGS = (process.env.NB_CAROUSEL_LANGS ?? "tr").split(",").map((l) => l.trim()).filter(Boolean);
const BODY_COLOR = "#cbd5e1";

/** Kutuya sığana kadar punto düşürür; sığmazsa son satırı kısaltır. */
function fitBlock(font, text, maxWidth, maxLines, sizeMax, sizeMin) {
  for (let size = sizeMax; size >= sizeMin; size -= 2) {
    const lines = wrap(font, text, size, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  const lines = wrap(font, text, sizeMin, maxWidth).slice(0, maxLines);
  if (lines.length === maxLines) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s.,;:]+$/, "")}…`;
  return { size: sizeMin, lines };
}

function linesToPath(font, lines, size, x, firstBaseline, lineHeight) {
  return lines
    .map((l, i) => textPath(font, l, size, x, firstBaseline + i * lineHeight))
    .filter(Boolean)
    .join(" ");
}

/** İlerleme noktaları — mevcut slayt dolu. Sağ altta. */
function dots(count, active, c1) {
  const r = 9;
  const gap = 30;
  const total = (count - 1) * gap;
  let out = "";
  for (let i = 0; i < count; i++) {
    const cx = W - M - total + i * gap;
    out += `<circle cx="${cx}" cy="${H - M - 6}" r="${r}" fill="${i === active ? c1 : "#334155"}"/>`;
  }
  return out;
}

function defs(c1, c2) {
  return `<defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.08" r="0.8"><stop offset="0%" stop-color="${c1}" stop-opacity="0.34"/><stop offset="55%" stop-color="${c2}" stop-opacity="0.12"/><stop offset="100%" stop-color="${c2}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow2" cx="0.05" cy="0.98" r="0.6"><stop offset="0%" stop-color="${c2}" stop-opacity="0.22"/><stop offset="100%" stop-color="${c2}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <rect width="${W}" height="9" fill="url(#bar)"/>`;
}

function footer(regular, host, c1) {
  return `<circle cx="${M - 22}" cy="${H - M - 6}" r="6" fill="${c1}"/>
  <path d="${textPath(regular, host, 28, M, H - M + 4)}" fill="${FOOTER_COLOR}"/>`;
}

/** Sağa ok (kaydır ipucu) — yazı tipine bağlı olmasın diye çizilir. */
function arrow(x, y, color) {
  return `<path d="M${x} ${y} h40 m-16 -16 l16 16 l-16 16" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function coverSvg({ title, accent, bold, regular, host, total, copy }) {
  const [c1, c2] = accentPair(accent);
  const { size, lines } = fitBlock(bold, title, W - M * 2, 8, 96, 54);
  const lh = size * 1.22;
  const block = lines.length * lh;
  const first = H * 0.42 - block / 2 + size * 0.82;
  const label = copy.swipe;
  const labelSize = 34;
  const labelW = measure(bold, label, labelSize);
  const pillY = H - M - 150;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(c1, c2)}
  <path d="${linesToPath(bold, lines, size, M, first, lh)}" fill="${TITLE_COLOR}"/>
  <rect x="${M}" y="${pillY}" width="${labelW + 40 + 56 + 36}" height="76" rx="38" fill="url(#bar)"/>
  <path d="${textPath(bold, label, labelSize, M + 34, pillY + 50)}" fill="#ffffff"/>
  ${arrow(M + 34 + labelW + 20, pillY + 38, "#ffffff")}
  ${footer(regular, host, c1)}
  ${dots(total, 0, c1)}
</svg>`;
}

function stepSvg({ slide, index, count, accent, bold, regular, host, total, copy, kind }) {
  const [c1, c2] = accentPair(accent);
  const label = (kind === "steps" ? copy.stepLabel : copy.pointLabel)(index, count);
  const labelSize = 30;
  const labelW = measure(bold, label, labelSize);
  const t = fitBlock(bold, slide.title, W - M * 2, 3, 78, 50);
  const tlh = t.size * 1.22;
  const body = fitBlock(regular, slide.text, W - M * 2, 9, 46, 34);
  const blh = body.size * 1.42;
  // Rozet + başlık + gövde tek blok: logo ile alt şerit arasında dikeyde ortalanır
  // (kısa metinde alt yarı bomboş kalmasın).
  const blockH = 62 + 70 + t.lines.length * tlh + 64 + body.lines.length * blh;
  const chipY = Math.max(190, Math.round((H - blockH) / 2 - 40));
  const titleFirst = chipY + 62 + 70 + t.size * 0.82;
  const bodyFirst = titleFirst + (t.lines.length - 1) * tlh + 64 + body.size * 0.82;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(c1, c2)}
  <rect x="${M}" y="${chipY}" width="${labelW + 56}" height="62" rx="31" fill="url(#bar)"/>
  <path d="${textPath(bold, label, labelSize, M + 28, chipY + 42)}" fill="#ffffff"/>
  <path d="${linesToPath(bold, t.lines, t.size, M, titleFirst, tlh)}" fill="${TITLE_COLOR}"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyFirst, blh)}" fill="${BODY_COLOR}"/>
  ${footer(regular, host, c1)}
  ${dots(total, index, c1)}
</svg>`;
}

function ctaSvg({ accent, bold, regular, host, total, copy }) {
  const [c1, c2] = accentPair(accent);
  const t = fitBlock(bold, copy.ctaTitle, W - M * 2, 3, 92, 56);
  const tlh = t.size * 1.2;
  const titleFirst = 360 + t.size * 0.82;
  const body = fitBlock(regular, copy.ctaBody, W - M * 2, 5, 44, 34);
  const blh = body.size * 1.42;
  const bodyFirst = titleFirst + (t.lines.length - 1) * tlh + 60 + body.size * 0.82;
  const boxY = bodyFirst + (body.lines.length - 1) * blh + 90;
  const tryLabel = copy.ctaTry;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(c1, c2)}
  <path d="${linesToPath(bold, t.lines, t.size, M, titleFirst, tlh)}" fill="${TITLE_COLOR}"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyFirst, blh)}" fill="${BODY_COLOR}"/>
  <rect x="${M}" y="${boxY}" width="${W - M * 2}" height="190" rx="28" fill="#0f172a" stroke="url(#bar)" stroke-width="3"/>
  <path d="${textPath(regular, tryLabel, 32, M + 40, boxY + 66)}" fill="${FOOTER_COLOR}"/>
  <path d="${textPath(bold, host, 62, M + 40, boxY + 140)}" fill="${TITLE_COLOR}"/>
  ${footer(regular, host, c1)}
  ${dots(total, total - 1, c1)}
</svg>`;
}

/** Bir yazının slayt SVG listesi (kapak, içerik..., kapanış). Slayt çıkmıyorsa []. */
export function buildCarouselSvgs({ copyBlocks, title, accent, lang, host, bold, regular }) {
  const content = extractContentSlides(copyBlocks);
  if (content.length === 0) return { svgs: [], kind: "steps" };
  const copy = CAROUSEL_COPY[lang] ?? CAROUSEL_COPY.tr;
  const kind = copyBlocks.some((b) => b?.t === "steps" && Array.isArray(b.items) && b.items.length >= content.length)
    ? "steps"
    : "points";
  const total = content.length + 2;
  const svgs = [coverSvg({ title, accent, bold, regular, host, total, copy })];
  content.forEach((slide, i) => {
    svgs.push(stepSvg({ slide, index: i + 1, count: content.length, accent, bold, regular, host, total, copy, kind }));
  });
  svgs.push(ctaSvg({ accent, bold, regular, host, total, copy }));
  return { svgs, kind };
}

/**
 * Tüm yazılar için carousel üretir.
 * @returns {{ written: number, skipped: number, posts: number, path: string }}
 */
export async function writeCarousels({ frontendRoot, publicDir, baseUrl }) {
  const bold = loadFont(frontendRoot, "Roboto-Bold.ttf");
  const regular = loadFont(frontendRoot, "Roboto-Regular.ttf");
  const host = baseUrl.replace(/^https?:\/\//, "").replace(/^www\./, "");

  const root = join(publicDir, "social", "carousel");
  const manifestPath = join(root, "manifest.json");
  let previous = {};
  try {
    previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    /* ilk üretim */
  }

  const logoPath = join(publicDir, "logo.png");
  const logo = existsSync(logoPath) ? await sharp(logoPath).resize({ width: 200 }).png().toBuffer() : null;

  const manifest = {};
  let written = 0;
  let skipped = 0;

  for (const post of getBlogPostsSorted()) {
    for (const lang of LANGS) {
      const copy = post[lang];
      if (!copy?.title) continue;
      const slug = localizedPath(`/blog/${post.slug}`, lang).split("/").pop();
      const url = `${baseUrl}${localizedPath(`/blog/${post.slug}`, lang)}`;

      const { svgs } = buildCarouselSvgs({
        copyBlocks: copy.blocks,
        title: copy.title,
        accent: post.accent,
        lang,
        host,
        bold,
        regular,
      });
      if (svgs.length === 0) continue;

      const signature = createHash("sha1")
        .update(JSON.stringify([DESIGN_VERSION, svgs]))
        .digest("hex");
      const urls = svgs.map((_, i) => `${baseUrl}/social/carousel/${lang}/${slug}/${i + 1}.jpg`);
      manifest[url] = { signature, count: svgs.length, urls };

      const dir = join(root, lang, slug);
      const allThere = svgs.every((_, i) => existsSync(join(dir, `${i + 1}.jpg`)));
      if (previous[url]?.signature === signature && allThere) {
        skipped += svgs.length;
        continue;
      }

      mkdirSync(dir, { recursive: true });
      for (let i = 0; i < svgs.length; i++) {
        let img = sharp(Buffer.from(svgs[i]));
        if (logo) img = img.composite([{ input: logo, top: 44, left: M }]);
        await img.jpeg({ quality: 88 }).toFile(join(dir, `${i + 1}.jpg`));
        written++;
      }
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { written, skipped, posts: Object.keys(manifest).length, path: "/social/carousel/manifest.json" };
}
