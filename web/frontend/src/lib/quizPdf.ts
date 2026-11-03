/**
 * Soru / test PDF'i — gerçek bir SINAV KİTAPÇIĞI tasarımı (pdf-lib + gömülü Roboto, Türkçe tam).
 *
 *  • Başlık şeridi: ders/sınıf etiketi, başlık, alt satır; şerit üzerinde çapraz çizgi deseni
 *  • Ad / tarih / puan kutuları (yalnız soru kâğıdında)
 *  • Her soru bir kart: numara rozeti, (isteğe bağlı) puan değeri, çerçeveli harf kutulu şıklar,
 *    doğru/yanlış kutucukları, boşluk doldurmada alt çizgi, açık uçlu için çizgili cevap alanı
 *  • Kart sayfa ortasında BÖLÜNMEZ; ikinci sayfadan itibaren ince üst şerit
 *  • "Cevap Anahtarı": puanlama tablosu (puan açıksa) + özet ızgarası + açıklama ve belge alıntısı
 *  • Altbilgi: başlık + sayfa numarası rozeti (filigran/marka yok)
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { QuizQuestion } from "../api/ai";
import { answerLabel, distributePoints } from "./quizFormat";
import { loadPdfFonts } from "./summaryPdf";
import { PDF_SAVE_OPTIONS } from "./pdfSaveOptions";

const PW = 595.28;
const PH = 841.89;
const M = 48;
const CW = PW - M * 2;
const LETTERS = ["A", "B", "C", "D"];

const INK = rgb(0.1, 0.11, 0.16);
const MUTED = rgb(0.43, 0.45, 0.54);
const VIOLET = rgb(0.4, 0.2, 0.82);
const VIOLET_DARK = rgb(0.3, 0.13, 0.68);
const VIOLET_SOFT = rgb(0.95, 0.93, 0.99);
const LINE = rgb(0.84, 0.83, 0.9);
const GREEN = rgb(0.09, 0.55, 0.36);
const GREEN_SOFT = rgb(0.92, 0.97, 0.94);
const WHITE = rgb(1, 1, 1);

export type QuizPdfOptions = {
  title: string;
  /** Başlığın altındaki satır: ör. "10 soru · Orta zorluk". */
  subtitle: string;
  withAnswers: boolean;
  /** true ise ad/tarih/puan kutuları çizilir. */
  studentInfo?: boolean;
  /** Başlık şeridindeki küçük etiket: ör. "MATEMATİK · 9. SINIF". */
  label?: string;
  /** true ise sorulara 100 puan üzerinden değer yazılır ve cevap anahtarında puanlama tablosu çizilir. */
  showPoints?: boolean;
};

type Tok = { t: string; w: number; blank: boolean };

