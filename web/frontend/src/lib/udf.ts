/**
 * UDF (UYAP Doküman Formatı) AYRIŞTIRICI — tamamen cihazda çalışır.
 *
 * UDF, Adalet Bakanlığı'nın UYAP sisteminde kullanılan belge biçimidir. Dosya
 * aslında bir ZIP arşividir; içinde `content.xml` (ve bazı sürümlerde
 * `documentproperties.xml`, `sign.sgn`) bulunur.
 *
 * ÖNEMLİ — biçimin can alıcı noktası: metin XML elemanlarının İÇİNDE durmaz.
 * Belgenin TAMAMI kök `<content>` elemanındaki tek bir CDATA bloğunda yaşar;
 * `<elements>` altındaki her parça o metne `startOffset` + `length` ile işaret
 * eder ("offset tabanlı içerik modeli"). Bu yüzden biçimlendirmeyi çözmek için
 * önce CDATA metnini alıp sonra dilimlemek gerekir.
 *
 * Şema (format_id="1.8"):
 *   <template format_id="1.8">
 *     <content><![CDATA[ ...belgenin tüm metni... ]]></content>
 *     <properties><pageFormat leftMargin=".." topMargin=".." .../></properties>
 *     <elements resolver="hvl-default">
 *       <paragraph Alignment="0" LeftIndent="0.0" RightIndent="0.0">
 *         <content startOffset="0" length="12" family="Times New Roman"
 *                  size="12" bold="true" foreground="-16777216"/>
 *         <tab startOffset="12" length="1"/>
 *         <image startOffset="13" length="1" imageData="<base64>" .../>
 *       </paragraph>
 *       <page-break/>
 *       <table columnCount="3" columnSpans="100,100,100">
 *         <row><cell>…<paragraph>…</cell></row>
 *       </table>
 *     </elements>
 *     <styles><style name="hvl-default" family="Times New Roman" size="12"/></styles>
 *   </template>
 *
 * Hizalama değerleri Java Swing `StyleConstants` ile aynıdır:
 * 0=sola, 1=ortala, 2=sağa, 3=iki yana yasla. Renkler Java'nın işaretli
 * tamsayı kodlamasındadır (siyah = -16777216).
 */
import { unzipSync, strFromU8 } from "fflate";

/** Bir paragraf içindeki, aynı biçime sahip metin parçası. */
export type UdfRun = {
  text: string;
  family?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  superscript?: boolean;
  /** #RRGGBB — yalnız siyah dışındaki renklerde dolu. */
  color?: string;
};

export type UdfImage = {
  /** Ham görsel baytları (base64 çözülmüş). */
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width?: number;
  height?: number;
};

export type UdfAlignment = "left" | "center" | "right" | "justify";

export type UdfParagraph = {
  kind: "paragraph";
  alignment: UdfAlignment;
  leftIndent: number;
  rightIndent: number;
  firstLineIndent: number;
  runs: UdfRun[];
  images: UdfImage[];
};

export type UdfTable = {
  kind: "table";
  columnCount: number;
  /** Sütun genişlik oranları (columnSpans); toplama göre normalize edilir. */
  columnRatios: number[];
  rows: UdfParagraph[][][];
};

export type UdfPageBreak = { kind: "page-break" };

export type UdfBlock = UdfParagraph | UdfTable | UdfPageBreak;

export type UdfPageFormat = {
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
  /** 1 = dikey (portrait), 2 = yatay (landscape). */
  landscape: boolean;
};

export type UdfDocument = {
  formatId: string;
  /** Kök CDATA bloğundaki ham metnin tamamı. */
  rawText: string;
  blocks: UdfBlock[];
  page: UdfPageFormat;
  /** `<styles>` içindeki varsayılan gövde yazı tipi/boyutu. */
  defaultFamily: string;
  defaultSize: number;
};

/** Dosya UDF değilse / bozuksa fırlatılır; çağıran tarafta kullanıcıya çevrilir. */
export class UdfParseError extends Error {
  constructor(
    message: string,
    /** Kullanıcıya gösterilecek sebep kodu. */
    readonly code:
      | "not-zip"
      | "no-content-xml"
      | "bad-xml"
      | "no-template"
      | "empty" = "bad-xml",
  ) {
    super(message);
    this.name = "UdfParseError";
  }
}

const DEFAULT_PAGE: UdfPageFormat = {
  // UYAP varsayılanına yakın kenar boşlukları (nokta cinsinden).
  leftMargin: 42.5,
  rightMargin: 28.3,
  topMargin: 14.2,
  bottomMargin: 14.2,
  landscape: false,
};

function num(v: string | null | undefined, fallback: number): number {
  if (v == null || v === "") return fallback;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | null | undefined): boolean {
  return v === "true" || v === "1";
}

