import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, ExternalLink, Loader2, Share2, Trash2, Image as ImageIcon } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolDropzone } from "./ToolDropzone";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { zipStore } from "../../lib/zipStore";

/**
 * GÖRSEL SIKIŞTIR — Görsel→PDF (GuestToolCore) ile AYNI akış/kabuk:
 * ToolDropzone (sürükle-bırak) + dosya listesi + işle + sonuç ekranı
 * (Tekrar indir / Paylaş / Yeni işlem). Tamamen CİHAZDA (canvas), dosya yüklenmez.
 * Tek görsel → sıkıştırılmış görsel; çok görsel → tek ZIP.
 */

type Format = "image/jpeg" | "image/webp" | "image/png";
type Picked = { id: string; file: File; previewUrl: string };
type Result = { blob: Blob; filename: string; saved: "picker" | "download"; count: number };

const MAX_FILES = 30;
const MAX_BYTES = 80 * 1024 * 1024;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
const extFor = (f: Format) => (f === "image/webp" ? "webp" : f === "image/png" ? "png" : "jpg");
/** Save picker'da gösterilecek zengin uzantı listesi (biçime göre). */
function acceptFor(f: Format): Record<string, string[]> {
  if (f === "image/png") return { "image/png": [".png"] };
  if (f === "image/webp") return { "image/webp": [".webp"] };
  return { "image/jpeg": [".jpg", ".jpeg"] };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

async function compress(file: File, quality: number, maxDim: number, format: Format): Promise<Blob> {
  const img = await loadImage(file);
  try {
    let { width, height } = img;
    if (maxDim > 0 && Math.max(width, height) > maxDim) {
      const s = maxDim / Math.max(width, height);
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas ctx yok");
    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), format, quality);
    });
  } finally {
    if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  }
}

