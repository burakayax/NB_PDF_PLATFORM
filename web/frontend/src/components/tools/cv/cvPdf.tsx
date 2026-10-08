/**
 * CV → PDF: ekranda gördüğünüz DOM'u gezip pdf-lib ile birebir çizer.
 *
 * Neden yazdırma penceresi (window.print) değil? Her cihazda aynı sonucu vermez ve
 * kullanıcıyı sistem iletişim kutusuna yollar. Burada metin gerçek metin olarak
 * (seçilebilir, aranabilir, başvuru sistemlerinin okuyabileceği biçimde) yazılır;
 * fontlar PDF'e gömülür; her şey cihazda olur.
 *
 * Desteklenen CSS alt kümesi (şablonlar buna uyar): düz arka plan rengi, yuvarlatılmış
 * köşe, kenarlık, metin (renk/boyut/kalın/italik/harf aralığı/büyük harf), <img>.
 */
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PDFDocument, popGraphicsState, pushGraphicsState, rgb, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PDF_SAVE_OPTIONS } from "../../../lib/pdfSaveOptions";
import { buildModel, type CvData, type BuildMode } from "./cvModel";
import { MAX_FIT_STEP, styleFromSettings } from "./cvStyle";
import { CvPage, FONT_CSS, FONT_FILE, PAGE_H, PAGE_W, ensureCvStyles, getTemplate, type FontKey } from "./cvTemplates";

const PAD_TOP = 42;
const PAD_BOTTOM = 40;

/**
 * Bölünmemesi gereken blokları (deneyim kalemi, madde, başlık…) sayfa sınırından
 * sonraya iter. Hem ekran önizlemesi hem PDF aynı fonksiyonu kullanır → sayfa
 * kırılmaları birebir aynı olur. Dönen değer: sayfa sayısı.
 */
export function paginate(root: HTMLElement): number {
  const keeps = Array.from(root.querySelectorAll<HTMLElement>("[data-keep]"));
  for (const el of keeps) if (el.dataset.cvMt0 === undefined) el.dataset.cvMt0 = el.style.marginTop || "";
  for (const el of keeps) el.style.marginTop = el.dataset.cvMt0 ?? "";
  root.style.height = "";

  const scale = root.getBoundingClientRect().width / PAGE_W || 1;
  const rootTop = root.getBoundingClientRect().top;
  for (const el of keeps) {
    const r = el.getBoundingClientRect();
    const top = (r.top - rootTop) / scale;
    const bottom = (r.bottom - rootTop) / scale;
    const h = bottom - top;
    if (h <= 0 || h > PAGE_H - PAD_TOP - PAD_BOTTOM) continue;
    const page = Math.max(0, Math.floor((top + 0.5) / PAGE_H));
    const limit = (page + 1) * PAGE_H - PAD_BOTTOM;
    const need = el.dataset.keep === "head" ? bottom + 64 : bottom;
    if (need > limit + 0.5) {
      const push = (page + 1) * PAGE_H + PAD_TOP - top;
      const cur = parseFloat(getComputedStyle(el).marginTop) || 0;
      el.style.marginTop = `${cur + push}px`;
    }
  }
  const natural = Math.max(root.scrollHeight, root.offsetHeight);
  const pages = Math.max(1, Math.ceil((natural - 2) / PAGE_H));
  root.style.height = `${pages * PAGE_H}px`;
  return pages;
}

// ── Renk / yardımcılar ─────────────────────────────────────────────────────

type Rgba = { r: number; g: number; b: number; a: number };
function parseColor(s: string): Rgba {
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (!m) return { r: 0, g: 0, b: 0, a: 0 };
  const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
  return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p.length > 3 ? p[3] : 1 };
}
const col = (c: Rgba) => rgb(c.r / 255, c.g / 255, c.b / 255);
const PT = 0.75; // 794 css px → 595.28 pt

type Box = { x: number; y: number; w: number; h: number };

function roundedPath(w: number, h: number, r: number): string {
  const R = Math.max(0, Math.min(r, w / 2, h / 2));
  if (R === 0) return `M0,0 H${w} V${h} H0 Z`;
  return `M${R},0 H${w - R} A${R},${R} 0 0 1 ${w},${R} V${h - R} A${R},${R} 0 0 1 ${w - R},${h} H${R} A${R},${R} 0 0 1 0,${h - R} V${R} A${R},${R} 0 0 1 ${R},0 Z`;
}

class Painter {
  pages: PDFPage[] = [];
  fonts = new Map<string, Promise<PDFFont>>();
  images = new Map<string, Promise<PDFImage>>();
  lastFont = new Map<PDFPage, PDFFont>();
  measure?: CanvasRenderingContext2D;
  constructor(public pdf: PDFDocument, public root: HTMLElement) {}

