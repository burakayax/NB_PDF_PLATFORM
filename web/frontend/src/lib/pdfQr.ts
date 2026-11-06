/**
 * PDF'YE QR KOD EKLE — saf mantık (arayüzden bağımsız, test edilebilir).
 *
 *  • QR içeriğini türe göre kurar (link, vCard, telefon, e-posta, WhatsApp, Wi-Fi, metin)
 *  • QR matrisini üretir (qrcode kütüphanesi) → SVG ve PDF'ye VEKTÖR çizim
 *  • pdf-lib ile seçilen sayfalara yerleştirir; orijinal sayfa içeriğine dokunmaz
 *
 * Her şey cihazda yapılır; dosya sunucuya gitmez.
 */
import QRCode from "qrcode";
import { PDFArray, PDFDocument, PDFName, PDFString, fill, popGraphicsState, pushGraphicsState, rectangle, rgb, setFillingRgbColor } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type QrKind = "url" | "vcard" | "phone" | "email" | "whatsapp" | "wifi" | "text";
export type QrEcl = "L" | "M" | "Q" | "H";

export type QrFields = {
  url: string;
  // vCard
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  // E-posta
  mailSubject: string;
  mailBody: string;
  // WhatsApp
  waText: string;
  // Wi-Fi
  ssid: string;
  wifiPassword: string;
  wifiType: "WPA" | "WEP" | "nopass";
  wifiHidden: boolean;
  // Düz metin
  text: string;
};

export const BOS_ALANLAR: QrFields = {
  url: "", firstName: "", lastName: "", org: "", title: "", phone: "", email: "",
  website: "", address: "", mailSubject: "", mailBody: "", waText: "",
  ssid: "", wifiPassword: "", wifiType: "WPA", wifiHidden: false, text: "",
};

/** Adresin başına https:// ekler; geçerli bir adres değilse null döner. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol)) return null;
    // "abc" gibi noktasız yazımlar (localhost hariç) geçerli bir alan adı değildir.
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Telefonu rakamlara indirger. 05xx → 905xx, 5xx → 905xx, 90… korunur, +… korunur. */
export function normalizeTrPhone(raw: string): string {
  const hasPlus = raw.trim().startsWith("+");
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (hasPlus) return d;
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && d.startsWith("5")) return `90${d}`;
  if (d.startsWith("90") && d.length === 12) return d;
  return d;
}

function vcardKac(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function buildVCard(f: QrFields): string {
  const ad = f.firstName.trim();
  const soyad = f.lastName.trim();
  const satirlar = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vcardKac(soyad)};${vcardKac(ad)};;;`,
    `FN:${vcardKac(`${ad} ${soyad}`.trim())}`,
  ];
  if (f.org.trim()) satirlar.push(`ORG:${vcardKac(f.org.trim())}`);
  if (f.title.trim()) satirlar.push(`TITLE:${vcardKac(f.title.trim())}`);
  if (f.phone.trim()) satirlar.push(`TEL;TYPE=CELL:${f.phone.trim().replace(/[^\d+]/g, "")}`);
  if (f.email.trim()) satirlar.push(`EMAIL:${f.email.trim()}`);
  const site = f.website.trim() ? normalizeUrl(f.website) ?? f.website.trim() : "";
  if (site) satirlar.push(`URL:${site}`);
  if (f.address.trim()) satirlar.push(`ADR;TYPE=WORK:;;${vcardKac(f.address.trim())};;;;`);
  satirlar.push("END:VCARD");
  return satirlar.join("\r\n");
}

function wifiKac(s: string): string {
  return s.replace(/([\\;,:"])/g, "\\$1");
}

export type PayloadResult = { ok: true; text: string; link: string | null } | { ok: false; error: "empty" | "invalid" };

/** QR'a yazılacak metni kurar. `link` doluysa PDF'teki QR ayrıca tıklanabilir olur. */
export function buildPayload(kind: QrKind, f: QrFields): PayloadResult {
  switch (kind) {
    case "url": {
      if (!f.url.trim()) return { ok: false, error: "empty" };
      const u = normalizeUrl(f.url);
      return u ? { ok: true, text: u, link: u } : { ok: false, error: "invalid" };
    }
    case "vcard": {
      if (!f.firstName.trim() && !f.lastName.trim() && !f.org.trim()) return { ok: false, error: "empty" };
      return { ok: true, text: buildVCard(f), link: null };
    }
    case "phone": {
      const p = f.phone.trim().replace(/[^\d+]/g, "");
      if (!p) return { ok: false, error: "empty" };
      return { ok: true, text: `tel:${p}`, link: `tel:${p}` };
    }
    case "email": {
      const e = f.email.trim();
      if (!e) return { ok: false, error: "empty" };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: "invalid" };
      const q: string[] = [];
      if (f.mailSubject.trim()) q.push(`subject=${encodeURIComponent(f.mailSubject.trim())}`);
      if (f.mailBody.trim()) q.push(`body=${encodeURIComponent(f.mailBody.trim())}`);
      const t = `mailto:${e}${q.length ? `?${q.join("&")}` : ""}`;
      return { ok: true, text: t, link: t };
    }
    case "whatsapp": {
      const n = normalizeTrPhone(f.phone);
      if (!n) return { ok: false, error: "empty" };
      if (n.length < 8 || n.length > 15) return { ok: false, error: "invalid" };
      const q = f.waText.trim() ? `&text=${encodeURIComponent(f.waText.trim())}` : "";
      // QR: telefon kamerası WhatsApp uygulamasını doğrudan açsın (https://wa.me tarayıcıya gönderiyordu).
      // PDF'teki tıklanabilir bağlantı: bilgisayar/PDF okuyucular özel adresleri açamaz, bu yüzden https kalır.
      return { ok: true, text: `whatsapp://send?phone=${n}${q}`, link: `https://wa.me/${n}${q ? `?${q.slice(1)}` : ""}` };
    }
    case "wifi": {
      if (!f.ssid.trim()) return { ok: false, error: "empty" };
      if (f.wifiType !== "nopass" && !f.wifiPassword) return { ok: false, error: "invalid" };
      const t =
        `WIFI:T:${f.wifiType};S:${wifiKac(f.ssid)};` +
        (f.wifiType === "nopass" ? "" : `P:${wifiKac(f.wifiPassword)};`) +
        (f.wifiHidden ? "H:true;" : "") +
        ";";
      return { ok: true, text: t, link: null };
    }
    case "text": {
      if (!f.text.trim()) return { ok: false, error: "empty" };
      return { ok: true, text: f.text, link: null };
    }
  }
}

