import { describe, expect, it, vi } from "vitest";

vi.mock("../modules/social/social.service.js", () => ({ facebookSecrets: vi.fn(async () => null) }));
vi.mock("../lib/site-config.service.js", () => ({
  getSettingWithFallback: vi.fn(async (_k: string, fallback: unknown) => fallback),
  setSetting: vi.fn(async () => undefined),
}));

import { facebookKindFor, facebookWithLink } from "../modules/social/facebook-kind.js";
import { isTooSimilar, similarity } from "../modules/social/facebook-similarity.js";
import { isReplyWorthy, weekKeyOf } from "../modules/social/facebook-engagement.service.js";

describe("Facebook içerik karışımı", () => {
  it("arka arkaya iki gönderi aynı biçimde olmaz (döngü dönerken de)", () => {
    const kinds = Array.from({ length: 20 }, (_, i) => facebookKindFor(i));
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    expect(new Set(kinds.slice(0, 5)).size).toBe(5);
  });

  it("bağlantı satırı dört gönderiden yalnız birinde çıkar", () => {
    const flags = Array.from({ length: 8 }, (_, i) => facebookWithLink(i));
    expect(flags.filter(Boolean)).toHaveLength(2);
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