  async font(family: string, bold: boolean): Promise<PDFFont> {
    const key = (Object.keys(FONT_CSS) as FontKey[]).find((k) => family.includes(FONT_CSS[k])) ?? "carlito";
    const suf = bold ? "Bold" : "Regular";
    const id = `${key}-${suf}`;
    let p = this.fonts.get(id);
    if (!p) {
      p = (async () => {
        // PDF için TTF kullanılır (Latin + Türkçe alt kümesi; bkz. public/fonts/cv). WOFF2 doğrudan
        // gömülemez ve fontkit'in alt kümeleyicisi WOFF2 kaynaklı glif verisinde hata veriyor.
        const res = await fetch(`/fonts/cv/${FONT_FILE[key]}-${suf}.ttf`);
        if (!res.ok) throw new Error("font");
        return this.pdf.embedFont(new Uint8Array(await res.arrayBuffer()), { subset: true });
      })();
      this.fonts.set(id, p);
    }
    return p;
  }

  pageAt(yCss: number): { page: PDFPage; offset: number } {
    const i = Math.min(this.pages.length - 1, Math.max(0, Math.floor(yCss / PAGE_H)));
    return { page: this.pages[i], offset: i * PAGE_H };
  }

  /** Kutuyu kapsadığı her sayfaya (kırpılmış) çizer. */
  fillBox(b: Box, c: Rgba, opacity: number, radius: number): void {
    if (c.a <= 0 || b.w <= 0 || b.h <= 0) return;
    const first = Math.max(0, Math.floor(b.y / PAGE_H));
    const last = Math.min(this.pages.length - 1, Math.floor((b.y + b.h - 0.01) / PAGE_H));
    for (let i = first; i <= last; i++) {
      const y0 = Math.max(b.y, i * PAGE_H);
      const y1 = Math.min(b.y + b.h, (i + 1) * PAGE_H);
      const page = this.pages[i];
      const x = b.x * PT, w = b.w * PT, h = (y1 - y0) * PT;
      const yTop = page.getHeight() - (y0 - i * PAGE_H) * PT;
      const clipped = y0 > b.y + 0.01 || y1 < b.y + b.h - 0.01;
      if (radius > 0.5 && !clipped) {
        page.drawSvgPath(roundedPath(w, h, radius * PT), { x, y: yTop, color: col(c), opacity: c.a * opacity });
      } else {
        page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: col(c), opacity: c.a * opacity });
      }
    }
  }

  strokeRounded(b: Box, c: Rgba, width: number, opacity: number, radius: number): void {
    const { page, offset } = this.pageAt(b.y + b.h / 2);
    const w = b.w * PT, h = b.h * PT, bw = width * PT;
    const x = b.x * PT + bw / 2, ww = w - bw, hh = h - bw;
    const yTop = page.getHeight() - (b.y - offset) * PT - bw / 2;
    page.drawSvgPath(roundedPath(ww, hh, radius * PT - bw / 2), { x, y: yTop, borderColor: col(c), borderWidth: bw, borderOpacity: c.a * opacity });
  }

  async drawImage(img: HTMLImageElement, b: Box, opacity: number): Promise<void> {
    const src = img.currentSrc || img.src;
    if (!src.startsWith("data:")) return;
    const comma = src.indexOf(",");
    const isPng = src.slice(5, comma).includes("png");
    let p = this.images.get(src);
    if (!p) {
      const bytes = Uint8Array.from(atob(src.slice(comma + 1)), (ch) => ch.charCodeAt(0));
      p = isPng ? this.pdf.embedPng(bytes) : this.pdf.embedJpg(bytes);
      this.images.set(src, p);
    }
    const emb = await p;
    const { page, offset } = this.pageAt(b.y + b.h / 2);
    page.drawImage(emb, { x: b.x * PT, y: page.getHeight() - (b.y - offset + b.h) * PT, width: b.w * PT, height: b.h * PT, opacity });
  }

  async drawText(node: Text, cs: CSSStyleDeclaration, opacity: number, ox: number, oy: number): Promise<void> {
    const raw = node.data;
    if (!raw.trim()) return;
    const sizeCss = parseFloat(cs.fontSize);
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 600;
    const font = await this.font(cs.fontFamily, bold);
    const color = parseColor(cs.color);
    const upper = cs.textTransform === "uppercase";
    const lang = this.root.getAttribute("lang") || "tr";
    const ls = parseFloat(cs.letterSpacing) || 0;
    const sizePt = sizeCss * PT;
    const range = document.createRange();
    // Tarayıcının kendi yazı ölçüsü: içerik alanının üstünden taban çizgisine uzaklık.
    const mctx = (this.measure ??= document.createElement("canvas").getContext("2d")!);
    mctx.font = `${bold ? 700 : 400} ${sizeCss}px ${cs.fontFamily}`;
    const ascCss = mctx.measureText("Hx").fontBoundingBoxAscent;

    const draw = (text: string, rect: DOMRect, x?: number, tc = 0) => {
      const topCss = rect.top - oy;
      const { page, offset } = this.pageAt(topCss + rect.height / 2);
      const yTop = page.getHeight() - (topCss - offset) * PT;
      const baseline = yTop - ascCss * PT;
      const t = safe(font, upper ? text.toLocaleUpperCase(lang) : text);
      if (!t) return;
      if (this.lastFont.get(page) !== font) {
        page.setFont(font);
        this.lastFont.set(page, font);
      }
      if (tc !== 0) page.pushOperators(pushGraphicsState(), setCharacterSpacing(tc));
      page.drawText(t, { x: (x ?? rect.left - ox) * PT, y: baseline, size: sizePt, color: col(color), opacity: color.a * opacity });
      if (tc !== 0) page.pushOperators(popGraphicsState());
    };

    // Kelimeleri satırlara grupla
    type W = { text: string; rect: DOMRect; broken: boolean };
    const words: W[] = [];
    const re = /\S+/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(raw))) {
      range.setStart(node, mm.index);
      range.setEnd(node, mm.index + mm[0].length);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
      if (!rects.length) continue;
      words.push({ text: mm[0], rect: rects[0], broken: rects.length > 1 });
      if (rects.length > 1) {
        // Uzun sözcük satır sonunda bölünmüş: karakter karakter yerleştir
        const w = words.pop()!;
        for (let i = 0; i < w.text.length; i++) {
          range.setStart(node, mm.index + i);
          range.setEnd(node, mm.index + i + 1);
          const r = range.getClientRects()[0];
          if (r && r.width > 0) draw(w.text[i], r);
        }
      }
    }
    let i = 0;
    while (i < words.length) {
      const line: W[] = [words[i]];
      let j = i + 1;
      while (j < words.length && Math.abs(words[j].rect.top - words[i].rect.top) < sizeCss * 0.45) line.push(words[j++]);
      i = j;
      const text = line.map((w) => w.text).join(" ");
      const space = font.widthOfTextAtSize(" ", sizePt) / PT;
      // Harf aralığı (letter-spacing) PDF'te harf-harf DEĞİL, "karakter aralığı" (Tc) ile yazılır:
      // metin tek dize kalır → başvuru sistemleri "PROFİL"i "P R O F İ L" diye okumaz.
      // Beklenen kelime boşluğu = boşluk genişliği + harf aralığı (CSS boşluğa da ekler).
      let regular = true;
      for (let k = 1; k < line.length; k++) {
        const gap = line[k].rect.left - line[k - 1].rect.right;
        if (Math.abs(gap - (space + ls)) > 1.6) { regular = false; break; }
      }
      if (regular) draw(text, line[0].rect, undefined, ls * PT);
      else for (const w of line) draw(w.text, w.rect, undefined, ls * PT);
    }
  }
}

