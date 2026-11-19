/**
 * "Yalnız yönetici görsün": TOOLS.config.adminOnlyFeatures içindeki araç yalnız yöneticiye açıktır.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ getSetting: vi.fn() }));
vi.mock("../lib/site-config.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/site-config.service.js")>()),
  getSetting: h.getSetting,
}));

import { getPublicTOOLSSlice } from "../modules/public/public.service.js";

describe("adminOnlyFeatures", () => {
  beforeEach(() => h.getSetting.mockReset());

  it("herkese açık dilimde yönetici-yalnız araç listesi döner", async () => {
    h.getSetting.mockResolvedValue({ disabledFeatures: ["merge"], adminOnlyFeatures: ["ocr", " ", 5] });
    const s = await getPublicTOOLSSlice();
    expect(s.adminOnlyFeatures).toEqual(["ocr"]);
    expect(s.disabledFeatures).toEqual(["merge"]);
  });

  it("ayar yoksa liste boştur (hiçbir araç gizlenmez)", async () => {
    h.getSetting.mockResolvedValue(null);
    const s = await getPublicTOOLSSlice();
    expect(s.adminOnlyFeatures).toEqual([]);
  });
});
