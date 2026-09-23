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
  if (!elements.some((e) => e.type === "text" && (!e.color || ((e.ocr || e.inv) && !e.ink)))) return elements;
  const page = await doc.getPage(pageIndex + 1);
  const { canvas, scale } = await renderPage(page, 3);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return elements;
  const colored = elements.map((el) => (el.type !== "text" || el.color ? el : sampleColor(el)));
  return colored.map((el) => (el.type === "text" && (el.ocr || el.inv) && !el.ink ? refineScanText(el) : el));

  /** Görüntüdeki yazı (OCR / görünmez katman): GERÇEK mürekkep sınırı.
   * OCR kutusu çoğu zaman harf uçlarından dar → silme/boyama kutuya göre yapılınca eski harfin
   * ucu kalıyordu (ölçüldü). Kutu, satır arasındaki BOŞ satıra/sütuna kadar büyütülür (komşu
   * satıra taşmaz). */
  function refineScanText(el: PdfElement): PdfElement {
    const s = scale;
    const W = canvas.width, H = canvas.height;
    const L0 = Math.max(0, Math.floor(el.bbox[0] * s)), T0 = Math.max(0, Math.floor(el.bbox[1] * s));
    const R0 = Math.min(W, Math.ceil(el.bbox[2] * s)), B0 = Math.min(H, Math.ceil(el.bbox[3] * s));
    const em = (el.size ?? 12) * s;
    const pad = Math.ceil(em * 0.6);
    const X0 = Math.max(0, L0 - pad), Y0 = Math.max(0, T0 - pad), X1 = Math.min(W, R0 + pad), Y1 = Math.min(H, B0 + pad);
    const w = X1 - X0, h = Y1 - Y0;
    if (w < 4 || h < 4) return el;
    const d = ctx!.getImageData(X0, Y0, w, h).data;
    // Zemin parlaklığı: bölgedeki parlaklıkların üst çeyreği (kâğıt).
    const lum = new Float32Array(w * h);
    for (let i = 0, o = 0; i < lum.length; i++, o += 4) lum[i] = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
    const sorted = Array.from(lum).sort((a, b) => a - b);
    const paper = sorted[Math.floor(sorted.length * 0.75)];
    const ink = (x: number, y: number) => paper - lum[y * w + x] > 55;
    const minRow = Math.max(2, Math.round((R0 - L0) * 0.004));
    const rowInk = (y: number, a: number, b: number) => { let n = 0; for (let x = a; x < b; x++) if (ink(x, y)) n++; return n; };
    const colInk = (x: number, a: number, b: number) => { let n = 0; for (let y = a; y < b; y++) if (ink(x, y)) n++; return n; };
    let t = T0 - Y0, bt = B0 - Y0, l = L0 - X0, r = R0 - X0;
    const upMax = Math.round(em * 0.45), downMax = Math.round(em * 0.35), sideMax = Math.round(em * 0.6);
    for (let k = 0; k < upMax && t > 0 && rowInk(t - 1, l, r) >= minRow; k++) t--;
    for (let k = 0; k < downMax && bt < h && rowInk(bt, l, r) >= minRow; k++) bt++;
    for (let k = 0; k < sideMax && l > 0 && colInk(l - 1, t, bt) >= 1; k++) l--;
    for (let k = 0; k < sideMax && r < w && colInk(r, t, bt) >= 1; k++) r++;
    const px = 1.5; // kenar yumuşatma payı
    const inkBox: [number, number, number, number] = [
      r1((X0 + l - px) / s), r1((Y0 + t - px) / s), r1((X0 + r + px) / s), r1((Y0 + bt + px) / s),
    ];
    return { ...el, ink: inkBox };
  }

  function sampleColor(el: PdfElement): PdfElement {
    const L = Math.max(0, Math.floor(el.bbox[0] * scale)), T = Math.max(0, Math.floor(el.bbox[1] * scale));
    const R = Math.min(canvas.width, Math.ceil(el.bbox[2] * scale)), B = Math.min(canvas.height, Math.ceil(el.bbox[3] * scale));
    const w = R - L, h = B - T;
    if (w < 2 || h < 2) return { ...el, color: "#000000" };
    const d = ctx!.getImageData(L, T, w, h).data;
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
  }
}

/**
 * Taranmış PDF → CİHAZDA OCR (Tesseract.js, tur+eng; dil verisi self-host). Metin
 * katmanı olmayan sayfalardaki kelimeleri satır span'lerine çevirip mevcut analize
 * ekler. Sunucudaki `ocr=1` karşılığı — dosya cihazdan çıkmaz.
 */
/**
 * Taranmış sayfa: görüntü sayfanın ≥%60'ını kaplıyor ve üzerinde anlamlı GERÇEK (vektör) yazı yok
 * (< 40 harf — tarayıcının eklediği "Sayfa 1" gibi küçük yazılar taramayı gizlemesin) ve
 * cihazda tanınmış OCR metni de yok → yazı tanıma önerilir (görünmez katman varsa da: ölçüleri güvenilmez).
 * (Önceden "belgede HİÇ yazı yoksa" kuralıydı: tek bir sayfa numarası OCR'ı tamamen kapatıyordu.)
 */
