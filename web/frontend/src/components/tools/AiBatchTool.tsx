import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileText,
  Languages,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { saveBlobToUser } from "../../api";
import { extractPdfText } from "../../lib/pdfText";
import { ocrPdfToText } from "../../lib/ocr";
import { summaryToPdf, pdfBytesToBlob } from "../../lib/summaryPdf";
import {
  aiExtract,
  aiSummarize,
  aiTranslate,
  fetchAiQuota,
  TRANSLATE_TARGETS,
  type AiError,
  type AiQuota,
  type ExtractedData,
} from "../../api/ai";

type BatchOp = "extract" | "summarize" | "translate";
type FileStatus = "pending" | "reading" | "processing" | "done" | "error" | "skipped";
type BatchFile = {
  id: string;
  file: File;
  status: FileStatus;
  extract?: ExtractedData;
  text?: string; // özet/çeviri sonucu
  error?: string;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const MAX_FILES = 25;

type Props = {
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
  comingSoon?: boolean;
};

/**
 * AI TOPLU İŞLEM — birçok PDF'i tek seferde AI'a işletir (özet / veri çıkarma / çeviri).
 * Metin CİHAZDA çıkarılır (pdf.js + gerekirse OCR), sonra dosya başına mevcut AI ucu
 * çağrılır. Sonuçlar dosya başına + birleşik CSV/PDF olarak dışa aktarılır.
 */
export function AiBatchTool({ language, accessToken, onLogin, onUpgrade, comingSoon }: Props) {
  const tr = language === "tr";
  const [op, setOp] = useState<BatchOp>("extract");
  const [targetLang, setTargetLang] = useState(language === "tr" ? "en" : "tr");
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<null | "login" | "upgrade">(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (comingSoon) return;
    void fetchAiQuota(accessToken).then((q) => q && setQuota(q));
  }, [accessToken, comingSoon]);

  function addFiles(list: FileList | File[]) {
    setError(null);
    const pdfs = Array.from(list).filter((f) => f.type === "application/pdf" && f.size > 0);
    if (pdfs.length === 0) {
      setError(tr ? "Lütfen PDF dosyası ekleyin." : "Please add PDF files.");
      return;
    }
    setFiles((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) {
        setError(tr ? `En fazla ${MAX_FILES} dosya işlenebilir.` : `Up to ${MAX_FILES} files.`);
        return prev;
      }
      return [...prev, ...pdfs.slice(0, room).map((file) => ({ id: uid(), file, status: "pending" as FileStatus }))];
    });
  }

  const remove = (id: string) => setFiles((p) => p.filter((f) => f.id !== id));
  const clearAll = () => { setFiles([]); setError(null); setProgress(0); };

  function handleAiError(e: unknown): "quota" | "other" {
    const err = e as AiError;
    if (err?.status === 401) { setGate("login"); return "other"; }
    if (err?.status === 403) { setGate("upgrade"); return "other"; }
    if (err?.status === 429) {
      if (err.quota) setQuota(err.quota);
      setError(tr ? "Bu ayki AI kotan doldu — kalan dosyalar atlandı." : "Monthly AI quota reached — remaining files skipped.");
      return "quota";
    }
    if (err?.status === 503) { setError(tr ? "AI şu an kullanılamıyor." : "AI is currently unavailable."); return "other"; }
    setError(err?.message || (tr ? "Bir hata oluştu." : "Something went wrong."));
    return "other";
  }

  async function readText(file: File): Promise<string> {
    const r = await extractPdfText(file);
    if (r.likelyScanned) return await ocrPdfToText(file);
    return r.text;
  }

  async function runBatch() {
    setError(null);
    setGate(null);
    setRunning(true);
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    let done = files.filter((f) => f.status === "done").length;
    const setStatus = (id: string, patch: Partial<BatchFile>) =>
      setFiles((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    try {
      for (const bf of pending) {
        setStatus(bf.id, { status: "reading", error: undefined });
        let text = "";
        try {
          text = await readText(bf.file);
        } catch {
          setStatus(bf.id, { status: "error", error: tr ? "Okunamadı" : "Unreadable" });
          continue;
        }
        if (text.trim().length < 20) {
          setStatus(bf.id, { status: "error", error: tr ? "Metin çıkmadı" : "No text" });
          continue;
        }
        setStatus(bf.id, { status: "processing" });
        try {
          if (op === "extract") {
            const { data, quota: q } = await aiExtract(text, tr ? "tr" : "en", accessToken);
            if (q) setQuota(q);
            setStatus(bf.id, { status: "done", extract: data });
          } else if (op === "summarize") {
            const { summary, quota: q } = await aiSummarize(text, tr ? "tr" : "en", accessToken);
            if (q) setQuota(q);
            setStatus(bf.id, { status: "done", text: summary });
          } else {
            const { translation, quota: q } = await aiTranslate(text, targetLang, accessToken);
            if (q) setQuota(q);
            setStatus(bf.id, { status: "done", text: translation });
          }
          done += 1;
          setProgress(done);
        } catch (e) {
          const kind = handleAiError(e);
          if (kind === "quota") {
            // Kotayı geçen dosyaları atlanmış işaretle ve durdur.
            setFiles((p) => p.map((f) => (f.status === "pending" || f.status === "error" || f.id === bf.id ? { ...f, status: f.id === bf.id ? "skipped" : f.status === "pending" ? "skipped" : f.status } : f)));
            break;
          }
          if (kind === "other" && (gate || (e as AiError)?.status === 401 || (e as AiError)?.status === 403)) break;
          setStatus(bf.id, { status: "error", error: tr ? "İşlenemedi" : "Failed" });
        }
      }
    } finally {
      setRunning(false);
    }
  }

  // ── Birleşik dışa aktarım ──
  const doneFiles = files.filter((f) => f.status === "done");

  function downloadCombinedCsv() {
    const rows = doneFiles.filter((f) => f.extract);
    if (rows.length === 0) return;
    const cols: string[] = [];
    for (const f of rows) for (const fld of f.extract!.fields) if (!cols.includes(fld.label)) cols.push(fld.label);
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push([esc(tr ? "Dosya" : "File"), esc(tr ? "Belge türü" : "Doc type"), ...cols.map(esc)].join(","));
    for (const f of rows) {
      const map = new Map(f.extract!.fields.map((x) => [x.label, x.value]));
      lines.push([esc(f.file.name), esc(f.extract!.docType), ...cols.map((c) => esc(map.get(c) ?? ""))].join(","));
    }
    dl(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "toplu-veri.csv");
  }

  async function downloadCombinedPdf() {
    const rows = doneFiles.filter((f) => f.text);
    if (rows.length === 0) return;
    const md = rows.map((f) => `# ${f.file.name}\n\n${f.text}`).join("\n\n---\n\n");
    const ttl = op === "translate" ? (tr ? "Toplu Çeviri" : "Batch Translation") : tr ? "Toplu Özet" : "Batch Summaries";
    dl(pdfBytesToBlob(await summaryToPdf(md, ttl)), op === "translate" ? "toplu-ceviri.pdf" : "toplu-ozet.pdf");
  }

  function dl(blob: Blob, name: string) {
    // İndirme konumunu sorar (destekleyen tarayıcıda); değilse klasik indirmeye düşer.
    void saveBlobToUser(blob, name).catch(() => {});
  }

  const OPS: Array<{ id: BatchOp; icon: typeof Table2; tr: string; en: string }> = [
    { id: "extract", icon: Table2, tr: "Veri Çıkar", en: "Extract data" },
    { id: "summarize", icon: ListChecks, tr: "Özetle", en: "Summarize" },
    { id: "translate", icon: Languages, tr: "Çevir", en: "Translate" },
  ];

  const statusChip = (f: BatchFile) => {
    switch (f.status) {
      case "reading": return <span className="text-cyan-300">{tr ? "okunuyor…" : "reading…"}</span>;
      case "processing": return <span className="text-fuchsia-300">{tr ? "işleniyor…" : "processing…"}</span>;
      case "done": return <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3.5 w-3.5" />{tr ? "tamam" : "done"}</span>;
      case "error": return <span className="text-red-300">{f.error || (tr ? "hata" : "error")}</span>;
      case "skipped": return <span className="text-amber-300">{tr ? "kota doldu — atlandı" : "quota — skipped"}</span>;
      default: return <span className="text-slate-500">{tr ? "bekliyor" : "pending"}</span>;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      {/* Başlık */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]">
          <Layers className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "AI Toplu İşlem" : "AI Batch"}</h1>
            <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">Pro</span>
            {quota && !comingSoon ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${!quota.unlimited && (quota.remaining ?? 0) <= 0 ? "border-red-400/35 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                {quota.unlimited ? (tr ? "Sınırsız" : "Unlimited") : tr ? `Bu ay: ${quota.remaining}/${quota.limit}` : `This month: ${quota.remaining}/${quota.limit}`}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {tr ? "Bir klasör dolusu PDF'i tek seferde işle: her belgeyi özetle, verisini çıkar ya da çevir; sonuçları tek CSV/PDF olarak indir." : "Process a whole folder of PDFs at once: summarize, extract data or translate each; export results as one CSV/PDF."}
          </p>
        </div>
      </div>

      {comingSoon ? (
        <div className="overflow-hidden rounded-3xl border-2 border-dashed border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-8 text-center sm:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide text-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" />{tr ? "Çok Yakında" : "Coming Soon"}
          </span>
          <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200 ring-1 ring-white/10"><Layers className="h-9 w-9" /></div>
          <p className="mt-5 text-xl font-black text-white">{tr ? "AI Toplu İşlem" : "AI Batch"}</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-300">
            {tr ? "Onlarca faturayı, sözleşmeyi ya da raporu tek seferde işleyen toplu AI çok yakında açılıyor." : "Batch AI that processes dozens of invoices, contracts or reports at once is coming very soon."}
          </p>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            {[
              { icon: Table2, t: tr ? "Faturalar → tek tablo" : "Invoices → one table", d: tr ? "20 faturayı işle, tek CSV'de birleştir." : "Process 20 invoices, merge into one CSV." },
              { icon: Layers, t: tr ? "Tek seferde onlarca" : "Dozens at once", d: tr ? "Klasör dolusu belgeyi arka arkaya işler." : "Runs through a folder of documents." },
              { icon: ShieldCheck, t: tr ? "Cihazında okunur" : "Read on device", d: tr ? "Metin cihazında çıkar; yalnız o gönderilir." : "Text extracted on device; only that is sent." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300"><b.icon className="h-4 w-4" /></span>
                <p className="mt-2.5 text-[13px] font-bold text-white">{b.t}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      ) : gate ? (
        <div className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-8 text-center">
          <p className="text-lg font-bold text-white">{gate === "login" ? (tr ? "Giriş gerekli" : "Login required") : (tr ? "Pro / Business özelliği" : "Pro / Business feature")}</p>
          <button type="button" onClick={gate === "login" ? onLogin : onUpgrade}
            className="mt-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white">
            {gate === "login" ? (tr ? "Giriş yap" : "Log in") : (tr ? "Planları gör" : "See plans")}
          </button>
        </div>
      ) : (
        <>
          {/* İşlem seçici */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {OPS.map((o) => (
              <button key={o.id} type="button" onClick={() => setOp(o.id)} disabled={running}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition disabled:opacity-50 ${op === o.id ? "bg-fuchsia-500/20 text-fuchsia-100 ring-1 ring-fuchsia-400/40" : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"}`}>
                <o.icon className="h-4 w-4" />{tr ? o.tr : o.en}
              </button>
            ))}
            {op === "translate" && (
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} disabled={running}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white">
                {TRANSLATE_TARGETS.map((l) => <option key={l.code} value={l.code} className="text-black">{tr ? l.tr : l.en}</option>)}
              </select>
            )}
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            onClick={() => !running && inputRef.current?.click()}
            className={`cursor-pointer rounded-3xl border-2 border-dashed p-6 text-center transition ${dragOver ? "border-fuchsia-400/70 bg-fuchsia-400/[0.07]" : "border-white/15 bg-white/[0.02] hover:border-fuchsia-400/40"}`}>
            <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-200"><UploadCloud className="h-6 w-6" /></div>
            <p className="mt-3 text-[14px] font-bold text-white">{tr ? "PDF'leri buraya sürükle" : "Drag your PDFs here"}</p>
            <p className="mt-1 text-[12px] text-slate-400">{tr ? `ya da tıklayıp seç · en fazla ${MAX_FILES} dosya` : `or click to choose · up to ${MAX_FILES} files`}</p>
          </div>

          {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

          {files.length > 0 && (
            <>
              <div className="mt-4 mb-2 flex items-center justify-between px-1">
                <span className="text-[12px] font-semibold text-slate-300">
                  {files.length} {tr ? "dosya" : "files"}
                  {doneFiles.length > 0 && <span className="ml-1.5 text-emerald-300">· {doneFiles.length} {tr ? "tamam" : "done"}</span>}
                </span>
                <button type="button" onClick={clearAll} disabled={running}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />{tr ? "Tümünü sil" : "Clear all"}
                </button>
              </div>
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-fuchsia-300">
                        {f.status === "reading" || f.status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-100">{f.file.name}</p>
                        <p className="text-[11px]">{statusChip(f)}</p>
                      </div>
                      {!running && (
                        <button type="button" onClick={() => remove(f.id)} className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"><X className="h-4 w-4" /></button>
                      )}
                    </div>
                    {/* Extract sonucu — kompakt önizleme */}
                    {f.status === "done" && f.extract && (f.extract.fields.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.extract.docType && <span className="rounded-md border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] text-fuchsia-200">{f.extract.docType}</span>}
                        {f.extract.fields.slice(0, 5).map((fl, i) => (
                          <span key={i} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300"><b className="text-slate-400">{fl.label}:</b> {fl.value}</span>
                        ))}
                        {f.extract.fields.length > 5 && <span className="text-[11px] text-slate-500">+{f.extract.fields.length - 5}</span>}
                      </div>
                    )}
                    {/* Özet/çeviri — kısa önizleme */}
                    {f.status === "done" && f.text && (
                      <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-slate-400">{f.text.replace(/[#*`>]/g, "").slice(0, 220)}…</p>
                    )}
                  </li>
                ))}
              </ul>

              {/* Çalıştır / ilerleme */}
              {running ? (
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all" style={{ width: `${Math.round((progress / files.length) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-center text-[12px] text-slate-400">{tr ? `İşleniyor… ${progress}/${files.length}` : `Processing… ${progress}/${files.length}`}</p>
                </div>
              ) : (
                <button type="button" onClick={() => void runBatch()} disabled={files.every((f) => f.status === "done" || f.status === "skipped")}
                  className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110 disabled:opacity-40">
                  <Sparkles className="h-5 w-5" />
                  {tr ? `${files.filter((f) => f.status !== "done" && f.status !== "skipped").length} dosyayı işle` : `Process ${files.filter((f) => f.status !== "done" && f.status !== "skipped").length} files`}
                </button>
              )}

              {/* Birleşik dışa aktarım */}
              {doneFiles.length > 0 && !running && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {op === "extract" ? (
                    <button type="button" onClick={downloadCombinedCsv}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]">
                      <Download className="h-4 w-4" />{tr ? `Tümünü CSV indir (${doneFiles.filter((f) => f.extract).length})` : `Download all CSV (${doneFiles.filter((f) => f.extract).length})`}
                    </button>
                  ) : (
                    <button type="button" onClick={() => void downloadCombinedPdf()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]">
                      <Download className="h-4 w-4" />{tr ? `Tümünü PDF indir (${doneFiles.filter((f) => f.text).length})` : `Download all PDF (${doneFiles.filter((f) => f.text).length})`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
