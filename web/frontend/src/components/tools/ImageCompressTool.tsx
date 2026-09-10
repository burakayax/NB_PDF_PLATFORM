import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Download, ExternalLink, Loader2, Share2, Trash2, Image as ImageIcon } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { zipStore } from "../../lib/zipStore";
import {
  canEncode,
  compressImage,
  extForFormat,
  extOfName,
  type CompressOutcome,
  type OutputFormat,
} from "../../lib/imageCompress";

/**
 * GÖRSEL SIKIŞTIR — Görsel→PDF (GuestToolCore) ile AYNI akış/kabuk:
 * ToolDropzone (sürükle-bırak) + dosya listesi + işle + sonuç ekranı
 * (Tekrar indir / Paylaş / Yeni işlem). Tamamen CİHAZDA (canvas), dosya yüklenmez.
 * Tek görsel → sıkıştırılmış görsel; çok görsel → tek ZIP.
 */

/** "auto" = her görsel için en küçük sonucu veren biçimi kendisi seçer. */
type Format = OutputFormat | "auto";
type Picked = { id: string; file: File; previewUrl: string };
type Result = {
  blob: Blob;
  filename: string;
  saved: "picker" | "download";
  count: number;
  /** Girdi ve çıktı toplam boyutları — kazancı göstermek için. */
  inBytes: number;
  outBytes: number;
  /** Sıkıştırma kazanç sağlamadığı için orijinali korunan görsel sayısı. */
  keptCount: number;
};

const MAX_FILES = 30;
const MAX_BYTES = 80 * 1024 * 1024;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
/** Save picker'da gösterilecek zengin uzantı listesi (biçime göre). */
function acceptFor(f: OutputFormat): Record<string, string[]> {
  if (f === "image/png") return { "image/png": [".png"] };
  if (f === "image/webp") return { "image/webp": [".webp"] };
  return { "image/jpeg": [".jpg", ".jpeg"] };
}

/**
 * "Otomatik" biçim kararı — dosya seçme penceresi işlemden ÖNCE açıldığı için
 * uzantının baştan bilinmesi şart; bu yüzden karar kaynağın türüne göre anında
 * verilir. WebP en küçük sonucu verir; tarayıcı WebP kodlayamıyorsa şeffaflık
 * taşıyabilen kaynaklar PNG, diğerleri JPEG olur.
 */
function resolveFormat(chosen: Format, file: File, webpOk: boolean): OutputFormat {
  if (chosen !== "auto") return chosen;
  if (webpOk) return "image/webp";
  const t = (file.type || "").toLowerCase();
  if (t === "image/png" || t === "image/webp" || t === "image/gif") return "image/png";
  return "image/jpeg";
}

