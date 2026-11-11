import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ getSetting: vi.fn() }));
vi.mock("../lib/site-config.service.js", () => ({ getSetting: (...a: unknown[]) => h.getSetting(...a) }));

import { invoicingPaused, exportExemptionOpen } from "../lib/feature-switches.js";

describe("invoicingPaused (fatura durdurma: env + admin anahtarı)", () => {
  const old = process.env.INVOICE_GENERATION_PAUSED;
  beforeEach(() => {
    delete process.env.INVOICE_GENERATION_PAUSED;
    h.getSetting.mockReset();
  });
  afterEach(() => {
    if (old === undefined) delete process.env.INVOICE_GENERATION_PAUSED;
    else process.env.INVOICE_GENERATION_PAUSED = old;
  });

  it("anahtar yok / env yok → güvenli taraf: durdurulmuş", async () => {
    h.getSetting.mockResolvedValue(null);
    expect(await invoicingPaused()).toBe(true);
  });
  it("okuma hatası → durdurulmuş", async () => {
    h.getSetting.mockRejectedValue(new Error("db"));
    expect(await invoicingPaused()).toBe(true);
  });
  it("admin anahtarı AÇIKÇA false → fatura kesilir", async () => {
    h.getSetting.mockResolvedValue({ featureFlags: { invoicingPaused: false } });
    expect(await invoicingPaused()).toBe(false);
  });
  it("admin anahtarı true → durdurulmuş", async () => {
    h.getSetting.mockResolvedValue({ featureFlags: { invoicingPaused: true } });
    expect(await invoicingPaused()).toBe(true);
  });
  it("env=1 iken admin anahtarı false olsa da durdurulmuş", async () => {
    process.env.INVOICE_GENERATION_PAUSED = "1";
    h.getSetting.mockResolvedValue({ featureFlags: { invoicingPaused: false } });
    expect(await invoicingPaused()).toBe(true);
  });
});

describe("exportExemptionOpen (yurt dışı istisnası)", () => {
  beforeEach(() => h.getSetting.mockReset());

  it("anahtar yok → KAPALI (herkese KDV'li)", async () => {
    h.getSetting.mockResolvedValue(null);
    expect(await exportExemptionOpen()).toBe(false);
  });
  it("exportExemptionDisabled true → kapalı", async () => {
    h.getSetting.mockResolvedValue({ featureFlags: { exportExemptionDisabled: true } });
    expect(await exportExemptionOpen()).toBe(false);
  });
  it("exportExemptionDisabled AÇIKÇA false → açık", async () => {
    h.getSetting.mockResolvedValue({ featureFlags: { exportExemptionDisabled: false } });
    expect(await exportExemptionOpen()).toBe(true);
  });
});