/** Java'nın işaretli tamsayı renk kodunu #RRGGBB'ye çevirir. */
export function javaColorToHex(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  // İşaretli 32-bit → işaretsiz; alfa baytı atılır.
  const rgb = (n >>> 0) & 0xffffff;
  if (rgb === 0x000000) return undefined; // siyah = varsayılan, taşımaya gerek yok
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

function alignmentFrom(raw: string | null | undefined): UdfAlignment {
  // Java Swing StyleConstants: 0=LEFT, 1=CENTER, 2=RIGHT, 3=JUSTIFIED.
  switch ((raw ?? "0").trim()) {
    case "1":
      return "center";
    case "2":
      return "right";
    case "3":
      return "justify";
    default:
      return "left";
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** İlk baytlardan görsel türünü anlar (uzantı bilgisi yok). */
function sniffImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return "image/png";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  return null;
}

/**
 * ZIP arşivinden `content.xml`'i çıkarır. Dosya adı bazı üreticilerde farklı
 * kutulanmış olabildiği için büyük/küçük harf ve klasör önekine bakılmaz.
 */
export function extractContentXml(fileBytes: Uint8Array): string {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(fileBytes);
  } catch {
    throw new UdfParseError("Dosya bir ZIP arşivi olarak açılamadı.", "not-zip");
  }
  const names = Object.keys(entries);
  const hit =
    names.find((n) => n.toLowerCase() === "content.xml") ??
    names.find((n) => n.toLowerCase().endsWith("/content.xml")) ??
    names.find((n) => n.toLowerCase().endsWith("content.xml"));
  if (!hit) {
    throw new UdfParseError("Arşivin içinde content.xml bulunamadı.", "no-content-xml");
  }
  const bytes = entries[hit];
  if (!bytes || bytes.length === 0) {
    throw new UdfParseError("content.xml boş.", "empty");
  }
  // UDF her zaman UTF-8; BOM varsa strFromU8 zaten sorunsuz çözer.
  return strFromU8(bytes);
}

/**
 * Kök CDATA metnini bulur.
 *
 * DİKKAT: `<content>` etiketi biçimde İKİ ayrı anlamda kullanılır — kökteki
 * metin deposu ve paragraf içindeki biçim işaretçisi. Ayrım, işaretçilerin
 * `startOffset` özniteliği taşıması ve metin içeriğinin olmamasıdır.
 */
function readRootText(template: Element): string {
  for (const child of Array.from(template.children)) {
    if (child.tagName !== "content") continue;
    if (child.hasAttribute("startOffset")) continue;
    return child.textContent ?? "";
  }
  return "";
}

function parseRunsAndImages(
  parent: Element,
  rawText: string,
): { runs: UdfRun[]; images: UdfImage[] } {
  const runs: UdfRun[] = [];
  const images: UdfImage[] = [];

  const slice = (el: Element): string => {
    const start = num(el.getAttribute("startOffset"), -1);
    const len = num(el.getAttribute("length"), 0);
    if (start < 0 || len <= 0) return "";
    return rawText.slice(start, start + len);
  };

  for (const el of Array.from(parent.children)) {
    switch (el.tagName) {
      case "content": {
        const text = slice(el);
        if (!text) break;
        runs.push({
          text,
          family: el.getAttribute("family") ?? undefined,
          size: num(el.getAttribute("size"), 0) || undefined,
          bold: bool(el.getAttribute("bold")),
          italic: bool(el.getAttribute("italic")),
          underline: bool(el.getAttribute("underline")),
          strikethrough: bool(el.getAttribute("strikethrough")),
          superscript: bool(el.getAttribute("superscript")),
          color: javaColorToHex(el.getAttribute("foreground")),
        });
        break;
      }
      case "tab": {
        runs.push({ text: "\t" });
        break;
      }
      case "space": {
        const text = slice(el) || " ";
        runs.push({ text });
        break;
      }
      case "image": {
        const data = el.getAttribute("imageData");
        if (!data) break;
        try {
          const bytes = base64ToBytes(data);
          const mime = sniffImageMime(bytes);
          if (!mime) break;
          images.push({
            bytes,
            mime,
            width: num(el.getAttribute("width"), 0) || undefined,
            height: num(el.getAttribute("height"), 0) || undefined,
          });
        } catch {
          // Bozuk görsel tüm belgeyi düşürmesin — atlanır.
        }
        break;
      }
      default:
        break;
    }
  }
  return { runs, images };
}

function parseParagraph(el: Element, rawText: string): UdfParagraph {
  const { runs, images } = parseRunsAndImages(el, rawText);
  return {
    kind: "paragraph",
    alignment: alignmentFrom(el.getAttribute("Alignment") ?? el.getAttribute("alignment")),
    leftIndent: num(el.getAttribute("LeftIndent"), 0),
    rightIndent: num(el.getAttribute("RightIndent"), 0),
    firstLineIndent: num(el.getAttribute("FirstLineIndent"), 0),
    runs,
    images,
  };
}

function parseTable(el: Element, rawText: string): UdfTable {
  const spansRaw = (el.getAttribute("columnSpans") ?? "")
    .split(",")
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const rows: UdfParagraph[][][] = [];
  for (const rowEl of Array.from(el.children)) {
    if (rowEl.tagName !== "row") continue;
    const cells: UdfParagraph[][] = [];
    for (const cellEl of Array.from(rowEl.children)) {
      if (cellEl.tagName !== "cell") continue;
      const paras: UdfParagraph[] = [];
      for (const inner of Array.from(cellEl.children)) {
        if (inner.tagName === "paragraph") paras.push(parseParagraph(inner, rawText));
      }
      // Hücre doğrudan <content> taşıyorsa onu tek paragraf say.
      if (paras.length === 0) paras.push(parseParagraph(cellEl, rawText));
      cells.push(paras);
    }
    if (cells.length > 0) rows.push(cells);
  }

  const declared = Math.trunc(num(el.getAttribute("columnCount"), 0));
  const columnCount = declared > 0 ? declared : (rows[0]?.length ?? 1);
  const ratios =
    spansRaw.length === columnCount
      ? spansRaw
      : Array.from({ length: columnCount }, () => 1);

  return { kind: "table", columnCount, columnRatios: ratios, rows };
}

/** UDF dosyasının baytlarını yapısal belgeye çevirir. Hiçbir şey yüklenmez. */
export function parseUdf(fileBytes: Uint8Array): UdfDocument {
  const xml = extractContentXml(fileBytes);

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new UdfParseError("content.xml geçerli bir XML değil.", "bad-xml");
  }

  const template =
    doc.documentElement?.tagName === "template"
      ? doc.documentElement
      : doc.getElementsByTagName("template")[0];
  if (!template) {
    throw new UdfParseError("Belge kökü (template) bulunamadı.", "no-template");
  }

  const rawText = readRootText(template);

  const pageEl = template.getElementsByTagName("pageFormat")[0];
  const page: UdfPageFormat = pageEl
    ? {
        leftMargin: num(pageEl.getAttribute("leftMargin"), DEFAULT_PAGE.leftMargin),
        rightMargin: num(pageEl.getAttribute("rightMargin"), DEFAULT_PAGE.rightMargin),
        topMargin: num(pageEl.getAttribute("topMargin"), DEFAULT_PAGE.topMargin),
        bottomMargin: num(pageEl.getAttribute("bottomMargin"), DEFAULT_PAGE.bottomMargin),
        landscape: (pageEl.getAttribute("paperOrientation") ?? "1").trim() === "2",
      }
    : { ...DEFAULT_PAGE };

  // Gövde stili: `resolver` hangi stili işaret ediyorsa o, yoksa hvl-default.
  const elementsEl = template.getElementsByTagName("elements")[0];
  const resolver = elementsEl?.getAttribute("resolver") ?? "hvl-default";
  let defaultFamily = "Times New Roman";
  let defaultSize = 12;
  for (const styleEl of Array.from(template.getElementsByTagName("style"))) {
    if (styleEl.getAttribute("name") !== resolver) continue;
    defaultFamily = styleEl.getAttribute("family") ?? defaultFamily;
    defaultSize = num(styleEl.getAttribute("size"), defaultSize);
    break;
  }

  const blocks: UdfBlock[] = [];
  for (const el of Array.from(elementsEl?.children ?? [])) {
    switch (el.tagName) {
      case "paragraph":
        blocks.push(parseParagraph(el, rawText));
        break;
      case "table":
        blocks.push(parseTable(el, rawText));
        break;
      case "page-break":
      case "pageBreak":
        blocks.push({ kind: "page-break" });
        break;
      default:
        break;
    }
  }

  // `<elements>` hiç çözülemediyse en azından ham metni tek paragraf olarak ver:
  // kullanıcı biçimsiz de olsa belgesine ulaşsın.
  if (blocks.length === 0 && rawText.trim()) {
    blocks.push({
      kind: "paragraph",
      alignment: "left",
      leftIndent: 0,
      rightIndent: 0,
      firstLineIndent: 0,
      runs: [{ text: rawText }],
      images: [],
    });
  }

  if (blocks.length === 0) {
    throw new UdfParseError("Belgede okunabilir içerik yok.", "empty");
  }

  return { formatId: template.getAttribute("format_id") ?? "", rawText, blocks, page, defaultFamily, defaultSize };
}

/** Belgenin düz metnini döndürür (önizleme, arama, kopyalama için). */
export function udfPlainText(doc: UdfDocument): string {
  const lines: string[] = [];
  const paraText = (p: UdfParagraph) => p.runs.map((r) => r.text).join("");
  for (const b of doc.blocks) {
    if (b.kind === "paragraph") {
      lines.push(paraText(b));
    } else if (b.kind === "table") {
      for (const row of b.rows) {
        lines.push(row.map((cell) => cell.map(paraText).join(" ")).join("\t"));
      }
    } else {
      lines.push("");
    }
  }
  // UDF bos paragraflari sifir genislikli bosluk (U+200B) ile doldurur;
  // duz metinde gorunmemeli. Kaynakta gorunmez karakter tutmamak icin kod uretilir.
  const sifirGenislik = String.fromCharCode(0x200b);
  return lines.join("\n").split(sifirGenislik).join("").trimEnd();
}
