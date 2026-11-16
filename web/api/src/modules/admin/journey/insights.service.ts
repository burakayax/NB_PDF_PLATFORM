import { prisma } from "../../../lib/prisma.js";
import { parseToolUsageCountsJson } from "../../subscription/user-behavior.service.js";

/**
 * YÖNETİM PANELİ → "Ziyaretçiler ve satışlar" ekranının veri kaynağı.
 *
 * Tek istekte şunları döndürür (ekran bunları kendi içinde süzer/sayar):
 *  - `visits`: her ziyaret (tarayıcı oturumu) için nereden geldiği, ne yaptığı, giriş yapıp yapmadığı;
 *  - `payers`: gerçek ödemeler (ödeme kayıtlarından) — kim, ne aldı, nereden geldi, hangi araç ödemeye itti;
 *  - `cancellations`: abonelik iptali nedenleri;
 *  - `totals`: veritabanından kesin sayılar (ölçüm onayına bağlı olmayan: yeni üye, ödeyen).
 *
 * Yönetici hesapları (kendi testleriniz) hiçbir sayıya ve tabloya girmez.
 * Çok büyük hacimde ekran yavaşlamasın diye ziyaret sayısı sınırlıdır (`truncated`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 60_000;
const MAX_VISITS = 5_000;
const MAX_PAYERS = 300;
const MAX_CANCELLATIONS = 300;

export type InsightEvent = { name: string; toolId: string | null; extra: string | null; createdAt: string };

export type InsightVisit = {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  userId: string | null;
  who: string | null;
  isMember: boolean;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  pageCount: number;
  events: InsightEvent[];
};

export type InsightSource = {
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  firstVisitAt: string | null;
};

export type InsightPayer = {
  checkoutId: string;
  userId: string;
  who: string;
  plan: string;
  /** plan | seats | ai_credit | cv_pass */
  kind: string;
  billingCycle: string;
  amount: string;
  currency: string;
  paidAt: string;
  signedUpAt: string;
  daysToPay: number;
  source: InsightSource | null;
  /** Ödeme ekranını açmadan önce hangi araç yüzünden hak duvarına çarptı / fiyatlara baktı. */
  triggerTool: string | null;
  /** Hesapta en çok kullandığı araçlar (araç kimliği). */
  topTools: string[];
  /** active | cancelled | refunded */
  status: string;
  cancelReason: string | null;
};

export type InsightCancellation = {
  id: string;
  createdAt: string;
  who: string;
  plan: string;
  reason: string;
  note: string | null;
  action: string;
};

export type InsightsPayload = {
  days: number;
  truncated: boolean;
  totals: { newUsers: number; paidCustomers: number; refunded: number };
  visits: InsightVisit[];
  payers: InsightPayer[];
  cancellations: InsightCancellation[];
};

function displayName(u: { email: string; name: string | null; firstName: string | null } | null | undefined): string | null {
  if (!u) return null;
  return u.name?.trim() || u.firstName?.trim() || u.email;
}

function parseExtra(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Kişinin ilk geldiği yer: kayıtlı oturumlarından en eskisinin ilk sayfa görüntülemesi. */
async function firstSourceByUser(userIds: string[]): Promise<Map<string, InsightSource>> {
  const out = new Map<string, InsightSource>();
  if (userIds.length === 0) return out;

  const [pvSessions, evSessions] = await Promise.all([
    prisma.pageView.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, sessionId: true },
      distinct: ["userId", "sessionId"],
    }),
    prisma.userJourneyEvent.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, sessionId: true },
      distinct: ["userId", "sessionId"],
    }),
  ]);
  const sessionsOfUser = new Map<string, Set<string>>();
  for (const r of [...pvSessions, ...evSessions]) {
    if (!r.userId) continue;
    const set = sessionsOfUser.get(r.userId) ?? new Set<string>();
    set.add(r.sessionId);
    sessionsOfUser.set(r.userId, set);
  }
  const allSessions = [...new Set([...sessionsOfUser.values()].flatMap((s) => [...s]))];
  if (allSessions.length === 0) return out;

  const views = await prisma.pageView.findMany({
    where: { sessionId: { in: allSessions } },
    orderBy: { createdAt: "asc" },
    select: { sessionId: true, path: true, referrer: true, utmSource: true, utmMedium: true, utmCampaign: true, createdAt: true },
  });
  const firstBySession = new Map<string, (typeof views)[number]>();
  for (const v of views) if (!firstBySession.has(v.sessionId)) firstBySession.set(v.sessionId, v);

  for (const [uid, sessions] of sessionsOfUser) {
    let best: (typeof views)[number] | undefined;
    for (const sid of sessions) {
      const v = firstBySession.get(sid);
      if (v && (!best || v.createdAt < best.createdAt)) best = v;
    }
    if (best) {
      out.set(uid, {
        referrer: best.referrer,
        utmSource: best.utmSource,
        utmMedium: best.utmMedium,
        utmCampaign: best.utmCampaign,
        landingPath: best.path,
        firstVisitAt: best.createdAt.toISOString(),
      });
    }
  }
  return out;
}

