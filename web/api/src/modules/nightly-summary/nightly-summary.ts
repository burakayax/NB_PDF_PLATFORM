import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { buildSummary, trDayStart } from "../admin/payments-summary.admin.js";
import { estimateCostUsd } from "../ai/ai-usage.js";
import { loadServiceStatus } from "../../lib/service-health.js";
import { dailySummary as gscDailySummary } from "../social/gsc.service.js";

/**
 * GECELİK ÖZET (yalnız okuma, iç rapor: yalnız sahibin okuyabildiği özel kovaya yazılır).
 * Kişisel veri YOK: e-posta, isim, IP yok; yalnız toplam sayılar. Küçük sayılar MASKELENMEZ (iç rapor);
 * rapor ileride dışarı paylaşılacaksa `maskForSharing` kullanılmalı.
 * Yönetici (ADMIN) hesapları tüm sayılardan hariç tutulur; hariç tutulan hesap sayısı ayrı alandır.
 * Yetki: `Authorization: Bearer <NIGHTLY_SUMMARY_TOKEN>`; token tanımlı değilse uç KAPALI (404).
 * Hiçbir değer günlüğe yazılmaz.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const num = (s: string | null | undefined): number => {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const cur = (c: string | null | undefined) => (c ?? "TRY").trim().toUpperCase() || "TRY";
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Dışarı paylaşılacak sürüm için: 1-4 arası sayıları "<5" yapar (iç rapor bunu KULLANMAZ). */
export const maskForSharing = (n: number): number | string => (n > 0 && n < 5 ? "<5" : n);

function tokenOk(request: Request): boolean {
  const expected = (process.env.NIGHTLY_SUMMARY_TOKEN ?? "").trim();
  if (expected.length < 32) return false;
  const h = String(request.headers.authorization ?? "");
  const provided = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function trYesterdayYmd(now = new Date()): string {
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000 - DAY_MS);
  return tr.toISOString().slice(0, 10);
}

