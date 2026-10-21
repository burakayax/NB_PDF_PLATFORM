import { createHash } from "node:crypto";
import type { Severity } from "./autoheal.config.js";

/**
 * HATA ANALİZİ — saf işlevler (veritabanı yok, test edilebilir).
 *
 * Amaç: ham hata satırlarını (ClientErrorLog) "olaylara" (aynı hata = tek olay) çevirmek,
 * gerçek olmayanları (eklenti, bot, enjekte betik, bilinen tarayıcı gürültüsü) elemek ve
 * kalan olaylara önem derecesi vermek.
 */
export type RawErrorRow = {
  message: string;
  source: string | null;
  stack: string | null;
  url: string | null;
  userAgent: string | null;
  userId: string | null;
  createdAt: Date;
};

export type NoiseReason =
  | "extension"
  | "injected-script"
  | "bot"
  | "browser-noise"
  | "cross-origin-script";

const BROWSER_NOISE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /^Unhandled promise rejection$/i,
  /The operation was aborted/i,
  /AbortError/i,
  /Failed to fetch dynamically imported module/i, // yeni yayın sonrası eski sekme; sayfa kendini yeniler
  /Loading chunk \d+ failed/i,
  /Load failed$/i, // Safari ağ kopması
  /NetworkError when attempting to fetch/i,
];

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview/i;

/** Kritik akışlar: bunlarda sunucu hatası tek başına bile ciddiye alınır. */
export const CRITICAL_PATH = /\/api\/(auth|payment|subscription|entitlement|download|pdf\/result|health)/i;

