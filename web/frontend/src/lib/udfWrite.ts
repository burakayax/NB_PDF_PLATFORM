/**
 * UDF YAZICI — yapısal belgeyi (`UdfDocument`) UYAP Doküman Formatı (.udf) dosyasına çevirir.
 * Tamamen cihazda çalışır. Okuyucunun (`udf.ts`) tersidir; biçim gerçek UYAP örneklerinden çözümlendi:
 *
 *  - Dosya bir ZIP: `content.xml` + `documentproperties.xml`.
 *  - Belgenin TÜM metni kök <content> CDATA'sında; <elements> altındaki her parça o metne
 *    startOffset + length ile işaret eder. Her paragrafın metni sonda "\n" ile biter ve
 *    paragrafın son parçasının uzunluğuna dahildir. Boş paragraf = tek "\n".
 *  - Görsel, metinde tek karakterlik (boşluk) yer tutar; <image imageData="base64" …>.
 *
 * ÖNEMLİ: Üretilen dosyanın UYAP Doküman Editörü'nde açıldığı gerçek editörde elle doğrulanmalıdır
 * (bkz. ARAC_YOL_HARITASI.md). Burada yalnızca kendi okuyucumuzla gidiş-dönüş ve gerçek örnek
 * dosyalarla yapısal karşılaştırma testleri vardır.
 */
import { zipSync, strToU8 } from "fflate";
import type { UdfAlignment, UdfBlock, UdfDocument, UdfParagraph, UdfRun, UdfTable } from "./udf";

const ALIGN_CODE: Record<UdfAlignment, number> = { left: 0, center: 1, right: 2, justify: 3 };

/** XML 1.0'da geçersiz denetim karakterlerini atar (CDATA ve öznitelikler için). */
function cleanXmlText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");
}

