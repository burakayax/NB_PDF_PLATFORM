import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDict, PDFDocument, PDFName, PDFString, rgb, BlendMode, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PDF_SAVE_OPTIONS } from "./pdfSaveOptions";
import { loadPdfFonts } from "./summaryPdf";
import { contractReportToPdf } from "./contractReportPdf";
import { proofFooter, PROOF_NOTE } from "./contractProof";
import { findingCodes, FINDING_CODE_LEGEND, SEVERITY_COLORS } from "./findingCode";

export { proofFooter };
import type { ContractProof, ContractReport, Finding, Severity } from "../api/contractReview";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_PAGES = 200;
/** Sunucu sözleşme metni üst sınırı (karakter) — backend ile aynı. */
export const CONTRACT_MAX_CHARS = 240_000;

export type PagedText = { text: string; pageCount: number; likelyScanned: boolean };

/**
 * PDF metnini CİHAZDA çıkarır; her sayfa `<<<SAYFA n>>>` satırıyla başlar.
 * Sunucu, bulgunun sayfa numarasını bu işaretlerden hesaplar.
 */
export async function extractPdfTextPaged(file: File): Promise<PagedText> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const pageCount = doc.numPages;
  const pages = Math.min(pageCount, MAX_PAGES);
  let out = "";
  let plain = 0;
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => (typeof (it as { str?: unknown }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    plain += line.length;
    out += `<<<SAYFA ${i}>>>\n${line}\n\n`;
  }
  await doc.destroy();
  return { text: out.trim(), pageCount, likelyScanned: plain < Math.max(250, pages * 250) };
}

// ───────────── Belge üzerinde işaretleme ─────────────

const lower = (c: string) => c.toLocaleLowerCase("tr");
const normChar = (c: string) =>
  c === "“" || c === "”" || c === "„" ? '"' : c === "’" || c === "‘" ? "'" : c === "–" || c === "—" ? "-" : c;

function compactOf(text: string): string {
  let s = "";
  for (const c of text) if (!/\s/.test(c)) s += lower(normChar(c));
  return s;
}

type Item = { str: string; x: number; y: number; w: number; h: number };

/** Bir sayfanın metin öğelerini (PDF koordinatında) + boşluksuz birleşik dizgiyi çıkarır. */
async function pageItems(doc: pdfjsLib.PDFDocumentProxy, pageNo: number) {
  const page = await doc.getPage(pageNo);
  const content = await page.getTextContent();
  const items: Item[] = [];
  for (const it of content.items) {
    const t = it as { str?: string; transform?: number[]; width?: number; height?: number };
    if (typeof t.str !== "string" || !t.transform) continue;
    items.push({
      str: t.str,
      x: t.transform[4],
      y: t.transform[5],
      w: t.width ?? 0,
      h: t.height || Math.abs(t.transform[3]) || 10,
    });
  }
  // Boşluksuz dizgi + her karakterin hangi öğede/kaçıncı karakterde olduğu.
  let s = "";
  const owner: Array<{ item: number; ch: number }> = [];
  items.forEach((item, ii) => {
    let ci = 0;
    for (const c of item.str) {
      if (!/\s/.test(c)) {
        s += lower(normChar(c));
        owner.push({ item: ii, ch: ci });
      }
      ci++;
    }
  });
  return { items, s, owner, rotation: page.rotate };
}

type Rect = { x: number; y: number; w: number; h: number };

