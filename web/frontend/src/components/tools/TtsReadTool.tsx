import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Pause, Play, Square } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { readPdfPageTexts } from "../../lib/pdfSpeechText";
import { RATE, loadAntalia, toWavBlob, type TtsEngine } from "../../lib/antaliaTts";

/**
 * Sesli Okuma (PDF/metin → Türkçe ses) — yapay zekâ sesi TAMAMEN cihazda çalışır (Antalia-2 Mini).
 * İlk kullanımda ~49 MB model iner ve tarayıcıda saklanır; belge metni hiçbir yere gitmez.
 */

const MAX_PAGES_DEFAULT = 30;
const AHEAD_SECONDS = 20; // çalma önünde en fazla bu kadar sentezlenmiş ses tutulur

type Phase = "idle" | "loading" | "ready" | "playing" | "paused" | "done" | "error";

export function TtsReadTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const [src, setSrc] = useState<"pdf" | "text">("pdf");
  const [pages, setPages] = useState<string[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [typed, setTyped] = useState("");
  const [speed, setSpeed] = useState(0.95);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(0);
  const [wav, setWav] = useState<Blob | null>(null);
  const [backend, setBackend] = useState<string>("");

  const engine = useRef<TtsEngine | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const cancel = useRef({ cancelled: false });
  const collected = useRef<Float32Array[]>([]);

  useEffect(
    () => () => {
      cancel.current.cancelled = true;
      void ctxRef.current?.close();
      void engine.current?.dispose();
    },
    [],
  );

  const onPdf = async (files: File[]) => {
    const f = files.find((x) => /\.pdf$/i.test(x.name));
    if (!f) return setMsg(tr ? "Lütfen bir PDF seçin." : "Please choose a PDF.");
    setMsg(null);
    setPhase("idle");
    try {
      const p = await readPdfPageTexts(f);
      if (p.join("").replace(/\s/g, "").length < 20) {
        setPages(null);
        return setMsg(tr ? "Bu PDF'te seçilebilir metin yok (taranmış olabilir). Önce «Taranmış PDF (OCR)» aracını kullanın." : "This PDF has no selectable text (it may be scanned). Run OCR first.");
      }
      setPages(p);
      setFileName(f.name);
      setFrom(1);
      setTo(Math.min(p.length, MAX_PAGES_DEFAULT));
    } catch {
      setMsg(tr ? "PDF okunamadı. Dosya bozuk ya da şifreli olabilir." : "Could not read the PDF. It may be corrupt or encrypted.");
    }
  };

  const text = src === "text" ? typed.trim() : pages ? pages.slice(from - 1, to).join("\n\n") : "";

  const stop = () => {
    cancel.current.cancelled = true;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setPhase((p) => (p === "playing" || p === "paused" ? "done" : p));
  };

  const start = async () => {
    setMsg(null);
    setWav(null);
    setDone(0);
    setCurrent("");
    collected.current = [];
    try {
      if (!engine.current) {
        setPhase("loading");
        engine.current = await loadAntalia((p) => setPct(p));
        setBackend(engine.current.backend === "webgpu" ? "WebGPU" : "WASM");
      }
    } catch {
      engine.current = null;
      setPhase("error");
      return setMsg(tr ? "Ses modeli yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin; bu tarayıcı desteklemiyor olabilir." : "Could not load the voice model. Check your connection and retry; this browser may not support it.");
    }

    const token = { cancelled: false };
    cancel.current = token;
    const ctx = new AudioContext({ sampleRate: RATE });
    ctxRef.current = ctx;
    let when = ctx.currentTime + 0.15;
    setPhase("playing");
    let n = 0;
    try {
      for await (const piece of engine.current.synth(text, speed, 0, token)) {
        if (token.cancelled) return;
        collected.current.push(piece.audio);
        const buf = ctx.createBuffer(1, piece.audio.length, RATE);
        buf.copyToChannel(piece.audio as Float32Array<ArrayBuffer>, 0);
        const node = ctx.createBufferSource();
        node.buffer = buf;
        node.connect(ctx.destination);
        const t = Math.max(when, ctx.currentTime + 0.05);
        node.start(t);
        const startedAt = t;
        node.onended = () => {
          if (!token.cancelled) setCurrent(piece.text);
        };
        // Çalma başlayınca vurgulanacak cümleyi ayarla.
        window.setTimeout(() => { if (!token.cancelled) setCurrent(piece.text); }, Math.max(0, (startedAt - ctx.currentTime) * 1000));
        when = t + buf.duration;
        n++;
        setDone(n);
        // Çok ileri sentezleme: çalma yetişene kadar bekle (CPU/pil tasarrufu).
        while (!token.cancelled && when - ctx.currentTime > AHEAD_SECONDS) await new Promise((r) => setTimeout(r, 250));
      }
      if (token.cancelled) return;
      // Son ses bitene kadar bekle.
      while (!token.cancelled && ctx.currentTime < when) await new Promise((r) => setTimeout(r, 200));
      if (!token.cancelled) setPhase("done");
    } catch {
      if (!token.cancelled) {
        setPhase("error");
        setMsg(tr ? "Okuma sırasında bir hata oluştu." : "An error occurred while reading.");
      }
    }
  };

  const togglePause = async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "running") {
      await ctx.suspend();
      setPhase("paused");
    } else {
      await ctx.resume();
      setPhase("playing");
    }
  };

  const makeWav = () => {
    const parts = collected.current;
    const out = new Float32Array(parts.reduce((a, x) => a + x.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    setWav(toWavBlob(out));
  };

  const download = () => {
    if (!wav) return;
    const url = URL.createObjectURL(wav);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName.replace(/\.pdf$/i, "") || "sesli-okuma") + ".wav";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const running = phase === "playing" || phase === "paused";
  const canStart = text.length > 0 && phase !== "loading" && !running;

  return (
    <div className="tool-form">
      <div className="field field--full flex gap-4 text-[13px] text-slate-200">
        <label className="flex items-center gap-1.5"><input type="radio" checked={src === "pdf"} onChange={() => setSrc("pdf")} disabled={running} />PDF</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={src === "text"} onChange={() => setSrc("text")} disabled={running} />{tr ? "Metin yaz / yapıştır" : "Type / paste text"}</label>
      </div>

      {src === "pdf" ? (
        <>
          <WorkspaceUploadField
            toolId="pdf-sesli-oku"
            language={language}
            accept=".pdf,application/pdf"
            disabled={running || phase === "loading"}
            appendMode={!!pages}
            label={tr ? "PDF dosyasını buraya sürükle" : "Drag your PDF here"}
            note={tr ? "Seçilebilir metin içeren PDF · cihazınızda okunur" : "PDF with selectable text · read on your device"}
            hideHeader={describesTool}
            onFiles={(f) => void onPdf(f)}
          />
          {pages && (
            <div className="field field--full flex flex-wrap items-center gap-2 text-[13px] text-slate-200">
              <span className="truncate">{fileName}</span>
              <span className="text-slate-400">· {pages.length} {tr ? "sayfa" : "pages"}</span>
              <label className="ml-auto flex items-center gap-1.5">
                {tr ? "Sayfa" : "Pages"}
                <input type="number" min={1} max={pages.length} value={from} disabled={running} onChange={(e) => setFrom(Math.max(1, Math.min(Number(e.target.value) || 1, to)))} className="w-16 rounded-md border border-white/10 bg-transparent px-2 py-1" />
                –
                <input type="number" min={from} max={pages.length} value={to} disabled={running} onChange={(e) => setTo(Math.min(pages.length, Math.max(Number(e.target.value) || from, from)))} className="w-16 rounded-md border border-white/10 bg-transparent px-2 py-1" />
              </label>
            </div>
          )}
        </>
      ) : (
        <label className="field field--full">
          <span>{tr ? "Okunacak metin" : "Text to read"}</span>
          <textarea rows={7} value={typed} disabled={running} onChange={(e) => setTyped(e.target.value)} />
        </label>
      )}

      <label className="field field--full flex flex-wrap items-center gap-3 text-[13px] text-slate-200">
        {tr ? "Hız" : "Speed"}: {speed.toFixed(2)}×
        <input type="range" min={0.7} max={1.3} step={0.05} value={speed} disabled={running} onChange={(e) => setSpeed(Number(e.target.value))} className="min-w-[10rem] flex-1" />
      </label>

      {phase === "loading" && (
        <div className="field field--full">
          <span>{tr ? "Ses modeli hazırlanıyor (yalnız ilk kullanımda ~49 MB iner)…" : "Preparing the voice model (~49 MB, first use only)…"}</span>
          <div className="mt-1 h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-nb-accent transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {(running || phase === "done") && current && (
        <p className="field--full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left text-[13px] leading-relaxed text-slate-200">{current}</p>
      )}
      {(running || phase === "done") && (
        <p className="field--full text-left text-[12px] text-slate-400">
          {tr ? `Hazırlanan parça: ${done}` : `Segments prepared: ${done}`}{backend ? ` · ${backend}` : ""}
        </p>
      )}

      {msg && <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{msg}</p>}

      <div className="field--full flex flex-wrap gap-2">
        {!running ? (
          <button type="button" className="primary-action" disabled={!canStart} onClick={() => void start()}>
            {phase === "loading" ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Yükleniyor…" : "Loading…"}</span> : <span className="inline-flex items-center gap-2"><Play className="h-4 w-4" />{tr ? "Oku" : "Read aloud"}</span>}
          </button>
        ) : (
          <>
            <button type="button" className="primary-action" onClick={() => void togglePause()}>
              <span className="inline-flex items-center gap-2">{phase === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{phase === "paused" ? (tr ? "Devam" : "Resume") : tr ? "Duraklat" : "Pause"}</span>
            </button>
            <button type="button" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-white/5" onClick={stop}>
              <span className="inline-flex items-center gap-2"><Square className="h-4 w-4" />{tr ? "Durdur" : "Stop"}</span>
            </button>
          </>
        )}
        {phase === "done" && collected.current.length > 0 && !wav && (
          <button type="button" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-white/5" onClick={makeWav}>
            {tr ? "Ses dosyası hazırla (WAV)" : "Prepare audio file (WAV)"}
          </button>
        )}
        {wav && (
          <button type="button" className="primary-action" onClick={download}>
            <span className="inline-flex items-center gap-2"><Download className="h-4 w-4" />{tr ? "WAV indir" : "Download WAV"}</span>
          </button>
        )}
      </div>

      <p className="field--full text-center text-[12px] text-slate-400">
        {tr
          ? "Yapay zekâ sesi tarayıcınızda çalışır — metniniz sunucumuza gönderilmez. Ses yapay olarak üretilmiştir; birini taklit etmek ya da dinleyiciyi yanıltmak için kullanmayın."
          : "The AI voice runs in your browser — your text is never sent to our servers. The voice is synthetic; do not use it to impersonate anyone or mislead listeners."}
      </p>
    </div>
  );
}