/** Fontta olmayan karakterleri güvenli biçimde ele. */
function safe(font: PDFFont, t: string): string {
  try {
    font.encodeText(t);
    return t;
  } catch {
    return Array.from(t).map((ch) => { try { font.encodeText(ch); return ch; } catch { return "?"; } }).join("");
  }
}

async function visit(p: Painter, el: Element, parentOpacity: number, ox: number, oy: number): Promise<void> {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  const op = parentOpacity * (parseFloat(cs.opacity) || 1);
  const r = el.getBoundingClientRect();
  const box: Box = { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height };

  const rawRadius = cs.borderTopLeftRadius;
  const radius = rawRadius.endsWith("%") ? (parseFloat(rawRadius) / 100) * Math.min(box.w, box.h) : parseFloat(rawRadius) || 0;

  if (el !== p.root) {
    const bg = parseColor(cs.backgroundColor);
    if (bg.a > 0) p.fillBox(box, bg, op, radius);
    const bt = parseFloat(cs.borderTopWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0;
    const bb = parseFloat(cs.borderBottomWidth) || 0, bl = parseFloat(cs.borderLeftWidth) || 0;
    if (bt || br || bb || bl) {
      const ct = parseColor(cs.borderTopColor), cr = parseColor(cs.borderRightColor), cb = parseColor(cs.borderBottomColor), cl = parseColor(cs.borderLeftColor);
      const uniform = bt === br && br === bb && bb === bl && bt > 0 && cs.borderTopStyle !== "none";
      if (uniform && radius > 0.5) p.strokeRounded(box, ct, bt, op, radius);
      else {
        if (bt && cs.borderTopStyle !== "none") p.fillBox({ x: box.x, y: box.y, w: box.w, h: bt }, ct, op, 0);
        if (bb && cs.borderBottomStyle !== "none") p.fillBox({ x: box.x, y: box.y + box.h - bb, w: box.w, h: bb }, cb, op, 0);
        if (bl && cs.borderLeftStyle !== "none") p.fillBox({ x: box.x, y: box.y, w: bl, h: box.h }, cl, op, 0);
        if (br && cs.borderRightStyle !== "none") p.fillBox({ x: box.x + box.w - br, y: box.y, w: br, h: box.h }, cr, op, 0);
      }
    }
  }
  if (el instanceof HTMLImageElement) {
    await p.drawImage(el, box, op);
    return;
  }
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.ELEMENT_NODE) await visit(p, n as Element, op, ox, oy);
    else if (n.nodeType === Node.TEXT_NODE) await p.drawText(n as Text, cs, op, ox, oy);
  }
}

