/**
 * Google Search Console — sitenin KENDİ gerçek arama verisi.
 *
 * NEDEN EN DEĞERLİ KAYNAK: Buradaki rakamlar tahmin değil ölçüm. Hangi aramada
 * kaç kez görünüldüğü, kaç tıklama alındığı ve sıranın kaç olduğu yazılı.
 * Yapay zekânın "bu terim aranıyor olmalı" demesiyle, Google'ın "bu terimde
 * 340 kez göründünüz" demesi aynı şey değil.
 *
 * İKİ SORU SORULUYOR:
 *   1. Bu yazı hangi aramalarla bulundu? (sayfa bazlı — en dar, en alakalı)
 *   2. Site genelinde bu konuyla ilgili hangi aramalar var? (yeni yazıda
 *      sayfa bazlı veri HENÜZ OLMAZ; boşluğu bu kapatıyor)
 *
 * KİMLİK DOĞRULAMA: Servis hesabı anahtarıyla imzalanan JWT, Google'ın belge-
 * lediği yoldan erişim anahtarına çevriliyor. Ek paket kurmamak için imza
 * Node'un kendi kriptografi modülüyle atılıyor — `googleapis` paketi yalnızca
 * bu iş için projeye girmeye değmez.
 *
 * YETKİ: Salt okunur. Bu servis Search Console'da hiçbir şey değiştirmez.
 */

import { createSign } from "node:crypto";

import { env } from "../../config/env.js";
import { logger } from "../../lib/file-log.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API_ROOT = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const TIMEOUT_MS = 20_000;

/** Kaç günlük veriye bakılır. */
const WINDOW_DAYS = 90;
/**
 * Search Console verisi birkaç gün gecikmeli gelir; en son günler eksik olur.
 * Bitişi geri çekmek, yarım günlerin sıralamayı bozmasını önler.
 */
const LAG_DAYS = 3;

/**
 * Google'dan kaç satır ÇEKİLİR.
 *
 * Yüksek tutmak şart: API sıralamayı tıklamaya göre yapıyor ve yeni bir sitede
 * aramaların çoğu 0 tıklamada eşit. Eşitlik bozulunca sıra alfabetik oluyor —
 * dar çekilirse "en çok tıklanan 25 arama" değil, "alfabenin başındaki 25
 * arama" gelir. Geniş çekip sıralamayı kendimiz yapıyoruz.
 */
const FETCH_LIMIT = 500;

/** Çağırana kaç satır döndürülür (sıralandıktan sonra). */
const ROW_LIMIT = 25;

/**
 * Önem sırası: önce tıklama, sonra gösterim, sonra sıra (küçük olan iyi).
 *
 * Gösterimin ikinci ölçüt olması bilinçli: tıklama almayan ama çok görünen
 * arama, "insanlar sizi burada görüyor ama tıklamıyor" demektir — sosyal
 * medyada anlatılacak şey tam olarak odur.
 */
function byValue(a: QueryRow, b: QueryRow): number {
  return b.clicks - a.clicks || b.impressions - a.impressions || a.position - b.position;
}

export function isGscConfigured(): boolean {
  return Boolean(env.GSC_SITE_URL && env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY);
}

// ─── Erişim anahtarı ──────────────────────────────────────────────────────────

