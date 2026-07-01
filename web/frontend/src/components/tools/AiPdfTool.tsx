import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  ScanText,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { extractPdfText } from "../../lib/pdfText";
import { ocrPdfToText } from "../../lib/ocr";
import {
  aiSummarize,
  aiChat,
  fetchAiQuota,
  type AiError,
  type AiQuota,
  type ChatTurn,
} from "../../api/ai";
import { SimpleMarkdown } from "../common/SimpleMarkdown";

type AiMode = "summarize" | "chat";

type Props = {
  mode: AiMode;
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
};

/**
 * AI aracı (Pro/Business): PDF metni CİHAZDA çıkarılır (pdf.js), yalnız metin
 * sunucuya gider → Claude. Özetle veya belgeyle Sohbet. 401→giriş, 403→yükselt.
 */
export function AiPdfTool({ mode, language, accessToken, onLogin, onUpgrade }: Props) {
  const tr = language === "tr";
  const [fileName, setFileName] = useState<string | null>(null);
  const [docText, setDocText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<null | "login" | "upgrade">(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  // Taranmış PDF: OCR akışı
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Özet
  const [summary, setSummary] = useState("");
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

  async function pickFile(f: File | undefined) {
    setError(null);
    setGate(null);
    setSummary("");
    setMessages([]);
    setScannedFile(null);
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF.");
      return;
    }
    try {
      setBusy(true);
      const { text, likelyScanned } = await extractPdfText(f);
      if (likelyScanned) {
        // Metin yok → taranmış; OCR akışını öner (çöp özet üretme).
        setScannedFile(f);
        setBusy(false);
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

  async function runOcr() {
    if (!scannedFile) return;
    setError(null);
    try {
      setBusy(true);
      setOcrProgress(0);
      const text = await ocrPdfToText(scannedFile, (p) => setOcrProgress(p.ratio));
      if (text.length < 20) {
        setError(
          tr
            ? "OCR ile de metin okunamadı — belge çok düşük çözünürlüklü olabilir."
            : "OCR couldn't read text either — the document may be very low resolution.",
        );
        return;
      }
      setFileName(scannedFile.name);
      setDocText(text);
      setScannedFile(null);
    } catch {
      setError(tr ? "OCR sırasında bir hata oluştu." : "Something went wrong during OCR.");
    } finally {
      setBusy(false);
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

  function downloadSummary() {
    const blob = new Blob([summary], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fileName || "ozet").replace(/\.pdf$/i, "")}-ozet.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  function shareSummary() {
    const payload = {
      title: fileName ? `${fileName} — ${tr ? "Özet" : "Summary"}` : tr ? "PDF Özeti" : "PDF Summary",
      text: summary,
    };
    if (canShare) {
      void navigator.share(payload).catch(() => {});
    } else {
      copySummary(); // paylaşım desteklenmiyorsa panoya kopyala
    }
  }

  function reset() {
    setFileName(null);
    setDocText("");
    setSummary("");
    setMessages([]);
    setError(null);
    setGate(null);
    setScannedFile(null);
    setOcrProgress(null);
  }

  const title =
    mode === "summarize"
      ? tr ? "PDF Özetle" : "Summarize PDF"
      : tr ? "PDF ile Sohbet" : "Chat with PDF";
  const subtitle =
    mode === "summarize"
      ? tr ? "PDF'inizi baştan sona okumadan; başlık, ana konular ve önemli noktalarıyla profesyonel bir özete çevirir." : "Turns your PDF into a professional summary — title, key topics and key points — without reading it end to end."
      : tr ? "PDF'inize doğal dille soru sorun; yapay zekâ yalnızca belgedeki bilgiye dayanarak anında yanıtlar." : "Ask your PDF questions in plain language; the AI answers instantly, based only on the document.";

  const benefits: { icon: LucideIcon; title: string; desc: string }[] =
    mode === "summarize"
      ? [
          { icon: Zap, title: tr ? "Saniyeler içinde kavra" : "Grasp it in seconds", desc: tr ? "Uzun raporu, sözleşmeyi ya da makaleyi baştan sona okumadan ana fikri al." : "Get the gist of a long report, contract or article without reading it all." },
          { icon: ListChecks, title: tr ? "Yapılandırılmış özet" : "Structured output", desc: tr ? "Başlık, ana konular, önemli noktalar ve sonuç — düzenli ve profesyonel." : "Title, key topics, key points and conclusion — clean and professional." },
          { icon: ShieldCheck, title: tr ? "Gizli & güvenli" : "Private & secure", desc: tr ? "Belgen cihazından çıkmaz; yalnızca metni yapay zekâya gönderilir." : "Your file stays on device; only its text is sent to the AI." },
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
                    ? `Bu ay: ${quota.remaining}/${quota.limit}`
                    : `This month: ${quota.remaining}/${quota.limit}`}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>

      {/* ── Taranmış PDF → cihazda OCR ── */}
      {scannedFile ? (
        <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-b from-amber-500/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30">
            <ScanText className="h-8 w-8" />
          </div>
          <p className="mt-4 text-lg font-bold text-white">
            {tr ? "Taranmış PDF algılandı" : "Scanned PDF detected"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-400">
            {tr
              ? "Bu belge görüntü tabanlı — yazı, metin değil resim. Okuyabilmek için OCR (görüntüden metin) gerekiyor. Cihazında yapılır, ücretsiz ve gizli."
              : "This document is image-based — the text is a picture, not selectable text. OCR is needed to read it. Runs on your device, free and private."}
          </p>
          <p className="mt-1 text-[12px] text-slate-500 truncate">{scannedFile.name}</p>

          {ocrProgress !== null ? (
            <div className="mx-auto mt-6 max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                  style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                />
              </div>
              <p className="mt-2 flex items-center justify-center gap-2 text-[12px] font-medium text-amber-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {tr
                  ? `Metin okunuyor… %${Math.round(ocrProgress * 100)}`
                  : `Reading text… ${Math.round(ocrProgress * 100)}%`}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {tr ? "İlk kullanımda dil verisi bir kez iner; sonraki belgeler daha hızlı." : "Language data downloads once on first use; later documents are faster."}
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void runOcr()}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110"
              >
                <ScanText className="h-4 w-4" />
                {tr ? "OCR ile Metni Oku" : "Read Text with OCR"}
              </button>
              <button
                type="button"
                onClick={() => setScannedFile(null)}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
              >
                {tr ? "Vazgeç" : "Cancel"}
              </button>
            </div>
          )}
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
                    <button type="button" onClick={downloadSummary} title={tr ? "İndir (.md)" : "Download (.md)"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr ? "İndir" : "Download"}</span>
                    </button>
                    <button type="button" onClick={shareSummary} title={tr ? "Paylaş" : "Share"}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
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
            ) : (
              <button type="button" onClick={() => void runSummarize()} disabled={busy}
                className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110 disabled:opacity-50">
                {busy
                  ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Özet hazırlanıyor…" : "Preparing summary…"}</>
                  : <><Sparkles className="h-5 w-5" />{tr ? "Profesyonel Özet Oluştur" : "Generate Professional Summary"}</>}
              </button>
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
          <button type="button" onClick={gate === "login" ? onLogin : onUpgrade}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110">
            {gate === "login" ? (tr ? "Giriş yap" : "Log in") : tr ? "Planı yükselt" : "Upgrade"}
          </button>
        </div>
      )}
    </div>
  );
}