export function scannedPageIndexes(analysis: PdfAnalysis): number[] {
  const out: number[] = [];
  analysis.pages.forEach((p, i) => {
    const area = Math.max(1, p.width * p.height);
    let imgArea = 0;
    for (const e of p.elements) {
      if (e.type !== "image") continue;
      const [x0, y0, x1, y1] = e.bbox;
      imgArea = Math.max(imgArea, Math.max(0, x1 - x0) * Math.max(0, y1 - y0)); // en büyük görsel
    }
    const texts = p.elements.filter((e) => e.type === "text");
    // Görünmez katman (başka bir OCR programının) SAYILMAZ: ölçüldü — taban çizgisi ~4 pt aşağıda,
    // boyut ~%8 büyük. Kendi OCR'ımız (boyut ~0.2 pt, konum ~0.1 pt hata) onun yerini alır.
    const hasEditableScanText = texts.some((e) => e.ocr);
    const vectorChars = texts.filter((e) => !e.ocr && !e.inv).reduce((n, e) => n + (e.text ?? "").trim().length, 0);
    if (imgArea / area >= 0.6 && !hasEditableScanText && vectorChars < 40) out.push(i);
  });
  return out;
}

/**
 * Aranabilir taranmış PDF'in GÖRÜNMEZ metin katmanı (Tr 3) çoğu OCR programında KELİME kelime
 * span'lerdir → editörde bir satırı düzenleyen yalnız bir kelimeyi değiştirebiliyordu. Aynı satırdaki
 * yakın (≤ 1.2 em) kelimeleri tek öğede birleştirir; renk görüntüden örneklensin diye boşaltılır
 * (görünmez katmanın rengi anlamsız — hep siyah gelir).
 */
export function mergeInvisibleWords(analysis: PdfAnalysis): PdfAnalysis {
  const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const pages = analysis.pages.map((p) => {
    const inv = p.elements.filter((e) => e.type === "text" && e.inv);
    if (inv.length < 2) {
      return inv.length ? { ...p, elements: p.elements.map((e) => (e.inv ? { ...e, color: undefined } : e)) } : p;
    }
    const byLine = new Map<string, PdfElement[]>();
    for (const e of inv) {
      const k = e.line ?? e.id;
      const g = byLine.get(k) ?? [];
      g.push(e);
      byLine.set(k, g);
    }
    const merged: PdfElement[] = [];
    for (const g of byLine.values()) {
      g.sort((a, b) => a.bbox[0] - b.bbox[0]);
      let cur: PdfElement[] = [];
      const flush = () => {
        if (!cur.length) return;
        const f = cur[0];
        merged.push({
          ...f, color: undefined, ofont: undefined, hs: undefined, cs: undefined, ws: undefined,
          text: cur.map((e) => (e.text ?? "").trim()).filter(Boolean).join(" "),
          bbox: [Math.min(...cur.map((e) => e.bbox[0])), Math.min(...cur.map((e) => e.bbox[1])), Math.max(...cur.map((e) => e.bbox[2])), Math.max(...cur.map((e) => e.bbox[3]))],
          size: r1(med(cur.map((e) => e.size ?? 12))), by: r1(med(cur.map((e) => e.by ?? e.bbox[3]))),
          font: "sans", bold: false, italic: false,
        });
        cur = [];
      };
      for (const e of g) {
        const prev = cur[cur.length - 1];
        const sz = e.size ?? 12;
        if (prev && e.bbox[0] - prev.bbox[2] > 1.2 * sz) flush();
        cur.push(e);
      }
      flush();
    }
    return { ...p, elements: [...p.elements.filter((e) => !(e.type === "text" && e.inv)), ...merged] };
  });
  return { ...analysis, pages };
}

export async function ocrScannedPagesLocal(
  doc: PdfDoc,
  analysis: PdfAnalysis,
  onProgress?: (ratio: number) => void,
): Promise<PdfAnalysis> {
  const { ocrImagesToLines } = await import("./ocr");
  const MAX_PAGES = 30;
  const targets = scannedPageIndexes(analysis).slice(0, MAX_PAGES);
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
          id: `o${pi}_${ei++}`, type: "text",
          bbox: [r1(x0), r1(y0), r1(x1), r1(y1)],
          text: g.map((w) => w.text).join(" "), size: r1(size), by: r1(by), font: "sans", bold: false, italic: false, ocr: true,
          line: `${pi}:ocr:${li}`,
        });
      }
    });
    // Sayfadaki GERÇEK yazılar (ör. tarayıcının eklediği "Sayfa 1") korunur; OCR onları da
    // görüntüde okuduğu için üst üste binen OCR satırları atılır (çift yazı olmasın).
    const keep = pages[pi].elements.filter((e) => e.type === "text" && !e.inv); // görünmez katman yerine OCR
    const overlaps = (a: PdfElement, b: PdfElement) => {
      const w = Math.min(a.bbox[2], b.bbox[2]) - Math.max(a.bbox[0], b.bbox[0]);
      const h = Math.min(a.bbox[3], b.bbox[3]) - Math.max(a.bbox[1], b.bbox[1]);
      return w > 0 && h > 0 && w * h > 0.3 * Math.min((a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]), (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]));
    };
    const fresh = texts.filter((t) => !keep.some((k) => overlaps(t, k)));
    const imgs = pages[pi].elements.filter((e) => e.type === "image");
    pages[pi] = { ...pages[pi], elements: [...keep, ...fresh, ...imgs] };
  });
  return { ...analysis, pages };
}