export async function quizToPdf(questions: QuizQuestion[], lang: "tr" | "en", opts: QuizPdfOptions): Promise<Uint8Array> {
  const tr = lang === "tr";
  const { regular: regBuf, bold: boldBuf } = await loadPdfFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const reg = await pdf.embedFont(regBuf, { subset: true });
  const bold = await pdf.embedFont(boldBuf, { subset: true });
  pdf.setTitle(opts.title);

  const points = opts.showPoints ? distributePoints(questions.length) : [];
  const shortTitle = opts.title.length > 60 ? opts.title.slice(0, 59) + "…" : opts.title;

  let page: PDFPage = pdf.addPage([PW, PH]);
  let y = PH - M;

  const rect = (x: number, yy: number, w: number, h: number, fill?: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, color: fill, borderColor: border, borderWidth: border ? 0.8 : 0 });

  const centered = (text: string, cx: number, baseY: number, font: PDFFont, size: number, color = INK) =>
    page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y: baseY, size, font, color });

  /** Yeni sayfa; `running` ise ince üst şerit (başlık) çizilir. */
  const newPage = (running = true) => {
    page = pdf.addPage([PW, PH]);
    y = PH - M;
    if (running) {
      rect(0, PH - 28, PW, 28, VIOLET);
      page.drawText(shortTitle, { x: M, y: PH - 18, size: 9, font: bold, color: WHITE });
      y = PH - 28 - 22;
    }
  };
  const ensure = (h: number) => {
    if (y - h < M + 22) newPage();
  };

  /** Sözcüklere böler; "____" boşluğu sabit genişlikli özel öğedir. */
  const tokens = (text: string, font: PDFFont, size: number): Tok[] => {
    const out: Tok[] = [];
    for (const w of text.split(/\s+/).filter(Boolean)) {
      if (/^_{2,}[.,;:!?]*$/.test(w)) out.push({ t: w.replace(/^_+/, ""), w: 70, blank: true });
      else out.push({ t: w, w: font.widthOfTextAtSize(w, size), blank: false });
    }
    return out;
  };

  /** Metni genişliğe göre satırlara böler (öğe dizisi döner). */
  const wrap = (text: string, font: PDFFont, size: number, maxW: number): Tok[][] => {
    const space = font.widthOfTextAtSize(" ", size);
    const lines: Tok[][] = [];
    let cur: Tok[] = [];
    let w = 0;
    for (const tk of tokens(text, font, size)) {
      const add = (cur.length ? space : 0) + tk.w;
      if (w + add > maxW && cur.length) {
        lines.push(cur);
        cur = [];
        w = 0;
      }
      w += (cur.length ? space : 0) + tk.w;
      cur.push(tk);
    }
    if (cur.length) lines.push(cur);
    return lines.length ? lines : [[]];
  };

  const drawLine = (toks: Tok[], x: number, baseY: number, font: PDFFont, size: number, color = INK) => {
    const space = font.widthOfTextAtSize(" ", size);
    let cx = x;
    for (const tk of toks) {
      if (tk.blank) {
        page.drawLine({ start: { x: cx, y: baseY - 1.5 }, end: { x: cx + 66, y: baseY - 1.5 }, thickness: 0.8, color: INK });
        if (tk.t) page.drawText(tk.t, { x: cx + 66, y: baseY, size, font, color });
      } else {
        page.drawText(tk.t, { x: cx, y: baseY, size, font, color });
      }
      cx += tk.w + space;
    }
  };

  const badge = (n: number, x: number, topY: number, fill = VIOLET) => {
    rect(x, topY - 20, 24, 20, fill);
    centered(String(n), x + 12, topY - 14, bold, 10.5, WHITE);
  };

  // ── Başlık şeridi ────────────────────────────────────────────────
  const BAND = 104;
  rect(0, PH - BAND, PW, BAND, VIOLET);
  // Çapraz çizgi deseni (sağ taraf): şeride hareket ve derinlik katar.
  for (let k = 0; k < 16; k++) {
    const x0 = PW - 230 + k * 15;
    page.drawLine({ start: { x: x0, y: PH - BAND }, end: { x: x0 + 46, y: PH }, thickness: k % 3 === 0 ? 5 : 2, color: VIOLET_DARK, opacity: 0.35 });
  }
  let titleY = PH - 52;
  if (opts.label) {
    const lw = bold.widthOfTextAtSize(opts.label, 8.5) + 18;
    rect(M, PH - 38, lw, 18, WHITE);
    page.drawText(opts.label, { x: M + 9, y: PH - 32.5, size: 8.5, font: bold, color: VIOLET });
    titleY = PH - 62;
  }
  page.drawText(opts.title, { x: M, y: titleY, size: 21, font: bold, color: WHITE });
  page.drawText(opts.subtitle, { x: M, y: titleY - 22, size: 10.5, font: reg, color: rgb(0.9, 0.86, 0.99) });
  y = PH - BAND - 22;

  if (opts.studentInfo) {
    const gap = 12;
    const cols = [
      { label: tr ? "Ad Soyad" : "Name", w: CW * 0.5 },
      { label: tr ? "Tarih" : "Date", w: CW * 0.25 },
      { label: tr ? "Puan" : "Score", w: CW * 0.25 - gap * 2 },
    ];
    let x = M;
    for (const c of cols) {
      rect(x, y - 34, c.w, 34, WHITE, LINE);
      page.drawText(c.label, { x: x + 8, y: y - 12, size: 8, font: bold, color: MUTED });
      x += c.w + gap;
    }
    y -= 34 + 22;
  }

  // ── Sorular ──────────────────────────────────────────────────────
  const TEXT_X = M + 34;
  const TEXT_W = CW - 34;
  const PTS_W = opts.showPoints ? 56 : 0;
  const QSIZE = 11.5;
  const OSIZE = 10.5;

  questions.forEach((q, i) => {
    const qLines = wrap(q.q, bold, QSIZE, TEXT_W - PTS_W);
    const qh = qLines.length * 15.5;
    let bodyH = 0;
    let optLines: Tok[][][] = [];
    if (q.type === "mcq") {
      optLines = q.options.map((o) => wrap(o, reg, OSIZE, TEXT_W - 30));
      bodyH = optLines.reduce((s, l) => s + Math.max(22, l.length * 14 + 8) + 5, 0);
    } else if (q.type === "tf") {
      bodyH = 28;
    } else if (q.type === "open") {
      bodyH = 3 * 24 + 6;
    }
    const total = Math.max(qh + bodyH + 14, 40);
    ensure(total);

    rect(M, y - total + 8, CW, total, undefined, LINE);
    badge(i + 1, M + 8, y - 4);
    if (opts.showPoints) {
      const ptxt = `(${points[i]} ${tr ? "puan" : "pts"})`;
      page.drawText(ptxt, { x: M + CW - 8 - bold.widthOfTextAtSize(ptxt, 9.5), y: y - 15, size: 9.5, font: bold, color: VIOLET });
    }
    let cy = y - 4;
    qLines.forEach((ln) => {
      drawLine(ln, TEXT_X, cy - 11, bold, QSIZE);
      cy -= 15.5;
    });
    cy -= 6;

    if (q.type === "mcq") {
      optLines.forEach((ol, k) => {
        const h = Math.max(22, ol.length * 14 + 8);
        rect(TEXT_X, cy - h, 18, 18, VIOLET_SOFT, LINE);
        centered(LETTERS[k], TEXT_X + 9, cy - 13, bold, 9.5, VIOLET);
        ol.forEach((ln, li) => drawLine(ln, TEXT_X + 28, cy - 12 - li * 14, reg, OSIZE));
        cy -= h + 5;
      });
    } else if (q.type === "tf") {
      const labels = tr ? ["Doğru", "Yanlış"] : ["True", "False"];
      let bx = TEXT_X;
      labels.forEach((lb) => {
        rect(bx, cy - 18, 16, 16, WHITE, INK);
        page.drawText(lb, { x: bx + 24, y: cy - 13, size: OSIZE, font: reg, color: INK });
        bx += 110;
      });
    } else if (q.type === "open") {
      for (let r = 0; r < 3; r++) {
        cy -= 24;
        page.drawLine({ start: { x: TEXT_X, y: cy + 4 }, end: { x: M + CW - 10, y: cy + 4 }, thickness: 0.6, color: LINE });
      }
    }
    y -= total + 10;
  });

  // ── Cevap anahtarı ───────────────────────────────────────────────
  if (opts.withAnswers) {
    newPage(false);
    rect(0, PH - 70, PW, 70, GREEN);
    page.drawText(tr ? "Cevap Anahtarı" : "Answer Key", { x: M, y: PH - 44, size: 20, font: bold, color: WHITE });
    y = PH - 70 - 24;

    // Puanlama tablosu: soru numaraları üstte, puanlar altta, sonda TOPLAM.
    if (opts.showPoints && questions.length) {
      const perRow = 12;
      page.drawText(tr ? "PUANLAMA TABLOSU" : "SCORING TABLE", { x: M, y: y - 9, size: 9, font: bold, color: GREEN });
      y -= 18;
      for (let start = 0; start < questions.length; start += perRow) {
        const slice = questions.slice(start, start + perRow);
        const last = start + perRow >= questions.length;
        const cells = slice.length + (last ? 1 : 0);
        const cw = CW / Math.max(cells, 6);
        slice.forEach((_, k) => {
          const x = M + k * cw;
          rect(x, y - 20, cw, 20, GREEN_SOFT, LINE);
          centered(String(start + k + 1), x + cw / 2, y - 14, bold, 9, GREEN);
          rect(x, y - 40, cw, 20, WHITE, LINE);
          centered(String(points[start + k]), x + cw / 2, y - 34, reg, 9.5, INK);
        });
        if (last) {
          const x = M + slice.length * cw;
          rect(x, y - 20, cw, 20, GREEN, LINE);
          centered(tr ? "TOPLAM" : "TOTAL", x + cw / 2, y - 14, bold, 8, WHITE);
          rect(x, y - 40, cw, 20, WHITE, LINE);
          centered(String(points.reduce((a, b) => a + b, 0)), x + cw / 2, y - 34, bold, 9.5, INK);
        }
        y -= 40 + 8;
      }
      y -= 12;
    }

    // Özet ızgarası: 1 · A  2 · Doğru  3 · demir oksit …
    const short = questions.map((q, i) => {
      if (q.type === "open") return `${i + 1} · ${tr ? "açık uçlu" : "open"}`;
      return `${i + 1} · ${q.type === "mcq" ? LETTERS[q.answer] : answerLabel(q, lang)}`;
    });
    const cellW = (CW - 10 * 2) / 3;
    let col = 0;
    short.forEach((s, i) => {
      if (col === 0) ensure(30);
      const x = M + col * (cellW + 10);
      // Sığmayan uzun cevap (ölçülerek) kısaltılır.
      let label = s;
      while (label.length > 4 && bold.widthOfTextAtSize(label, 9.5) > cellW - 16) label = label.slice(0, -2).trimEnd() + "…";
      rect(x, y - 24, cellW, 24, GREEN_SOFT, LINE);
      page.drawText(label, { x: x + 8, y: y - 16, size: 9.5, font: bold, color: GREEN });
      col++;
      if (col === 3 || i === short.length - 1) {
        col = 0;
        y -= 24 + 8;
      }
    });
    y -= 10;

    // Ayrıntı: cevap + açıklama + belge alıntısı
    questions.forEach((q, i) => {
      const ans = wrap(answerLabel(q, lang), bold, 10.5, TEXT_W);
      const exp = q.explanation ? wrap(q.explanation, reg, 10, TEXT_W) : [];
      const src = wrap(`${tr ? "Belgeden" : "From the document"}: “${q.evidence}”`, reg, 9, TEXT_W);
      const h = ans.length * 14 + exp.length * 13 + src.length * 12 + 14;
      ensure(h);
      badge(i + 1, M, y);
      let cy = y;
      ans.forEach((ln) => { drawLine(ln, TEXT_X, cy - 12, bold, 10.5, GREEN); cy -= 14; });
      exp.forEach((ln) => { drawLine(ln, TEXT_X, cy - 11, reg, 10); cy -= 13; });
      src.forEach((ln) => { drawLine(ln, TEXT_X, cy - 10, reg, 9, MUTED); cy -= 12; });
      y -= h + 4;
    });
  }

  // ── Altbilgi (tüm sayfalara): başlık + sayfa numarası rozeti ───────
  const pages = pdf.getPages();
  pages.forEach((pg, idx) => {
    pg.drawLine({ start: { x: M, y: 36 }, end: { x: PW - M, y: 36 }, thickness: 0.5, color: LINE });
    pg.drawText(shortTitle, { x: M, y: 22, size: 8, font: bold, color: MUTED });
    const num = String(idx + 1);
    const totalTxt = ` / ${pages.length}`;
    const tw = reg.widthOfTextAtSize(totalTxt, 8);
    pg.drawText(totalTxt, { x: PW - M - tw, y: 22, size: 8, font: reg, color: MUTED });
    pg.drawRectangle({ x: PW - M - tw - 24, y: 17, width: 22, height: 15, color: VIOLET });
    pg.drawText(num, { x: PW - M - tw - 13 - bold.widthOfTextAtSize(num, 8.5) / 2, y: 22, size: 8.5, font: bold, color: WHITE });
  });

  return pdf.save(PDF_SAVE_OPTIONS);
}
