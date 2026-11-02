/**
 * PDF BİRLEŞTİR + TIKLANABİLİR İÇİNDEKİLER — saf mantık (arayüzden bağımsız, test edilebilir).
 *
 *  • PDF'leri verilen sırayla tek dosyada birleştirir (sayfa boyutları korunur)
 *  • En başa A4 dikey içindekiler sayfası ekler; taşarsa sonraki sayfaya devam eder
 *  • Her satır, bölümün ilk sayfasına giden DAHİLİ bağlantıdır
 *  • Her bölüm için PDF yer imi (outline) ekler
 *  • İsteğe bağlı: tüm sayfalara «Sayfa N / T» alt bilgisi, bölüm başlarına «İçindekilere dön»
 *
 * Her şey cihazda yapılır; dosyalar sunucuya gitmez.
 */
import {
  PDFArray,
  PDFDict,
  PDFString,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export class TocFileError extends Error {
  constructor(
    public readonly index: number,
    public readonly kind: "encrypted" | "broken",
  ) {
    super(`${kind}:${index}`);
    this.name = "TocFileError";
  }
}

/** Dosya adından varsayılan bölüm başlığı: uzantısız, "_" ve "-" boşluk. */
export function defaultTitle(fileName: string): string {
  return (
    fileName
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Belge"
  );
}

/** Dosyayı doğrular; şifreli/bozuksa fırlatır. Sayfa sayısını döndürür. */
export async function inspectPdf(bytes: Uint8Array, index = 0): Promise<{ pageCount: number }> {
  try {
    const d = await PDFDocument.load(bytes, { updateMetadata: false });
    return { pageCount: d.getPageCount() };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    throw new TocFileError(index, /encrypt/i.test(msg) ? "encrypted" : "broken");
  }
}

/** Bölümün altında görünecek alt başlık. `page`: dosya içindeki sayfa (1 tabanlı). */
export type TocSub = { title: string; page: number };
export type TocFile = { name: string; title: string; bytes: Uint8Array; subs?: TocSub[] };
export const MAX_SUBS = 60;
const SUB_PT = 10;
const SUB_LINE = 14;
const SUB_GAP = 4;
const SUB_INDENT = 20;

export type TocOptions = {
  heading: string;
  /** "(devam)" gibi: ikinci ve sonraki içindekiler sayfalarının başlığına eklenir. */
  continued: string;
  numbering: boolean;
  pageFooter: boolean;
  /** Alt bilgi metni: «Sayfa» → «Sayfa 3 / 42». */
  pageWord: string;
  backLinks: boolean;
  backLabel: string;
  fontBytes: Uint8Array;
  boldBytes: Uint8Array;
};

export type TocSection = { title: string; startPage: number; pageCount: number };
export type TocResult = { bytes: Uint8Array; tocPages: number; sections: TocSection[] };

// ─── Yerleşim ───────────────────────────────────────────────────────────────

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN_X = 56;
const TOP = 64;
const BOTTOM = 56;
const ENTRY_PT = 11;
const LINE_H = 15;
const ENTRY_GAP = 7;
const HEAD_PT = 22;
const HEAD_PT_CONT = 14;
const HEAD_BLOCK = 46;
const HEAD_BLOCK_CONT = 34;
const MAX_LINES = 2;


/** Başlığı en çok iki satıra böler; sığmazsa son satırı «…» ile keser. */
export function wrapTitle(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxW;
  const hardCut = (s: string) => {
    // Tek kelime satıra sığmıyorsa karakter karakter kes
    let out = "";
    for (const ch of s) {
      if (!fits(out + ch + "…")) break;
      out += ch;
    }
    return out + "…";
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = cur ? `${cur} ${w}` : w;
    if (fits(next)) {
      cur = next;
      continue;
    }
    if (cur) {
      lines.push(cur);
      cur = "";
      if (lines.length === MAX_LINES) break;
    }
    if (fits(w)) cur = w;
    else {
      lines.push(hardCut(w));
      if (lines.length === MAX_LINES) break;
    }
    if (lines.length === MAX_LINES) break;
  }
  if (lines.length < MAX_LINES && cur) lines.push(cur);
  // Sığmayan kısım kaldıysa son satıra «…» koy
  const used = lines.join(" ").replace(/…$/, "");
  const gerek = words.join(" ");
  if (lines.length && used.length < gerek.length && !lines[lines.length - 1]!.endsWith("…")) {
    let son = lines[lines.length - 1]!;
    while (son.length > 1 && !fits(son + "…")) son = son.slice(0, -1);
    lines[lines.length - 1] = son.trimEnd() + "…";
  }
  return lines.length ? lines : [""];
}

/** Hangi girdi hangi içindekiler sayfasına düşer. */
export function paginate(heights: number[]): number[] {
  const pageOf: number[] = [];
  let page = 0;
  let y = TOP + HEAD_BLOCK;
  const limit = A4_H - BOTTOM;
  for (const h of heights) {
    if (y + h > limit) {
      page++;
      y = TOP + HEAD_BLOCK_CONT;
    }
    pageOf.push(page);
    y += h;
  }
  return pageOf;
}

// ─── Ana işlev ──────────────────────────────────────────────────────────────

function safeText(s: string, font: PDFFont): string {
  const set = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0)!;
    out += set.has(cp) ? ch : "?";
  }
  return out;
}