/** Alıntıyı sayfada bulur → vurgulanacak dikdörtgenler (öğe başına bir). */
function rectsForQuote(
  p: Awaited<ReturnType<typeof pageItems>>,
  quote: string,
): Rect[] | null {
  const q = compactOf(quote);
  if (q.length < 12) return null;
  let start = p.s.indexOf(q);
  let len = q.length;
  if (start < 0) {
    // Kısmi eşleşme: baştan ~60 karakter (sunucudaki "partial" ile aynı mantık).
    const head = q.slice(0, Math.min(60, Math.floor(q.length / 2)));
    if (head.length < 25) return null;
    const h = p.s.indexOf(head);
    if (h < 0) return null;
    start = h;
    const tail = q.slice(-head.length);
    const t = p.s.indexOf(tail, h);
    len = t >= 0 ? t + head.length - h : head.length;
  }
  const byItem = new Map<number, { from: number; to: number }>();
  for (let k = start; k < start + len; k++) {
    const o = p.owner[k];
    if (!o) continue;
    const cur = byItem.get(o.item);
    if (!cur) byItem.set(o.item, { from: o.ch, to: o.ch });
    else cur.to = o.ch;
  }
  const rects: Rect[] = [];
  for (const [ii, span] of byItem) {
    const it = p.items[ii];
    const n = Math.max(1, [...it.str].length);
    const x = it.x + (it.w * span.from) / n;
    const w = (it.w * (span.to - span.from + 1)) / n;
    if (w <= 0) continue;
    rects.push({ x, y: it.y - it.h * 0.22, w, h: it.h * 1.18 });
  }
  return rects.length ? rects : null;
}

const SEV_COLOR = SEVERITY_COLORS;
const SEV_LABEL: Record<Severity, string> = { kritik: "KRİTİK", yuksek: "YÜKSEK", orta: "ORTA", dusuk: "DÜŞÜK" };

/** PDF'in belge bilgisine, raporun imzalı kaydını (rapor içeriğiyle birlikte) gömer. */
export function embedProofRecord(doc: PDFDocument, report: ContractReport, proof: ContractProof): void {
  const json = JSON.stringify({ v: 1, proof, report });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  doc.setSubject("Sözleşme Denetçisi — doğrulanabilir rapor kaydı içerir"); // belge bilgisi sözlüğünü oluşturur
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  info.set(PDFName.of("NBContractReview"), PDFString.of(b64));
}

/** Hazır bir PDF baytına imzalı kaydı gömüp yeniden kaydeder (ör. rapor PDF'i). */
export async function embedProofInPdf(bytes: Uint8Array, report: ContractReport, proof: ContractProof): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  embedProofRecord(doc, report, proof);
  return doc.save(PDF_SAVE_OPTIONS);
}

/** Boyalı PDF'in sonuna eklenen "Denetim notları" sayfalarının metni (kenar kodlarıyla aynı sıra). */
export function buildNotesMarkdown(r: ContractReport, proof?: ContractProof): string {
  const L: string[] = [];
  L.push(`# Denetim notları${r.meta.mode === "quick" ? " — hızlı tarama" : ""}`);
  L.push("Bu sayfalar, belge sayfalarının kenarındaki kodlu notların tam açıklamalarıdır.");
  L.push(FINDING_CODE_LEGEND);
  L.push("");
  const codes = findingCodes(r.findings);
  r.findings.forEach((f: Finding, i: number) => {
    L.push(`## ${codes[i]} · [${SEV_LABEL[f.severity]}] ${f.title}`);
    L.push(`**Madde:** ${f.clause || "—"}${f.page ? ` · **Sayfa:** ${f.page}` : ""}`);
    L.push(`**Neden riskli:** ${f.whyRisky}`);
    if (f.impact) L.push(`**Sizin için etkisi:** ${f.impact}`);
    if (f.recommendation) L.push(`**Öneri:** ${f.recommendation}`);
    if (f.suggestedText) L.push(`**Önerilen madde metni:** ${f.suggestedText}`);
    L.push("");
  });
  if (proof) {
    L.push("---");
    L.push(proofFooter(proof));
    L.push(PROOF_NOTE);
  }
  return L.join("\n");
}

export type AnnotateResult = {
  bytes: Uint8Array;
  /** Belgede boyanan bulgu sayısı. */
  marked: number;
  /** Konumu bulunamayan (boyanamayan) bulgu sayısı. */
  skipped: number;
  /** Boyandığı hâlde kenar notu yer darlığından sığmayan bulgu sayısı (açıklaması son sayfalarda). */
  unplaced: number;
};

/** Sağa eklenen not şeridinin genişliği (pt). */
const MARGIN_W = 262;

