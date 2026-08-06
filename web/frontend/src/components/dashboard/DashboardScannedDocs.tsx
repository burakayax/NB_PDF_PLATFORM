import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, Download, FileText, Loader2, RefreshCw, Share2, Trash2, Wrench, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { listScans, downloadScan, deleteScan, type ScanRecord } from "../../api/scans";
import { saveBlobToUser } from "../../api";
import { PdfToolPickerSheet } from "../tools/PdfToolPickerSheet";

/**
 * Dashboard "Son Taratılanlar": telefonda "Hesabıma kaydet" ile yüklenen taramalar.
 * Görsel seçici gibi GRID — her kart ilk sayfa önizlemesini (pdf.js) kapak yapar,
 * altında renkli aksiyonlar (indir / paylaş / araçlarda aç / sil). Karta tıklayınca
 * aynı sayfa üstünde GENİŞ modal önizleme açılır. FIFO (free 3, Pro 10).
 */
export function DashboardScannedDocs({
  accessToken,
  language,
  onPickTool,
  lockedFeatures,
}: {
  accessToken: string | null | undefined;
  language: Language;
  /** Plan dışı araçlar seçicide "Pro" rozetiyle işaretlenir. */
  lockedFeatures?: Set<string>;
  /** Seçilen araca taramayı aktarır: PDF'i IndexedDB'ye koyup o araca yönlendirir. */
  onPickTool?: (file: File, toolId: string) => void;
}) {
  const tr = language === "tr";
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ scan: ScanRecord; blob: Blob } | null>(null);
  // Araç seçici menü (hamburger) — ayrı sayfa AÇMADAN aynı ekranda açılır.
  const [picker, setPicker] = useState<{ scan: ScanRecord; blob: Blob } | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const r = await listScans(accessToken);
      setScans(r.scans);
      setLimit(r.limit);
    } catch {
      /* sessiz */
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accessToken) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-nb-heading sm:text-base">
          <Cloud className="h-5 w-5 text-cyan-300" />
          {tr ? "Son Taratılanlar" : "Recent scans"}
          {limit > 0 && <span className="text-[12px] font-normal text-slate-500">({scans.length}/{limit})</span>}
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          aria-label={tr ? "Yenile" : "Refresh"}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/[0.06]" />)}
        </div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Cloud className="h-9 w-9 text-slate-600" />
          <p className="text-sm font-medium text-slate-300">{tr ? "Henüz kayıtlı tarama yok" : "No saved scans yet"}</p>
          <p className="max-w-sm text-[13px] leading-relaxed text-slate-500">
            {tr
              ? "Telefonda belge tara → «Hesabıma kaydet» → burada görünsün; bilgisayardan indir, paylaş ya da bir araçta aç."
              : "Scan on your phone → «Save to my account» → it appears here to download, share or open in a tool."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {scans.map((s) => (
            <ScanCard
              key={s.id}
              scan={s}
              accessToken={accessToken}
              language={language}
              canPick={!!onPickTool}
              onOpenPicker={(blob) => setPicker({ scan: s, blob })}
              onOpenPreview={(blob) => setPreview({ scan: s, blob })}
              onDeleted={() => setScans((prev) => prev.filter((x) => x.id !== s.id))}
            />
          ))}
        </div>
      )}

      {preview && (
        <ScanPreviewModal
          scan={preview.scan}
          blob={preview.blob}
          language={language}
          onClose={() => setPreview(null)}
          onOpenInTools={
            onPickTool && preview.scan.mime.includes("pdf")
              ? () => {
                  setPicker({ scan: preview.scan, blob: preview.blob });
                  setPreview(null);
                }
              : undefined
          }
        />
      )}

      {picker && (
        <PdfToolPickerSheet
          language={language}
          fileName={picker.scan.filename}
          lockedFeatures={lockedFeatures}
          onClose={() => setPicker(null)}
          onPick={(toolId) => {
            onPickTool?.(new File([picker.blob], picker.scan.filename, { type: picker.scan.mime }), toolId);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

/** Tek tarama kartı: kapak (ilk sayfa) + renkli aksiyonlar. Blob'u bir kez indirir, cache'ler. */
function ScanCard({
  scan,
  accessToken,
  language,
  canPick,
  onOpenPicker,
  onOpenPreview,
  onDeleted,
}: {
  scan: ScanRecord;
  accessToken: string;
  language: Language;
  canPick?: boolean;
  onOpenPicker: (blob: Blob) => void;
  onOpenPreview: (blob: Blob) => void;
  onDeleted: () => void;
}) {
  const tr = language === "tr";
  const isPdf = scan.mime.includes("pdf");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const coverUrlRef = useRef<string | null>(null);

  // Blob'u bir kez indir (kapak + tüm aksiyonlar tekrar indirmez).
  const getBlob = useCallback(async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current;
    const b = await downloadScan(accessToken, scan.id);
    blobRef.current = b;
    return b;
  }, [accessToken, scan.id]);

  // Kapak: PDF → ilk sayfa (pdf.js, dinamik import); görsel → doğrudan objectURL.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const blob = await getBlob();
        if (!alive) return;
        if (isPdf) {
          const { renderPdfPreview } = await import("../../lib/ocr");
          const file = new File([blob], scan.filename, { type: scan.mime });
          const { doc, pages } = await renderPdfPreview(file, 1, 1);
          await doc.destroy();
          if (alive && pages[0]) setCover(pages[0].dataUrl);
        } else {
          const url = URL.createObjectURL(blob);
          coverUrlRef.current = url;
          if (alive) setCover(url);
        }
      } catch {
        /* kapak yüklenemedi — genel ikon kalır */
      }
    })();
    return () => {
      alive = false;
      if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
    };
  }, [getBlob, isPdf, scan.filename, scan.mime]);

  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(tr ? "tr-TR" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return iso;
    }
  };
  const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

  async function withBusy(fn: (blob: Blob) => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await getBlob();
      await fn(blob);
    } catch {
      /* sessiz */
    } finally {
      setBusy(false);
    }
  }

  const doDownload = () => withBusy(async (blob) => { await saveBlobToUser(blob, scan.filename).catch(() => {}); });
  const doShare = () =>
    withBusy(async (blob) => {
      const file = new File([blob], scan.filename, { type: scan.mime });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) await nav.share({ files: [file], title: scan.filename }).catch(() => {});
      else await saveBlobToUser(blob, scan.filename).catch(() => {});
    });
  const doOpenTools = () => withBusy(async (blob) => onOpenPicker(blob));
  const doOpenPreview = () => withBusy(async (blob) => onOpenPreview(blob));
  async function doDelete() {
    if (busy) return;
    if (!window.confirm(tr ? "Bu taramayı sil?" : "Delete this scan?")) return;
    setBusy(true);
    try {
      await deleteScan(accessToken, scan.id);
      onDeleted();
    } catch {
      setBusy(false);
    }
  }

  const actionBtn = "flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition disabled:opacity-50";

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      {/* Kapak — tıklayınca geniş önizleme */}
      <button
        type="button"
        onClick={doOpenPreview}
        disabled={busy}
        title={tr ? "Önizle" : "Preview"}
        className="relative aspect-[3/4] w-full overflow-hidden bg-slate-800/60"
      >
        {cover ? (
          <img src={cover} alt={scan.filename} className="h-full w-full object-cover object-top transition group-hover:scale-[1.03]" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {busy || !blobRef.current ? <Loader2 className="h-6 w-6 animate-spin text-slate-500" /> : <FileText className="h-8 w-8 text-slate-600" />}
          </span>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90 backdrop-blur">
          {(scan.filename.split(".").pop() || "pdf").toUpperCase()}
        </span>
      </button>

      {/* Bilgi */}
      <div className="min-w-0 px-2 pt-2">
        <p className="truncate text-[12px] font-semibold text-slate-100" title={scan.filename}>{scan.filename}</p>
        <p className="text-[10px] text-slate-500">{fmtSize(scan.sizeBytes)} · {fmtDate(scan.createdAt)}</p>
      </div>

      {/* Aksiyonlar — renkli */}
      <div className="mt-2 flex items-stretch gap-1 p-2 pt-1">
        {canPick && isPdf && (
          <button type="button" onClick={doOpenTools} disabled={busy} title={tr ? "Araçta aç" : "Open in tool"} className={`${actionBtn} bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25`}>
            <Wrench className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={doDownload} disabled={busy} title={tr ? "İndir" : "Download"} className={`${actionBtn} bg-blue-500/15 text-blue-300 hover:bg-blue-500/25`}>
          <Download className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={doShare} disabled={busy} title={tr ? "Paylaş" : "Share"} className={`${actionBtn} bg-violet-500/15 text-violet-300 hover:bg-violet-500/25`}>
          <Share2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={doDelete} disabled={busy} title={tr ? "Sil" : "Delete"} className={`${actionBtn} bg-red-500/10 text-red-300 hover:bg-red-500/25`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Geniş PDF/görsel önizleme — aynı sayfa üstünde overlay pencere (tüm sayfalar). */
function ScanPreviewModal({
  scan,
  blob,
  language,
  onClose,
  onOpenInTools,
}: {
  scan: ScanRecord;
  blob: Blob;
  language: Language;
  onClose: () => void;
  onOpenInTools?: () => void;
}) {
  const tr = language === "tr";
  const isPdf = scan.mime.includes("pdf");
  const [pages, setPages] = useState<string[] | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    let objUrl: string | null = null;
    (async () => {
      if (isPdf) {
        try {
          const { renderPdfPreview } = await import("../../lib/ocr");
          const file = new File([blob], scan.filename, { type: scan.mime });
          const { doc, pages: pg } = await renderPdfPreview(file, 2, 20);
          await doc.destroy();
          if (alive) setPages(pg.map((p) => p.dataUrl));
        } catch {
          if (alive) setPages([]);
        }
      } else {
        objUrl = URL.createObjectURL(blob);
        if (alive) setImgUrl(objUrl);
      }
    })();
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [blob, isPdf, scan.filename, scan.mime]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="flex h-full max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-nb-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-100" title={scan.filename}>{scan.filename}</p>
          <div className="flex shrink-0 items-center gap-2">
            {onOpenInTools && (
              <button
                type="button"
                onClick={onOpenInTools}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-[12px] font-semibold text-cyan-300 transition hover:bg-cyan-500/25"
              >
                <Wrench className="h-3.5 w-3.5" />
                {tr ? "Araçlarda aç" : "Open in tools"}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-black/30 p-3 sm:p-5">
          {isPdf ? (
            pages === null ? (
              <div className="flex h-full items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : pages.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">{tr ? "Önizleme oluşturulamadı." : "Could not render preview."}</p>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
                {pages.map((p, i) => (
                  <img key={i} src={p} alt={`${tr ? "Sayfa" : "Page"} ${i + 1}`} className="w-full rounded-lg shadow-lg ring-1 ring-white/10" />
                ))}
              </div>
            )
          ) : imgUrl ? (
            <div className="flex h-full items-center justify-center">
              <img src={imgUrl} alt={scan.filename} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
