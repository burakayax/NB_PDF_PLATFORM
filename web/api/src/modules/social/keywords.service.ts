/**
 * Gönderi etiketlerinin DAYANAĞI.
 *
 * Etiketler iki kaynaktan gelir:
 *
 *   1. SEO bankası — sitenin zaten hedeflediği gerçek arama terimleri
 *      (`/social-keywords.json`, build'de üretilir). Ücretsiz ve her zaman var.
 *   2. Canlı araştırma — yapay zekâ internete bakıp o konuda gerçekten
 *      kullanılan terimleri doğrular. İsteğe bağlı, ücretli.
 *
 * NEDEN ÖNBELLEK: Araştırma YAZI BAŞINA bir kez yapılır, gün başına değil.
 * Eski yazılar tekrar gündeme geldiğinde aynı arama yeniden ücretlendirilmez.
 */

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/file-log.js";
import type { FeedItem } from "./social.types.js";

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const RESEARCH_TIMEOUT_MS = 120_000;

/** Aramanın maliyet tavanı: istek başına en fazla bu kadar arama. */
const MAX_SEARCHES = 2;
/** Önbellekteki terimler bu süreden eskiyse yeniden araştırılır. */
const CACHE_TTL_DAYS = 120;
/** Dil başına taşınacak en fazla terim. */
const MAX_TERMS = 10;

export type KeywordSet = { tr: string[]; en: string[] };

const EMPTY: KeywordSet = { tr: [], en: [] };

// ─── SEO bankası ──────────────────────────────────────────────────────────────

type Bank = Record<string, { tr?: string[]; en?: string[] }>;

let bankCache: { at: number; data: Bank } | null = null;
/** Banka build'de üretiliyor; saatte bir tazelemek fazlasıyla yeterli. */
const BANK_TTL_MS = 60 * 60 * 1000;

async function loadKeywordBank(): Promise<Bank> {
  if (bankCache && Date.now() - bankCache.at < BANK_TTL_MS) return bankCache.data;

  const url = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/social-keywords.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Bank;
    bankCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    // Banka okunamazsa yazının kendi etiketlerine düşülür; otomasyon durmaz.
    logger.warn("social", `anahtar kelime bankası okunamadı: ${String(err)}`);
    bankCache = { at: Date.now(), data: {} };
    return {};
  }
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function dedupe(values: unknown[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    const key = value.toLocaleLowerCase("tr");
    if (!value || value.length > 60 || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? dedupe(parsed, MAX_TERMS) : [];
  } catch {
    return [];
  }
}

// ─── Canlı araştırma ──────────────────────────────────────────────────────────

const RESEARCH_SYSTEM = `Sen bir SEO ve sosyal medya araştırmacısısın.
Verilen konu için, sosyal medyada ve aramalarda GERÇEKTEN kullanılan terimleri
web aramasıyla doğrula.

Kurallar:
- Uydurma, kimsenin aramadığı terim yazma. Doğrulayamadığını listeleme.
- Marka adı uydurma.
- Türkçe terimler Türkçe, İngilizce terimler İngilizce olsun (çeviri değil, o
  dilde gerçekten aranan terim).
- Her terim en fazla 4 kelime.

Yanıtı YALNIZCA şu JSON biçiminde ver, başka hiçbir şey yazma:
{"tr":["...","..."],"en":["...","..."]}`;

/** Yanıttaki tüm metin bloklarını birleştirir (arama blokları atlanır). */
function collectText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type: string; text: string } => {
      const block = b as { type?: unknown; text?: unknown };
      return block.type === "text" && typeof block.text === "string";
    })
    .map((b) => b.text)
    .join("\n");
}