// ─── QR matrisi ─────────────────────────────────────────────────────────────

export type QrMatrix = { size: number; dark: (r: number, c: number) => boolean };

export function makeMatrix(text: string, ecl: QrEcl): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecl });
  const { size, data } = qr.modules;
  return { size, dark: (r, c) => data[r * size + c] === 1 };
}

/** Yatayda birleştirilmiş koyu şeritler — hem SVG hem PDF çizimi bunu kullanır. */
function runs(m: QrMatrix): Array<{ r: number; c: number; len: number }> {
  const out: Array<{ r: number; c: number; len: number }> = [];
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (m.dark(r, c)) {
        let len = 1;
        while (c + len < m.size && m.dark(r, c + len)) len++;
        out.push({ r, c, len });
        c += len;
      } else c++;
    }
  }
  return out;
}

export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG kontrast oranı (1–21). QR için 4'ün altı güvenilir okunmaz; koyu-üstü-açık olmalı. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(hexToRgb01(fg));
  const b = luminance(hexToRgb01(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Ön plan arka plandan AÇIK ise (ters QR) çoğu okuyucu okuyamaz. */
export function isInverted(fg: string, bg: string): boolean {
  return luminance(hexToRgb01(fg)) > luminance(hexToRgb01(bg));
}

export function qrToSvg(
  m: QrMatrix,
  o: { fg: string; bg: string; marginModules: number },
): string {
  const total = m.size + o.marginModules * 2;
  const rects = runs(m)
    .map((s) => `M${s.c + o.marginModules} ${s.r + o.marginModules}h${s.len}v1h-${s.len}z`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${o.bg}"/>` +
    `<path d="${rects}" fill="${o.fg}"/></svg>`
  );
}

// ─── Sayfa seçimi ───────────────────────────────────────────────────────────

export type PageSelection =
  | { mode: "first" }
  | { mode: "last" }
  | { mode: "all" }
  | { mode: "custom"; text: string };

/** "1,3,5-7" → [0,2,4,5,6] (0 tabanlı, tekrarsız, sıralı). Geçersizse null. */
export function parsePageList(text: string, pageCount: number): number[] | null {
  const set = new Set<number>();
  for (const parca of text.split(",")) {
    const p = parca.trim();
    if (!p) continue;
    const r = /^(\d+)\s*-\s*(\d+)$/.exec(p);
    if (r) {
      const a = Number(r[1]);
      const b = Number(r[2]);
      if (a < 1 || b < a || b > pageCount) return null;
      for (let i = a; i <= b; i++) set.add(i - 1);
    } else if (/^\d+$/.test(p)) {
      const n = Number(p);
      if (n < 1 || n > pageCount) return null;
      set.add(n - 1);
    } else return null;
  }
  return set.size ? [...set].sort((x, y) => x - y) : null;
}

export function resolvePages(sel: PageSelection, pageCount: number): number[] | null {
  if (pageCount < 1) return null;
  if (sel.mode === "first") return [0];
  if (sel.mode === "last") return [pageCount - 1];
  if (sel.mode === "all") return Array.from({ length: pageCount }, (_, i) => i);
  return parsePageList(sel.text, pageCount);
}

// ─── PDF'ye yerleştirme ─────────────────────────────────────────────────────

export const MM = 72 / 25.4;
export const MIN_SAFE_MM = 15;

/** Tek modülün basılı genişliği bunun altına inerse QR baskıda/ekranda güvenle okunmaz (GS1 perakende alt sınırı 0,396 mm). */
export const MIN_MODUL_MM = 0.33;
/** Logonun QR deseni genişliğine en çok oranı (ölçüldü: 0,25 üstünde yoğun QR bozulur). */
export const MAX_LOGO_RATIO = 0.2;

/** İçerik + dayanıklılık + kenar boşluğu için gereken en küçük QR kenarı (mm, kenar boşluğu dahil). */
export function minSizeMm(texts: string[], ecl: QrEcl, marginModules: number): number {
  let mx = 0;
  for (const t of texts) {
    try {
      mx = Math.max(mx, makeMatrix(t, ecl).size);
    } catch {
      /* çok uzun içerik */
    }
  }
  return mx ? Math.max(10, Math.ceil(MIN_MODUL_MM * (mx + marginModules * 2))) : 10;
}

/** Alt yazıya sığabilecek en çok karakter (yazı 9 pt'tan küçülmesin diye QR genişliğine göre). */
export function captionMaxChars(sizeMm: number): number {
  return Math.max(0, Math.floor((sizeMm * MM) / (9 * 0.52)));
}

export type StampOptions = {
  text: string;
  /** Doluysa QR alanı bu adrese tıklanabilir link olur. */
  link: string | null;
  ecl: QrEcl;
  pages: number[];
  /** QR karesinin kenarı, milimetre (kenar boşluğu DAHİL). */
  sizeMm: number;
  /** Sessiz bölge, modül sayısı olarak (QR standardı en az 4 önerir). */
  marginModules: number;
  fg: string;
  bg: string;
  /** Serbest alana göre konum: 0 = sol/üst kenar, 1 = sağ/alt kenar. */
  fx: number;
  fy: number;
  caption?: string;
  logoBytes?: Uint8Array | null;
  /** Logonun QR genişliğine oranı (kenar boşluğu hariç; ölçüldü: 0,25 üstü yoğun QR'da okunmaz, güvenli üst sınır 0,2). */
  logoRatio?: number;
  fontBytes?: Uint8Array | null;
};

const CAPTION_PT = 9;

export function captionHeightPt(caption: string | undefined): number {
  return caption && caption.trim() ? CAPTION_PT + 6 : 0;
}

export async function stampQr(pdfBytes: Uint8Array, o: StampOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false, updateMetadata: false });
  const useLogo = !!o.logoBytes;
  const matrix = makeMatrix(o.text, useLogo ? "H" : o.ecl);
  const sidePt = o.sizeMm * MM;
  const total = matrix.size + o.marginModules * 2;
  const mod = sidePt / total;
  const cap = o.caption?.trim() ?? "";
  const capH = captionHeightPt(cap);
  const bgC = hexToRgb01(o.bg);
  const fgC = hexToRgb01(o.fg);

  let font: Awaited<ReturnType<PDFDocument["embedFont"]>> | null = null;
  if (cap) {
    if (!o.fontBytes) throw new Error("caption font missing");
    pdf.registerFontkit(fontkit);
    font = await pdf.embedFont(o.fontBytes, { subset: true });
  }
  let logoImg: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  if (o.logoBytes) {
    const b = o.logoBytes;
    const isPng = b[0] === 0x89 && b[1] === 0x50;
    logoImg = isPng ? await pdf.embedPng(b) : await pdf.embedJpg(b);
  }

  const sayfalar = pdf.getPages();
  const seritler = runs(matrix);
  for (const idx of o.pages) {
    const page = sayfalar[idx];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const boxW = sidePt;
    const boxH = sidePt + capH;
    const x = Math.max(0, (W - boxW) * Math.min(1, Math.max(0, o.fx)));
    const yTop = Math.max(0, (H - boxH) * Math.min(1, Math.max(0, o.fy))); // üstten
    const qrBottom = H - yTop - sidePt;
    const capBottom = qrBottom - capH;

    // Tüm şeritler TEK içerik akışında, tek doldurma komutuyla çizilir (küçük dosya, keskin kenar).
    page.pushOperators(
      pushGraphicsState(),
      setFillingRgbColor(bgC[0], bgC[1], bgC[2]),
      rectangle(x, qrBottom, sidePt, sidePt),
      fill(),
      setFillingRgbColor(fgC[0], fgC[1], fgC[2]),
      ...seritler.map((s) =>
        rectangle(
          x + (o.marginModules + s.c) * mod,
          qrBottom + sidePt - (o.marginModules + s.r + 1) * mod,
          s.len * mod,
          mod,
        ),
      ),
      fill(),
      popGraphicsState(),
    );
    if (logoImg) {
      const logoSide = mod * matrix.size * Math.min(o.logoRatio ?? 0.16, MAX_LOGO_RATIO);
      const pad = logoSide * 0.08;
      const cx = x + sidePt / 2;
      const cy = qrBottom + sidePt / 2;
      page.drawRectangle({
        x: cx - logoSide / 2 - pad, y: cy - logoSide / 2 - pad,
        width: logoSide + pad * 2, height: logoSide + pad * 2, color: rgb(...bgC),
      });
      const k = Math.min(logoSide / logoImg.width, logoSide / logoImg.height);
      const w = logoImg.width * k;
      const h = logoImg.height * k;
      page.drawImage(logoImg, { x: cx - w / 2, y: cy - h / 2, width: w, height: h });
    }
    if (font && cap) {
      const size = CAPTION_PT;
      const textW = font.widthOfTextAtSize(cap, size);
      const fit = textW > sidePt ? (size * sidePt) / textW : size;
      const w2 = font.widthOfTextAtSize(cap, fit);
      page.drawText(cap, {
        x: x + (sidePt - w2) / 2,
        y: capBottom + 4,
        size: fit,
        font,
        color: rgb(...fgC),
      });
    }
    if (o.link) {
      const annot = pdf.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [x, qrBottom, x + sidePt, qrBottom + sidePt],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(o.link) },
      });
      const ref = pdf.context.register(annot);
      const mevcut = page.node.lookup(PDFName.of("Annots"));
      if (mevcut instanceof PDFArray) mevcut.push(ref);
      else page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
    }
  }
  return pdf.save();
}

