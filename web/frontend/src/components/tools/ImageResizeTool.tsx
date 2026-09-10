import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, ExternalLink, Loader2, Share2, Trash2, Scaling } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { canEncode, extForFormat, type OutputFormat } from "../../lib/imageCompress";
import { resizeImage, SIZE_PRESETS, type FitMode } from "../../lib/imageResize";

/**
 * GÖRSEL BOYUTLANDIR — Görsel Sıkıştır ile AYNI kabuk/akış: standart yükleme
 * alanı + ayar kartı + sonuç ekranı. Ölçekleme pica (Lanczos/mks2013) ile
 * tamamen CİHAZDA yapılır; dosya sunucuya yüklenmez.
 */

type Format = OutputFormat | "auto";
type Result = {
  blob: Blob;
  filename: string;
  saved: "picker" | "download";
  width: number;
  height: number;
  inBytes: number;
  outBytes: number;
  upscaled: boolean;
};

const MAX_BYTES = 80 * 1024 * 1024;

function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function acceptFor(f: OutputFormat): Record<string, string[]> {
  if (f === "image/png") return { "image/png": [".png"] };
  if (f === "image/webp") return { "image/webp": [".webp"] };
  return { "image/jpeg": [".jpg", ".jpeg"] };
}

/** "Otomatik" biçim — kaydetme penceresi işlemden önce açıldığı için anında karar. */
function resolveFormat(chosen: Format, file: File, webpOk: boolean): OutputFormat {
  if (chosen !== "auto") return chosen;
  if (webpOk) return "image/webp";
  const t = (file.type || "").toLowerCase();
  if (t === "image/png" || t === "image/webp" || t === "image/gif") return "image/png";
  return "image/jpeg";
}

