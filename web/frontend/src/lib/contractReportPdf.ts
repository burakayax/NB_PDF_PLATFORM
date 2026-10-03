import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PDF_SAVE_OPTIONS } from "./pdfSaveOptions";
import { loadPdfFonts } from "./summaryPdf";
import { findingCodes, FINDING_CODE_LEGEND, SEVERITY_COLORS } from "./findingCode";
import { proofFooter, PROOF_NOTE } from "./contractProof";
import type { ContractProof, ContractReport, Finding, Severity } from "../api/contractReview";

/**
 * SÖZLEŞME DENETİM RAPORU (PDF) — görsel olarak vurgulu rapor.
 *  • üstte renkli GENEL RİSK paneli + önem sayıları,
 *  • "Kritik ve yüksek riskli yerler" hızlı dizini (kod, başlık, madde, sayfa),
 *  • her bulgu için önem renginde kart: kod rozeti, BELGEDEN ALINTI renkle vurgulu blok, rakamlar (TL, %, gün) kalın,
 *  • eksik maddeler / sorular / varsayımlar ayrı renkli kutularda.
 * Gömülü Roboto kullanılır: Türkçe karakterler her görüntüleyicide eksiksiz görünür.
 * `notesOnly` yalnızca bulgu kartlarını çizer (boyalı PDF'in sonuna eklenen "Denetim notları" sayfaları için).
 */

const PW = 595.28;
const PH = 841.89;
const M = 44;
const CONTENT_W = PW - M * 2;
const FOOTER_RESERVE = 34;

const SEV_TR: Record<Severity, string> = { kritik: "Kritik", yuksek: "Yüksek", orta: "Orta", dusuk: "Düşük" };
const SEV_ORDER: Severity[] = ["kritik", "yuksek", "orta", "dusuk"];
const LEGAL_TR: Record<string, string> = {
  mevzuata_aykiri: "Mevzuata aykırı olabilir",
  dayanak_var: "Mevzuatta dayanağı var",
};

type RGB = { r: number; g: number; b: number };
const c = (x: RGB, mul = 1) => rgb(Math.min(1, x.r * mul), Math.min(1, x.g * mul), Math.min(1, x.b * mul));
const tint = (x: RGB, t: number) => rgb(1 - (1 - x.r) * t, 1 - (1 - x.g) * t, 1 - (1 - x.b) * t); // beyaza karışım

const INK = rgb(0.1, 0.1, 0.13);
const GRAY = rgb(0.38, 0.38, 0.43);
const LIGHT = rgb(0.97, 0.97, 0.98);

type Word = { t: string; b: boolean };

/** Rakamları (tutar, yüzde, süre) kalın yapmak için metni parçalara ayırır. */
const EMPH_RE = /(%\s?\d[\d.,]*|\d[\d.,]*\s?(?:TL|₺|%|gün|saat|ay|yıl|kat)(?![\p{L}]))/giu;
function emphasize(text: string): Word[] {
  const out: Word[] = [];
  let last = 0;
  for (const m of text.matchAll(EMPH_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), b: false });
    out.push({ t: m[0], b: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), b: false });
  return out;
}

class Doc {
  pdf!: PDFDocument;
  reg!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;
  pageCount = 0;

  async init(): Promise<void> {
    this.pdf = await PDFDocument.create();
    this.pdf.registerFontkit(fontkit);
    const f = await loadPdfFonts();
    this.reg = await this.pdf.embedFont(f.regular, { subset: true });
    this.bold = await this.pdf.embedFont(f.bold, { subset: true });
    this.newPage();
  }
  get bottom(): number {
    return M + FOOTER_RESERVE;
  }
  newPage(): void {
    this.page = this.pdf.addPage([PW, PH]);
    this.y = PH - M;
    this.pageCount++;
  }
  ensure(h: number): void {
    if (this.y - h < this.bottom) this.newPage();
  }

  /** Metni kelime kelime sarar; kalın parçaları (rakamlar) ayrı font ile ölçer. */
  wrap(words: Word[], size: number, maxW: number, forceBold = false): Word[][] {
    const lines: Word[][] = [];
    let line: Word[] = [];
    let w = 0;
    for (const run of words) {
      for (const tok of run.t.split(/(\s+)/)) {
        if (!tok) continue;
        const f = forceBold || run.b ? this.bold : this.reg;
        const tw = f.widthOfTextAtSize(tok, size);
        if (/^\s+$/.test(tok)) {
          if (line.length) { line.push({ t: " ", b: run.b }); w += tw; }
          continue;
        }
        if (w + tw > maxW && line.length) {
          while (line.length && line[line.length - 1]!.t === " ") line.pop();
          lines.push(line);
          line = [];
          w = 0;
        }
        line.push({ t: tok, b: forceBold || run.b });
        w += tw;
      }
    }
    while (line.length && line[line.length - 1]!.t === " ") line.pop();
    if (line.length) lines.push(line);
    return lines;
  }

