import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * YÖNETİM PANELİ — "Araç Kullanımı" sekmesi.
 *
 * Panel, kullanıcı satırındaki özet alanı okuyordu; o alan web araçları
 * çalıştırıldığında hiç güncellenmediği için ekran HER kullanıcıda boş
 * görünüyordu. Sayım artık gerçek işlem kaydından yapılıyor. Bu testler o
 * bağlantının kopmamasını sağlar.
 */

const groupBy = vi.fn();
const findUnique = vi.fn();

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    operationLog: { groupBy: (...a: unknown[]) => groupBy(...a) },
    user: { findUnique: (...a: unknown[]) => findUnique(...a) },
  },
}));
vi.mock("../modules/auth/session-insight.service.js", () => ({
  hesapPaylasimSinyali: vi.fn(async () => ({
    pencereGun: 30, cihazSayisi: 1, agSayisi: 1, acikOturum: 1,
    risk: "normal", aciklama: "olağan",
  })),
}));

const { adminGetUserDetailController } = await import("../modules/admin/admin.controller.js");

function sahteYanit() {
  const govde: Record<string, unknown> = {};
  return {
    json: (v: Record<string, unknown>) => Object.assign(govde, v),
    govde,
  };
}

beforeEach(() => {
  groupBy.mockReset();
  findUnique.mockReset();
  findUnique.mockResolvedValue({
    id: "k1",
    email: "a@b.c",
    toolUsageCountsJson: "{}", // özet alan BOŞ olsa bile panel dolu gelmeli
    organization: null,
    paymentCheckouts: [],
  });
});

describe("araç kullanımı sayımı", () => {
  it("işlem kaydından sayar ve çoktan aza sıralar", async () => {
    groupBy.mockResolvedValue([
      { toolType: "merge-pdf", _count: { _all: 3 }, _max: { createdAt: new Date("2026-09-10T10:00:00Z") } },
      { toolType: "pdf-to-word", _count: { _all: 11 }, _max: { createdAt: new Date("2026-09-17T08:00:00Z") } },
    ]);
    const res = sahteYanit();
    await adminGetUserDetailController(
      { params: { id: "k1" } } as never,
      res as never,
    );
    const detay = res.govde as {
      toolUsageDetails: { toolId: string; count: number; sonKullanim: string | null }[];
      toolUsageCounts: Record<string, number>;
    };
    expect(detay.toolUsageDetails.map((a) => a.toolId)).toEqual(["pdf-to-word", "merge-pdf"]);
    expect(detay.toolUsageDetails[0]!.count).toBe(11);
    expect(detay.toolUsageDetails[0]!.sonKullanim).toContain("2026-09-17");
    expect(detay.toolUsageCounts["merge-pdf"]).toBe(3);
  });

  it("yalnız o kullanıcının kayıtlarını sorar", async () => {
    groupBy.mockResolvedValue([]);
    await adminGetUserDetailController({ params: { id: "k1" } } as never, sahteYanit() as never);
    expect(groupBy.mock.calls[0]![0].where).toEqual({ userId: "k1" });
  });

  it("kayıt yoksa boş liste döner (çökmeden)", async () => {
    groupBy.mockResolvedValue([]);
    const res = sahteYanit();
    await adminGetUserDetailController({ params: { id: "k1" } } as never, res as never);
    expect((res.govde as { toolUsageDetails: unknown[] }).toolUsageDetails).toEqual([]);
  });
});
