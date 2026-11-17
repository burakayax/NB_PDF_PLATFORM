import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const putPricing = vi.fn(async () => undefined);
const putOverride = vi.fn(async () => undefined);

vi.mock("../api/admin", () => ({
  fetchAdminPlans: vi.fn(async () => ({
    plans: ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"].map((name) => ({
      name,
      displayName: name,
      description: `${name} açıklama`,
      dailyLimit: name === "FREE" ? 3 : null,
      allowedFeatures: ["merge", "compress"],
      multiUser: name === "BUSINESS",
    })),
    checkoutStats: { PRO: { completed: 4, pending: 1 } },
    marketing: {},
    plansOverride: {},
    // Panelde ESKİ bir Pro fiyatı kayıtlı → sapma uyarısı çıkmalı
    paymentPrices: { PRO: "399.00", BUSINESS: "1499.00", PRO_ANNUAL: "4490.00" },
    featureCatalog: ["merge", "compress", "split"],
    catalogue: {
      prices: {
        STARTER: { tryGrossMonthly: "129.00", tryGrossYearly: "1290.00", usdMonthly: "4.99", usdYearly: "49.92" },
        PLUS: { tryGrossMonthly: "279.00", tryGrossYearly: "2790.00", usdMonthly: "7.99", usdYearly: "59.99" },
        PRO: { tryGrossMonthly: "449.00", tryGrossYearly: "4490.00", usdMonthly: "12.99", usdYearly: "99.99" },
        BUSINESS: { tryGrossMonthly: "1499.00", tryGrossYearly: "14990.00", usdMonthly: "49.99", usdYearly: "499.99" },
      },
      limits: {
        FREE: { dailyOperationLimit: 3, monthlyOperationLimit: 30, fileSizeLimitMB: 80, batchLimit: 0 },
        STARTER: { dailyOperationLimit: 25, monthlyOperationLimit: 250, fileSizeLimitMB: 100, batchLimit: 0 },
        PLUS: { dailyOperationLimit: null, monthlyOperationLimit: 600, fileSizeLimitMB: 250, batchLimit: 0 },
        PRO: { dailyOperationLimit: null, monthlyOperationLimit: 1000, fileSizeLimitMB: 500, batchLimit: 25 },
        BUSINESS: { dailyOperationLimit: null, monthlyOperationLimit: 5000, fileSizeLimitMB: 1000, batchLimit: 100 },
      },
      aiMonthlyCredits: { FREE: 0, STARTER: 5, PLUS: 15, PRO: 40, BUSINESS: 100 },
      extraSeat: { tryGrossMonthly: "299.00", usdMonthly: "9.99" },
      team: { includedSeats: 5, maxTotalSeats: 50, extraSeatMonthlyOps: 1000, signatureRequestsBase: 300, extraSeatSignatureRequests: 60 },
      yearlyPlans: ["PLUS", "PRO", "BUSINESS"],
      vatRate: 0.2,
    },
  })),
  putAdminPlanPricing: (...a: unknown[]) => putPricing(...(a as [])),
  putAdminPlansOverride: (...a: unknown[]) => putOverride(...(a as [])),
  putAdminPackagesMarketing: vi.fn(async () => undefined),
}));

import { PackagesTab } from "../admin/packages/PackagesTab";

describe("Paket ve fiyat ekranı", () => {
  beforeEach(() => {
    putPricing.mockClear();
    putOverride.mockClear();
  });

  it("beş planın hepsini ve fiyatlarını gösterir; eski panel fiyatını uyarır", async () => {
    render(<PackagesTab accessToken="t" />);
    await screen.findByText("Paket ve fiyat");
    for (const n of ["Ücretsiz", "Başlangıç", "Plus", "Pro", "Business"]) {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("₺129")).toBeTruthy(); // Başlangıç — kodda
    expect(screen.getByText("₺279")).toBeTruthy(); // Plus — kodda
    expect(screen.getByText(/koddaki güncel fiyattan farklı/)).toBeTruthy();
  });

  it("fiyat değişince kaydetme onay ister ve Pro/Business/yıllık değerleri gönderir", async () => {
    const user = userEvent.setup();
    render(<PackagesTab accessToken="t" />);
    await screen.findByText("Paket ve fiyat");
    await user.click(screen.getByText("Kod fiyatlarını yükle"));
    await user.click(screen.getByText("Fiyatları kaydet"));
    await user.click(await screen.findByText("Evet, kaydet"));
    await waitFor(() => expect(putPricing).toHaveBeenCalledTimes(1));
    expect(putPricing.mock.calls[0]).toEqual(["t", { PRO: "449.00", BUSINESS: "1499.00", PRO_ANNUAL: "4490.00" }]);
  });

  it("erişim sekmesi beş plan sütunu gösterir ve yalnız değişen planı kaydeder", async () => {
    const user = userEvent.setup();
    render(<PackagesTab accessToken="t" />);
    await screen.findByText("Paket ve fiyat");
    await user.click(screen.getByText("Erişim ve limitler"));
    expect(screen.getByText("Hangi araç hangi pakette açık?")).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox");
    // "Sayfa ayır" (split) satırı: 5 plan kutusu; Plus'ınkini aç
    const splitRow = screen.getByText("Sayfa ayır").closest("tr")!;
    const rowBoxes = splitRow.querySelectorAll("input[type=checkbox]");
    expect(rowBoxes.length).toBe(5);
    expect(boxes.length).toBeGreaterThan(5);
    await user.click(rowBoxes[2] as HTMLElement);
    await user.click(screen.getByText("Erişim kurallarını kaydet"));
    await waitFor(() => expect(putOverride).toHaveBeenCalledTimes(1));
    const sent = (putOverride.mock.calls[0] as unknown[])[1] as Record<string, { allowedFeatures: string[] }>;
    expect(Object.keys(sent)).toEqual(["PLUS"]); // dokunulmayan planlar dondurulmaz
    expect(sent.PLUS.allowedFeatures).toContain("split");
  });
});