export function ImageResizeTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [srcDims, setSrcDims] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [lockRatio, setLockRatio] = useState(true);
  const [preset, setPreset] = useState("custom");
  const [fit, setFit] = useState<FitMode>("cover");
  const [background, setBackground] = useState("#ffffff");
  const [format, setFormat] = useState<Format>("auto");
  const [quality, setQuality] = useState(85);
  const [webpOk, setWebpOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reSaved, setReSaved] = useState(false);
  const saveHandleRef = useRef<FileSystemFileHandle | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void canEncode("image/webp").then((ok) => { if (alive) setWebpOk(ok); });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const addFiles = useCallback((incoming: File[]) => {
    setError(null);
    const img = incoming.find((f) => f.type.startsWith("image/"));
    if (!img) {
      setError(tr ? "Lütfen görsel (JPG/PNG/WebP) ekleyin." : "Please add an image (JPG/PNG/WebP).");
      return;
    }
    if (img.size > MAX_BYTES) {
      setError(tr ? "Görsel 80 MB'ı aşıyor." : "The image exceeds 80 MB.");
      return;
    }
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(img);
    });
    setFile(img);
    setResult(null);
    saveHandleRef.current = null;
    // Kaynak ölçüsünü oku → varsayılan hedef olarak kendi ölçüsünü öner.
    const probe = new Image();
    probe.onload = () => {
      setSrcDims({ w: probe.naturalWidth, h: probe.naturalHeight });
      setWidth(probe.naturalWidth);
      setHeight(probe.naturalHeight);
      setPreset("custom");
    };
    probe.src = URL.createObjectURL(img);
  }, [tr]);

  useEffect(() => {
    if (file) settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [file]);

  const reset = () => {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFile(null);
    setSrcDims(null);
    setResult(null);
    setError(null);
    saveHandleRef.current = null;
  };

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = SIZE_PRESETS.find((x) => x.id === id);
    if (p) {
      setWidth(p.w);
      setHeight(p.h);
      setLockRatio(false);
    }
  };

  const onWidth = (v: number) => {
    setPreset("custom");
    setWidth(v);
    if (lockRatio && srcDims && v > 0) {
      setHeight(Math.max(1, Math.round((v * srcDims.h) / srcDims.w)));
    }
  };
  const onHeight = (v: number) => {
    setPreset("custom");
    setHeight(v);
    if (lockRatio && srcDims && v > 0) {
      setWidth(Math.max(1, Math.round((v * srcDims.w) / srcDims.h)));
    }
  };

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  const run = async () => {
    setError(null);
    if (!file) {
      setError(tr ? "Önce bir görsel ekleyin." : "Add an image first.");
      return;
    }
    if (width < 1 || height < 1 || width > 12000 || height > 12000) {
      setError(tr ? "Genişlik ve yükseklik 1–12000 piksel arasında olmalı." : "Width and height must be between 1 and 12000 pixels.");
      return;
    }
    const outFormat = resolveFormat(format, file, webpOk);
    const outName = `${(file.name || "gorsel").replace(/\.[^.]+$/, "")}-${width}x${height}.${extForFormat(outFormat)}`;

    // Kaydetme yerini SOR (ağır işlemden önce, kullanıcı aktivasyonu geçerliyken).
    let saveHandle: FileSystemFileHandle | null = null;
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        saveHandle = await win.showSaveFilePicker({
          suggestedName: outName,
          types: [{ description: tr ? "Görsel" : "Image", accept: acceptFor(outFormat) }],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    try {
      setBusy(true);
      const out = await resizeImage(file, {
        width,
        height,
        fit,
        format: outFormat,
        quality: Math.min(0.95, Math.max(0.2, quality / 100)),
        background: fit === "contain" ? background : "transparent",
      });

      if (saveHandle) {
        const w = await saveHandle.createWritable();
        await w.write(out.blob);
        await w.close();
        saveHandleRef.current = saveHandle;
        setResult({
          blob: out.blob,
          filename: saveHandle.name || outName,
          saved: "picker",
          width: out.width,
          height: out.height,
          inBytes: file.size,
          outBytes: out.blob.size,
          upscaled: out.upscaled,
        });
      } else {
        downloadBlob(out.blob, outName);
        setResult({
          blob: out.blob,
          filename: outName,
          saved: "download",
          width: out.width,
          height: out.height,
          inBytes: file.size,
          outBytes: out.blob.size,
          upscaled: out.upscaled,
        });
      }
    } catch {
      setError(tr ? "İşlem sırasında bir hata oluştu." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  async function redownload() {
    if (!result) return;
    const h = saveHandleRef.current;
    if (h) {
      try {
        const w = await h.createWritable();
        await w.write(result.blob);
        await w.close();
        setReSaved(true);
        setTimeout(() => setReSaved(false), 2500);
        return;
      } catch {
        /* izin düştü → yeniden indir */
      }
    }
    downloadBlob(result.blob, result.filename);
  }

  function openResult() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const canShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === "function";
  async function shareResult() {
    if (!result) return;
    const f = new File([result.blob], result.filename, { type: result.blob.type });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [f] }) && nav.share) {
        await nav.share({ files: [f], title: result.filename });
      }
    } catch {
      /* iptal / desteklenmiyor */
    }
  }

  // ── Sonuç ekranı — Görsel Sıkıştır ile AYNI ──
  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
          <Check className="h-8 w-8" />
        </div>
        <p className="mt-4 text-xl font-bold text-white">
          {tr
            ? result.saved === "picker" ? "Kaydedildi! 🎉" : "İndirildi! 🎉"
            : result.saved === "picker" ? "Saved! 🎉" : "Downloaded! 🎉"}
        </p>
        <div className="mx-auto mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3.5 py-2 text-[13px] font-medium text-emerald-200">
          <Check className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {tr
              ? result.saved === "picker"
                ? `«${result.filename}» seçtiğin konuma kaydedildi`
                : `«${result.filename}» İndirilenler klasörüne indirildi`
              : result.saved === "picker"
                ? `«${result.filename}» saved to your chosen location`
                : `«${result.filename}» saved to your Downloads folder`}
          </span>
        </div>
        <p className="mt-3 text-[13px] font-semibold text-emerald-200">
          {result.width} × {result.height} px · {humanSize(result.outBytes)}
        </p>
        {result.upscaled && (
          <p className="mt-1 text-[12px] text-amber-300/90">
            {tr
              ? "Görsel kaynağından büyütüldü — kayıp detay geri getirilemez, en iyi netlik için uygulandı."
              : "The image was enlarged beyond its source — lost detail cannot be recreated; it was sharpened for the best result."}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-400">
          {tr ? "Görselin cihazından hiç çıkmadı — tamamen gizli." : "Your image never left your device — fully private."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={openResult}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.12] px-6 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <ExternalLink className="h-4 w-4" />
            {tr ? "Aç" : "Open"}
          </button>
          <button
            type="button"
            onClick={() => void redownload()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
          >
            {reSaved ? <Check className="h-4 w-4 text-emerald-400" /> : <Download className="h-4 w-4" />}
            {tr ? "Tekrar indir" : "Download again"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => void shareResult()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
            >
              <Share2 className="h-4 w-4" />
              {tr ? "Paylaş" : "Share"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            {tr ? "Ölçüyü değiştir" : "Change size"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            {tr ? "Yeni görsel" : "New image"}
          </button>
        </div>
        <ValueMomentNudge language={language} source="resize_success" />
      </motion.div>
    );
  }

  const fitOptions: Array<{ id: FitMode; tr: string; en: string; trDesc: string; enDesc: string }> = [
    { id: "cover", tr: "Doldur", en: "Fill", trDesc: "Ölçüyü tam doldurur, taşan kenarlar ortadan kırpılır.", enDesc: "Fills the size exactly; overflowing edges are cropped from the centre." },
    { id: "contain", tr: "Sığdır", en: "Fit", trDesc: "Görselin tamamı sığar, boşluklar seçtiğin renkle dolar.", enDesc: "The whole image fits; the gaps are filled with your chosen colour." },
    { id: "stretch", tr: "Esnet", en: "Stretch", trDesc: "Oranı bozarak tam ölçüye esnetir.", enDesc: "Stretches to the exact size, ignoring the aspect ratio." },
  ];

  return (
    <div>
      <div className="tool-form">
        <WorkspaceUploadField
          language={language}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          disabled={busy}
          appendMode={!!file}
          note={tr ? "JPG, PNG, WebP · 80 MB'a kadar" : "JPG, PNG, WebP · up to 80 MB"}
          onFiles={addFiles}
        />
      </div>

      {file && (
        <>
          {/* Seçili görsel */}
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
            {previewUrl && <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-100">{file.name}</p>
              <p className="text-[11px] text-slate-500">
                {srcDims ? `${srcDims.w} × ${srcDims.h} px · ` : ""}
                {humanSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label={tr ? "Kaldır" : "Remove"}
              className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Ayarlar */}
          <div ref={settingsRef} className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-slate-300">{tr ? "Hazır ölçüler" : "Ready-made sizes"}</span>
                <select
                  value={preset}
                  onChange={(e) => applyPreset(e.target.value)}
                  className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100"
                >
                  <option value="custom">{tr ? "Özel ölçü" : "Custom size"}</option>
                  {SIZE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(tr ? p.tr : p.en)} — {p.w} × {p.h}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-slate-300">{tr ? "Genişlik (px)" : "Width (px)"}</span>
                <input
                  type="number"
                  min={1}
                  max={12000}
                  value={width}
                  onChange={(e) => onWidth(Number(e.target.value))}
                  className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-slate-300">{tr ? "Yükseklik (px)" : "Height (px)"}</span>
                <input
                  type="number"
                  min={1}
                  max={12000}
                  value={height}
                  onChange={(e) => onHeight(Number(e.target.value))}
                  className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100"
                />
              </label>

              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={lockRatio}
                  onChange={(e) => setLockRatio(e.target.checked)}
                  className="h-4 w-4 accent-cyan-500"
                />
                <span className="text-[12px] font-medium text-slate-300">
                  {tr ? "Oranı koru (bir kenarı yazınca diğeri hesaplansın)" : "Keep aspect ratio (typing one side computes the other)"}
                </span>
              </label>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-slate-300">{tr ? "Ölçüye oturtma" : "How it fits"}</span>
                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-950/40 p-1 ring-1 ring-white/[0.06]">
                  {fitOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFit(o.id)}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                        fit === o.id ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/30" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {tr ? o.tr : o.en}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] leading-relaxed text-slate-500">
                  {tr ? fitOptions.find((o) => o.id === fit)?.trDesc : fitOptions.find((o) => o.id === fit)?.enDesc}
                </span>
              </div>

              {fit === "contain" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-slate-300">{tr ? "Boşluk rengi" : "Padding colour"}</span>
                  <input
                    type="color"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="h-9 w-full cursor-pointer rounded-lg border border-white/12 bg-[#0b1020] px-1"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-slate-300">{tr ? "Biçim" : "Format"}</span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                  className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100"
                >
                  <option value="auto">{tr ? "Otomatik (en küçük)" : "Automatic (smallest)"}</option>
                  <option value="image/webp">WebP (.webp)</option>
                  <option value="image/jpeg">JPEG (.jpg)</option>
                  <option value="image/png">PNG (.png)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-slate-300">
                  {tr ? "Kalite" : "Quality"}: <span className="text-cyan-300">%{quality}</span>
                </span>
                <input
                  type="range"
                  min={40}
                  max={95}
                  step={5}
                  value={quality}
                  disabled={format === "image/png"}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="accent-cyan-500 disabled:opacity-40"
                />
              </label>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              {tr
                ? "Ölçekleme Lanczos (mks2013) süzgeciyle yapılır — tarayıcının kendi ölçeklemesinden belirgin biçimde daha net sonuç verir. Her şey cihazınızda çalışır."
                : "Scaling uses a Lanczos (mks2013) filter — noticeably sharper than the browser's built-in scaling. Everything runs on your device."}
            </p>
            {srcDims && (width > srcDims.w || height > srcDims.h) && (
              <p className="mt-1.5 text-[11px] font-medium text-amber-300/90">
                {tr
                  ? `Kaynak ${srcDims.w} × ${srcDims.h} px — istediğiniz ölçü daha büyük. Büyütme yeni detay yaratmaz.`
                  : `Source is ${srcDims.w} × ${srcDims.h} px — your target is larger. Enlarging cannot create new detail.`}
              </p>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || !file}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {tr ? "Boyutlandırılıyor…" : "Resizing…"}
          </>
        ) : (
          <>
            <Scaling className="h-5 w-5" />
            {tr ? "Boyutlandır" : "Resize"} →
          </>
        )}
      </button>
    </div>
  );
}
