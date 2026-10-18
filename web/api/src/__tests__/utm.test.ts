import { describe, expect, it } from "vitest";
import { emailUtm, socialUtm, withUtm } from "../lib/utm.js";

describe("withUtm", () => {
  it("tam adrese etiket ekler", () => {
    expect(withUtm("https://www.pdfplatform.app/tools/compress", socialUtm("INSTAGRAM", "blog"))).toBe(
      "https://www.pdfplatform.app/tools/compress?utm_source=instagram&utm_medium=social&utm_campaign=blog",
    );
  });
  it("mevcut sorguyu korur", () => {
    expect(withUtm("https://x.app/a?coupon=Y", emailUtm("kampanya"))).toBe(
      "https://x.app/a?coupon=Y&utm_source=email&utm_medium=email&utm_campaign=kampanya",
    );
  });
  it("göreli yolda yalnız yolu döndürür", () => {
    expect(withUtm("/workspace?upgrade=1", emailUtm("a"))).toBe(
      "/workspace?upgrade=1&utm_source=email&utm_medium=email&utm_campaign=a",
    );
  });
  it("elle girilmiş etiketi ezmez", () => {
    const u = "https://x.app/?utm_source=elle";
    expect(withUtm(u, emailUtm("a"))).toBe(u);
  });
});
