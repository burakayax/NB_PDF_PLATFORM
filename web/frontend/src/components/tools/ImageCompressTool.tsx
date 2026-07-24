import { useCallback, useRef, useState } from "react";
import { Download, ImageDown, Loader2, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * GÖRSEL SIKIŞTIR — tamamen CİHAZDA (canvas) çalışan görsel sıkıştırıcı.
 * Dosya sunucuya YÜKLENMEZ; giriş/üyelik gerekmez. JPG/PNG/WebP kabul eder,
 * kalite + maksimum boyut ayarıyla yeniden kodlar, önce/sonra boyutu gösterir.
 */

type Format = "image/jpeg" | "image/webp";

type Item = {
  id: string;
  file: File;
  originalSize: number;
  previewUrl: string;
  status: "idle" | "working" | "done" | "error";
  outBlob?: Blob;
  outUrl?: string;
  outSize?: number;
};

const MAX_FILES = 20;
const ACCEPT = "image/jpeg,image/png,image/webp";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
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
      // JPEG şeffaflığı desteklemez → beyaz zemin (aksi halde siyah olur).
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

function extFor(format: Format): string {
  return format === "image/webp" ? "webp" : "jpg";
}

export function ImageCompressTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(70); // %
  const [maxDim, setMaxDim] = useState(0); // 0 = orijinal
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!arr.length) return;
    setItems((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (next.length >= MAX_FILES) break;
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          originalSize: f.size,
          previewUrl: URL.createObjectURL(f),
          status: "idle",
        });
      }
      return next;
    });
  }, []);

  const runCompress = useCallback(async () => {
    setBusy(true);
    const q = Math.min(0.95, Math.max(0.2, quality / 100));
    // Sıralı işlem: bellek dostu; her öğeyi tek tek güncelle.
    for (const it of itemsRef.current) {
      if (it.status === "done") continue;
      setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: "working" } : p)));
      try {
        const blob = await compress(it.file, q, maxDim, format);
        const outUrl = URL.createObjectURL(blob);
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: "done", outBlob: blob, outUrl, outSize: blob.size } : p,
          ),
        );
      } catch {
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, status: "error" } : p)));
      }
    }
    setBusy(false);
  }, [quality, maxDim, format]);

  // runCompress'in en güncel item listesini görmesi için ref köprüsü.
  const itemsRef = useRef<Item[]>(items);
  itemsRef.current = items;

  function download(it: Item) {
    if (!it.outBlob) return;
    const a = document.createElement("a");
    a.href = it.outUrl!;
    const base = (it.file.name || "gorsel").replace(/\.[^.]+$/, "");
    a.download = `${base}-sikistirilmis.${extFor(format)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll() {
    items.filter((i) => i.status === "done").forEach((it, idx) => {
      // Ardışık indirmeleri tarayıcı engellemesin diye küçük gecikme.
      setTimeout(() => download(it), idx * 250);
    });
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it) {
        URL.revokeObjectURL(it.previewUrl);
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  const doneItems = items.filter((i) => i.status === "done");
  const totalIn = items.reduce((s, i) => s + i.originalSize, 0);
  const totalOut = doneItems.reduce((s, i) => s + (i.outSize ?? 0), 0);
  const savedPct = totalIn > 0 && totalOut > 0 ? Math.max(0, Math.round((1 - totalOut / totalIn) * 100)) : 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Gizlilik şeridi */}
      <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2 text-[12.5px] font-medium text-emerald-200/90">
        <ShieldCheck className="h-4 w-4" />
        {tr
          ? "Görselleriniz cihazınızda sıkıştırılır — sunucuya yüklenmez, üyelik gerekmez."
          : "Your images are compressed on your device — never uploaded, no sign-up."}
      </div>

      {/* Bırakma alanı */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          drag ? "border-cyan-400/70 bg-cyan-500/[0.08]" : "border-white/15 bg-white/[0.02] hover:border-cyan-400/40"
        }`}
      >
        <UploadCloud className="h-9 w-9 text-cyan-300" />
        <p className="mt-3 text-sm font-semibold text-white">
          {tr ? "Görselleri buraya sürükleyin" : "Drag your images here"}
        </p>
        <p className="mt-1 text-[12px] text-slate-400">{tr ? "JPG, PNG veya WebP — en fazla" : "JPG, PNG or WebP — up to"} {MAX_FILES}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(34,211,238,0.7)] transition hover:from-cyan-400 hover:to-blue-500"
        >
          <ImageDown className="h-4 w-4" />
          {tr ? "Görsel seç" : "Choose images"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <>
          {/* Ayarlar */}
          <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">
                {tr ? "Kalite" : "Quality"}: <span className="text-cyan-300">%{quality}</span>
              </span>
              <input type="range" min={20} max={95} step={5} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="accent-cyan-500" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">{tr ? "En büyük kenar" : "Max dimension"}</span>
              <select value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))} className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100">
                <option value={0}>{tr ? "Orijinal" : "Original"}</option>
                <option value={1920}>1920 px</option>
                <option value={1280}>1280 px</option>
                <option value={800}>800 px</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-slate-300">{tr ? "Biçim" : "Format"}</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className="rounded-lg border border-white/12 bg-[#0b1020] px-2 py-1.5 text-[13px] text-slate-100">
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </label>
          </div>

          {/* Aksiyonlar + özet */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void runCompress()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(34,211,238,0.7)] transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
              {tr ? "Sıkıştır" : "Compress"}
            </button>
            <div className="flex items-center gap-3">
              {doneItems.length > 0 && (
                <span className="text-[12.5px] text-slate-300">
                  {tr ? "Toplam kazanç" : "Total saved"}: <span className="font-bold text-emerald-300">%{savedPct}</span>{" "}
                  <span className="text-slate-500">({humanSize(totalIn)} → {humanSize(totalOut)})</span>
                </span>
              )}
              {doneItems.length > 1 && (
                <button type="button" onClick={downloadAll} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-white/[0.06]">
                  <Download className="h-3.5 w-3.5" />
                  {tr ? "Tümünü indir" : "Download all"}
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <ul className="mt-4 space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                <img src={it.previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-100">{it.file.name}</p>
                  <p className="text-[12px] text-slate-400">
                    {humanSize(it.originalSize)}
                    {it.status === "done" && it.outSize != null && (
                      <>
                        {" → "}
                        <span className="font-semibold text-emerald-300">{humanSize(it.outSize)}</span>{" "}
                        <span className="text-emerald-400/80">
                          (−{Math.max(0, Math.round((1 - it.outSize / it.originalSize) * 100))}%)
                        </span>
                      </>
                    )}
                    {it.status === "error" && <span className="text-rose-400"> · {tr ? "sıkıştırılamadı" : "failed"}</span>}
                  </p>
                </div>
                {it.status === "working" && <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />}
                {it.status === "done" && (
                  <button type="button" onClick={() => download(it)} aria-label={tr ? "İndir" : "Download"} className="rounded-lg border border-white/15 p-2 text-white transition hover:bg-white/[0.06]">
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => removeItem(it.id)} aria-label={tr ? "Kaldır" : "Remove"} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