// ─── Toplu QR (sayfa başına farklı kod) ─────────────────────────────────────

export type BatchRule = { pages: number[]; text: string; link: string | null };
export type BatchParse =
  | { ok: true; rules: BatchRule[] }
  | { ok: false; line: number; error: "format" | "pages" | "content" | "empty" };

/**
 * Her satır: «sayfalar | içerik» — ör. «1 | pdfplatform.app» ya da «2,4-6 | Merhaba».
 * `mode` url ise içerik web adresi olarak doğrulanır ve PDF'te tıklanabilir olur.
 */
export function parseBatchLines(text: string, pageCount: number, mode: "url" | "text"): BatchParse {
  const rules: BatchRule[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw) continue;
    const bar = raw.indexOf("|");
    if (bar < 1) return { ok: false, line: i + 1, error: "format" };
    const pages = parsePageList(raw.slice(0, bar), pageCount);
    if (!pages) return { ok: false, line: i + 1, error: "pages" };
    const content = raw.slice(bar + 1).trim();
    if (!content) return { ok: false, line: i + 1, error: "content" };
    if (mode === "url") {
      const u = normalizeUrl(content);
      if (!u) return { ok: false, line: i + 1, error: "content" };
      rules.push({ pages, text: u, link: u });
    } else rules.push({ pages, text: content, link: null });
  }
  return rules.length ? { ok: true, rules } : { ok: false, line: 0, error: "empty" };
}

