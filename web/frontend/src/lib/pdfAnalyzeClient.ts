/**
 * PDF Düzenle — belge analizi CİHAZDA (pdf.js). Eskiden dosya açılır açılmaz sunucuya
 * yüklenip PyMuPDF ile inceleniyordu (`/api/pdf-analyze`); artık metin span'leri +
 * görsel kutuları tarayıcıda çıkarılır → dosya yalnız KAYDET anında sunucuya gider.
 *
 * Çıktı sunucu analiziyle AYNI yapıdadır (PdfAnalysis): koordinatlar sayfa noktası,
 * sol-üst origin (PyMuPDF/fitz uyumlu) → export (edit-text) değişmeden çalışır.
 *
 * Metin RENGİ pdf.js metin içeriğinde yok → sayfa yüksek çözünürlükte çizilip her
 * span'in kutusundan örneklenir (`fillPageTextColors`, sayfa ziyaret edilince tembel).
 */
import * as pdfjsLib from "pdfjs-dist";
import type { PdfAnalysis, PdfElement, PdfFontKey } from "../api";

type PdfDoc = pdfjsLib.PDFDocumentProxy;
type PdfPage = pdfjsLib.PDFPageProxy;
type Matrix = number[];

/** Sunucudaki `_map_font_to_key` ile birebir: PDF font adı → en yakın gömülü font. */
function mapFontToKey(fontName: string): PdfFontKey {
  const f = (fontName || "").toLowerCase();
  if (["mono", "courier", "consol", "menlo", "typewriter"].some((k) => f.includes(k))) return "mono";
  if (f.includes("montserrat")) return "montserrat";
  if (f.includes("lato")) return "lato";
  if (f.includes("oswald")) return "oswald";
  if (f.includes("merriweather")) return "merriweather";
  if (["times", "serif", "georgia", "garamond", "minion", "roman", "cambria", "palatino"].some((k) => f.includes(k))) return "serif";
  return "sans";
}

type FontInfo = { name: string; bold: boolean; italic: boolean; serif: boolean; mono: boolean };

function fontInfo(page: PdfPage, id: string, family: string): FontInfo {
  let name = "";
  let bold = false, italic = false, serif = false, mono = false;
  try {
    if (page.commonObjs.has(id)) {
      const f = page.commonObjs.get(id) as { name?: string; bold?: boolean; black?: boolean; italic?: boolean; isSerifFont?: boolean; isMonospace?: boolean };
      name = String(f?.name ?? "");
      bold = !!(f?.bold || f?.black);
      italic = !!f?.italic;
      serif = !!f?.isSerifFont;
      mono = !!f?.isMonospace;
    }
  } catch { /* font henüz çözülmemiş → yalnız ada göre */ }
  const fl = (name || family).toLowerCase();
  if (/bold|black|heavy|semibold|demi/.test(fl)) bold = true;
  if (/italic|oblique/.test(fl)) italic = true;
  return { name: name || family, bold, italic, serif, mono };
}

