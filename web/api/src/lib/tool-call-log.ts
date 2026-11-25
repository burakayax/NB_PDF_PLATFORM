import { prisma } from "./prisma.js";
import { verifyAccessToken } from "./jwt.js";
import { normalizePath } from "./service-health.js";

/**
 * SUNUCU ARAÇ ÇAĞRISI KAYDI — PDF API'ye gelen her araç isteği için tek satır: hangi araç, kim, sonuç, süre, boyut.
 * Yazılmayanlar: dosya içeriği/adı, IP, e-posta. Kullanıcı yalnız KİMLİK ile tutulur (yönetim ekranı e-postaya çevirir).
 * Cihazda çalışan araçlar (birleştirme vb.) sunucuya hiç gitmediği için bu kayıtta YOKTUR.
 */

export type ToolCallInput = {
  tool: string;
  status: number;
  durationMs?: number;
  sizeKb?: number;
  /** PDF API'nin aldığı oturum anahtarı: burada DOĞRULANIR ve yalnız kullanıcı kimliği çıkarılır; saklanmaz. */
  token?: string;
};

/** Durum kodundan okunur sebep. Gövde okunmadığı için (içerik gizliliği) kod sınıfına göre. */
export function reasonForStatus(status: number): string | null {
  if (status < 400) return null;
  switch (status) {
    case 400: return "Geçersiz istek";
    case 401: return "Oturum yok veya süresi dolmuş";
    case 402: return "Hak/kredi yetersiz";
    case 403: return "Yetki yok (plan veya limit)";
    case 404: return "Bulunamadı";
    case 408: return "Zaman aşımı";
    case 413: return "Dosya çok büyük";
    case 415: return "Desteklenmeyen dosya türü";
    case 422: return "Dosya işlenemedi (bozuk, şifreli veya geçersiz)";
    case 429: return "Hız sınırı";
    case 503: return "Servis geçici olarak kullanılamıyor";
    case 504: return "Sunucu zaman aşımı";
    default:
      return status >= 500 ? "Sunucu hatası" : "İstek reddedildi";
  }
}

export async function recordToolCall(input: ToolCallInput, now = Date.now()): Promise<boolean> {
  let userId: string | null = null;
  if (input.token) {
    try {
      userId = verifyAccessToken(input.token).sub ?? null;
    } catch {
      userId = null; // süresi dolmuş/geçersiz anahtar: misafir sayılır
    }
  }
  try {
    await prisma.toolCallLog.create({
      data: {
        at: new Date(now),
        tool: normalizePath(input.tool),
        userId,
        guest: userId === null,
        status: input.status,
        ok: input.status < 400,
        reason: reasonForStatus(input.status),
        durationMs: input.durationMs !== undefined ? Math.round(input.durationMs) : null,
        sizeKb: input.sizeKb !== undefined ? Math.round(input.sizeKb) : null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export type ToolCallFilters = {
  hours: number;
  tool?: string | undefined;
  outcome?: "ok" | "error" | "all";
  userId?: string | undefined;
  page: number;
  pageSize: number;
};

export async function listToolCalls(f: ToolCallFilters) {
  const since = new Date(Date.now() - f.hours * 3600 * 1000);
  const where = {
    at: { gte: since },
    ...(f.tool ? { tool: f.tool } : {}),
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.outcome === "ok" ? { ok: true } : f.outcome === "error" ? { ok: false } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.toolCallLog.count({ where }),
    prisma.toolCallLog.findMany({ where, orderBy: { at: "desc" }, skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
  ]);
  const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, isVerified: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      tool: r.tool,
      who: r.userId ? (byId.get(r.userId)?.email ?? "silinmiş üye") : "misafir",
      guest: r.guest,
      verified: r.userId ? (byId.get(r.userId)?.isVerified ?? null) : null,
      status: r.status,
      ok: r.ok,
      reason: r.reason,
      durationMs: r.durationMs,
      sizeKb: r.sizeKb,
    })),
  };
}

type Group = {
  tool: string;
  total: number;
  ok: number;
  error: number;
  users: Set<string>;
  guests: number;
  reasons: Map<string, number>;
  ms: number;
  msN: number;
  lastAt: number;
};

/** Araç bazında özet: toplam, başarılı, hatalı, farklı üye, en sık hata sebebi. */
export async function summarizeToolCalls(hours: number) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await prisma.toolCallLog.findMany({
    where: { at: { gte: since } },
    select: { tool: true, ok: true, userId: true, reason: true, durationMs: true, at: true },
    take: 100_000,
  });
  const map = new Map<string, Group>();
  for (const r of rows) {
    const g: Group = map.get(r.tool) ?? { tool: r.tool, total: 0, ok: 0, error: 0, users: new Set<string>(), guests: 0, reasons: new Map<string, number>(), ms: 0, msN: 0, lastAt: 0 };
    g.total += 1;
    if (r.ok) g.ok += 1;
    else g.error += 1;
    if (r.userId) g.users.add(r.userId);
    else g.guests += 1;
    if (!r.ok && r.reason) g.reasons.set(r.reason, (g.reasons.get(r.reason) ?? 0) + 1);
    if (r.durationMs !== null) {
      g.ms += r.durationMs;
      g.msN += 1;
    }
    g.lastAt = Math.max(g.lastAt, r.at.getTime());
    map.set(r.tool, g);
  }
  return [...map.values()]
    .sort((a, b) => b.total - a.total)
    .map((g) => ({
      tool: g.tool,
      total: g.total,
      ok: g.ok,
      error: g.error,
      members: g.users.size,
      guestCalls: g.guests,
      avgMs: g.msN ? Math.round(g.ms / g.msN) : null,
      topReason: [...g.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      lastAt: new Date(g.lastAt).toISOString(),
    }));
}
