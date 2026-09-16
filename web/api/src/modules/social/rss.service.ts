/**
 * Site beslemesini (rss.xml) okur ve paylaşılabilir içerik listesine çevirir.
 *
 * NEDEN ELDE AYRIŞTIRMA: Besleme bizim ürettiğimiz, şekli sabit bir dosya
 * (generate-rss.mjs). Tam bir XML kütüphanesi eklemek, yalnızca kendi
 * dosyamızı okumak için kalıcı bir bağımlılık ve güncelleme yükü demekti.
 * Yabancı beslemeler burada okunmuyor.
 */

import { env } from "../../config/env.js";
import type { FeedItem } from "./social.types.js";

const FETCH_TIMEOUT_MS = 20_000;
/** Beslemenin kabul edileceği en büyük boyut — bozuk/şişmiş yanıt belleği doldurmasın. */
const MAX_FEED_BYTES = 4_000_000;

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Etiketin ilk geçtiği yerdeki düz metin içeriği. */
function tagText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match) return "";
  return decodeEntities(match[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function allTagTexts(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  let m = re.exec(xml);
  while (m) {
    const value = decodeEntities(m[1] ?? "").trim();
    if (value) out.push(value);
    m = re.exec(xml);
  }
  return out;
}

/**
 * `<media:content>` etiketlerini en-boy oranına göre ayırır.
 * Besleme wide (1200×630), square (1080×1080) ve tall (1000×1500) yazar.
 */
function extractImages(itemXml: string): FeedItem["images"] {
  const images: FeedItem["images"] = {};
  const re = /<media:content\s([^>]*)\/?>/g;
  let m = re.exec(itemXml);
  while (m) {
    const attrs = m[1] ?? "";
    const url = /url="([^"]+)"/.exec(attrs)?.[1];
    const w = Number.parseInt(/width="(\d+)"/.exec(attrs)?.[1] ?? "0", 10);
    const h = Number.parseInt(/height="(\d+)"/.exec(attrs)?.[1] ?? "0", 10);
    if (url) {
      const ratio = w && h ? w / h : 0;
      if (ratio > 1.2) images.wide ??= decodeEntities(url);
      else if (ratio > 0.9) images.square ??= decodeEntities(url);
      else if (ratio > 0) images.tall ??= decodeEntities(url);
      else images.wide ??= decodeEntities(url);
    }
    m = re.exec(itemXml);
  }
  // Oran bilgisi yoksa <enclosure> yedeğe alınır.
  if (!images.wide) {
    const enc = /<enclosure\s[^>]*url="([^"]+)"/.exec(itemXml)?.[1];
    if (enc) images.wide = decodeEntities(enc);
  }
  return images;
}

/**
 * `<atom:link rel="alternate" hreflang="xx" href="...">` — yazının diğer
 * dildeki adresi. İki beslemedeki aynı yazıyı eşleştirmek için kullanılır.
 */
function extractAltLink(itemXml: string): { lang: "tr" | "en"; url: string } | null {
  const re = /<atom:link\s([^>]*)\/?>/g;
  let m = re.exec(itemXml);
  while (m) {
    const attrs = m[1] ?? "";
    if (/rel="alternate"/.test(attrs)) {
      const url = /href="([^"]+)"/.exec(attrs)?.[1];
      const lang = /hreflang="([^"]+)"/.exec(attrs)?.[1];
      if (url && (lang === "tr" || lang === "en")) {
        return { lang, url: decodeEntities(url) };
      }
    }
    m = re.exec(itemXml);
  }
  return null;
}

/** Beslemenin tam adresi. Site kökü FRONTEND_ORIGIN'den alınır. */
export function feedUrlFor(lang: "tr" | "en"): string {
  const base = env.FRONTEND_ORIGIN.replace(/\/$/, "");
  return lang === "en" ? `${base}/en/rss.xml` : `${base}/rss.xml`;
}

export async function fetchFeedItems(lang: "tr" | "en"): Promise<FeedItem[]> {
  const url = feedUrlFor(lang);
  const res = await fetch(url, {
    headers: { accept: "application/rss+xml, application/xml;q=0.9" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`RSS okunamadı (${res.status}): ${url}`);
  }
  const xml = await res.text();
  if (xml.length > MAX_FEED_BYTES) {
    throw new Error("RSS beklenenden büyük — okuma iptal edildi");
  }

  const items: FeedItem[] = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m = re.exec(xml);
  while (m) {
    const block = m[1] ?? "";
    const link = tagText(block, "link");
    const guid = tagText(block, "guid") || link;
    const title = tagText(block, "title");
    if (guid && title) {
      const pub = Date.parse(tagText(block, "pubDate"));
      items.push({
        guid,
        lang,
        title,
        summary: tagText(block, "description"),
        link,
        publishedAt: Number.isNaN(pub) ? 0 : pub,
        categories: allTagTexts(block, "category"),
        images: extractImages(block),
        altRef: extractAltLink(block),
      });
    }
    m = re.exec(xml);
  }

  return items.sort((a, b) => b.publishedAt - a.publishedAt);
}

/**
 * Her iki beslemeyi okur ve aynı yazının iki dildeki hâlini eşleştirir.
 *
 * Eşleştirme, beslemedeki `rel="alternate"` bağlantısı üzerinden yapılır —
 * sıraya veya tarihe güvenmez. Karşılığı olmayan yazı `alt` olmadan döner ve
 * tek dilli paylaşılır.
 *
 * @param primaryLang Gönderinin ana dili (sıralama ve seçim bu dile göre).
 */
export async function fetchPairedFeedItems(primaryLang: "tr" | "en"): Promise<FeedItem[]> {
  const otherLang = primaryLang === "tr" ? "en" : "tr";

  const [primary, other] = await Promise.all([
    fetchFeedItems(primaryLang),
    // Diğer besleme okunamazsa çift dillilik kaybolur ama otomasyon durmaz.
    fetchFeedItems(otherLang).catch(() => [] as FeedItem[]),
  ]);

  const byUrl = new Map(other.map((i) => [i.link, i]));

  return primary.map((item) => {
    const match = item.altRef ? byUrl.get(item.altRef.url) : undefined;
    if (!match) return item;
    return {
      ...item,
      alt: { lang: match.lang, title: match.title, summary: match.summary, link: match.link },
    };
  });
}