export async function domToPdf(root: HTMLElement, pages: number, meta: { title: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const painter = new Painter(pdf, root);
  for (let i = 0; i < pages; i++) painter.pages.push(pdf.addPage([595.28, 841.89]));
  const rr = root.getBoundingClientRect();
  await visit(painter, root, 1, rr.left, rr.top);
  try {
    pdf.setTitle(meta.title);
    pdf.setProducer("PDF Platform (pdfplatform.app)");
    pdf.setCreator("PDF Platform (pdfplatform.app)");
  } catch { /* künye yazılamazsa çıktı yine geçerlidir */ }
  return pdf.save(PDF_SAVE_OPTIONS);
}

// ── Ekran dışı üretim ──────────────────────────────────────────────────────

async function waitFor(cond: () => boolean, ms: number): Promise<void> {
  const t0 = performance.now();
  while (!cond() && performance.now() - t0 < ms) await new Promise((r) => setTimeout(r, 40));
}

type Offscreen = { root: HTMLElement; render: (step: number) => void };

/** Ekran dışında CV'yi çizer (yazı tipleri/fotoğraf hazır olana dek bekler) ve `fn`'e verir. */
async function withOffscreen<T>(data: CvData, templateId: string, mode: BuildMode, fn: (o: Offscreen) => Promise<T>): Promise<T> {
  ensureCvStyles();
  const tpl = getTemplate(templateId);
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${PAGE_W}px;pointer-events:none;`;
  document.body.appendChild(host);
  const rootEl = createRoot(host);
  try {
    const model = buildModel(data, mode);
    const render = (step: number) =>
      flushSync(() => rootEl.render(<CvPage m={model} tpl={tpl} size={data.settings.size} accent={data.settings.accent} style={styleFromSettings(data.settings, step)} />));
    render(0);
    await Promise.all(
      (Object.keys(FONT_CSS) as FontKey[]).flatMap((k) => [`400 16px '${FONT_CSS[k]}'`, `700 16px '${FONT_CSS[k]}'`]).map((f) => document.fonts.load(f).catch(() => undefined)),
    );
    await document.fonts.ready;
    const root = host.firstElementChild as HTMLElement;
    if (data.photo && data.showPhoto && mode !== "blank") {
      await waitFor(() => !!root.querySelector("img") && !root.querySelector("[data-cv-photo-ghost]"), 4000);
    }
    await Promise.all(Array.from(root.querySelectorAll("img")).map((i) => i.decode().catch(() => undefined)));
    return await fn({ root, render });
  } finally {
    rootEl.unmount();
    host.remove();
  }
}

/** "Tek sayfaya sığdır": önizlemeyle AYNI kademe tablosu (bkz. cvStyle.FIT_STEPS). */
function fitLoop(o: Offscreen, fitOn: boolean): { pages: number; step: number } {
  let pages = paginate(o.root);
  let step = 0;
  while (fitOn && pages > 1 && step < MAX_FIT_STEP) {
    step += 1;
    o.render(step);
    pages = paginate(o.root);
  }
  return { pages, step };
}

/**
 * Önizleme için: İNDİRİLECEK PDF'in (boş alanlar çıkarılmış hâlinin) hangi sığdırma kademesinde
 * kaç sayfa olacağını ekran dışında ölçer. Taslak görünümde yer tutucular da yer kapladığından
 * taslağı ölçmek PDF'e göre fazla küçültürdü.
 */
export async function measureFit(data: CvData, templateId: string): Promise<{ pages: number; step: number }> {
  return withOffscreen(data, templateId, "export", async (o) => fitLoop(o, data.settings.fitOnePage));
}

export async function buildCvPdf(data: CvData, templateId: string, mode: BuildMode): Promise<{ bytes: Uint8Array; pages: number; fitStep: number }> {
  return withOffscreen(data, templateId, mode, async (o) => {
    const { pages, step } = fitLoop(o, data.settings.fitOnePage);
    const bytes = await domToPdf(o.root, pages, { title: `${data.name.trim() || "CV"} — ${data.settings.lang === "tr" ? "Özgeçmiş" : "Resume"}` });
    return { bytes, pages, fitStep: step };
  });
}
