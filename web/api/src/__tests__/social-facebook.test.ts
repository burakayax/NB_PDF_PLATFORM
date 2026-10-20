import { describe, expect, it } from "vitest";
import { FACEBOOK_WINDOWS, facebookSlot } from "../modules/social/social.service.js";
import { firstCommentText } from "../modules/social/platforms/facebook-comment.js";

describe("Facebook paylaşım saatleri", () => {
  const hourOf = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", hour12: false }).format(d));
  const minuteOf = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", minute: "2-digit" }).format(d));

  it("normal gönderi 12:00-13:00, Reels 20:00-22:00 arasında kalır ve tam saate denk gelmez", () => {
    for (let i = 0; i < 200; i++) {
      const post = facebookSlot("post", "2026-10-20", "Europe/Istanbul");
      expect(hourOf(post)).toBe(12);
      expect(minuteOf(post)).toBeGreaterThanOrEqual(3);
      const reel = facebookSlot("reel", "2026-10-20", "Europe/Istanbul");
      expect([20, 21]).toContain(hourOf(reel));
      expect(minuteOf(reel)).not.toBe(0);
    }
    expect(FACEBOOK_WINDOWS.reel.to).toBe(22);
  });

  it("rastgelelik kaynağına göre değişir", () => {
    const a = facebookSlot("reel", "2026-10-20", "Europe/Istanbul", () => 0);
    const b = facebookSlot("reel", "2026-10-20", "Europe/Istanbul", () => 0.99);
    expect(b.getTime()).toBeGreaterThan(a.getTime());
  });
});

describe("Facebook ilk yorum", () => {
  it("kampanya etiketli sayfa bağlantısını kalıpla verir; bağlantı yoksa ana siteye düşer", () => {
    expect(firstCommentText("https://pdfplatform.app/tr/blog/x", "g")).toMatch(/^Ücretsiz denemek için 👉 https:\/\/pdfplatform\.app\/tr\/blog\/x\?utm_source=facebook/);
    expect(firstCommentText("", "g")).toContain("https://pdfplatform.app");
  });
});