let tokenCache: { value: string; expiresAt: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Servis hesabı anahtarıyla imzalanmış, bir saatlik JWT. */
function buildAssertion(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: env.GSC_CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  return `${header}.${claims}.${base64url(signer.sign(env.GSC_PRIVATE_KEY))}`;
}

/** Geçerli erişim anahtarı; süresi dolmadıysa önbellekten. */
async function accessToken(): Promise<string> {
  // 60 sn pay: tam sınırda alınan anahtar istek sunucuya varmadan ölebiliyor.
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildAssertion(),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Search Console kimlik doğrulaması reddedildi (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Search Console erişim anahtarı dönmedi");

  tokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

// ─── Sorgu ────────────────────────────────────────────────────────────────────

export type QueryRow = { query: string; clicks: number; impressions: number; position: number };

type Filter = { dimension: string; operator: string; expression: string };

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function runQuery(filters: Filter[]): Promise<QueryRow[]> {
  const token = await accessToken();
  const endpoint = `${API_ROOT}/${encodeURIComponent(env.GSC_SITE_URL)}/searchAnalytics/query`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      startDate: isoDaysAgo(WINDOW_DAYS + LAG_DAYS),
      endDate: isoDaysAgo(LAG_DAYS),
      dimensions: ["query"],
      dimensionFilterGroups: filters.length > 0 ? [{ filters }] : [],
      rowLimit: FETCH_LIMIT,
      type: "web",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Search Console reddetti (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  const json = (await res.json()) as { rows?: unknown[] };
  if (!Array.isArray(json.rows)) return [];

  return json.rows
    .map((raw) => {
      const row = raw as { keys?: unknown; clicks?: unknown; impressions?: unknown; position?: unknown };
      const query = Array.isArray(row.keys) && typeof row.keys[0] === "string" ? row.keys[0] : "";
      return {
        query,
        clicks: typeof row.clicks === "number" ? row.clicks : 0,
        impressions: typeof row.impressions === "number" ? row.impressions : 0,
        position: typeof row.position === "number" ? row.position : 0,
      };
    })
    .filter((r) => r.query.length > 0)
    .sort(byValue)
    .slice(0, ROW_LIMIT);
}

/**
 * Servis hesabının erişebildiği mülkler.
 *
 * NEDEN VAR: 403 hatası iki ayrı sebepten gelir — kullanıcı Search Console'a
 * hiç eklenmemiştir, ya da eklenmiştir ama mülk kimliği yanlış yazılmıştır
 * ("https://site/" ile "sc-domain:site" farklı mülklerdir). İkisi aynı hatayı
 * verir. Bu liste ayrımı tek bakışta gösterir: boşsa ekleme yapılmamıştır,
 * doluysa doğru yazım listenin içindedir.
 */
export async function listSites(): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const token = await accessToken();
  const res = await fetch(API_ROOT, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Search Console mülk listesi alınamadı (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { siteEntry?: unknown[] };
  if (!Array.isArray(json.siteEntry)) return [];
  return json.siteEntry.map((raw) => {
    const e = raw as { siteUrl?: unknown; permissionLevel?: unknown };
    return {
      siteUrl: typeof e.siteUrl === "string" ? e.siteUrl : "",
      permissionLevel: typeof e.permissionLevel === "string" ? e.permissionLevel : "",
    };
  });
}

/**
 * Bu yazının kendi arama sorguları (tıklamaya göre azalan).
 *
 * Yeni yazıda boş döner — sayfa daha aranmalarda görünmemiştir. Bu bir hata
 * değil, beklenen durum.
 */
export async function queriesForPage(pageUrl: string): Promise<QueryRow[]> {
  return runQuery([{ dimension: "page", operator: "equals", expression: pageUrl }]);
}

/**
 * Site genelinde verilen kelimeyi İÇEREN sorgular.
 *
 * Yeni yazıların boşluğunu kapatır: sayfanın kendi geçmişi yoksa bile sitenin
 * o konudaki gerçek arama verisi kullanılabilir.
 */
export async function queriesMatching(word: string): Promise<QueryRow[]> {
  return runQuery([{ dimension: "query", operator: "contains", expression: word }]);
}

/**
 * Yazı için Search Console kanıtı: önce sayfanın kendi sorguları, yetmezse
 * konu kelimeleriyle site geneli.
 *
 * HATA YUTULUR: Search Console kurulu değilse ya da yanıt vermezse boş döner;
 * otomasyon otomatik tamamlama ve yapay zekâ araştırmasıyla devam eder.
 */
export async function searchEvidence(pageUrl: string, topicWords: string[]): Promise<QueryRow[]> {
  if (!isGscConfigured()) return [];

  try {
    const own = await queriesForPage(pageUrl);
    if (own.length > 0) return own;

    // Sayfanın geçmişi yok: en ayırt edici iki kelimeyle site geneline bak.
    const words = topicWords
      .map((w) => w.trim())
      .filter((w) => w.length >= 4)
      .slice(0, 2);
    const groups = await Promise.all(words.map((w) => queriesMatching(w)));

    const seen = new Set<string>();
    return groups
      .flat()
      .filter((r) => !seen.has(r.query) && seen.add(r.query))
      .sort(byValue)
      .slice(0, ROW_LIMIT);
  } catch (err) {
    logger.warn("social", `Search Console verisi alınamadı: ${String(err)}`);
    return [];
  }
}
