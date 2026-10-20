import { describe, expect, it, vi } from "vitest";

vi.mock("../modules/social/social.service.js", () => ({ facebookSecrets: vi.fn(async () => null) }));
vi.mock("../lib/site-config.service.js", () => ({
  getSettingWithFallback: vi.fn(async (_k: string, fallback: unknown) => fallback),
  setSetting: vi.fn(async () => undefined),
}));

import { facebookKindFor } from "../modules/social/facebook-kind.js";
import { isTooSimilar, similarity } from "../modules/social/facebook-similarity.js";
import { isReplyWorthy, weekKeyOf } from "../modules/social/facebook-engagement.service.js";

describe("Facebook içerik karışımı", () => {
  it("7'lik döngüde 4 ipucu, 2 sorun→çözüm, 1 etkileşim çıkar", () => {
    const kinds = Array.from({ length: 7 }, (_, i) => facebookKindFor(i));
    expect(kinds.filter((k) => k === "tip")).toHaveLength(4);
    expect(kinds.filter((k) => k === "problem")).toHaveLength(2);
    expect(kinds.filter((k) => k === "engage")).toHaveLength(1);
    expect(facebookKindFor(7)).toBe(facebookKindFor(0));
  });
});

describe("Facebook metin benzerliği", () => {
  const a = "CV'n 5 MB olunca e-postan geri mi dönüyor? PDF CV'ni 10 saniyede küçült.\n\nLink ilk yorumda 👇\n\n#CV #PDF";
  it("aynı metni yakalar, etiket ve sabit satırları saymaz", () => {
    expect(similarity(a, a.replace("#CV #PDF", "#Kariyer #İş"))).toBeGreaterThan(0.9);
    expect(isTooSimilar(a, ["bambaşka bir konu hakkında tamamen farklı bir yazı burada"])).toBe(false);
    expect(isTooSimilar(a, ["x", a])).toBe(true);
  });
});

describe("Yorum yanıt süzgeci", () => {
  it("gerçek soruyu geçirir; spam, emoji ve tek kelimeyi eler", () => {
    expect(isReplyWorthy("PDF'i Word'e çevirirken tablolar bozuluyor, ne yapmalıyım?")).toBe(true);
    expect(isReplyWorthy("👍👍👍")).toBe(false);
    expect(isReplyWorthy("güzel")).toBe(false);
    expect(isReplyWorthy("Bize bakın https://spam.example kazanç garantili")).toBe(false);
  });
});

describe("Haftalık rapor", () => {
  it("hafta kimliği Pazartesi gününe oturur", () => {
    expect(weekKeyOf(new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-19");
    expect(weekKeyOf(new Date("2026-10-19T00:30:00Z"))).toBe("2026-10-19");
    expect(weekKeyOf(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-19");
  });
});
