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
  /** Hedef boyut modunda istenen sınır (bayt); kalite modunda undefined. */
  targetBytes?: number;
  /** Hedefin altına inebilen görsel sayısı. */
  metCount?: number;
  /** Hedefe inebilmek için ölçüsü küçültülen görsel sayısı. */
  downscaledCount?: number;
  /** Kullanılan en düşük kalite — kullanıcıya dürüst geri bildirim için. */
  minQuality: number | null;
};

/** Sıkıştırma modu: kaliteyi kullanıcı seçer ya da hedef boyut belirler. */
type Mode = "quality" | "target";

/**
 * Hazır hedef boyutlar (KB). Kurumların istediği ve insanların aradığı
 * rakamlar bunlar — kullanıcı hesap yapmak zorunda kalmasın.
 */
const TARGET_PRESETS_KB = [20, 50, 100, 200, 500, 1024];

/**
 * Kullanılan kaliteyi düz Türkçeye çevirir.
 *
 * Yüzde tek başına hiçbir şey anlatmaz; kullanıcı "%42" görünce bunun fotoğrafına
 * ne yaptığını bilemez. Beklentiyi indirmeden ÖNCE doğru kurmak, indirdikten sonra
 * hayal kırıklığı yaşamasından iyidir.
 */
function kaliteYorumu(q: number, tr: boolean): string {
  if (q >= 0.8) {
    return tr
      ? "kayıp gözle fark edilmez."
      : "the loss is not visible to the eye.";
  }
  if (q >= 0.6) {
    return tr
      ? "ekranda fark edilmez; büyük baskıda hafif yumuşama görülebilir."
      : "invisible on screen; slight softening may show in large prints.";
  }
  if (q >= 0.45) {
    return tr
      ? "yakından bakınca yumuşama ve hafif lekelenme görülür. Vesikalık ve belge için genelde yeterli, baskı için değil."
      : "softening and slight blotching are visible up close. Usually fine for ID photos and documents, not for print.";
  }
  return tr
    ? "gözle görülür kalite kaybı var: ince ayrıntılar ve yazılar bozulmuş olabilir. Sonucu indirmeden önce büyütüp kontrol edin."
    : "there is visible quality loss: fine detail and text may be degraded. Zoom in and check before you rely on it.";
}

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
  const [mode, setMode] = useState<Mode>("quality");
  /** Hedef boyut, KB cinsinden (kullanıcı bu birimle düşünür). */
  const [targetKb, setTargetKb] = useState(100);
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
    const targetBytes = mode === "target" ? Math.max(1, Math.round(targetKb * 1024)) : undefined;
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
            targetBytes,
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

      // Kalite bilgisi dürüstlük için taşınır: kullanıcı hedefi tutturmak uğruna
      // ne kadar kaliteden vazgeçtiğini görmeden indirmemeli.
      const kaliteler = outcomes.map((o) => o.usedQuality).filter((x): x is number => x != null);
      setResult({
        blob: outBlob,
        filename,
        count: files.length,
        inBytes: totalIn,
        outBytes: multi ? outBlob.size : outSum,
        keptCount,
        minQuality: kaliteler.length > 0 ? Math.min(...kaliteler) : null,
        ...(targetBytes
          ? {
              targetBytes,
              metCount: outcomes.filter((o) => o.targetMet).length,
              downscaledCount: outcomes.filter((o) => o.downscaledForTarget).length,
            }
          : {}),
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

        {/* HEDEF BOYUT — sonucu olduğu gibi söyle. Hedefe inilememişse bunu
            saklamak, kullanıcıyı başvuru ekranında hataya sokar. */}
        {result.targetBytes != null && result.metCount != null ? (
          result.metCount === result.count ? (
            <p className="mt-2 text-[12px] font-semibold text-emerald-300">
              {tr
                ? `Hedef tutturuldu: ${result.count > 1 ? "tüm görseller" : "görsel"} ${humanSize(result.targetBytes)} sınırının altında.`
                : `Target met: ${result.count > 1 ? "all images are" : "the image is"} under ${humanSize(result.targetBytes)}.`}
            </p>
          ) : (
            <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-left text-[12px] text-amber-200">
              {tr
                ? `${result.count - result.metCount} görsel ${humanSize(result.targetBytes)} sınırının altına indirilemedi. En küçük hâli verildi — daha da küçültmek görseli okunamaz hâle getirirdi. Ölçüyü elle düşürmeyi ya da hedefi biraz yükseltmeyi deneyin.`
                : `${result.count - result.metCount} image(s) could not be brought under ${humanSize(result.targetBytes)}. You have the smallest version — going further would make the image unusable. Try lowering the dimensions or raising the target slightly.`}
            </p>
          )
        ) : null}

        {result.downscaledCount ? (
          <p className="mt-1 text-[12px] text-amber-300/90">
            {tr
              ? `${result.downscaledCount} görselin piksel ölçüsü küçültüldü — hedefe yalnızca kaliteyle inilemedi.`
              : `${result.downscaledCount} image(s) were reduced in dimensions — quality alone could not reach the target.`}
          </p>
        ) : null}

        {/* Ne kadar kaliteden vazgeçildiği — tahmin değil, gerçekten kullanılan değer. */}
        {result.minQuality != null ? (
          <p className="mt-1 text-[12px] text-slate-400">
            {tr
              ? `Kullanılan kalite: %${Math.round(result.minQuality * 100)} — ${kaliteYorumu(result.minQuality, true)}`
              : `Quality used: ${Math.round(result.minQuality * 100)}% — ${kaliteYorumu(result.minQuality, false)}`}
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

            {/* MOD SEÇİMİ — kullanıcı ya kaliteyi ya da sonucun boyutunu belirler.
                Kurumlar şartı boyut olarak yazdığı için ikinci yol çoğu zaman
                aranan şeydir; ama varsayılanı değiştirmiyoruz. */}
            <div className="field field--full">
              <span>{tr ? "Nasıl küçültelim?" : "How should we shrink it?"}</span>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "quality" as Mode, tr: "Kaliteye göre", en: "By quality" },
                  { id: "target" as Mode, tr: "Hedef boyuta göre", en: "To a target size" },
                ]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                    className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                      mode === m.id
                        ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                        : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {tr ? m.tr : m.en}
                  </button>
                ))}
              </div>
              <span className="field-hint">
                {mode === "target"
                  ? tr
                    ? "Bir boyut yazın; kaliteyi o sınırın altına inen en yüksek değerde tutarız."
                    : "Give a size; we keep quality at the highest value that stays under it."
                  : tr
                    ? "Kaliteyi siz belirlersiniz, boyut ona göre çıkar."
                    : "You set the quality; the size follows from it."}
              </span>
            </div>

            {mode === "target" && (
              <div className="field field--full">
                <span>{tr ? "Hedef dosya boyutu" : "Target file size"}</span>
                <div className="flex flex-wrap gap-2">
                  {TARGET_PRESETS_KB.map((kb) => (
                    <button
                      key={kb}
                      type="button"
                      onClick={() => setTargetKb(kb)}
                      aria-pressed={targetKb === kb}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                        targetKb === kb
                          ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                          : "border-white/[0.08] bg-white/[0.02] text-slate-300 hover:border-white/20"
                      }`}
                    >
                      {kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={5}
                  max={20480}
                  value={targetKb}
                  onChange={(e) => setTargetKb(Math.max(5, Number(e.target.value) || 5))}
                  className="mt-2"
                  aria-label={tr ? "Hedef boyut (KB)" : "Target size (KB)"}
                />
                <span className="field-hint">
                  {tr
                    ? "KB cinsinden. Hedef çok düşükse önce kalite düşer, yetmezse görselin piksel ölçüsü küçültülür — ikisini de sonuç ekranında açıkça yazarız. Görseli kırpmanıza gerek yok; kırpmak boyutu düşürmenin yanlış yoludur, görüntünün bir kısmını kaybedersiniz."
                    : "In KB. If the target is very low we first reduce quality, then the pixel dimensions — and we state both plainly on the result screen. You do not need to crop: cropping is the wrong way to shrink a file, it throws away part of the picture."}
                </span>
              </div>
            )}

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
                disabled={format === "image/png" || mode === "target"}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="accent-cyan-500 disabled:opacity-40"
                style={{ padding: 0, border: 0, background: "transparent" }}
              />
              <span className="field-hint">
                {mode === "target"
                  ? tr
                    ? "Hedef boyut modunda kaliteyi biz seçiyoruz — hedefin altında kalan en yüksek değeri buluruz ve kaç çıktığını sonuç ekranında yazarız."
                    : "In target-size mode we choose the quality — the highest value that stays under your target — and tell you what it turned out to be."
                  : format === "image/png"
                    ? tr
                      ? "PNG kayıpsızdır — kalite ayarı işlemez. En çok kazanç için «Otomatik» veya WebP seçin."
                      : "PNG is lossless — the quality slider has no effect. Pick «Automatic» or WebP for the biggest savings."
                    : tr
                      ? "%70 civarı çoğu fotoğrafta gözle fark edilmeyen kayıpla ciddi boyut düşüşü sağlar. Altına indikçe önce yazılar ve ince ayrıntılar bozulur."
                      : "Around 70% gives a big size reduction with loss that's usually invisible for photos. Below that, text and fine detail degrade first."}
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
