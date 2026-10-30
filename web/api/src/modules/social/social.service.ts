/**
 * Sosyal medya otomasyonunun çekirdeği.
 *
 * AKIŞ: RSS okunur → daha önce paylaşılmamış en yeni yazı seçilir → yapay zekâ
 * her ağ için ayrı metin yazar → gönderiler KUYRUĞA alınır → zamanı gelince
 * ilgili platforma yayınlanır.
 *
 * MÜKERRER PAYLAŞIM: SocialPost üzerindeki (platform, guid) benzersiz kısıtı
 * son savunma hattı. Aynı yazı aynı ağda ikinci kez kuyruğa alınamaz — iki
 * sunucu örneği aynı anda çalışsa bile veritabanı ikinciyi reddeder.
 */

import { env } from "../../config/env.js";
import { Prisma } from "@prisma/client";
import type { SocialAccount, SocialPlatform } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { decryptField, encryptField } from "../../lib/encryption.js";
import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { logError } from "../../lib/app-logger.js";
import { logger } from "../../lib/file-log.js";
import { fetchPairedFeedItems } from "./rss.service.js";
import { TOPIC_COOLDOWN, topicOf } from "./feed-topic.js";
import { keywordsFor } from "./keywords.service.js";
import { writePostBodies } from "./copy.service.js";
import { facebookKindFor } from "./facebook-kind.js";
import {
  MANUAL_MAX_AGE_MS,
  TOOL_REEL_PREFIX,
  cleanupToolVideos,
  findCatalogEntry,
  latestVideoFor,
  loadToolReels,
  nextToolInRotation,
  pickDueToolReel,
  readyToolReelsInRotation,
  toolReelFeedItem,
  toolReelGuid,
  unusedFreshVideoFor,
  variantForPlatform,
} from "./tool-reels.service.js";
import type { ToolReel, ToolReelVideoInfo } from "./tool-reels.service.js";
import { dispatchReelProduction } from "./reel-dispatch.js";
import { PUBLISHERS, VERIFIERS } from "./platforms/index.js";
import { parseTags } from "./instagram-tags.js";
import { isTooSimilar } from "./facebook-similarity.js";
import { carouselQuestionFor, withCarouselQuestion } from "./carousel.service.js";
import { loadXContent } from "./x-content.service.js";
import { kindForCount, pickXPost } from "./x-queue.js";
import type { XUsage } from "./x-queue.js";
import { ALL_PLATFORMS, PLATFORM_SPECS, PRIMARY_FEED_LANG } from "./social.types.js";
import type { FeedItem } from "./social.types.js";

// ─── Ayarlar ──────────────────────────────────────────────────────────────────

export type SocialAutomationConfig = {
  /** Otomatik paylaşım açık mı? Kapalıyken yalnızca elle yayın yapılır. */
  enabled: boolean;
  /** Günlük paylaşım saati (0-23) ve dakikası — `timeZone`'a göre. */
  hour: number;
  minute: number;
  timeZone: string;
  /** Yeni içerik bittiğinde eski yazılar tekrar paylaşılsın mı? */
  recycleOldPosts: boolean;
  /**
   * Ne sıklıkta paylaşılsın?
   *
   * NEDEN GEREKLİ: Arşiv 52 yazı. Günde bir paylaşımda döngü iki ayda başa
   * dönüyor ve aynı yazı yeniden geliyor. Gün aşırı paylaşmak döngüyü üç buçuk
   * aya çıkarıyor — hem tekrar seyrekleşiyor hem de yeni bir hesap için daha
   * doğal bir tempo oluyor.
   */
  cadence: "daily" | "alternate" | "thrice";
  /**
   * Gönderiler paylaşım saatinden kaç dakika ÖNCE hazırlansın?
   *
   * NEDEN: Metin ve görsel yayın anında üretilirse admin'in okuyup düzeltme
   * şansı olmuyor — gönderi görüldüğü an çoktan gitmiş oluyor. Bu süre kadar
   * önce hazırlanıp "sırada" bekler; saat gelene dek metni düzenlenebilir,
   * silinebilir ya da elle erkenden paylaşılabilir.
   *
   * 0 = eski davranış: tam yayın anında hazırla.
   */
  prepareLeadMinutes: number;
  /** Gönderiler çift dilli mi yazılsın (Türkçe üstte, İngilizce altta)? */
  bilingual: boolean;
  /** Çift dil sığmayan ağlarda (X) kullanılacak dil — varsayılan Türkçe (asıl pazar). */
  singleLang: "tr" | "en";
  /** Etiketler için internette canlı araştırma yapılsın mı? (Ücretli) */
  researchKeywords: boolean;
  /**
   * Reels videoları onay beklemeden yayınlansın mı?
   *
   * Kapalıyken (varsayılan) videosu olan yazıların Instagram gönderisi TASLAK olarak
   * bekler; admin videoyu panelde izleyip onaylayınca yayınlanır. Diğer ağlar bundan
   * etkilenmez. Açıkken Reels de diğer gönderiler gibi saati gelince kendiliğinden gider.
   */
  reelsAutoPublish: boolean;
  /**
   * Araç tanıtım videosu kaç günde bir sıraya katılsın? (0 = kapalı)
   *
   * Açıkken günlük blog gönderilerine ek olarak, her N günde bir sıradaki araç videosu
   * Instagram + Facebook Reels olarak hazırlanır. Taslak mı yoksa kendiliğinden mi gideceği
   * `reelsAutoPublish` ayarına bağlıdır.
   */
  toolReelEveryDays: number;
};

const DEFAULT_CONFIG: SocialAutomationConfig = {
  enabled: false,
  hour: 10,
  minute: 0,
  timeZone: "Europe/Istanbul",
  recycleOldPosts: true,
  cadence: "daily",
  // İki saat: sabah kahvesiyle bakıp düzeltmeye yetecek, içeriği bayatlatmayacak süre.
  prepareLeadMinutes: 120,
  bilingual: true,
  singleLang: "tr",
  researchKeywords: true,
  reelsAutoPublish: false,
  toolReelEveryDays: 0,
};

export async function readSocialConfig(): Promise<SocialAutomationConfig> {
  const raw = await getSettingWithFallback<Partial<SocialAutomationConfig>>(
    SITE_SETTING_KEYS.SOCIAL_AUTOMATION,
    {},
  );
  return {
    enabled: raw.enabled === true,
    hour: clampInt(raw.hour, 0, 23, DEFAULT_CONFIG.hour),
    minute: clampInt(raw.minute, 0, 59, DEFAULT_CONFIG.minute),
    timeZone: typeof raw.timeZone === "string" && raw.timeZone ? raw.timeZone : DEFAULT_CONFIG.timeZone,
    recycleOldPosts: raw.recycleOldPosts !== false,
    cadence:
      raw.cadence === "alternate" || raw.cadence === "thrice" ? raw.cadence : "daily",
    // Üst sınır 24 saat: daha uzunu "bugünün gönderisi" olmaktan çıkar ve
    // tempo hesabıyla çakışır.
    prepareLeadMinutes: clampInt(raw.prepareLeadMinutes, 0, 1440, DEFAULT_CONFIG.prepareLeadMinutes),
    bilingual: raw.bilingual !== false,
    singleLang: raw.singleLang === "en" ? "en" : "tr",
    researchKeywords: raw.researchKeywords !== false,
    // Yalnızca açıkça `true` ise otomatik: eksik/bozuk ayar onaylı moda düşer.
    reelsAutoPublish: raw.reelsAutoPublish === true,
    toolReelEveryDays: clampInt(raw.toolReelEveryDays, 0, 30, DEFAULT_CONFIG.toolReelEveryDays),
  };
}

