import { describe, it, expect } from "vitest";
import { resolveRouteSeo } from "../seo/routeSeoConfig";

/**
 * KAYIT/GİRİŞ SAYFALARINDA SİNYAL ÇELİŞKİSİ OLMAMALI.
 *
 * Bu sayfalar hem "noindex" diyor hem de canonical ile BAŞKA bir sayfayı
 * (ana sayfa) gösteriyordu. İkisi çelişir: canonical "asıl sayfa şu, onu dizine
 * al" derken noindex "dizine alma" der. Google bu ikisinin birlikte
 * kullanılmamasını söylüyor; canlıda Search Console /en/register için tuhaf
 * durum bildirdi. Doğrusu: noindex kalır, canonical kendini gösterir.
 */
describe("kayıt/giriş sayfaları — SEO sinyalleri", () => {
  const cagir = (pathname: string, view: "register" | "login") =>
    resolveRouteSeo({
      pathname,
      view,
      language: pathname.startsWith("/en") ? "en" : "tr",
    } as Parameters<typeof resolveRouteSeo>[0]);

  it("canonical kendini gösterir, ana sayfayı değil", () => {
    expect(cagir("/register", "register").canonicalPath).toBe("/register");
    expect(cagir("/login", "login").canonicalPath).toBe("/login");
  });

  it("İngilizce yolda /en öneki canonical yolundan düşer (önek sonradan eklenir)", () => {
    expect(cagir("/en/register", "register").canonicalPath).toBe("/register");
  });

  it("sayfa dizine alınmaz ve bağlantıları izlenmez", () => {
    const s = cagir("/register", "register");
    expect(s.index).toBe(false);
    expect(s.follow).toBe(false);
  });
});