type Span = {
  text: string; x0: number; x1: number; by: number; size: number;
  ascent: number; descent: number; fontId: string;
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Aynı taban çizgisinde, yakın duran span'leri satır gruplarına ayırır (sunucudaki
 * blok:satır id'sinin karşılığı → komşu kaydırma/çeviri aynı satırı tanır). Büyük yatay
 * boşluk (sütun/tablo hücresi) yeni satır grubu başlatır. */
function assignLines<T extends { x0: number; x1: number; by: number; size: number }>(pi: number, spans: T[]): string[] {
  const order = spans.map((_, i) => i).sort((a, b) => spans[a].by - spans[b].by || spans[a].x0 - spans[b].x0);
  const lines: { by: number; x1: number; size: number; id: string }[] = [];
  const out: string[] = new Array(spans.length);
  for (const i of order) {
    const s = spans[i];
    let hit: (typeof lines)[number] | undefined;
    for (let k = lines.length - 1; k >= 0; k--) {
      const ln = lines[k];
      if (ln.by < s.by - 2 * s.size) break;
      const tol = 0.35 * Math.min(ln.size, s.size);
      if (Math.abs(ln.by - s.by) <= tol && s.x0 - ln.x1 <= 3 * Math.max(ln.size, s.size) && s.x0 >= ln.x1 - 2) { hit = ln; break; }
    }
    if (!hit) { hit = { by: s.by, x1: s.x1, size: s.size, id: `${pi}:0:${lines.length}` }; lines.push(hit); }
    hit.x1 = Math.max(hit.x1, s.x1);
    out[i] = hit.id;
  }
  return out;
}

async function analyzePage(page: PdfPage, pi: number): Promise<{ width: number; height: number; elements: PdfElement[] }> {
  const vp = page.getViewport({ scale: 1 });
  const Util = pdfjsLib.Util;

  // Operatör listesi: (1) fontları commonObjs'e yükler (kalın/italik/ad), (2) görsel kutuları.
  const opList = await page.getOperatorList({ annotationMode: pdfjsLib.AnnotationMode.DISABLE });
  const tc = await page.getTextContent();

  const spans: Span[] = [];
  let cur: Span | null = null;
  const flush = () => {
    if (cur && cur.text.trim()) { cur.text = cur.text.replace(/\s+$/, ""); spans.push(cur); }
    cur = null;
  };
  for (const raw of tc.items) {
    if (!("str" in raw)) continue;
    const it = raw;
    const tx = Util.transform(vp.transform, it.transform);
    const size = Math.hypot(tx[2], tx[3]);
    // Yalnız yatay (dönmemiş) metin düzenlenebilir; eğik/dikey metin sayfa görüntüsünde kalır.
    const horizontal = size > 0.5 && Math.abs(tx[1]) < 0.01 * size && Math.abs(tx[2]) < 0.01 * size && tx[0] > 0 && tx[3] < 0;
    if (!horizontal) { flush(); continue; }
    const st = tc.styles[it.fontName] as { fontFamily?: string; ascent?: number; descent?: number } | undefined;
    let ascent = Number(st?.ascent), descent = Number(st?.descent);
    if (!(ascent > 0.5 && ascent < 1.3)) ascent = 0.9;
    if (!(descent <= 0 && descent > -0.6)) descent = -0.22;
    // pdf.js ascent çoğu fontta büyük-harf yüksekliğine yakın → aksan/kuyruk (Ü, Ş) kutu
    // dışında kalmasın diye PyMuPDF'in cömert font kutusuna yaklaştır (silgi tamamen örtsün).
    ascent = Math.max(ascent, 0.9);
    descent = Math.min(descent, -0.22);
    const x0 = tx[4], by = tx[5], x1 = x0 + Math.abs(it.width * vp.scale);
    const str = it.str;
    const c = cur as Span | null;
    // Boşluk öğesi: pdf.js büyük yatay boşluğu (sütun/tablo aralığı) ayrı boşluk öğesi olarak
    // verir → geniş boşluk span'i böler; dar boşluk bir sonraki birleştirmede " " olur.
    if (!str.trim()) {
      if (Math.abs(it.width * vp.scale) > 0.6 * size) flush();
      else if (c && !/\s$/.test(c.text)) c.text += " ";
      if (it.hasEOL) flush();
      continue;
    }
    const gap = c ? x0 - c.x1 : 0;
    const joinable = !!c && c.fontId === it.fontName && Math.abs(c.size - size) < 0.1
      && Math.abs(c.by - by) < 0.2 * size && gap > -0.5 * size && gap < 0.6 * size;
    if (joinable && c) {
      const needSpace = gap > 0.2 * size && !/\s$/.test(c.text) && !/^\s/.test(str);
      c.text += (needSpace ? " " : "") + str;
      c.x1 = Math.max(c.x1, x1);
    } else {
      flush();
      if (str.trim()) cur = { text: str, x0, x1, by, size, ascent, descent, fontId: it.fontName };
    }
    if (it.hasEOL) flush();
  }
  flush();

  const lineIds = assignLines(pi, spans);
  const elements: PdfElement[] = [];
  let ei = 0;
  spans.forEach((s, i) => {
    const fam = String((tc.styles[s.fontId] as { fontFamily?: string } | undefined)?.fontFamily ?? "");
    const fi = fontInfo(page, s.fontId, fam);
    let font = mapFontToKey(fi.name);
    if (font === "sans" && fi.mono) font = "mono";
    else if (font === "sans" && fi.serif) font = "serif";
    elements.push({
      id: `t${pi}_${ei++}`, type: "text",
      bbox: [r1(s.x0), r1(s.by - s.ascent * s.size), r1(s.x1), r1(s.by - s.descent * s.size)],
      text: s.text, size: r1(s.size), by: r1(s.by), font, bold: fi.bold, italic: fi.italic,
      line: lineIds[i],
    });
  });

  // Görseller: grafik durumunu (CTM) izleyip her görsel çiziminde birim kareyi dönüştür.
  const OPS = pdfjsLib.OPS;
  const imgOps = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  for (let k = 0; k < opList.fnArray.length; k++) {
    const fn = opList.fnArray[k];
    const args = opList.argsArray[k] as unknown[];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = Util.transform(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm.slice());
      const m = args?.[0];
      if (Array.isArray(m) && m.length === 6) ctm = Util.transform(ctm, m as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (imgOps.has(fn)) {
      const m = Util.transform(vp.transform, ctm);
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => Util.applyTransform([x, y], m));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys));
      const x1 = Math.min(vp.width, Math.max(...xs)), y1 = Math.min(vp.height, Math.max(...ys));
      if (x1 - x0 < 4 || y1 - y0 < 4) continue;
      elements.push({ id: `i${pi}_${ei++}`, type: "image", bbox: [r1(x0), r1(y0), r1(x1), r1(y1)] });
    }
  }

  return { width: r1(vp.width), height: r1(vp.height), elements };
}