export function ImageCompressTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const [files, setFiles] = useState<Picked[]>([]);
  const [quality, setQuality] = useState(70);
  const [format, setFormat] = useState<Format>("auto");
  /** 0 = orijinal ölçü. Uzun kenar sınırı — en büyük kazancı bu sağlar. */
  const [maxDim, setMaxDim] = useState(0);
  const [webpOk, setWebpOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reSaved, setReSaved] = useState(false);
  const saveHandleRef = useRef<FileSystemFileHandle | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (files.length > 0) listRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [files.length]);

  // Tarayıcı WebP kodlayabiliyor mu? ("Otomatik" biçim kararı buna bakar.)
  useEffect(() => {
    let alive = true;
    void canEncode("image/webp").then((ok) => { if (alive) setWebpOk(ok); });
    return () => { alive = false; };
  }, []);

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
    const first = files[0]!.file;
    // Kaydetme penceresi işlemden ÖNCE açıldığı için uzantı şimdiden belli olmalı.
    const firstFormat = resolveFormat(format, first, webpOk);
    const outName = multi
      ? "sikistirilmis-gorseller.zip"
      : `${(first.name || "gorsel").replace(/\.[^.]+$/, "")}-sikistirilmis.${extForFormat(firstFormat)}`;

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
              accept: multi ? { "application/zip": [".zip"] } : acceptFor(firstFormat),
            },
          ],
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    try {
      setBusy(true);
      // Sıralı işle: aynı anda 30 büyük görseli çözmek belleği şişirir.
      const outcomes: CompressOutcome[] = [];
      for (const p of files) {
        outcomes.push(
          await compressImage(p.file, {
            quality: q,
            maxDim,
            format: resolveFormat(format, p.file, webpOk),
          }),
        );
      }
      const keptCount = outcomes.filter((o) => o.kept).length;
      const outSum = outcomes.reduce((n, o) => n + o.blob.size, 0);

      let outBlob: Blob;
      if (multi) {
        const entries = await Promise.all(
          outcomes.map(async (o, i) => {
            const base = (files[i]!.file.name || `gorsel-${i + 1}`).replace(/\.[^.]+$/, "");
            return { name: `${base}.${o.ext}`, data: new Uint8Array(await o.blob.arrayBuffer()) };
          }),
        );
        outBlob = new Blob([zipStore(entries) as BlobPart], { type: "application/zip" });
      } else {
        outBlob = outcomes[0]!.blob;
      }

      // Tek görselde orijinal korunduysa uzantı seçilen adla uyuşmayabilir
      // (ör. .webp adına JPEG baytı yazmak). Bu durumda dosyayı kendi adıyla indir.
      const single = !multi ? outcomes[0]! : null;
      const extMismatch =
        !!single && single.kept && extOfName(saveHandle?.name || outName) !== (single.ext || "");
      const finalName =
        single && single.kept && extMismatch ? first.name : saveHandle?.name || outName;

      if (saveHandle && !extMismatch) {
        const w = await saveHandle.createWritable();
        await w.write(outBlob);
        await w.close();
        saveHandleRef.current = saveHandle;
        setResult({
          blob: outBlob,
          filename: saveHandle.name || outName,
          saved: "picker",
          count: files.length,
          inBytes: totalIn,
          outBytes: multi ? outBlob.size : outSum,
          keptCount,
        });
      } else {
        saveHandleRef.current = null;
        downloadBlob(outBlob, finalName);
        setResult({
          blob: outBlob,
          filename: finalName,
          saved: "download",
          count: files.length,
          inBytes: totalIn,
          outBytes: multi ? outBlob.size : outSum,
          keptCount,
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
        {(() => {
          const saved = result.inBytes - result.outBytes;
          const pct = result.inBytes > 0 ? Math.round((saved / result.inBytes) * 100) : 0;
          if (saved > 0) {
            return (
              <p className="mt-3 text-[13px] font-semibold text-emerald-200">
                {humanSize(result.inBytes)} → {humanSize(result.outBytes)}{" "}
                <span className="text-emerald-300">
                  ({tr ? `%${pct} küçüldü` : `${pct}% smaller`})
                </span>
              </p>
            );
          }
          return (
            <p className="mt-3 text-[13px] font-semibold text-slate-300">
              {tr
                ? `Görselleriniz zaten optimize — ${humanSize(result.inBytes)} olarak korundu.`
                : `Your images were already optimized — kept at ${humanSize(result.inBytes)}.`}
            </p>
          );
        })()}
        {result.keptCount > 0 && result.outBytes < result.inBytes && (
          <p className="mt-1 text-[12px] text-slate-400">
            {tr
              ? `${result.keptCount} görsel zaten optimizeydi; orijinali korundu.`
              : `${result.keptCount} image(s) were already optimized; the original was kept.`}
          </p>
        )}
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
      <div className="tool-form">
        <WorkspaceUploadField
          language={language}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple
          disabled={busy}
          appendMode={files.length > 0}
          note={tr ? "JPG, PNG, WebP · 80 MB'a kadar" : "JPG, PNG, WebP · up to 80 MB"}
          onFiles={(fl) => addFiles(fl)}
        />
      </div>

      {files.length > 0 && (
        <>
          {/* Ayarlar — kalite + biçim */}
          <div className="mt-4 grid gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">
                {tr ? "Kalite" : "Quality"}: <span className="text-cyan-300">%{quality}</span>
              </span>
              <input
                type="range"
                min={20}
                max={95}
                step={5}
                value={quality}
                disabled={format === "image/png"}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="accent-cyan-500 disabled:opacity-40"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">{tr ? "Biçim" : "Format"}</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100">
                <option value="auto">{tr ? "Otomatik (en küçük)" : "Automatic (smallest)"}</option>
                <option value="image/webp">WebP (.webp)</option>
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">{tr ? "Ölçü" : "Size"}</span>
              <select value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))} className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100">
                <option value={0}>{tr ? "Orijinal ölçü" : "Original size"}</option>
                <option value={2560}>{tr ? "Uzun kenar 2560 px" : "Long edge 2560 px"}</option>
                <option value={1920}>{tr ? "Uzun kenar 1920 px" : "Long edge 1920 px"}</option>
                <option value={1280}>{tr ? "Uzun kenar 1280 px" : "Long edge 1280 px"}</option>
                <option value={800}>{tr ? "Uzun kenar 800 px" : "Long edge 800 px"}</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {format === "image/png"
              ? tr
                ? "PNG kayıpsızdır — kalite ayarı işlemez. En çok kazanç için «Otomatik» veya WebP seçin."
                : "PNG is lossless — the quality slider has no effect. Pick «Automatic» or WebP for the biggest savings."
              : tr
                ? "Sonuç orijinalden büyük çıkarsa dosyanız olduğu gibi korunur — hiçbir görsel büyümez."
                : "If the result would be larger than the original, your file is kept as-is — nothing ever grows."}
          </p>

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
