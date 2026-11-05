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

/** Tek bir sütunun (sol / orta / sağ) yazı görünümü. */
export type ColStyle = { fontSize?: number; color?: string; bold?: boolean };

/** Üst bilgi ya da alt bilginin görünümü — ikisi ayrı ayrı ayarlanır. */
export type PartStyle = {
  /** Sütunlara özel boyut / renk / kalınlık; verilmeyen alan aşağıdaki genel değere düşer. */
  cols?: { left?: ColStyle; center?: ColStyle; right?: ColStyle };
  /** Çizgi rengi (#RRGGBB); verilmezse yazı rengi. */
  ruleColor?: string;
  /** Çizgi kalınlığı (pt). */
  ruleWidth?: number;
  /** Yazı boyutu (pt). 6–24 arasına sıkıştırılır. */
  fontSize?: number;
  /** #RRGGBB */
  color?: string;
  bold?: boolean;
  /** Üst bilgide sayfanın ÜSTünden, alt bilgide ALTtan uzaklık (mm). */
  edgeMm?: number;
  /** Soldan ve sağdan boşluk (mm). */
  sideMm?: number;
  /** Metnin iç tarafına ince çizgi çek. */
  rule?: boolean;
};

/** Hangi sayfalara uygulanacağı. */
export type PageScope = "all" | "odd" | "even" | "range";

/** Bir bölüm: belirli sayfalara yazılacak üst ve alt bilgi metni. */
export type HeaderFooterRule = {
  header: Slot3;
  footer: Slot3;
  pages: PageScope;
  /** pages === "range" iken (1 tabanlı, dahil). */
  from?: number;
  to?: number;
};

