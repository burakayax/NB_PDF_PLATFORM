import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  Grid3x3,
  Loader2,
  Package,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRound,
  XCircle,
} from "lucide-react";
import { zipSync } from "fflate";
import type { Language } from "../../i18n/landing";
import { ToolRating } from "../common/ToolRating";
import { isPaidPlan, useCurrentPlan } from "../../lib/currentPlan";
import { warmUp } from "../../lib/photoStudio/ai";
import {
  analyzeBase,
  bgFill,
  compose,
  exportCanvas,
  level,
  makeSheet,
  PhotoLoadError,
  runChecks,
  type BaseAnalysis,
  type ComposeOptions,
  type Leveled,
} from "../../lib/photoStudio/compose";
import {
  BACKGROUNDS,
  CUSTOM_PRESET_ID,
  GROUP_LABEL,
  PRESETS,
  SHEETS,
  presetPixels,
  type BgId,
  type PhotoPreset,
  type PresetGroup,
  type SheetId,
} from "../../lib/photoStudio/presets";

type Props = {
  language: Language;
  accessToken: string | null;
  onLogin: () => void;
  onUpgrade: () => void;
  comingSoon?: boolean;
  isAdmin?: boolean;
};

type Phase = "idle" | "loading" | "ready" | "error";

const GROUP_ORDER: PresetGroup[] = ["official", "career", "social", "custom"];

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-300">{title}</h3>
    {hint ? <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{hint}</p> : null}
    <div className="mt-3">{children}</div>
  </section>
);

const Check_ = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1.5 hover:bg-white/[0.03]">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-fuchsia-500" />
    <span className="text-[13px] text-slate-200">
      {label}
      {hint ? <span className="block text-[11.5px] text-slate-400">{hint}</span> : null}
    </span>
  </label>
);