function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * Orijinal PDF'in üzerine riskli maddeleri renkle boyar, sol kenara kod rozeti ekler ve her sayfanın
 * SAĞINA eklenen bir şeride, gömülü Roboto yazı tipiyle kodlu not kartları çizer. Kartlar sayfanın
 * parçasıdır (görüntüleyicinin not penceresine bağlı DEĞİL), bu yüzden Türkçe karakterler her
 * görüntüleyicide eksiksiz görünür. Orijinal metin/biçim bozulmaz; her şey cihazda yapılır.
 * Dosya sonuna tam açıklamalı "Denetim notları" sayfaları eklenir; `proof` verilirse imzalı kayıt gömülür.
 */
export async function annotateContractPdf(file: File, report: ContractReport, proof?: ContractProof): Promise<AnnotateResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const src = await pdfjsLib.getDocument({ data: buf.slice(), isEvalSupported: false }).promise;
  const pdf = await PDFDocument.load(buf);
  pdf.registerFontkit(fontkit);
  const fonts = await loadPdfFonts();
  const reg = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  let marked = 0;
  let skipped = 0;
  const cache = new Map<number, Awaited<ReturnType<typeof pageItems>>>();
  const get = async (n: number) => {
    let v = cache.get(n);
    if (!v) {
      v = await pageItems(src, n);
      cache.set(n, v);
    }
    return v;
  };

  type Card = { code: string; f: Finding; col: { r: number; g: number; b: number }; top: number; midY: number };
  const byPage = new Map<number, Card[]>();
  const badgePlaced = new Map<number, number[]>();

  const ordered: Finding[] = report.findings;
  const codes = findingCodes(ordered);
  for (let idx = 0; idx < ordered.length; idx++) {
    const f = ordered[idx];
    if (!f.quote) { skipped++; continue; }
    // Önce sunucunun bildirdiği sayfa; bulunamazsa tüm sayfalarda ara.
    const tryPages = f.page ? [f.page] : [];
    for (let n = 1; n <= Math.min(src.numPages, MAX_PAGES); n++) if (n !== f.page) tryPages.push(n);
    let hit: { page: number; rects: Rect[]; rotation: number } | null = null;
    for (const n of tryPages) {
      const p = await get(n);
      const rects = rectsForQuote(p, f.quote);
      if (rects) { hit = { page: n, rects, rotation: p.rotation }; break; }
    }
    if (!hit || (hit.rotation ?? 0) % 360 !== 0) { skipped++; continue; }

    const page = pdf.getPage(hit.page - 1);
    const col = SEV_COLOR[f.severity];
    for (const r of hit.rects) {
      page.drawRectangle({
        x: r.x, y: r.y, width: r.w, height: r.h,
        color: rgb(col.r, col.g, col.b),
        opacity: 0.38,
        blendMode: BlendMode.Multiply,
      });
    }
    // Sol kenar rozeti (kod): metnin üstüne binmesin diye sayfanın sol boşluğuna, satır ortasına.
    const first = hit.rects[0];
    const midY = first.y + first.h / 2;
    // Aynı satır/paragraf birden çok bulgu tarafından işaretlenebilir: rozetler üst üste binip biri
    // gizlenmesin diye yan yana dizilir (en fazla 3).
    const placedY = badgePlaced.get(hit.page) ?? [];
    const slot = Math.min(2, placedY.filter((y) => Math.abs(y - midY) < 17).length);
    placedY.push(midY);
    badgePlaced.set(hit.page, placedY);
    const badgeX = 14 + slot * 19;
    page.drawCircle({ x: badgeX, y: midY, size: 8.5, color: rgb(col.r, col.g, col.b), opacity: 0.95 });
    const tw = bold.widthOfTextAtSize(codes[idx], 6.5);
    page.drawText(codes[idx], { x: badgeX - tw / 2, y: midY - 2.3, size: 6.5, font: bold, color: rgb(1, 1, 1) });

    const list = byPage.get(hit.page) ?? [];
    list.push({ code: codes[idx], f, col, top: Math.max(...hit.rects.map((r) => r.y + r.h)), midY });
    byPage.set(hit.page, list);
    marked++;
  }

  // ── Her işaretli sayfanın sağına not şeridi: kartlar + kod açıklaması
  let unplaced = 0;
  const gray = rgb(0.32, 0.32, 0.36);
  const ink = rgb(0.1, 0.1, 0.13);
  for (const [pageNo, cards] of byPage) {
    const page = pdf.getPage(pageNo - 1);
    const mb = page.getMediaBox();
    const cb = page.getCropBox();
    const right = cb.x + cb.width;
    const newRight = right + MARGIN_W;
    page.setMediaBox(mb.x, mb.y, Math.max(mb.x + mb.width, newRight) - mb.x, mb.height);
    page.setCropBox(cb.x, cb.y, cb.width + MARGIN_W, cb.height);
    page.setBleedBox(cb.x, cb.y, cb.width + MARGIN_W, cb.height);
    page.setTrimBox(cb.x, cb.y, cb.width + MARGIN_W, cb.height);
    page.setArtBox(cb.x, cb.y, cb.width + MARGIN_W, cb.height);

    const cardX = right + 8;
    const cardW = MARGIN_W - 16;
    const topBound = cb.y + cb.height - 22;
    const bottomBound = cb.y + 46; // altta kod açıklaması için yer
    // Şerit başlığı
    page.drawText("SÖZLEŞME DENETÇİSİ", { x: cardX, y: cb.y + cb.height - 14, size: 6.8, font: bold, color: gray });
    if (proof) page.drawText(`Rapor No: ${proof.reportId}`, { x: cardX + 92, y: cb.y + cb.height - 14, size: 6.2, font: reg, color: gray });

    let cursor = topBound;
    for (const c of [...cards].sort((a, b) => b.top - a.top)) {
      const sevName = SEV_TR[c.f.severity];
      const textW = cardW - 16;
      const titleLines = wrapLines(c.f.title, bold, 7.4, textW);
      const why = c.f.whyRisky.replace(/^Notunuzla ilgili:\s*/i, "");
      const rec = c.f.recommendation ? `Öneri: ${c.f.recommendation}` : "";
      // Her kartın altında, tam metnin nerede olduğu AÇIKÇA yazılır (kullanıcı kesik metinle baş başa kalmaz).
      const pointer = `Tüm ayrıntı: dosya sonundaki “Denetim notları”, ${c.code}`;
      const pointerLines = wrapLines(pointer, reg, 6.4, textW);
      // Açıklamanın TAMAMI sığıyorsa tamamı yazılır; sığmazsa kademeli kısaltılır (en son yalnız başlık).
      const levels: Array<{ why: string; rec: string }> = [
        { why, rec },
        { why, rec: clip(rec, 260) },
        { why, rec: "" },
        { why: clip(why, 320), rec: "" },
        { why: clip(why, 170), rec: "" },
        { why: "", rec: "" },
      ];
      const top = Math.min(c.top + 4, cursor);
      let chosen: { whyLines: string[]; recLines: string[]; h: number } | null = null;
      for (const lv of levels) {
        const whyLines = lv.why ? wrapLines(lv.why, reg, 6.9, textW) : [];
        const recLines = lv.rec ? wrapLines(lv.rec, reg, 6.9, textW) : [];
        const h = 8 + 10 + titleLines.length * 9 + (whyLines.length ? 3 + whyLines.length * 8.4 : 0) + (recLines.length ? 3 + recLines.length * 8.4 : 0) + 3 + pointerLines.length * 7.6 + 6;
        if (top - h >= bottomBound) { chosen = { whyLines, recLines, h }; break; }
      }
      if (!chosen) { unplaced++; continue; }
      const { whyLines, recLines, h } = chosen;
      const bottom = top - h;
      page.drawRectangle({ x: cardX, y: bottom, width: cardW, height: h, color: rgb(0.985, 0.985, 0.99), borderColor: rgb(0.82, 0.82, 0.86), borderWidth: 0.5 });
      page.drawRectangle({ x: cardX, y: bottom, width: 3.2, height: h, color: rgb(c.col.r, c.col.g, c.col.b) });
      page.drawText(`${c.code} · ${sevName}`, { x: cardX + 9, y: top - 11, size: 7.6, font: bold, color: rgb(c.col.r * 0.72, c.col.g * 0.72, c.col.b * 0.72) });
      let ty = top - 11 - 10;
      for (const l of titleLines) { page.drawText(l, { x: cardX + 9, y: ty, size: 7.4, font: bold, color: ink }); ty -= 9; }
      if (whyLines.length) {
        ty -= 2;
        for (const l of whyLines) { page.drawText(l, { x: cardX + 9, y: ty, size: 6.9, font: reg, color: gray }); ty -= 8.4; }
      }
      if (recLines.length) {
        ty -= 2;
        for (const l of recLines) { page.drawText(l, { x: cardX + 9, y: ty, size: 6.9, font: reg, color: ink }); ty -= 8.4; }
      }
      ty -= 1;
      for (const l of pointerLines) { page.drawText(l, { x: cardX + 9, y: ty, size: 6.4, font: reg, color: rgb(0.45, 0.45, 0.5) }); ty -= 7.6; }
      // Bağlantı çizgisi: vurgulanan satırdan karta
      page.drawLine({ start: { x: right - 4, y: c.midY }, end: { x: cardX, y: top - 8 }, thickness: 0.6, color: rgb(c.col.r, c.col.g, c.col.b), opacity: 0.55 });
      cursor = bottom - 5;
    }

    // Kod açıklaması (K = Kritik …) — her not şeridinin altında
    page.drawText("Kodlar", { x: cardX, y: bottomBound - 14, size: 6.8, font: bold, color: gray });
    const legend: Array<[Severity, string]> = [["kritik", "K = Kritik"], ["yuksek", "Y = Yüksek"], ["orta", "O = Orta"], ["dusuk", "D = Düşük"]];
    legend.forEach(([sev, label], i) => {
      const lx = cardX + (i % 2) * 96;
      const ly = bottomBound - 26 - Math.floor(i / 2) * 11;
      const c = SEV_COLOR[sev];
      page.drawRectangle({ x: lx, y: ly - 1, width: 7, height: 7, color: rgb(c.r, c.g, c.b) });
      page.drawText(label, { x: lx + 10, y: ly, size: 7, font: reg, color: ink });
    });
  }

  // Kodlu notların TAM açıklamaları: dosya sonunda (kart sığmayan bulgular da burada).
  if (marked > 0) {
    const notes = await PDFDocument.load(await contractReportToPdf(report, "", proof, { notesOnly: true }));
    const copied = await pdf.copyPages(notes, notes.getPageIndices());
    copied.forEach((p) => pdf.addPage(p));
  }
  if (proof) embedProofRecord(pdf, report, proof);
  pdf.catalog.set(PDFName.of("PageMode"), PDFName.of("UseNone"));
  await src.destroy();
  return { bytes: await pdf.save(PDF_SAVE_OPTIONS), marked, skipped, unplaced };
}