/** Tüm sayfaları cihazda analiz eder (sunucu `/api/pdf-analyze` karşılığı, renk hariç). */
export async function analyzePdfLocal(doc: PdfDoc): Promise<PdfAnalysis> {
  const pages: PdfAnalysis["pages"] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    try {
      pages.push(await analyzePage(page, i - 1));
    } catch {
      const vp = page.getViewport({ scale: 1 });
      pages.push({ width: r1(vp.width), height: r1(vp.height), elements: [] });
    }
  }
  return { pages };
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Sayfayı ekran dışında yüksek çözünürlükte çizer (renk örnekleme / OCR için). */
async function renderPage(page: PdfPage, targetScale: number): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const base = page.getViewport({ scale: 1 });
  // Büyük sayfalarda bellek sınırı: ~12 MP.
  const s = Math.min(targetScale, Math.sqrt(12_000_000 / Math.max(1, base.width * base.height)));
  const vp = page.getViewport({ scale: s });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas, scale: s };
}

/**
 * Bir sayfadaki metin öğelerinin rengini çizilmiş sayfadan örnekler: kutu kenarından
 * zemin rengi (en sık), kutu içinde zeminden EN UZAK piksellerin ortalaması = yazı rengi
 * (kenar yumuşatma açık tonlarını dışarıda bırakır). Rengi zaten olanlara dokunmaz.
 */
export async function fillPageTextColors(doc: PdfDoc, pageIndex: number, elements: PdfElement[]): Promise<PdfElement[]> {
  if (!elements.some((e) => e.type === "text" && !e.color)) return elements;
  const page = await doc.getPage(pageIndex + 1);
  const { canvas, scale } = await renderPage(page, 3);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return elements;
  return elements.map((el) => {
    if (el.type !== "text" || el.color) return el;
    const L = Math.max(0, Math.floor(el.bbox[0] * scale)), T = Math.max(0, Math.floor(el.bbox[1] * scale));
    const R = Math.min(canvas.width, Math.ceil(el.bbox[2] * scale)), B = Math.min(canvas.height, Math.ceil(el.bbox[3] * scale));
    const w = R - L, h = B - T;
    if (w < 2 || h < 2) return { ...el, color: "#000000" };
    const d = ctx.getImageData(L, T, w, h).data;
    // Zemin: kutu kenar pikselleri arasında en sık (16'lık kuantize) renk.
    const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
    const addEdge = (x: number, y: number) => {
      const o = (y * w + x) * 4;
      const key = ((d[o] >> 4) << 8) | ((d[o + 1] >> 4) << 4) | (d[o + 2] >> 4);
      const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      c.n++; c.r += d[o]; c.g += d[o + 1]; c.b += d[o + 2];
      counts.set(key, c);
    };
    for (let x = 0; x < w; x++) { addEdge(x, 0); addEdge(x, h - 1); }
    for (let y = 1; y < h - 1; y++) { addEdge(0, y); addEdge(w - 1, y); }
    let bg = { n: 0, r: 255, g: 255, b: 255 };
    for (const c of counts.values()) if (c.n > bg.n) bg = c;
    const br = bg.n ? bg.r / bg.n : 255, bgG = bg.n ? bg.g / bg.n : 255, bb = bg.n ? bg.b / bg.n : 255;
    // Yazı: zeminden uzaklığa göre en uzak %15'lik piksellerin ortalaması.
    const dists: number[] = [];
    for (let o = 0; o < d.length; o += 4) dists.push(Math.abs(d[o] - br) + Math.abs(d[o + 1] - bgG) + Math.abs(d[o + 2] - bb));
    const sorted = dists.slice().sort((a, b) => b - a);
    const cut = sorted[Math.max(0, Math.floor(sorted.length * 0.15) - 1)];
    if (!(sorted[0] > 60)) return { ...el, color: "#000000" }; // kontrast yok → varsayılan
    let n = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < dists.length; i++) {
      if (dists[i] >= Math.max(cut, 60)) { const o = i * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++; }
    }
    if (!n) return { ...el, color: "#000000" };
    r /= n; g /= n; b /= n;
    // Neredeyse siyah → tam siyah (kenar yumuşatma kalıntısı gri tonu vermesin).
    if (r < 48 && g < 48 && b < 48) return { ...el, color: "#000000" };
    return { ...el, color: hex(r, g, b) };
  });
}

