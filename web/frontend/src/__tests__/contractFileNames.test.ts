import { describe, it, expect } from "vitest";
import { cleanBaseName, contractDownloadNames } from "../lib/contractFileNames";

/** İndirilen dosya adları kurumsal ve Türkçe karakterli olmalı; yalnızca yasak karakterler atılır. */
describe("contractDownloadNames", () => {
  it("detaylı denetim adları", () => {
    expect(contractDownloadNames("Tedarik Sözleşmesi.pdf", "full")).toEqual({
      annotated: "Tedarik Sözleşmesi - İşaretlenmiş Sözleşme.pdf",
      report: "Tedarik Sözleşmesi - Sözleşme Denetim Raporu.pdf",
    });
  });

  it("hızlı tarama adları belirgin biçimde ayrılır", () => {
    expect(contractDownloadNames("kira.PDF", "quick")).toEqual({
      annotated: "kira - İşaretlenmiş Sözleşme (Hızlı Tarama).pdf",
      report: "kira - Sözleşme Hızlı Tarama Raporu.pdf",
    });
  });

  it("Türkçe karakterleri ASCII'ye çevirmez, yasak karakterleri atar, boşlukları toplar", () => {
    expect(cleanBaseName('Şirket: "Ğüzel" / İş* Ç?.pdf')).toBe("Şirket Ğüzel İş Ç");
    expect(cleanBaseName("a   b.pdf")).toBe("a b");
  });

  it("ayrışık (NFD) Türkçe harfleri tek parçaya (NFC) birleştirir", () => {
    const nfd = "S\u0131\u0307".normalize("NFD") + "ozlesme"; // ayrışık harfli bir ad
    const out = cleanBaseName(`${"I\u0307"}şletme ${nfd}.pdf`.normalize("NFD"));
    expect(out).toBe(out.normalize("NFC"));
    expect(out.startsWith("İ")).toBe(true);
  });

  it("boş/uzun adlarda güvenli yedek", () => {
    expect(cleanBaseName("///.pdf")).toBe("Sözleşme");
    expect(cleanBaseName("x".repeat(200)).length).toBe(80);
  });
});
