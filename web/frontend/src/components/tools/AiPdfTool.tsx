import { useRef, useState } from "react";
import {
  FileText,
  Loader2,
  Lock,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { extractPdfText } from "../../lib/pdfText";
import { aiSummarize, aiChat, type AiError, type ChatTurn } from "../../api/ai";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Özet
  const [summary, setSummary] = useState("");
  // Sohbet
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");

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
    if (!f) return;
    if (f.type !== "application/pdf") {
      setError(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF.");
      return;
    }
    try {
      setBusy(true);
      const text = await extractPdfText(f);
      if (text.length < 20) {
        setError(
          tr
            ? "Bu PDF'ten metin çıkarılamadı (taranmış/görsel olabilir). OCR yakında."
            : "No text could be extracted (scanned/image PDF). OCR coming soon.",
        );
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

  async function runSummarize() {
    setError(null);
    setGate(null);
    try {
      setBusy(true);
      const s = await aiSummarize(docText, tr ? "tr" : "en", accessToken);
      setSummary(s);
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
      const a = await aiChat(docText, q, history, tr ? "tr" : "en", accessToken);
      setMessages((m) => [...m, { role: "assistant", content: a }]);
    } catch (e) {
      handleAiError(e);
      setMessages((m) => m.slice(0, -1)); // soruyu geri al (hata)
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  }

  const gateBox = gate && (
    <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/[0.08] p-4 text-center">
      <p className="text-sm font-semibold text-amber-200">
        {gate === "login"
          ? tr ? "Giriş gerekli" : "Login required"
          : tr ? "Pro / Business gerekli" : "Pro / Business required"}
      </p>
      <button
        type="button"
        onClick={gate === "login" ? onLogin : onUpgrade}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
      >
        {gate === "login" ? (tr ? "Giriş yap" : "Log in") : tr ? "Planı yükselt" : "Upgrade"}
      </button>
    </div>
  );

  return (
    <div className="text-left">
      {/* Başlık */}
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[12px] font-semibold text-violet-200">
          <Sparkles className="h-3.5 w-3.5" />
          {mode === "summarize"
            ? tr ? "PDF Özetle (AI)" : "Summarize PDF (AI)"
            : tr ? "PDF ile Sohbet (AI)" : "Chat with PDF (AI)"}
        </span>
        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
          Pro
        </span>
      </div>

      {/* Dosya yok → dropzone */}
      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void pickFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`group cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center transition ${
            dragOver ? "border-violet-400/70 bg-violet-400/[0.06]" : "border-white/15 bg-white/[0.02] hover:border-violet-400/40 hover:bg-white/[0.04]"
          }`}
        >
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-violet-300 ring-1 ring-white/10">
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
          </div>
          <p className="mt-4 text-base font-semibold text-white">
            {busy ? (tr ? "Metin çıkarılıyor…" : "Extracting text…") : tr ? "PDF'i buraya sürükle" : "Drag your PDF here"}
          </p>
          <p className="mt-1 text-[13px] text-slate-400">
            {tr ? "Metin cihazda çıkarılır; AI işlemi sunucuda yapılır." : "Text is extracted on-device; AI runs on the server."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-violet-300">
              <FileText className="h-4 w-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-100">{fileName}</p>
            <button type="button" onClick={() => { setFileName(null); setDocText(""); setSummary(""); setMessages([]); }}
              className="text-[12px] font-semibold text-slate-500 hover:text-white">
              {tr ? "Değiştir" : "Change"}
            </button>
          </div>

          {mode === "summarize" ? (
            <div className="mt-4">
              {summary ? (
                <div className="max-h-[46vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[14px] leading-relaxed text-slate-200">
                  {summary}
                </div>
              ) : (
                <button type="button" onClick={() => void runSummarize()} disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-[15px] font-bold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40">
                  {busy ? <><Loader2 className="h-5 w-5 animate-spin" />{tr ? "Özetleniyor…" : "Summarizing…"}</> : <><Sparkles className="h-4 w-4" />{tr ? "Özetle" : "Summarize"}</>}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <div className="mb-3 max-h-[40vh] space-y-2 overflow-y-auto">
                {messages.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-slate-500">
                    {tr ? "Belge hakkında bir soru sor." : "Ask a question about the document."}
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                    m.role === "user" ? "ml-auto bg-violet-600/30 text-violet-50" : "mr-auto whitespace-pre-wrap bg-white/[0.05] text-slate-200"
                  }`}>
                    {m.content}
                  </div>
                ))}
                {busy && <div className="mr-auto flex items-center gap-2 px-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Yazıyor…" : "Thinking…"}</div>}
              </div>
              <div className="flex items-center gap-2">
                <input value={question} onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendQuestion(); }}
                  placeholder={tr ? "Sorunu yaz…" : "Type your question…"}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none" />
                <button type="button" onClick={() => void sendQuestion()} disabled={busy || !question.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {gateBox}
    </div>
  );
}
