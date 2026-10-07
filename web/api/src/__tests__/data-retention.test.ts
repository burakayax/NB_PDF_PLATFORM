import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * VERİ SAKLAMA İŞLERİ: politikada yazan süreler gerçekten uygulanır.
 *  • 90 günden eski indirme günlüklerinde IP/tarayıcı bilgisi silinir.
 *  • Arşivlenmiş işlem/indirme günlükleri 1 yıl sonra silinir (yalnız arşivlenmiş olanlar).
 *  • Sayfa görüntüleme/yolculuk 13 ay, istemci hata günlüğü 30 gün.
 */

const m = vi.hoisted(() => ({
  opDelete: vi.fn(async () => ({ count: 2 })),
  dlDelete: vi.fn(async () => ({ count: 3 })),
  pvDelete: vi.fn(async () => ({ count: 4 })),
  jeDelete: vi.fn(async () => ({ count: 5 })),
  ceDelete: vi.fn(async () => ({ count: 6 })),
  audit: vi.fn(async () => ({})),
}));

vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }));
vi.mock("../lib/app-logger.js", () => ({ logError: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    operationLog: { deleteMany: m.opDelete },
    downloadLog: { deleteMany: m.dlDelete },
    pageView: { deleteMany: m.pvDelete },
    userJourneyEvent: { deleteMany: m.jeDelete },
    clientErrorLog: { deleteMany: m.ceDelete },
    adminAuditLog: { create: m.audit },
  },
}));

import { purgeAnalyticsAndErrorLogs, purgeArchivedLogs } from "../jobs/dataRetentionJobs.js";

const DAY = 24 * 3600 * 1000;
const daysFromNow = (d: Date) => Math.round((Date.now() - d.getTime()) / DAY);

beforeEach(() => vi.clearAllMocks());

describe("purgeArchivedLogs", () => {
  it("yalnız arşivlenmiş ve 1 yıldan eski günlükleri siler", async () => {
    await purgeArchivedLogs();
    const opWhere = (m.opDelete.mock.calls[0] as unknown as [{ where: { isArchived: boolean; createdAt: { lt: Date } } }])[0].where;
    const dlWhere = (m.dlDelete.mock.calls[0] as unknown as [{ where: { isArchived: boolean; createdAt: { lt: Date } } }])[0].where;
    expect(opWhere.isArchived).toBe(true);
    expect(dlWhere.isArchived).toBe(true);
    expect(daysFromNow(opWhere.createdAt.lt)).toBe(365);
    expect(m.audit).toHaveBeenCalled();
  });
});

describe("purgeAnalyticsAndErrorLogs", () => {
  it("sayfa/yolculuk 13 ay, hata günlüğü 30 gün", async () => {
    await purgeAnalyticsAndErrorLogs();
    const lt = (fn: typeof m.pvDelete) => (fn.mock.calls[0] as unknown as [{ where: { createdAt: { lt: Date } } }])[0].where.createdAt.lt;
    expect(daysFromNow(lt(m.pvDelete))).toBe(395);
    expect(daysFromNow(lt(m.jeDelete))).toBe(395);
    expect(daysFromNow(lt(m.ceDelete))).toBe(30);
    expect(m.audit).toHaveBeenCalledTimes(1);
  });
});
