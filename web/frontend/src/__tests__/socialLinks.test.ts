import { describe, expect, it } from "vitest";
import { BRAND_SOCIAL_LINKS, resolveSocialLinks } from "../lib/socialLinks";

describe("resolveSocialLinks", () => {
  it("panelde yoksa yedi resmi profili verir", () => {
    expect(resolveSocialLinks(undefined)).toEqual([...BRAND_SOCIAL_LINKS]);
    expect(BRAND_SOCIAL_LINKS).toHaveLength(7);
  });
  it("yanlış LinkedIn kişisel profilini şirket sayfasıyla değiştirir, Facebook'u ekler", () => {
    const out = resolveSocialLinks([
      "https://www.instagram.com/pdfplatformapp",
      "https://www.linkedin.com/in/pdfplatformapp",
    ]);
    expect(out).toContain("https://www.linkedin.com/company/pdfplatform");
    expect(out).not.toContain("https://www.linkedin.com/in/pdfplatformapp");
    expect(out).toContain("https://www.facebook.com/pdfplatform");
    expect(out.filter((u) => u.includes("instagram"))).toHaveLength(1);
  });
  it("başka bir ağı (GitHub) korur", () => {
    expect(resolveSocialLinks(["https://github.com/x"])).toContain("https://github.com/x");
  });
});
