/**
 * PDF'e ÜST BİLGİ / ALT BİLGİ ekleme — cihazda (pdf-lib + gömülü Roboto, Türkçe karakterler tam).
 *
 * Her sayfanın üstüne ve/veya altına sol · orta · sağ olmak üzere üç metin yerleştirir.
 * Metinde yer tutucular kullanılabilir: {sayfa} {toplam} {tarih} {dosya} (İngilizce: {page} {total} {date} {file}).
 * Sayfa döndürülmüşse (90/180/270) metin ekranda görünen üst/alta göre konumlanır ve döndürülür.
 * Orijinal içerik değişmez; metin sayfanın üstüne çizilir.
 */
import { PDFDocument, degrees, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadPdfFonts } from "./summaryPdf";
import { PDF_SAVE_OPTIONS } from "./pdfSaveOptions";

export type Slot3 = { left: string; center: string; right: string };

export type HeaderFooterOptions = {
  header: Slot3;
  footer: Slot3;
  /** Yazı boyutu (pt). 6–24 arasına sıkıştırılır. */
  fontSize?: number;
  /** #RRGGBB */
  color?: string;
  bold?: boolean;
  /** Sayfa kenarından uzaklık (mm). */
  marginMm?: number;
  /** Uygulanacak sayfa aralığı (1 tabanlı, dahil). Boşsa tüm sayfalar. */
  fromPage?: number;
  toPage?: number;
  /** İlk sayfaya (kapak) yazma. */
  skipFirst?: boolean;
  /** {sayfa} sayacının ilk değeri (varsayılan 1: ilk işlenen sayfa). */
  startNumber?: number;
  /** Üst bilgi / alt bilginin iç tarafına ince çizgi çek. */
  rule?: boolean;
  /** {dosya} yer tutucusu için ad (uzantısız kullanılır). */
  fileName?: string;
  /** {tarih} için; verilmezse bugün. */
  date?: Date;
  /** {toplam} için gerçek sayfa sayısı (önizlemede tek sayfalık kopya işlenirken gerekir). */
  totalPages?: number;
  /** Testler için: yazı tipi baytları (tarayıcıda boş bırakılır, /fonts/Roboto yüklenir). */
  fonts?: { regular: ArrayBuffer | Uint8Array; bold: ArrayBuffer | Uint8Array };
};

export const MM_TO_PT = 72 / 25.4;

export const EMPTY_SLOT: Slot3 = { left: "", center: "", right: "" };

export const slotHasText = (s: Slot3) => !!(s.left.trim() || s.center.trim() || s.right.trim());

const pad2 = (n: number) => String(n).padStart(2, "0");
export const formatDateTr = (d: Date) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

/** Yer tutucuları doldurur. Bilinmeyen {…} olduğu gibi kalır. */
export function fillPlaceholders(
  text: string,
  v: { page: number; total: number; date: string; file: string },
): string {
  return text.replace(/\{(sayfa|page|toplam|total|tarih|date|dosya|file)\}/gi, (_m, k: string) => {
    switch (k.toLowerCase()) {
      case "sayfa":
      case "page":
        return String(v.page);
      case "toplam":
      case "total":
        return String(v.total);
      case "tarih":
      case "date":
        return v.date;
      default:
        return v.file;
    }
  });
}

/** Sayfa aralığını (1 tabanlı) sayfa sayısına göre düzeltir; geçersizse null. */
export function resolveRange(total: number, from?: number, to?: number, skipFirst?: boolean): [number, number] | null {
  const a = Math.max(1, Math.floor(from && from > 0 ? from : 1));
  const b = Math.min(total, Math.floor(to && to > 0 ? to : total));
  const lo = skipFirst ? Math.max(a, 2) : a;
  return lo > b ? null : [lo, b];
}

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  const n = m ? parseInt(m[1]!, 16) : 0x555555;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Fontta olmayan karakterleri atar/değiştirir; satır sonları boşluk olur. */
function cleanFor(font: PDFFont, s: string): string {
  const set = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff || cp === 0xad) continue;
    out += set.has(cp) ? ch : cp > 0xffff ? "" : "?";
  }
  return out;
}

export type HeaderFooterResult = { bytes: Uint8Array; stamped: number; shrunk: number };