export function ImageCompressTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const [files, setFiles] = useState<Picked[]>([]);
  const [quality, setQuality] = useState(70);
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reSaved, setReSaved] = useState(false);
  const saveHandleRef = useRef<FileSystemFileHandle | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (files.length > 0) listRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [files.length]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setError(null);
    const imgs = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      setError(tr ? "Lütfen görsel (JPG/PNG/WebP) ekleyin." : "Please add image files (JPG/PNG/WebP).");
      return;
    }
    setFiles((prev) => {
      const next = [...prev];
      for (const f of imgs) {
        if (next.length >= MAX_FILES) break;
        next.push({ id: uid(), file: f, previewUrl: URL.createObjectURL(f) });
      }
      return next;
    });
  }, [tr]);

  const remove = (id: string) =>
    setFiles((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((p) => p.id !== id);
    });

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setResult(null);
    setError(null);
    saveHandleRef.current = null;
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

  const totalIn = files.reduce((s, f) => s + f.file.size, 0);

  const run = async () => {
    setError(null);
    if (files.length === 0) {
      setError(tr ? "En az 1 görsel ekleyin." : "Add at least 1 image.");
      return;
    }
    if (totalIn > MAX_BYTES) {
      setError(tr ? "Toplam boyut 80 MB'ı aşıyor." : "Total exceeds 80 MB.");
      return;
    }
    const q = Math.min(0.95, Math.max(0.2, quality / 100));
    const multi = files.length > 1;
    const outName = multi ? "sikistirilmis-gorseller.zip" : `${(files[0]!.file.name || "gorsel").replace(/\.[^.]+$/, "")}-sikistirilmis.${extFor(format)}`;

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
          types: [
            {
              description: multi ? (tr ? "ZIP arşivi" : "ZIP archive") : (tr ? "Görsel" : "Image"),
              accept: multi ? { "application/zip": [".zip"] } : acceptFor(format),
            },
          ],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    try {
      setBusy(true);
      const compressed = await Promise.all(files.map((f) => compress(f.file, q, 0, format)));
      let outBlob: Blob;
      if (multi) {
        const entries = await Promise.all(
          compressed.map(async (b, i) => {
            const base = (files[i]!.file.name || `gorsel-${i + 1}`).replace(/\.[^.]+$/, "");
            return { name: `${base}.${extFor(format)}`, data: new Uint8Array(await b.arrayBuffer()) };
          }),
        );
        outBlob = new Blob([zipStore(entries) as BlobPart], { type: "application/zip" });
      } else {
        outBlob = compressed[0]!;
      }

      if (saveHandle) {
        const w = await saveHandle.createWritable();
        await w.write(outBlob);
        await w.close();
        saveHandleRef.current = saveHandle;
        setResult({ blob: outBlob, filename: saveHandle.name || outName, saved: "picker", count: files.length });
      } else {
        downloadBlob(outBlob, outName);
        setResult({ blob: outBlob, filename: outName, saved: "download", count: files.length });
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
    const file = new File([result.blob], result.filename, { type: result.blob.type });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: result.filename });
      }
    } catch {
      /* iptal / desteklenmiyor */
    }
  }

  // ── Sonuç ekranı — Görsel→PDF ile AYNI ──
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
        <p className="mt-2 text-sm text-slate-400">
          {tr ? "Görselin cihazından hiç çıkmadı — tamamen gizli." : "Your image never left your device — fully private."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {result.count === 1 && (
            <button
              type="button"
              onClick={openResult}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/[0.12] px-6 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              <ExternalLink className="h-4 w-4" />
              {tr ? "Aç" : "Open"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void redownload()}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
          >
            {reSaved ? <Check className="h-4 w-4 text-emerald-400" /> : <Download className="h-4 w-4" />}
            {reSaved ? (tr ? "Tekrar kaydedildi ✓" : "Saved again ✓") : (tr ? "Tekrar indir" : "Download again")}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => void shareResult()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
            >
              <Share2 className="h-4 w-4" />
              {tr ? "Paylaş" : "Share"}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            {tr ? "Yeni işlem" : "New task"}
          </button>
        </div>
        <ValueMomentNudge language={language} source="guest_tool_success" />
      </motion.div>
    );
  }

  return (
    <div>
      <ToolDropzone
        toolId="gorsel-sikistir"
        tr={tr}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        multiple
        busy={busy}
        showBenefits={files.length === 0}
        onFiles={(fl) => addFiles(fl)}
        titleTr="Görselleri buraya sürükle"
        titleEn="Drag your images here"
        hintTr="ya da tıklayıp seç · JPG, PNG, WebP · 80 MB'a kadar"
        hintEn="or click to choose · JPG, PNG, WebP · up to 80 MB"
      />

      {files.length > 0 && (
        <>
          {/* Ayarlar — kalite + biçim */}
          <div className="mt-4 grid gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">
                {tr ? "Kalite" : "Quality"}: <span className="text-cyan-300">%{quality}</span>
              </span>
              <input type="range" min={20} max={95} step={5} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="accent-cyan-500" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">{tr ? "Biçim" : "Format"}</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100">
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/webp">WebP (.webp)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
            </label>
          </div>

          {/* Dosya listesi */}
          <div className="mt-3 mb-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px]">
            <span className="font-bold text-white">{files.length} {tr ? "görsel" : "images"} · {humanSize(totalIn)}</span>
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />{tr ? "Tümünü sil" : "Clear all"}
            </button>
          </div>
          <ul ref={listRef} className="space-y-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <img src={f.previewUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-100">{f.file.name}</p>
                  <p className="text-[11px] text-slate-500">{humanSize(f.file.size)}</p>
                </div>
                <button type="button" onClick={() => remove(f.id)} aria-label={tr ? "Kaldır" : "Remove"} className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">{error}</p>
      )}

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || files.length === 0}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(79,70,229,0.7)] ring-1 ring-white/10 transition hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {tr ? "İşleniyor…" : "Processing…"}
          </>
        ) : (
          <>
            <ImageIcon className="h-5 w-5" />
            {tr ? "Sıkıştır" : "Compress"} →
          </>
        )}
      </button>
    </div>
  );
}
