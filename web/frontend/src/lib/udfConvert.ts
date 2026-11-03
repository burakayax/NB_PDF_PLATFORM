/**
 * UDF dönüştürücüleri — hepsi cihazda çalışır, dosya sunucuya gitmez.
 *
 *   docxToUdf     Word (.docx) → UdfDocument   (paragraf, biçim, hizalama, tablo, görsel)
 *   udfToDocx     UdfDocument → Word (.docx)   (aynı öğeler)
 *   linesToUdf    düz metin satırları → UdfDocument (PDF → UDF ve TXT için ortak kuruluş)
 *   imagesToUdf   görseller → UdfDocument      (her görsel kendi sayfasında, ortalı)
 *
 * UdfDocument yapısı `udf.ts`'te; .udf dosyasına yazmak `udfWrite.ts`'te.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type {
  UdfAlignment,
  UdfBlock,
  UdfDocument,
  UdfImage,
  UdfParagraph,
  UdfRun,
  UdfTable,
} from "./udf";
import { emptyParagraph } from "./udfWrite";

const PAGE = { leftMargin: 70.875, rightMargin: 70.875, topMargin: 70.875, bottomMargin: 70.875, landscape: false };

export function newUdfDocument(blocks: UdfBlock[]): UdfDocument {
  return {
    formatId: "1.8",
    rawText: "",
    blocks: blocks.length ? blocks : [emptyParagraph()],
    page: { ...PAGE },
    defaultFamily: "Times New Roman",
    defaultSize: 12,
  };
}

export class ConvertError extends Error {
  constructor(
    message: string,
    readonly code: "not-docx" | "empty",
  ) {
    super(message);
    this.name = "ConvertError";
  }
}

/* ------------------------------------------------------------------ düz metin */

/** Satır listesinden UdfDocument. Boş satır = paragraf ayırıcı yerine boş paragraf olarak korunur. */
export function linesToUdf(lines: string[], opts: { alignment?: UdfAlignment } = {}): UdfDocument {
  const blocks: UdfBlock[] = lines.map((line) => ({
    ...emptyParagraph(),
    alignment: opts.alignment ?? "left",
    runs: line ? [{ text: line }] : [],
  }));
  return newUdfDocument(blocks);
}

/* -------------------------------------------------------------------- görseller */

/** PNG baytlarından piksel boyutu (IHDR); başka biçimde undefined. */
function pngSize(b: Uint8Array): { w: number; h: number } | undefined {
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return undefined;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

/** JPEG baytlarından piksel boyutu (SOF işaretçisi). */
function jpegSize(b: Uint8Array): { w: number; h: number } | undefined {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return undefined;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: (b[i + 5]! << 8) | b[i + 6]!, w: (b[i + 7]! << 8) | b[i + 8]! };
    }
    i += 2 + ((b[i + 2]! << 8) | b[i + 3]!);
  }
  return undefined;
}

export function imageSize(bytes: Uint8Array): { w: number; h: number } | undefined {
  return pngSize(bytes) ?? jpegSize(bytes);
}

/** A4 gövde genişliğine (~453 pt) sığacak şekilde görseli ölçekler. */
const MAX_IMG_W = 450;
const MAX_IMG_H = 640;

export function fitImage(img: { w: number; h: number }): { width: number; height: number } {
  const k = Math.min(1, MAX_IMG_W / img.w, MAX_IMG_H / img.h);
  return { width: Math.round(img.w * k), height: Math.round(img.h * k) };
}

/** Her görsel ayrı sayfada, ortalı. PNG/JPEG girdisi (TIFF önce PNG'ye açılmış olmalı). */
export function imagesToUdf(images: { bytes: Uint8Array; mime: "image/png" | "image/jpeg" }[]): UdfDocument {
  if (images.length === 0) throw new ConvertError("Görsel yok.", "empty");
  const blocks: UdfBlock[] = [];
  images.forEach((im, i) => {
    const sz = imageSize(im.bytes);
    const fit = sz ? fitImage(sz) : { width: 450, height: 300 };
    const img: UdfImage = { bytes: im.bytes, mime: im.mime, width: fit.width, height: fit.height };
    blocks.push({ ...emptyParagraph(), alignment: "center", images: [img] });
    if (i < images.length - 1) blocks.push({ kind: "page-break" });
  });
  return newUdfDocument(blocks);
}

