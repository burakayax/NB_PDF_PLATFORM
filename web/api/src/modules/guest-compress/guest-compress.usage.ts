import { prisma } from "../../lib/prisma.js";

/**
 * MİSAFİR PDF SIKIŞTIR — günlük hak sayacı (Postgres; sunucu örnekleri arasında paylaşılır,
 * yeniden dağıtımda SIFIRLANMAZ).
 *
 * ŞEMA DEĞİŞİKLİĞİ YOK: PDF Düzenle'nin günlük sayaç tablosu (`EditorDownloadUsage`: idKey+day+count)
 * ad alanlı anahtarla yeniden kullanılır:
 *   "gc:g:<ipÖzeti>" → kişi başı,  "gc:global" → toplam.
 * `gc:` öneki PDF Düzenle'nin "u:" / "g:" anahtarlarıyla çakışmayı imkânsız kılar.
 *
 * Artırım tek atomik `updateMany ... WHERE count < limit` ile yapılır: eşzamanlı isteklerde limit aşılamaz.
 * Gün sınırı Europe/Istanbul (uygulamanın geri kalanıyla aynı).
 */

const TZ = "Europe/Istanbul";
export const GLOBAL_ID = "gc:global";
const PERSON_RE = /^g:[0-9a-f]{32}$/;

/** Python'un gönderdiği kişi anahtarını ("g:<32 hex>") doğrular; geçersizse null. */
export function personIdKey(key: string): string | null {
  return PERSON_RE.test(key) ? `gc:${key}` : null;
}

function tzOffsetMs(timezone: string, at: Date): number {
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const local = new Date(at.toLocaleString("en-US", { timeZone: timezone })).getTime();
  return local - utc;
}

/** "YYYY-MM-DD" (Europe/Istanbul). */
export function istanbulDay(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Bir sonraki gece yarısı (Europe/Istanbul) — ISO 8601. */
export function nextMidnightIstanbulIso(at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const localMidnightUtc = Date.UTC(get("year"), get("month") - 1, get("day") + 1, 0, 0, 0);
  return new Date(localMidnightUtc - tzOffsetMs(TZ, at)).toISOString();
}

export type UsageDecision = { allowed: boolean; used: number; limit: number; resetAt: string };

export async function peekGuestCompress(idKey: string): Promise<number> {
  const row = await prisma.editorDownloadUsage.findUnique({ where: { idKey_day: { idKey, day: istanbulDay() } } });
  return row?.count ?? 0;
}

/**
 * Hakkı atomik olarak kontrol edip düşer. `limit <= 0` → KAPALI (izin verilmez); bu sayaçta
 * "0 = sınırsız" anlamı yoktur.
 */
export async function consumeGuestCompress(idKey: string, limit: number): Promise<UsageDecision> {
  const day = istanbulDay();
  const resetAt = nextMidnightIstanbulIso();
  if (limit <= 0) return { allowed: false, used: await peekGuestCompress(idKey), limit, resetAt };

  const decision = await prisma.$transaction(async (tx) => {
    await tx.editorDownloadUsage.upsert({
      where: { idKey_day: { idKey, day } },
      create: { idKey, day, count: 0 },
      update: {},
    });
    const upd = await tx.editorDownloadUsage.updateMany({
      where: { idKey, day, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    const row = await tx.editorDownloadUsage.findUnique({ where: { idKey_day: { idKey, day } } });
    return { allowed: upd.count > 0, used: row?.count ?? 0 };
  });
  return { allowed: decision.allowed, used: decision.used, limit, resetAt };
}

/** İşlem başarısız olduysa hakkı geri verir (sayaç 0'ın altına inmez). */
export async function refundGuestCompress(idKey: string): Promise<void> {
  await prisma.editorDownloadUsage.updateMany({
    where: { idKey, day: istanbulDay(), count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}

/** Yönetim paneli özeti: bugünkü toplam misafir işlemi ve kaç farklı ziyaretçi kullandı. */
export async function guestCompressToday(): Promise<{ operations: number; visitors: number }> {
  const day = istanbulDay();
  const [global, visitors] = await Promise.all([
    prisma.editorDownloadUsage.findUnique({ where: { idKey_day: { idKey: GLOBAL_ID, day } } }),
    prisma.editorDownloadUsage.count({ where: { day, idKey: { startsWith: "gc:g:" }, count: { gt: 0 } } }),
  ]);
  return { operations: global?.count ?? 0, visitors };
}
