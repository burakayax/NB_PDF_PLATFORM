/**
 * Blog yazıları için markalı kapak görselleri (1200×630).
 *
 * NEDEN: Sosyal medya paylaşımlarında her yazının kendine ait, markalı bir
 * görseli olmalı. Alternatifler dış servisti (Cloudinary gibi) — hesap, kota ve
 * kalıcı bağımlılık demekti. Burada görseller kendi build'imizde üretiliyor:
 * ücretsiz, dış bağımlılıksız ve tasarımı tamamen bizde.
 *
 * YAZI NASIL ÇİZİLİYOR: Metin, SVG'ye "yazı" olarak değil VEKTÖR YOLU olarak
 * gömülüyor (fontkit ile glif yolları çıkarılıyor). Böylece görüntüyü üreten
 * makinede fontun kurulu olması gerekmiyor — sunucuda font eksikse yazının
 * kaybolması ya da başka bir fontla çıkması riski tamamen ortadan kalkıyor.
 * Türkçe karakterler de bu yolla sorunsuz çiziliyor.
 *
 * TEKRAR ÜRETİM: Girdiler (başlık, renk, sürüm) değişmediyse dosyaya yeniden
 * yazılmaz. Aksi halde her build'de 100+ görsel değişmiş görünür ve depo
 * gereksiz şişer.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";

import { getBlogPostsSorted } from "../src/blog/blogContent.mjs";
import { localizedPath } from "../src/seo/enSlugs.mjs";

// ─── Ölçüler ──────────────────────────────────────────────────────────────────

/**
 * Kapak boyutları. Her sosyal ağ farklı en-boy oranı bekler; tek bir yatay
 * görseli hepsine göndermek Instagram'da kırpılmaya, Pinterest'te ise akışta
 * neredeyse görünmemeye yol açar. Bu yüzden her yazı için üç kesim üretilir:
 *
 *   wide (1200×630)  → site paylaşım görseli, X, LinkedIn, Facebook
 *   square (1080×1080) → Instagram
 *   tall (1000×1500) → Pinterest (2:3, panoların standardı)
 *
 * Ölçüler `wide` tasarımından oranlanarak türetilir; punto ve kenar boşlukları
 * genişlikle birlikte ölçeklenir ki dar kesimde yazı taşmasın.
 */
const FORMATS = {
  wide: { key: "wide", w: 1200, h: 630, maxLines: 4 },
  square: { key: "square", w: 1080, h: 1080, maxLines: 6 },
  tall: { key: "tall", w: 1000, h: 1500, maxLines: 7 },
};

/** Ölçeklendirmenin referans genişliği (wide kesimi). */
const BASE_W = 1200;

const MARGIN = 72;
const LOGO_W = 210;
const TITLE_SIZE_MAX = 62;
const TITLE_SIZE_MIN = 34;
const TITLE_LINE_RATIO = 1.24;

/** Tasarım değişince bu numarayı artır → tüm kapaklar yeniden üretilir. */
const DESIGN_VERSION = 3;

/** Bir formatın ölçek katsayısı — punto ve boşluklar bununla çarpılır. */
function formatScale(fmt) {
  return fmt.w / BASE_W;
}

// ─── Renkler ──────────────────────────────────────────────────────────────────

/** Site arayüzündeki vurgu renkleriyle aynı çiftler (Tailwind 500 → 600). */
const ACCENTS = {
  fuchsia: ["#d946ef", "#7c3aed"],
  blue: ["#3b82f6", "#4f46e5"],
  violet: ["#8b5cf6", "#9333ea"],
  cyan: ["#06b6d4", "#2563eb"],
  emerald: ["#10b981", "#0d9488"],
  amber: ["#f59e0b", "#ea580c"],
  sky: ["#0ea5e9", "#2563eb"],
};
const BG = "#080d1a";
const TITLE_COLOR = "#ffffff";
const FOOTER_COLOR = "#94a3b8";

function accentPair(name) {
  return ACCENTS[name] ?? ACCENTS.fuchsia;
}