const Range = ({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) => (
  <label className="block">
    <span className="flex justify-between text-[12px] text-slate-300"><span>{label}</span><span className="tabular-nums text-slate-400">{fmt(value)}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-fuchsia-500" />
  </label>
);


/**
 * AI FOTOĞRAF STÜDYOSU — yüklenen fotoğrafı amaca göre (vesikalık, CV, LinkedIn,
 * profil resmi…) kırpar, arka planı değiştirir, ışığı iyileştirir.
 *
 * GİZLİLİK: Tüm işlem cihazda yapılır. Fotoğraf sunucuya gönderilmez ve saklanmaz.
 */
export function PhotoStudioTool({ language, accessToken, onLogin, onUpgrade, comingSoon, isAdmin }: Props) {
  const tr = language === "tr";
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [modelPct, setModelPct] = useState<{ matte: number; face: number }>({ matte: 0, face: 0 });
  const [fileName, setFileName] = useState("");
  const [base, setBase] = useState<BaseAnalysis | null>(null);
  const [leveled, setLeveled] = useState<Leveled | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Seçenekler
  const [group, setGroup] = useState<PresetGroup>("official");
  const [presetId, setPresetId] = useState("tr-biyometrik");
  const [customW, setCustomW] = useState(35);
  const [customH, setCustomH] = useState(45);
  const [bg, setBg] = useState<BgId>("white");
  const [customColor, setCustomColor] = useState("#f4f1ec");
  const [circle, setCircle] = useState(false);
  const [straighten, setStraighten] = useState(true);
  const [enhance, setEnhance] = useState(true);
  const [headRatio, setHeadRatio] = useState<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [dpi, setDpi] = useState(300);
  const [maxKb, setMaxKb] = useState("");
  const [sheet, setSheet] = useState<SheetId>("none");
  const [showGuides, setShowGuides] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [multi, setMulti] = useState(false);
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composedRef = useRef<HTMLCanvasElement | null>(null);
  const [guides, setGuides] = useState<ReturnType<typeof compose>["guides"] | null>(null);

  const planState = useCurrentPlan();
  const gate: null | "login" | "upgrade" = !accessToken ? "login" : !(isAdmin || isPaidPlan(planState)) ? "upgrade" : null;

  const preset: PhotoPreset = useMemo(() => {
    if (presetId === CUSTOM_PRESET_ID) {
      return {
        id: CUSTOM_PRESET_ID, group: "custom", mmW: customW, mmH: customH, head: [0.5, 0.7], topShare: 0.32, bg: "white",
        tr: { name: "Özel ölçü", desc: "" }, en: { name: "Custom size", desc: "" },
      };
    }
    return PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  }, [presetId, customW, customH]);

  const px = useMemo(() => presetPixels(preset), [preset]);

  const pickPreset = (p: PhotoPreset) => {
    setPresetId(p.id);
    setGroup(p.group);
    setBg(p.bg);
    setCircle(!!p.circle);
    setHeadRatio(null);
    setOffsetX(0);
    setOffsetY(0);
    if (p.bg === "transparent") setFormat("png");
    else if (format === "png" && p.group !== "custom") setFormat("jpg");
    if (p.maxKb) setMaxKb(String(Math.min(p.maxKb, 1000)));
    else setMaxKb("");
    if (!p.mmW) setSheet("none");
  };

  const opts: ComposeOptions = useMemo(
    () => ({
      outW: px.w, outH: px.h, head: preset.head, topShare: preset.topShare,
      headRatio: headRatio ?? undefined, offsetX, offsetY, bg, customColor, circle, enhance, brightness,
    }),
    [px, preset, headRatio, offsetX, offsetY, bg, customColor, circle, enhance, brightness],
  );

  // ── Fotoğraf yükle ──────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
        setError(tr ? "Lütfen bir fotoğraf seçin (JPG, PNG, WebP)." : "Please choose a photo (JPG, PNG, WebP).");
        setPhase("error");
        return;
      }
      setError(null);
      setPhase("loading");
      setDone(null);
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      setModelPct({ matte: 0, face: 0 });
      try {
        const b = await analyzeBase(file, (stage, pct) => setModelPct((m) => ({ ...m, [stage]: pct })));
        setBase(b);
        setLeveled(await level(b, straighten));
        setHeadRatio(null);
        setOffsetX(0);
        setOffsetY(0);
        setPhase("ready");
      } catch (e) {
        setPhase("error");
        if (e instanceof PhotoLoadError) {
          setError(
            e.code === "tooSmall"
              ? tr ? "Fotoğraf çok küçük. En az 200 piksel genişlik/yükseklik gerekir." : "The photo is too small. It needs at least 200 px on its short side."
              : tr ? "Bu fotoğraf açılamadı. JPG, PNG veya WebP deneyin (iPhone HEIC'i Safari dışında açılmayabilir)." : "This photo couldn't be opened. Try JPG, PNG or WebP (HEIC may not open outside Safari).",
          );
        } else {
          setError(tr ? "Yapay zekâ modelleri yüklenemedi. İnternet bağlantınızı kontrol edip yeniden deneyin." : "The AI models couldn't be loaded. Check your connection and try again.");
        }
      }
    },
    [straighten, tr],
  );

  // "Başı düzelt" değişince yalnız hizalamayı yeniden hesapla (matte yeniden çalışmaz)
  const firstLevel = useRef(true);
  useEffect(() => {
    if (!base) return;
    if (firstLevel.current) {
      firstLevel.current = false;
    }
    let live = true;
    void level(base, straighten).then((l) => live && setLeveled(l));
    return () => {
      live = false;
    };
  }, [straighten, base]);

  // Modelleri, kullanıcı fotoğraf seçerken arka planda ısıt
  useEffect(() => {
    if (comingSoon || gate) return;
    void warmUp((stage, pct) => setModelPct((m) => ({ ...m, [stage]: pct }))).catch(() => undefined);
  }, [comingSoon, gate]);

  // ── Önizleme ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leveled || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      const { canvas, guides: g } = compose(leveled, opts);
      composedRef.current = canvas;
      setGuides(g);
      const view = canvasRef.current;
      if (!view) return;
      view.width = canvas.width;
      view.height = canvas.height;
      const ctx = view.getContext("2d")!;
      ctx.clearRect(0, 0, view.width, view.height);
      ctx.drawImage(canvas, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [leveled, opts]);

  const checks = useMemo(() => {
    if (!leveled || !base || !guides) return [];
    return runChecks(leveled, base, preset, opts, guides);
  }, [leveled, base, guides, preset, opts]);

  const flatten = bgFill(bg, customColor) ?? "#ffffff";
  const sheetDef = SHEETS.find((s) => s.id === sheet);

  async function downloadMain() {
    if (!composedRef.current) return;
    setBusy(true);
    try {
      const kb = Number(maxKb);
      const r = await exportCanvas(composedRef.current, {
        format, dpi, maxKb: Number.isFinite(kb) && kb > 0 ? kb : null, flattenColor: flatten,
      });
      download(r.blob, `${fileName || "fotograf"}-${preset.id}.${format}`);
      setDone(
        r.downscaled
          ? tr ? `İndirildi — ${Math.round(r.blob.size / 1024)} KB (boyut sınırı için çözünürlük ${r.width}×${r.height}'e düşürüldü).` : `Downloaded — ${Math.round(r.blob.size / 1024)} KB (resolution reduced to ${r.width}×${r.height} to meet the size limit).`
          : tr ? `İndirildi — ${r.width}×${r.height} px, ${Math.round(r.blob.size / 1024)} KB.` : `Downloaded — ${r.width}×${r.height} px, ${Math.round(r.blob.size / 1024)} KB.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadSheet() {
    if (!composedRef.current || !sheetDef || !preset.mmW || !preset.mmH) return;
    setBusy(true);
    try {
      const { canvas, count } = makeSheet(composedRef.current, { w: preset.mmW, h: preset.mmH }, { w: sheetDef.mmW, h: sheetDef.mmH }, flatten === "#ffffff" ? "#ffffff" : flatten);
      const r = await exportCanvas(canvas, { format: "jpg", dpi: 300, maxKb: null, flattenColor: "#ffffff" });
      download(r.blob, `${fileName || "fotograf"}-${preset.id}-baski-${sheetDef.id}.jpg`);
      setDone(tr ? `Baskı sayfası indirildi — ${count} adet ${preset.mmW}×${preset.mmH} mm, %100 boyutta yazdırın.` : `Print sheet downloaded — ${count} × ${preset.mmW}×${preset.mmH} mm, print at 100% size.`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    if (!leveled) return;
    const ids = multiIds.length ? multiIds : [preset.id];
    setBusy(true);
    try {
      const files: Record<string, Uint8Array> = {};
      for (const id of ids) {
        const p = PRESETS.find((x) => x.id === id) ?? preset;
        const size = presetPixels(p);
        const { canvas } = compose(leveled, {
          ...opts, outW: size.w, outH: size.h, head: p.head, topShare: p.topShare, headRatio: undefined, offsetX: 0, offsetY: 0, circle: !!p.circle && circle,
        });
        const kb = Number(maxKb);
        const r = await exportCanvas(canvas, { format, dpi, maxKb: Number.isFinite(kb) && kb > 0 ? kb : null, flattenColor: flatten });
        files[`${fileName || "fotograf"}-${p.id}.${format}`] = new Uint8Array(await r.blob.arrayBuffer());
      }
      download(new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), `${fileName || "fotograf"}-olculer.zip`);
      setDone(tr ? `${ids.length} ölçü ZIP olarak indirildi.` : `${ids.length} sizes downloaded as a ZIP.`);
    } finally {
      setBusy(false);
    }
  }

  function resetAdjust() {
    setHeadRatio(null);
    setOffsetX(0);
    setOffsetY(0);
    setBrightness(0);
  }

  const lvlIcon = (l: "ok" | "warn" | "bad") =>
    l === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : l === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />;

  const modelsReady = modelPct.matte >= 100 && modelPct.face >= 100;
  const mainPct = Math.round((modelPct.matte * 0.9 + modelPct.face * 0.1));

  // ── Çizim ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-6xl text-left">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 via-violet-500/20 to-indigo-600/20 text-fuchsia-200 ring-1 ring-fuchsia-400/30 shadow-[0_0_30px_-8px_rgba(232,121,249,0.6)]">
          <UserRound className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">{tr ? "AI Fotoğraf Stüdyosu" : "AI Photo Studio"}</h1>
            <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">Pro</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {tr
              ? "Fotoğrafınızı yükleyin; vesikalık, biyometrik, CV, LinkedIn ya da profil resmi için yapay zekâ kırpsın, arka planı değiştirsin, ışığı düzeltsin."
              : "Upload a photo; AI crops it for ID, biometric, CV, LinkedIn or profile use, swaps the background and fixes the light."}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/[0.07] px-3 py-1 text-[12px] font-semibold text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {tr ? "Fotoğrafınız cihazınızdan çıkmaz — sunucuya yüklenmez, saklanmaz." : "Your photo never leaves your device — it isn't uploaded or stored."}
          </p>
        </div>
      </div>

      {comingSoon ? (
        <div className="overflow-hidden rounded-3xl border-2 border-dashed border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-8 text-center sm:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" />{tr ? "Çok Yakında" : "Coming Soon"}</span>
          <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200 ring-1 ring-white/10"><UserRound className="h-9 w-9" /></div>
          <p className="mt-5 text-xl font-black text-white">{tr ? "AI Fotoğraf Stüdyosu" : "AI Photo Studio"}</p>
          <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-slate-300">
            {tr
              ? "Vesikalık, biyometrik, CV ve LinkedIn fotoğrafınızı saniyeler içinde hazırlayan, arka planı değiştiren yapay zekâ çok yakında açılıyor. Fotoğrafınız sunucuya yüklenmeden, cihazınızda işlenecek."
              : "AI that prepares your ID, biometric, CV and LinkedIn photos in seconds and swaps the background is coming very soon. Your photo is processed on your device, never uploaded."}
          </p>
        </div>
      ) : gate ? (
        <div className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-8 text-center">
          <p className="text-lg font-bold text-white">{gate === "login" ? (tr ? "Giriş gerekli" : "Login required") : (tr ? "Pro / Business özelliği" : "Pro / Business feature")}</p>
          <button type="button" onClick={gate === "login" ? onLogin : onUpgrade} className="mt-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white">{gate === "login" ? (tr ? "Giriş yap" : "Log in") : (tr ? "Planları gör" : "See plans")}</button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* SOL: yükleme + önizleme */}
          <div className="min-w-0 space-y-4">
            {phase === "idle" || phase === "error" || !leveled ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
                className={`flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${dragOver ? "border-fuchsia-400 bg-fuchsia-500/10" : "border-white/15 bg-white/[0.02] hover:border-fuchsia-400/50 hover:bg-fuchsia-500/[0.04]"}`}
              >
                {phase === "loading" ? (
                  <Loader2 className="h-10 w-10 animate-spin text-fuchsia-300" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-fuchsia-500/15 text-fuchsia-200"><UploadCloud className="h-8 w-8" /></div>
                )}
                <p className="mt-4 text-lg font-bold text-white">{tr ? "Fotoğrafınızı sürükleyin ya da seçin" : "Drag your photo here or choose one"}</p>
                <p className="mt-1 max-w-sm text-[13px] text-slate-400">{tr ? "Yüzünüzün net göründüğü, ışığı iyi bir fotoğraf en iyi sonucu verir. JPG, PNG, WebP." : "A sharp, well-lit photo of your face works best. JPG, PNG, WebP."}</p>
                {error ? <p className="mt-4 max-w-md rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-2.5 text-[13px] text-red-300">{error}</p> : null}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            ) : null}

            {phase === "loading" ? (
              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.05] p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-fuchsia-100"><Loader2 className="h-4 w-4 animate-spin" />{modelsReady ? (tr ? "Fotoğraf analiz ediliyor…" : "Analysing your photo…") : (tr ? "Yapay zekâ modeli hazırlanıyor (ilk seferde ~26 MB, sonra önbellekten)…" : "Preparing the AI model (~26 MB the first time, cached afterwards)…")}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all" style={{ width: `${modelsReady ? 100 : mainPct}%` }} /></div>
              </div>
            ) : null}

            {phase === "ready" && leveled ? (
              <>
                <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.10),transparent_60%)] p-4">
                  <div className="mx-auto flex max-w-[460px] items-center justify-center">
                    <div className="relative inline-block max-w-full overflow-hidden rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/15" style={{ background: bg === "transparent" ? "repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 50% / 16px 16px" : "#fff" }}>
                      <canvas ref={canvasRef} className="block h-auto max-h-[68vh] w-auto max-w-full" style={{ aspectRatio: `${px.w} / ${px.h}` }} />
                      {showOriginal && base ? (
                        <img alt="" src={base.src.toDataURL("image/jpeg", 0.85)} className="absolute inset-0 h-full w-full object-contain bg-slate-900" />
                      ) : null}
                      {showGuides && guides ? (
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute left-0 right-0 border-t border-dashed border-sky-300/90" style={{ top: `${(guides.crownY / px.h) * 100}%` }}><span className="absolute right-1 -translate-y-full rounded bg-sky-500/80 px-1 text-[9px] font-bold text-white">{tr ? "baş üstü" : "crown"}</span></div>
                          <div className="absolute left-0 right-0 border-t border-dashed border-sky-300/90" style={{ top: `${(guides.chinY / px.h) * 100}%` }}><span className="absolute right-1 rounded bg-sky-500/80 px-1 text-[9px] font-bold text-white">{tr ? "çene" : "chin"}</span></div>
                          {guides.eyeY !== null ? <div className="absolute left-0 right-0 border-t border-dashed border-emerald-300/80" style={{ top: `${(guides.eyeY / px.h) * 100}%` }} /> : null}
                          <div className="absolute bottom-0 left-1/2 top-0 border-l border-dashed border-white/60" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button type="button" onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.08]"><Eye className="h-3.5 w-3.5" />{tr ? "Basılı tut: orijinal" : "Hold: original"}</button>
                    <button type="button" aria-pressed={showGuides} onClick={() => setShowGuides((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold ${showGuides ? "border-sky-400/50 bg-sky-500/15 text-sky-100" : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"}`}><Grid3x3 className="h-3.5 w-3.5" />{tr ? "Kılavuz çizgileri" : "Guides"}</button>
                    <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-slate-200 hover:bg-white/[0.08]"><UploadCloud className="h-3.5 w-3.5" />{tr ? "Başka fotoğraf" : "Another photo"}</button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                  </div>
                  <p className="mt-3 text-center text-[11.5px] text-slate-400">
                    {preset.mmW ? `${preset.mmW}×${preset.mmH} mm · ` : ""}{px.w}×{px.h} px · {dpi} dpi
                  </p>
                </div>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-300">{tr ? "Uygunluk denetimi" : "Suitability check"}</h3>
                  <ul className="mt-3 space-y-2">
                    {checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-[13px] text-slate-200">{lvlIcon(c.level)}<span>{tr ? c.tr : c.en}</span></li>
                    ))}
                  </ul>
                  {preset.strict ? <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">{tr ? "Bu denetim yardımcıdır; başvuracağınız kurumun güncel fotoğraf şartını ayrıca kontrol edin." : "This check is a guide; also verify the current photo rules of the institution you apply to."}</p> : null}
                </section>
              </>
            ) : null}
          </div>

          {/* SAĞ: seçenekler */}
          <div className="space-y-4">
            <Section title={tr ? "1 · Ne için kullanacaksınız?" : "1 · What is it for?"}>
              <div role="tablist" className="mb-3 flex flex-wrap gap-1.5">
                {GROUP_ORDER.map((g) => (
                  <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => { setGroup(g); if (g === "custom") setPresetId(CUSTOM_PRESET_ID); else if (preset.group !== g) pickPreset(PRESETS.find((p) => p.group === g)!); }} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${group === g ? "bg-fuchsia-500/25 text-fuchsia-100 ring-1 ring-fuchsia-400/50" : "bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]"}`}>{tr ? GROUP_LABEL[g].tr : GROUP_LABEL[g].en}</button>
                ))}
              </div>
              {group === "custom" ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[12px] text-slate-300">{tr ? "Genişlik (mm)" : "Width (mm)"}<input type="number" min={10} max={200} value={customW} onChange={(e) => setCustomW(Math.min(200, Math.max(10, Number(e.target.value) || 10)))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white" /></label>
                  <label className="text-[12px] text-slate-300">{tr ? "Yükseklik (mm)" : "Height (mm)"}<input type="number" min={10} max={300} value={customH} onChange={(e) => setCustomH(Math.min(300, Math.max(10, Number(e.target.value) || 10)))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white" /></label>
                </div>
              ) : (
                <div role="radiogroup" aria-label={tr ? "Fotoğraf türü" : "Photo type"} className="space-y-1.5">
                  {PRESETS.filter((p) => p.group === group).map((p) => {
                    const on = presetId === p.id;
                    return (
                      <label key={p.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${on ? "border-fuchsia-400/60 bg-fuchsia-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                        <input type="radio" name="photo-preset" checked={on} onChange={() => pickPreset(p)} className="mt-1 h-4 w-4 shrink-0 accent-fuchsia-500" />
                        <span className="min-w-0 text-[13px]">
                          <span className="block font-semibold text-white">{tr ? p.tr.name : p.en.name}</span>
                          <span className="block text-[11.5px] leading-snug text-slate-400">{tr ? p.tr.desc : p.en.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title={tr ? "2 · Arka plan" : "2 · Background"}>
              <div role="radiogroup" aria-label={tr ? "Arka plan" : "Background"} className="grid grid-cols-5 gap-2">
                {BACKGROUNDS.map((b) => {
                  const on = bg === b.id;
                  return (
                    <label key={b.id} title={tr ? b.tr : b.en} className="group relative flex cursor-pointer flex-col items-center gap-1">
                      <input type="radio" name="photo-bg" checked={on} onChange={() => { setBg(b.id); if (b.id === "transparent") setFormat("png"); else if (format === "png" && !circle) setFormat("jpg"); }} className="peer sr-only" />
                      <span className={`h-10 w-10 rounded-full ring-2 transition ${on ? "ring-fuchsia-400 ring-offset-2 ring-offset-slate-900" : "ring-white/15 group-hover:ring-white/40"}`} style={{ background: b.id === "custom" ? b.swatch : b.swatch }} />
                      <span className={`text-center text-[10px] leading-tight ${on ? "font-bold text-fuchsia-100" : "text-slate-400"}`}>{tr ? b.tr : b.en}</span>
                      {on ? <Check className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-fuchsia-500 p-0.5 text-white" /> : null}
                    </label>
                  );
                })}
              </div>
              {bg === "custom" ? (
                <label className="mt-3 flex items-center gap-3 text-[12px] text-slate-300"><input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-white/10 bg-transparent" />{customColor.toUpperCase()}</label>
              ) : null}
              {preset.strict && bg !== "white" && bg !== "lightgray" ? <p className="mt-3 text-[11.5px] text-amber-300/90">{tr ? "Resmî başvurularda genellikle beyaz ya da açık gri düz fon istenir." : "Official applications usually require a plain white or light grey background."}</p> : null}
            </Section>

            <Section title={tr ? "3 · Kadraj ve düzeltmeler" : "3 · Framing & fixes"}>
              <Check_ checked={straighten} onChange={setStraighten} label={tr ? "Başı düzelt" : "Straighten head"} hint={tr ? "Eğik duruşu göz hattına göre dengeler" : "Levels a tilted head using the eye line"} />
              <Check_ checked={enhance} onChange={setEnhance} label={tr ? "Işığı otomatik iyileştir" : "Auto-enhance light"} hint={tr ? "Karanlık ya da soluk yüzü dengeler (yüz hatlarını değiştirmez)" : "Balances dark or flat faces (never alters facial features)"} />
              <Check_ checked={circle} onChange={setCircle} label={tr ? "Yuvarlak kırp" : "Round crop"} hint={tr ? "Profil resimleri için; PNG önerilir" : "For avatars; PNG recommended"} />
              <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                <Range label={tr ? "Baş boyutu" : "Head size"} value={Math.round((headRatio ?? (preset.head[0] + preset.head[1]) / 2) * 100)} min={20} max={90} step={1} onChange={(v) => setHeadRatio(v / 100)} fmt={(v) => `%${v}`} />
                <Range label={tr ? "Sağa / sola" : "Left / right"} value={Math.round(offsetX * 100)} min={-25} max={25} step={1} onChange={(v) => setOffsetX(v / 100)} fmt={(v) => `${v}`} />
                <Range label={tr ? "Yukarı / aşağı" : "Up / down"} value={Math.round(offsetY * 100)} min={-25} max={25} step={1} onChange={(v) => setOffsetY(v / 100)} fmt={(v) => `${v}`} />
                <Range label={tr ? "Parlaklık" : "Brightness"} value={brightness} min={-40} max={40} step={1} onChange={setBrightness} fmt={(v) => `${v > 0 ? "+" : ""}${v}`} />
                <button type="button" onClick={resetAdjust} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-white"><RotateCcw className="h-3.5 w-3.5" />{tr ? "Ayarları sıfırla" : "Reset adjustments"}</button>
              </div>
            </Section>

            <Section title={tr ? "4 · Çıktı" : "4 · Output"}>
              <div role="radiogroup" className="flex gap-2">
                {(["jpg", "png"] as const).map((f) => (
                  <label key={f} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold ${format === f ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-white" : "border-white/10 bg-white/[0.02] text-slate-300"}`}>
                    <input type="radio" name="photo-format" checked={format === f} onChange={() => setFormat(f)} className="sr-only" />
                    {f === "jpg" ? "JPG" : tr ? "PNG (şeffaf olabilir)" : "PNG (can be transparent)"}
                  </label>
                ))}
              </div>
              {format === "jpg" && bg === "transparent" ? <p className="mt-2 text-[11.5px] text-amber-300/90">{tr ? "JPG şeffaflığı desteklemez; beyaz zemin eklenir. Şeffaflık için PNG seçin." : "JPG can't be transparent; a white background is added. Choose PNG to keep transparency."}</p> : null}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-[12px] text-slate-300">{tr ? "Çözünürlük (dpi)" : "Resolution (dpi)"}
                  <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white">
                    <option value={300}>300 {tr ? "(baskı)" : "(print)"}</option><option value={150}>150</option><option value={96}>96 {tr ? "(ekran)" : "(screen)"}</option>
                  </select>
                </label>
                <label className="text-[12px] text-slate-300">{tr ? "En fazla boyut (KB)" : "Max size (KB)"}
                  <input inputMode="numeric" placeholder={tr ? "sınırsız" : "no limit"} value={maxKb} disabled={format === "png"} onChange={(e) => setMaxKb(e.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white disabled:opacity-40" />
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[50, 100, 250, 500].map((k) => (
                  <button key={k} type="button" disabled={format === "png"} onClick={() => setMaxKb(String(k))} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.12] disabled:opacity-40">{k} KB</button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{tr ? "e-Devlet, kurum ve başvuru formları genellikle dosya boyutu sınırı koyar." : "Portals and application forms often cap the file size."}</p>

              {preset.mmW ? (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="text-[12px] font-semibold text-slate-300">{tr ? "Baskı sayfası (aynı fotoğraftan çok adet)" : "Print sheet (many copies)"}</p>
                  <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
                    {([{ id: "none", tr: "Yok", en: "None" }, ...SHEETS] as { id: SheetId; tr: string; en: string }[]).map((s) => (
                      <label key={s.id} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-[12px] font-semibold ${sheet === s.id ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-white" : "border-white/10 bg-white/[0.02] text-slate-300"}`}>
                        <input type="radio" name="photo-sheet" checked={sheet === s.id} onChange={() => setSheet(s.id)} className="sr-only" />{tr ? s.tr : s.en}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 border-t border-white/10 pt-3">
                <Check_ checked={multi} onChange={(v) => { setMulti(v); if (v && !multiIds.length) setMultiIds([preset.id]); }} label={tr ? "Birden fazla ölçüyü birlikte indir (ZIP)" : "Download several sizes together (ZIP)"} hint={tr ? "Aynı fotoğraftan, seçtiğiniz tüm ölçüler" : "Every size you pick from the same photo"} />
                {multi ? (
                  <div className="mt-2 grid max-h-52 gap-1 overflow-auto pr-1">
                    {PRESETS.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12px] text-slate-300 hover:bg-white/[0.04]">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-fuchsia-500" checked={multiIds.includes(p.id)} onChange={(e) => setMultiIds((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))} />
                        {tr ? p.tr.name : p.en.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </Section>

            <div className="space-y-2">
              <button type="button" onClick={() => void downloadMain()} disabled={phase !== "ready" || busy} className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 px-6 py-4 text-[15px] font-bold text-white shadow-[0_12px_32px_-10px_rgba(168,85,247,0.7)] transition hover:brightness-110 disabled:opacity-40">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}{tr ? "Fotoğrafı indir" : "Download photo"}
              </button>
              {sheet !== "none" && preset.mmW ? (
                <button type="button" onClick={() => void downloadSheet()} disabled={phase !== "ready" || busy} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-[14px] font-semibold text-white hover:bg-white/[0.09] disabled:opacity-40"><Printer className="h-4 w-4" />{tr ? "Baskı sayfasını indir" : "Download print sheet"}</button>
              ) : null}
              {multi ? (
                <button type="button" onClick={() => void downloadZip()} disabled={phase !== "ready" || busy || !multiIds.length} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-[14px] font-semibold text-white hover:bg-white/[0.09] disabled:opacity-40"><Package className="h-4 w-4" />{tr ? `${multiIds.length} ölçüyü ZIP indir` : `Download ${multiIds.length} sizes as ZIP`}</button>
              ) : null}
              {done ? <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-2.5 text-[12.5px] text-emerald-200">{done}</p> : null}
            </div>
            {done ? <ToolRating toolSlug="ai-fotograf-studyosu" language={language} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
