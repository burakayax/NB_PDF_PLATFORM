import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  Languages,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  UploadCloud,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { extractPdfText } from "../../lib/pdfText";
import { ocrPdfToText } from "../../lib/ocr";
import { summaryToPdf, pdfBytesToBlob } from "../../lib/summaryPdf";
import { analyzePdf, editPdfText, type PdfTextEdit, type PdfFontKey } from "../../api";
import {
  aiSummarize,
  aiChat,
  aiExtract,
  aiTranslateSegments,
  fetchAiQuota,
  TRANSLATE_TARGETS,
  type AiError,
  type AiQuota,
  type ChatTurn,
  type ExtractedData,
} from "../../api/ai";
import { SimpleMarkdown } from "../common/SimpleMarkdown";
import { TopUpModal } from "./TopUpModal";

type AiMode = "summarize" | "chat" | "extract" | "translate";

/**
 * Dosyayı kaydeder. Destekleyen tarayıcılarda (Chrome/Edge) kaydetme konumunu
 * SORAR (File System Access API); diğerlerinde klasik indirmeye düşer. Kullanıcı
 * iptal ederse sessizce çıkar. showSaveFilePicker, ilk await olduğu için
 * kullanıcı hareketi (tık) bağlamı korunur.
 */
async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  acceptType?: { description: string; accept: Record<string, string[]> },
): Promise<void> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  }).showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName,
        types: acceptType ? [acceptType] : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      // Kullanıcı iptal etti → hiçbir şey yapma. Diğer hatada klasik indirmeye düş.
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

type Props = {
  mode: AiMode;
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
  /** Ödemeler kapalıyken: yükleme yerine şık "Yakında" durumu göster. */
  comingSoon?: boolean;
  /** Admin → top-up penceresinde test için kredi ekleyebilir. */
  isAdmin?: boolean;
  /** Araçlar arası aktarım — dışarıdan (Taramalarım) gelen PDF'i otomatik yükle. */
  initialFile?: File | null;
};

