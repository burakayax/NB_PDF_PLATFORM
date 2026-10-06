// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { detectInitialLanguage, isPublicSeoPath } from "../hooks/usePreferredLanguage";

function at(path: string, browserLanguage: string) {
  window.history.replaceState({}, "", path);
  Object.defineProperty(window.navigator, "language", { value: browserLanguage, configurable: true });
}

describe("herkese açık sayfalarda dil URL'den gelir (Googlebot en-US ile işler)", () => {
  beforeEach(() => window.localStorage.clear());

  it.each(["/", "/pricing", "/blog", "/blog/udf-dosyasi-nasil-acilir", "/tools/split-pdf", "/pdf-api/docs", "/en", "/en/tools/split-pdf"])(
    "%s herkese açık SEO yolu",
    (p) => expect(isPublicSeoPath(p)).toBe(true),
  );

  it.each(["/login", "/register", "/workspace", "/admin", "/dashboard"])("%s uygulama yolu", (p) =>
    expect(isPublicSeoPath(p)).toBe(false),
  );

  it("öneksiz adres, tarayıcı dili İngilizce olsa da Türkçe kalır", () => {
    at("/", "en-US");
    expect(detectInitialLanguage()).toBe("tr");
    at("/tools/split-pdf", "en-US");
    expect(detectInitialLanguage()).toBe("tr");
  });

  it("/en adresi İngilizce kalır", () => {
    at("/en/tools/split-pdf", "tr-TR");
    expect(detectInitialLanguage()).toBe("en");
  });

  it("otomatik algılanıp saklanan 'en' öneksiz adreste dikkate alınmaz", () => {
    window.localStorage.setItem("nbpdf-language", "en");
    at("/", "en-US");
    expect(detectInitialLanguage()).toBe("tr");
  });

  it("kullanıcı dili elle seçtiyse seçim korunur", () => {
    window.localStorage.setItem("nbpdf-language", "en");
    window.localStorage.setItem("nbpdf-language-explicit", "1");
    at("/", "tr-TR");
    expect(detectInitialLanguage()).toBe("en");
  });

  it("uygulama yollarında eski davranış sürer (tarayıcı dili)", () => {
    at("/login", "en-US");
    expect(detectInitialLanguage()).toBe("en");
    at("/login", "tr-TR");
    expect(detectInitialLanguage()).toBe("tr");
  });
});