function attr(v: string): string {
  return cleanXmlText(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** #RRGGBB → Java işaretli tamsayı (alfa 0xFF). */
function hexToJavaColor(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = (0xff000000 | Number.parseInt(m[1]!, 16)) | 0;
  return String(n);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

export function emptyParagraph(): UdfParagraph {
  return { kind: "paragraph", alignment: "left", leftIndent: 0, rightIndent: 0, firstLineIndent: 0, runs: [], images: [] };
}

class Writer {
  text = "";

  private runAttrs(r: UdfRun): string {
    let a = "";
    if (r.family) a += ` family="${attr(r.family)}"`;
    if (r.size) a += ` size="${r.size}"`;
    if (r.bold) a += ` bold="true"`;
    if (r.italic) a += ` italic="true"`;
    if (r.underline) a += ` underline="true"`;
    if (r.strikethrough) a += ` strikethrough="true"`;
    if (r.superscript) a += ` superscript="true"`;
    const c = r.color ? hexToJavaColor(r.color) : null;
    if (c) a += ` foreground="${c}"`;
    return a;
  }

  paragraph(p: UdfParagraph): string {
    // Satır sonu paragraf sonudur; metin içindeki yeni satırlar boşluğa çevrilir (biçim bozulmasın).
    const runs: UdfRun[] = p.runs
      .map((r) => ({ ...r, text: cleanXmlText(r.text) }))
      .filter((r) => r.text.length > 0);
    // Okunan paragrafların son parçası zaten paragraf sonu satır sonunu taşır: varsa tekrar eklenmez.
    // Parça içindeki satır sonları olduğu gibi korunur (gerçek UYAP dosyalarında görülüyor; gidiş-dönüş bozulmasın).
    const endsWithNl = (runs[runs.length - 1]?.text ?? "").endsWith("\n");
    const parts: string[] = [];
    if (runs.length === 0 && p.images.length === 0) {
      parts.push(`<content startOffset="${this.text.length}" length="1" />`);
      this.text += "\n";
    } else {
      runs.forEach((r, i) => {
        const last = i === runs.length - 1 && p.images.length === 0;
        const t = last && !endsWithNl ? `${r.text}\n` : r.text;
        parts.push(
          r.text === "\t" && !last
            ? `<tab startOffset="${this.text.length}" length="1" />`
            : `<content${this.runAttrs(r)} resolver="hvl-default" startOffset="${this.text.length}" length="${t.length}" />`,
        );
        this.text += t;
      });
      p.images.forEach((img, i) => {
        const w = img.width ? ` width="${img.width}"` : "";
        const h = img.height ? ` height="${img.height}"` : "";
        parts.push(
          `<image${w}${h} resolver="hvl-default" imageData="${bytesToBase64(img.bytes)}" startOffset="${this.text.length}" length="1" />`,
        );
        this.text += " ";
        if (i === p.images.length - 1) {
          parts.push(`<content resolver="hvl-default" startOffset="${this.text.length}" length="1" />`);
          this.text += "\n";
        }
      });
    }
    let a = ` Alignment="${ALIGN_CODE[p.alignment] ?? 0}"`;
    if (p.leftIndent) a += ` LeftIndent="${p.leftIndent}"`;
    if (p.rightIndent) a += ` RightIndent="${p.rightIndent}"`;
    if (p.firstLineIndent) a += ` FirstLineIndent="${p.firstLineIndent}"`;
    return `<paragraph${a}>${parts.join("")}</paragraph>`;
  }

  table(t: UdfTable): string {
    const spans =
      t.columnRatios.length === t.columnCount
        ? t.columnRatios
        : Array.from({ length: t.columnCount }, () => 100 / t.columnCount);
    const rows = t.rows
      .map(
        (row, ri) =>
          `<row rowName="row${ri + 1}" rowType="dataRow">${row
            .map((cell) => `<cell>${(cell.length ? cell : [emptyParagraph()]).map((p) => this.paragraph(p)).join("")}</cell>`)
            .join("")}</row>`,
      )
      .join("");
    return `<table tableName="Sabit" columnCount="${t.columnCount}" columnSpans="${spans.map((s) => Math.round(s * 100) / 100).join(",")}" border="borderCell">${rows}</table>`;
  }

  block(b: UdfBlock): string {
    if (b.kind === "paragraph") return this.paragraph(b);
    if (b.kind === "table") return this.table(b);
    return "<page-break/>";
  }
}

/** Yapısal belgeden content.xml metnini üretir. */
export function buildUdfContentXml(doc: UdfDocument): string {
  const w = new Writer();
  const elements = doc.blocks.map((b) => w.block(b)).join("");
  const pg = doc.page;
  const family = attr(doc.defaultFamily || "Times New Roman");
  const size = doc.defaultSize || 12;
  const raw = w.text.replace(/\]\]>/g, "]]]]><![CDATA[>");
  return (
    `<?xml version="1.0" encoding="UTF-8" ?> \n\n<template format_id="1.8" >\n` +
    `<content><![CDATA[${raw}]]></content>` +
    `<properties><pageFormat mediaSizeName="1" leftMargin="${pg.leftMargin}" rightMargin="${pg.rightMargin}" topMargin="${pg.topMargin}" bottomMargin="${pg.bottomMargin}" paperOrientation="${pg.landscape ? 2 : 1}" headerFOffset="20.0" footerFOffset="20.0" /></properties>\n` +
    `<elements resolver="hvl-default" >\n${elements}\n</elements>\n` +
    `<styles><style name="hvl-default" family="${family}" size="${size}" description="Gövde" /></styles>\n</template>`
  );
}

const DOC_PROPS =
  '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
  '<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">\n<properties>\n</properties>';

/** Yapısal belgeyi .udf (ZIP) baytlarına çevirir. */
export function writeUdf(doc: UdfDocument): Uint8Array {
  return zipSync({
    "content.xml": strToU8(buildUdfContentXml(doc)),
    "documentproperties.xml": strToU8(DOC_PROPS),
  });
}
