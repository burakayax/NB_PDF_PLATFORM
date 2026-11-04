// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { itemsToParagraphs, pagesToUdf, type TextItem } from "../lib/pdfToUdf";
import { parseUdf, udfPlainText } from "../lib/udf";
import { writeUdf } from "../lib/udfWrite";

const it_ = (str: string, x: number, y: number, w = str.length * 5, h = 10): TextItem => ({ str, x, y, w, h });

describe("PDF'ten UDF'ye metin gruplama", () => {
  it("aynı satırdaki parçalar birleşir, geniş aralık yeni paragraf olur", () => {
    const items = [
      it_("Sayın", 50, 700), it_("Hakim,", 80, 700),
      it_("Dilekçem", 50, 688), it_("ektedir.", 100, 688),
      it_("İtirazım", 50, 640), it_("vardır.", 100, 640), // büyük boşluk → yeni paragraf
    ];
    expect(itemsToParagraphs(items)).toEqual(["Sayın Hakim, Dilekçem ektedir.", "İtirazım vardır."]);
  });

  it("boş parçaları atar ve sırayı yukarıdan aşağıya kurar", () => {
    const items = [it_("alt", 50, 100), it_(" ", 10, 400), it_("üst", 50, 700)];
    expect(itemsToParagraphs(items).join("|")).toContain("üst");
    expect(itemsToParagraphs(items)[0]).toMatch(/^üst/);
  });

  it("Türkçe karakterli çok sayfalı belge UDF'ye yazılıp geri okunur", () => {
    const udf = pagesToUdf([["ÇĞİÖŞÜ birinci sayfa"], ["ikinci sayfa çğıöşü"]]);
    const back = parseUdf(writeUdf(udf));
    const plain = udfPlainText(back);
    expect(plain).toContain("ÇĞİÖŞÜ birinci sayfa");
    expect(plain).toContain("ikinci sayfa çğıöşü");
    expect(back.blocks.some((b) => b.kind === "page-break")).toBe(true);
  });
});