export async function mergeWithToc(files: TocFile[], o: TocOptions): Promise<TocResult> {
  if (files.length < 1) throw new Error("no files");

  // 1) Kaynakları yükle (şifreli/bozuk hangisi belli olsun)
  const srcs: PDFDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      srcs.push(await PDFDocument.load(files[i]!.bytes, { updateMetadata: false }));
    } catch (e) {
      throw new TocFileError(i, /encrypt/i.test(String((e as Error)?.message)) ? "encrypted" : "broken");
    }
  }

  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const font = await out.embedFont(o.fontBytes, { subset: true });
  const bold = await out.embedFont(o.boldBytes, { subset: true });

  // 2) Girdiler: her bölüm + (varsa) alt başlıkları. Sayfa sayısı yazı ölçüsüne bağlıdır.
  type Item = { file: number; sub: number | null; lines: string[]; height: number; size: number; lineH: number; indent: number };
  const numColW = font.widthOfTextAtSize("999", ENTRY_PT);
  const labelW = A4_W - MARGIN_X * 2 - numColW - 10;
  const cleanSubs: TocSub[][] = files.map((f, i) =>
    (f.subs ?? [])
      .filter((s) => s.title.trim() && s.page >= 1 && s.page <= srcs[i]!.getPageCount())
      .sort((a, b) => a.page - b.page)
      .slice(0, MAX_SUBS),
  );
  const items: Item[] = [];
  files.forEach((f, i) => {
    const prefix = o.numbering ? `${i + 1}. ` : "";
    const lines = wrapTitle(prefix + safeText(f.title || defaultTitle(f.name), font), font, ENTRY_PT, labelW);
    items.push({ file: i, sub: null, lines, height: lines.length * LINE_H + ENTRY_GAP, size: ENTRY_PT, lineH: LINE_H, indent: 0 });
    cleanSubs[i]!.forEach((s, k) => {
      const pre = o.numbering ? `${i + 1}.${k + 1} ` : "– ";
      const sl = wrapTitle(pre + safeText(s.title, font), font, SUB_PT, labelW - SUB_INDENT);
      items.push({ file: i, sub: k, lines: sl, height: sl.length * SUB_LINE + SUB_GAP, size: SUB_PT, lineH: SUB_LINE, indent: SUB_INDENT });
    });
  });
  const pageOf = paginate(items.map((l) => l.height));
  const tocPages = (pageOf.length ? pageOf[pageOf.length - 1]! : 0) + 1;

  // 3) Bölüm başlangıç sayfaları
  const sections: TocSection[] = [];
  let cursor = tocPages + 1;
  srcs.forEach((s, i) => {
    sections.push({ title: files[i]!.title || defaultTitle(files[i]!.name), startPage: cursor, pageCount: s.getPageCount() });
    cursor += s.getPageCount();
  });
  const totalPages = cursor - 1;

  // 4) Sayfaları ekle: önce içindekiler, sonra kaynaklar
  const tocPageObjs: PDFPage[] = [];
  for (let i = 0; i < tocPages; i++) tocPageObjs.push(out.addPage([A4_W, A4_H]));
  const filePages: PDFPage[][] = [];
  const sectionFirstPage: PDFPage[] = [];
  for (const s of srcs) {
    const copied = await out.copyPages(s, s.getPageIndices());
    copied.forEach((p, k) => {
      out.addPage(p);
      if (k === 0) sectionFirstPage.push(p);
    });
    filePages.push(copied);
  }

  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.45, 0.47, 0.52);
  const accent = rgb(0.1, 0.35, 0.75);

  // 5) İçindekiler çizimi + dahili bağlantılar
  const ys: number[] = new Array(tocPages).fill(0).map((_, p) => A4_H - TOP - (p === 0 ? HEAD_BLOCK : HEAD_BLOCK_CONT));
  tocPageObjs.forEach((pg, p) => {
    const text = p === 0 ? o.heading : `${o.heading} ${o.continued}`;
    pg.drawText(safeText(text, bold), {
      x: MARGIN_X,
      y: A4_H - TOP - (p === 0 ? HEAD_PT : HEAD_PT_CONT) + 4,
      size: p === 0 ? HEAD_PT : HEAD_PT_CONT,
      font: bold,
      color: ink,
    });
    pg.drawLine({
      start: { x: MARGIN_X, y: A4_H - TOP - (p === 0 ? HEAD_PT : HEAD_PT_CONT) - 6 },
      end: { x: A4_W - MARGIN_X, y: A4_H - TOP - (p === 0 ? HEAD_PT : HEAD_PT_CONT) - 6 },
      thickness: 0.8,
      color: muted,
    });
  });

  const linkTo = (page: PDFPage, rect: [number, number, number, number], target: PDFPage) => {
    const { height } = target.getSize();
    const annot = out.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      Dest: [target.ref, "XYZ", 0, height, null],
    });
    const ref = out.context.register(annot);
    const mevcut = page.node.lookup(PDFName.of("Annots"));
    if (mevcut instanceof PDFArray) mevcut.push(ref);
    else page.node.set(PDFName.of("Annots"), out.context.obj([ref]));
  };

  items.forEach((it, n) => {
    const p = pageOf[n]!;
    const pg = tocPageObjs[p]!;
    const yTop = ys[p]!;
    const isSub = it.sub !== null;
    const startPage = isSub
      ? sections[it.file]!.startPage + cleanSubs[it.file]![it.sub!]!.page - 1
      : sections[it.file]!.startPage;
    const target = isSub ? filePages[it.file]![cleanSubs[it.file]![it.sub!]!.page - 1]! : sectionFirstPage[it.file]!;
    const numStr = String(startPage);
    const numWidth = font.widthOfTextAtSize(numStr, it.size);
    const xNum = A4_W - MARGIN_X - numWidth;
    const x0 = MARGIN_X + it.indent;

    it.lines.forEach((ln, k) => {
      pg.drawText(ln, { x: x0, y: yTop - (k + 1) * it.lineH + 4, size: it.size, font, color: isSub ? muted : ink });
    });
    // Noktalı çizgi: son satırın bitişi ile sayfa numarası arasını doldurur
    const lastY = yTop - it.lines.length * it.lineH + 4;
    const lastW = font.widthOfTextAtSize(it.lines[it.lines.length - 1]!, it.size);
    const dotW = font.widthOfTextAtSize(". ", it.size);
    const gap = xNum - 8 - (x0 + lastW + 6);
    if (gap > dotW * 2) {
      const cnt = Math.floor(gap / dotW);
      const dots = ". ".repeat(cnt).trimEnd();
      pg.drawText(dots, { x: xNum - 6 - font.widthOfTextAtSize(dots, it.size), y: lastY, size: it.size, font, color: muted });
    }
    pg.drawText(numStr, { x: xNum, y: lastY, size: it.size, font: isSub ? font : bold, color: accent });

    linkTo(pg, [x0 - 2, yTop - it.lines.length * it.lineH - 1, A4_W - MARGIN_X + 2, yTop + 2], target);
    ys[p] = yTop - it.height;
  });

  // 6) Yer imleri (outline): bölümler, altlarında alt başlıklar
  const outlineRef = out.context.nextRef();
  const itemRefs = sections.map(() => out.context.nextRef());
  const subRefs = cleanSubs.map((l) => l.map(() => out.context.nextRef()));
  const dest = (pg: PDFPage) => [pg.ref, "XYZ", 0, pg.getSize().height, null];
  sections.forEach((s, i) => {
    const dict: Record<string, unknown> = {
      Title: PDFHexString.fromText(s.title),
      Parent: outlineRef,
      Dest: dest(sectionFirstPage[i]!),
    };
    if (i > 0) dict.Prev = itemRefs[i - 1];
    if (i < sections.length - 1) dict.Next = itemRefs[i + 1];
    const kids = subRefs[i]!;
    if (kids.length) {
      dict.First = kids[0];
      dict.Last = kids[kids.length - 1];
      dict.Count = kids.length;
    }
    out.context.assign(itemRefs[i]!, out.context.obj(dict as never));
    cleanSubs[i]!.forEach((sb, k) => {
      const d: Record<string, unknown> = {
        Title: PDFHexString.fromText(sb.title),
        Parent: itemRefs[i],
        Dest: dest(filePages[i]![sb.page - 1]!),
      };
      if (k > 0) d.Prev = kids[k - 1];
      if (k < kids.length - 1) d.Next = kids[k + 1];
      out.context.assign(kids[k]!, out.context.obj(d as never));
    });
  });
  out.context.assign(
    outlineRef,
    out.context.obj({
      Type: "Outlines",
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: sections.length + cleanSubs.reduce((n, l) => n + l.length, 0),
    } as never),
  );
  out.catalog.set(PDFName.of("Outlines"), outlineRef as PDFRef);
  out.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));

  // 7) «İçindekilere dön» bağlantıları (yalnızca dik sayfalarda)
  if (o.backLinks) {
    const label = safeText(o.backLabel, font);
    const lw = font.widthOfTextAtSize(label, 8);
    sectionFirstPage.forEach((pg) => {
      if (pg.getRotation().angle % 360 !== 0) return;
      const { width, height } = pg.getSize();
      const x = width - lw - 24;
      const y = height - 20;
      pg.drawText(label, { x, y, size: 8, font, color: accent });
      linkTo(pg, [x - 3, y - 3, x + lw + 3, y + 10], tocPageObjs[0]!);
    });
  }

  // 8) Sayfa alt bilgisi
  if (o.pageFooter) {
    const pages = out.getPages();
    pages.forEach((pg, i) => {
      const text = `${safeText(o.pageWord, font)} ${i + 1} / ${totalPages}`;
      const tw = font.widthOfTextAtSize(text, 8);
      const { width: W, height: H } = pg.getSize();
      const a = ((pg.getRotation().angle % 360) + 360) % 360;
      const opt = { size: 8, font, color: muted };
      if (a === 90) pg.drawText(text, { ...opt, x: W - 18, y: (H - tw) / 2, rotate: degrees(90) });
      else if (a === 180) pg.drawText(text, { ...opt, x: (W + tw) / 2, y: H - 18, rotate: degrees(180) });
      else if (a === 270) pg.drawText(text, { ...opt, x: 18, y: (H + tw) / 2, rotate: degrees(270) });
      else pg.drawText(text, { ...opt, x: (W - tw) / 2, y: 18 });
    });
  }

  out.setCreator("PDF Platform");
  out.setProducer("PDF Platform");
  return { bytes: await out.save(), tocPages, sections };
}

