import { describe, expect, it } from "vitest";
import { withCarouselQuestion } from "../modules/social/carousel.service.js";

describe("withCarouselQuestion", () => {
  const q = "Şifreli bir PDF yüzünden hiç işin aksadı mı?";

  it("soruyu etiket bloğundan önce ekler", () => {
    const out = withCarouselQuestion("Metin burada.\n\n#pdf #şifre", q);
    expect(out).toBe(`Metin burada.\n\n${q}\nCevabını yorumlara yaz.\n\n#pdf #şifre`);
  });

  it("etiket yoksa sona ekler", () => {
    expect(withCarouselQuestion("Metin burada.", q)).toBe(`Metin burada.\n\n${q}\nCevabını yorumlara yaz.`);
  });

  it("soru yoksa, zaten varsa ya da sınır aşılacaksa dokunmaz", () => {
    expect(withCarouselQuestion("Metin", null)).toBe("Metin");
    const once = withCarouselQuestion("Metin", q);
    expect(withCarouselQuestion(once, q)).toBe(once);
    expect(withCarouselQuestion("x".repeat(2190), q)).toBe("x".repeat(2190));
  });
});
