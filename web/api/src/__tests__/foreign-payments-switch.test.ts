import { beforeEach, describe, expect, it, vi } from "vitest";

let flags: unknown = null;
vi.mock("../lib/site-config.service.js", async () => {
  const keys = await import("../lib/site-setting-keys.js");
  return { SITE_SETTING_KEYS: keys.SITE_SETTING_KEYS, getSetting: async () => flags };
});

import { foreignPaymentsOpen } from "../lib/feature-switches.js";

beforeEach(() => {
  flags = null;
});

describe("yurt dışı (dolar) ödeme anahtarı", () => {
  it("kayıt yoksa KAPALI (güvenli taraf)", async () => {
    expect(await foreignPaymentsOpen()).toBe(false);
  });
  it("true ya da bozuk değer: KAPALI", async () => {
    flags = { featureFlags: { foreignPaymentsDisabled: true } };
    expect(await foreignPaymentsOpen()).toBe(false);
    flags = { featureFlags: { foreignPaymentsDisabled: "false" } };
    expect(await foreignPaymentsOpen()).toBe(false);
  });
  it("yalnız açıkça false yazılırsa AÇIK", async () => {
    flags = { featureFlags: { foreignPaymentsDisabled: false } };
    expect(await foreignPaymentsOpen()).toBe(true);
  });
});
