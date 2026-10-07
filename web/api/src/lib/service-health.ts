import { prisma } from "./prisma.js";

/**
 * HİZMET SAĞLIK KAYDI — kendi kesinti/hata kaydımız (dış izleyiciden bağımsız).
 *
 * Bileşenler: "api" (bu servis), "db" (veritabanı), "pdf" (PDF API; kendisi her dakika kalp atışı gönderir).
 * Yazma kuralı: durum DEĞİŞİNCE hemen, değişmezse en çok 10 dakikada bir ("hâlâ ayaktayım" izi). Yeniden başlatma
 * sonrası ilk kayıt hemen yazılır → yeniden başlatmalar kayıtta görünür.
 * Kayıtlar kişisel veri içermez (bileşen, durum, zaman, yol, durum kodu).
 *
 * Kayıt BOŞLUĞU da bilgidir: bu servis kapalıyken hiçbir kayıt yazılamaz; boşluk "sinyal yok" olarak raporlanır.
 */

export type HealthComponent = "api" | "db" | "pdf";

export const HEARTBEAT_WRITE_INTERVAL_MS = 10 * 60 * 1000;
/** Bu süreden uzun sessizlik = "sinyal yok" (kesinti veya kayıt boşluğu). */
export const MAX_SILENCE_MS = 15 * 60 * 1000;
const FAILURE_THROTTLE_MS = 30_000;

type State = { ok: boolean; writtenAt: number };
const lastState = new Map<HealthComponent, State>();
const lastFailureWrite = new Map<string, number>();
let lastPdfHeartbeatAt: number | null = null;
const processStartedAt = Date.now();

/** Test için sıfırlama. */
export function __resetServiceHealthState() {
  lastState.clear();
  lastFailureWrite.clear();
  lastPdfHeartbeatAt = null;
}

