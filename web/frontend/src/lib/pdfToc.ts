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
export type TocFile = {
  name: string;
  title: string;
  bytes: Uint8Array;
  subs?: TocSub[];
  /** Doluysa: bu dosyanın ÖNÜNE bir grup başlığı (ör. FATURALAR) konur; sonraki dosyalar bir sonraki başlığa kadar onun altında girintili durur. */
  group?: string;
  /** Grubun altındaki alt başlık (ör. İnternet). Aynı grupta ardışık dosyalar tek alt başlık altında toplanır. */
  subgroup?: string;
};
export const MAX_GROUPS = 20;
const GROUP_PT = 14;
const GROUP_LINE = 19;
const GROUP_TOP = 10;
const GROUP_BOTTOM = 8;
const GROUP_INDENT = 14;
const SG_PT = 12;
const SG_LINE = 16;
const SG_TOP = 6;
const SG_BOTTOM = 4;
const SG_INDENT = 14;
const SEP_PT = 30;
const SEP_LINE = 40;
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
  /** true: her grubun önüne, ortasında grup adı yazan tek sayfalık ayırıcı sayfa konur. */
  separators?: boolean;
};

export type TocSection = { title: string; startPage: number; pageCount: number };
export type TocResult = { bytes: Uint8Array; tocPages: number; sections: TocSection[]; totalPages: number };

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
export function paginate(heights: number[], keepNext: boolean[] = []): number[] {
  const pageOf: number[] = [];
  let page = 0;
  let y = TOP + HEAD_BLOCK;
  const limit = A4_H - BOTTOM;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i]!;
    // Grup başlığı sayfanın en altında tek başına kalmasın: bir sonraki girdiyle birlikte sığmalı
    const need = h + (keepNext[i] ? (heights[i + 1] ?? 0) : 0);
    if (y + need > limit) {
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
  type Item = { file: number; sub: number | null; lines: string[]; height: number; size: number; lineH: number; indent: number; head?: "g" | "s" };
  const numColW = font.widthOfTextAtSize("999", ENTRY_PT);
  const labelW = A4_W - MARGIN_X * 2 - numColW - 10;
  const cleanSubs: TocSub[][] = files.map((f, i) =>
    (f.subs ?? [])
      .filter((s) => s.title.trim() && s.page >= 1 && s.page <= srcs[i]!.getPageCount())
      .sort((a, b) => a.page - b.page)
      .slice(0, MAX_SUBS),
  );
  const items: Item[] = [];
  const sepBefore: (string | null)[] = files.map(() => null);
  const meta: { newGroup?: string; newSub?: string; active: boolean }[] = [];
  let curGroup = "";
  let curSub = "";
  let gruplar = 0;
  files.forEach((f, i) => {
    const m: { newGroup?: string; newSub?: string; active: boolean } = { active: false };
    const gb = (f.group ?? "").trim();
    if (gb && gb !== curGroup && gruplar < MAX_GROUPS) {
      gruplar++;
      curGroup = gb;
      curSub = "";
      m.newGroup = gb;
      if (o.separators) sepBefore[i] = gb;
      const gl = wrapTitle(safeText(gb, bold), bold, GROUP_PT, A4_W - MARGIN_X * 2);
      items.push({ file: i, sub: null, lines: gl, height: GROUP_TOP + gl.length * GROUP_LINE + GROUP_BOTTOM, size: GROUP_PT, lineH: GROUP_LINE, indent: 0, head: "g" });
    }
    m.active = curGroup !== "";
    const sb = m.active ? (f.subgroup ?? "").trim() : "";
    if (sb !== curSub) {
      curSub = sb;
      if (sb) {
        m.newSub = sb;
        const sl = wrapTitle(safeText(sb, bold), bold, SG_PT, A4_W - MARGIN_X * 2 - GROUP_INDENT);
        items.push({ file: i, sub: null, lines: sl, height: SG_TOP + sl.length * SG_LINE + SG_BOTTOM, size: SG_PT, lineH: SG_LINE, indent: GROUP_INDENT, head: "s" });
      }
    }
    meta.push(m);
    const girinti = m.active ? GROUP_INDENT + (curSub ? SG_INDENT : 0) : 0;
    const prefix = o.numbering ? `${i + 1}. ` : "";
    const lines = wrapTitle(prefix + safeText(f.title || defaultTitle(f.name), font), font, ENTRY_PT, labelW - girinti);
    items.push({ file: i, sub: null, lines, height: lines.length * LINE_H + ENTRY_GAP, size: ENTRY_PT, lineH: LINE_H, indent: girinti });
    cleanSubs[i]!.forEach((s, k) => {
      const pre = o.numbering ? `${i + 1}.${k + 1} ` : "– ";
      const sl = wrapTitle(pre + safeText(s.title, font), font, SUB_PT, labelW - SUB_INDENT - girinti);
      items.push({ file: i, sub: k, lines: sl, height: sl.length * SUB_LINE + SUB_GAP, size: SUB_PT, lineH: SUB_LINE, indent: SUB_INDENT + girinti });
    });
  });
  const pageOf = paginate(items.map((l) => l.height), items.map((l) => !!l.head));
  const tocPages = (pageOf.length ? pageOf[pageOf.length - 1]! : 0) + 1;

  // 3) Bölüm başlangıç sayfaları
  const sections: TocSection[] = [];
  let cursor = tocPages + 1;
  srcs.forEach((s, i) => {
    if (sepBefore[i]) cursor++; // ayırıcı sayfa bölümden önce gelir
    sections.push({ title: files[i]!.title || defaultTitle(files[i]!.name), startPage: cursor, pageCount: s.getPageCount() });
    cursor += s.getPageCount();
  });
  const totalPages = cursor - 1;

  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.45, 0.47, 0.52);
  const accent = rgb(0.1, 0.35, 0.75);

  // 4) Sayfaları ekle: önce içindekiler, sonra kaynaklar
  const tocPageObjs: PDFPage[] = [];
  for (let i = 0; i < tocPages; i++) tocPageObjs.push(out.addPage([A4_W, A4_H]));
  const filePages: PDFPage[][] = [];
  const sectionFirstPage: PDFPage[] = [];
  const sepPages: (PDFPage | undefined)[] = [];
  for (let si = 0; si < srcs.length; si++) {
    const s = srcs[si]!;
    if (sepBefore[si]) {
      const sp = out.addPage([A4_W, A4_H]);
      sepPages[si] = sp;
      const ad = wrapTitle(safeText(sepBefore[si]!, bold), bold, SEP_PT, A4_W - MARGIN_X * 2);
      const top = A4_H / 2 + (ad.length * SEP_LINE) / 2;
      ad.forEach((ln, k) => {
        const w = bold.widthOfTextAtSize(ln, SEP_PT);
        sp.drawText(ln, { x: Math.max(MARGIN_X, (A4_W - w) / 2), y: top - (k + 1) * SEP_LINE + 10, size: SEP_PT, font: bold, color: ink });
      });
      const yl = top - ad.length * SEP_LINE - 6;
      sp.drawLine({ start: { x: A4_W / 2 - 60, y: yl }, end: { x: A4_W / 2 + 60, y: yl }, thickness: 1.2, color: accent });
    }
    const copied = await out.copyPages(s, s.getPageIndices());
    copied.forEach((p, k) => {
      out.addPage(p);
      if (k === 0) sectionFirstPage.push(p);
    });
    filePages.push(copied);
  }

  // 5) İçindekiler çizimi + dahili bağlantılar
  const ys: number[] = new Array(tocPages).fill(0).map((_, p) => A4_H - TOP - (p === 0 ? HEAD_BLOCK : HEAD_BLOCK_CONT));
  tocPageObjs.forEach((pg, p) => {
    const text = p === 0 ? o.heading : `${o.heading} ${o.continued}`;
    const headText = safeText(text, bold);
    const headSize = p === 0 ? HEAD_PT : HEAD_PT_CONT;
    pg.drawText(headText, {
      x: Math.max(MARGIN_X, (A4_W - bold.widthOfTextAtSize(headText, headSize)) / 2),
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
    if (it.head === "s") {
      it.lines.forEach((ln, k) => {
        pg.drawText(ln, { x: MARGIN_X + it.indent, y: yTop - SG_TOP - (k + 1) * SG_LINE + 4, size: SG_PT, font: bold, color: ink });
      });
      linkTo(pg, [MARGIN_X + it.indent, yTop - SG_TOP - it.lines.length * SG_LINE, A4_W - MARGIN_X, yTop - SG_TOP + 2], sectionFirstPage[it.file]!);
      ys[p] = yTop - it.height;
      return;
    }
    if (it.head === "g") {
      it.lines.forEach((ln, k) => {
        const w = bold.widthOfTextAtSize(ln, GROUP_PT);
        pg.drawText(ln, { x: Math.max(MARGIN_X, (A4_W - w) / 2), y: yTop - GROUP_TOP - (k + 1) * GROUP_LINE + 4, size: GROUP_PT, font: bold, color: ink });
      });
      const yLine = yTop - GROUP_TOP - it.lines.length * GROUP_LINE - 2;
      pg.drawLine({ start: { x: MARGIN_X, y: yLine }, end: { x: A4_W - MARGIN_X, y: yLine }, thickness: 0.5, color: muted });
      linkTo(pg, [MARGIN_X, yTop - GROUP_TOP - it.lines.length * GROUP_LINE - 2, A4_W - MARGIN_X, yTop - GROUP_TOP + 2], sepPages[it.file] ?? sectionFirstPage[it.file]!);
      ys[p] = yTop - it.height;
      return;
    }
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

  // 6) Yer imleri (outline): [grup başlığı →] bölümler → alt başlıklar
  type ON = { title: string; page: PDFPage; kids: ON[]; ref?: PDFRef };
  const dest = (pg: PDFPage) => [pg.ref, "XYZ", 0, pg.getSize().height, null];
  const tree: ON[] = [];
  let gNode: ON | null = null;
  let sNode: ON | null = null;
  let lastSub = "";
  files.forEach((f, i) => {
    const m = meta[i]!;
    if (m.newGroup) {
      gNode = { title: m.newGroup.slice(0, 120), page: sepPages[i] ?? sectionFirstPage[i]!, kids: [] };
      sNode = null;
      lastSub = "";
      tree.push(gNode);
    }
    const sb = m.active ? (f.subgroup ?? "").trim() : "";
    if (sb && sb !== lastSub && gNode) {
      sNode = { title: sb.slice(0, 120), page: sectionFirstPage[i]!, kids: [] };
      (gNode as ON).kids.push(sNode);
    }
    lastSub = sb;
    const node: ON = {
      title: sections[i]!.title,
      page: sectionFirstPage[i]!,
      kids: cleanSubs[i]!.map((x) => ({ title: x.title, page: filePages[i]![x.page - 1]!, kids: [] })),
    };
    const parent: ON | null = m.active ? (sb && sNode ? (sNode as ON) : (gNode as ON | null)) : null;
    (parent ? parent.kids : tree).push(node);
  });
  const outlineRef = out.context.nextRef();
  const refAta = (n: ON) => { n.ref = out.context.nextRef(); n.kids.forEach(refAta); };
  tree.forEach(refAta);
  const say = (n: ON): number => n.kids.reduce((t, k) => t + 1 + say(k), 0);
  const yaz = (nodes: ON[], parent: PDFRef) => {
    nodes.forEach((n, k) => {
      const d: Record<string, unknown> = { Title: PDFHexString.fromText(n.title), Parent: parent, Dest: dest(n.page) };
      if (k > 0) d.Prev = nodes[k - 1]!.ref;
      if (k < nodes.length - 1) d.Next = nodes[k + 1]!.ref;
      if (n.kids.length) {
        d.First = n.kids[0]!.ref;
        d.Last = n.kids[n.kids.length - 1]!.ref;
        d.Count = say(n);
      }
      out.context.assign(n.ref!, out.context.obj(d as never));
      yaz(n.kids, n.ref!);
    });
  };
  yaz(tree, outlineRef);
  out.context.assign(
    outlineRef,
    out.context.obj({
      Type: "Outlines",
      First: tree[0]!.ref,
      Last: tree[tree.length - 1]!.ref,
      Count: tree.reduce((t, n) => t + 1 + say(n), 0),
    } as never),
  );
  out.catalog.set(PDFName.of("Outlines"), outlineRef as PDFRef);
  out.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));

  // 7) «İçindekilere dön» bağlantıları (yalnızca dik sayfalarda)
  if (o.backLinks) {
    const label = safeText(o.backLabel, font);
    const lw = font.widthOfTextAtSize(label, 8);
    [...sectionFirstPage, ...sepPages.filter((x): x is PDFPage => !!x)].forEach((pg) => {
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
  return { bytes: await out.save(), tocPages, sections, totalPages };
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