/* ------------------------------------------------------------------ Word → UDF */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const kids = (el: Element, name: string): Element[] =>
  Array.from(el.children).filter((c) => c.localName === name && (c.namespaceURI === W || !c.namespaceURI));

const val = (el: Element | undefined, attrName = "val"): string | null =>
  el ? (el.getAttributeNS(W, attrName) ?? el.getAttribute(`w:${attrName}`)) : null;

const isOn = (el: Element | undefined): boolean => {
  if (!el) return false;
  const v = val(el);
  return v === null || !["0", "false", "off", "none"].includes(v);
};

function alignOf(jc: string | null): UdfAlignment {
  if (jc === "center") return "center";
  if (jc === "right" || jc === "end") return "right";
  if (jc === "both" || jc === "distribute") return "justify";
  return "left";
}

const twipsToPt = (v: string | null): number => (v ? Number.parseFloat(v) / 20 || 0 : 0);

type Rels = Map<string, string>;

function bytesOfMedia(files: Record<string, Uint8Array>, target: string): Uint8Array | undefined {
  const norm = target.replace(/^\//, "").replace(/^\.\.\//, "");
  return files[norm.startsWith("word/") ? norm : `word/${norm}`];
}

function parseRun(r: Element, files: Record<string, Uint8Array>, rels: Rels, out: { runs: UdfRun[]; images: UdfImage[]; pageBreak: boolean }) {
  const pr = kids(r, "rPr")[0];
  const base: Omit<UdfRun, "text"> = {};
  if (pr) {
    const fonts = kids(pr, "rFonts")[0];
    const fam = val(fonts, "ascii");
    if (fam) base.family = fam;
    const sz = val(kids(pr, "sz")[0]);
    if (sz) base.size = Number.parseFloat(sz) / 2 || undefined;
    if (isOn(kids(pr, "b")[0])) base.bold = true;
    if (isOn(kids(pr, "i")[0])) base.italic = true;
    const u = kids(pr, "u")[0];
    if (u && val(u) !== "none") base.underline = true;
    if (isOn(kids(pr, "strike")[0])) base.strikethrough = true;
    const col = val(kids(pr, "color")[0]);
    if (col && /^[0-9a-f]{6}$/i.test(col) && col.toLowerCase() !== "000000") base.color = `#${col.toLowerCase()}`;
  }
  for (const c of Array.from(r.children)) {
    switch (c.localName) {
      case "t":
        if (c.textContent) out.runs.push({ ...base, text: c.textContent });
        break;
      case "tab":
        out.runs.push({ ...base, text: "\t" });
        break;
      case "br":
        if (c.getAttributeNS(W, "type") === "page" || c.getAttribute("w:type") === "page") out.pageBreak = true;
        else out.runs.push({ ...base, text: " " });
        break;
      case "drawing": {
        const blip = c.getElementsByTagNameNS("*", "blip")[0];
        const rid = blip?.getAttributeNS(REL, "embed") ?? blip?.getAttribute("r:embed");
        const target = rid ? rels.get(rid) : undefined;
        const bytes = target ? bytesOfMedia(files, target) : undefined;
        if (bytes) {
          const mime = bytes[0] === 0x89 ? "image/png" : bytes[0] === 0xff ? "image/jpeg" : null;
          const sz = imageSize(bytes);
          if (mime) out.images.push({ bytes, mime, ...(sz ? { width: fitImage(sz).width, height: fitImage(sz).height } : {}) });
        }
        break;
      }
      default:
        break;
    }
  }
}

function parseParagraph(p: Element, files: Record<string, Uint8Array>, rels: Rels): { para: UdfParagraph; pageBreak: boolean } {
  const out = { runs: [] as UdfRun[], images: [] as UdfImage[], pageBreak: false };
  const walk = (parent: Element) => {
    for (const c of Array.from(parent.children)) {
      if (c.localName === "r") parseRun(c, files, rels, out);
      else if (c.localName === "hyperlink" || c.localName === "smartTag" || c.localName === "ins") walk(c);
    }
  };
  walk(p);
  const pPr = kids(p, "pPr")[0];
  const ind = pPr ? kids(pPr, "ind")[0] : undefined;
  const para: UdfParagraph = {
    kind: "paragraph",
    alignment: alignOf(val(pPr ? kids(pPr, "jc")[0] : undefined)),
    leftIndent: twipsToPt(val(ind, "left") ?? val(ind, "start")),
    rightIndent: twipsToPt(val(ind, "right") ?? val(ind, "end")),
    firstLineIndent: twipsToPt(val(ind, "firstLine")),
    runs: out.runs,
    images: out.images,
  };
  return { para, pageBreak: out.pageBreak };
}

function parseTable(tbl: Element, files: Record<string, Uint8Array>, rels: Rels): UdfTable {
  const grid = kids(kids(tbl, "tblGrid")[0] ?? tbl, "gridCol").map((g) => Number.parseFloat(val(g, "w") ?? "0"));
  const rows: UdfParagraph[][][] = [];
  for (const tr of kids(tbl, "tr")) {
    const cells: UdfParagraph[][] = [];
    for (const tc of kids(tr, "tc")) {
      const paras = kids(tc, "p").map((p) => parseParagraph(p, files, rels).para);
      cells.push(paras.length ? paras : [emptyParagraph()]);
    }
    if (cells.length) rows.push(cells);
  }
  const columnCount = Math.max(1, ...rows.map((r) => r.length));
  const ratios = grid.length === columnCount && grid.every((n) => n > 0) ? grid : Array.from({ length: columnCount }, () => 100 / columnCount);
  return { kind: "table", columnCount, columnRatios: ratios, rows };
}

/** Word (.docx) baytlarını UdfDocument'e çevirir. */
export function docxToUdf(bytes: Uint8Array): UdfDocument {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ConvertError("Geçerli bir Word (.docx) dosyası değil.", "not-docx");
  }
  const docXml = files["word/document.xml"];
  if (!docXml) throw new ConvertError("Geçerli bir Word (.docx) dosyası değil.", "not-docx");

  const rels: Rels = new Map();
  const relXml = files["word/_rels/document.xml.rels"];
  if (relXml) {
    const rd = new DOMParser().parseFromString(strFromU8(relXml), "text/xml");
    for (const r of Array.from(rd.getElementsByTagName("Relationship"))) {
      const id = r.getAttribute("Id");
      const target = r.getAttribute("Target");
      if (id && target) rels.set(id, target);
    }
  }

  const xml = new DOMParser().parseFromString(strFromU8(docXml), "text/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new ConvertError("Geçerli bir Word (.docx) dosyası değil.", "not-docx");
  const body = xml.getElementsByTagNameNS("*", "body")[0];
  if (!body) throw new ConvertError("Geçerli bir Word (.docx) dosyası değil.", "not-docx");

  const blocks: UdfBlock[] = [];
  for (const el of Array.from(body.children)) {
    if (el.localName === "p") {
      const { para, pageBreak } = parseParagraph(el, files, rels);
      blocks.push(para);
      if (pageBreak) blocks.push({ kind: "page-break" });
    } else if (el.localName === "tbl") {
      blocks.push(parseTable(el, files, rels));
    }
  }
  if (!blocks.some((b) => b.kind !== "paragraph" || b.runs.length > 0 || b.images.length > 0)) {
    throw new ConvertError("Belgede okunabilir içerik yok.", "empty");
  }
  return newUdfDocument(blocks);
}

/* ------------------------------------------------------------------ UDF → Word */

const esc = (s: string): string =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const JC: Record<UdfAlignment, string> = { left: "left", center: "center", right: "right", justify: "both" };
const EMU = 12700; // 1 pt

function runXml(r: UdfRun): string {
  let pr = "";
  if (r.family) pr += `<w:rFonts w:ascii="${esc(r.family)}" w:hAnsi="${esc(r.family)}" w:cs="${esc(r.family)}"/>`;
  if (r.bold) pr += "<w:b/>";
  if (r.italic) pr += "<w:i/>";
  if (r.underline) pr += '<w:u w:val="single"/>';
  if (r.strikethrough) pr += "<w:strike/>";
  if (r.color) pr += `<w:color w:val="${r.color.replace("#", "")}"/>`;
  if (r.size) pr += `<w:sz w:val="${Math.round(r.size * 2)}"/><w:szCs w:val="${Math.round(r.size * 2)}"/>`;
  if (r.superscript) pr += '<w:vertAlign w:val="superscript"/>';
  const rPr = pr ? `<w:rPr>${pr}</w:rPr>` : "";
  const parts = r.text.replace(/\r/g, "").split(/(\t|\n)/);
  const inner = parts
    .map((t) => (t === "\t" ? "<w:tab/>" : t === "\n" ? "" : t ? `<w:t xml:space="preserve">${esc(t)}</w:t>` : ""))
    .join("");
  return inner ? `<w:r>${rPr}${inner}</w:r>` : "";
}

type DocxCtx = { media: Record<string, Uint8Array>; rels: string[]; n: number };

function imageXml(img: UdfImage, ctx: DocxCtx): string {
  const idx = ++ctx.n;
  const ext = img.mime === "image/jpeg" ? "jpg" : "png";
  ctx.media[`word/media/image${idx}.${ext}`] = img.bytes;
  ctx.rels.push(
    `<Relationship Id="rIdImg${idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${idx}.${ext}"/>`,
  );
  const sz = imageSize(img.bytes);
  const fit = img.width && img.height ? { width: img.width, height: img.height } : sz ? fitImage(sz) : { width: 300, height: 200 };
  const cx = Math.round(fit.width * EMU);
  const cy = Math.round(fit.height * EMU);
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${idx}" name="Resim ${idx}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${idx}" name="image${idx}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdImg${idx}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

function paragraphXml(p: UdfParagraph, ctx: DocxCtx): string {
  let pPr = `<w:jc w:val="${JC[p.alignment]}"/>`;
  const ind =
    (p.leftIndent ? ` w:left="${Math.round(p.leftIndent * 20)}"` : "") +
    (p.rightIndent ? ` w:right="${Math.round(p.rightIndent * 20)}"` : "") +
    (p.firstLineIndent ? ` w:firstLine="${Math.round(p.firstLineIndent * 20)}"` : "");
  if (ind) pPr = `<w:ind${ind}/>${pPr}`;
  const runs = p.runs.map(runXml).join("");
  const imgs = p.images.map((im) => imageXml(im, ctx)).join("");
  return `<w:p><w:pPr>${pPr}</w:pPr>${runs}${imgs}</w:p>`;
}

function tableXml(t: UdfTable, ctx: DocxCtx): string {
  const total = t.columnRatios.reduce((a, b) => a + b, 0) || 1;
  const widths = t.columnRatios.map((r) => Math.round((r / total) * 9000));
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`)
    .join("");
  const rows = t.rows
    .map(
      (row) =>
        `<w:tr>${row
          .map(
            (cell, ci) =>
              `<w:tc><w:tcPr><w:tcW w:w="${widths[ci] ?? 1500}" w:type="dxa"/></w:tcPr>${(cell.length ? cell : [emptyParagraph()]).map((p) => paragraphXml(p, ctx)).join("")}</w:tc>`,
          )
          .join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

/** UdfDocument'ten Word (.docx) baytları. */
export function udfToDocx(doc: UdfDocument): Uint8Array {
  const ctx: DocxCtx = { media: {}, rels: [], n: 0 };
  const body = doc.blocks
    .map((b) => {
      if (b.kind === "paragraph") return paragraphXml(b, ctx);
      if (b.kind === "table") return tableXml(b, ctx) + "<w:p/>"; // tablodan sonra paragraf şart
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    })
    .join("");
  const pg = doc.page;
  const sect =
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"${pg.landscape ? ' w:orient="landscape"' : ""}/>` +
    `<w:pgMar w:top="${Math.round(pg.topMargin * 20)}" w:right="${Math.round(pg.rightMargin * 20)}" w:bottom="${Math.round(pg.bottomMargin * 20)}" w:left="${Math.round(pg.leftMargin * 20)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
  const font = esc(doc.defaultFamily || "Times New Roman");
  const sz = Math.round((doc.defaultSize || 12) * 2);
  const ns =
    `xmlns:w="${W}" xmlns:r="${REL}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/_rels/document.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        ctx.rels.join("") +
        "</Relationships>",
    ),
    "word/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>` +
        `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault>` +
        `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`,
    ),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}${sect}</w:body></w:document>`,
    ),
    ...ctx.media,
  };
  return zipSync(files);
}
