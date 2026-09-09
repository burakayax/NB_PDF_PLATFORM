/**
 * RSS 2.0 beslemeleri (TR + EN).
 *
 * NEDEN: Sosyal medya otomasyonu (Zapier / Make / Buffer vb.) yeni yazıları
 * buradan okuyup paylaşır. Bu yüzden besleme yalnızca "geçerli" değil, otomasyon
 * araçlarının BEKLEDİĞİ alanları da içerecek şekilde üretilir:
 *
 *   • <pubDate>          → RFC 822 biçimi; sıralama ve "yeni mi" kararı buna bakar
 *   • <guid isPermaLink> → aynı yazının iki kez paylaşılmasını engelleyen kimlik
 *   • <description>      → düz metin özet; gönderi metni olarak kullanılır
 *   • <content:encoded>  → yazının tam gövdesi (HTML)
 *   • <category>         → etiketler; hashtag üretmek için kullanılabilir
 *   • <enclosure> ve <media:content> → yazının KENDİ markalı kapak görseli
 *
 * Kapak görselleri kendi build'imizde üretiliyor (generate-covers.mjs), yani
 * her yazının kendine ait bir görseli var. Otomasyonun dışarıdan stok fotoğraf
 * çekmesine gerek kalmaz; görsel alanı iki standart etiketten de okunabilir.
 *
 * Kaynak tek: blogContent.mjs. Yeni yazı eklendiğinde besleme kendiliğinden
 * güncellenir, elle bakım gerekmez.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BRAND } from "../src/seo/seoContent.mjs";
import { getBlogPostsSorted } from "../src/blog/blogContent.mjs";
import { localizedPath } from "../src/seo/enSlugs.mjs";

/** Beslemede taşınacak en fazla yazı sayısı. Okuyucular geçmişin tamamını istemez;
 *  otomasyon araçları da genelde ilk sayfaya bakar. */
const MAX_ITEMS = 30;

/** Yayıncı adı — <dc:creator> ve telif alanında görünür. */
const AUTHOR_NAME = BRAND;

const FEED_TEXT = {
  tr: {
    title: `${BRAND} Blog`,
    description:
      "PDF araçları, belge iş akışları ve yapay zekâ destekli belge okuma üzerine rehberler.",
    language: "tr-TR",
    path: "/rss.xml",
    blogPath: "/blog",
  },
  en: {
    title: `${BRAND} Blog`,
    description:
      "Guides on PDF tools, document workflows, and AI-assisted document reading.",
    language: "en-US",
    path: "/en/rss.xml",
    blogPath: "/blog",
  },
};

// ─── XML güvenliği ────────────────────────────────────────────────────────────

/** XML'de anlam taşıyan karakterleri kaçırır. Kaçırılmazsa tek bir "&" bile
 *  beslemeyi tümüyle geçersiz kılar ve okuyucu hiçbir yazıyı göremez. */
