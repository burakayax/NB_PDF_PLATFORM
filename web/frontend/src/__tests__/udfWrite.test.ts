// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseUdf, udfPlainText, type UdfDocument } from "../lib/udf";
import { emptyParagraph, writeUdf } from "../lib/udfWrite";

const DIR = resolve(__dirname, "../../../../udfornek");
const files = (() => {
  try {
    return readdirSync(DIR).filter((f) => f.endsWith(".udf"));
  } catch {
    return [];
  }
})();

const shape = (d: UdfDocument) =>
  d.blocks.map((b) =>
    b.kind === "paragraph"
      ? `p:${b.alignment}:${b.images.length}`
      : b.kind === "table"
        ? `t:${b.columnCount}x${b.rows.length}`
        : "pb",
  );

describe("UDF yazıcı", () => {
  it.each(files)("gerçek örnek gidiş-dönüşte aynı kalır: %s", (f) => {
    const original = parseUdf(new Uint8Array(readFileSync(resolve(DIR, f))));
    const again = parseUdf(writeUdf(original));
    // Boşluk/satır sonu sayısı gerçek dosyalarda parça sınırlarında oynayabilir; içerik (kelimeler, sıra) aynı olmalı.
    const words = (d: UdfDocument) => udfPlainText(d).split(/\s+/).filter(Boolean).join(" ");
    expect(words(again)).toBe(words(original));
    expect(shape(again)).toEqual(shape(original));
  });

  it("Türkçe ve özel karakterler bozulmaz, biçim korunur", () => {
    const doc: UdfDocument = {
      formatId: "1.8",
      rawText: "",
      page: { leftMargin: 42.5, rightMargin: 28.3, topMargin: 14.2, bottomMargin: 14.2, landscape: false },
      defaultFamily: "Times New Roman",
      defaultSize: 12,
      blocks: [
        { ...emptyParagraph(), alignment: "center", runs: [{ text: 'ÇĞİÖŞÜ çğıöşü & <b> ]]> "tırnak"', bold: true, color: "#c00000" }] },
        emptyParagraph(),
        { ...emptyParagraph(), alignment: "justify", firstLineIndent: 42, runs: [{ text: "Normal " }, { text: "eğik", italic: true }] },
      ],
    };
    const back = parseUdf(writeUdf(doc));
    const plain = udfPlainText(back);
    expect(plain).toContain('ÇĞİÖŞÜ çğıöşü & <b> ]]> "tırnak"');
    expect(plain).toContain("Normal eğik");
    const p0 = back.blocks[0];
    expect(p0?.kind === "paragraph" && p0.runs[0]?.bold).toBe(true);
    expect(p0?.kind === "paragraph" && p0.runs[0]?.color).toBe("#c00000");
  });
});