// ─── Yazıyı vektör yoluna çevirme ─────────────────────────────────────────────

function loadFont(frontendRoot, file) {
  return fontkit.create(readFileSync(join(frontendRoot, "public", "fonts", file)));
}

/** Ölçeklenmiş metin genişliği (piksel). */
function measure(font, text, size) {
  const run = font.layout(text);
  return (run.advanceWidth / font.unitsPerEm) * size;
}

/**
 * Metni SVG yol verisine çevirir. Dönen `d` tek bir <path> içinde kullanılır.
 *
 * Y ekseni ters çevrilir: font koordinatlarında yukarı pozitif, SVG'de aşağı
 * pozitiftir. Ölçek negatif verilerek harfler baş aşağı çizilmekten kurtulur.
 */
function textPath(font, text, size, x, baselineY) {
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);
  let penX = x;
  const parts = [];

  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    if (glyph.path && glyph.path.commands.length > 0) {
      const d = glyph.path
        .scale(scale, -scale)
        .translate(penX + (pos.xOffset ?? 0) * scale, baselineY - (pos.yOffset ?? 0) * scale)
        .toSVG();
      if (d) parts.push(d);
    }
    penX += (pos.xAdvance ?? 0) * scale;
  });

  return parts.join(" ");
}

/** Kelime bazlı satır kırma; sığmayan tek kelime kendi satırında kalır. */
function wrap(font, text, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(font, candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Başlık kutuya sığana kadar punto düşürülür; sığmazsa son satır kısaltılır. */
function fitTitle(font, title, maxWidth, maxLines, scale) {
  const sizeMax = Math.round(TITLE_SIZE_MAX * scale);
  const sizeMin = Math.round(TITLE_SIZE_MIN * scale);
  for (let size = sizeMax; size >= sizeMin; size -= 2) {
    const lines = wrap(font, title, size, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  const lines = wrap(font, title, sizeMin, maxWidth).slice(0, maxLines);
  if (lines.length === maxLines) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s.,;:]+$/, "")}…`;
  }
  return { size: sizeMin, lines };
}

// ─── Kapak SVG'si ─────────────────────────────────────────────────────────────

function buildSvg({ title, footer, accent, bold, regular, fmt }) {
  const [c1, c2] = accentPair(accent);
  const { w: W, h: H } = fmt;
  const scale = formatScale(fmt);
  const margin = Math.round(MARGIN * scale);
  const maxWidth = W - margin * 2;

  const { size, lines } = fitTitle(bold, title, maxWidth, fmt.maxLines, scale);
  const lineHeight = size * TITLE_LINE_RATIO;

  // Başlık bloğu dikeyde ortalanır ama logo ve alt satırdan uzak durur.
  // Dikey kesimlerde tam orta çok aşağıda kalıyor: Pinterest ve Instagram
  // akışında görselin üst yarısı okunur, başlık oraya çekilir.
  const blockHeight = lines.length * lineHeight;
  const anchor = fmt.key === "wide" ? 0.5 : 0.42;
  const firstBaseline = H * anchor - blockHeight / 2 + size * 0.82;

  const titlePaths = lines
    .map((line, i) => textPath(bold, line, size, margin, firstBaseline + i * lineHeight))
    .filter(Boolean)
    .join(" ");

  const footerPath = textPath(regular, footer, Math.round(26 * scale), margin, H - margin + 6);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.12" r="0.72">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.34"/>
      <stop offset="55%" stop-color="${c2}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.06" cy="0.95" r="0.55">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <rect width="${W}" height="${Math.max(7, Math.round(7 * scale))}" fill="url(#bar)"/>

  <path d="${titlePaths}" fill="${TITLE_COLOR}"/>
  <circle cx="${margin - Math.round(22 * scale)}" cy="${H - margin - 2}" r="${Math.round(5 * scale)}" fill="${c1}"/>
  <path d="${footerPath}" fill="${FOOTER_COLOR}"/>
</svg>`;
}

// ─── Üretim ───────────────────────────────────────────────────────────────────

function coverRelPath(slug, lang) {
  return lang === "en" ? `/en/covers/${slug}.png` : `/covers/${slug}.png`;
}

/**
 * Sosyal ağa özel kesimin yolu. `wide` geriye dönük uyum için eski yolda kalır
 * (RSS <enclosure> ve sayfa og:image oraya işaret ediyor); diğerleri alt klasörde.
 */
function socialCoverRelPath(slug, lang, format) {
  if (format === "wide") return coverRelPath(slug, lang);
  const base = lang === "en" ? "/en/covers" : "/covers";
  return `${base}/${format}/${slug}.png`;
}

/**
 * Tüm yazılar için kapakları üretir.
 * @returns {{ written: string[], skipped: number, map: Map<string,string> }}
 *   `map` anahtarı `"<lang>:<slug>"`, değeri site kökünden kapak yolu.
 */
export async function writeBlogCovers({ frontendRoot, publicDir, baseUrl }) {
  const bold = loadFont(frontendRoot, "Roboto-Bold.ttf");
  const regular = loadFont(frontendRoot, "Roboto-Regular.ttf");

  // Tek kayıt dosyası: hangi kapağın hangi girdilerle üretildiğini tutar.
  // Görsel başına ayrı damga dosyası bırakmak 100+ gereksiz dosya demekti.
  const manifestPath = join(publicDir, "covers", "manifest.json");
  let manifest = {};
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    /* ilk üretim */
  }

  const logoPath = join(publicDir, "logo.png");
  const logoFor = new Map();
  if (existsSync(logoPath)) {
    for (const fmt of Object.values(FORMATS)) {
      const width = Math.round(LOGO_W * formatScale(fmt));
      logoFor.set(fmt.key, await sharp(logoPath).resize({ width }).png().toBuffer());
    }
  }

  const host = baseUrl.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const written = [];
  const map = new Map();
  let skipped = 0;

  for (const post of getBlogPostsSorted()) {
    for (const lang of ["tr", "en"]) {
      const copy = post[lang];
      if (!copy?.title) continue;

      const slug = localizedPath(`/blog/${post.slug}`, lang).split("/").pop();
      map.set(`${lang}:${post.slug}`, coverRelPath(slug, lang));

      for (const fmt of Object.values(FORMATS)) {
        const rel = socialCoverRelPath(slug, lang, fmt.key);
        const outPath = join(publicDir, rel.replace(/^\//, ""));
        map.set(`${lang}:${post.slug}:${fmt.key}`, rel);

        // Girdi imzası: bunlar değişmediyse dosyaya dokunma.
        const signature = createHash("sha1")
          .update(JSON.stringify([DESIGN_VERSION, copy.title, post.accent ?? "", host, fmt.w, fmt.h]))
          .digest("hex");

        if (manifest[rel] === signature && existsSync(outPath)) {
          skipped++;
          continue;
        }

        const svg = buildSvg({
          title: copy.title,
          footer: host,
          accent: post.accent,
          bold,
          regular,
          fmt,
        });

        let image = sharp(Buffer.from(svg));
        const logo = logoFor.get(fmt.key);
        if (logo) {
          const scale = formatScale(fmt);
          image = sharp(await image.png().toBuffer()).composite([
            { input: logo, top: Math.round((MARGIN - 34) * scale), left: Math.round(MARGIN * scale) },
          ]);
        }

        mkdirSync(dirname(outPath), { recursive: true });
        await image.png({ compressionLevel: 9, palette: true }).toFile(outPath);
        manifest[rel] = signature;
        written.push(rel);
      }
    }
  }

  // Silinen yazıların kayıtları birikmesin.
  const live = new Set(map.values());
  for (const key of Object.keys(manifest)) {
    if (!live.has(key)) delete manifest[key];
  }
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { written, skipped, map };
}

export { coverRelPath, socialCoverRelPath, FORMATS as COVER_FORMATS };
