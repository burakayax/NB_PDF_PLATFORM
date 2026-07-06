import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  FileText,
  GitCompareArrows,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { extractPdfText } from "../../lib/pdfText";
import { ocrPdfToText } from "../../lib/ocr";
import { aiCompare, fetchAiQuota, type AiError, type AiQuota, type CompareResult } from "../../api/ai";

type Slot = { name: string; text: string; status: "empty" | "reading" | "ready" | "error" };
const EMPTY: Slot = { name: "", text: "", status: "empty" };

type Props = {
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
  comingSoon?: boolean;
};

/**
 * AI PDF KARŞILAŞTIRMA — iki belgeyi (A: eski, B: yeni) yükle, yapay zekâ anlamlı
 * farkları (eklenen/çıkarılan/değişen madde) çıkarsın. Metin CİHAZDA çıkarılır.
 */
export function AiCompareTool({ language, accessToken, onLogin, onUpgrade, comingSoon }: Props) {
  const tr = language === "tr";
  const [a, setA] = useState<Slot>(EMPTY);
  const [b, setB] = useState<Slot>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<null | "login" | "upgrade">(null);
  const [copied, setCopied] = useState(false);
  const refA = useRef<HTMLInputElement>(null);
  const refB = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (comingSoon) return;
    void fetchAiQuota(accessToken).then((q) => q && setQuota(q));
  }, [accessToken, comingSoon]);

  async function pick(which: "a" | "b", file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    const set = which === "a" ? setA : setB;
    if (file.type !== "application/pdf") { setError(tr ? "Lütfen PDF seçin." : "Please choose a PDF."); return; }
    set({ name: file.name, text: "", status: "reading" });
    try {
      const r = await extractPdfText(file);
      const text = r.likelyScanned ? await ocrPdfToText(file) : r.text;
      if (text.trim().length < 20) { set({ name: file.name, text: "", status: "error" }); setError(tr ? "Bu belgeden metin okunamadı." : "Couldn't read text from this document."); return; }
      set({ name: file.name, text, status: "ready" });
    } catch {
      set({ name: file.name, text: "", status: "error" });
      setError(tr ? "PDF okunamadı." : "Could not read the PDF.");
    }
  }

  async function runCompare() {
    if (a.status !== "ready" || b.status !== "ready") return;
    setError(null); setGate(null);
    try {
      setBusy(true);
      const { result: r, quota: q } = await aiCompare(a.text, b.text, tr ? "tr" : "en", accessToken);
      setResult(r);
      if (q) setQuota(q);
    } catch (e) {
      const err = e as AiError;
      if (err?.status === 401) setGate("login");
      else if (err?.status === 403) setGate("upgrade");
      else if (err?.status === 429) { if (err.quota) setQuota(err.quota); setError(tr ? "Bu ayki AI kotan doldu." : "Monthly AI quota reached."); }
      else if (err?.status === 503) setError(tr ? "AI şu an kullanılamıyor." : "AI is currently unavailable.");
      else setError(err?.message || (tr ? "Bir hata oluştu." : "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  function copyResult() {
    if (!result) return;
    const lines = [result.summary, "", ...result.changes.map((c) => `[${c.type}] ${c.title}: ${c.detail}`)];
    void navigator.clipboard?.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  }

  const CHANGE_STYLE = {
    added: { icon: Plus, ring: "border-emerald-400/30", bg: "bg-emerald-500/[0.07]", text: "text-emerald-300", label: tr ? "Eklendi" : "Added" },
    removed: { icon: Minus, ring: "border-rose-400/30", bg: "bg-rose-500/[0.07]", text: "text-rose-300", label: tr ? "Çıkarıldı" : "Removed" },
    changed: { icon: Pencil, ring: "border-amber-400/30", bg: "bg-amber-500/[0.07]", text: "text-amber-300", label: tr ? "Değişti" : "Changed" },
  } as const;

  const Drop = ({ which, slot }: { which: "a" | "b"; slot: Slot }) => {
    const ref = which === "a" ? refA : refB;
    const badge = which === "a" ? (tr ? "A · Eski / İlk" : "A · Old / First") : (tr ? "B · Yeni / İkinci" : "B · New / Second");
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void pick(which, e.dataTransfer.files[0]); }}
        onClick={() => ref.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${slot.status === "ready" ? "border-fuchsia-400/40 bg-fuchsia-500/[0.05]" : "border-white/15 bg-white/[0.02] hover:border-fuchsia-400/40"}`}>
        <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={(e) => { void pick(which, e.target.files?.[0]); e.target.value = ""; }} />
        <span className="inline-block rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-0.5 text-[11px] font-bold text-fuchsia-200">{badge}</span>
        <div className="mx-auto mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-600/20 text-fuchsia-200">
          {slot.status === "reading" ? <Loader2 className="h-5 w-5 animate-spin" /> : slot.status === "ready" ? <FileText className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
        </div>
        {slot.status === "ready" ? (
          <p className="mt-2 truncate text-[13px] font-semibold text-white">{slot.name}</p>
        ) : slot.status === "reading" ? (
          <p className="mt-2 text-[12px] text-slate-400">{tr ? "okunuyor…" : "reading…"}</p>
        ) : (
          <p className="mt-2 text-[12px] text-slate-400">{tr ? "PDF sürükle ya da seç" : "Drag or choose a PDF"}</p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl text-left">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]">
          <GitCompareArrows className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "PDF Karşılaştır" : "Compare PDFs"}</h1>
            <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">Pro</span>
            {quota && !comingSoon ? (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${!quota.unlimited && (quota.remaining ?? 0) <= 0 ? "border-red-400/35 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.04] text-slate-300"}`}>
                {quota.unlimited ? (tr ? "Sınırsız" : "Unlimited") : tr ? `Bu ay: ${quota.remaining}/${quota.limit}` : `This month: ${quota.remaining}/${quota.limit}`}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-400">{tr ? "İki belgeyi (ör. sözleşmenin iki sürümü) yükleyin; yapay zekâ eklenen, çıkarılan ve değişen maddeleri çıkarsın." : "Upload two documents (e.g. two versions of a contract); AI extracts added, removed and changed clauses."}</p>
        </div>
      </div>

      {comingSoon ? (
        <div className="overflow-hidden rounded-3xl border-2 border-dashed border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-8 text-center sm:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" />{tr ? "Çok Yakında" : "Coming Soon"}</span>
          <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200 ring-1 ring-white/10"><GitCompareArrows className="h-9 w-9" /></div>
          <p className="mt-5 text-xl font-black text-white">{tr ? "PDF Karşılaştır" : "Compare PDFs"}</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-300">{tr ? "İki sözleşme/belge sürümü arasındaki farkları saniyeler içinde çıkaran yapay zekâ çok yakında açılıyor." : "AI that extracts the differences between two document versions in seconds is coming very soon."}</p>
        </div>
      ) : gate ? (
        <div className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-8 text-center">
          <p className="text-lg font-bold text-white">{gate === "login" ? (tr ? "Giriş gerekli" : "Login required") : (tr ? "Pro / Business özelliği" : "Pro / Business feature")}</p>
          <button type="button" onClick={gate === "login" ? onLogin : onUpgrade} className="mt-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white">{gate === "login" ? (tr ? "Giriş yap" : "Log in") : (tr ? "Planları gör" : "See plans")}</button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Drop which="a" slot={a} />
            <Drop which="b" slot={b} />
          </div>

          {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>}

          <button type="button" onClick={() => void runCompare()} disabled={busy || a.status !== "ready" || b.status !== "ready"}
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110 disabled:opacity-40">
            {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Karşılaştırılıyor…" : "Comparing…"}</> : <><GitCompareArrows className="h-5 w-5" />{tr ? "Belgeleri Karşılaştır" : "Compare Documents"}</>}
          </button>

          {result && (
            <div className="mt-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-fuchsia-300"><GitCompareArrows className="h-4 w-4" />{tr ? "Karşılaştırma" : "Comparison"} <span className="text-slate-500">A <ArrowRight className="inline h-3 w-3" /> B</span></span>
                <button type="button" onClick={copyResult} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}<span className="hidden sm:inline">{copied ? (tr ? "Kopyalandı" : "Copied") : tr ? "Kopyala" : "Copy"}</span>
                </button>
              </div>
              <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
                {result.summary && <p className="text-[14px] leading-relaxed text-slate-200">{result.summary}</p>}
                {result.changes.length === 0 ? (
                  <p className="text-center text-[13px] text-slate-400">{tr ? "Anlamlı bir fark bulunamadı." : "No meaningful differences found."}</p>
                ) : (
                  <div className="space-y-2.5">
                    {result.changes.map((c, i) => {
                      const s = CHANGE_STYLE[c.type];
                      return (
                        <div key={i} className={`rounded-2xl border ${s.ring} ${s.bg} p-4`}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-6 items-center gap-1 rounded-md bg-black/20 px-2 text-[11px] font-bold ${s.text}`}><s.icon className="h-3.5 w-3.5" />{s.label}</span>
                            <p className="text-[14px] font-bold text-white">{c.title}</p>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{c.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />{tr ? "Metin cihazınızda çıkarılır; yalnız metin AI'a gider." : "Text is extracted on your device; only text is sent to the AI."}
          </p>
        </>
      )}
    </div>
  );
}
