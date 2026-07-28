import { prisma } from "../../lib/prisma.js";

/**
 * PDF Düzenle aracı — günlük indirme sayacı (Postgres, instance'lar arası paylaşılır).
 *
 * Kimlik (idKey) Python (FastAPI) tarafında GÜVENİLİR biçimde türetilir:
 *   - "u:<userId>"  → oturum açmış FREE kullanıcı
 *   - "g:<ipHash>"  → misafir (gerçek istemci IP'sinin hash'i)
 * PRO/PLUS/BUSINESS/ADMIN hiç çağrılmaz (Python sınırsız kabul edip atlar).
 *
 * Limit, idKey ÖN EKİNDEN türetilir (istemciye GÜVENİLMEZ). Sayaç Europe/Istanbul
 * gün sınırında sıfırlanır. Artırım tek atomik `UPDATE ... WHERE count < limit` ile
 * yapılır → eşzamanlı indirmelerde limit aşılamaz.
 */

const TZ = "Europe/Istanbul";
const GUEST_DAILY_LIMIT = Number(process.env.EDITOR_GUEST_DAILY_LIMIT ?? 2);
const FREE_DAILY_LIMIT = Number(process.env.EDITOR_FREE_DAILY_LIMIT ?? 5);

function tzOffsetMs(timezone: string, at: Date): number {
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const local = new Date(at.toLocaleString("en-US", { timeZone: timezone })).getTime();
  return local - utc;
}

/** "YYYY-MM-DD" (Europe/Istanbul). */
function istanbulDay(at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Bir sonraki gece yarısı (Europe/Istanbul) — ISO 8601. */
function nextMidnightIstanbulIso(at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const localMidnightUtc = Date.UTC(get("year"), get("month") - 1, get("day") + 1, 0, 0, 0);
  return new Date(localMidnightUtc - tzOffsetMs(TZ, at)).toISOString();
}

export type EditorDownloadDecision = {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
  guest: boolean;
};

export function limitForKey(idKey: string): number {
  return idKey.startsWith("g:") ? GUEST_DAILY_LIMIT : FREE_DAILY_LIMIT;
}

/**
 * Günlük indirme hakkını atomik olarak kontrol edip düşer.
 * Limit dolmuşsa `allowed:false` (sayaç artmaz).
 */
export async function consumeEditorDownload(idKey: string): Promise<EditorDownloadDecision> {
  const guest = idKey.startsWith("g:");
  const limit = limitForKey(idKey);
  const day = istanbulDay();
  const resetAt = nextMidnightIstanbulIso();

  // Sınırsız (limit<=0) — teorik; normalde çağrılmaz.
  if (limit <= 0) return { allowed: true, used: 0, limit, resetAt, guest };

  const decision = await prisma.$transaction(async (tx) => {
    // Satır yoksa 0 ile oluştur (varsa dokunma).
    await tx.editorDownloadUsage.upsert({
      where: { idKey_day: { idKey, day } },
      create: { idKey, day, count: 0 },
      update: {},
    });
    // Atomik koşullu artırım — Postgres satır kilidi ile limit aşımını engeller.
    const upd = await tx.editorDownloadUsage.updateMany({
      where: { idKey, day, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    const row = await tx.editorDownloadUsage.findUnique({
      where: { idKey_day: { idKey, day } },
    });
    const used = row?.count ?? 0;
    return { allowed: upd.count > 0, used };
  });

  return { allowed: decision.allowed, used: decision.used, limit, resetAt, guest };
}
