/**
 * UDF (UYAP Doküman Formatı) ayrıştırıcı testleri.
 *
 * Biçimin can alıcı noktası offset tabanlı içerik modelidir: metin kök CDATA
 * bloğunda durur, `<content startOffset length>` ona işaret eder. Testler bu
 * dilimlemenin ve bozuk dosya davranışının doğruluğunu kilitler.
 */
import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { parseUdf, udfPlainText, javaColorToHex, UdfParseError } from "../lib/udf";

/** Gerçek UYAP çıktısıyla aynı iskelette bir content.xml üretir. */
function contentXml(text: string, elements: string, extra?: { orientation?: string }) {
  return `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
<content><![CDATA[${text}]]></content>
<properties><pageFormat mediaSizeName="1" leftMargin="42.5" rightMargin="28.3" topMargin="14.1" bottomMargin="14.1" paperOrientation="${extra?.orientation ?? "1"}" /></properties>
<elements resolver="hvl-default">
${elements}
</elements>
<styles><style name="hvl-default" family="Times New Roman" size="13" description="Gövde" /></styles>
</template>`;
}

function udfBytes(xml: string, name = "content.xml"): Uint8Array {
  return zipSync({ [name]: strToU8(xml) });
}

describe("parseUdf", () => {
  it("kök CDATA metnini startOffset/length ile doğru dilimler", () => {
    const text = "Sayın Hâkimliğe,Davacı vekiliyim.";
    const xml = contentXml(
      text,
      `<paragraph Alignment="1" LeftIndent="0.0" RightIndent="0.0">
         <content startOffset="0" length="16" family="Times New Roman" size="13" bold="true" />
       </paragraph>
       <paragraph Alignment="3" LeftIndent="0.0" RightIndent="0.0">
         <content startOffset="16" length="17" family="Times New Roman" size="13" />
       </paragraph>`,
    );
    const doc = parseUdf(udfBytes(xml));

    expect(doc.formatId).toBe("1.8");
    expect(doc.blocks).toHaveLength(2);

    const first = doc.blocks[0];
    const second = doc.blocks[1];
    if (first.kind !== "paragraph" || second.kind !== "paragraph") {
      throw new Error("paragraf bekleniyordu");
    }
    expect(first.runs[0].text).toBe("Sayın Hâkimliğe,");
    expect(first.runs[0].bold).toBe(true);
    expect(first.alignment).toBe("center");
    expect(second.runs[0].text).toBe("Davacı vekiliyim.");
    expect(second.alignment).toBe("justify");
  });

  it("gövde stilini resolver üzerinden okur", () => {
    const doc = parseUdf(
      udfBytes(
        contentXml("abc", `<paragraph Alignment="0"><content startOffset="0" length="3" /></paragraph>`),
      ),
    );
    expect(doc.defaultFamily).toBe("Times New Roman");
    expect(doc.defaultSize).toBe(13);
  });

  it("yatay sayfa yönünü tanır", () => {
    const doc = parseUdf(
      udfBytes(
        contentXml("abc", `<paragraph Alignment="0"><content startOffset="0" length="3" /></paragraph>`, {
          orientation: "2",
        }),
      ),
    );
    expect(doc.page.landscape).toBe(true);
  });

  it("kök <content> ile paragraf içindeki <content> işaretçisini karıştırmaz", () => {
    // Paragraf içi işaretçinin metin gövdesi yoktur; kök CDATA seçilmelidir.
    const doc = parseUdf(
      udfBytes(contentXml("Merhaba", `<paragraph Alignment="0"><content startOffset="0" length="7" /></paragraph>`)),
    );
    expect(doc.rawText).toBe("Merhaba");
  });

  it("tabloyu satır/hücre olarak çözer", () => {
    const text = "AdSoyadAliVeli";
    const xml = contentXml(
      text,
      `<table tableName="Table" columnCount="2" columnSpans="150,150" border="1">
         <row rowName="row1" rowType="dataRow">
           <cell><paragraph Alignment="0"><content startOffset="0" length="2" /></paragraph></cell>
           <cell><paragraph Alignment="0"><content startOffset="2" length="5" /></paragraph></cell>
         </row>
         <row rowName="row2" rowType="dataRow">
           <cell><paragraph Alignment="0"><content startOffset="7" length="3" /></paragraph></cell>
           <cell><paragraph Alignment="0"><content startOffset="10" length="4" /></paragraph></cell>
         </row>
       </table>`,
    );
    const doc = parseUdf(udfBytes(xml));
    const table = doc.blocks[0];
    if (table.kind !== "table") throw new Error("tablo bekleniyordu");
    expect(table.columnCount).toBe(2);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][0][0].runs[0].text).toBe("Ad");
    expect(table.rows[0][1][0].runs[0].text).toBe("Soyad");
    expect(table.rows[1][1][0].runs[0].text).toBe("Veli");
  });

  it("sayfa sonu ve sekmeyi blok olarak taşır", () => {
    const xml = contentXml(
      "ab",
      `<paragraph Alignment="0"><tab startOffset="0" length="1" /><content startOffset="0" length="2" /></paragraph>
       <page-break />`,
    );
    const doc = parseUdf(udfBytes(xml));
    const para = doc.blocks[0];
    if (para.kind !== "paragraph") throw new Error("paragraf bekleniyordu");
    expect(para.runs[0].text).toBe("\t");
    expect(doc.blocks[1].kind).toBe("page-break");
  });

  it("elements çözülemezse ham metni tek paragraf olarak kurtarır", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8"><content><![CDATA[Kurtarılan metin]]></content><elements resolver="hvl-default"></elements></template>`;
    const doc = parseUdf(udfBytes(xml));
    expect(udfPlainText(doc)).toBe("Kurtarılan metin");
  });

  it("content.xml klasör içinde olsa da bulur", () => {
    const xml = contentXml("xy", `<paragraph Alignment="0"><content startOffset="0" length="2" /></paragraph>`);
    const bytes = zipSync({ "belge/content.xml": strToU8(xml) });
    expect(parseUdf(bytes).rawText).toBe("xy");
  });

  it("ZIP olmayan dosyada anlaşılır hata verir", () => {
    const notZip = strToU8("bu bir udf degil");
    expect(() => parseUdf(notZip)).toThrow(UdfParseError);
    try {
      parseUdf(notZip);
    } catch (e) {
      expect((e as UdfParseError).code).toBe("not-zip");
    }
  });

  it("content.xml yoksa anlaşılır hata verir", () => {
    const bytes = zipSync({ "sign.sgn": strToU8("imza") });
    try {
      parseUdf(bytes);
      throw new Error("hata bekleniyordu");
    } catch (e) {
      expect((e as UdfParseError).code).toBe("no-content-xml");
    }
  });
});

describe("udfPlainText", () => {
  it("paragrafları satır satır, tablo hücrelerini sekmeyle verir", () => {
    const text = "BaşlıkA1A2";
    const xml = contentXml(
      text,
      `<paragraph Alignment="0"><content startOffset="0" length="6" /></paragraph>
       <table columnCount="2" columnSpans="1,1">
         <row><cell><paragraph Alignment="0"><content startOffset="6" length="2" /></paragraph></cell>
              <cell><paragraph Alignment="0"><content startOffset="8" length="2" /></paragraph></cell></row>
       </table>`,
    );
    expect(udfPlainText(parseUdf(udfBytes(xml)))).toBe("Başlık\nA1\tA2");
  });
});

describe("javaColorToHex", () => {
  it("Java işaretli tamsayı rengini hex'e çevirir", () => {
    expect(javaColorToHex("-65536")).toBe("#ff0000"); // kırmızı
    expect(javaColorToHex("-16776961")).toBe("#0000ff"); // mavi
  });

  it("siyahı ve geçersiz değeri yok sayar", () => {
    expect(javaColorToHex("-16777216")).toBeUndefined();
    expect(javaColorToHex("")).toBeUndefined();
    expect(javaColorToHex("abc")).toBeUndefined();
  });
});