  plain(text: string, size: number, maxW: number, bold = false): Word[][] {
    return this.wrap([{ t: text, b: bold }], size, maxW, bold);
  }
  rich(text: string, size: number, maxW: number): Word[][] {
    return this.wrap(emphasize(text), size, maxW);
  }

  drawLine(line: Word[], x: number, y: number, size: number, color = INK): void {
    let cx = x;
    for (const wd of line) {
      const f = wd.b ? this.bold : this.reg;
      this.page.drawText(wd.t, { x: cx, y, size, font: f, color: wd.b && color === INK ? rgb(0, 0, 0) : color });
      cx += f.widthOfTextAtSize(wd.t, size);
    }
  }
}

type Block = { h: number; draw: (x: number, top: number, w: number) => void; bg?: ReturnType<typeof rgb>; bar?: ReturnType<typeof rgb> };

/** Bir bulgu kartını bloklara ayırır (üst bilgi, madde/sayfa, vurgulu alıntı, açıklamalar…). */
function findingBlocks(d: Doc, f: Finding, code: string, innerW: number): Block[] {
  const col = SEVERITY_COLORS[f.severity];
  const sevColor = c(col, 0.78);
  const blocks: Block[] = [];

  // 1) Üst bilgi: kod rozeti + önem + başlık
  const chipW = 34;
  const titleLines = d.plain(f.title, 10.6, innerW - chipW - 10, true);
  const headH = Math.max(18, titleLines.length * 13.5) + 8;
  blocks.push({
    h: headH,
    draw: (x, top) => {
      d.page.drawRectangle({ x, y: top - 18, width: chipW, height: 16, color: c(col) });
      const tw = d.bold.widthOfTextAtSize(code, 9);
      d.page.drawText(code, { x: x + (chipW - tw) / 2, y: top - 14, size: 9, font: d.bold, color: rgb(1, 1, 1) });
      let ty = top - 12.5;
      for (const l of titleLines) { d.drawLine(l, x + chipW + 10, ty, 10.6, INK); ty -= 13.5; }
    },
  });

  // 2) Önem + madde/sayfa + hukuki durum (tek satır)
  const meta = [SEV_TR[f.severity].toUpperCase(), f.clause, f.page ? `Sayfa ${f.page}` : "", LEGAL_TR[f.legalStatus] ?? ""].filter(Boolean).join("  ·  ");
  blocks.push({
    h: 14,
    draw: (x, top) => {
      const sevW = d.bold.widthOfTextAtSize(SEV_TR[f.severity].toUpperCase(), 7.6);
      d.page.drawText(SEV_TR[f.severity].toUpperCase(), { x, y: top - 9, size: 7.6, font: d.bold, color: sevColor });
      const rest = meta.slice(SEV_TR[f.severity].length);
      d.page.drawText(rest, { x: x + sevW, y: top - 9, size: 7.6, font: d.reg, color: GRAY });
    },
  });

  // 3) BELGEDEN ALINTI — önem renginde vurgulu blok (kritik yerin kendisi)
  if (f.quote) {
    const qLines = d.plain(`“${f.quote}”`, 9, innerW - 22);
    blocks.push({
      h: 11 + qLines.length * 11.6 + 8,
      draw: (x, top, w) => {
        const h = 11 + qLines.length * 11.6 + 8;
        d.page.drawRectangle({ x, y: top - h + 2, width: w, height: h - 2, color: tint(col, 0.32) });
        d.page.drawRectangle({ x, y: top - h + 2, width: 3, height: h - 2, color: c(col) });
        d.page.drawText("BELGEDEKİ İFADE", { x: x + 10, y: top - 9, size: 6.4, font: d.bold, color: sevColor });
        let ty = top - 9 - 11;
        for (const l of qLines) { d.drawLine(l, x + 10, ty, 9, INK); ty -= 11.6; }
      },
    });
  }

  // 4) Etiketli açıklamalar
  const para = (label: string, text: string, labelColor = GRAY, box?: ReturnType<typeof rgb>) => {
    if (!text) return;
    const lines = d.rich(text, 8.8, innerW - (box ? 20 : 0));
    const h = 10 + lines.length * 11.4 + (box ? 12 : 6);
    blocks.push({
      h,
      draw: (x, top, w) => {
        if (box) d.page.drawRectangle({ x, y: top - h + 3, width: w, height: h - 3, color: box });
        const px = x + (box ? 10 : 0);
        d.page.drawText(label.toUpperCase(), { x: px, y: top - (box ? 10 : 7), size: 6.6, font: d.bold, color: labelColor });
        let ty = top - (box ? 10 : 7) - 10.4;
        for (const l of lines) { d.drawLine(l, px, ty, 8.8); ty -= 11.4; }
      },
    });
  };
  para("Neden riskli", f.whyRisky);
  para("Sizin için etkisi", f.impact);
  para("Öneri", f.recommendation, rgb(0.05, 0.45, 0.3));
  para("Önerilen madde metni", f.suggestedText, rgb(0.05, 0.45, 0.3), rgb(0.92, 0.98, 0.95));

  // 5) Güncel mevzuat (resmî kaynaktan okunan)
  for (const ref of f.legalReferences) {
    const lines = d.rich(`${ref.law} ${ref.article} — ${ref.note}`, 8.4, innerW - 20);
    const url = ref.sourceUrl ? d.plain(`Kaynak: ${ref.sourceUrl}`, 6.8, innerW - 20) : [];
    const h = 10 + lines.length * 10.8 + url.length * 8.6 + 10;
    blocks.push({
      h,
      draw: (x, top, w) => {
        d.page.drawRectangle({ x, y: top - h + 3, width: w, height: h - 3, color: rgb(0.95, 0.96, 0.99) });
        d.page.drawText("GÜNCEL MEVZUAT (RESMÎ KAYNAKTAN OKUNDU)", { x: x + 10, y: top - 10, size: 6.4, font: d.bold, color: rgb(0.2, 0.3, 0.6) });
        let ty = top - 10 - 10;
        for (const l of lines) { d.drawLine(l, x + 10, ty, 8.4); ty -= 10.8; }
        for (const l of url) { d.drawLine(l, x + 10, ty, 6.8, rgb(0.2, 0.3, 0.6)); ty -= 8.6; }
      },
    });
  }
  return blocks;
}

