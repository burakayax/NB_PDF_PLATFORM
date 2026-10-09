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
import { CAROUSEL_COPY, extractCarousel } from "../src/blog/carouselSlides.mjs";
import { localizedPath } from "../src/seo/enSlugs.mjs";
import { loadFont, measure, textPath, wrap } from "./generate-covers.mjs";

const W = 1080;
const H = 1350;
const M = 84; // kenar boşluğu
const DESIGN_VERSION = 4;
/**
 * Hangi dillerde carousel üretilir? Otomasyon yalnızca besleme dilinde
 * (PRIMARY_FEED_LANG = "tr") paylaşıyor; İngilizce slaytlar kullanılmayacak, boşuna
 * build süresi harcatırdı. Besleme dili değişirse buraya da eklenmeli.
 */
const LANGS = (process.env.NB_CAROUSEL_LANGS ?? "tr").split(",").map((l) => l.trim()).filter(Boolean);
/**
 * KURUMSAL TASARIM (v3): beyaz zemin, lacivert + marka mavisi, düz çizgiler.
 * Gradyan / parıltı / emoji yok — "yapay zekâ üretimi" izlenimi vermesin.
 * Reels (generate-reels.mjs) bu slaytları beyaz tuvale yerleştirir; BG_WHITE ortak.
 */
export const SLIDE_BG = "#ffffff";
const NAVY = "#0B2A57";
const BLUE = "#1060B0";
const SLATE = "#475569";
const MUTED = "#64748b";
const LINE = "#D9E2EC";

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

/** Harf aralıklı büyük harf etiketi (yola çevrilmiş). */
function spaced(font, text, size, x, y, gap) {
  let pen = x;
  const parts = [];
  for (const ch of text) {
    parts.push(textPath(font, ch, size, pen, y));
    pen += measure(font, ch, size) + gap;
  }
  return { d: parts.join(" "), width: pen - x - gap };
}

const two = (n) => String(n).padStart(2, "0");

/** Ortak çerçeve: üst mavi şerit, sağda rehber etiketi, ince çizgiler, alt bilgi + sayfa no. */
function frame({ bold, regular, host, index, total, copy }) {
  const lab = spaced(bold, copy.guide, 22, 0, 0, 4);
  const labX = W - M - lab.width;
  const pg = `${two(index + 1)} / ${two(total)}`;
  const pgW = measure(bold, pg, 26);
  return `<rect width="${W}" height="${H}" fill="${SLIDE_BG}"/>
  <rect width="${W}" height="10" fill="${BLUE}"/>
  <path d="${spaced(bold, copy.guide, 22, labX, 98, 4).d}" fill="${MUTED}"/>
  <rect x="${M}" y="132" width="${W - M * 2}" height="2" fill="${LINE}"/>
  <rect x="${M}" y="1232" width="${W - M * 2}" height="2" fill="${LINE}"/>
  <path d="${textPath(regular, host, 26, M, 1290)}" fill="${MUTED}"/>
  <path d="${textPath(bold, pg, 26, W - M - pgW, 1290)}" fill="${NAVY}"/>`;
}

const open = () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;