// ───────────── Raporu metne/PDF'e dökme ─────────────

const SEV_TR: Record<Severity, string> = { kritik: "Kritik", yuksek: "Yüksek", orta: "Orta", dusuk: "Düşük" };
const LEGAL_TR: Record<string, string> = {
  mevzuata_aykiri: "Mevzuata aykırı olabilir",
  dayanak_var: "Mevzuatta dayanağı var",
  dogrulanamadi: "Mevzuat kontrolü doğrulanamadı",
  ilgisiz: "Mevzuatla doğrudan ilgili değil",
};

/** Raporu markdown'a çevirir (PDF çıktısı ve "kopyala" için). */
export function contractReportToMarkdown(r: ContractReport, fileName: string, proof?: ContractProof): string {
  const L: string[] = [];
  L.push(`# Sözleşme Denetim Raporu`);
  L.push(`**Belge:** ${fileName} · **Tür:** ${r.meta.docType} · **Sayfa:** ${r.meta.pageCount}`);
  if (r.meta.parties.length) L.push(`**Taraflar:** ${r.meta.parties.join(" · ")}`);
  L.push(`**Genel risk:** ${SEV_TR[r.riskLevel]} — ${r.headline}`);
  if (r.meta.mode === "quick") {
    L.push("**Rapor türü:** HIZLI TARAMA — tek geçişte en önemli riskler bulunur. Güncel mevzuat kontrolü, önerilen madde metinleri, notlarınıza tek tek yanıt ve müzakere öncelikleri bu raporda YOKTUR; bunlar için detaylı denetim gerekir.");
  } else {
    L.push("**Rapor türü:** Detaylı denetim");
  }
  L.push("");
  L.push("## Özet");
  L.push(r.summary);
  if (r.concernResponses && r.concernResponses.length) {
    L.push("");
    L.push("## Notlarınıza yanıt");
    r.concernResponses.forEach((c) => L.push(`- **“${c.note}”** — ${c.response}`));
  }
  if (r.priorities.length) {
    L.push("");
    L.push("## Müzakerede ilk kapatılacaklar");
    r.priorities.forEach((p, i) => L.push(`- **${i + 1}. ${p.title}** — ${p.why}`));
  }
  if (r.findings.length) {
    L.push("");
    L.push("## Bulgular");
    L.push(FINDING_CODE_LEGEND);
    L.push("");
    const mdCodes = findingCodes(r.findings);
    r.findings.forEach((f, i) => {
      L.push(`### ${mdCodes[i]} · [${SEV_TR[f.severity]}] ${f.title}`);
      L.push(`**Madde:** ${f.clause || "—"}${f.page ? ` · **Sayfa:** ${f.page}` : ""}`);
      if (f.quote) L.push(`**Belgede:** “${f.quote}”`);
      L.push(`**Neden riskli:** ${f.whyRisky}`);
      if (f.impact) L.push(`**Sizin için etkisi:** ${f.impact}`);
      L.push(`**Öneri:** ${f.recommendation}`);
      if (f.suggestedText) L.push(`**Önerilen madde metni:** ${f.suggestedText}`);
      if (f.legalReferences.length) {
        f.legalReferences.forEach((ref) =>
          L.push(`- **${LEGAL_TR[f.legalStatus] ?? ""}:** ${ref.law} ${ref.article} — ${ref.note}${ref.sourceUrl ? ` (${ref.sourceUrl})` : ""}`),
        );
      } else {
        L.push(`**Mevzuat:** ${LEGAL_TR[f.legalStatus] ?? ""}`);
      }
      L.push("");
    });
  }
  if (r.missingClauses.length) {
    L.push("## Sözleşmede olmayan ama olması gereken maddeler");
    r.missingClauses.forEach((m) => {
      L.push(`- **${m.title}** — ${m.why}`);
      if (m.suggestedText) L.push(`  Önerilen metin: ${m.suggestedText}`);
    });
    L.push("");
  }
  if (r.questionsForUser.length) {
    L.push("## Sizin cevaplamanız gerekenler");
    r.questionsForUser.forEach((q) => L.push(`- ${q}`));
    L.push("");
  }
  if (r.assumptions.length) {
    L.push("## Varsayımlar ve sınırlar");
    r.assumptions.forEach((a) => L.push(`- ${a}`));
    L.push("");
  }
  L.push("## Mevzuat kontrolü");
  L.push(r.meta.lawCheck.note);
  r.meta.lawCheck.sources.slice(0, 15).forEach((s) => L.push(`- ${s.title} — ${s.url}`));
  L.push("");
  L.push("---");
  L.push("Bu rapor yapay zekâ destekli bir ön değerlendirmedir; hukuki danışmanlık yerine geçmez. İmzadan önce bir avukata danışmanız önerilir.");
  if (proof) {
    L.push("");
    L.push(proofFooter(proof));
    L.push(PROOF_NOTE);
  }
  return L.join("\n");
}