export type HeaderFooterOptions = {
  /** Birden çok bölüm: bir sayfa birden çok bölüme uyuyorsa SONDAKİ geçerli olur. */
  rules?: HeaderFooterRule[];
  /** Tek bölümlü kullanım (rules verilmezse bunlar kullanılır). */
  header?: Slot3;
  footer?: Slot3;
  headerStyle?: PartStyle;
  footerStyle?: PartStyle;
  /** Önizleme: verilen belge asıl belgenin bu sayfasıdır (0 tabanlı); kurallar ve numara ona göre hesaplanır. */
  asPageIndex?: number;
  /** Yazı boyutu (pt). 6–24 arasına sıkıştırılır. (Eski tek-ayar alanları; ikisine birden uygulanır.) */
  fontSize?: number;
  /** #RRGGBB */
  color?: string;
  bold?: boolean;
  /** Sayfa kenarından uzaklık (mm) — üstten/alttan ve yandan. */
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

const slotText = (s: Slot3, a: "l" | "c" | "r") => (a === "l" ? s.left : a === "c" ? s.center : s.right);

/** Sayfa (1 tabanlı) bu kapsama giriyor mu? */
export function pageInScope(n: number, total: number, r: Pick<HeaderFooterRule, "pages" | "from" | "to">): boolean {
  switch (r.pages) {
    case "odd": return n % 2 === 1;
    case "even": return n % 2 === 0;
    case "range": {
      const a = Math.max(1, Math.floor(r.from && r.from > 0 ? r.from : 1));
      const b = Math.min(total, Math.floor(r.to && r.to > 0 ? r.to : total));
      return n >= a && n <= b;
    }
    default: return true;
  }
}

/** Bu sayfada geçerli bölüm (sondaki kazanır); yoksa null. */
export function ruleForPage(rules: HeaderFooterRule[], n: number, total: number, skipFirst?: boolean): HeaderFooterRule | null {
  if (skipFirst && n === 1) return null;
  for (let k = rules.length - 1; k >= 0; k--) {
    const r = rules[k]!;
    if (!pageInScope(n, total, r)) continue;
    return slotHasText(r.header) || slotHasText(r.footer) ? r : null;
  }
  return null;
}

export async function addHeaderFooter(input: Uint8Array, opts: HeaderFooterOptions): Promise<HeaderFooterResult> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: false });
  pdf.registerFontkit(fontkit);
  const f = opts.fonts ?? (await loadPdfFonts());

  const pages = pdf.getPages();
  const totalPages = opts.totalPages ?? pages.length;
  const offset = opts.asPageIndex ?? 0;

  // Tek bölümlü eski kullanım: aralık (from–to) bu bölümün kapsamıdır.
  const legacy = !opts.rules;
  const rules: HeaderFooterRule[] = opts.rules ?? [{
    header: opts.header ?? EMPTY_SLOT,
    footer: opts.footer ?? EMPTY_SLOT,
    pages: opts.fromPage || opts.toPage ? "range" : "all",
    from: opts.fromPage,
    to: opts.toPage,
  }];
  if (!rules.some((r) => slotHasText(r.header) || slotHasText(r.footer))) return { bytes: input, stamped: 0, shrunk: 0 };

  // {sayfa} sayacı ilk yazılan sayfadan başlar (kapak atlanırsa 2. sayfa, aralık verilmişse ilk sayfası).
  const legacyRange = legacy ? resolveRange(totalPages, opts.fromPage, opts.toPage, opts.skipFirst) : null;
  if (legacy && !legacyRange) return { bytes: input, stamped: 0, shrunk: 0 };
  const base = legacyRange ? legacyRange[0] - 1 : opts.skipFirst ? 1 : 0;

  const clampSize = (v: number) => Math.min(72, Math.max(4, v));
  const styleOf = (st?: PartStyle) => ({
    size: clampSize(st?.fontSize ?? opts.fontSize ?? 10),
    color: hexToRgb(st?.color ?? opts.color ?? "#555555"),
    bold: st?.bold ?? opts.bold ?? false,
    cols: st?.cols ?? {},
    ruleColor: st?.ruleColor,
    ruleWidth: Math.min(5, Math.max(0.1, st?.ruleWidth ?? 0.4)),
    edge: Math.max(3, Math.min(60, st?.edgeMm ?? opts.marginMm ?? 10)) * MM_TO_PT,
    side: Math.max(3, Math.min(60, st?.sideMm ?? opts.marginMm ?? 10)) * MM_TO_PT,
    rule: st?.rule ?? opts.rule ?? false,
  });
  const hs = styleOf(opts.headerStyle);
  const fs = styleOf(opts.footerStyle);

  const fontCache = new Map<boolean, PDFFont>();
  const fontFor = async (bold: boolean) => {
    let ft = fontCache.get(bold);
    if (!ft) {
      ft = await pdf.embedFont(bold ? f.bold : f.regular, { subset: true });
      fontCache.set(bold, ft);
    }
    return ft;
  };

  const start = Math.floor(opts.startNumber ?? 1);
  const date = formatDateTr(opts.date ?? new Date());
  const file = (opts.fileName ?? "").replace(/\.pdf$/i, "");

  let stamped = 0;
  let shrunk = 0;

  for (let i = 0; i < pages.length; i++) {
    const li = offset + i; // asıl belgedeki 0 tabanlı sıra
    if (legacyRange && (li < legacyRange[0] - 1 || li > legacyRange[1] - 1)) continue;
    const rule = legacy ? rules[0]! : ruleForPage(rules, li + 1, totalPages, opts.skipFirst);
    if (!rule) continue;
    const page = pages[i]!;
    // Okuyucunun gösterdiği alan CropBox'tır (yoksa MediaBox); yazı ona göre konumlanır.
    const mb = page.getCropBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const visW = rot === 90 || rot === 270 ? mb.height : mb.width;
    const visH = rot === 90 || rot === 270 ? mb.width : mb.height;
    const vars = { page: start + (li - base), total: totalPages, date, file };

    /** Görünen (y yukarı) koordinattan sayfa koordinatına. */
    const place = (vx: number, vy: number) => {
      switch (rot) {
        case 90: return { x: mb.x + mb.width - vy, y: mb.y + vx, a: 90 };
        case 180: return { x: mb.x + mb.width - vx, y: mb.y + mb.height - vy, a: 180 };
        case 270: return { x: mb.x + vy, y: mb.y + mb.height - vx, a: 270 };
        default: return { x: mb.x + vx, y: mb.y + vy, a: 0 };
      }
    };

    const drawRow = async (slot: Slot3, top: boolean) => {
      const st = top ? hs : fs;
      const colOf = (align: "l" | "c" | "r") => {
        const c = st.cols[align === "l" ? "left" : align === "c" ? "center" : "right"];
        return {
          size: clampSize(c?.fontSize ?? st.size),
          color: c?.color ? hexToRgb(c.color) : st.color,
          bold: c?.bold ?? st.bold,
        };
      };
      // Satırın yüksekliği en büyük sütuna göre belirlenir (taşma/çakışma olmasın).
      const size = Math.max(
        ...(["l", "c", "r"] as const).map((a) => (slotText(slot, a).trim() ? colOf(a).size : 0)),
        1,
      );
      const baseline = top ? visH - st.edge - size * 0.8 : st.edge;
      const maxW = visW - 2 * st.side;
      const items: { text: string; align: "l" | "c" | "r" }[] = [
        { text: slot.left, align: "l" },
        { text: slot.center, align: "c" },
        { text: slot.right, align: "r" },
      ];
      let drewAny = false;
      for (const it of items) {
        if (!it.text.trim()) continue;
        const cs = colOf(it.align);
        const font = await fontFor(cs.bold);
        const text = cleanFor(font, fillPlaceholders(it.text, vars));
        if (!text.trim()) continue;
        const w = font.widthOfTextAtSize(text, cs.size);
        // Aynı satırdaki dolu parça sayısına göre pay: tek parça tüm genişliği, ikisi yarıyı, üçü üçte biri kullanır; taşarsa küçült.
        const used = items.filter((x) => x.text.trim()).length;
        const room = used <= 1 ? maxW : used === 2 ? maxW * 0.46 : maxW / 3;
        let sz = cs.size;
        if (w > room) {
          sz = Math.max(4, (cs.size * room) / w);
          shrunk++;
        }
        const ww = font.widthOfTextAtSize(text, sz);
        const vx = it.align === "l" ? st.side : it.align === "r" ? visW - st.side - ww : (visW - ww) / 2;
        const p = place(vx, baseline);
        page.drawText(text, { x: p.x, y: p.y, size: sz, font, color: cs.color, rotate: degrees(p.a) });
        drewAny = true;
      }
      if (drewAny && st.rule) {
        const ry = top ? baseline - size * 0.45 : baseline + size * 1.15;
        const p1 = place(st.side, ry);
        const p2 = place(visW - st.side, ry);
        page.drawLine({ start: { x: p1.x, y: p1.y }, end: { x: p2.x, y: p2.y }, thickness: st.ruleWidth, color: st.ruleColor ? hexToRgb(st.ruleColor) : st.color });
      }
      return drewAny;
    };

    const a = slotHasText(rule.header) ? await drawRow(rule.header, true) : false;
    const b = slotHasText(rule.footer) ? await drawRow(rule.footer, false) : false;
    if (a || b) stamped++;
  }

  const bytes = await pdf.save(PDF_SAVE_OPTIONS);
  return { bytes, stamped, shrunk };
}

export function headerFooterOutputName(name: string): string {
  const base = name.replace(/\.pdf$/i, "").trim() || "belge";
  return `${base}_ustbilgi.pdf`;
}