/** Ödemeden önce hangi araç yüzünden hak duvarına çarptı / fiyatlara baktı (en son görülen). */
async function triggerToolByUser(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const events = await prisma.userJourneyEvent.findMany({
    where: { userId: { in: userIds }, name: { in: ["view_pricing", "quota_wall_hit", "upgrade_cta_clicked"] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, name: true, toolId: true, extra: true },
  });
  for (const ev of events) {
    if (!ev.userId) continue;
    const reason = parseExtra(ev.extra)?.reason_tool;
    const tool = typeof reason === "string" && reason ? reason : ev.toolId;
    if (tool) out.set(ev.userId, tool); // son kayıt önceki kaydı ezer
  }
  return out;
}

export async function getJourneyInsights(days: number): Promise<InsightsPayload> {
  const since = new Date(Date.now() - days * DAY_MS);

  const [pageViews, events, admins] = await Promise.all([
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS,
      select: {
        sessionId: true,
        path: true,
        referrer: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.userJourneyEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: MAX_ROWS,
      select: { sessionId: true, name: true, toolId: true, extra: true, userId: true, createdAt: true },
    }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
  ]);
  const adminIds = new Set(admins.map((a) => a.id));
  let truncated = pageViews.length >= MAX_ROWS || events.length >= MAX_ROWS;

  const userIds = [...new Set([...pageViews, ...events].map((r) => r.userId).filter((v): v is string => Boolean(v)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, name: true, firstName: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const bySession = new Map<string, InsightVisit>();
  const touch = (sessionId: string, at: Date): InsightVisit => {
    let v = bySession.get(sessionId);
    if (!v) {
      v = {
        id: sessionId,
        firstSeenAt: at.toISOString(),
        lastSeenAt: at.toISOString(),
        userId: null,
        who: null,
        isMember: false,
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        landingPath: null,
        pageCount: 0,
        events: [],
      };
      bySession.set(sessionId, v);
    }
    const iso = at.toISOString();
    if (iso < v.firstSeenAt) v.firstSeenAt = iso;
    if (iso > v.lastSeenAt) v.lastSeenAt = iso;
    return v;
  };
  const adminSessions = new Set<string>();

  for (const pv of pageViews) {
    if (pv.userId && adminIds.has(pv.userId)) adminSessions.add(pv.sessionId);
    const v = touch(pv.sessionId, pv.createdAt);
    v.pageCount += 1;
    if (v.landingPath === null) {
      v.landingPath = pv.path;
      v.referrer = pv.referrer;
      v.utmSource = pv.utmSource;
      v.utmMedium = pv.utmMedium;
      v.utmCampaign = pv.utmCampaign;
    }
    if (pv.userId && !v.userId) {
      v.userId = pv.userId;
      v.isMember = true;
      v.who = displayName(userById.get(pv.userId));
    }
  }
  for (const ev of events) {
    if (ev.userId && adminIds.has(ev.userId)) adminSessions.add(ev.sessionId);
    const v = touch(ev.sessionId, ev.createdAt);
    v.events.push({ name: ev.name, toolId: ev.toolId, extra: ev.extra, createdAt: ev.createdAt.toISOString() });
    if (ev.userId && !v.userId) {
      v.userId = ev.userId;
      v.isMember = true;
      v.who = displayName(userById.get(ev.userId));
    }
  }

  let visits = [...bySession.values()].filter((v) => !adminSessions.has(v.id));
  visits.sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
  if (visits.length > MAX_VISITS) {
    visits = visits.slice(0, MAX_VISITS);
    truncated = true;
  }

  // ── Gerçek ödemeler ──
  const checkouts = await prisma.paymentCheckout.findMany({
    where: { status: "completed", completedAt: { gte: since }, user: { role: { not: "ADMIN" } } },
    orderBy: { completedAt: "desc" },
    take: MAX_PAYERS,
    select: {
      id: true,
      userId: true,
      plan: true,
      billingCycle: true,
      priceTry: true,
      paymentCurrency: true,
      completedAt: true,
      refundedAt: true,
      seatsOnly: true,
      bonusAiCredits: true,
      cvPassHours: true,
      user: {
        select: {
          email: true,
          name: true,
          firstName: true,
          createdAt: true,
          toolUsageCountsJson: true,
          organization: { select: { subscriptionStatus: true } },
        },
      },
    },
  });
  const payerIds = [...new Set(checkouts.map((c) => c.userId))];
  const [sources, triggers, feedbackRows] = await Promise.all([
    firstSourceByUser(payerIds),
    triggerToolByUser(payerIds),
    payerIds.length
      ? prisma.cancellationFeedback.findMany({
          where: { userId: { in: payerIds } },
          orderBy: { createdAt: "asc" },
          select: { userId: true, reason: true },
        })
      : Promise.resolve([] as Array<{ userId: string; reason: string }>),
  ]);
  const reasonByUser = new Map<string, string>();
  for (const f of feedbackRows) reasonByUser.set(f.userId, f.reason);

  const payers: InsightPayer[] = checkouts.map((c) => {
    const paidAt = c.completedAt ?? new Date();
    const counts = parseToolUsageCountsJson(c.user.toolUsageCountsJson);
    const topTools = Object.entries(counts)
      .filter(([, n]) => (n ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
      .map(([k]) => k);
    const kind = c.bonusAiCredits ? "ai_credit" : c.cvPassHours ? "cv_pass" : c.seatsOnly ? "seats" : "plan";
    const status = c.refundedAt ? "refunded" : c.user.organization?.subscriptionStatus === "canceled" ? "cancelled" : "active";
    return {
      checkoutId: c.id,
      userId: c.userId,
      who: displayName(c.user) ?? c.userId,
      plan: c.plan,
      kind,
      billingCycle: c.billingCycle,
      amount: c.priceTry,
      currency: c.paymentCurrency,
      paidAt: paidAt.toISOString(),
      signedUpAt: c.user.createdAt.toISOString(),
      daysToPay: Math.max(0, Math.floor((paidAt.getTime() - c.user.createdAt.getTime()) / DAY_MS)),
      source: sources.get(c.userId) ?? null,
      triggerTool: triggers.get(c.userId) ?? null,
      topTools,
      status,
      cancelReason: reasonByUser.get(c.userId) ?? null,
    };
  });

  // ── İptal nedenleri ──
  const feedback = await prisma.cancellationFeedback.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: MAX_CANCELLATIONS,
  });
  const fbUsers = feedback.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(feedback.map((f) => f.userId))] } },
        select: { id: true, email: true, name: true, firstName: true },
      })
    : [];
  const fbUserById = new Map(fbUsers.map((u) => [u.id, u]));
  const cancellations: InsightCancellation[] = feedback.map((f) => ({
    id: f.id,
    createdAt: f.createdAt.toISOString(),
    who: displayName(fbUserById.get(f.userId)) ?? "Silinmiş hesap",
    plan: f.plan,
    reason: f.reason,
    note: f.note,
    action: f.action,
  }));

  // ── Kesin sayılar (ölçüm onayından bağımsız) ──
  const [newUsers, paidGroups, refunded] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since }, role: { not: "ADMIN" } } }),
    prisma.paymentCheckout.groupBy({
      by: ["userId"],
      where: { status: "completed", completedAt: { gte: since }, refundedAt: null, user: { role: { not: "ADMIN" } } },
    }),
    prisma.paymentCheckout.count({
      where: { status: "completed", refundedAt: { gte: since }, user: { role: { not: "ADMIN" } } },
    }),
  ]);

  return { days, truncated, totals: { newUsers, paidCustomers: paidGroups.length, refunded }, visits, payers, cancellations };
}
