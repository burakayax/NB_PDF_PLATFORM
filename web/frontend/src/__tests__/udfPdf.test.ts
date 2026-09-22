/**
 * UDF → PDF ÇİZİMİ.
 *
 * Gerçek Roboto baytları ve gerçek pdf-lib ile çalışır. Korunan davranışlar:
 * Türkçe harflerin PDF'e gerçekten yazılabilmesi, uzun metnin sayfaya bölünmesi,
 * sayfa sonu/tablo/görsel bloklarının çıktıyı düşürmemesi.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { zipSync, strToU8 } from "fflate";
import { parseUdf } from "../lib/udf";
import { udfToPdf } from "../lib/udfPdf";

const fonts = {
  regular: new Uint8Array(readFileSync(join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf"))),
  bold: new Uint8Array(readFileSync(join(process.cwd(), "public", "fonts", "Roboto-Bold.ttf"))),
};

function udf(text: string, elements: string): Uint8Array {
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
<content><![CDATA[${text}]]></content>
<properties><pageFormat leftMargin="42.5" rightMargin="28.3" topMargin="14.1" bottomMargin="14.1" paperOrientation="1" /></properties>
<elements resolver="hvl-default">${elements}</elements>
<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>
</template>`;
  return zipSync({ "content.xml": strToU8(xml) });
}

describe("udfToPdf", () => {
  it("Türkçe harfleri kaybetmeden geçerli PDF üretir", async () => {
    const text = "İğdır'da çalışan şoför, ÖĞÜN ve ŞIK sözcüklerini yazdı.";
    const bytes = await udfToPdf(
      parseUdf(
        udf(text, `<paragraph Alignment="0"><content startOffset="0" length="${text.length}" size="12" /></paragraph>`),
      ),
      fonts,
    );

    expect(bytes.length).toBeGreaterThan(1000);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1);
    // Producer'ı pdf-lib kendi imzasıyla eziyor; kalıcı künye Creator.
    expect(out.getCreator()).toContain("PDF Platform");
  });

  it("uzun metni birden çok sayfaya böler", async () => {
    const paragraf = "Bu bir deneme cümlesidir ve sayfayı doldurmak için tekrarlanır. ".repeat(40);
    const text = paragraf.repeat(6);
    const bytes = await udfToPdf(
      parseUdf(
        udf(text, `<paragraph Alignment="3"><content startOffset="0" length="${text.length}" size="12" /></paragraph>`),
      ),
      fonts,
    );
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBeGreaterThan(1);
  });

  it("sayfa sonu yeni sayfa açar", async () => {
    const text = "BirinciIkinci";
    const bytes = await udfToPdf(
      parseUdf(
        udf(
          text,
          `<paragraph Alignment="0"><content startOffset="0" length="7" /></paragraph>
           <page-break />
           <paragraph Alignment="0"><content startOffset="7" length="6" /></paragraph>`,
        ),
      ),
      fonts,
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it("tabloyu çizer ve çıktıyı bozmaz", async () => {
    const text = "AdSoyadAliVeli";
    const bytes = await udfToPdf(
      parseUdf(
        udf(
          text,
          `<table columnCount="2" columnSpans="150,150" border="1">
             <row><cell><paragraph Alignment="0"><content startOffset="0" length="2" /></paragraph></cell>
                  <cell><paragraph Alignment="0"><content startOffset="2" length="5" /></paragraph></cell></row>
             <row><cell><paragraph Alignment="0"><content startOffset="7" length="3" /></paragraph></cell>
                  <cell><paragraph Alignment="0"><content startOffset="10" length="4" /></paragraph></cell></row>
           </table>`,
        ),
      ),
      fonts,
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("yatay yönlendirmede sayfayı geniş kurar", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8"><content><![CDATA[yatay]]></content>
<properties><pageFormat leftMargin="42.5" rightMargin="28.3" topMargin="14.1" bottomMargin="14.1" paperOrientation="2" /></properties>
<elements resolver="hvl-default"><paragraph Alignment="0"><content startOffset="0" length="5" /></paragraph></elements></template>`;
    const bytes = await udfToPdf(parseUdf(zipSync({ "content.xml": strToU8(xml) })), fonts);
    const page = (await PDFDocument.load(bytes)).getPage(0);
    expect(page.getWidth()).toBeGreaterThan(page.getHeight());
  });

  it("bozuk gömülü görsel dönüşümü düşürmez", async () => {
    const text = "Metin korunmalı";
    const bytes = await udfToPdf(
      parseUdf(
        udf(
          text,
          `<paragraph Alignment="0">
             <content startOffset="0" length="${text.length}" />
             <image startOffset="0" length="1" imageData="iVBORw0KGgoBOZUK" width="50" height="50" />
           </paragraph>`,
        ),
      ),
      fonts,
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