/** Her kural için ayrı QR üretip ilgili sayfalara koyar. */
export async function stampQrBatch(
  pdfBytes: Uint8Array,
  rules: BatchRule[],
  base: Omit<StampOptions, "text" | "link" | "pages">,
): Promise<Uint8Array> {
  let cur = pdfBytes;
  for (const r of rules) cur = await stampQr(cur, { ...base, text: r.text, link: r.link, pages: r.pages });
  return cur;
}

// ─── Hazır şablonlar ────────────────────────────────────────────────────────

export type QrTemplate = {
  id: "card" | "menu" | "invoice";
  kind: QrKind;
  sizeMm: number;
  fx: number;
  fy: number;
  caption: { tr: string; en: string };
};

export const QR_TEMPLATES: QrTemplate[] = [
  { id: "card", kind: "vcard", sizeMm: 18, fx: 0.96, fy: 0.96, caption: { tr: "", en: "" } },
  { id: "menu", kind: "url", sizeMm: 45, fx: 0.5, fy: 0.92, caption: { tr: "Menü için okutun", en: "Scan for the menu" } },
  { id: "invoice", kind: "url", sizeMm: 22, fx: 0.96, fy: 0.97, caption: { tr: "Detaylar için okutun", en: "Scan for details" } },
];

/** Dosya adı: orijinal-ad_qr.pdf */
export function qrOutputName(original: string): string {
  return `${original.replace(/\.pdf$/i, "")}_qr.pdf`;
}

