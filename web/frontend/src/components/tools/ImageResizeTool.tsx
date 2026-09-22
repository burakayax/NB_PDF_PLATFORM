import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { canEncode, extForFormat, type OutputFormat } from "../../lib/imageCompress";
import { resizeImage, SIZE_PRESETS, type FitMode } from "../../lib/imageResize";

/**
 * GÖRSEL BOYUTLANDIR — çalışma alanındaki diğer araçlarla AYNI kabuk:
 * standart yükleme alanı (WorkspaceUploadField) + `.tool-form` ayar alanları +
 * `.primary-action` düğmesi + ortak sonuç ekranı (ToolResultPanel).
 * Ölçekleme pica (Lanczos/mks2013) ile tamamen CİHAZDA yapılır.
 */

type Format = OutputFormat | "auto";
type Result = {
  blob: Blob;
  filename: string;
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

/** "Otomatik" biçim — kaynağın türüne göre en küçük sonucu verecek biçim. */
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
    // Kaynak ölçüsünü oku → varsayılan hedef olarak kendi ölçüsünü öner.
    const probe = new Image();
    const probeUrl = URL.createObjectURL(img);
    probe.onload = () => {
      setSrcDims({ w: probe.naturalWidth, h: probe.naturalHeight });
      setWidth(probe.naturalWidth);
      setHeight(probe.naturalHeight);
      setPreset("custom");
      URL.revokeObjectURL(probeUrl);
    };
    probe.src = probeUrl;
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
    if (lockRatio && srcDims && v > 0) setHeight(Math.max(1, Math.round((v * srcDims.h) / srcDims.w)));
  };
  const onHeight = (v: number) => {
    setPreset("custom");
    setHeight(v);
    if (lockRatio && srcDims && v > 0) setWidth(Math.max(1, Math.round((v * srcDims.w) / srcDims.h)));
  };

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
      setResult({
        blob: out.blob,
        filename: `${(file.name || "gorsel").replace(/\.[^.]+$/, "")}-${out.width}x${out.height}.${extForFormat(outFormat)}`,
        width: out.width,
        height: out.height,
        inBytes: file.size,
        outBytes: out.blob.size,
        upscaled: out.upscaled,
      });
    } catch {
      setError(tr ? "İşlem sırasında bir hata oluştu." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // ── Sonuç — TÜM araçlarla ortak panel ─────────────────────────────────────
  if (result) {
    return (
      <ToolResultPanel
        ratingToolSlug="gorsel-boyutlandir"
        blob={result.blob}
        filename={result.filename}
        language={language}
        processedOnDevice
        onClose={() => setResult(null)}
      >
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">
          {result.width} × {result.height} px · {humanSize(result.outBytes)}
          {result.outBytes < result.inBytes ? (
            <span className="text-emerald-300">
              {" "}({tr ? "önce" : "was"} {humanSize(result.inBytes)})
            </span>
          ) : null}
        </p>
        {result.upscaled && (
          <p className="mt-1 text-[12px] text-amber-300/90">
            {tr
              ? "Görsel kaynağından büyütüldü — kayıp detay geri getirilemez, en iyi netlik için işlendi."
              : "The image was enlarged beyond its source — lost detail cannot be recreated; it was sharpened for the best result."}
          </p>
        )}
        <ValueMomentNudge language={language} source="resize_success" />
      </ToolResultPanel>
    );
  }

  const fitHint: Record<FitMode, { tr: string; en: string }> = {
    cover: { tr: "Ölçüyü tam doldurur, taşan kenarlar ortadan kırpılır.", en: "Fills the size exactly; overflowing edges are cropped from the centre." },
    contain: { tr: "Görselin tamamı sığar, boşluklar seçtiğin renkle dolar.", en: "The whole image fits; the gaps are filled with your chosen colour." },
    stretch: { tr: "Oranı bozarak tam ölçüye esnetir.", en: "Stretches to the exact size, ignoring the aspect ratio." },
  };

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

        {file && (
          <>
            {/* Seçilen görsel */}
            <div className="field field--full" ref={settingsRef}>
              <span>{tr ? "Seçilen görsel" : "Selected image"}</span>
              {/* BÜYÜK ÖNİZLEME. Tırnak büyüklüğünde bir kare, vesikalık hazırlayan
                  kullanıcıya hiçbir şey söylemiyordu: yüzün ortada olup olmadığı,
                  fotoğrafın doğru fotoğraf olup olmadığı görülemiyordu. Önizleme
                  seçilen hedef ORANINDA gösterilir; kullanıcı daha düğmeye basmadan
                  çıktının biçimini görür. */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex items-start gap-3">
                  {previewUrl && (
                    <div
                      className="shrink-0 overflow-hidden rounded-lg bg-[#0b0f1a] ring-1 ring-white/10"
                      style={{
                        width: 112,
                        height: Math.round((112 * Math.max(1, height)) / Math.max(1, width)),
                        maxHeight: 190,
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt={tr ? "Seçilen görselin önizlemesi" : "Preview of the selected image"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">{file.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {srcDims ? `${srcDims.w} × ${srcDims.h} px · ` : ""}
                      {humanSize(file.size)}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {tr ? "Çıkacak ölçü" : "Output size"}:{" "}
                      <span className="font-semibold text-nb-accent">
                        {width} × {height} px
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {tr
                        ? "Önizleme seçtiğiniz oranda gösterilir."
                        : "The preview is shown at the ratio you selected."}
                    </p>
                    <button
                      type="button"
                      onClick={reset}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tr ? "Kaldır" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <label className="field field--full">
              <span>{tr ? "Hazır ölçüler" : "Ready-made sizes"}</span>
              <select value={preset} onChange={(e) => applyPreset(e.target.value)}>
                <option value="custom">{tr ? "Özel ölçü" : "Custom size"}</option>
                {SIZE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(tr ? p.tr : p.en)} — {p.w} × {p.h}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                {tr
                  ? "ÖSYM, biyometrik ve vize fotoğrafı ölçüleriyle Instagram, Facebook, X, LinkedIn ve YouTube ölçüleri hazır gelir. Resmî başvurularda kurumun güncel şartını teyit edin; bu araç yalnızca ölçüyü ayarlar, arka planı değiştirmez."
                  : "Official photo sizes (Turkish exam, biometric, visa) plus Instagram, Facebook, X, LinkedIn and YouTube sizes are built in. For official applications, confirm the current requirement with the institution — this tool only sets the size, it does not change the background."}
              </span>
            </label>

            <label className="field">
              <span>{tr ? "Genişlik (piksel)" : "Width (pixels)"}</span>
              <input type="number" min={1} max={12000} value={width} onChange={(e) => onWidth(Number(e.target.value))} />
            </label>

            <label className="field">
              <span>{tr ? "Yükseklik (piksel)" : "Height (pixels)"}</span>
              <input type="number" min={1} max={12000} value={height} onChange={(e) => onHeight(Number(e.target.value))} />
            </label>

            <div className="field field--full">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={lockRatio}
                  onChange={(e) => setLockRatio(e.target.checked)}
                  className="h-4 w-4 accent-cyan-500"
                  style={{ width: "1rem" }}
                />
                <span className="text-[13px] font-medium text-nb-muted">
                  {tr ? "Oranı koru — bir kenarı yazınca diğeri hesaplansın" : "Keep aspect ratio — typing one side computes the other"}
                </span>
              </label>
            </div>

            <label className="field">
              <span>{tr ? "Ölçüye oturtma" : "How it fits"}</span>
              <select value={fit} onChange={(e) => setFit(e.target.value as FitMode)}>
                <option value="cover">{tr ? "Doldur (ortadan kırp)" : "Fill (centre crop)"}</option>
                <option value="contain">{tr ? "Sığdır (boşluk ekle)" : "Fit (add padding)"}</option>
                <option value="stretch">{tr ? "Esnet" : "Stretch"}</option>
              </select>
              <span className="field-hint">{tr ? fitHint[fit].tr : fitHint[fit].en}</span>
            </label>

            {fit === "contain" ? (
              <label className="field">
                <span>{tr ? "Boşluk rengi" : "Padding colour"}</span>
                <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-[46px] cursor-pointer p-1" />
              </label>
            ) : null}

            <label className="field">
              <span>{tr ? "Biçim" : "Format"}</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                <option value="auto">{tr ? "Otomatik (en küçük)" : "Automatic (smallest)"}</option>
                <option value="image/webp">WebP (.webp)</option>
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
            </label>

            <label className="field">
              <span>
                {tr ? "Kalite" : "Quality"}: <span className="text-nb-accent">%{quality}</span>
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
                style={{ padding: 0, border: 0, background: "transparent" }}
              />
              <span className="field-hint">
                {format === "image/png"
                  ? tr ? "PNG kayıpsızdır — kalite ayarı işlemez." : "PNG is lossless — the quality slider has no effect."
                  : tr ? "Ölçekleme Lanczos süzgeciyle yapılır; sonuç tarayıcının kendi ölçeklemesinden daha nettir." : "Scaling uses a Lanczos filter — sharper than the browser's built-in scaling."}
              </span>
            </label>

            {srcDims && (width > srcDims.w || height > srcDims.h) ? (
              <p className="field--full text-[12px] font-medium text-amber-300/90">
                {tr
                  ? `Kaynak ${srcDims.w} × ${srcDims.h} piksel — istediğiniz ölçü daha büyük. Büyütme yeni detay yaratmaz.`
                  : `Source is ${srcDims.w} × ${srcDims.h} px — your target is larger. Enlarging cannot create new detail.`}
              </p>
            ) : null}
          </>
        )}

        {error && (
          <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
            {error}
          </p>
        )}

        <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || !file}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr ? "Boyutlandırılıyor…" : "Resizing…"}
            </span>
          ) : (
            tr ? "Boyutlandır" : "Resize"
          )}
        </button>
      </div>
    </div>
  );
}