/** Şık ilerleme şeridi — `ratio` verilirse yüzdeli (OCR), null ise kayan/indeterminate (özet). */
function StatusStrip({ label, ratio }: { label: string; ratio: number | null }) {
  return (
    <div className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-500/[0.07] to-violet-500/[0.05] px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-fuchsia-200">
          <Sparkles className="h-4 w-4 animate-pulse" />
          {label}
        </span>
        {ratio !== null ? (
          <span className="text-[12px] font-bold tabular-nums text-slate-300">%{Math.round(ratio * 100)}</span>
        ) : null}
      </div>
      {ratio !== null ? (
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400 transition-all duration-300"
            style={{ width: `${Math.max(4, Math.round(ratio * 100))}%` }}
          />
        </div>
      ) : (
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400"
            style={{ animation: "nb-indeterminate 1.15s ease-in-out infinite" }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * AI aracı (Pro/Business): PDF metni CİHAZDA çıkarılır (pdf.js), yalnız metin
 * sunucuya gider → Claude. Özetle veya belgeyle Sohbet. 401→giriş, 403→yükselt.
 */
export function AiPdfTool({ mode, language, accessToken, onLogin, onUpgrade, comingSoon, isAdmin, initialFile }: Props) {
  const tr = language === "tr";
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [docText, setDocText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<null | "login" | "upgrade">(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Taranmış PDF → cihazda sessiz hazırlama (OCR) ilerlemesi
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Özet
  const [summary, setSummary] = useState("");
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [translatedBlob, setTranslatedBlob] = useState<Blob | null>(null);
  const [targetLang, setTargetLang] = useState(language === "tr" ? "en" : "tr");
  // Sohbet
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  // Aylık AI kotası (kalan hak göstergesi)
  const [quota, setQuota] = useState<AiQuota | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let alive = true;
    void fetchAiQuota(accessToken).then((q) => {
      if (alive) setQuota(q);
    });
    return () => {
      alive = false;
    };
  }, [accessToken]);

  const charCount = docText.length;
  const readTime = Math.max(1, Math.round(charCount / 1000));

  function handleAiError(e: unknown) {
    const err = e as AiError;
    if (err?.status === 401) {
      setGate("login");
      setError(tr ? "Bu özellik için giriş yapmalısın." : "Please log in to use this.");
    } else if (err?.status === 403 || err?.code === "pro_required") {
      setGate("upgrade");
      setError(
        tr
          ? "Yapay zekâ özellikleri Pro ve Business planlarına özeldir."
          : "AI features are exclusive to Pro and Business plans.",
      );
    } else if (err?.status === 429 || err?.code === "quota_exceeded") {
      if (err.quota) setQuota(err.quota);
      setError(
        tr
          ? "Bu ayki yapay zekâ kotan doldu — ay başında otomatik yenilenir."
          : "Your monthly AI quota is used up — it resets at the start of the month.",
      );
    } else if (err?.status === 503) {
      setError(tr ? "AI şu an kullanılamıyor." : "AI is currently unavailable.");
    } else {
      setError(err?.message || (tr ? "Bir hata oluştu." : "Something went wrong."));
    }
  }

  // Araçlar arası aktarım: dışarıdan gelen PDF'i bir kez yükle (mod değişse de tekrar etmez).
  const loadedInitialRef = useRef<File | null>(null);
  useEffect(() => {
    if (initialFile && loadedInitialRef.current !== initialFile) {
      loadedInitialRef.current = initialFile;
      void pickFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function pickFile(f: File | undefined) {
    setError(null);
    setGate(null);
    setSummary("");
    setExtracted(null);
    setTranslatedBlob(null);
    setMessages([]);
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF.");
      return;
    }
    setPdfFile(f);
    try {
      setBusy(true);
      const { text, likelyScanned } = await extractPdfText(f);
      if (likelyScanned) {
        // Metin çıkmadı (taranmış/görüntü) → cihazda SESSİZCE hazırla. Kullanıcıya
        // teknik detay (OCR) gösterme; sadece "hazırlanıyor" şeridi.
        setBusy(false);
        await prepareScanned(f);
        return;
      }
      setFileName(f.name);
      setDocText(text);
    } catch {
      setError(tr ? "PDF okunamadı." : "Could not read the PDF.");
    } finally {
      setBusy(false);
    }
  }

  // Taranmış belgeyi cihazda metne çevirir (arka planda; kullanıcıya "OCR" denmez).
  async function prepareScanned(f: File) {
    setError(null);
    try {
      setOcrProgress(0);
      const text = await ocrPdfToText(f, (p) => setOcrProgress(p.ratio));
      if (text.trim().length < 20) {
        setError(
          tr
            ? "Bu belgeden metin okunamadı — çok düşük çözünürlüklü olabilir."
            : "Couldn't read text from this document — it may be very low resolution.",
        );
        return;
      }
      setFileName(f.name);
      setDocText(text);
    } catch {
      setError(tr ? "Belge hazırlanırken bir sorun oluştu." : "Something went wrong preparing the document.");
    } finally {
      setOcrProgress(null);
    }
  }

  async function runSummarize() {
    setError(null);
    setGate(null);
    try {
      setBusy(true);
      const { summary: s, quota: q } = await aiSummarize(docText, tr ? "tr" : "en", accessToken);
      setSummary(s);
      if (q) setQuota(q);
    } catch (e) {
      handleAiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function runExtract() {
    setError(null);
    setGate(null);
    try {
      setBusy(true);
      const { data, quota: q } = await aiExtract(docText, tr ? "tr" : "en", accessToken);
      setExtracted(data);
      if (q) setQuota(q);
    } catch (e) {
      handleAiError(e);
    } finally {
      setBusy(false);
    }
  }

  // Konum-koruyan çeviri: PDF'i analiz et → her metin öğesini yerinde çevir →
  // orijinal düzeni bozmadan (aynı bbox) yeni metni yaz. Sonuç = birebir PDF,
  // yalnız yazılar hedef dilde. Düz-metin döküm yerine gerçek çeviri.
  async function runTranslate() {
    setError(null);
    setGate(null);
    if (!pdfFile) return;
    try {
      setBusy(true);
      setTranslatedBlob(null);
      const analysis = await analyzePdf(pdfFile, accessToken ?? null);
      // KONUM + STİL KORUYAN ÇEVİRİ. analyze metni SPAN bazında çıkarır; parça/satır bazında
      // çevirmek Claude'u parçaları birleştirmeye/yeniden dağıtmaya zorlar (sayı tutmaz →
      // orijinale düşer, hizalama kayar). Çözüm: span'ları BLOK (paragraf) bazında topla, blok
      // içinde ardışık AYNI stildeki (kalın+renk) span'ları "run"a birleştir → run metinlerini
      // indeksli protokolle çevir (kayma/eksik yok), her bloğu KALIN/RENK/HİZALAMA taşıyan HTML
      // olarak orijinal bbox'a yeniden akıt (backend insert_htmlbox) → orijinal düzen korunur.
      type Run = { text: string; bold: boolean; color?: string; lead: boolean };
      type Block = { page: number; bbox: [number, number, number, number]; size: number; font?: PdfFontKey; align: "left" | "center" | "justify"; lineIds: Set<string>; runs: Run[] };
      const normColor = (c?: string): string | undefined => {
        if (!c) return undefined;
        const v = c.toLowerCase();
        return v === "#000000" || v === "#000" ? undefined : v; // siyah = varsayılan, stil yok
      };
      const blocks: Block[] = [];
      const byBlock = new Map<string, number>();
      const st = new Map<number, { lastX1: number; lastLine?: string }>(); // boşluk kararı için
      analysis.pages.forEach((pg, pi) => {
        pg.elements.forEach((el, ei) => {
          if (el.type !== "text") return;
          const raw = el.text ?? "";
          if (!raw.trim()) return;
          const blockKey = el.line ? el.line.split(":").slice(0, 2).join(":") : `solo:${pi}:${ei}`;
          const bold = !!el.bold;
          const color = normColor(el.color);
          const idx = byBlock.get(blockKey);
          if (idx === undefined) {
            byBlock.set(blockKey, blocks.length);
            st.set(blocks.length, { lastX1: el.bbox[2], lastLine: el.line });
            blocks.push({ page: pi, bbox: [...el.bbox] as [number, number, number, number], size: el.size ?? 12, font: el.font, align: "left", lineIds: new Set(el.line ? [el.line] : []), runs: [{ text: raw, bold, color, lead: false }] });
            return;
          }
          const b = blocks[idx];
          const s = st.get(idx)!;
          // Boşluk gerekli mi? Yeni satıra geçiş VEYA yatay boşluk (x-gap) → kelimeler birleşmesin.
          const newLine = !!(el.line && s.lastLine && el.line !== s.lastLine);
          const xgap = el.bbox[0] - s.lastX1 > (el.size ?? 12) * 0.22;
          const sep = newLine || xgap;
          const last = b.runs[b.runs.length - 1];
          if (last.bold === bold && (last.color ?? "") === (color ?? "")) {
            last.text += sep && !last.text.endsWith(" ") && !raw.startsWith(" ") ? " " + raw : raw;
          } else {
            // Stil değişti → yeni run. Boşluk çeviriye GİRMESİN (Claude trim'ler) → lead bayrağı.
            b.runs.push({ text: raw, bold, color, lead: sep });
          }
          b.bbox = [Math.min(b.bbox[0], el.bbox[0]), Math.min(b.bbox[1], el.bbox[1]), Math.max(b.bbox[2], el.bbox[2]), Math.max(b.bbox[3], el.bbox[3])];
          if (el.line) b.lineIds.add(el.line);
          s.lastX1 = el.bbox[2];
          s.lastLine = el.line;
        });
      });
      if (blocks.length === 0) {
        setError(tr ? "Bu PDF'te çevrilecek metin katmanı yok (taranmış olabilir)." : "No translatable text layer in this PDF (it may be scanned).");
        return;
      }
      // Hizalama: ortalı başlık (dar+sayfa-merkezli tek satır) / justify (çok satır) / left.
      blocks.forEach((b) => {
        const pw = analysis.pages[b.page]?.width || 595;
        const cx = (b.bbox[0] + b.bbox[2]) / 2;
        const w = b.bbox[2] - b.bbox[0];
        const multi = b.lineIds.size > 1;
        if (!multi && Math.abs(cx - pw / 2) < pw * 0.12 && w < pw * 0.7) b.align = "center";
        else b.align = multi ? "justify" : "left";
      });
      // Tüm run'ları düz listeye al → indeksli protokolle çevir.
      const flat: Array<{ b: number; r: number }> = [];
      const texts: string[] = [];
      blocks.forEach((b, bi) => b.runs.forEach((r, ri) => { flat.push({ b: bi, r: ri }); texts.push(r.text); }));
      const { translations, quota: q } = await aiTranslateSegments(texts, targetLang, accessToken ?? null);
      if (q) setQuota(q);
      // Her bloğu stil taşıyan HTML'e çevir.
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const cssFont = (f?: PdfFontKey) => (f === "serif" || f === "merriweather" ? "serif" : f === "mono" ? "monospace" : "sans-serif");
      // PyMuPDF bir paragraf + sonraki başlığı / bir listenin tüm maddelerini TEK blok sayabilir
      // → düz sarma bunları yan yana bindiriyordu. Çevrilmiş metinde YAPISAL İŞARETÇİ (a) b) …,
      // LOT-N:, Madde/Article N-) ile başlayan run'ların önüne <br> koyarak orijinal satır/liste
      // yapısını geri getir (başlığa çift <br> = boş satır).
      // Run BAŞINDA işaretçi → run'lar arası satır kırma (başlığa çift = boş satır).
      const brFor = (s: string): string => {
        const m = s.trimStart();
        if (/^(article|madde|section|bölüm|bolum)\s*[0-9ivx]+\s*[-.:]/i.test(m)) return "<br><br>";
        if (/^(lot)[-\s]?\d/i.test(m)) return "<br>";
        if (/^[a-zçğıöşü]\)\s/i.test(m)) return "<br>";
        return "";
      };
      // Run ORTASINDA işaretçi (ör. "…Procurement d) Place…", "…LOT-1:… LOT-2:…") → orada da
      // kır. İşaretçiden önceki boşluğu <br> ile değiştir; metni escape edip parçaları birleştir.
      const markerMid = /(?<=\S)[ \t]+(?=(?:LOT[-\s]?\d|[a-zçğıöşü]\)[ \t]|(?:article|madde|section|bölüm|bolum)\s*[0-9ivx]+[ \t]*[-.:]))/gi;
      const runInner = (t: string): string => t.split(markerMid).map(esc).join("<br>");
      const htmlByBlock = blocks.map(() => "");
      flat.forEach((f, i) => {
        const r = blocks[f.b].runs[f.r];
        const trText = translations[i] ?? r.text;
        let x = runInner(trText);
        if (r.color) x = `<span style="color:${r.color}">${x}</span>`;
        if (r.bold) x = `<b>${x}</b>`;
        const cur = htmlByBlock[f.b];
        const br = f.r > 0 ? brFor(trText) : ""; // blok ilk run'ında satır kırma yok
        const sep = !br && r.lead && cur.length > 0 && !cur.endsWith(" ") ? " " : "";
        htmlByBlock[f.b] = cur + br + sep + x;
      });
      const ops: PdfTextEdit[] = blocks.map((b, bi) => ({
        page: b.page,
        bbox: b.bbox,
        html: `<div style="font-family:${cssFont(b.font)};font-size:${b.size.toFixed(1)}px;text-align:${b.align};line-height:1.15;margin:0">${htmlByBlock[bi]}</div>`,
        bg: "#ffffff",
      }));
      const blob = await editPdfText(pdfFile, ops, accessToken ?? null);
      setTranslatedBlob(blob);
    } catch (e) {
      handleAiError(e);
    } finally {
      setBusy(false);
    }
  }

  async function downloadTranslation() {
    if (!translatedBlob || exporting) return;
    try {
      setExporting(true);
      const langName = TRANSLATE_TARGETS.find((l) => l.code === targetLang);
      await saveBlobWithPicker(
        translatedBlob,
        `${(fileName || "ceviri").replace(/\.pdf$/i, "")}-${langName?.en?.toLowerCase() ?? targetLang}.pdf`,
        { description: "PDF", accept: { "application/pdf": [".pdf"] } },
      );
    } catch {
      /* kullanıcı iptal etti */
    } finally {
      setExporting(false);
    }
  }

  function openTranslation() {
    if (!translatedBlob) return;
    const url = URL.createObjectURL(translatedBlob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function shareTranslation() {
    if (!translatedBlob) return;
    const langName = TRANSLATE_TARGETS.find((l) => l.code === targetLang);
    const name = `${(fileName || "ceviri").replace(/\.pdf$/i, "")}-${langName?.en?.toLowerCase() ?? targetLang}.pdf`;
    const f = new File([translatedBlob], name, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d?: unknown) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [f] })) {
      try { await nav.share({ files: [f], title: name }); return; } catch { /* iptal */ }
    }
    void downloadTranslation();
  }

  function copyExtracted() {
    if (!extracted) return;
    void navigator.clipboard?.writeText(JSON.stringify(extracted, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  async function downloadExtractedCsv() {
    if (!extracted) return;
    // Türkçe Excel liste ayracı olarak NOKTALI VİRGÜL bekler; virgül kullanınca
    // tüm satır tek hücrede kalıyordu. `;` + UTF-8 BOM ile Excel otomatik olarak
    // düzgün sütunlara böler ve Türkçe karakterler bozulmaz.
    const SEP = ";";
    const esc = (s: unknown) => {
      const v = String(s ?? "");
      return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const lines: string[] = [];
    if (extracted.fields.length) {
      lines.push(`${esc(tr ? "Alan" : "Field")}${SEP}${esc(tr ? "Değer" : "Value")}`);
      for (const f of extracted.fields) lines.push(`${esc(f.label)}${SEP}${esc(f.value)}`);
      lines.push("");
    }
    for (const t of extracted.tables) {
      if (t.title) lines.push(esc(t.title));
      lines.push(t.columns.map(esc).join(SEP));
      for (const r of t.rows) lines.push(r.map(esc).join(SEP));
      lines.push("");
    }
    const content = "﻿" + lines.join("\r\n");
    const suggestedName = `${(fileName || "veri").replace(/\.pdf$/i, "")}-veri.csv`;
    await saveBlobWithPicker(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
      suggestedName,
      { description: "CSV (Excel)", accept: { "text/csv": [".csv"] } },
    );
  }

  async function sendQuestion() {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setGate(null);
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion("");
    try {
      setBusy(true);
      const { answer, quota: newQuota } = await aiChat(docText, q, history, tr ? "tr" : "en", accessToken);
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
      if (newQuota) setQuota(newQuota);
    } catch (e) {
      handleAiError(e);
      setMessages((m) => m.slice(0, -1));
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  }

  function copySummary() {
    void navigator.clipboard?.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const pdfBaseName = `${(fileName || "ozet").replace(/\.pdf$/i, "")}-ozet`;
  const pdfTitle = fileName
    ? `${fileName.replace(/\.pdf$/i, "")} — ${tr ? "Özet" : "Summary"}`
    : tr ? "PDF Özeti" : "PDF Summary";

  async function downloadSummary() {
    if (exporting) return;
    try {
      setExporting(true);
      const blob = pdfBytesToBlob(await summaryToPdf(summary, pdfTitle));
      await saveBlobWithPicker(blob, `${pdfBaseName}.pdf`, {
        description: "PDF",
        accept: { "application/pdf": [".pdf"] },
      });
    } catch {
      setError(tr ? "PDF oluşturulamadı." : "Couldn't create the PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function shareSummary() {
    if (exporting) return;
    try {
      setExporting(true);
      const blob = pdfBytesToBlob(await summaryToPdf(summary, pdfTitle));
      const file = new File([blob], `${pdfBaseName}.pdf`, { type: "application/pdf" });
      const nav = navigator as Navigator & {
        canShare?: (data?: unknown) => boolean;
      };
      if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: pdfTitle });
          return;
        } catch {
          /* kullanıcı iptal etti → dosyayı indir */
        }
      }
      // Paylaşım (dosya) desteklenmiyorsa PDF'i indir — konumu sorar, değilse klasik indirme.
      await saveBlobWithPicker(blob, file.name, {
        description: "PDF",
        accept: { "application/pdf": [".pdf"] },
      });
    } catch {
      setError(tr ? "PDF paylaşılamadı." : "Couldn't share the PDF.");
    } finally {
      setExporting(false);
    }
  }

  function reset() {
    setFileName(null);
    setPdfFile(null);
    setDocText("");
    setSummary("");
    setExtracted(null);
    setTranslatedBlob(null);
    setMessages([]);
    setError(null);
    setGate(null);
    setOcrProgress(null);
  }

  const title =
    mode === "summarize"
      ? tr ? "PDF Özetle" : "Summarize PDF"
      : mode === "extract"
        ? tr ? "PDF Veri Çıkar" : "Extract PDF Data"
        : mode === "translate"
          ? tr ? "PDF Çevir" : "Translate PDF"
          : tr ? "PDF ile Sohbet" : "Chat with PDF";
  const subtitle =
    mode === "summarize"
      ? tr ? "PDF'inizi baştan sona okumadan; başlık, ana konular ve önemli noktalarıyla profesyonel bir özete çevirir." : "Turns your PDF into a professional summary — title, key topics and key points — without reading it end to end."
      : mode === "extract"
        ? tr ? "Fatura, ihale, sözleşme ya da tablodaki bilgileri otomatik olarak yapılandırılmış veriye çevirir — alanlar + kalemler, tabloya dök, CSV indir." : "Turns invoices, tenders, contracts or tables into structured data — fields + line items, view as a table, export CSV."
        : mode === "translate"
          ? tr ? "PDF'inizi seçtiğiniz dile çevirir — anlam, ton ve yapı korunur; sonucu PDF olarak indirin." : "Translates your PDF into the language you choose — meaning, tone and structure preserved; download as PDF."
          : tr ? "PDF'inize doğal dille soru sorun; yapay zekâ yalnızca belgedeki bilgiye dayanarak anında yanıtlar." : "Ask your PDF questions in plain language; the AI answers instantly, based only on the document.";

  const benefits: { icon: LucideIcon; title: string; desc: string }[] =
    mode === "summarize"
      ? [
          { icon: Zap, title: tr ? "Saniyeler içinde kavra" : "Grasp it in seconds", desc: tr ? "Uzun raporu, sözleşmeyi ya da makaleyi baştan sona okumadan ana fikri al." : "Get the gist of a long report, contract or article without reading it all." },
          { icon: ListChecks, title: tr ? "Yapılandırılmış özet" : "Structured output", desc: tr ? "Başlık, ana konular, önemli noktalar ve sonuç — düzenli ve profesyonel." : "Title, key topics, key points and conclusion — clean and professional." },
          { icon: ShieldCheck, title: tr ? "Gizli & güvenli" : "Private & secure", desc: tr ? "Belgen cihazından çıkmaz; yalnızca metni yapay zekâya gönderilir." : "Your file stays on device; only its text is sent to the AI." },
        ]
      : mode === "extract"
      ? [
          { icon: Table2, title: tr ? "Alanlar + kalemler" : "Fields + line items", desc: tr ? "Fatura no, tarih, taraflar, toplam, KDV ve satır kalemlerini otomatik ayıklar." : "Auto-extracts invoice no, date, parties, total, VAT and line items." },
          { icon: Download, title: tr ? "CSV / JSON dışa aktar" : "Export CSV / JSON", desc: tr ? "Çıkan veriyi Excel'e ya da sistemine tek tıkla aktar." : "Push the extracted data to Excel or your system in one click." },
          { icon: ShieldCheck, title: tr ? "Yalnızca belgeden" : "Only from the document", desc: tr ? "Yalnızca belgedeki bilgi kullanılır — uydurma yok; dosya cihazından çıkmaz." : "Uses only what's in the document — no made-up data; file stays on device." },
        ]
      : mode === "translate"
      ? [
          { icon: Languages, title: tr ? "12+ dil" : "12+ languages", desc: tr ? "İngilizce, Almanca, Fransızca, Arapça ve daha fazlasına anında çevir." : "Instantly translate to English, German, French, Arabic and more." },
          { icon: ListChecks, title: tr ? "Yapı korunur" : "Structure preserved", desc: tr ? "Başlık, liste ve tablolar korunarak çevrilir — dağılmaz." : "Headings, lists and tables are kept intact — no mess." },
          { icon: Download, title: tr ? "PDF olarak indir" : "Download as PDF", desc: tr ? "Çeviriyi tek tıkla düzgün bir PDF olarak al." : "Get the translation as a clean PDF in one click." },
        ]
      : [
          { icon: MessageSquare, title: tr ? "Doğal dille sor" : "Ask naturally", desc: tr ? "Belgene istediğin soruyu sor, sohbet eder gibi anında yanıt al." : "Ask any question and get an instant, conversational answer." },
          { icon: Target, title: tr ? "Yalnızca belgeye dayalı" : "Grounded answers", desc: tr ? "Yanıtlar yalnızca belgedeki bilgiden gelir — uydurma yok." : "Answers come only from the document — no made-up facts." },
          { icon: Clock, title: tr ? "Zamandan kazan" : "Save time", desc: tr ? "Uzun belgeleri baştan sona okumadan aradığın cevabı bul." : "Find what you need without reading the whole document." },
        ];

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      {/* ── Premium başlık ── */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]">
          <Sparkles className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
            <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
              Pro
            </span>
            {quota ? (
              <span
                title={tr ? "Bu ayki AI hakkın" : "Your monthly AI allowance"}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  !quota.unlimited && (quota.remaining ?? 0) <= 0
                    ? "border-red-400/35 bg-red-500/10 text-red-300"
                    : "border-white/10 bg-white/[0.04] text-slate-300"
                }`}
              >
                {quota.unlimited
                  ? tr ? "Sınırsız" : "Unlimited"
                  : tr
                    ? `Bu ay: ${quota.remaining}/${quota.limit}${quota.bonus ? ` (+${quota.bonus})` : ""}`
                    : `This month: ${quota.remaining}/${quota.limit}${quota.bonus ? ` (+${quota.bonus})` : ""}`}
              </span>
            ) : null}
            {quota && !quota.unlimited ? (
              <button type="button" onClick={() => setTopUpOpen(true)} title={tr ? "Ek AI kredisi al" : "Get extra AI credits"}
                className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20">
                + {tr ? "Kredi" : "Credits"}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>

      {/* ── Yakında (ödemeler kapalıyken): yükleme yerine şık bekleme durumu ── */}
      {comingSoon ? (
        <div className="overflow-hidden rounded-3xl border-2 border-dashed border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-8 text-center sm:p-12">
          <div className="relative">
            <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <span className="relative inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide text-fuchsia-200">
              <Sparkles className="h-3.5 w-3.5" />{tr ? "Çok Yakında" : "Coming Soon"}
            </span>
            <div className="relative mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200 ring-1 ring-white/10">
              <Sparkles className="h-9 w-9" />
            </div>
            <p className="relative mt-5 text-xl font-black text-white">{title}</p>
            <p className="relative mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-300">
              {mode === "summarize"
                ? tr ? "Uzun belgeleri saniyeler içinde özetleyen yapay zekâ çok yakında açılıyor. Hazırlıkların son aşamasındayız." : "AI that summarizes long documents in seconds is coming very soon. We're putting on the finishing touches."
                : mode === "extract"
                ? tr ? "Fatura, ihale ve tablolardan yapılandırılmış veri çıkaran yapay zekâ çok yakında açılıyor. Hazırlıkların son aşamasındayız." : "AI that extracts structured data from invoices, tenders and tables is coming very soon. We're putting on the finishing touches."
                : mode === "translate"
                ? tr ? "PDF'inizi anlamı ve yapısı korunarak istediğiniz dile çeviren yapay zekâ çok yakında açılıyor. Hazırlıkların son aşamasındayız." : "AI that translates your PDF into any language while preserving meaning and structure is coming very soon. We're putting on the finishing touches."
                : tr ? "Belgelerinle sohbet edip anında cevap alacağın yapay zekâ çok yakında açılıyor. Hazırlıkların son aşamasındayız." : "AI that lets you chat with your documents is coming very soon. We're putting on the finishing touches."}
            </p>
          </div>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300"><b.icon className="h-4 w-4" /></span>
                <p className="mt-2.5 text-[13px] font-bold text-white">{b.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{b.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-slate-500">
            {tr ? "Bu sırada tüm PDF araçlarımız ücretsiz ve sınırsız — yukarıdan deneyebilirsin." : "Meanwhile, all our PDF tools are free and unlimited — try them above."}
          </p>
        </div>
      ) : /* ── Cihazda hazırlanıyor (taranmış belge sessizce metne çevriliyor) ── */
      ocrProgress !== null ? (
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-6 sm:p-8">
          <StatusStrip label={tr ? "Belge hazırlanıyor…" : "Preparing document…"} ratio={ocrProgress} />
          <p className="mt-3 text-center text-[12px] text-slate-500">
            {tr
              ? "Belge okunuyor, birkaç saniye sürebilir."
              : "Reading the document, this may take a few seconds."}
          </p>
        </div>
      ) : /* ── Dosya yok → premium yükleme ── */
      !fileName ? (
        <>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void pickFile(e.dataTransfer.files[0]); }}
          onClick={() => !busy && inputRef.current?.click()}
          className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-12 text-center transition ${
            dragOver
              ? "border-fuchsia-400/70 bg-fuchsia-400/[0.07]"
              : "border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent hover:border-fuchsia-400/40 hover:bg-white/[0.04]"
          }`}
        >
          <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-white/10 transition group-hover:scale-105">
            {busy ? <Loader2 className="h-9 w-9 animate-spin" /> : <UploadCloud className="h-9 w-9" />}
          </div>
          <p className="relative mt-5 text-lg font-bold text-white">
            {busy
              ? tr ? "Belge okunuyor…" : "Reading document…"
              : tr ? "PDF'i buraya sürükle veya seç" : "Drag your PDF here or browse"}
          </p>
          <p className="relative mt-1.5 text-[13px] text-slate-400">
            {tr ? "Metin cihazında çıkarılır — dosyan sunucuya yüklenmez." : "Text is extracted on your device — the file is never uploaded."}
          </p>
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-400">
            {[
              tr ? "⚡ Saniyeler içinde" : "⚡ In seconds",
              tr ? "🔒 Gizli" : "🔒 Private",
              tr ? "✨ Güçlü yapay zekâ" : "✨ Powerful AI",
            ].map((c) => (
              <span key={c} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{c}</span>
            ))}
          </div>
        </div>

        {/* Ne işe yarar / kullanınca ne olur */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-fuchsia-400/25 hover:bg-white/[0.03]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300">
                <b.icon className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-[13px] font-bold text-white">{b.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{b.desc}</p>
            </div>
          ))}
        </div>
        </>
      ) : (
        <div>
          {/* Dosya bilgi çubuğu */}
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/12 text-fuchsia-300">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">{fileName}</p>
              <p className="text-[11px] text-slate-500">
                {tr
                  ? `~${(charCount / 1000).toFixed(1)}K karakter · ~${readTime} dk okuma`
                  : `~${(charCount / 1000).toFixed(1)}K chars · ~${readTime} min read`}
              </p>
            </div>
            <button type="button" onClick={reset}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
              {tr ? "Yeni PDF" : "New PDF"}
            </button>
          </div>

          {mode === "summarize" ? (
            summary ? (
              <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
                {/* Aksiyon çubuğu */}
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-fuchsia-300">
                    <Sparkles className="h-4 w-4" />
                    {tr ? "AI Özeti" : "AI Summary"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={copySummary} title={tr ? "Kopyala" : "Copy"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{copied ? (tr ? "Kopyalandı" : "Copied") : tr ? "Kopyala" : "Copy"}</span>
                    </button>
                    <button type="button" onClick={() => void downloadSummary()} disabled={exporting} title={tr ? "PDF indir" : "Download PDF"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50">
                      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{tr ? "PDF İndir" : "Download PDF"}</span>
                    </button>
                    <button type="button" onClick={() => void shareSummary()} disabled={exporting} title={tr ? "PDF olarak paylaş" : "Share as PDF"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50">
                      <Share2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr ? "Paylaş" : "Share"}</span>
                    </button>
                    <button type="button" onClick={() => void runSummarize()} disabled={busy} title={tr ? "Yeniden" : "Regenerate"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40">
                      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">{tr ? "Yeniden" : "Regenerate"}</span>
                    </button>
                  </div>
                </div>
                {/* Belge kartı — markdown */}
                <div className="max-h-[62vh] overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
                  <SimpleMarkdown text={summary} />
                </div>
              </div>
            ) : busy ? (
              <StatusStrip label={tr ? "Özet hazırlanıyor…" : "Preparing summary…"} ratio={null} />
            ) : (
              <button type="button" onClick={() => void runSummarize()}
                className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110">
                <Sparkles className="h-5 w-5" />
                {tr ? "Profesyonel Özet Oluştur" : "Generate Professional Summary"}
              </button>
            )
          ) : mode === "extract" ? (
            extracted ? (
              <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-fuchsia-300">
                    <Table2 className="h-4 w-4" />
                    {tr ? "Çıkarılan Veri" : "Extracted Data"}
                    {extracted.docType && <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-bold text-fuchsia-200">{extracted.docType}</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={copyExtracted} title="JSON"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">JSON</span>
                    </button>
                    <button type="button" onClick={() => void downloadExtractedCsv()} title="CSV (Excel)"
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                      <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">CSV</span>
                    </button>
                    <button type="button" onClick={() => void runExtract()} disabled={busy} title={tr ? "Yeniden" : "Regenerate"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40">
                      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">{tr ? "Yeniden" : "Regenerate"}</span>
                    </button>
                  </div>
                </div>
                <div className="max-h-[62vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                  {extracted.fields.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
                      {extracted.fields.map((f, i) => (
                        <div key={i} className={`flex gap-3 px-4 py-2.5 text-[13px] ${i % 2 ? "bg-white/[0.015]" : ""}`}>
                          <span className="w-40 shrink-0 font-semibold text-slate-400">{f.label}</span>
                          <span className="min-w-0 flex-1 break-words text-slate-100">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {extracted.tables.map((t, ti) => (
                    <div key={ti}>
                      {t.title && <p className="mb-1.5 text-[13px] font-bold text-white">{t.title}</p>}
                      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
                        <table className="w-full text-left text-[12px]">
                          <thead>
                            <tr className="bg-white/[0.04] text-slate-300">
                              {t.columns.map((c, ci) => <th key={ci} className="whitespace-nowrap px-3 py-2 font-semibold">{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {t.rows.map((r, ri) => (
                              <tr key={ri} className="border-t border-white/[0.05]">
                                {r.map((c, ci) => <td key={ci} className="px-3 py-2 text-slate-200">{c}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {extracted.fields.length === 0 && extracted.tables.length === 0 && (
                    <p className="text-center text-[13px] text-slate-400">{tr ? "Bu belgeden yapılandırılmış veri bulunamadı." : "No structured data found in this document."}</p>
                  )}
                  {extracted.note && <p className="text-[12px] italic text-slate-500">{extracted.note}</p>}
                </div>
              </div>
            ) : busy ? (
              <StatusStrip label={tr ? "Veri çıkarılıyor…" : "Extracting data…"} ratio={null} />
            ) : (
              <button type="button" onClick={() => void runExtract()}
                className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110">
                <Table2 className="h-5 w-5" />
                {tr ? "Veriyi Çıkar" : "Extract Data"}
              </button>
            )
          ) : mode === "translate" ? (
            translatedBlob ? (
              <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"><Check className="h-8 w-8" /></div>
                <p className="mt-4 text-xl font-bold text-white">{tr ? "Çeviri hazır 🎉" : "Translation ready 🎉"}</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{tr ? "Orijinal düzen birebir korundu — yalnızca yazılar çevrildi." : "The original layout is preserved exactly — only the text was translated."}</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button type="button" onClick={openTranslation} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.12] px-6 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20"><ExternalLink className="h-4 w-4" />{tr ? "Aç" : "Open"}</button>
                  <button type="button" onClick={() => void downloadTranslation()} disabled={exporting} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{tr ? "İndir" : "Download"}</button>
                  <button type="button" onClick={() => void shareTranslation()} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"><Share2 className="h-4 w-4" />{tr ? "Paylaş" : "Share"}</button>
                  <button type="button" onClick={() => setTranslatedBlob(null)} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]">{tr ? "Farklı dile çevir" : "Different language"}</button>
                </div>
              </div>
            ) : busy ? (
              <StatusStrip label={tr ? "Çevriliyor…" : "Translating…"} ratio={null} />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                  <span className="text-[13px] font-semibold text-slate-300">{tr ? "Hedef dil:" : "Target language:"}</span>
                  <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white">
                    {TRANSLATE_TARGETS.map((l) => <option key={l.code} value={l.code} className="text-black">{tr ? l.tr : l.en}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => void runTranslate()}
                  className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110">
                  <Languages className="h-5 w-5" />
                  {tr ? `${(TRANSLATE_TARGETS.find((l) => l.code === targetLang) || {}).tr} diline çevir` : `Translate to ${(TRANSLATE_TARGETS.find((l) => l.code === targetLang) || {}).en}`}
                </button>
              </div>
            )
          ) : (
            <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-4 sm:p-5">
              <div className="mb-3 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 && (
                  <div className="py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-300">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      {tr ? "Belge hazır. Bir soru sor 👇" : "Document ready. Ask a question 👇"}
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {(tr
                        ? ["Bu belge neyi anlatıyor?", "Ana noktaları özetle", "Önemli tarihler neler?"]
                        : ["What is this about?", "Summarize key points", "What are the key dates?"]
                      ).map((s) => (
                        <button key={s} type="button" onClick={() => setQuestion(s)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-slate-300 transition hover:border-fuchsia-400/30 hover:bg-fuchsia-500/[0.08] hover:text-white">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-fuchsia-600/40 to-violet-600/30 text-white"
                        : "border border-white/[0.06] bg-white/[0.04] text-slate-200"
                    }`}>
                      {m.role === "assistant" ? <SimpleMarkdown text={m.content} /> : m.content}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 px-2 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />{tr ? "Yanıt yazılıyor…" : "Thinking…"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 border-t border-white/[0.06] pt-3">
                <input value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendQuestion(); }}
                  placeholder={tr ? "Belge hakkında bir soru yaz…" : "Ask about the document…"}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/15" />
                <button type="button" onClick={() => void sendQuestion()} disabled={busy || !question.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white transition hover:brightness-110 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">
          <Lock className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {gate && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/[0.1] to-transparent p-5 text-center">
          <p className="text-sm font-semibold text-amber-100">
            {gate === "login"
              ? tr ? "Devam etmek için giriş yap" : "Log in to continue"
              : tr ? "Bu bir Pro / Business özelliğidir" : "This is a Pro / Business feature"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={gate === "login" ? onLogin : onUpgrade}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110">
              {gate === "login" ? (tr ? "Giriş yap" : "Log in") : tr ? "Planı yükselt" : "Upgrade"}
            </button>
            {gate === "upgrade" && (
              <button type="button" onClick={() => setTopUpOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-5 py-2.5 text-sm font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/20">
                {tr ? "Tek işlem satın al" : "Buy a single use"}
              </button>
            )}
          </div>
        </div>
      )}
      {topUpOpen && (
        <TopUpModal
          language={language}
          accessToken={accessToken}
          isAdmin={isAdmin}
          bonus={quota?.bonus}
          onClose={() => setTopUpOpen(false)}
          onGranted={() => { void fetchAiQuota(accessToken).then((q) => q && setQuota(q)); }}
        />
      )}
    </div>
  );
}
