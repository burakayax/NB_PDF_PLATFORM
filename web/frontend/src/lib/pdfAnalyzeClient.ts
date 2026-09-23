/**
 * PDF Düzenle — CİHAZDA çalışan yardımcılar (ağır işler sunucuya gitmesin diye):
 *  - `ocrScannedPagesLocal`: taranmış sayfalarda metin tanıma (Tesseract.js, tur+eng; dil
 *    verisi self-host). Sunucudaki `pdf-analyze?ocr=1` karşılığı — dosya cihazdan çıkmaz,
 *    512 MB sunucuda bellek/zaman aşımı riski yok.
 *  - `fillPageTextColors`: OCR metninin (vektör rengi yok) rengini çizilmiş sayfadan örnekler.
 *
 * Belge ANALİZİ (metin span'leri, renk, kalın/italik) bilinçli olarak SUNUCUDA kalır: PyMuPDF
 * font tanımlayıcısından ve font dosyasından okur; pdf.js bu bilgilerin bir kısmını açığa
 * vermez (karşılaştırmada kalın/italik ve kutu yüksekliği farkları görüldü). Sunucu maliyeti
 * düşük (sayfa başına ~10-70 ms).
 */
import * as pdfjsLib from "pdfjs-dist";
import type { PdfAnalysis, PdfElement } from "../api";

type PdfDoc = pdfjsLib.PDFDocumentProxy;
type PdfPage = pdfjsLib.PDFPageProxy;

const r1 = (v: number) => Math.round(v * 10) / 10;

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
  const { ocrImagesToLines } = await import("./ocr");
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
  const lines = await ocrImagesToLines(canvases, (p) => onProgress?.(p.ratio));
  const pages = analysis.pages.slice();
  targets.forEach((pi, t) => {
    const s = scales[t];
    const texts: PdfElement[] = [];
    let ei = 0;
    lines[t].forEach((ln, li) => {
      // Yazı boyutu = Tesseract satır yüksekliği × 1.031 (bilinen belgelerle kalibre: ort. hata
      // ~0.7 pt). Taban çizgisi = Tesseract'ın kendi taban çizgisi (ort. hata ~0.3 pt).
      const size = Math.max(4, (ln.rowHeight > 0 ? ln.rowHeight * 1.031 : (ln.bbox.y1 - ln.bbox.y0) * 0.85) / s);
      const bl = ln.baseline && ln.baseline.has_baseline !== false ? ln.baseline : null;
      const baselineAt = (xPx: number): number => {
        if (!bl) return ln.bbox.y1 / s;
        const dx = bl.x1 - bl.x0;
        const y = dx !== 0 ? bl.y0 + ((bl.y1 - bl.y0) * (xPx - bl.x0)) / dx : bl.y0;
        return y / s;
      };
      const wordBy = (w: (typeof ln.words)[number]) => (w.by != null ? w.by / s : baselineAt((w.x0 + w.x1) / 2));
      // Satırı GERÇEK boşluklarda (sütun/form hücresi: > 1.2 em; normal kelime arası ≤ ~0.6 em) veya
      // farklı satıra geçişte (iki sütunu birleştiren Tesseract satırı: taban çizgisi > 0.4 em farklı)
      // parçala; kelime sırası korunur.
      const segs: typeof ln.words[] = [];
      for (const w of ln.words) {
        const last = segs[segs.length - 1];
        const prev = last?.[last.length - 1];
        if (last && prev && (w.x0 - prev.x1) / s <= 1.2 * size && Math.abs(wordBy(w) - wordBy(prev)) <= 0.4 * size) last.push(w);
        else segs.push([w]);
      }
      for (const g of segs) {
        const x0 = Math.min(...g.map((w) => w.x0)) / s, x1 = Math.max(...g.map((w) => w.x1)) / s;
        // Sütun/tablo çizgisi Tesseract'ta "—", "|", "(|" gibi tek başına dar bir işarete dönüşür →
        // metin değil, atla (yoksa editörde tıklanabilir sahte bir öğe olur).
        if (g.length === 1 && /^[\s|—–\-_()[\]©®¦!Il1.,:;'"`]+$/.test(g[0].text) && x1 - x0 < 0.8 * size) continue;
        const bys = g.map(wordBy).sort((a, b) => a - b);
        const by = bys[Math.floor(bys.length / 2)];
        // Kutu = kelimelerin gerçek mürekkep sınırı (silgi orijinali tam örtsün), en az font ölçüsü kadar.
        const y0 = Math.min(Math.min(...g.map((w) => w.y0)) / s, by - 0.8 * size);
        const y1 = Math.max(Math.max(...g.map((w) => w.y1)) / s, by + 0.2 * size);
        texts.push({
          id: `t${pi}_${ei++}`, type: "text",
          bbox: [r1(x0), r1(y0), r1(x1), r1(y1)],
          text: g.map((w) => w.text).join(" "), size: r1(size), by: r1(by), font: "sans", bold: false, italic: false, ocr: true,
          line: `${pi}:ocr:${li}`,
        });
      }
    });
    const imgs = pages[pi].elements.filter((e) => e.type === "image").map((e) => ({ ...e, id: `i${pi}_${ei++}` }));
    pages[pi] = { ...pages[pi], elements: [...texts, ...imgs] };
  });
  return { pages };
}
