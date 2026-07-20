import { useRef, useState } from "react";
import {
  Combine,
  Scissors,
  Images,
  RotateCw,
  Trash2,
  LayoutGrid,
  Zap,
  Lock,
  Loader2,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

/** Ana sayfada yerinde çalışan ücretsiz araçların id'leri. */
export type ToolId = "merge" | "split" | "image-to-pdf" | "rotate-pdf" | "delete-pages" | "organize-pdf";

type Benefit = { icon: LucideIcon; tr: string; trDesc: string; en: string; enDesc: string };
type Accent = {
  icon: LucideIcon;
  /** Rozet gradyanı (tam sınıf metni — Tailwind JIT taraması için literal). */
  grad: string;
  text: string;
  hover: string;
  benefits: Benefit[];
};

/** Her aracın rengi + ikonu + 3 açıklama kutusu. Renkli, AI aracıyla aynı dil. */
const TOOL_ACCENTS: Record<ToolId, Accent> = {
  merge: {
    icon: Combine,
    grad: "from-blue-500/25 to-indigo-600/25",
    text: "text-blue-300",
    hover: "hover:border-blue-400/50 hover:bg-blue-400/[0.04]",
    benefits: [
      { icon: Combine, tr: "Tek dosyada", trDesc: "Birden çok PDF'i sırayla tek belgeye birleştir.", en: "One file", enDesc: "Combine multiple PDFs into a single document in order." },
      { icon: Zap, tr: "Anında & ücretsiz", trDesc: "Saniyeler içinde, dosya sayısı sınırı yok.", en: "Instant & free", enDesc: "Ready in seconds, no file-count limit." },
      { icon: Lock, tr: "Tamamen gizli", trDesc: "Dosyalar cihazında işlenir, sunucuya gitmez.", en: "Fully private", enDesc: "Processed on your device, never uploaded." },
    ],
  },
  split: {
    icon: Scissors,
    grad: "from-cyan-500/25 to-sky-600/25",
    text: "text-cyan-300",
    hover: "hover:border-cyan-400/50 hover:bg-cyan-400/[0.04]",
    benefits: [
      { icon: Scissors, tr: "İstediğin sayfayı ayır", trDesc: "Sayfa aralığı seç, ayrı PDF olarak al.", en: "Split any pages", enDesc: "Pick a page range and export as a separate PDF." },
      { icon: Zap, tr: "Hızlı", trDesc: "Yükleme yok — cihazında saniyeler içinde.", en: "Fast", enDesc: "No upload — done on your device in seconds." },
      { icon: Lock, tr: "Gizli", trDesc: "Belgen cihazından hiç çıkmaz.", en: "Private", enDesc: "Your document never leaves your device." },
    ],
  },
  "image-to-pdf": {
    icon: Images,
    grad: "from-emerald-500/25 to-teal-600/25",
    text: "text-emerald-300",
    hover: "hover:border-emerald-400/50 hover:bg-emerald-400/[0.04]",
    benefits: [
      { icon: Images, tr: "Görselleri PDF yap", trDesc: "JPG/PNG'leri tek PDF'e sırayla dönüştür.", en: "Images to PDF", enDesc: "Turn JPG/PNG files into one ordered PDF." },
      { icon: Zap, tr: "Anında", trDesc: "Sürükle-bırak, saniyeler içinde hazır.", en: "Instant", enDesc: "Drag & drop, ready in seconds." },
      { icon: Lock, tr: "Gizli", trDesc: "Görsellerin cihazında kalır.", en: "Private", enDesc: "Your images stay on your device." },
    ],
  },
  "rotate-pdf": {
    icon: RotateCw,
    grad: "from-amber-500/25 to-orange-600/25",
    text: "text-amber-300",
    hover: "hover:border-amber-400/50 hover:bg-amber-400/[0.04]",
    benefits: [
      { icon: RotateCw, tr: "Sayfaları döndür", trDesc: "90° adımlarla düzelt — tek tek ya da toplu.", en: "Rotate pages", enDesc: "Fix orientation in 90° steps, one by one or all." },
      { icon: Zap, tr: "Anında önizleme", trDesc: "Döndür, sonucu hemen gör.", en: "Live preview", enDesc: "Rotate and see the result instantly." },
      { icon: Lock, tr: "Gizli", trDesc: "Dosyan cihazında işlenir.", en: "Private", enDesc: "Your file is processed on your device." },
    ],
  },
  "delete-pages": {
    icon: Trash2,
    grad: "from-rose-500/25 to-red-600/25",
    text: "text-rose-300",
    hover: "hover:border-rose-400/50 hover:bg-rose-400/[0.04]",
    benefits: [
      { icon: Trash2, tr: "Sayfa sil", trDesc: "İstemediğin sayfaları çıkar, gerisini koru.", en: "Delete pages", enDesc: "Remove unwanted pages, keep the rest." },
      { icon: Zap, tr: "Hızlı", trDesc: "Seç ve anında temizle.", en: "Fast", enDesc: "Select and clean up instantly." },
      { icon: Lock, tr: "Gizli", trDesc: "Belgen cihazından çıkmaz.", en: "Private", enDesc: "Your document never leaves your device." },
    ],
  },
  "organize-pdf": {
    icon: LayoutGrid,
    grad: "from-violet-500/25 to-purple-600/25",
    text: "text-violet-300",
    hover: "hover:border-violet-400/50 hover:bg-violet-400/[0.04]",
    benefits: [
      { icon: LayoutGrid, tr: "Sırala & düzenle", trDesc: "Sayfaları sürükleyip yeniden diz.", en: "Reorder & organize", enDesc: "Drag pages into a new order." },
      { icon: Zap, tr: "Canlı önizleme", trDesc: "Değişikliği anında gör.", en: "Live preview", enDesc: "See changes as you make them." },
      { icon: Lock, tr: "Gizli", trDesc: "Cihazında işlenir, gizli kalır.", en: "Private", enDesc: "Processed on your device, stays private." },
    ],
  },
};

/** Aracın rengini/ikonunu dışa ver (pill'lerde renkli ikon için). */
export function toolAccent(id: ToolId) {
  return TOOL_ACCENTS[id];
}

type Props = {
  toolId: ToolId;
  tr: boolean;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  /** true → altında 3 açıklama kutusu göster (yalnız dosya yokken). */
  showBenefits?: boolean;
  onFiles: (files: FileList) => void;
  titleTr?: string;
  titleEn?: string;
  hintTr?: string;
  hintEn?: string;
};

/**
 * Premium yükleme alanı — AI aracıyla aynı dil: geniş dashed dropzone + renkli
 * ikon rozeti + çipler, altında 3 renkli açıklama kutusu. Tüm ücretsiz araçlar paylaşır.
 */
export function ToolDropzone({
  toolId, tr, accept, multiple, busy, showBenefits, onFiles, titleTr, titleEn, hintTr, hintEn,
}: Props) {
  const a = TOOL_ACCENTS[toolId];
  const Icon = a.icon;
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dosya eklenince (showBenefits=false) dropzone küçülür → eklenen liste hemen
  // görünür kalır (kullanıcı "bir şey olmadı" sanmasın, aşağı kaydırmak gerekmesin).
  const compact = showBenefits === false;

  return (
    <>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed text-center transition ${
          compact ? "p-5" : "p-10 sm:p-12"
        } ${dragOver ? "border-white/60 bg-white/[0.06]" : `border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent ${a.hover}`}`}
      >
        <div className={`pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-gradient-to-b ${a.grad} opacity-40 blur-3xl`} />
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden"
          onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
        {compact ? (
          <div className="relative flex items-center justify-center gap-2.5 text-slate-300">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${a.grad} ${a.text}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="text-[13px] font-semibold text-white">
              {busy
                ? (tr ? "İşleniyor…" : "Processing…")
                : multiple
                  ? (tr ? "+ Dosya ekle" : "+ Add file")
                  : (tr ? "Dosya değiştir" : "Replace file")}
            </span>
          </div>
        ) : (
          <>
            <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${a.grad} ${a.text} ring-1 ring-white/10 transition group-hover:scale-105`}>
              {busy ? <Loader2 className="h-9 w-9 animate-spin" /> : <Icon className="h-9 w-9" />}
            </div>
            <p className="relative mt-5 text-lg font-bold text-white">
              {busy ? (tr ? "İşleniyor…" : "Processing…") : tr ? (titleTr ?? "Dosyaları buraya sürükle") : (titleEn ?? "Drag your files here")}
            </p>
            <p className="relative mt-1.5 text-[13px] text-slate-400">
              {tr ? (hintTr ?? "ya da tıklayıp seç") : (hintEn ?? "or click to choose")}
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-400">
              {[
                tr ? "⚡ Saniyeler içinde" : "⚡ In seconds",
                tr ? "🔒 Cihazında, gizli" : "🔒 On-device, private",
                tr ? "♾️ Sınırsız & ücretsiz" : "♾️ Unlimited & free",
              ].map((c) => (
                <span key={c} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{c}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {showBenefits && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {a.benefits.map((b) => {
            const BIcon = b.icon;
            return (
              <div key={b.tr} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.03]">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${a.grad} ${a.text}`}>
                  <BIcon className="h-4 w-4" />
                </span>
                <p className="mt-2.5 text-[13px] font-bold text-white">{tr ? b.tr : b.en}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{tr ? b.trDesc : b.enDesc}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