/** Bulgu kartını çizer: bütün hâlinde sığıyorsa bir sayfada tutar, değilse bloklar hâlinde akıtır. */
function drawFinding(d: Doc, f: Finding, code: string): void {
  const col = SEVERITY_COLORS[f.severity];
  const padL = 14;
  const innerW = CONTENT_W - padL - 8;
  const blocks = findingBlocks(d, f, code, innerW);
  const total = blocks.reduce((s, b) => s + b.h, 0) + 8;
  if (total <= PH - 2 * M - FOOTER_RESERVE) d.ensure(total);
  for (const b of blocks) {
    d.ensure(b.h);
    const top = d.y;
    d.page.drawRectangle({ x: M, y: top - b.h, width: CONTENT_W, height: b.h, color: LIGHT });
    b.draw(M + padL, top, CONTENT_W - padL - 8);
    d.page.drawRectangle({ x: M, y: top - b.h, width: 4, height: b.h, color: c(col) });
    d.y -= b.h;
  }
  d.y -= 12;
}

function sectionTitle(d: Doc, text: string, color = INK): void {
  d.ensure(190); // başlık sayfa sonunda tek başına kalmasın
  d.page.drawText(text, { x: M, y: d.y - 12, size: 12, font: d.bold, color });
  d.page.drawRectangle({ x: M, y: d.y - 17, width: CONTENT_W, height: 0.7, color: rgb(0.82, 0.82, 0.86) });
  d.y -= 26;
}

function box(d: Doc, title: string, lines: Word[][], bg: ReturnType<typeof rgb>, accent: ReturnType<typeof rgb>, size = 9): void {
  const h = (title ? 16 : 6) + lines.length * (size + 3.4) + 12;
  d.ensure(h);
  const top = d.y;
  d.page.drawRectangle({ x: M, y: top - h, width: CONTENT_W, height: h, color: bg });
  d.page.drawRectangle({ x: M, y: top - h, width: 4, height: h, color: accent });
  let ty = top - 6;
  if (title) { ty -= 8; d.page.drawText(title.toUpperCase(), { x: M + 14, y: ty, size: 7, font: d.bold, color: accent }); ty -= 10; }
  else ty -= size;
  for (const l of lines) { d.drawLine(l, M + 14, ty, size); ty -= size + 3.4; }
  d.y = top - h - 10;
}

