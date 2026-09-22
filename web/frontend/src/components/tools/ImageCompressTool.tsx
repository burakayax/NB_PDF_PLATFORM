import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { zipStore } from "../../lib/zipStore";
import {
  canEncode,
  compressImage,
  extForFormat,
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
  };

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
    const firstFormat = resolveFormat(format, first, webpOk);
    const outName = multi
      ? "sikistirilmis-gorseller.zip"
      : `${(first.name || "gorsel").replace(/\.[^.]+$/, "")}-sikistirilmis.${extForFormat(firstFormat)}`;

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
      let filename: string;
      if (multi) {
        const entries = await Promise.all(
          outcomes.map(async (o, i) => {
            const base = (files[i]!.file.name || `gorsel-${i + 1}`).replace(/\.[^.]+$/, "");
            return { name: `${base}.${o.ext}`, data: new Uint8Array(await o.blob.arrayBuffer()) };
          }),
        );
        outBlob = new Blob([zipStore(entries) as BlobPart], { type: "application/zip" });
        filename = outName;
      } else {
        const single = outcomes[0]!;
        outBlob = single.blob;
        // Orijinali korunduysa dosya kendi uzantısıyla inmeli.
        filename = single.kept
          ? first.name
          : `${(first.name || "gorsel").replace(/\.[^.]+$/, "")}-sikistirilmis.${single.ext}`;
      }

      setResult({
        blob: outBlob,
        filename,
        count: files.length,
        inBytes: totalIn,
        outBytes: multi ? outBlob.size : outSum,
        keptCount,
      });
    } catch {
      setError(tr ? "İşlem sırasında bir hata oluştu." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // ── Sonuç — TÜM araçlarla ortak panel ─────────────────────────────────────
  if (result) {
    const saved = result.inBytes - result.outBytes;
    const pct = result.inBytes > 0 ? Math.round((saved / result.inBytes) * 100) : 0;
    return (
      <ToolResultPanel
        ratingToolSlug="gorsel-sikistir"
        blob={result.blob}
        filename={result.filename}
        language={language}
        processedOnDevice
        onClose={() => setResult(null)}
      >
        {saved > 0 ? (
          <p className="mt-5 text-[13px] font-semibold text-emerald-200">
            {humanSize(result.inBytes)} → {humanSize(result.outBytes)}{" "}
            <span className="text-emerald-300">({tr ? `%${pct} küçüldü` : `${pct}% smaller`})</span>
          </p>
        ) : (
          <p className="mt-5 text-[13px] font-semibold text-slate-300">
            {tr
              ? `Görselleriniz zaten optimize — ${humanSize(result.inBytes)} olarak korundu.`
              : `Your images were already optimized — kept at ${humanSize(result.inBytes)}.`}
          </p>
        )}
        {result.keptCount > 0 && saved > 0 ? (
          <p className="mt-1 text-[12px] text-slate-400">
            {tr
              ? `${result.keptCount} görsel zaten optimizeydi; orijinali korundu.`
              : `${result.keptCount} image(s) were already optimized; the original was kept.`}
          </p>
        ) : null}
        <ValueMomentNudge language={language} source="guest_tool_success" />
      </ToolResultPanel>
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

        {files.length > 0 && (
          <>
            {/* Seçilen görseller */}
            <div className="field field--full">
              <span>
                {tr ? "Seçilen görseller" : "Selected images"} — {files.length} {tr ? "görsel" : "images"} · {humanSize(totalIn)}
              </span>
              <ul ref={listRef} className="space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                    <img src={f.previewUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-100">{f.file.name}</p>
                      <p className="text-[11px] text-slate-400">{humanSize(f.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      aria-label={tr ? "Kaldır" : "Remove"}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={reset}
                className="mt-1 inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {tr ? "Tümünü sil" : "Clear all"}
              </button>
            </div>

            <label className="field">
              <span>{tr ? "Biçim" : "Format"}</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                <option value="auto">{tr ? "Otomatik (en küçük)" : "Automatic (smallest)"}</option>
                <option value="image/webp">WebP (.webp)</option>
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
              <span className="field-hint">
                {tr
                  ? "Sonuç orijinalden büyük çıkarsa dosyanız olduğu gibi korunur — hiçbir görsel büyümez."
                  : "If the result would be larger than the original, your file is kept as-is — nothing ever grows."}
              </span>
            </label>

            <label className="field">
              <span>{tr ? "Ölçü" : "Size"}</span>
              <select value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))}>
                <option value={0}>{tr ? "Orijinal ölçü" : "Original size"}</option>
                <option value={2560}>{tr ? "Uzun kenar 2560 piksel" : "Long edge 2560 px"}</option>
                <option value={1920}>{tr ? "Uzun kenar 1920 piksel" : "Long edge 1920 px"}</option>
                <option value={1280}>{tr ? "Uzun kenar 1280 piksel" : "Long edge 1280 px"}</option>
                <option value={800}>{tr ? "Uzun kenar 800 piksel" : "Long edge 800 px"}</option>
              </select>
              <span className="field-hint">
                {tr
                  ? "Ölçüyü küçültmek dosya boyutunu en çok düşüren ayardır."
                  : "Reducing the dimensions is what shrinks the file size the most."}
              </span>
            </label>

            <label className="field field--full">
              <span>
                {tr ? "Kalite" : "Quality"}: <span className="text-nb-accent">%{quality}</span>
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
                style={{ padding: 0, border: 0, background: "transparent" }}
              />
              <span className="field-hint">
                {format === "image/png"
                  ? tr
                    ? "PNG kayıpsızdır — kalite ayarı işlemez. En çok kazanç için «Otomatik» veya WebP seçin."
                    : "PNG is lossless — the quality slider has no effect. Pick «Automatic» or WebP for the biggest savings."
                  : tr
                    ? "%70 civarı çoğu fotoğrafta gözle fark edilmeyen kayıpla ciddi boyut düşüşü sağlar."
                    : "Around 70% gives a big size reduction with loss that's usually invisible for photos."}
              </span>
            </label>
          </>
        )}

        {error && (
          <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300">
            {error}
          </p>
        )}

        <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || files.length === 0}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr ? "İşleniyor…" : "Processing…"}
            </span>
          ) : (
            tr ? "Sıkıştır" : "Compress"
          )}
        </button>
      </div>
    </div>
  );
}
