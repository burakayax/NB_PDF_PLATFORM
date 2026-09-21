import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Download, ExternalLink, Share2, X } from "lucide-react";
import { ToolRating } from "./ToolRating";
import type { Language } from "../../i18n/landing";
import { trackGAEvent } from "../../lib/analytics";

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
  /**
   * Araç kimliği — verilirse işlem bitiminde tek soruluk puanlama gösterilir.
   *
   * Bu an kasıtlı seçildi: kullanıcı sonucu yeni gördü, işe yarayıp yaramadığını
   * biliyor. Aynı soruyu sayfanın bir köşesinde sormak çok daha az yanıt alıyor.
   */
  ratingToolSlug?: string;
};

const L = {
  tr: {
    ready: "PDF hazır 🎉",
    readyGeneric: "Dosyan hazır 🎉",
    subDevice: "Dosyan cihazından hiç çıkmadı.",
    subServer: "İşlem tamamlandı. İndir'e basınca kaydetme yerini soracağız.",
    download: "İndir",
    downloaded: "İndirildi",
    downloadAgain: "Tekrar indir",
    closeConfirm: "İndirmeden kapat?",
    share: "Paylaş",
    open: "Aç",
    close: "Kapat",
  },
  en: {
    ready: "Your PDF is ready 🎉",
    readyGeneric: "Your file is ready 🎉",
    subDevice: "Your file never left your device.",
    subServer: "All done — hit Download and we'll ask where to save it.",
    download: "Download",
    downloaded: "Downloaded",
    downloadAgain: "Download again",
    closeConfirm: "Close without saving?",
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
  ratingToolSlug,
}: ToolResultPanelProps) {
  const t = L[language] ?? L.tr;
  const isPdf = /\.pdf$/i.test(filename.trim());

  /**
   * AKTİVASYON ÖLÇÜMÜ — "değeri yaşayan" kullanıcı sayısı.
   *
   * Dönüşümün ön koşulu, kişinin üründen BİR KEZ gerçek sonuç almasıdır; değeri
   * hiç görmeyen kullanıcı zaten ödemez. Buna rağmen elimizde "kaç ziyaretçi
   * araca girdi, kaçı sonuca ulaştı" verisi yoktu; huninin en alt basamağı
   * (ödeme) ölçülüyor ama en kritik basamağı ölçülmüyordu.
   *
   * Bu ekran YALNIZCA iş başarıyla bittiğinde çizilir, bu yüzden aktivasyonun
   * doğru işaretidir. Dosya adı ya da içeriği GÖNDERİLMEZ; yalnız türü ve
   * işlemin nerede yapıldığı.
   */
  const bildirildiRef = useRef(false);
  useEffect(() => {
    if (bildirildiRef.current) return;
    bildirildiRef.current = true;
    trackGAEvent("tool_result_ready", {
      file_type: isPdf ? "pdf" : "other",
      on_device: processedOnDevice,
    });
  }, [isPdf, processedOnDevice]);

  /**
   * Düğmenin üç hâli var: önce "İndir", kayıt başarılı olunca kısa süre
   * "İndirildi" onayı, sonrasında da "Tekrar indir" olarak kalır. Onay geçince
   * yeniden "İndir" yazmıyor; dosya zaten alındığı için bu yanıltıcı oluyordu.
   */
  const [saving, setSaving] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  /** Bu sonuç bir kez bile kaydedildi mi (düğme metni + kapatma onayı için). */
  const [everDownloaded, setEverDownloaded] = useState(false);
  const [closeArmed, setCloseArmed] = useState(false);
  const downloadedTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (downloadedTimerRef.current) window.clearTimeout(downloadedTimerRef.current);
    },
    [],
  );
  function markDownloaded() {
    setEverDownloaded(true);
    setCloseArmed(false);
    setDownloaded(true);
    if (downloadedTimerRef.current) window.clearTimeout(downloadedTimerRef.current);
    downloadedTimerRef.current = window.setTimeout(() => setDownloaded(false), 3000);
  }

  /**
   * İNDİRME YALNIZ BURADA OLUR.
   *
   * İşlem biter bitmez dosyayı diske yazmak (ve "nereye kaydedeyim?" diye
   * sormak) kullanıcıyı şaşırtıyordu: kişi daha sonucu görmeden bir kaydetme
   * penceresiyle karşılaşıyordu. Artık soru, kullanıcı bu düğmeye bastığında
   * soruluyor. Tıklama taze bir kullanıcı etkileşimi olduğu için kaydetme
   * penceresi güvenle açılabiliyor.
   */
  async function save() {
    if (saving) return;
    setSaving(true);
    try {
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
          markDownloaded();
          return;
        } catch (e) {
          // Kullanıcı vazgeçtiyse indirmeye düşme; desteklenmiyorsa düş.
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      downloadBlob(blob, filename);
      markDownloaded();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Kapatırken kaza önleme: dosya henüz kaydedilmediyse ilk tıklama yalnızca
   * uyarır. Sonuç yalnızca bellekte durduğu için panel kapanınca kaybolur ve
   * işlem (ücretli araçlarda hakkıyla birlikte) boşa gitmiş olur.
   */
  function handleClose() {
    if (!everDownloaded && !closeArmed) {
      setCloseArmed(true);
      window.setTimeout(() => setCloseArmed(false), 5000);
      return;
    }
    onClose();
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
          disabled={saving}
          aria-live="polite"
          className={
            downloaded
              ? "inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition"
              : everDownloaded
                ? "inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1] disabled:opacity-70"
                : "inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-70"
          }
        >
          {downloaded ? (
            <>
              <Check className="h-4 w-4" /> {t.downloaded}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />{" "}
              {everDownloaded ? t.downloadAgain : t.download}
            </>
          )}
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
          onClick={handleClose}
          aria-live="polite"
          className={
            closeArmed
              ? "inline-flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-6 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
              : "inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06]"
          }
        >
          <X className="h-4 w-4" /> {closeArmed ? t.closeConfirm : t.close}
        </button>
      </div>
      {ratingToolSlug ? <ToolRating toolSlug={ratingToolSlug} language={language} /> : null}
      {children}
    </div>
  );
}
