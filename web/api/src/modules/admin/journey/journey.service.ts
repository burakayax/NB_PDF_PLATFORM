import { prisma } from "../../../lib/prisma.js";

/**
 * KULLANICI YOLCULUĞU — misafir/üye tarafında biriken `UserJourneyEvent`
 * kayıtlarını, admin panelinde tek bakışta okunabilir bir "hikaye"ye
 * dönüştürülebilecek şekilde OTURUM (sessionId) bazında gruplar.
 *
 * Neden burada gruplama yapılıyor, frontend'de değil: aynı oturuma ait
 * `PageView` (referrer/kaynak) ve `UserJourneyEvent` (adımlar) satırları farklı
 * tablolarda; ikisini birleştirip zaman sırasına dizmek backend'in işi.
 */

const FUNNEL_EVENT_NAMES = [
  "sign_up_cta_shown",
  "sign_up_cta_dismissed",
  "sign_up_cta_click",
  "sign_up_completed",
  "quota_wall_hit",
  "quota_warning_shown",
  "upgrade_cta_clicked",
  "view_pricing",
  "select_plan",
  "add_payment_info",
  "checkout_abandoned",
  "purchase",
] as const;

export type JourneySessionEvent = {
  name: string;
  toolId: string | null;
  extra: string | null;
  createdAt: Date;
};

export type JourneySession = {
  sessionId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  /** İlk görülen sayfa görüntülemesinden alınan yönlendiren (ör. chatgpt.com). */
  referrer: string | null;
  landingPath: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  events: JourneySessionEvent[];
};

/**
 * Son N günde en az bir huni olayı üreten oturumları, en son etkinliğe göre
 * sıralı döndürür. `cursor` bir önceki sayfanın son oturumunun `lastSeenAt`
 * değeridir (bundan ÖNCEKİ oturumlar getirilir).
 */
export async function listJourneySessions(params: {
  limit: number;
  cursor?: Date;
  days: number;
  onlyGuests?: boolean;
}): Promise<{ sessions: JourneySession[]; nextCursor: string | null }> {
  const since = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  // 1) Son `days` gün içinde huni olayı üreten benzersiz oturumları, en son
  //    olaylarına göre sırala. Sayfalama bu seviyede yapılır (event satırı
  //    değil, OTURUM sayısı üzerinden).
  const sessionAgg = await prisma.userJourneyEvent.groupBy({
    by: ["sessionId"],
    where: {
      name: { in: FUNNEL_EVENT_NAMES as unknown as string[] },
      createdAt: params.cursor ? { gte: since, lt: params.cursor } : { gte: since },
    },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: params.limit,
  });

  if (sessionAgg.length === 0) {
    return { sessions: [], nextCursor: null };
  }

  const sessionIds = sessionAgg.map((s) => s.sessionId);

  const [events, pageViews] = await Promise.all([
    prisma.userJourneyEvent.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { createdAt: "asc" },
      select: {
        sessionId: true,
        name: true,
        toolId: true,
        extra: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true, name: true, firstName: true } },
      },
    }),
    prisma.pageView.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { createdAt: "asc" },
      select: { sessionId: true, referrer: true, path: true, createdAt: true },
    }),
  ]);

  const firstPageViewBySession = new Map<string, { referrer: string | null; path: string }>();
  for (const pv of pageViews) {
    if (!firstPageViewBySession.has(pv.sessionId)) {
      firstPageViewBySession.set(pv.sessionId, { referrer: pv.referrer, path: pv.path });
    }
  }

  const bySession = new Map<string, JourneySession>();
  for (const ev of events) {
    let session = bySession.get(ev.sessionId);
    if (!session) {
      const landing = firstPageViewBySession.get(ev.sessionId);
      session = {
        sessionId: ev.sessionId,
        userId: ev.userId ?? null,
        userEmail: ev.user?.email ?? null,
        userName: ev.user?.name ?? ev.user?.firstName ?? null,
        referrer: landing?.referrer ?? null,
        landingPath: landing?.path ?? null,
        firstSeenAt: ev.createdAt,
        lastSeenAt: ev.createdAt,
        events: [],
      };
      bySession.set(ev.sessionId, session);
    }
    session.events.push({
      name: ev.name,
      toolId: ev.toolId,
      extra: ev.extra,
      createdAt: ev.createdAt,
    });
    if (ev.createdAt < session.firstSeenAt) session.firstSeenAt = ev.createdAt;
    if (ev.createdAt > session.lastSeenAt) session.lastSeenAt = ev.createdAt;
    // Olay üye tarafından üretildiyse (ör. sonradan giriş yaptı) kullanıcı bilgisini doldur.
    if (!session.userId && ev.userId) {
      session.userId = ev.userId;
      session.userEmail = ev.user?.email ?? null;
      session.userName = ev.user?.name ?? ev.user?.firstName ?? null;
    }
  }

  let sessions = [...bySession.values()].sort(
    (a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
  );

  if (params.onlyGuests) {
    sessions = sessions.filter((s) => !s.userId);
  }

  const last = sessions[sessions.length - 1];
  const nextCursor = sessionAgg.length === params.limit && last ? last.lastSeenAt.toISOString() : null;

  return { sessions, nextCursor };
}

export type JourneyFunnelSummary = {
  toolSuccessByTool: Array<{ toolId: string; count: number }>;
  signupPromptShown: number;
  signupPromptDismissed: number;
  signupPromptClicked: number;
  signupCompleted: number;
  paymentPromptShown: number;
  paymentAbandoned: number;
  purchaseCompleted: number;
};

/** Son `days` gün için huni sayaçları — admin panelindeki özet kartlar/huni içindir. */
export async function getJourneyFunnelSummary(days: number): Promise<JourneyFunnelSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    toolSuccessGroups,
    signupPromptShown,
    signupPromptDismissed,
    signupPromptClicked,
    signupCompleted,
    quotaWallHit,
    upgradeClicked,
    checkoutAbandoned,
    purchaseCompleted,
  ] = await Promise.all([
    prisma.userJourneyEvent.groupBy({
      by: ["toolId"],
      where: { name: "sign_up_cta_shown", toolId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.userJourneyEvent.count({ where: { name: "sign_up_cta_shown", createdAt: { gte: since } } }),
    prisma.userJourneyEvent.count({ where: { name: "sign_up_cta_dismissed", createdAt: { gte: since } } }),
    prisma.userJourneyEvent.count({ where: { name: "sign_up_cta_click", createdAt: { gte: since } } }),
    prisma.userJourneyEvent.count({ where: { name: "sign_up_completed", createdAt: { gte: since } } }),
    prisma.userJourneyEvent.count({
      where: { name: { in: ["quota_wall_hit", "quota_warning_shown"] }, createdAt: { gte: since } },
    }),
    prisma.userJourneyEvent.count({ where: { name: "upgrade_cta_clicked", createdAt: { gte: since } } }),
    prisma.userJourneyEvent.count({ where: { name: "checkout_abandoned", createdAt: { gte: since } } }),
    prisma.userJourneyEvent.count({ where: { name: "purchase", createdAt: { gte: since } } }),
  ]);

  return {
    toolSuccessByTool: toolSuccessGroups
      .map((g) => ({ toolId: g.toolId ?? "bilinmiyor", count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    signupPromptShown,
    signupPromptDismissed,
    signupPromptClicked,
    signupCompleted,
    paymentPromptShown: quotaWallHit + upgradeClicked,
    paymentAbandoned: checkoutAbandoned,
    purchaseCompleted,
  };
}
