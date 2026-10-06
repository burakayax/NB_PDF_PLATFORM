import { describe, expect, it } from "vitest";
import { resolveRouteSeo } from "../seo/routeSeoConfig";

/**
 * /pricing uygulamada "landing" görünümüyle açılır. Landing dalı yola bakmadan önce
 * yakaladığında canonical "/" oluyor ve Google /pricing'i ana sayfanın kopyası sayıyordu.
 */
describe("/pricing — adres önce gelir, görünüm değil", () => {
  const cagir = (pathname: string, language: "tr" | "en") =>
    resolveRouteSeo({ pathname, view: "landing", language } as Parameters<typeof resolveRouteSeo>[0]);

  it.each([
    ["/pricing", "tr"],
    ["/en/pricing", "en"],
  ] as const)("%s canonical kendini gösterir", (p, lang) => {
    const s = cagir(p, lang);
    expect(s.canonicalPath).toBe("/pricing");
    expect(s.title.toLowerCase()).toContain(lang === "tr" ? "fiyatlandırma" : "pricing");
    expect(s.index).toBe(true);
  });

  it("ana sayfa hâlâ ana sayfadır", () => {
    expect(cagir("/", "tr").canonicalPath).toBe("/");
  });
});
