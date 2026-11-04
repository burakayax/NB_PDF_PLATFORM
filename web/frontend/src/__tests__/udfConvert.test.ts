// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseUdf, udfPlainText, type UdfDocument } from "../lib/udf";
import { writeUdf, emptyParagraph } from "../lib/udfWrite";
import { docxToUdf, imagesToUdf, linesToUdf, udfToDocx, ConvertError } from "../lib/udfConvert";

const DIR = resolve(__dirname, "../../../../udfornek");
const files = (() => {
  try {
    return readdirSync(DIR).filter((f) => f.endsWith(".udf"));
  } catch {
    return [];
  }
})();

const words = (d: UdfDocument) => udfPlainText(d).split(/\s+/).filter(Boolean).join(" ");
const count = (d: UdfDocument, kind: string) => d.blocks.filter((b) => b.kind === kind).length;
const imgs = (d: UdfDocument) =>
  d.blocks.reduce((n, b) => n + (b.kind === "paragraph" ? b.images.length : 0), 0);

// 1x1 şeffaf PNG
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("UDF ⇄ Word", () => {
  it.each(files)("gerçek UDF'den Word'e → UDF içeriği korur: %s", (f) => {
    const original = parseUdf(new Uint8Array(readFileSync(resolve(DIR, f))));
    const docx = udfToDocx(original);
    const back = docxToUdf(docx);
    expect(words(back)).toBe(words(original));
    expect(count(back, "table")).toBe(count(original, "table"));
    expect(imgs(back)).toBe(imgs(original));
  });

  it("Word'den UDF'ye'den Word'e: biçim, hizalama ve Türkçe karakterler korunur", () => {
    const src: UdfDocument = {
      formatId: "1.8",
      rawText: "",
      page: { leftMargin: 70, rightMargin: 70, topMargin: 70, bottomMargin: 70, landscape: false },
      defaultFamily: "Times New Roman",
      defaultSize: 12,
      blocks: [
        { ...emptyParagraph(), alignment: "center", runs: [{ text: "T.C. İSTANBUL ŞUBE", bold: true, size: 14 }] },
        { ...emptyParagraph(), alignment: "justify", firstLineIndent: 42, runs: [{ text: "ğüşiöç ", italic: true }, { text: "altı çizili", underline: true, color: "#c00000" }] },
      ],
    };
    const udf = parseUdf(writeUdf(docxToUdf(udfToDocx(src))));
    expect(words(udf)).toBe("T.C. İSTANBUL ŞUBE ğüşiöç altı çizili");
    const p0 = udf.blocks[0];
    expect(p0?.kind === "paragraph" && p0.alignment).toBe("center");
    expect(p0?.kind === "paragraph" && p0.runs[0]?.bold).toBe(true);
    const p1 = udf.blocks[1];
    expect(p1?.kind === "paragraph" && p1.alignment).toBe("justify");
    expect(p1?.kind === "paragraph" && p1.runs.some((r) => r.underline && r.color === "#c00000")).toBe(true);
  });

  it("docx olmayan dosya anlaşılır hata verir", () => {
    expect(() => docxToUdf(new Uint8Array([1, 2, 3, 4]))).toThrow(ConvertError);
  });
});

describe("metin ve görsel → UDF", () => {
  it("satırlar paragraf olur, boş satır boş paragraf kalır", () => {
    const d = linesToUdf(["Merhaba dünya", "", "İkinci"]);
    expect(d.blocks).toHaveLength(3);
    const back = parseUdf(writeUdf(d));
    expect(words(back)).toBe("Merhaba dünya İkinci");
  });

  it("görseller ayrı sayfalarda, sayfa kesmeleriyle", () => {
    const d = imagesToUdf([
      { bytes: PNG, mime: "image/png" },
      { bytes: PNG, mime: "image/png" },
    ]);
    expect(count(d, "page-break")).toBe(1);
    const back = parseUdf(writeUdf(d));
    expect(imgs(back)).toBe(2);
  });
});