/** Verilen gün kodundan (YYYY-MM-DD) n gün sonrasının kodu (negatif = önce). */
export function shiftYmd(ymd: string, days: number): string {
  return new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Değişim: bugünkü değer, önceki gün, fark ve önceki 7 günün ortalaması. */
export function change(value: number, previous: number, last7: number[]) {
  const diff = r1(value - previous);
  return {
    value,
    previousDay: previous,
    diff,
    trend: diff > 0 ? "↑" : diff < 0 ? "↓" : "=",
    avg7d: last7.length ? r1(last7.reduce((a, b) => a + b, 0) / last7.length) : 0,
  };
}

export type NightlySummary = Awaited<ReturnType<typeof buildNightlySummary>>;

const stripPath = (p: string) => p.split(/[?#]/)[0].slice(0, 80);

type DayCore = { newUsers: number; activeUsers: number; pageViews: number; visitors: number; paid: number; refunds: number; operations: number; aiRequests: number };

async function dayCore(ymd: string, adminIds: string[]): Promise<DayCore> {
  const start = trDayStart(ymd);
  const day = { gte: start, lt: new Date(start.getTime() + DAY_MS) };
  const notAdmin = { notIn: adminIds };
  const viewWhere = { createdAt: day, OR: [{ userId: null }, { userId: notAdmin }] };
  const [newUsers, activeUsers, pageViews, visitors, paid, refunds, operations, aiRequests] = await Promise.all([
    prisma.user.count({ where: { createdAt: day, id: notAdmin } }),
    prisma.user.count({ where: { lastLoginAt: day, id: notAdmin } }),
    prisma.pageView.count({ where: viewWhere }),
    prisma.pageView.findMany({ where: viewWhere, select: { sessionId: true }, distinct: ["sessionId"] }).then((r) => r.length),
    prisma.paymentCheckout.count({ where: { completedAt: day, userId: notAdmin } }),
    prisma.paymentCheckout.count({ where: { refundedAt: day, userId: notAdmin } }),
    prisma.operationLog.count({ where: { createdAt: day, userId: notAdmin } }),
    prisma.aiRequestLog.count({ where: { createdAt: day, userId: notAdmin } }),
  ]);
  return { newUsers, activeUsers, pageViews, visitors, paid, refunds, operations, aiRequests };
}

async function gotenbergStatus(): Promise<"ok" | "down" | "unknown"> {
  try {
    const base = process.env.PDF_BACKEND_URL ?? "http://127.0.0.1:8000";
    const res = await fetch(`${base.replace(/\/$/, "")}/api/health/deps`, { signal: AbortSignal.timeout(8000) });
    return res.ok ? "ok" : "down";
  } catch {
    return "unknown";
  }
}

export async function buildNightlySummary(ymd: string) {
  const start = trDayStart(ymd);
  const end = new Date(start.getTime() + DAY_MS); // gün sonu (Europe/Istanbul 24:00); tüm "toplam" sayılar buna göre
  const day = { gte: start, lt: end };

  const adminIds = (await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
  const notAdmin = { notIn: adminIds };

  const core = await dayCore(ymd, adminIds);
  const prevYmds = Array.from({ length: 7 }, (_, i) => shiftYmd(ymd, -(i + 1)));
  const prevCores = await Promise.all(prevYmds.map((y) => dayCore(y, adminIds)));
  const chg = (k: keyof DayCore) => change(core[k], prevCores[0][k], prevCores.map((c) => c[k]));

  const viewWhere = { createdAt: day, OR: [{ userId: null }, { userId: notAdmin }] };
  const [
    totalUsers, planGroups, activeSubscribers, newSubscriptions,
    paidRows, refundRows, paidCount2, refundCount2, pendingPayments,
    opsFailed, topTools, clientErrors,
    topPages, aiByOp, cancelGroups, serviceStatus, gotenberg, gsc,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { lt: end }, id: notAdmin } }),
    prisma.user.groupBy({ by: ["plan"], where: { createdAt: { lt: end }, id: notAdmin }, _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { lt: end }, id: notAdmin, plan: { not: "FREE" } } }),
    prisma.paymentCheckout.count({ where: { completedAt: day, userId: notAdmin, bonusAiCredits: null, cvPassHours: null, seatsOnly: false } }),
    prisma.paymentCheckout.findMany({
      where: { completedAt: day, userId: notAdmin },
      select: { completedAt: true, priceTry: true, paymentCurrency: true, invoiceStatus: true, invoice: { select: { id: true } } },
    }),
    prisma.paymentCheckout.findMany({ where: { refundedAt: day, userId: notAdmin }, select: { refundedAt: true, priceTry: true, paymentCurrency: true } }),
    // Doğrulama için bağımsız ham sayım
    prisma.paymentCheckout.count({ where: { completedAt: day, userId: notAdmin } }),
    prisma.paymentCheckout.count({ where: { refundedAt: day, userId: notAdmin } }),
    prisma.paymentCheckout.count({ where: { status: "pending", createdAt: day, userId: notAdmin } }),
    prisma.operationLog.count({ where: { createdAt: day, status: "FAILED", userId: notAdmin } }),
    prisma.operationLog.groupBy({ by: ["toolType"], where: { createdAt: day, userId: notAdmin }, _count: { _all: true }, orderBy: { _count: { toolType: "desc" } }, take: 10 }),
    prisma.clientErrorLog.count({ where: { createdAt: day } }),
    prisma.pageView.groupBy({ by: ["path"], where: viewWhere, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 8 }),
    prisma.aiRequestLog.groupBy({ by: ["op"], where: { createdAt: day, userId: notAdmin }, _count: { _all: true }, _sum: { units: true }, orderBy: { _count: { op: "desc" } } }),
    prisma.cancellationFeedback.groupBy({ by: ["reason"], where: { createdAt: day, userId: notAdmin }, _count: { _all: true } }),
    loadServiceStatus(start, end).catch(() => null),
    gotenbergStatus(),
    gscDailySummary(ymd),
  ]);

  // Yol 1: panelin kullandığı hesap (buildSummary)
  const { totals } = buildSummary(
    {
      paid: paidRows.filter((p) => p.completedAt).map((p) => ({
        at: p.completedAt as Date, amount: num(p.priceTry), currency: cur(p.paymentCurrency),
        invoiced: Boolean(p.invoice), scheduled: p.invoiceStatus === "scheduled" || p.invoiceStatus === null,
      })),
      refunds: refundRows.filter((r) => r.refundedAt).map((r) => ({ at: r.refundedAt as Date, amount: num(r.priceTry), currency: cur(r.paymentCurrency) })),
      invoices: [],
      creditNotes: [],
    },
    "day",
  );

  // Doğrulama: panel hesabının adedi == ham sayım
  const checks = [
    { name: "ödeme adedi (TL + yurt dışı)", panel: totals.paidCount + totals.foreignCount, raw: paidCount2 },
    { name: "iade adedi (TL)", panel: totals.refundedCount, raw: refundRows.filter((r) => cur(r.paymentCurrency) === "TRY").length },
    { name: "iade kayıt sayısı", panel: refundRows.length, raw: refundCount2 },
  ].map((c) => ({ ...c, ok: c.panel === c.raw }));
  const verified = checks.every((c) => c.ok);

  const aiTotal = aiByOp.reduce((a, g) => a + g._count._all, 0);
  const aiModels = await prisma.aiRequestLog.groupBy({
    by: ["model"],
    where: { createdAt: day, userId: notAdmin, inputTokens: { not: null } },
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const costs = aiModels.map((m) => (m.model ? estimateCostUsd(m.model, m._sum.inputTokens ?? 0, m._sum.outputTokens ?? 0) : null));
  const aiCostUsd = aiModels.length > 0 && costs.every((c) => c !== null) ? Math.round(costs.reduce((x, c) => x + (c ?? 0), 0) * 10000) / 10000 : null;
  const components = serviceStatus?.components;
  const serverFailures = serviceStatus ? serviceStatus.failures.reduce((a, f) => a + f.count, 0) : null;

  return {
    date: ymd,
    timezone: "Europe/Istanbul",
    generatedAt: new Date().toISOString(),
    verified,
    verification: checks,
    excluded: { adminAccounts: adminIds.length, note: "Yönetici hesapları (ve onların test ödemeleri) tüm sayılardan hariç" },
    snapshotNote: "Toplam üye ve plan dağılımı gün sonuna (24:00 TR) kadar kayıt olanları sayar; plan/abonelik durumu rapor üretildiği andaki durumdur.",
    users: { new: core.newUsers, total: totalUsers, active: core.activeUsers },
    plans: Object.fromEntries(planGroups.map((g) => [g.plan, g._count._all])),
    subscriptions: {
      activeSubscribers,
      newSubscriptions,
      cancellations: cancelGroups.reduce((a, g) => a + g._count._all, 0),
      cancellationReasons: Object.fromEntries(cancelGroups.map((g) => [g.reason, g._count._all])),
    },
    sales: {
      currencyNote: "TL ve yurt dışı ayrı tutulur; kur dönüşümü yok",
      paidCountTRY: totals.paidCount,
      paidTotalTRY: totals.paidTotal,
      refundCountTRY: totals.refundedCount,
      refundTotalTRY: totals.refundedTotal,
      netTotalTRY: totals.netTotal,
      foreignPaymentCount: totals.foreignCount,
      pendingCheckouts: pendingPayments,
    },
    traffic: {
      pageViews: core.pageViews,
      uniqueVisitors: core.visitors,
      topPages: topPages.slice(0, 5).map((t) => ({ path: stripPath(t.path), views: t._count._all })),
    },
    searchConsole: gsc,
    usage: {
      operations: core.operations,
      failedOperations: opsFailed,
      failedOperationRatePct: core.operations > 0 ? r1((opsFailed / core.operations) * 100) : 0,
      topTools: topTools.map((t) => ({ tool: t.toolType, count: t._count._all })),
    },
    ai: {
      requests: aiTotal,
      units: aiByOp.reduce((a, g) => a + (g._sum.units ?? 0), 0),
      byTool: aiByOp.map((g) => ({ tool: g.op, count: g._count._all })),
      byModel: aiModels.map((m) => ({ model: m.model ?? "bilinmiyor", requests: m._count._all, inputTokens: m._sum.inputTokens ?? 0, outputTokens: m._sum.outputTokens ?? 0 })),
      estimatedCost: aiCostUsd,
      costNote: aiCostUsd === null
        ? "Maliyet hesaplanamadı: AI_PRICE_USD_PER_MTOK (model başına 1 milyon token USD fiyatı) tanımlı değil ya da kayıt yok; token sayıları byModel alanında"
        : "Tahmini USD; token kaydı yalnız bu özellik açıldıktan sonraki isteklerde vardır",
    },
    health: {
      clientErrors,
      serverFailures,
      services: {
        api: components ? { uptimePct: components.api.uptimePct, incidents: components.api.incidents.length } : "bilinmiyor",
        database: components ? { uptimePct: components.db.uptimePct, incidents: components.db.incidents.length } : "bilinmiyor",
        pdfApi: components ? { uptimePct: components.pdf.uptimePct, incidents: components.pdf.incidents.length } : "bilinmiyor",
        gotenberg,
      },
    },
    changes: {
      newUsers: chg("newUsers"),
      activeUsers: chg("activeUsers"),
      pageViews: chg("pageViews"),
      uniqueVisitors: chg("visitors"),
      paidOrders: chg("paid"),
      refunds: chg("refunds"),
      operations: chg("operations"),
      aiRequests: chg("aiRequests"),
    },
  };
}

/** Kod bilmeyen biri için Türkçe okunabilir özet (ozet-son.md). */
export function renderMarkdown(s: NightlySummary): string {
  const t = (c: { value: number; diff: number; trend: string; avg7d: number }) =>
    `${c.value} (${c.trend} ${c.diff >= 0 ? "+" : ""}${c.diff} dünden; son 7 gün ort. ${c.avg7d})`;
  const L: string[] = [];
  L.push(`# Günlük özet: ${s.date}`, "");
  L.push(s.verified ? "✅ Sayılar iki yöntemle karşılaştırıldı, tutuyor." : "⚠️ DİKKAT: Sayılar iki yöntemde tutmuyor; rakamlara güvenmeden önce kontrol edin.");
  L.push(`(Yönetici/test hesapları sayılmadı: ${s.excluded.adminAccounts} hesap)`, "");
  L.push("## Üyeler", `- Yeni üye: ${t(s.changes.newUsers)}`, `- Giriş yapan: ${t(s.changes.activeUsers)}`, `- Toplam üye (gün sonu): ${s.users.total}`);
  L.push(`- Plan dağılımı: ${Object.entries(s.plans).map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`, "");
  const reasons = Object.entries(s.subscriptions.cancellationReasons).map(([k, v]) => `${k}: ${v}`).join(", ");
  L.push("## Abonelik ve satış", `- Aktif abone: ${s.subscriptions.activeSubscribers}`, `- Yeni abonelik: ${s.subscriptions.newSubscriptions}`, `- İptal: ${s.subscriptions.cancellations}${reasons ? ` (${reasons})` : ""}`);
  L.push(`- Ödeme: ${t(s.changes.paidOrders)}; tutar ${s.sales.paidTotalTRY} TL; iade ${s.sales.refundCountTRY} adet; net ${s.sales.netTotalTRY} TL`, `- Bekleyen ödeme: ${s.sales.pendingCheckouts}`, "");
  L.push("## Trafik", `- Sayfa görüntüleme: ${t(s.changes.pageViews)}`, `- Tekil ziyaretçi: ${t(s.changes.uniqueVisitors)}`, `- En çok bakılan: ${s.traffic.topPages.map((p) => `${p.path} (${p.views})`).join(", ") || "-"}`, "");
  L.push("## Google aramaları");
  const g = s.searchConsole;
  if (g.available) {
    L.push(`- ${g.date}: ${g.clicks} tıklama, ${g.impressions} gösterim, ortalama sıra ${g.avgPosition}`);
    L.push(`- Aramalar: ${g.topQueries.map((q) => `${q.query} (${q.clicks})`).join(", ") || "-"}`);
    L.push(`- Sayfalar: ${g.topPages.map((q) => `${q.page} (${q.clicks})`).join(", ") || "-"}`);
  } else {
    L.push(`- Veri alınamadı: ${g.reason}`);
  }
  L.push("", "## Kullanım ve yapay zekâ", `- İşlem: ${t(s.changes.operations)}; başarısız ${s.usage.failedOperations} (%${s.usage.failedOperationRatePct})`);
  L.push(`- En çok kullanılan araçlar: ${s.usage.topTools.slice(0, 5).map((x) => `${x.tool} (${x.count})`).join(", ") || "-"}`);
  L.push(`- Yapay zekâ isteği: ${t(s.changes.aiRequests)}; dağılım: ${s.ai.byTool.map((x) => `${x.tool} (${x.count})`).join(", ") || "-"}`, `- ${s.ai.costNote}`, "");
  const sv = s.health.services;
  const st = (v: unknown) => (typeof v === "string" ? v : `%${(v as { uptimePct: number | null }).uptimePct ?? "?"} ayakta, ${(v as { incidents: number }).incidents} kesinti`);
  L.push("## Sağlık", `- Sunucu hatası: ${s.health.serverFailures ?? "bilinmiyor"}; tarayıcı hatası: ${s.health.clientErrors}`);
  L.push(`- Site: ${st(sv.api)}; veritabanı: ${st(sv.database)}; PDF servisi: ${st(sv.pdfApi)}; Office dönüştürücü: ${sv.gotenberg}`, "");
  L.push(`_Üretildi: ${s.generatedAt}_`);
  return L.join("\n");
}

export async function nightlySummaryController(request: Request, response: Response) {
  if (!(process.env.NIGHTLY_SUMMARY_TOKEN ?? "").trim()) throw new HttpError(404, "Not found.");
  if (!tokenOk(request)) throw new HttpError(403, "Forbidden.");
  const q = typeof request.query.date === "string" ? request.query.date : "";
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : trYesterdayYmd();
  response.setHeader("Cache-Control", "no-store");
  const summary = await buildNightlySummary(ymd);
  if (request.query.format === "md") {
    response.type("text/markdown; charset=utf-8").status(200).send(renderMarkdown(summary));
    return;
  }
  response.status(200).json(summary);
}