function parseResearchJson(raw: string): KeywordSet {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return EMPTY;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      tr: dedupe(Array.isArray(parsed.tr) ? parsed.tr : [], MAX_TERMS),
      en: dedupe(Array.isArray(parsed.en) ? parsed.en : [], MAX_TERMS),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Konuyu internette araştırır.
 *
 * Sunucu tarafı arama aracı uzun sürdüğünde API `pause_turn` ile durur; bu
 * durumda yanıtı olduğu gibi geri göndererek devam ettiriyoruz. Aksi hâlde
 * araştırma yarıda kalır ve sonuç boş döner.
 */
async function researchOnline(item: FeedItem): Promise<KeywordSet> {
  if (!env.ANTHROPIC_API_KEY) return EMPTY;

  const topic = [item.title, item.alt?.title].filter(Boolean).join(" / ");
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    {
      role: "user",
      content: `Konu: ${topic}
Özet: ${item.summary.slice(0, 400) || "(yok)"}
Sitenin bu konudaki hedef terimleri: ${[...(item.keywords?.tr ?? []), ...(item.keywords?.en ?? [])]
        .slice(0, 12)
        .join(", ") || "(yok)"}

Bu konuda sosyal medyada ve aramalarda gerçekten kullanılan terimleri araştır.
Türkçe için en fazla ${MAX_TERMS}, İngilizce için en fazla ${MAX_TERMS} terim döndür.`,
    },
  ];

  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch(CLAUDE_URL, {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: 900,
        system: RESEARCH_SYSTEM,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
      }),
      signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Araştırma reddedildi (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    }

    const json = (await res.json()) as { content?: unknown; stop_reason?: string };
    if (json.stop_reason === "pause_turn") {
      // Duraklatılan yanıt AYNEN geri gönderilir; başka türlü devam etmiyor.
      messages.push({ role: "assistant", content: json.content });
      continue;
    }
    return parseResearchJson(collectText(json.content));
  }

  return EMPTY;
}

// ─── Dışa açık ────────────────────────────────────────────────────────────────

/** Yazının SEO bankasındaki terimleri (araştırma yok, ücretsiz). */
export async function seoKeywordsFor(item: FeedItem): Promise<KeywordSet> {
  const bank = await loadKeywordBank();
  // Banka hem TR hem EN adresle anahtarlanmış; hangisi elimizdeyse o.
  const entry = bank[item.guid] ?? bank[item.link] ?? (item.alt ? bank[item.alt.link] : undefined);
  return {
    tr: dedupe([...(entry?.tr ?? []), ...item.categories], MAX_TERMS),
    en: dedupe([...(entry?.en ?? []), ...item.categories], MAX_TERMS),
  };
}

/**
 * Yazı için nihai terim kümesi: SEO bankası + (istenirse) canlı araştırma.
 * Araştırma sonucu yazı başına önbelleklenir.
 */
export async function keywordsFor(item: FeedItem, research: boolean): Promise<KeywordSet> {
  const seo = await seoKeywordsFor(item);
  if (!research || !env.ANTHROPIC_API_KEY) return seo;

  const cached = await prisma.socialKeywordCache.findUnique({ where: { guid: item.guid } });
  const fresh =
    cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

  if (cached && fresh && cached.source === "research") {
    return {
      tr: dedupe([...parseJsonArray(cached.trJson), ...seo.tr], MAX_TERMS),
      en: dedupe([...parseJsonArray(cached.enJson), ...seo.en], MAX_TERMS),
    };
  }

  let found = EMPTY;
  try {
    found = await researchOnline({ ...item, keywords: seo });
  } catch (err) {
    // Araştırma başarısızsa SEO bankasıyla devam — gönderi yine de üretilir.
    logger.warn("social", `anahtar kelime araştırması başarısız: ${String(err)}`);
    return seo;
  }

  if (found.tr.length === 0 && found.en.length === 0) return seo;

  const data = {
    trJson: JSON.stringify(found.tr),
    enJson: JSON.stringify(found.en),
    source: "research",
  };
  await prisma.socialKeywordCache.upsert({
    where: { guid: item.guid },
    create: { guid: item.guid, ...data },
    update: data,
  });
  logger.info("social", `anahtar kelime araştırıldı: ${item.title}`);

  // Araştırılan terimler önce gelir; SEO bankası tamamlayıcı olarak eklenir.
  return {
    tr: dedupe([...found.tr, ...seo.tr], MAX_TERMS),
    en: dedupe([...found.en, ...seo.en], MAX_TERMS),
  };
}