export async function writeSocialConfig(patch: Partial<SocialAutomationConfig>): Promise<SocialAutomationConfig> {
  const next = { ...(await readSocialConfig()), ...patch };
  await setSetting(SITE_SETTING_KEYS.SOCIAL_AUTOMATION, next);
  return next;
}

/**
 * Bir anın, verilen saat dilimindeki UTC farkı (ms).
 * Yaz saati geçişlerinde fark değiştiği için sabit bir değer kullanılamaz.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - at.getTime();
}

/**
 * Bir sonraki otomatik paylaşım anı. Otomasyon kapalıysa `null`.
 *
 * Bugünün saati geçtiyse yarına kayar. Hesap saat dilimi üzerinden yapılır ki
 * sunucu UTC çalışsa bile panelde yazan saat ile gerçek yayın anı aynı olsun.
 */
/**
 * Bu takvim günü paylaşım günü mü?
 *
 * Durum tutmadan karar verilir: "gün aşırı" için çağın başından beri geçen gün
 * sayısının tekliği, "haftada üç" için Pazartesi/Çarşamba/Cuma. Sayaç tutulsaydı
 * sunucu yeniden başladığında ya da bir gün atlandığında ritim kayardı.
 */
export function isPostingDay(dayKey: string, cadence: SocialAutomationConfig["cadence"]): boolean {
  // Tanınmayan değer "her gün" sayılır. Aksi hâlde eksik/bozuk bir ayar
  // paylaşımı sessizce durdururdu — susmak, fazla paylaşmaktan kötüdür.
  if (cadence !== "alternate" && cadence !== "thrice") return true;
  const [y, m, d] = dayKey.split("-").map((v) => Number.parseInt(v, 10));
  const utc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  if (cadence === "alternate") {
    const days = Math.floor(utc / 86_400_000);
    return days % 2 === 0;
  }
  // Pazartesi(1), Çarşamba(3), Cuma(5)
  const weekday = new Date(utc).getUTCDay();
  return weekday === 1 || weekday === 3 || weekday === 5;
}

/**
 * Verilen takvim gününde (YYYY-MM-DD) ayarlanan yayın saatinin gerçek anı.
 * Saat dilimi farkı yaz saati sınırında kaydığı için iki geçişle çözülür.
 */
export function runInstantOn(dayKey: string, config: SocialAutomationConfig): Date {
  const [y, m, d] = dayKey.split("-").map((v) => Number.parseInt(v, 10));
  const wall = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, config.hour, config.minute);
  let instant = new Date(wall - zoneOffsetMs(new Date(wall), config.timeZone));
  instant = new Date(wall - zoneOffsetMs(instant, config.timeZone));
  return instant;
}

