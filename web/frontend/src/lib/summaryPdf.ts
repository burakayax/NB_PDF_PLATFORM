import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Türkçe destekli gömülü font (Roboto). Bir kez indirilir, önbelleğe alınır.
let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;
async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

/** Altında içerik olmayan başlıkları atar (ekrandaki renderer ile aynı davranış). */
function stripEmptySections(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const isHeading = (s: string) => /^#{1,6}\s+/.test(s.trim());
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isHeading(lines[i])) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j >= lines.length || isHeading(lines[j])) continue;
    }
    kept.push(lines[i]);
  }
  return kept.join("\n");
}

type Run = { t: string; b: boolean };
function toRuns(line: string): Run[] {
  const out: Run[] = [];
  for (const p of line.split(/(\*\*[^*]+\*\*)/g)) {
    if (!p) continue;
    if (p.startsWith("**") && p.endsWith("**")) out.push({ t: p.slice(2, -2), b: true });
    else out.push({ t: p, b: false });
  }
  return out;
}

/**
 * AI özet markdown'ını profesyonel bir PDF'e çevirir (pdf-lib + gömülü Roboto).
 * Başlık/kalın/liste/paragraf + sözcük sarma + sayfa kırma. Türkçe karakter tam.
 */
export async function summaryToPdf(markdown: string, docTitle = "PDF Özeti"): Promise<Uint8Array> {
  const { regular: regBuf, bold: boldBuf } = await loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regBuf, { subset: true });
  const bold = await pdf.embedFont(boldBuf, { subset: true });
  pdf.setTitle(docTitle);

  const PW = 595.28;
  const PH = 841.89;
  const margin = 56;
  const contentW = PW - margin * 2;

  let page: PDFPage = pdf.addPage([PW, PH]);
  let y = PH - margin;
  const ensure = (need: number) => {
    if (y - need < margin) {
      page = pdf.addPage([PW, PH]);
      y = PH - margin;
    }
  };

  const black = rgb(0.12, 0.12, 0.14);
  const purple = rgb(0.45, 0.28, 0.72);

  function drawRuns(
    runs: Run[],
    size: number,
    color = black,
    indent = 0,
    gapAfter = 4,
  ) {
    const lineHeight = size * 1.42;
    const maxW = contentW - indent;
    // Sözcüklere ayır (font bilgisiyle)
    const words: { w: string; f: PDFFont }[] = [];
    for (const r of runs) {
      const f = r.b ? bold : regular;
      for (const w of r.t.split(/(\s+)/)) if (w.length) words.push({ w, f });
    }
    let line: { w: string; f: PDFFont }[] = [];
    let lineW = 0;
    const flush = () => {
      ensure(lineHeight);
      let x = margin + indent;
      for (const it of line) {
        page.drawText(it.w, { x, y: y - size, size, font: it.f, color });
        x += it.f.widthOfTextAtSize(it.w, size);
      }
      y -= lineHeight;
      line = [];
      lineW = 0;
    };
    for (const word of words) {
      const ww = word.f.widthOfTextAtSize(word.w, size);
      if (lineW + ww > maxW && line.length) flush();
      if (line.length === 0 && word.w.trim() === "") continue; // satır başı boşluk atla
      line.push(word);
      lineW += ww;
    }
    if (line.length) flush();
    y -= gapAfter;
  }

  const lines = stripEmptySections(markdown).replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      y -= 4;
      continue;
    }
    if (/^---+$/.test(line)) {
      ensure(12);
      page.drawLine({
        start: { x: margin, y: y - 4 },
        end: { x: PW - margin, y: y - 4 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.88),
      });
      y -= 12;
      continue;
    }
    if (/^#\s+/.test(line)) {
      y -= 2;
      drawRuns(toRuns(line.replace(/^#\s+/, "")), 18, black, 0, 8);
    } else if (/^##\s+/.test(line)) {
      y -= 4;
      drawRuns(toRuns(line.replace(/^##\s+/, "")), 13, purple, 0, 6);
    } else if (/^###\s+/.test(line)) {
      drawRuns(toRuns(line.replace(/^###\s+/, "")), 12, black, 0, 4);
    } else if (/^[-*•]\s+/.test(line)) {
      ensure(16);
      page.drawText("•", { x: margin, y: y - 11, size: 11, font: regular, color: purple });
      drawRuns(toRuns(line.replace(/^[-*•]\s+/, "")), 11, black, 16, 2);
    } else {
      drawRuns(toRuns(line), 11, black, 0, 5);
    }
  }

  return pdf.save();
}

/**
 * Çeviri metnini OKUNUR bir PDF'e döker (orijinal düzeni taklit etmez — düz,
 * temiz, tipografik olarak rahat bir belge üretir). Başlıklı kapak bloğu,
 * paragraf boşlukları, geniş satır aralığı ve sayfa numaraları içerir.
 * Türkçe karakter tam (gömülü Roboto).
 */
export async function translationToPdf(
  text: string,
  opts: { title: string; languageLabel: string },
): Promise<Uint8Array> {
  const { regular: regBuf, bold: boldBuf } = await loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regBuf, { subset: true });
  const bold = await pdf.embedFont(boldBuf, { subset: true });
  pdf.setTitle(opts.title);

  const PW = 595.28;
  const PH = 841.89;
  const margin = 60;
  const contentW = PW - margin * 2;
  const black = rgb(0.13, 0.13, 0.16);
  const purple = rgb(0.45, 0.28, 0.72);
  const muted = rgb(0.52, 0.52, 0.58);

  const pages: PDFPage[] = [];
  let page: PDFPage = pdf.addPage([PW, PH]);
  pages.push(page);
  let y = PH - margin;
  const ensure = (need: number) => {
    // Alt kenarda sayfa numarası için ~30pt boşluk bırak.
    if (y - need < margin + 30) {
      page = pdf.addPage([PW, PH]);
      pages.push(page);
      y = PH - margin;
    }
  };

  function drawBlock(
    runs: Run[],
    size: number,
    color = black,
    gapAfter = size * 0.85,
    lineHeightMul = 1.55,
    indent = 0,
  ) {
    const lineHeight = size * lineHeightMul;
    const maxW = contentW - indent;
    const words: { w: string; f: PDFFont }[] = [];
    for (const r of runs) {
      const f = r.b ? bold : regular;
      for (const w of r.t.split(/(\s+)/)) if (w.length) words.push({ w, f });
    }
    let line: { w: string; f: PDFFont }[] = [];
    let lineW = 0;
    const flush = () => {
      ensure(lineHeight);
      let x = margin + indent;
      for (const it of line) {
        page.drawText(it.w, { x, y: y - size, size, font: it.f, color });
        x += it.f.widthOfTextAtSize(it.w, size);
      }
      y -= lineHeight;
      line = [];
      lineW = 0;
    };
    for (const word of words) {
      const ww = word.f.widthOfTextAtSize(word.w, size);
      if (lineW + ww > maxW && line.length) flush();
      if (line.length === 0 && word.w.trim() === "") continue;
      line.push(word);
      lineW += ww;
    }
    if (line.length) flush();
    y -= gapAfter;
  }

  // ── Kapak bloğu ──
  ensure(40);
  drawBlock(toRuns(opts.title), 17, black, 3, 1.25);
  drawBlock([{ t: `${opts.languageLabel}`, b: false }], 10.5, purple, 12, 1.2);
  ensure(10);
  page.drawLine({
    start: { x: margin, y: y + 2 },
    end: { x: PW - margin, y: y + 2 },
    thickness: 0.6,
    color: rgb(0.85, 0.85, 0.9),
  });
  y -= 16;

  // ── Gövde: boş satırla ayrılmış paragraflar; yumuşak satır kırıkları birleştirilir ──
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const raw of blocks) {
    const heading = raw.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      y -= 2;
      drawBlock(toRuns(heading[1].trim()), 13, purple, 6, 1.3);
      continue;
    }
    const bullet = raw.match(/^\s*[-*•]\s+/);
    const clean = raw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) continue;
    if (bullet) {
      ensure(16);
      page.drawText("•", { x: margin, y: y - 11.5, size: 11.5, font: regular, color: purple });
      drawBlock(toRuns(clean.replace(/^[-*•]\s+/, "")), 11.5, black, 5, 1.5, 16);
    } else {
      drawBlock(toRuns(clean), 11.5, black, 9, 1.55);
    }
  }

  // ── Sayfa numaraları ──
  const total = pages.length;
  pages.forEach((pg, i) => {
    const label = `${i + 1} / ${total}`;
    const w = regular.widthOfTextAtSize(label, 8.5);
    pg.drawText(label, { x: (PW - w) / 2, y: margin - 26, size: 8.5, font: regular, color: muted });
  });

  return pdf.save();
}

export function pdfBytesToBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
