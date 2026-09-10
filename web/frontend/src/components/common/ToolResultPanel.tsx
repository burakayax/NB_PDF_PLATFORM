import type { ReactNode } from "react";
import { Check, Download, ExternalLink, Share2, X } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * TÜM araçların ortak "işlem bitti" ekranı.
 *
 * Referans tasarım PDF Kırp'tır: yeşil çerçeveli büyük panel, tik dairesi,
 * "PDF hazır 🎉" başlığı ve İndir · Paylaş · Aç · Kapat düğmeleri. Yeni bir
 * araç eklendiğinde sonuç ekranı için BU bileşen kullanılmalıdır; araca özel
 * ayrı bir sonuç kutusu yazılmamalıdır.
 *
 * `subtitle` verilmezse çıktının nerede üretildiğine göre dürüst bir alt metin
 * seçilir: cihazda işlenen araçlarda "dosyan cihazından çıkmadı", sunucuda
 * işlenenlerde bu iddia edilmez.
 */
export type ToolResultPanelProps = {
  blob: Blob;
  filename: string;
  language: Language;
  /** Çıktı cihazda mı üretildi (gizlilik cümlesi yalnız o zaman gösterilir). */
  processedOnDevice?: boolean;
  /** Alt metni tamamen değiştirmek için. */
  subtitle?: string;
  onClose: () => void;
  /** Düğmelerin altına eklenen içerik (ör. sıradaki araç önerileri, üyelik kartı). */
  children?: ReactNode;
};

const L = {
  tr: {
    ready: "PDF hazır 🎉",
    readyGeneric: "Dosyan hazır 🎉",
    subDevice: "Dosyan cihazından hiç çıkmadı.",
    subServer: "İşlem tamamlandı; dosyan kaydedildi.",
    download: "İndir",
    share: "Paylaş",
    open: "Aç",
    close: "Kapat",
  },
  en: {
    ready: "Your PDF is ready 🎉",
    readyGeneric: "Your file is ready 🎉",
    subDevice: "Your file never left your device.",
    subServer: "All done — your file has been saved.",
    download: "Download",
    share: "Share",
    open: "Open",
    close: "Close",
  },
};

function isShareSupported(blob: Blob, filename: string): boolean {
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: unknown;
  };
  if (typeof nav.share !== "function") {
    return false;
  }
  try {
    return !!nav.canShare?.({ files: [new File([blob], filename, { type: blob.type })] });
  } catch {
    return false;
  }
}

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

function pickerTypesFor(filename: string, blob: Blob) {
  const ext = /\.([A-Za-z0-9]+)$/.exec(filename.trim())?.[1]?.toLowerCase() ?? "bin";
  const mime = blob.type.trim() || "application/octet-stream";
  return [{ description: "Download", accept: { [mime]: [`.${ext}`] } }];
}

export function ToolResultPanel({
  blob,
  filename,
  language,
  processedOnDevice = false,
  subtitle,
  onClose,
  children,
}: ToolResultPanelProps) {
  const t = L[language] ?? L.tr;
  const isPdf = /\.pdf$/i.test(filename.trim());

  async function save() {
    const win = window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof win.showSaveFilePicker === "function") {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: filename,
          types: pickerTypesFor(filename, blob),
        });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        return;
      } catch (e) {
        // Kullanıcı vazgeçtiyse indirmeye düşme; desteklenmiyorsa düş.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    downloadBlob(blob, filename);
  }

  function open() {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function share() {
    const f = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string }) => Promise<void>;
    };
    try {
      if (nav.canShare?.({ files: [f] }) && nav.share) {
        await nav.share({ files: [f], title: filename });
      }
    } catch {
      /* iptal */
    }
  }

  const btnGhost =
    "inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]";

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
        <Check className="h-8 w-8" />
      </div>
      <p className="mt-4 text-xl font-bold text-white">
        {isPdf ? t.ready : t.readyGeneric}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        {subtitle ?? (processedOnDevice ? t.subDevice : t.subServer)}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500" title={filename}>
        {filename}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500"
        >
          <Download className="h-4 w-4" /> {t.download}
        </button>
        {isShareSupported(blob, filename) && (
          <button type="button" onClick={() => void share()} className={btnGhost}>
            <Share2 className="h-4 w-4" /> {t.share}
          </button>
        )}
        <button type="button" onClick={open} className={btnGhost}>
          <ExternalLink className="h-4 w-4" /> {t.open}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
        >
          <X className="h-4 w-4" /> {t.close}
        </button>
      </div>
      {children}
    </div>
  );
}