export type ReportPdfOptions = { notesOnly?: boolean };

export async function contractReportToPdf(
  r: ContractReport,
  fileName: string,
  proof?: ContractProof,
  opts: ReportPdfOptions = {},
): Promise<Uint8Array> {
  const d = new Doc();
  await d.init();
  const codes = findingCodes(r.findings);
  const innerW = CONTENT_W - 28;
  const quick = r.meta.mode === "quick";

  if (opts.notesOnly) {
    d.page.drawText(`Denetim notları${quick ? " — hızlı tarama" : ""}`, { x: M, y: d.y - 16, size: 17, font: d.bold, color: INK });
    d.y -= 26;
    for (const l of d.plain("Bu sayfalar, belge sayfalarının kenarındaki kodlu notların tam açıklamalarıdır. " + FINDING_CODE_LEGEND, 8.6, CONTENT_W)) {
      d.drawLine(l, M, d.y - 8, 8.6, GRAY);
      d.y -= 11.5;
    }
    d.y -= 8;
    r.findings.forEach((f, i) => drawFinding(d, f, codes[i]!));
    finish(d, proof);
    return d.pdf.save(PDF_SAVE_OPTIONS);
  }

  // ── Başlık
  d.page.drawText("Sözleşme Denetim Raporu", { x: M, y: d.y - 20, size: 21, font: d.bold, color: INK });
  d.y -= 30;
  const sub = [fileName, r.meta.docType, `${r.meta.pageCount} sayfa`].filter(Boolean).join("  ·  ");
  for (const l of d.plain(sub, 9, CONTENT_W)) { d.drawLine(l, M, d.y - 8, 9, GRAY); d.y -= 12; }
  if (r.meta.parties.length) for (const l of d.plain(r.meta.parties.join("  ·  "), 8.4, CONTENT_W)) { d.drawLine(l, M, d.y - 8, 8.4, GRAY); d.y -= 11; }
  d.y -= 6;

  // ── Rapor türü
  const typeCol: RGB = quick ? { r: 0.96, g: 0.62, b: 0.04 } : { r: 0.55, g: 0.27, b: 0.85 };
  const typeLabel = quick ? "HIZLI TARAMA" : "DETAYLI DENETİM";
  const tw = d.bold.widthOfTextAtSize(typeLabel, 7.4) + 16;
  d.page.drawRectangle({ x: M, y: d.y - 16, width: tw, height: 16, color: c(typeCol, 0.9) });
  d.page.drawText(typeLabel, { x: M + 8, y: d.y - 11.5, size: 7.4, font: d.bold, color: rgb(1, 1, 1) });
  d.y -= 28;

  // ── Genel risk paneli
  const risk = SEVERITY_COLORS[r.riskLevel];
  const headLines = d.plain(r.headline, 11, CONTENT_W - 28, true);
  const panelH = 24 + headLines.length * 14.5 + 34;
  d.ensure(panelH);
  const pTop = d.y;
  d.page.drawRectangle({ x: M, y: pTop - panelH, width: CONTENT_W, height: panelH, color: c(risk, 0.9) });
  d.page.drawText(`GENEL RİSK: ${SEV_TR[r.riskLevel].toUpperCase()}`, { x: M + 14, y: pTop - 19, size: 10, font: d.bold, color: rgb(1, 1, 1) });
  let hy = pTop - 19 - 17;
  for (const l of headLines) { d.drawLine(l, M + 14, hy, 11, rgb(1, 1, 1)); hy -= 14.5; }
  // önem sayıları (beyaz zeminli kutucuklar)
  let cx = M + 14;
  for (const s of SEV_ORDER) {
    const n = r.findings.filter((f) => f.severity === s).length;
    if (!n) continue;
    const label = `${n} ${SEV_TR[s].toLowerCase()}`;
    const w = d.bold.widthOfTextAtSize(label, 8) + 22;
    d.page.drawRectangle({ x: cx, y: pTop - panelH + 8, width: w, height: 16, color: rgb(1, 1, 1) });
    d.page.drawRectangle({ x: cx + 5, y: pTop - panelH + 13, width: 6, height: 6, color: c(SEVERITY_COLORS[s]) });
    d.page.drawText(label, { x: cx + 15, y: pTop - panelH + 12.5, size: 8, font: d.bold, color: INK });
    cx += w + 6;
  }
  d.y = pTop - panelH - 12;

  if (quick) {
    box(d, "Hızlı tarama sonucu", d.plain("Güncel mevzuat kontrolü, önerilen madde metinleri, müzakere öncelikleri ve notlarınıza tek tek yanıt bu raporda YOKTUR. Kapsamlı sonuç için detaylı denetim gerekir.", 8.6, innerW), tint({ r: 0.96, g: 0.62, b: 0.04 }, 0.18), rgb(0.85, 0.5, 0.02), 8.6);
  }

  // ── Özet
  if (r.summary) box(d, "Özet", d.rich(r.summary, 9.2, innerW), rgb(0.96, 0.96, 0.98), rgb(0.35, 0.35, 0.45), 9.2);

  // ── Kritik ve yüksek riskli yerler: hızlı dizin
  const hot = r.findings.map((f, i) => ({ f, code: codes[i]! })).filter((x) => x.f.severity === "kritik" || x.f.severity === "yuksek");
  if (hot.length) {
    sectionTitle(d, "Kritik ve yüksek riskli yerler");
    for (const { f, code } of hot) {
      const col = SEVERITY_COLORS[f.severity];
      const where = [f.clause, f.page ? `Sayfa ${f.page}` : ""].filter(Boolean).join(" · ");
      const whereW = d.reg.widthOfTextAtSize(where, 7.8);
      const lines = d.plain(f.title, 9, CONTENT_W - 52 - whereW - 24, true);
      const h = Math.max(20, lines.length * 12 + 8);
      d.ensure(h + 3);
      const top = d.y;
      d.page.drawRectangle({ x: M, y: top - h, width: CONTENT_W, height: h, color: tint(col, 0.14) });
      d.page.drawRectangle({ x: M, y: top - h, width: 4, height: h, color: c(col) });
      d.page.drawRectangle({ x: M + 12, y: top - h / 2 - 8, width: 30, height: 16, color: c(col) });
      const cw = d.bold.widthOfTextAtSize(code, 9);
      d.page.drawText(code, { x: M + 12 + (30 - cw) / 2, y: top - h / 2 - 3.8, size: 9, font: d.bold, color: rgb(1, 1, 1) });
      let ty = top - (h - lines.length * 12) / 2 - 9;
      for (const l of lines) { d.drawLine(l, M + 52, ty, 9, INK); ty -= 12; }
      const ww = d.reg.widthOfTextAtSize(where, 7.8);
      d.page.drawText(where, { x: M + CONTENT_W - ww - 10, y: top - h / 2 - 3, size: 7.8, font: d.reg, color: GRAY });
      d.y = top - h - 3;
    }
    d.y -= 8;
  }

  // ── Notlarınıza yanıt
  if (r.concernResponses?.length) {
    sectionTitle(d, "Notlarınıza yanıt");
    for (const cr of r.concernResponses) {
      const lines = d.rich(cr.response, 9, innerW);
      const noteLines = d.plain(`“${cr.note}”`, 8.2, innerW);
      const refs = cr.findingIds.map((id) => codes[r.findings.findIndex((f) => f.id === id)]).filter(Boolean).join(", ");
      box(d, "", [...noteLines.map((l) => l.map((w) => ({ ...w }))), ...lines], rgb(0.98, 0.95, 0.99), rgb(0.7, 0.3, 0.85), 9);
      if (refs) { d.y += 4; d.page.drawText(`İlgili bulgular: ${refs}`, { x: M + 14, y: d.y - 3, size: 7.6, font: d.bold, color: rgb(0.6, 0.25, 0.75) }); d.y -= 12; }
    }
  }

  // ── Müzakere öncelikleri
  if (r.priorities.length) {
    sectionTitle(d, "Müzakerede ilk kapatılacaklar");
    r.priorities.forEach((p, i) => {
      const code = p.findingId ? codes[r.findings.findIndex((f) => f.id === p.findingId)] : undefined;
      box(d, `${i + 1}. öncelik${code ? ` — ${code}` : ""}`, d.rich(`${p.title} — ${p.why}`, 9, innerW), rgb(0.93, 0.97, 1), rgb(0.15, 0.4, 0.8), 9);
    });
  }

  // ── Bulgular
  if (r.findings.length) {
    sectionTitle(d, `Bulgular (${r.findings.length})`);
    for (const l of d.plain(FINDING_CODE_LEGEND, 8, CONTENT_W)) { d.drawLine(l, M, d.y - 6, 8, GRAY); d.y -= 10.5; }
    d.y -= 6;
    r.findings.forEach((f, i) => drawFinding(d, f, codes[i]!));
  }

  // ── Eksik maddeler
  if (r.missingClauses.length) {
    sectionTitle(d, "Sözleşmede olmayan ama olması gereken maddeler", rgb(0.7, 0.4, 0.02));
    for (const m of r.missingClauses) {
      const lines = [...d.plain(m.title, 9.4, innerW, true), ...d.rich(m.why, 8.8, innerW), ...(m.suggestedText ? d.rich(`Önerilen metin: ${m.suggestedText}`, 8.6, innerW) : [])];
      box(d, "Eksik madde", lines, rgb(1, 0.97, 0.9), rgb(0.85, 0.5, 0.02), 8.8);
    }
  }

  // ── Sorular / varsayımlar
  if (r.questionsForUser.length) {
    sectionTitle(d, "Cevaplarınıza rağmen belirsiz kalanlar", rgb(0.4, 0.25, 0.75));
    box(d, "", r.questionsForUser.flatMap((q) => d.plain(`•  ${q}`, 8.8, innerW)), rgb(0.96, 0.95, 1), rgb(0.5, 0.35, 0.85), 8.8);
  }
  sectionTitle(d, "Mevzuat kontrolü" + (quick ? " — yapılmadı" : ""));
  for (const l of d.plain(r.meta.lawCheck.note, 8.8, CONTENT_W)) { d.drawLine(l, M, d.y - 8, 8.8, INK); d.y -= 11.6; }
  d.y -= 4;
  if (r.assumptions.length) {
    for (const l of d.plain("Varsayımlar ve sınırlar", 8.8, CONTENT_W, true)) { d.ensure(12); d.drawLine(l, M, d.y - 8, 8.8, GRAY); d.y -= 12; }
    for (const a of r.assumptions) for (const l of d.plain(`•  ${a}`, 8.2, CONTENT_W - 8)) { d.ensure(11); d.drawLine(l, M + 4, d.y - 7, 8.2, GRAY); d.y -= 10.6; }
    d.y -= 6;
  }
  box(d, "Önemli", d.plain("Bu rapor yapay zekâ destekli bir ön değerlendirmedir; hukuki danışmanlık yerine geçmez ve hata içerebilir. İmzadan önce, özellikle kritik ve yüksek riskli maddeler için bir avukata danışmanız önerilir.", 8.4, innerW), rgb(0.97, 0.97, 0.98), rgb(0.5, 0.5, 0.55), 8.4);

  finish(d, proof);
  return d.pdf.save(PDF_SAVE_OPTIONS);
}