/**
 * Taranmış PDF → CİHAZDA OCR (Tesseract.js, tur+eng; dil verisi self-host). Metin
 * katmanı olmayan sayfalardaki kelimeleri satır span'lerine çevirip mevcut analize
 * ekler. Sunucudaki `ocr=1` karşılığı — dosya cihazdan çıkmaz.
 */
export async function ocrScannedPagesLocal(
  doc: PdfDoc,
  analysis: PdfAnalysis,
  onProgress?: (ratio: number) => void,
): Promise<PdfAnalysis> {
  const { ocrImagesToWords } = await import("./ocr");
  const MAX_PAGES = 30;
  const targets = analysis.pages
    .map((p, i) => (p.elements.some((e) => e.type === "text") ? -1 : i))
    .filter((i) => i >= 0)
    .slice(0, MAX_PAGES);
  if (!targets.length) return analysis;
  const canvases: HTMLCanvasElement[] = [];
  const scales: number[] = [];
  for (const pi of targets) {
    const { canvas, scale } = await renderPage(await doc.getPage(pi + 1), 2.5);
    canvases.push(canvas); scales.push(scale);
  }
  const words = await ocrImagesToWords(canvases, (p) => onProgress?.(p.ratio));
  const pages = analysis.pages.slice();
  targets.forEach((pi, t) => {
    const s = scales[t];
    const ws = words[t].map((w) => ({ text: w.text, x0: w.x0 / s, x1: w.x1 / s, y0: w.y0 / s, y1: w.y1 / s }))
      .map((w) => ({ ...w, by: w.y1, size: Math.max(4, w.y1 - w.y0) }));
    const lineIds = assignLines(pi, ws);
    // Aynı satır grubundaki kelimeleri tek span'e birleştir (sunucu OCR çıktısıyla uyumlu).
    const groups = new Map<string, typeof ws>();
    ws.forEach((w, i) => { const g = groups.get(lineIds[i]) ?? []; g.push(w); groups.set(lineIds[i], g); });
    const texts: PdfElement[] = [];
    let ei = 0;
    for (const [lid, g] of groups) {
      g.sort((a, b) => a.x0 - b.x0);
      const med = (arr: number[]) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
      const by = med(g.map((w) => w.y1)); // çoğu kelimede alt kenar = taban çizgisi
      const size = med(g.map((w) => w.size));
      texts.push({
        id: `t${pi}_${ei++}`, type: "text",
        bbox: [r1(Math.min(...g.map((w) => w.x0))), r1(Math.min(...g.map((w) => w.y0))), r1(Math.max(...g.map((w) => w.x1))), r1(Math.max(...g.map((w) => w.y1)))],
        text: g.map((w) => w.text).join(" "), size: r1(size), by: r1(by), font: "sans", bold: false, italic: false, line: lid,
      });
    }
    const imgs = pages[pi].elements.filter((e) => e.type === "image").map((e) => ({ ...e, id: `i${pi}_${ei++}` }));
    pages[pi] = { ...pages[pi], elements: [...texts, ...imgs] };
  });
  return { pages };
}