export const TOC_MAX_FILES = 20;
export const TOC_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const TOC_DEFAULT_OUTPUT = "birlestirilmis_icindekiler.pdf";

/**
 * Kaynak PDF'in kendi (en üst düzey) yer imlerini okur → alt başlık önerisi.
 * Yalnızca doğrudan sayfaya giden yer imleri alınır; adlandırılmış hedefler atlanır.
 */
export async function readOutline(bytes: Uint8Array): Promise<TocSub[]> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = doc.getPages().map((p) => p.ref.tag);
    const root = doc.catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict);
    if (!root) return [];
    const res: TocSub[] = [];
    let ref = root.get(PDFName.of("First"));
    let guard = 0;
    while (ref instanceof PDFRef && guard++ < 500 && res.length < MAX_SUBS) {
      const item = doc.context.lookup(ref, PDFDict);
      const t = item.lookup(PDFName.of("Title"));
      const title =
        t instanceof PDFHexString || t instanceof PDFString ? t.decodeText().trim() : "";
      let dest = item.lookup(PDFName.of("Dest"));
      if (!dest) {
        const a = item.lookupMaybe(PDFName.of("A"), PDFDict);
        dest = a?.lookup(PDFName.of("D"));
      }
      if (title && dest instanceof PDFArray) {
        const pr = dest.get(0);
        const idx = pr instanceof PDFRef ? pages.indexOf(pr.tag) : -1;
        if (idx >= 0) res.push({ title: title.slice(0, 120), page: idx + 1 });
      }
      ref = item.get(PDFName.of("Next"));
    }
    return res;
  } catch {
    return [];
  }
}