export function noiseReason(row: RawErrorRow): NoiseReason | null {
  const hay = `${row.source ?? ""}\n${row.stack ?? ""}`;
  if (/(chrome|moz|safari|edge)-extension:\/\//i.test(hay) || /extension:\/\//i.test(hay)) return "extension";
  if (row.userAgent && BOT_UA.test(row.userAgent)) return "bot";
  if (BROWSER_NOISE.some((re) => re.test(row.message))) return "browser-noise";

  const frames = (row.stack ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at ") || l.includes("@"));
  // Tüm çerçeveler "<anonymous>" ise kod sitenin paketinden değil, konsol/eklenti/eval'den geliyor.
  if (frames.length > 0 && frames.every((f) => /<anonymous>/.test(f) && !/https?:\/\//.test(f))) {
    return "injected-script";
  }
  // Başka bir alan adından yüklenen betik hatası (reklam/eklenti): sitemizin kaynağı değil.
  if (row.source && /^https?:\/\//i.test(row.source)) {
    try {
      const host = new URL(row.source).hostname;
      if (!/(^|\.)pdfplatform\.app$/i.test(host) && !/onrender\.com$/i.test(host) && host !== "localhost") {
        return "cross-origin-script";
      }
    } catch {
      /* geçersiz adres: gürültü sayma */
    }
  }
  return null;
}

/** Mesajdaki değişken parçaları (sayı, kimlik, adres) silip aynı hatayı tek imzada toplar. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function signatureOf(row: Pick<RawErrorRow, "message" | "source">): string {
  const src = (row.source ?? "").replace(/https?:\/\/[^/]+/i, "").replace(/\?.*$/, "").replace(/-[A-Za-z0-9_]{6,}(\.\w+)$/, "$1")
    .replace(/\bc[a-z0-9]{20,}\b/g, "<id>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
    .replace(/\d+/g, "#");
  return createHash("sha1").update(`${src}|${normalizeMessage(row.message)}`).digest("hex").slice(0, 16);
}

export function isServerError(row: Pick<RawErrorRow, "source">): boolean {
  return (row.source ?? "").startsWith("server:");
}

export type WindowStats = {
  /** Pencere içindeki toplam hata sayısı. */
  count: number;
  /** Pencere içindeki farklı ziyaretçi sayısı (üye kimliği, yoksa tarayıcı bilgisi). */
  visitors: number;
  server: boolean;
  criticalPath: boolean;
};

export function visitorKey(row: Pick<RawErrorRow, "userId" | "userAgent">): string {
  return row.userId ?? `ua:${row.userAgent ?? "?"}`;
}

/**
 * Önem derecesi.
 *  - critical: kritik akışta sunucu hatası tekrarlıyor, ya da çok sayıda farklı ziyaretçide aynı hata.
 *  - high:     kritik akışta sunucu hatası, ya da aynı hata birkaç ziyaretçide sık görülüyor.
 *  - medium:   birden fazla ziyaretçi ya da sık tekrar.
 *  - low:      tek ziyaretçi, seyrek.
 */
export function severityOf(s: WindowStats): Severity {
  if (s.server && s.criticalPath && s.count >= 5) return "critical";
  if (s.visitors >= 10) return "critical";
  if (s.server && s.criticalPath && s.count >= 2) return "high";
  if (s.server && s.count >= 10) return "high";
  if (s.visitors >= 3 && s.count >= 10) return "high";
  if (s.visitors >= 3 || s.count >= 5) return "medium";
  return "low";
}

const ORDER: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export function severityAtLeast(a: Severity, min: Severity): boolean {
  return ORDER[a] >= ORDER[min];
}
export function maxSeverity(a: Severity, b: Severity): Severity {
  return ORDER[a] >= ORDER[b] ? a : b;
}

export type IncidentStatus = "open" | "ignored" | "resolved";

export type Incident = {
  id: string;
  message: string;
  source: string | null;
  url: string | null;
  stack: string | null;
  server: boolean;
  severity: Severity;
  /** Şimdiye kadarki toplam hata sayısı (gürültü hariç). */
  count: number;
  /** Son pencerede farklı ziyaretçi sayısı. */
  visitors: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: IncidentStatus;
  /** Bu olay için en son e-posta gönderilen önem derecesi (yoksa hiç gönderilmedi). */
  notifiedSeverity: Severity | null;
  notifiedAt: string | null;
};

export type TriageResult = {
  incidents: Incident[];
  noise: Record<NoiseReason, number>;
};

/**
 * `rows` son pencerenin (ör. 30 dk) satırları; `prev` önceki durumdaki olaylar.
 * Sayaç (count) yalnızca `cursor` sonrası yeni satırlarla artar; önem derecesi pencere istatistiğinden gelir.
 */
export function triage(rows: RawErrorRow[], prev: Incident[], cursor: Date, now: Date): TriageResult {
  const noise: Record<NoiseReason, number> = {
    extension: 0,
    "injected-script": 0,
    bot: 0,
    "browser-noise": 0,
    "cross-origin-script": 0,
  };
  const byId = new Map<string, Incident>(prev.map((i) => [i.id, i]));
  const groups = new Map<string, RawErrorRow[]>();

  for (const row of rows) {
    const why = noiseReason(row);
    if (why) {
      if (row.createdAt > cursor) noise[why] += 1;
      continue;
    }
    const id = signatureOf(row);
    const g = groups.get(id);
    if (g) g.push(row);
    else groups.set(id, [row]);
  }

  for (const [id, list] of groups) {
    const newCount = list.filter((r) => r.createdAt > cursor).length;
    const last = list.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b));
    const first = list.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
    const stats: WindowStats = {
      count: list.length,
      visitors: new Set(list.map(visitorKey)).size,
      server: isServerError(last),
      criticalPath: CRITICAL_PATH.test(`${last.source ?? ""} ${last.url ?? ""}`),
    };
    const sev = severityOf(stats);
    const existing = byId.get(id);
    if (existing) {
      existing.count += newCount;
      existing.visitors = stats.visitors;
      existing.lastSeenAt = last.createdAt.toISOString();
      existing.severity = existing.status === "open" || newCount > 0 ? sev : existing.severity;
      // Çözüldü/yok sayıldı denmiş olay yeniden ciddi şekilde patlarsa tekrar açılır.
      if (existing.status !== "open" && newCount > 0 && severityAtLeast(sev, "high")) existing.status = "open";
    } else {
      byId.set(id, {
        id,
        message: last.message.slice(0, 300),
        source: last.source,
        url: last.url,
        stack: last.stack ? last.stack.slice(0, 1500) : null,
        server: stats.server,
        severity: sev,
        count: newCount || list.length,
        visitors: stats.visitors,
        firstSeenAt: first.createdAt.toISOString(),
        lastSeenAt: last.createdAt.toISOString(),
        status: "open",
        notifiedSeverity: null,
        notifiedAt: null,
      });
    }
  }

  // 30 gündür görülmemiş olayları listeden çıkar; en fazla 100 olay tut.
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const incidents = [...byId.values()]
    .filter((i) => new Date(i.lastSeenAt).getTime() >= cutoff)
    .sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1))
    .slice(0, 100);
  return { incidents, noise };
}