function coverSvg({ title, bold, regular, host, total, copy }) {
  const { size, lines } = fitBlock(bold, title, W - M * 2, 7, 88, 54);
  const lh = size * 1.14;
  const first = 400 + size * 0.85;
  const kicker = spaced(bold, copy.kicker, 24, M, 290, 4);
  const swipe = copy.swipe;
  const swW = measure(bold, swipe, 30);
  const y = 1110;
  return `${open()}
  ${frame({ bold, regular, host, index: 0, total, copy })}
  <rect x="${M}" y="236" width="64" height="7" fill="${BLUE}"/>
  <path d="${kicker.d}" fill="${BLUE}"/>
  <path d="${linesToPath(bold, lines, size, M, first, lh)}" fill="${NAVY}"/>
  <rect x="${M}" y="${y - 20}" width="${W - M * 2}" height="2" fill="${LINE}"/>
  <path d="${textPath(bold, swipe, 30, M, y + 54)}" fill="${NAVY}"/>
  <path d="M${M + swW + 22} ${y + 40} h44 m-16 -16 l16 16 l-16 16" fill="none" stroke="${BLUE}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

function stepSvg({ slide, index, count, bold, regular, host, total, copy, kind }) {
  const label = (kind === "steps" ? copy.stepLabel : copy.pointLabel)(index, count).toUpperCase();
  const t = fitBlock(bold, slide.title, W - M * 2, 3, 70, 46);
  const tlh = t.size * 1.16;
  const body = fitBlock(regular, slide.text, W - M * 2, 9, 44, 32);
  const blh = body.size * 1.42;
  const blockH = 60 + 40 + t.lines.length * tlh + 50 + body.lines.length * blh;
  const top = Math.max(190, Math.round(133 + (1232 - 133 - blockH) / 2 - 30));
  const lab = spaced(bold, label, 24, M, top + 54, 4);
  const titleFirst = top + 54 + 40 + t.size * 0.85;
  const bodyFirst = titleFirst + (t.lines.length - 1) * tlh + 50 + body.size * 0.85;
  return `${open()}
  ${frame({ bold, regular, host, index, total, copy })}
  <rect x="${M}" y="${top}" width="64" height="7" fill="${BLUE}"/>
  <path d="${lab.d}" fill="${BLUE}"/>
  <path d="${linesToPath(bold, t.lines, t.size, M, titleFirst, tlh)}" fill="${NAVY}"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyFirst, blh)}" fill="${SLATE}"/>
</svg>`;
}

function ctaSvg({ bold, regular, host, total, copy }) {
  const t = fitBlock(bold, copy.ctaTitle, W - M * 2, 3, 84, 56);
  const tlh = t.size * 1.14;
  const titleFirst = 440 + t.size * 0.85;
  const body = fitBlock(regular, copy.ctaBody, W - M * 2 - 40, 4, 38, 30);
  const blh = body.size * 1.42;
  const bodyFirst = titleFirst + (t.lines.length - 1) * tlh + 60 + body.size * 0.85;
  const boxY = Math.round(bodyFirst + (body.lines.length - 1) * blh + 70);
  return `${open()}
  ${frame({ bold, regular, host, index: total - 1, total, copy })}
  <rect x="${M}" y="346" width="64" height="7" fill="${BLUE}"/>
  <path d="${linesToPath(bold, t.lines, t.size, M, titleFirst + 20, tlh)}" fill="${NAVY}"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyFirst + 20, blh)}" fill="${SLATE}"/>
  <rect x="${M}" y="${boxY + 20}" width="${W - M * 2}" height="210" rx="14" fill="#EEF4FB" stroke="${BLUE}" stroke-width="2.5"/>
  <path d="${textPath(regular, copy.ctaTry, 30, M + 44, boxY + 94)}" fill="${MUTED}"/>
  <path d="${textPath(bold, host, 68, M + 44, boxY + 176)}" fill="${NAVY}"/>
</svg>`;
}

/** Bir yazının slayt SVG listesi (kapak, içerik..., kapanış). Slayt çıkmıyorsa []. */
export function buildCarouselSvgs({ copyBlocks, title, lang, host, bold, regular }) {
  const { slides: content, kind } = extractCarousel(copyBlocks);
  if (content.length === 0) return { svgs: [], kind: "steps" };
  const copy = CAROUSEL_COPY[lang] ?? CAROUSEL_COPY.tr;
  const total = content.length + 2;
  const svgs = [coverSvg({ title, bold, regular, host, total, copy })];
  content.forEach((slide, i) => {
    svgs.push(stepSvg({ slide, index: i + 1, count: content.length, bold, regular, host, total, copy, kind }));
  });
  svgs.push(ctaSvg({ bold, regular, host, total, copy }));
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
  const logo = existsSync(logoPath) ? await sharp(logoPath).resize({ width: 170 }).png().toBuffer() : null;

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
        if (logo) img = img.composite([{ input: logo, top: 34, left: M }]);
        await img.jpeg({ quality: 88 }).toFile(join(dir, `${i + 1}.jpg`));
        written++;
      }
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { written, skipped, posts: Object.keys(manifest).length, path: "/social/carousel/manifest.json" };
}