export function nextRunAt(config: SocialAutomationConfig, from: Date = new Date()): Date | null {
  if (!config.enabled) return null;
  try {
    const dayKey = calendarDayKey(from, config.timeZone);
    const [y, m, d] = dayKey.split("-").map((v) => Number.parseInt(v, 10));

    const resolve = (dayOffset: number): Date => {
      const wall = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + dayOffset, config.hour, config.minute);
      // İki geçiş: ilk tahminin farkı, yaz saati sınırında kayabilir.
      let instant = new Date(wall - zoneOffsetMs(new Date(wall), config.timeZone));
      instant = new Date(wall - zoneOffsetMs(instant, config.timeZone));
      return instant;
    };

    // Sıradaki UYGUN günü ara: bugünün saati geçtiyse ya da bugün paylaşım
    // günü değilse ileri kaydırılır. İki hafta yeterli — en seyrek tempo
    // haftada üç gün.
    for (let offset = 0; offset <= 14; offset++) {
      const candidate = resolve(offset);
      if (candidate.getTime() <= from.getTime()) continue;
      if (!isPostingDay(calendarDayKey(candidate, config.timeZone), config.cadence)) continue;
      return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// ─── Hesaplar ─────────────────────────────────────────────────────────────────

/** Panelde gösterilecek hâl — gizli alanlar ASLA dönmez, yalnızca "dolu mu" bilgisi. */
export type AccountView = {
  platform: SocialPlatform;
  label: string;
  connected: boolean;
  enabled: boolean;
  displayName: string;
  filledFields: string[];
  tokenExpiresAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

/**
 * Kayıtlı anahtarları çözer. `null` dönüşü "çözülemedi" demektir (şifreleme
 * anahtarı değişmiş ya da kayıt bozulmuş) — boş kayıttan farklı bir durumdur ve
 * admin'e ayrıca bildirilir, sessizce "bağlı değil" gösterilmez.
 */
function decodeSecrets(account: SocialAccount): Record<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(decryptField(account.secretsJson));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Şifreleme anahtarı yoksa kaydetme aşamasında anlaşılır bir hata verilir. */
function encryptSecrets(secrets: Record<string, string>): string {
  try {
    return encryptField(JSON.stringify(secrets));
  } catch {
    throw new Error(
      "Sunucuda şifreleme anahtarı tanımlı değil (BILLING_ENCRYPTION_KEY). Anahtarlar güvenle saklanamadığı için kaydedilmedi.",
    );
  }
}

export async function listAccounts(): Promise<AccountView[]> {
  const rows = await prisma.socialAccount.findMany();
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));

  return ALL_PLATFORMS.map((platform) => {
    const spec = PLATFORM_SPECS[platform];
    const row = byPlatform.get(platform);
    const secrets = row ? decodeSecrets(row) : {};
    const unreadable = row != null && secrets === null;
    const filled = spec.secretFields
      .filter((f) => Boolean(secrets?.[f.key]?.trim()))
      .map((f) => f.key);
    return {
      platform,
      label: spec.label,
      connected: !unreadable && filled.length === spec.secretFields.length,
      enabled: row?.enabled ?? false,
      displayName: row?.displayName ?? "",
      filledFields: filled,
      tokenExpiresAt: row?.tokenExpiresAt?.toISOString() ?? null,
      lastError: unreadable
        ? "Kayıtlı anahtarlar okunamıyor (sunucunun şifreleme anahtarı değişmiş olabilir). Anahtarları yeniden gir."
        : (row?.lastError ?? null),
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  });
}

/**
 * Hesabı kaydeder. Boş bırakılan gizli alanlar SİLİNMEZ — kullanıcı yalnızca
 * süresi dolan anahtarı yenilemek istediğinde diğerlerini yeniden yazmak
 * zorunda kalmasın.
 */
export async function saveAccount(input: {
  platform: SocialPlatform;
  displayName?: string;
  enabled?: boolean;
  secrets: Record<string, string>;
}): Promise<AccountView[]> {
  const spec = PLATFORM_SPECS[input.platform];
  const existing = await prisma.socialAccount.findUnique({ where: { platform: input.platform } });
  // Çözülemeyen kayıt üzerine yazmak yerine sıfırdan başlanır: yarı okunur bir
  // kayıt birleştirilirse hangi anahtarın geçerli olduğu belirsiz kalır.
  const merged = (existing ? decodeSecrets(existing) : {}) ?? {};

  for (const field of spec.secretFields) {
    const value = input.secrets[field.key];
    if (typeof value === "string" && value.trim()) merged[field.key] = value.trim();
  }

  const data = {
    displayName: input.displayName?.trim() || existing?.displayName || spec.label,
    secretsJson: encryptSecrets(merged),
    enabled: input.enabled ?? existing?.enabled ?? true,
    lastError: null,
  };

  await prisma.socialAccount.upsert({
    where: { platform: input.platform },
    create: { platform: input.platform, ...data },
    update: data,
  });

  return listAccounts();
}

/**
 * Kayıtlı anahtarları ağa sorar. Sonuç `lastError`'a da yazılır ki panel
 * yenilendiğinde son sınamanın ne dediği kaybolmasın.
 */
export async function testAccount(
  platform: SocialPlatform,
): Promise<{ ok: boolean; message: string; accounts: AccountView[] }> {
  const finish = async (ok: boolean, message: string) => {
    await prisma.socialAccount.updateMany({
      where: { platform },
      data: { lastCheckedAt: new Date(), lastError: ok ? null : message.slice(0, 900) },
    });
    return { ok, message, accounts: await listAccounts() };
  };

  const verify = VERIFIERS[platform];
  if (!verify) {
    return { ok: false, message: `${PLATFORM_SPECS[platform].label} için sınama henüz yok.`, accounts: await listAccounts() };
  }

  const row = await prisma.socialAccount.findUnique({ where: { platform } });
  if (!row) return finish(false, "Bu ağ için kayıtlı anahtar yok.");

  const secrets = decodeSecrets(row);
  if (!secrets) return finish(false, "Kayıtlı anahtarlar okunamadı — yeniden girilmeli.");

  try {
    const who = await verify(secrets);
    return finish(true, `Bağlantı çalışıyor. Hesap: ${who}`);
  } catch (error) {
    return finish(false, error instanceof Error ? error.message : "Bilinmeyen hata");
  }
}

export async function disconnectAccount(platform: SocialPlatform): Promise<AccountView[]> {
  await prisma.socialAccount.deleteMany({ where: { platform } });
  return listAccounts();
}

/** Yayına hazır hesaplar: bağlı, açık ve tüm gizli alanları dolu olanlar. */
async function readyAccounts(): Promise<Map<SocialPlatform, Record<string, string>>> {
  const rows = await prisma.socialAccount.findMany({ where: { enabled: true } });
  const out = new Map<SocialPlatform, Record<string, string>>();
  for (const row of rows) {
    const secrets = decodeSecrets(row);
    if (!secrets) continue;
    const spec = PLATFORM_SPECS[row.platform];
    if (spec.secretFields.every((f) => Boolean(secrets[f.key]?.trim()))) {
      out.set(row.platform, secrets);
    }
  }
  return out;
}

/** Facebook sayfasının çözülmüş anahtarları (bağlı ve açıksa); yorum/rapor servisleri kullanır. */
export async function facebookSecrets(): Promise<Record<string, string> | null> {
  return (await readyAccounts()).get("FACEBOOK") ?? null;
}

// ─── Kuyruk oluşturma ─────────────────────────────────────────────────────────

/**
 * Bir anın, verilen saat dilimindeki takvim günü ("YYYY-MM-DD").
 * Sunucu UTC çalışsa bile "bugün" kullanıcının saatine göre hesaplanır.
 */
export function calendarDayKey(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    // Geçersiz saat dilimi → UTC'ye düş; otomasyon durmasın.
    return at.toISOString().slice(0, 10);
  }
}

/** Kampanya etiketi (?utm_…), parça ve sondaki eğik çizgi olmadan adres: kopya karşılaştırması için. */
export function canonicalLink(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.split(/[?#]/)[0]?.replace(/\/+$/, "").toLowerCase() ?? url;
  }
}

/** Görsel seçimi: platformun istediği kesim yoksa elde olana düşülür. */
function pickImage(item: FeedItem, platform: SocialPlatform): string | null {
  const preferred = PLATFORM_SPECS[platform].imageFormat;
  return item.images[preferred] ?? item.images.wide ?? item.images.square ?? item.images.tall ?? null;
}

/**
 * Bir sonraki paylaşılacak yazıyı seçer.
 *
 * Önce hiç paylaşılmamış en YENİ yazıya bakılır (son paylaşımlarla aynı konuda olmayan tercih edilir). Hepsi paylaşılmışsa ve geri
 * dönüşüm açıksa, en uzun süredir paylaşılmayan yazı yeniden gündeme getirilir
 * (yeni içerik olmayan günlerde hesap sessiz kalmasın).
 */
async function pickNextItem(
  items: FeedItem[],
  platform: SocialPlatform,
  recycle: boolean,
): Promise<FeedItem | null> {
  if (items.length === 0) return null;

  // Kopya kontrolü yalnız kimliğe (guid) değil ADRESE de bakar: aynı yazı Türkçe ve İngilizce
  // besleme kaydıyla farklı kimlik taşıyabiliyor (Pinterest'te aynı pinin iki kez çıkmasının sebebi).
  const past = await prisma.socialPost.findMany({
    where: { platform },
    select: { guid: true, linkUrl: true, createdAt: true },
  });
  const pastByLink = new Map<string, Date>();
  for (const row of past) {
    const key = canonicalLink(row.linkUrl);
    const prev = pastByLink.get(key);
    if (!prev || prev < row.createdAt) pastByLink.set(key, row.createdAt);
  }
  const wantedGuids = new Set(items.map((i) => i.guid));
  const seen: { guid: string; createdAt: Date }[] = past.filter((r) => wantedGuids.has(r.guid));
  for (const item of items) {
    for (const link of [item.link, item.alt?.link]) {
      const at = link ? pastByLink.get(canonicalLink(link)) : undefined;
      if (at) seen.push({ guid: item.guid, createdAt: at });
    }
  }
  // Bir yazı birden çok kez paylaşılmış olabilir; sıralama için EN SON paylaşım
  // anı geçerlidir. İlk kaydı tutmak, aylar önce bir kez paylaşılıp dün tekrar
  // paylaşılmış bir yazıyı "en eski" sayıp başa almaya yol açardı.
  const seenMap = new Map<string, number>();
  for (const row of seen) {
    const at = row.createdAt.getTime();
    seenMap.set(row.guid, Math.max(seenMap.get(row.guid) ?? 0, at));
  }

  // Konu çeşitliliği: son paylaşımların konusu cooldown boyunca yeniden seçilmez
  // (yoksa yeni tarihli bir konu kümesi — örn. 14 meslek CV'si — haftalarca sırayı kilitler).
  // Başka konu kalmadıysa en iyi aday yine de seçilir; otomasyon susmaz.
  const recentTopics = new Set(
    items
      .filter((i) => seenMap.has(i.guid))
      .sort((a, b) => (seenMap.get(b.guid) ?? 0) - (seenMap.get(a.guid) ?? 0))
      .slice(0, TOPIC_COOLDOWN)
      .map(topicOf),
  );
  const pickVaried = (list: FeedItem[]): FeedItem | undefined =>
    list.find((i) => !recentTopics.has(topicOf(i))) ?? list[0];

  const fresh = pickVaried(items.filter((i) => !seenMap.has(i.guid)));
  if (fresh) return fresh;
  if (!recycle) return null;

  return pickVaried(items.slice().sort((a, b) => (seenMap.get(a.guid) ?? 0) - (seenMap.get(b.guid) ?? 0))) ?? null;
}

export type QueueResult = {
  queued: { platform: SocialPlatform; title: string; body: string; imageUrl: string | null; manual: boolean }[];
  /** `platform: null` → tüm platformları birden ilgilendiren sebep. */
  skipped: { platform: SocialPlatform | null; reason: string }[];
};

/**
 * Günün gönderilerini hazırlar.
 *
 * @param scheduledAt Yayın anı. Geçmiş bir an verilirse ilk turda yayınlanır.
 * @param hold `true` ise kayıtlar TASLAK olarak kalır: admin panelde okuyup
 *   onaylamadan hiçbir şey yayınlanmaz. Otomatik tur bunu `false` ile çağırır.
 */
async function queueBlogPosts(scheduledAt: Date, hold = false): Promise<QueueResult> {
  const config = await readSocialConfig();
  const dayKey = calendarDayKey(scheduledAt, config.timeZone);
  const accounts = await readyAccounts();
  const result: QueueResult = { queued: [], skipped: [] };

  const items = await fetchPairedFeedItems(PRIMARY_FEED_LANG);
  if (items.length === 0) {
    result.skipped.push({ platform: null, reason: "Beslemede paylaşılacak yazı bulunamadı" });
    return result;
  }

  // Platform başına ayrı seçim: bir ağ yeni eklendiğinde geçmişi ondan bağımsız
  // ilerlesin, hepsi aynı yazıda kilitlenmesin.
  //
  // HESABI BAĞLI OLMAYAN AĞLAR DA HAZIRLANIR: metin zaten bir kez yazılıyor,
  // görselin yalnızca kesimi değişiyor. Bağlı olmayan ağın gönderisi MANUAL
  // olarak kaydedilir — otomatik yayına asla girmez, panelde metni kopyalanıp
  // görseli indirilerek elle paylaşılır.
  const targets: { platform: SocialPlatform; item: FeedItem }[] = [];
  for (const platform of ALL_PLATFORMS) {
    // Yalnız video kabul eden ağ (YouTube) blog görseliyle beslenmez; araç videoları ayrı akışta gider.
    if (PLATFORM_SPECS[platform].videoOnly) continue;
    // X kendi haftalık döngüsünden beslenir (queueXPost): blog hattı bu ağı atlar.
    if (PLATFORM_SPECS[platform].ownQueue) continue;
    const item = await pickNextItem(items, platform, config.recycleOldPosts);
    if (!item) {
      result.skipped.push({ platform, reason: "Paylaşılacak yeni yazı yok" });
      continue;
    }
    const image = pickImage(item, platform);
    if (!image && PLATFORM_SPECS[platform].imageRequired) {
      result.skipped.push({ platform, reason: "Bu platform görsel istiyor, yazının kapağı bulunamadı" });
      continue;
    }
    targets.push({ platform, item });
  }
  if (targets.length === 0) return result;

  // Aynı yazıyı hedefleyen platformlar için metinler tek istekte üretilir.
  const byGuid = new Map<string, { item: FeedItem; platforms: SocialPlatform[] }>();
  for (const t of targets) {
    const entry = byGuid.get(t.item.guid) ?? { item: t.item, platforms: [] };
    entry.platforms.push(t.platform);
    byGuid.set(t.item.guid, entry);
  }

  for (const { item, platforms } of byGuid.values()) {
    // Etiketlerin dayanağı: SEO bankası (+ açıksa canlı araştırma). Araştırma
    // yazı başına bir kez yapılır, sonucu önbellekten gelir.
    const keywords = await keywordsFor(item, config.researchKeywords);
    const bodies = await writePostBodies({
      item,
      platforms,
      keywords,
      bilingual: config.bilingual,
      singleLang: config.singleLang,
      avoidTags: await lastInstagramTags(),
      fbKind: facebookKindFor(await prisma.socialPost.count({ where: { platform: "FACEBOOK", NOT: { guid: { startsWith: TOOL_REEL_PREFIX } } } })),
    });
    // Son 30 Facebook gönderisiyle benzerlik: çok benzerse TASLAK kalır, admin görüp düzeltir.
    const recentFb = platforms.includes("FACEBOOK")
      ? (await prisma.socialPost.findMany({ where: { platform: "FACEBOOK" }, orderBy: { createdAt: "desc" }, take: 30, select: { body: true } })).map((r) => r.body)
      : [];
    // Instagram kaydırmalı gönderisinin yorum sorusu açıklamaya da yazılır (kaydırmayanlar da yanıtlasın).
    if (bodies["INSTAGRAM"]) {
      const question = await carouselQuestionFor(item).catch(() => null);
      bodies["INSTAGRAM"] = withCarouselQuestion(bodies["INSTAGRAM"], question);
    }
    for (const platform of platforms) {
      // Blog gönderileri Reels olmaz (yalnız araç videoları Reels olur): carousel/tek görsel.
      const imageUrl = pickImage(item, platform);
      const similar = platform === "FACEBOOK" && isTooSimilar(bodies[platform], recentFb);
      if (similar) result.skipped.push({ platform, reason: "Facebook metni son 30 gönderiden birine çok benziyor; taslak olarak bekliyor" });
      const holdThis = hold || similar;
      try {
        const manual = !accounts.has(platform);
        await prisma.socialPost.create({
          data: {
            platform,
            guid: item.guid,
            lang: item.lang,
            title: item.title,
            linkUrl: item.link,
            body: bodies[platform],
            imageUrl,
            scheduledAt,
            dayKey,
            status: manual ? "MANUAL" : holdThis ? "DRAFT" : "QUEUED",
          },
        });
        result.queued.push({ platform, title: item.title, body: bodies[platform], imageUrl, manual });
      } catch (err) {
        // Benzersiz kısıt → bu yazı bu ağda zaten kuyrukta/paylaşılmış.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          result.skipped.push({ platform, reason: "Bu yazı bugün bu hesapta zaten kuyruğa alınmış" });
          continue;
        }
        throw err;
      }
    }
  }

  return result;
}

/**
 * X: haftalık döngüden o günün gönderisini hazırlar (ipucu, ürün, ipucu, ürün, anket, "biliyor muydunuz").
 * Yayın zamanı diğer ağlarla aynı mekanizmadan gelir; burada zamanlamaya dokunulmaz.
 * Gönderi gövdesi thread/link yanıtı/anket planını taşır (x-compose.ts); yayıncı gövdeden okur.
 */
async function queueXPost(scheduledAt: Date, hold: boolean, result: QueueResult): Promise<void> {
  const config = await readSocialConfig();
  const dayKey = calendarDayKey(scheduledAt, config.timeZone);
  const accounts = await readyAccounts();

  // Gün başına bir X gönderisi: bugün zaten hazırlandıysa yenisi açılmaz.
  if ((await prisma.socialPost.count({ where: { platform: "X", dayKey } })) > 0) return;

  const content = await loadXContent();
  if (!content) {
    result.skipped.push({ platform: "X", reason: "X içerik kaynağı (social-x.json) okunamadı" });
    return;
  }
  const rows = await prisma.socialPost.findMany({ where: { platform: "X" }, select: { guid: true, createdAt: true } });
  const usage: XUsage = new Map();
  for (const r of rows) usage.set(r.guid, Math.max(usage.get(r.guid) ?? 0, r.createdAt.getTime()));

  const items = await fetchPairedFeedItems(PRIMARY_FEED_LANG);
  const pick = pickXPost({
    kind: kindForCount(rows.length),
    content,
    usage,
    postUrls: items.map((i) => i.link),
    recycle: config.recycleOldPosts,
    siteOrigin: env.FRONTEND_ORIGIN.replace(/\/$/, ""),
  });
  if (!pick) {
    result.skipped.push({ platform: "X", reason: "X için uygun içerik bulunamadı" });
    return;
  }

  const manual = !accounts.has("X");
  await prisma.socialPost.create({
    data: {
      platform: "X",
      guid: pick.guid,
      lang: "tr",
      title: pick.title,
      linkUrl: pick.linkUrl,
      body: pick.body,
      imageUrl: pick.imageUrl,
      scheduledAt,
      dayKey,
      status: manual ? "MANUAL" : hold ? "DRAFT" : "QUEUED",
    },
  });
  result.queued.push({ platform: "X", title: pick.title, body: pick.body, imageUrl: pick.imageUrl, manual });
}

/** Bir önceki Instagram gönderisinin etiketleri: art arda iki gönderide aynı set çıkmasın. */
async function lastInstagramTags(): Promise<string[]> {
  // EN İYİ ÇABA: etiket çeşitliliği için bakılıyor; okunamazsa gönderi hazırlığı durmaz.
  try {
    const last = await prisma.socialPost.findFirst({
      where: { platform: "INSTAGRAM" },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    return last ? parseTags(last.body) : [];
  } catch {
    return [];
  }
}

// ─── Araç tanıtım videoları ───────────────────────────────────────────────────

/** Araç videolarının gideceği ağlar (Instagram/Facebook Reels + YouTube Shorts). */
const TOOL_REEL_PLATFORMS: SocialPlatform[] = ["INSTAGRAM", "FACEBOOK", "YOUTUBE"];

/**
 * Bir araç videosunu Instagram + Facebook Reels ve YouTube Shorts gönderisi olarak kuyruğa alır.
 *
 * Metin blog gönderileriyle aynı hattan yazılır (yapay zekâ varsa o, yoksa şablon);
 * arama terimleri manifestten gelir. Bağlı olmayan ağın gönderisi MANUAL kaydedilir.
 * `hold` doğruysa TASLAK kalır: admin videoyu izleyip onaylamadan hiçbir şey yayınlanmaz.
 */
export async function queueToolReel(
  toolId: string,
  scheduledAt: Date,
  hold: boolean,
  /** Verilirse yalnız bu video kullanılır (otomatik tur: henüz kullanılmamış taze video). */
  video?: ToolReelVideoInfo,
  /**
   * Elle hazırlıkta: `platforms` ile yalnız seçilen ağlar; `repeat` ile aynı gün aynı ağa ikinci kez
   * hazırlanabilir (örn. ilk gönderi hatalı çıktı, yeniden yayınlanacak). Otomatik tur bunları KULLANMAZ.
   */
  options?: {
    platforms?: SocialPlatform[];
    repeat?: boolean;
    /**
     * YouTube + Facebook için "Bağlantı açıklamada" sürümü. Verilmezse en yeni sürüm aranır; `null`
     * (otomatik turda sürüm henüz hazır değil) ya da hiç bulunmazsa Instagram sürümü kullanılır.
     */
    captionVideo?: ToolReelVideoInfo | null;
  },
): Promise<QueueResult> {
  const result: QueueResult = { queued: [], skipped: [] };
  const entry = findCatalogEntry(toolId);
  if (!entry) {
    result.skipped.push({ platform: null, reason: "Bu araç için video tanımlı değil" });
    return result;
  }
  const usable = video ?? (await latestVideoFor(toolId, MANUAL_MAX_AGE_MS, scheduledAt));
  if (!usable) {
    result.skipped.push({
      platform: null,
      reason: "Bu araç için henüz video üretilmedi (paylaşım zamanı yaklaşınca kendiliğinden üretilir)",
    });
    return result;
  }
  const captionVideo =
    options?.captionVideo === undefined
      ? await latestVideoFor(toolId, MANUAL_MAX_AGE_MS, scheduledAt, "caption")
      : options.captionVideo;
  if (!captionVideo) {
    logger.warn("social", `${toolId}: "açıklamada" sürümü yok; YouTube/Facebook Instagram sürümüyle gidiyor`);
  }
  const config = await readSocialConfig();
  const dayKey = calendarDayKey(scheduledAt, config.timeZone);
  const accounts = await readyAccounts();
  const item = toolReelFeedItem(entry);
  const bodies = await writePostBodies({
    item,
    platforms: TOOL_REEL_PLATFORMS,
    keywords: entry.keywords,
    bilingual: config.bilingual,
    singleLang: config.singleLang,
    templateOnly: true,
    avoidTags: await lastInstagramTags(),
  });
  const targets = options?.platforms?.length
    ? TOOL_REEL_PLATFORMS.filter((p) => options.platforms?.includes(p))
    : TOOL_REEL_PLATFORMS;
  for (const platform of targets) {
    const manual = !accounts.has(platform);
    const status = manual ? "MANUAL" : hold ? "DRAFT" : "QUEUED";
    // Instagram "profilde" sürümünü, YouTube + Facebook "açıklamada" sürümünü paylaşır.
    const media = variantForPlatform(platform) === "caption" ? (captionVideo ?? usable) : usable;
    // Tekrar hazırlıkta: bu video için bu ağda zaten bekleyen bir gönderi varsa ikincisi açılmaz.
    if (options?.repeat) {
      const waiting = await prisma.socialPost.count({
        where: { platform, imageUrl: media.url, status: { in: ["DRAFT", "QUEUED", "PUBLISHING", "MANUAL"] } },
      });
      if (waiting > 0) {
        result.skipped.push({ platform, reason: "Bu video için bu hesapta zaten bekleyen bir gönderi var" });
        continue;
      }
    }
    // Benzersizlik (ağ + içerik + gün): tekrarda gün anahtarına sıra eki konur ("2026-10-12~2").
    for (let attempt = 1; attempt <= (options?.repeat ? 20 : 1); attempt++) {
      try {
        await prisma.socialPost.create({
          data: {
            platform,
            guid: toolReelGuid(entry.id),
            lang: item.lang,
            title: item.title,
            linkUrl: item.link,
            body: bodies[platform],
            imageUrl: media.url,
            scheduledAt,
            dayKey: attempt === 1 ? dayKey : `${dayKey}~${attempt}`,
            status,
          },
        });
        result.queued.push({ platform, title: item.title, body: bodies[platform], imageUrl: media.url, manual });
        break;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          if (options?.repeat && attempt < 20) continue;
          result.skipped.push({ platform, reason: "Bu video bugün bu hesapta zaten kuyruğa alınmış" });
          break;
        }
        throw err;
      }
    }
  }
  return result;
}

/**
 * Panelin "Reels hazırla" düğmesi: sırası gelen ve videosu hazır olan araç için TASLAK açar.
 * Sıklık ayarına bakmaz (elle istendi). Videosu hazır araç yoksa nedenini söyler.
 */
export async function queueNextToolReel(now: Date = new Date()): Promise<QueueResult & { toolId: string | null }> {
  const result: QueueResult & { toolId: string | null } = { queued: [], skipped: [], toolId: null };
  const candidates = await readyToolReelsInRotation(now);
  if (candidates.length === 0) {
    // Video yok: üretimi GitHub'da kendimiz başlatırız (anahtar tanımlıysa).
    const next = await nextToolInRotation();
    const started = next ? await dispatchReelProduction(next.id) : ({ ok: false, reason: "failed" } as const);
    result.skipped.push({
      platform: null,
      reason: started.ok
        ? `Hazır video yoktu; "${next?.id}" videosunun üretimi başlatıldı. Yaklaşık 5 dakika sonra "Reels hazırla"ya tekrar bas`
        : started.reason === "not-configured"
          ? "Şu an hazır araç videosu yok. Panelden üretimi başlatmak için sunucuya GITHUB_DISPATCH_TOKEN eklenmeli; şimdilik GitHub → Actions → tool-reels → Run workflow ile üret"
          : "Şu an hazır araç videosu yok ve üretim başlatılamadı (GitHub'a ulaşılamadı ya da anahtar geçersiz). GitHub → Actions → tool-reels → Run workflow ile üretebilirsin",
    });
    return result;
  }
  for (const entry of candidates) {
    const queued = await queueToolReel(entry.id, now, true, undefined, { repeat: true });
    if (queued.queued.length > 0) {
      result.toolId = entry.id;
      result.queued.push(...queued.queued);
      result.skipped.push(...queued.skipped);
      return result;
    }
    result.skipped.push(...queued.skipped);
  }
  return result;
}

/** Panel için: her araç, varsa hazır videosu ve hangi ağlarda gönderiye çevrildiği. */
export async function listToolReelsWithStatus(): Promise<
  (ToolReel & { posts: { platform: SocialPlatform; status: string; createdAt: string }[] })[]
> {
  const reels = await loadToolReels();
  const rows = await prisma.socialPost.findMany({
    where: { guid: { in: reels.map((r) => r.guid) } },
    select: { guid: true, platform: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return reels.map((r) => ({
    ...r,
    posts: rows
      .filter((p) => p.guid === r.guid)
      .map((p) => ({ platform: p.platform, status: p.status, createdAt: p.createdAt.toISOString() })),
  }));
}

/**
 * Otomatik tur: ayarlanan günde bir, sıradaki araç videosunu kuyruğa katar.
 * Video paylaşım zamanından ÖNCE üretilmiş olmalı (iş akışı); hazır değilse o gün atlanır.
 */
async function maybeQueueToolReel(scheduledAt: Date, hold: boolean, result: QueueResult): Promise<void> {
  const config = await readSocialConfig();
  if (config.toolReelEveryDays <= 0) return;
  const due = await pickDueToolReel(scheduledAt, config.toolReelEveryDays);
  if (!due) return;

  const video = await unusedFreshVideoFor(due.id, scheduledAt);
  if (!video) {
    result.skipped.push({ platform: null, reason: `Araç videosu (${due.id}) henüz hazır değil; bugün atlandı` });
    return;
  }
  const captionVideo = await unusedFreshVideoFor(due.id, scheduledAt, "caption");
  const queued = await queueToolReel(due.id, scheduledAt, hold || !config.reelsAutoPublish, video, { captionVideo });
  result.queued.push(...queued.queued);
  result.skipped.push(...queued.skipped);
}

/**
 * Geç gelen araç videosu: günün gönderileri hazırlanırken video yoktuysa (üretim gecikti), video
 * AYNI GÜN içinde gelince gönderi yine de oluşturulur.
 *
 * Yayın saati henüz geçmediyse normal saatinde gider; geçtiyse yarım saat sonraya konur (onay modunda
 * zaten taslaktır). Gece yarısını aşacaksa o gün vazgeçilir. Aynı güne ikinci bir araç videosu
 * eklenmez; sıklık kuralı (`pickDueToolReel`) zaten yeni oluşan gönderiden sayar.
 */
export async function catchUpToolReel(now: Date = new Date()): Promise<QueueResult> {
  const result: QueueResult = { queued: [], skipped: [] };
  const config = await readSocialConfig();
  if (!config.enabled || config.toolReelEveryDays <= 0) return result;

  const dayKey = calendarDayKey(now, config.timeZone);
  if (!isPostingDay(dayKey, config.cadence)) return result;
  // Günün turu henüz çalışmadıysa araç videosunu o tur zaten ekler.
  if ((await prisma.socialPost.count({ where: { dayKey } })) === 0) return result;
  if ((await prisma.socialPost.count({ where: { dayKey, guid: { startsWith: TOOL_REEL_PREFIX } } })) > 0) {
    return result;
  }

  const runAt = runInstantOn(dayKey, config);
  const scheduledAt = runAt.getTime() > now.getTime() ? runAt : new Date(now.getTime() + 30 * 60_000);
  if (calendarDayKey(scheduledAt, config.timeZone) !== dayKey) return result;

  const due = await pickDueToolReel(runAt, config.toolReelEveryDays);
  if (!due) return result;
  const video = await unusedFreshVideoFor(due.id, scheduledAt);
  if (!video) return result;

  const captionVideo = await unusedFreshVideoFor(due.id, scheduledAt, "caption");
  const queued = await queueToolReel(due.id, scheduledAt, !config.reelsAutoPublish, video, { captionVideo });
  result.queued.push(...queued.queued);
  result.skipped.push(...queued.skipped);
  if (queued.queued.length > 0) {
    await scheduleFacebookSlots(dayKey).catch((err) => logger.warn("social", `Facebook saatleri ayarlanamadı: ${String(err)}`));
    logger.info("social", `${dayKey}: geç gelen araç videosu (${due.id}) için ${queued.queued.length} gönderi hazırlandı`);
  }
  return result;
}

/** Paylaşılmış videoları siler; hata otomasyonu durdurmaz. */
async function cleanupToolVideosSafely(): Promise<void> {
  try {
    const removed = await cleanupToolVideos();
    if (removed > 0) logger.info("social", `${removed} araç videosu silindi (paylaşıldı ya da süresi doldu)`);
  } catch (err) {
    logger.warn("social", `Araç videoları temizlenemedi: ${String(err)}`);
  }
}

/** Günün gönderilerini hazırlar: blog yazıları + (açıksa) sıradaki araç videosu. */
export async function queueDailyPosts(
  scheduledAt: Date,
  hold = false,
  /** Otomatik tur: Facebook gönderileri kendi saat penceresine (öğle / akşam) taşınır. */
  spreadFacebook = false,
): Promise<QueueResult> {
  const result = await queueBlogPosts(scheduledAt, hold);
  try {
    await queueXPost(scheduledAt, hold, result);
  } catch (err) {
    // X ek bir akış: hatası diğer ağların gönderilerini geri almamalı.
    logger.warn("social", `X gönderisi kuyruğa alınamadı: ${String(err)}`);
  }
  try {
    await maybeQueueToolReel(scheduledAt, hold, result);
  } catch (err) {
    // Araç videosu ek bir akış: hatası blog gönderilerini geri almamalı.
    logger.warn("social", `Araç videosu kuyruğa alınamadı: ${String(err)}`);
  }
  if (spreadFacebook) {
    try {
      await scheduleFacebookSlots(calendarDayKey(scheduledAt, (await readSocialConfig()).timeZone));
    } catch (err) {
      // Saat ayarı ek bir adım: hatası gönderileri geri almamalı, gönderiler olduğu saatte gider.
      logger.warn("social", `Facebook saatleri ayarlanamadı: ${String(err)}`);
    }
  }
  await cleanupToolVideosSafely();
  return result;
}

// ─── Facebook paylaşım saatleri ───────────────────────────────────────────────

/**
 * Facebook'ta gönderi türüne göre yayın penceresi (yerel saat, [başlangıç, bitiş) saat).
 * Normal gönderi öğle arası, Reels akşam; tam saatte yığılma olmasın diye pencerenin
 * içinde rastgele bir dakika seçilir (başta/sonda 3 dk pay bırakılır).
 */
export const FACEBOOK_WINDOWS = {
  post: { from: 12, to: 13 },
  reel: { from: 20, to: 22 },
} as const;

/** Verilen takvim gününde, saat diliminde `hour:minute` anının gerçek zamanı. */
function instantAtLocal(dayKey: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = dayKey.split("-").map((v) => Number.parseInt(v, 10));
  const wall = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hour, minute);
  let instant = new Date(wall - zoneOffsetMs(new Date(wall), timeZone));
  instant = new Date(wall - zoneOffsetMs(instant, timeZone));
  return instant;
}

/** Pencere içinde rastgele bir an. `random` testler için dışarıdan verilebilir. */
export function facebookSlot(
  kind: keyof typeof FACEBOOK_WINDOWS,
  dayKey: string,
  timeZone: string,
  random: () => number = Math.random,
): Date {
  const { from, to } = FACEBOOK_WINDOWS[kind];
  const spanMinutes = (to - from) * 60 - 6;
  let offset = 3 + Math.floor(random() * spanMinutes);
  // Pencere ortasındaki tam saat (örn. 21:00) de yığılma noktası: dakika 3'ün altındaysa kaydır.
  if (offset % 60 < 3) offset += 3;
  return instantAtLocal(dayKey, from + Math.floor(offset / 60), offset % 60, timeZone);
}

/**
 * Günün Facebook gönderilerini kendi saat penceresine taşır (yalnız otomatik turda).
 * Pencere çoktan geçtiyse (sunucu geç kaldı) gönderi olduğu gibi bırakılır, hemen gider.
 */
export async function scheduleFacebookSlots(dayKey: string, now: Date = new Date()): Promise<void> {
  const config = await readSocialConfig();
  const rows = await prisma.socialPost.findMany({
    where: { platform: "FACEBOOK", dayKey: { startsWith: dayKey }, status: { in: ["QUEUED", "DRAFT"] } },
    select: { id: true, guid: true, scheduledAt: true },
  });
  for (const row of rows) {
    const kind = row.guid.startsWith(TOOL_REEL_PREFIX) ? "reel" : "post";
    const slot = facebookSlot(kind, dayKey, config.timeZone);
    if (slot.getTime() <= now.getTime()) continue;
    await prisma.socialPost.update({ where: { id: row.id }, data: { scheduledAt: slot } });
  }
}

// ─── Yayınlama ────────────────────────────────────────────────────────────────

/** Bir gönderi kaç kez denenir — geçici ağ hatası kalıcı başarısızlık sayılmasın. */
const MAX_ATTEMPTS = 3;

/** Tek bir kuyruk kaydını yayınlar. Hata fırlatmaz; sonucu kayda yazar. */
async function publishOne(postId: string, secrets: Record<string, string>): Promise<boolean> {
  // Kaydı önce PUBLISHING'e çekiyoruz: iki tur çakışsa bile ikinci tur bu kaydı
  // görmez, aynı gönderi iki kez gitmez.
  const claimed = await prisma.socialPost.updateMany({
    where: { id: postId, status: "QUEUED" },
    data: { status: "PUBLISHING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return false;

  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return false;

  try {
    const publisher = PUBLISHERS[post.platform];
    const outcome = await publisher({
      body: post.body,
      imageUrl: post.imageUrl,
      secrets,
      item: {
        guid: post.guid,
        lang: post.lang === "en" ? "en" : "tr",
        title: post.title,
        summary: "",
        link: post.linkUrl,
        publishedAt: post.createdAt.getTime(),
        categories: [],
        images: {},
      },
    });

    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalId: outcome.externalId,
        externalUrl: outcome.externalUrl,
        slidesJson: outcome.slides?.length ? JSON.stringify(outcome.slides) : null,
        lastError: outcome.warning ? outcome.warning.slice(0, 900) : null,
      },
    });
    await prisma.socialAccount.updateMany({
      where: { platform: post.platform },
      data: { lastCheckedAt: new Date(), lastError: null },
    });
    logger.info("social", `${post.platform} paylaşıldı: ${post.title}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = post.attempts >= MAX_ATTEMPTS;
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: exhausted ? "FAILED" : "QUEUED", lastError: message.slice(0, 900) },
    });
    await prisma.socialAccount.updateMany({
      where: { platform: post.platform },
      data: { lastCheckedAt: new Date(), lastError: message.slice(0, 900) },
    });
    logError({
      category: "unhandled",
      message: `[social/${post.platform}] ${message}`,
      status: 502,
      method: "CRON",
      path: "/social/publish",
    });
    return false;
  }
}

/**
 * Yayın sırasında sunucu yeniden başlarsa kayıt "PUBLISHING" durumunda asılı
 * kalır ve bir daha hiç denenmez. Bu pencereden eski kalanlar kuyruğa geri
 * alınır. Pencere, en yavaş platformun (Instagram, ~60 sn) çok üstünde seçildi;
 * hâlâ gerçekten yayınlanmakta olan bir kayda dokunmaz.
 */
const STUCK_AFTER_MS = 15 * 60 * 1000;

async function requeueStuckPosts(): Promise<void> {
  await prisma.socialPost.updateMany({
    where: { status: "PUBLISHING", updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
    data: { status: "QUEUED", lastError: "Yayın yarıda kaldı, tekrar denenecek" },
  });
}

/** Zamanı gelmiş tüm kuyruk kayıtlarını yayınlar. */
export async function publishDuePosts(): Promise<{ published: number; failed: number }> {
  await requeueStuckPosts();

  const accounts = await readyAccounts();
  if (accounts.size === 0) return { published: 0, failed: 0 };

  const due = await prisma.socialPost.findMany({
    where: { status: "QUEUED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 25,
    select: { id: true, platform: true },
  });

  let published = 0;
  let failed = 0;
  for (const row of due) {
    const secrets = accounts.get(row.platform);
    // Hesabı bağlı olmayan kayıt "başarısız" değildir; sırada bekler.
    if (!secrets) continue;
    const before = await prisma.socialPost.findUnique({
      where: { id: row.id },
      select: { status: true },
    });
    if (before?.status !== "QUEUED") continue;

    if (await publishOne(row.id, secrets)) published++;
    else failed++;
  }
  // Paylaşılan araç videolarının dosyası artık gereksiz: silinir.
  if (published > 0) await cleanupToolVideosSafely();
  return { published, failed };
}

/** Panelden "şimdi paylaş" — kuyruktaki tek kaydı bekletmeden yayınlar. */
export async function publishNow(postId: string): Promise<{ ok: boolean; error: string | null }> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: "Gönderi bulunamadı" };

  const accounts = await readyAccounts();
  const secrets = accounts.get(post.platform);
  if (!secrets) return { ok: false, error: "Bu platformun hesabı bağlı veya açık değil" };

  // Taslak ya da başarısız kayıt, yayınlanabilmesi için kuyruğa alınır.
  if (post.status !== "QUEUED") {
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: "QUEUED", attempts: 0, scheduledAt: new Date() },
    });
  }

  const ok = await publishOne(post.id, secrets);
  if (ok) {
    await cleanupToolVideosSafely();
    return { ok: true, error: null };
  }
  const after = await prisma.socialPost.findUnique({ where: { id: postId }, select: { lastError: true } });
  return { ok: false, error: after?.lastError ?? "Yayınlanamadı" };
}

/**
 * "Elle paylaştım" işareti.
 *
 * NEDEN: Bağlı olmayan ağların gönderisini admin kendi eliyle atıyor. İşaret
 * konmazsa aynı kart günlerce "bekliyor" görünür ve hangi ağa atıldığı takip
 * edilemez. Yalnızca MANUAL kayıtlar için geçerli — otomatik akışın durumlarını
 * elle "paylaşıldı" yapmaya izin verilmez.
 */
export async function markPostShared(postId: string): Promise<void> {
  await prisma.socialPost.updateMany({
    where: { id: postId, status: "MANUAL" },
    data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null },
  });
  await cleanupToolVideosSafely();
}

export async function deletePost(postId: string): Promise<void> {
  // Yayınlanmış/atlanmış kayıt GERÇEKTEN silinmez, panelden gizlenir: paylaşım sırası
  // (pickNextItem) bu kayıtlara bakıyor; silinirse aynı yazılar yeniden paylaşılırdı.
  await prisma.socialPost.updateMany({
    where: { id: postId, status: { in: ["PUBLISHED", "SKIPPED"] }, clearedAt: null },
    data: { clearedAt: new Date() },
  });
  // Bekleyen / başarısız / elle kayıtlar eskisi gibi silinir.
  await prisma.socialPost.deleteMany({
    where: { id: postId, status: { notIn: ["PUBLISHED", "SKIPPED", "PUBLISHING"] } },
  });
  await cleanupToolVideosSafely();
}

/**
 * "Bu aslında paylaşılmadı": kaydı geçmişten tamamen siler, yazı yeniden paylaşım sırasına girer.
 *
 * NEDEN: Paylaşım sırası (pickNextItem) PUBLISHED/SKIPPED kayıtlara bakar; gönderi ağda silinse bile kayıt duruyorsa o yazı
 * "paylaşıldı" sayılır ve diğer ağlarda çıkan yazı bu ağda atlanır. Yalnız geçmiş kayıtlar silinir; bekleyenler deletePost ile gider.
 */
export async function unsharePost(postId: string): Promise<boolean> {
  const r = await prisma.socialPost.deleteMany({ where: { id: postId, status: { in: ["PUBLISHED", "SKIPPED"] } } });
  await cleanupToolVideosSafely();
  return r.count > 0;
}

export async function updatePostBody(postId: string, body: string): Promise<void> {
  await prisma.socialPost.updateMany({
    where: { id: postId, status: { in: ["DRAFT", "QUEUED", "FAILED", "MANUAL"] } },
    data: { body: body.trim(), lastError: null },
  });
}

/** Panel özeti: kuyruk ve geçmiş sayıları. */
export async function postStats(): Promise<{
  draft: number;
  manual: number;
  queued: number;
  published: number;
  failed: number;
  lastPublishedAt: string | null;
}> {
  const [grouped, last] = await Promise.all([
    // Temizlenen (gizlenen) geçmiş sayaçlara girmez: panel "paylaşılan 0" göstermeli.
    prisma.socialPost.groupBy({ by: ["status"], where: { clearedAt: null }, _count: { _all: true } }),
    prisma.socialPost.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
  ]);
  const count = (status: string) =>
    grouped.find((g) => g.status === status)?._count._all ?? 0;

  return {
    draft: count("DRAFT"),
    manual: count("MANUAL"),
    // Gönderim anındaki kayıt da kullanıcı için "sırada" demektir.
    queued: count("QUEUED") + count("PUBLISHING"),
    published: count("PUBLISHED"),
    failed: count("FAILED"),
    lastPublishedAt: last?.publishedAt?.toISOString() ?? null,
  };
}

export async function listPosts(limit = 50) {
  return prisma.socialPost.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 200) });
}