function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Gövde HTML'i CDATA içinde taşınır; içeride CDATA kapanışı geçerse bölünür. */
function cdata(value) {
  return `<![CDATA[${String(value ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

// ─── Tarih ────────────────────────────────────────────────────────────────────

const RFC822_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RFC822_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Aynı güne denk gelen yazılara gün içinde FARKLI saat verir.
 *
 * NEDEN: Yazı tarihleri gün hassasiyetinde tutuluyor ve aynı gün yayınlanan
 * yazılar (kimi günde 15 tane var) beslemede birebir aynı zaman damgasını
 * alıyordu. Otomasyon araçları "bunu daha önce işledim mi" kararını çoğu zaman
 * zaman damgasına bakarak verir; aynı damgayı taşıyan yazılardan bir kısmı
 * atlanabilir ya da tekrar paylaşılabilir.
 *
 * Saat, yazının kalıcı adresinden türetilir → her build'de AYNI sonucu verir
 * (rastgele olsaydı her yayında tüm yazılar "güncellenmiş" görünürdü).
 * Gün değişmez: en fazla 09:00–20:59 arasına dağıtılır.
 */
function stableTimeOfDay(slug) {
  const hex = createHash("sha1").update(String(slug ?? "")).digest("hex").slice(0, 6);
  const minutes = parseInt(hex, 16) % 720; // 12 saatlik pencere
  const hh = String(9 + Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * RSS 2.0 tarihleri RFC 822 biçiminde olmalıdır. ISO tarih ("2026-07-24")
 * doğrudan yazılırsa birçok okuyucu ve otomasyon aracı tarihi çözemez;
 * yazılar ya sırasız görünür ya da "tarihsiz" sayılıp atlanır.
 */
function toRfc822(dateInput, slug) {
  const time = stableTimeOfDay(slug);
  const d = dateInput instanceof Date ? dateInput : new Date(`${dateInput}T${time}Z`);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const day = RFC822_DAYS[safe.getUTCDay()];
  const date = String(safe.getUTCDate()).padStart(2, "0");
  const month = RFC822_MONTHS[safe.getUTCMonth()];
  const year = safe.getUTCFullYear();
  const hh = String(safe.getUTCHours()).padStart(2, "0");
  const mm = String(safe.getUTCMinutes()).padStart(2, "0");
  const ss = String(safe.getUTCSeconds()).padStart(2, "0");
  return `${day}, ${date} ${month} ${year} ${hh}:${mm}:${ss} GMT`;
}

// ─── Gövde → HTML ─────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Yazı bloklarını basit, okuyucu dostu HTML'e çevirir.
 *
 * Sınıf adı / satır içi stil KULLANILMAZ: besleme okuyucuları ve sosyal
 * önizlemeler stilleri atar, kalan çöp işaretleme metni bozar. Yalnızca anlam
 * taşıyan etiketler üretilir.
 */
function renderBlocksHtml(blocks, baseUrl, lang) {
  const out = [];
  for (const b of blocks ?? []) {
    switch (b.t) {
      case "lead":
      case "p":
        out.push(`<p>${escapeHtml(b.x)}</p>`);
        break;
      case "h2":
        out.push(`<h2>${escapeHtml(b.x)}</h2>`);
        break;
      case "h3":
        out.push(`<h3>${escapeHtml(b.x)}</h3>`);
        break;
      case "ul":
        out.push(`<ul>${(b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`);
        break;
      case "ol":
        out.push(`<ol>${(b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`);
        break;
      case "tip":
        out.push(`<blockquote><p>${escapeHtml(b.x)}</p></blockquote>`);
        break;
      case "steps":
        out.push(
          `<ol>${(b.items ?? [])
            .map((s) => `<li><strong>${escapeHtml(s.title)}</strong> — ${escapeHtml(s.x)}</li>`)
            .join("")}</ol>`,
        );
        break;
      case "cta": {
        // Araç bağlantısı beslemede de mutlak URL olmalı: okuyucular ve sosyal
        // paylaşımlar göreli adresi çözemez.
        const url = `${baseUrl}${localizedPath(b.tool ?? "/", lang)}`;
        out.push(
          `<p><strong>${escapeHtml(b.title ?? "")}</strong> — ${escapeHtml(b.x ?? "")} ` +
            `<a href="${escapeHtml(url)}">${escapeHtml(b.btn ?? url)}</a></p>`,
        );
        break;
      }
      default:
        if (typeof b.x === "string") out.push(`<p>${escapeHtml(b.x)}</p>`);
        break;
    }
  }
  return out.join("\n");
}

// ─── Besleme üretimi ──────────────────────────────────────────────────────────

/** Yazının beslemedeki tam zaman damgası (gün + türetilmiş saat). */
function itemTimestamp(post) {
  return new Date(`${post.date}T${stableTimeOfDay(post.slug)}Z`).getTime();
}

function buildFeed(lang, baseUrl, coverMap) {
  const text = FEED_TEXT[lang];
  // Gün içi saat eklendiği için sıralamayı TAM zaman damgasına göre yeniden
  // yapıyoruz: kaynak liste yalnızca güne göre sıralı, aynı günün yazıları
  // aksi halde beslemede karışık sırayla çıkardı.
  const posts = getBlogPostsSorted()
    .slice()
    .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
    .slice(0, MAX_ITEMS);
  const feedUrl = `${baseUrl}${text.path}`;
  const blogUrl = `${baseUrl}${localizedPath(text.blogPath, lang)}`;

  const items = posts
    .map((post) => {
      const copy = post[lang] ?? post.tr;
      if (!copy) return "";

      const url = `${baseUrl}${localizedPath(`/blog/${post.slug}`, lang)}`;
      // Kapak yoksa site paylaşım görseline düşülür: Instagram ve Pinterest
      // görselsiz gönderi kabul etmiyor, alan asla boş kalmamalı.
      const coverRel =
        coverMap?.get(`${lang}:${post.slug}`) ??
        (lang === "en" ? "/og-image-en.png" : "/og-image.png");
      const image = `${baseUrl}${coverRel}`;
      const tags = post.tags?.[lang] ?? post.tags?.tr ?? [];
      const summary = copy.excerpt || copy.description || "";
      const body = renderBlocksHtml(copy.blocks, baseUrl, lang);

      return `    <item>
      <title>${escapeXml(copy.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${toRfc822(post.date, post.slug)}</pubDate>
      <dc:creator>${escapeXml(AUTHOR_NAME)}</dc:creator>
      <description>${cdata(summary)}</description>
      <content:encoded>${cdata(body)}</content:encoded>
${tags.map((t) => `      <category>${escapeXml(t)}</category>`).join("\n")}
      <enclosure url="${escapeXml(image)}" type="image/png" length="0" />
      <media:content url="${escapeXml(image)}" medium="image" type="image/png" />
      <media:thumbnail url="${escapeXml(image)}" />
    </item>`;
    })
    .filter(Boolean)
    .join("\n");

  // En yeni yazının tarihi = beslemenin son güncellenme tarihi. Her üretimde
  // "şu an" yazmak, içerik değişmese bile okuyuculara "güncellendi" sinyali
  // gönderir ve otomasyonun aynı yazıyı tekrar paylaşmasına yol açabilir.
  const lastBuild = posts.length
    ? toRfc822(posts[0].updated || posts[0].date, posts[0].slug)
    : toRfc822(new Date(), "");
  const siteImage = `${baseUrl}${lang === "en" ? "/og-image-en.png" : "/og-image.png"}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(text.title)}</title>
    <link>${escapeXml(blogUrl)}</link>
    <description>${escapeXml(text.description)}</description>
    <language>${text.language}</language>
    <copyright>${escapeXml(`© ${new Date().getUTCFullYear()} ${AUTHOR_NAME}`)}</copyright>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <ttl>60</ttl>
    <generator>${escapeXml(BRAND)}</generator>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${escapeXml(siteImage)}</url>
      <title>${escapeXml(text.title)}</title>
      <link>${escapeXml(blogUrl)}</link>
    </image>
${items}
  </channel>
</rss>
`;
}

/**
 * Beslemeleri `public/` altına yazar.
 *
 * `blockIndexing` açıkken (yerel / önizleme ortamı) besleme YAZILMAZ: önizleme
 * adresi otomasyona bağlanırsa yayınlanmamış içerik paylaşılabilir.
 */
export function writeRssFeeds({ publicDir, baseUrl, blockIndexing, coverMap }) {
  if (blockIndexing) {
    return { written: [], skipped: true };
  }

  const written = [];
  for (const lang of ["tr", "en"]) {
    const xml = buildFeed(lang, baseUrl, coverMap);
    const target = join(publicDir, FEED_TEXT[lang].path.replace(/^\//, ""));
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, xml, "utf8");
    written.push(FEED_TEXT[lang].path);
  }
  return { written, skipped: false };
}

/** Prerender edilen sayfaların <head> bölümüne eklenecek besleme duyurusu.
 *  Bu satır olmadan tarayıcı eklentileri ve bazı okuyucular beslemeyi bulamaz. */
export function rssDiscoveryLink(baseUrl, lang) {
  const text = FEED_TEXT[lang] ?? FEED_TEXT.tr;
  return `<link rel="alternate" type="application/rss+xml" title="${escapeXml(text.title)}" href="${escapeXml(`${baseUrl}${text.path}`)}" />`;
}

export { FEED_TEXT as RSS_FEEDS };
