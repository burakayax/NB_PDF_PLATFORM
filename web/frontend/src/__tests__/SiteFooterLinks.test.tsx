import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../components/common/SiteFooter";

vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({ site: { socialLinks: [] } }),
}));

/**
 * İNGİLİZCE SAYFALAR İNGİLİZCE ADRESLERE BAĞLANMALI.
 *
 * Canlıda ölçüldü: İngilizce sayfalardaki iç bağlantıların tamamı Türkçe adrese
 * gidiyordu (/blog, /terms, /tools/merge-pdf…). İç bağlantı, arama motorunun
 * "asıl sayfa hangisi" kararındaki en güçlü sinyallerden biri; site kendi
 * İngilizce sürümüne hiç bağlanmayınca Google Türkçeyi asıl kabul edip
 * İngilizcesini KOPYA sayıyor (Search Console bunu bildirdi).
 *
 * Bu testler o davranışın sessizce geri gelmesini engeller.
 */
describe("site altbilgisi — dile duyarlı bağlantılar", () => {
  const hrefler = (dil: "tr" | "en") => {
    const { container, unmount } = render(<SiteFooter language={dil} />);
    const liste = [...container.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/"));
    unmount();
    return liste;
  };

  it("İngilizcede her iç bağlantı /en ile başlar", () => {
    const liste = hrefler("en");
    expect(liste.length).toBeGreaterThan(5);
    const turkceKalan = liste.filter((h) => !h.startsWith("/en"));
    expect(turkceKalan).toEqual([]);
  });

  it("Türkçede hiçbir bağlantı /en öneki almaz", () => {
    const liste = hrefler("tr");
    expect(liste.length).toBeGreaterThan(5);
    expect(liste.filter((h) => h.startsWith("/en"))).toEqual([]);
  });

  it("araç adresleri de İngilizce slug'a çevrilir (yalnız önek değil)", () => {
    render(<SiteFooter language="en" />);
    // /tools/compress İngilizcede de aynı; ama /tools/pdf-to-image gibi
    // eşlemesi olanlar çevrilmeli. Kritik olan: hiçbiri öneksiz kalmamalı.
    const bagimlilik = screen.getByRole("link", { name: /merge pdf/i });
    expect(bagimlilik.getAttribute("href")).toBe("/en/tools/merge-pdf");
  });

  it("yasal sayfalar da İngilizce sürüme bağlanır", () => {
    render(<SiteFooter language="en" />);
    expect(screen.getByRole("link", { name: /^terms$/i }).getAttribute("href")).toBe("/en/terms");
    expect(screen.getByRole("link", { name: /^privacy$/i }).getAttribute("href")).toBe(
      "/en/privacy",
    );
  });
});
