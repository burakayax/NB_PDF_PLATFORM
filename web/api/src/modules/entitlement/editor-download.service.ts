import { prisma } from "../../lib/prisma.js";
import { readEditorLimits } from "../editor-limits/editor-limits.config.js";

/**
 * PDF Düzenle aracı — günlük düzenleme hakkı sayacı (Postgres, instance'lar arası paylaşılır).
 * Hak, kullanıcı «PDF'i Hazırla» dediği anda düşer (indirmede değil).
 *
 * Kimlik (idKey) Python (FastAPI) tarafında GÜVENİLİR biçimde türetilir:
 *   - "u:<userId>"  → oturum açmış FREE ya da STARTER kullanıcı (Başlangıç daha yüksek hak alır)
 *   - "g:<ipHash>"  → misafir (gerçek istemci IP'sinin hash'i)
 * PRO/PLUS/BUSINESS/ADMIN hiç çağrılmaz (Python sınırsız kabul edip atlar).
 *
 * Limit, idKey ÖN EKİNDEN türetilir (istemciye GÜVENİLMEZ). Sayaç Europe/Istanbul
 * gün sınırında sıfırlanır. Artırım tek atomik `UPDATE ... WHERE count < limit` ile
 * yapılır → eşzamanlı indirmelerde limit aşılamaz.
 */

const TZ = "Europe/Istanbul";

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

/** `plan` verilirse (PDF servisi çağrısı) Başlangıç planı daha yüksek günlük hak alır. */
export async function limitForKey(idKey: string, plan?: string): Promise<number> {
  const cfg = await readEditorLimits(); // yönetim panelinden (önbellekli); 0 = o grup için KAPALI
  if (idKey.startsWith("g:")) return cfg.guest;
  return plan === "STARTER" ? cfg.starter : cfg.free;
}

/** Bugünkü kullanımı DÜŞMEDEN okur — işlem başlamadan önce "hak var mı?" ön kontrolü için. */
export async function peekEditorDownload(idKey: string, plan?: string): Promise<EditorDownloadDecision> {
  const guest = idKey.startsWith("g:");
  const limit = await limitForKey(idKey, plan);
  const resetAt = nextMidnightIstanbulIso();
  if (limit <= 0) return { allowed: false, used: 0, limit, resetAt, guest }; // 0 = kapalı
  const row = await prisma.editorDownloadUsage.findUnique({
    where: { idKey_day: { idKey, day: istanbulDay() } },
  });
  const used = row?.count ?? 0;
  return { allowed: used < limit, used, limit, resetAt, guest };
}

/**
 * Günlük düzenleme hakkını atomik olarak kontrol edip düşer.
 * Limit dolmuşsa `allowed:false` (sayaç artmaz).
 */
export async function consumeEditorDownload(idKey: string, plan?: string): Promise<EditorDownloadDecision> {
  const guest = idKey.startsWith("g:");
  const limit = await limitForKey(idKey, plan);
  const day = istanbulDay();
  const resetAt = nextMidnightIstanbulIso();

  // 0 = bu grup için düzenleme kapalı (panelden acil kapatma). Sınırsız planlar zaten buraya gelmez.
  if (limit <= 0) return { allowed: false, used: 0, limit, resetAt, guest };

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