/** Bir bileşenin durumunu kaydeder (değişim veya 10 dk heartbeat kuralıyla). Hata yutulur: kayıt asla işi bozmaz. */
export async function recordHealth(component: HealthComponent, ok: boolean, opts?: { latencyMs?: number; detail?: string }, now = Date.now()): Promise<boolean> {
  const prev = lastState.get(component);
  const due = !prev || prev.ok !== ok || now - prev.writtenAt >= HEARTBEAT_WRITE_INTERVAL_MS;
  if (!due) return false;
  lastState.set(component, { ok, writtenAt: now });
  try {
    await prisma.serviceHealthEvent.create({
      data: {
        component,
        kind: "check",
        ok,
        latencyMs: opts?.latencyMs ?? null,
        detail: opts?.detail ? opts.detail.slice(0, 300) : null,
        at: new Date(now),
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Yoldaki uzun kimlik parçalarını maskeler; sorgu dizesi atılır. */
export function normalizePath(path: string): string {
  const clean = path.split("?")[0] ?? "";
  return clean
    .split("/")
    .map((seg) => (/^(?:[0-9a-fA-F]{16,}|[0-9a-fA-F-]{32,}|(?=.*\d)[A-Za-z0-9_-]{24,})$/.test(seg) ? ":id" : seg))
    .join("/")
    .slice(0, 200);
}

/** 5xx olayını kaydeder (aynı yol+durum için en çok 30 sn'de bir). */
export async function recordHttpFailure(component: HealthComponent, path: string, status: number, now = Date.now()): Promise<boolean> {
  const p = normalizePath(path);
  const key = `${component}|${p}|${status}`;
  if (now - (lastFailureWrite.get(key) ?? 0) < FAILURE_THROTTLE_MS) return false;
  lastFailureWrite.set(key, now);
  if (lastFailureWrite.size > 1000) lastFailureWrite.clear();
  try {
    await prisma.serviceHealthEvent.create({
      data: { component, kind: "http_5xx", ok: false, path: p, status, at: new Date(now) },
    });
    return true;
  } catch {
    return false;
  }
}

/** PDF API kalp atışı geldi. */
export async function notePdfHeartbeat(ok = true, latencyMs?: number, now = Date.now()) {
  lastPdfHeartbeatAt = now;
  await recordHealth("pdf", ok, { latencyMs }, now);
}

/** Her dakika çağrılır: PDF API'den 3 dakikadır kalp atışı gelmiyorsa "kapalı" kaydı düşer. */
export async function checkPdfHeartbeatMissing(now = Date.now()): Promise<void> {
  const reference = lastPdfHeartbeatAt ?? processStartedAt; // Node yeni açıldıysa PDF API'ye 3 dk süre tanı
  if (now - reference >= 3 * 60 * 1000) {
    await recordHealth("pdf", false, { detail: "heartbeat missing" }, now);
  }
}

// ───────────────── Hesaplama (saf fonksiyon)

export type HealthEventRow = { at: Date; component: string; kind: string; ok: boolean; path?: string | null; status?: number | null };

export type Incident = { start: string; end: string; minutes: number; type: "down" | "no-signal" };
export type ComponentStatus = { uptimePct: number | null; okMinutes: number; downMinutes: number; noSignalMinutes: number; incidents: Incident[] };
export type ServiceStatus = {
  from: string;
  to: string;
  components: Record<HealthComponent, ComponentStatus>;
  failures: Array<{ path: string; status: number; count: number; first: string; last: string }>;
};

const min = (ms: number) => Math.round((ms / 60_000) * 10) / 10;

function computeComponent(events: HealthEventRow[], from: number, to: number): ComponentStatus {
  const checks = events.filter((e) => e.kind === "check").sort((a, b) => a.at.getTime() - b.at.getTime());
  let ok = 0;
  let down = 0;
  let silent = 0;
  let dataStart: number | null = null;
  const incidents: Incident[] = [];
  const pushIncident = (type: Incident["type"], s: number, e: number) => {
    if (e - s < 60_000) return;
    const last = incidents[incidents.length - 1];
    if (last && last.type === type && new Date(last.end).getTime() === s) {
      last.end = new Date(e).toISOString();
      last.minutes = min(e - new Date(last.start).getTime());
      return;
    }
    incidents.push({ type, start: new Date(s).toISOString(), end: new Date(e).toISOString(), minutes: min(e - s) });
  };

  for (let i = 0; i < checks.length; i++) {
    const ev = checks[i] as HealthEventRow;
    const t = ev.at.getTime();
    const next = checks[i + 1]?.at.getTime() ?? to;
    const segStart = Math.max(t, from);
    const segEnd = Math.min(next, to);
    if (segEnd <= segStart) continue;
    if (dataStart === null) dataStart = segStart;
    const len = segEnd - segStart;
    if (!ev.ok) {
      down += len;
      pushIncident("down", segStart, segEnd);
    } else {
      // "ayaktayım" izi en çok MAX_SILENCE_MS geçerli; sonrası sinyal yok
      const validUntil = t + MAX_SILENCE_MS;
      const okEnd = Math.min(segEnd, Math.max(segStart, validUntil));
      ok += okEnd - segStart;
      if (segEnd > okEnd) {
        silent += segEnd - okEnd;
        pushIncident("no-signal", okEnd, segEnd);
      }
    }
  }
  const total = ok + down + silent;
  return {
    uptimePct: total > 0 ? Math.round((ok / total) * 10000) / 100 : null,
    okMinutes: min(ok),
    downMinutes: min(down),
    noSignalMinutes: min(silent),
    incidents,
  };
}

/** `events`, pencere başından ÖNCEKİ son kaydı da içermelidir (durum devamı için). */
export function computeServiceStatus(events: HealthEventRow[], from: Date, to: Date): ServiceStatus {
  const f = from.getTime();
  const t = to.getTime();
  const comps: HealthComponent[] = ["api", "db", "pdf"];
  const components = Object.fromEntries(comps.map((c) => [c, computeComponent(events.filter((e) => e.component === c), f, t)])) as Record<HealthComponent, ComponentStatus>;

  const groups = new Map<string, { path: string; status: number; count: number; first: number; last: number }>();
  for (const e of events) {
    if (e.kind !== "http_5xx" || e.at.getTime() < f || e.at.getTime() > t) continue;
    const key = `${e.path}|${e.status}`;
    const g = groups.get(key) ?? { path: e.path ?? "", status: e.status ?? 0, count: 0, first: e.at.getTime(), last: e.at.getTime() };
    g.count += 1;
    g.first = Math.min(g.first, e.at.getTime());
    g.last = Math.max(g.last, e.at.getTime());
    groups.set(key, g);
  }
  const failures = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map((g) => ({ path: g.path, status: g.status, count: g.count, first: new Date(g.first).toISOString(), last: new Date(g.last).toISOString() }));

  return { from: from.toISOString(), to: to.toISOString(), components, failures };
}

/** Veritabanından çekip hesaplar (pencere başından 1 gün öncesine kadar bakarak durum devamını yakalar). */
export async function loadServiceStatus(from: Date, to: Date): Promise<ServiceStatus> {
  const lookback = new Date(from.getTime() - 24 * 3600 * 1000);
  const rows = await prisma.serviceHealthEvent.findMany({
    where: { at: { gte: lookback, lte: to } },
    orderBy: { at: "asc" },
    take: 50_000,
    select: { at: true, component: true, kind: true, ok: true, path: true, status: true },
  });
  return computeServiceStatus(rows, from, to);
}