export async function addHeaderFooter(input: Uint8Array, opts: HeaderFooterOptions): Promise<HeaderFooterResult> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: false });
  pdf.registerFontkit(fontkit);
  const f = opts.fonts ?? (await loadPdfFonts());
  const font = await pdf.embedFont(opts.bold ? f.bold : f.regular, { subset: true });

  const pages = pdf.getPages();
  const range = resolveRange(pages.length, opts.fromPage, opts.toPage, opts.skipFirst);
  if (!range) return { bytes: input, stamped: 0, shrunk: 0 };

  const size = Math.min(24, Math.max(6, opts.fontSize ?? 10));
  const color = hexToRgb(opts.color ?? "#555555");
  const margin = Math.max(3, Math.min(40, opts.marginMm ?? 10)) * MM_TO_PT;
  const start = Math.floor(opts.startNumber ?? 1);
  const date = formatDateTr(opts.date ?? new Date());
  const file = (opts.fileName ?? "").replace(/\.pdf$/i, "");
  const totalPages = opts.totalPages ?? pages.length;

  let stamped = 0;
  let shrunk = 0;

  for (let i = range[0] - 1; i <= range[1] - 1; i++) {
    const page = pages[i]!;
    const mb = page.getMediaBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const visW = rot === 90 || rot === 270 ? mb.height : mb.width;
    const visH = rot === 90 || rot === 270 ? mb.width : mb.height;
    const vars = { page: start + (i - (range[0] - 1)), total: totalPages, date, file };

    /** Görünen (y yukarı) koordinattan sayfa koordinatına. */
    const place = (vx: number, vy: number) => {
      switch (rot) {
        case 90: return { x: mb.x + mb.width - vy, y: mb.y + vx, a: 90 };
        case 180: return { x: mb.x + mb.width - vx, y: mb.y + mb.height - vy, a: 180 };
        case 270: return { x: mb.x + vy, y: mb.y + mb.height - vx, a: 270 };
        default: return { x: mb.x + vx, y: mb.y + vy, a: 0 };
      }
    };

    const drawRow = (slot: Slot3, top: boolean) => {
      const baseline = top ? visH - margin - size * 0.8 : margin;
      const maxW = visW - 2 * margin;
      const items: { text: string; align: "l" | "c" | "r" }[] = [
        { text: slot.left, align: "l" },
        { text: slot.center, align: "c" },
        { text: slot.right, align: "r" },
      ];
      let drewAny = false;
      for (const it of items) {
        if (!it.text.trim()) continue;
        const text = cleanFor(font, fillPlaceholders(it.text, vars));
        if (!text.trim()) continue;
        const w = font.widthOfTextAtSize(text, size);
        // Üç parça aynı satırda: her birine en çok genişliğin üçte biri (ortadaki yarım payla) ayrılır; taşarsa küçült.
        const room = maxW / 3;
        let fs = size;
        if (w > room) {
          fs = Math.max(4, (size * room) / w);
          shrunk++;
        }
        const ww = font.widthOfTextAtSize(text, fs);
        const vx = it.align === "l" ? margin : it.align === "r" ? visW - margin - ww : (visW - ww) / 2;
        const p = place(vx, baseline);
        page.drawText(text, { x: p.x, y: p.y, size: fs, font, color, rotate: degrees(p.a) });
        drewAny = true;
      }
      if (drewAny && opts.rule) {
        const ry = top ? baseline - size * 0.45 : baseline + size * 1.15;
        const p1 = place(margin, ry);
        const p2 = place(visW - margin, ry);
        page.drawLine({ start: { x: p1.x, y: p1.y }, end: { x: p2.x, y: p2.y }, thickness: 0.4, color });
      }
      return drewAny;
    };

    const a = slotHasText(opts.header) ? drawRow(opts.header, true) : false;
    const b = slotHasText(opts.footer) ? drawRow(opts.footer, false) : false;
    if (a || b) stamped++;
  }

  const bytes = await pdf.save(PDF_SAVE_OPTIONS);
  return { bytes, stamped, shrunk };
}

export function headerFooterOutputName(name: string): string {
  const base = name.replace(/\.pdf$/i, "").trim() || "belge";
  return `${base}_ustbilgi.pdf`;
}