/** Doğrulama bilgisini son sayfanın altına yazar (sığmazsa ayrı sayfa), sonra tüm sayfalara altbilgi ekler. */
function finish(d: Doc, proof?: ContractProof): void {
  if (proof) {
    const lines = [...d.plain(proofFooter(proof), 6.8, CONTENT_W), ...d.plain(PROOF_NOTE, 6.8, CONTENT_W)];
    const need = lines.length * 8.8 + 6;
    let y = d.y - 4;
    if (y - need < M + 24) {
      d.newPage();
      d.page.drawText("Doğrulama bilgisi", { x: M, y: d.y - 10, size: 9, font: d.bold, color: INK });
      y = d.y - 22;
    }
    for (const l of lines) {
      d.drawLine(l, M, y - 7, 6.8, GRAY);
      y -= 8.8;
    }
  }
  const pages = d.pdf.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: M, y: M + 18, width: CONTENT_W, height: 0.5, color: rgb(0.85, 0.85, 0.88) });
    const brand = "pdfplatform.app · Sözleşme Denetçisi";
    p.drawText(brand, { x: M, y: M + 6, size: 7.2, font: d.reg, color: GRAY });
    // Adres kısmı tıklanabilir bağlantı
    const linkW = d.reg.widthOfTextAtSize("pdfplatform.app", 7.2);
    const link = d.pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [M, M + 3, M + linkW, M + 15],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of("https://pdfplatform.app") },
    });
    p.node.addAnnot(d.pdf.context.register(link));
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: PW / 2 - d.reg.widthOfTextAtSize(pn, 7.2) / 2, y: M + 6, size: 7.2, font: d.reg, color: GRAY });
    if (proof) {
      const rn = `Rapor No: ${proof.reportId.slice(0, 8)}`;
      p.drawText(rn, { x: PW - M - d.reg.widthOfTextAtSize(rn, 7.2), y: M + 6, size: 7.2, font: d.reg, color: GRAY });
    }
  });
}
