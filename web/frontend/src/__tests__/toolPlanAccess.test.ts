import { describe, expect, it } from "vitest";
import type { PlanDefinition } from "../api/subscription";
import { lowestPlanFor, toolLandingCopy } from "../lib/toolPlanAccess";

const plan = (name: string, allowedFeatures: string[]) => ({ name, allowedFeatures }) as unknown as PlanDefinition;
// Sunucu sırası önemli olmamalı.
const PLANS = [
  plan("PLUS", ["merge", "watermark", "resize-pdf"]),
  plan("FREE", ["merge"]),
  plan("STARTER", ["merge", "watermark"]),
];

describe("misafir araç tanıtım sayfası plan metni", () => {
  it("aracı açan en düşük planı sunucu listesinden bulur", () => {
    expect(lowestPlanFor(PLANS, "merge")).toBe("FREE");
    expect(lowestPlanFor(PLANS, "watermark")).toBe("STARTER");
    expect(lowestPlanFor(PLANS, "resize-pdf")).toBe("PLUS");
    expect(lowestPlanFor(PLANS, "listede-yok")).toBeNull();
    expect(lowestPlanFor(null, "merge")).toBeNull();
  });

  it("panelden erişim değişirse metin de değişir", () => {
    const acildi = [plan("FREE", ["resize-pdf"])];
    expect(toolLandingCopy(lowestPlanFor(acildi, "resize-pdf"), "tr").badge).toBe("Ücretsiz PDF aracı");
  });

  it("ücretli ya da bilinmeyen araçta aracın ücretsiz olduğunu söylemez", () => {
    for (const lang of ["tr", "en"] as const) {
      for (const key of ["STARTER", "PLUS", null] as const) {
        const c = toolLandingCopy(key, lang);
        expect(c.badge + c.cta + c.note).not.toMatch(/ücretsiz|free|kart gerekmez|no card/i);
      }
    }
  });

  it("gereken planın adını yazar", () => {
    expect(toolLandingCopy("PLUS", "tr").note).toBe("Plus ve üstü planlarda");
    expect(toolLandingCopy("STARTER", "tr").bottom).toBe("Hesap açmak ücretsiz; bu araç Başlangıç ve üstünde açılır.");
    expect(toolLandingCopy("PLUS", "en").bottom).toBe("Creating an account is free; this tool is available on Plus and above.");
  });
});
