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

import { Prisma } from "@prisma/client";
import type { SocialAccount, SocialPlatform } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { decryptField, encryptField } from "../../lib/encryption.js";
import { getSettingWithFallback, setSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";
import { logError } from "../../lib/app-logger.js";
import { logger } from "../../lib/file-log.js";
import { fetchPairedFeedItems } from "./rss.service.js";
import { keywordsFor } from "./keywords.service.js";
import { writePostBodies } from "./copy.service.js";
import { PUBLISHERS, VERIFIERS } from "./platforms/index.js";
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
  /** Gönderiler çift dilli mi yazılsın (İngilizce üstte, Türkçe altta)? */
  bilingual: boolean;
  /** Çift dil sığmayan ağlarda (X) kullanılacak dil. */
  singleLang: "tr" | "en";
  /** Etiketler için internette canlı araştırma yapılsın mı? (Ücretli) */
  researchKeywords: boolean;
};

const DEFAULT_CONFIG: SocialAutomationConfig = {
  enabled: false,
  hour: 10,
  minute: 0,
  timeZone: "Europe/Istanbul",
  recycleOldPosts: true,
  bilingual: true,
  singleLang: "en",
  researchKeywords: true,
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
    bilingual: raw.bilingual !== false,
    singleLang: raw.singleLang === "tr" ? "tr" : "en",
    researchKeywords: raw.researchKeywords !== false,
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

    const today = resolve(0);
    return today.getTime() > from.getTime() ? today : resolve(1);
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

/** Görsel seçimi: platformun istediği kesim yoksa elde olana düşülür. */
function pickImage(item: FeedItem, platform: SocialPlatform): string | null {
  const preferred = PLATFORM_SPECS[platform].imageFormat;
  return item.images[preferred] ?? item.images.wide ?? item.images.square ?? item.images.tall ?? null;
}

/**
 * Bir sonraki paylaşılacak yazıyı seçer.
 *
 * Önce hiç paylaşılmamış en YENİ yazıya bakılır. Hepsi paylaşılmışsa ve geri
 * dönüşüm açıksa, en uzun süredir paylaşılmayan yazı yeniden gündeme getirilir
 * (yeni içerik olmayan günlerde hesap sessiz kalmasın).
 */
async function pickNextItem(
  items: FeedItem[],
  platform: SocialPlatform,
  recycle: boolean,
): Promise<FeedItem | null> {
  if (items.length === 0) return null;

  const seen = await prisma.socialPost.findMany({
    where: { platform, guid: { in: items.map((i) => i.guid) } },
    select: { guid: true, createdAt: true },
  });
  // Bir yazı birden çok kez paylaşılmış olabilir; sıralama için EN SON paylaşım
  // anı geçerlidir. İlk kaydı tutmak, aylar önce bir kez paylaşılıp dün tekrar
  // paylaşılmış bir yazıyı "en eski" sayıp başa almaya yol açardı.
  const seenMap = new Map<string, number>();
  for (const row of seen) {
    const at = row.createdAt.getTime();
    seenMap.set(row.guid, Math.max(seenMap.get(row.guid) ?? 0, at));
  }

  const fresh = items.find((i) => !seenMap.has(i.guid));
  if (fresh) return fresh;
  if (!recycle) return null;

  return items.slice().sort((a, b) => (seenMap.get(a.guid) ?? 0) - (seenMap.get(b.guid) ?? 0))[0] ?? null;
}

export type QueueResult = {
  queued: { platform: SocialPlatform; title: string; body: string; imageUrl: string | null }[];
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
export async function queueDailyPosts(scheduledAt: Date, hold = false): Promise<QueueResult> {
  const config = await readSocialConfig();
  const dayKey = calendarDayKey(scheduledAt, config.timeZone);
  const accounts = await readyAccounts();
  const result: QueueResult = { queued: [], skipped: [] };

  if (accounts.size === 0) {
    result.skipped.push({ platform: null, reason: "Bağlı ve paylaşıma açık hesap yok" });
    return result;
  }

  const items = await fetchPairedFeedItems(PRIMARY_FEED_LANG);
  if (items.length === 0) {
    result.skipped.push({ platform: null, reason: "Beslemede paylaşılacak yazı bulunamadı" });
    return result;
  }

  // Platform başına ayrı seçim: bir ağ yeni eklendiğinde geçmişi ondan bağımsız
  // ilerlesin, hepsi aynı yazıda kilitlenmesin.
  const targets: { platform: SocialPlatform; item: FeedItem }[] = [];
  for (const platform of accounts.keys()) {
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
    });
    for (const platform of platforms) {
      const imageUrl = pickImage(item, platform);
      try {
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
            status: hold ? "DRAFT" : "QUEUED",
          },
        });
        result.queued.push({ platform, title: item.title, body: bodies[platform], imageUrl });
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
        lastError: null,
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
  if (ok) return { ok: true, error: null };
  const after = await prisma.socialPost.findUnique({ where: { id: postId }, select: { lastError: true } });
  return { ok: false, error: after?.lastError ?? "Yayınlanamadı" };
}

export async function deletePost(postId: string): Promise<void> {
  await prisma.socialPost.deleteMany({ where: { id: postId, status: { not: "PUBLISHED" } } });
}

export async function updatePostBody(postId: string, body: string): Promise<void> {
  await prisma.socialPost.updateMany({
    where: { id: postId, status: { in: ["DRAFT", "QUEUED", "FAILED"] } },
    data: { body: body.trim(), lastError: null },
  });
}

/** Panel özeti: kuyruk ve geçmiş sayıları. */
export async function postStats(): Promise<{
  draft: number;
  queued: number;
  published: number;
  failed: number;
  lastPublishedAt: string | null;
}> {
  const [grouped, last] = await Promise.all([
    prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
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
