import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Yolculuk hunisi özeti: Sentry "N+1 sorgu" uyarısı sonrası 8 ayrı COUNT yerine tek GROUP BY.
 * Sayılar eskisiyle birebir aynı çıkmalı; sorgu sayısı 2 olmalı.
 */
const m = vi.hoisted(() => ({
  groupBy: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { userJourneyEvent: { groupBy: m.groupBy, count: m.count } },
}));

import { getJourneyFunnelSummary } from "../modules/admin/journey/journey.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  m.groupBy.mockImplementation(async (arg: { by: string[] }) => {
    if (arg.by[0] === "toolId") {
      return [
        { toolId: "merge", _count: { _all: 3 } },
        { toolId: null, _count: { _all: 1 } },
        { toolId: "compress", _count: { _all: 7 } },
      ];
    }
    return [
      { name: "sign_up_cta_shown", _count: { _all: 11 } },
      { name: "sign_up_cta_click", _count: { _all: 4 } },
      { name: "sign_up_completed", _count: { _all: 2 } },
      { name: "quota_wall_hit", _count: { _all: 5 } },
      { name: "quota_warning_shown", _count: { _all: 6 } },
      { name: "upgrade_cta_clicked", _count: { _all: 3 } },
      { name: "checkout_abandoned", _count: { _all: 1 } },
      { name: "purchase", _count: { _all: 9 } },
    ];
  });
});

describe("getJourneyFunnelSummary", () => {
  it("yalnızca 2 sorgu çalıştırır (tek tek COUNT yok)", async () => {
    await getJourneyFunnelSummary(30);
    expect(m.groupBy).toHaveBeenCalledTimes(2);
    expect(m.count).not.toHaveBeenCalled();
  });

  it("sayıları doğru toplar; eksik olay adı 0 olur", async () => {
    const r = await getJourneyFunnelSummary(30);
    expect(r.signupPromptShown).toBe(11);
    expect(r.signupPromptDismissed).toBe(0);
    expect(r.signupPromptClicked).toBe(4);
    expect(r.signupCompleted).toBe(2);
    // ödeme istemi = kota duvarı/uyarısı (5+6) + yükseltme tıklaması (3)
    expect(r.paymentPromptShown).toBe(5 + 6 + 3);
    expect(r.paymentAbandoned).toBe(1);
    expect(r.purchaseCompleted).toBe(9);
  });

  it("araç bazlı sayıları azalan sırada verir ve bilinmeyen aracı adlandırır", async () => {
    const r = await getJourneyFunnelSummary(7);
    expect(r.toolSuccessByTool.map((x) => x.toolId)).toEqual(["compress", "merge", "bilinmiyor"]);
  });

  it("sorguya seçilen gün aralığını uygular", async () => {
    await getJourneyFunnelSummary(7);
    const arg = m.groupBy.mock.calls.find((c) => c[0].by[0] === "name")![0];
    const gun = (Date.now() - (arg.where.createdAt.gte as Date).getTime()) / 86400000;
    expect(Math.round(gun)).toBe(7);
    expect(arg.where.name.in).toContain("purchase");
  });
});
