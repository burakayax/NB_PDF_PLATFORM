import { useCallback, useEffect, useState } from "react";
import { Cloud, Download, FileText, Loader2, RefreshCw, Share2, Trash2, Wrench } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { listScans, downloadScan, deleteScan, type ScanRecord } from "../../api/scans";
import { saveBlobToUser } from "../../api";

/**
 * Dashboard "Son Taratılanlar": telefonda "Hesabıma kaydet" ile yüklenen taramalar.
 * PC'de kamera olmasa bile buradan indir / paylaş / araçlara aktar. FIFO (free 3, Pro 10).
 */
export function DashboardScannedDocs({
  accessToken,
  language,
  onOpenInTools,
}: {
  accessToken: string | null | undefined;
  language: Language;
  /** Taramayı indirip PDF araçlarına aktarır (varsa). */
  onOpenInTools?: (file: File) => void;
}) {
  const tr = language === "tr";
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [limit, setLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(tr ? "tr-TR" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return iso;
    }
  };
  const isPdf = (m: string) => m.includes("pdf");

  async function doDownload(s: ScanRecord) {
    if (!accessToken) return;
    setBusyId(s.id);
    try {
      const blob = await downloadScan(accessToken, s.id);
      await saveBlobToUser(blob, s.filename).catch(() => {});
    } finally {
      setBusyId(null);
    }
  }
  async function doShare(s: ScanRecord) {
    if (!accessToken) return;
    setBusyId(s.id);
    try {
      const blob = await downloadScan(accessToken, s.id);
      const file = new File([blob], s.filename, { type: s.mime });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) await nav.share({ files: [file], title: s.filename });
      else await saveBlobToUser(blob, s.filename).catch(() => {});
    } catch {
      /* iptal */
    } finally {
      setBusyId(null);
    }
  }
  async function doOpenInTools(s: ScanRecord) {
    if (!accessToken || !onOpenInTools) return;
    setBusyId(s.id);
    try {
      const blob = await downloadScan(accessToken, s.id);
      onOpenInTools(new File([blob], s.filename, { type: s.mime }));
    } finally {
      setBusyId(null);
    }
  }
  async function doDelete(s: ScanRecord) {
    if (!accessToken) return;
    setBusyId(s.id);
    try {
      await deleteScan(accessToken, s.id);
      setScans((prev) => prev.filter((x) => x.id !== s.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg sm:rounded-xl md:rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-2.5 sm:p-3 md:p-4 lg:p-5 2xl:p-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11px] sm:text-xs md:text-sm lg:text-base font-semibold text-nb-heading">
          <Cloud className="h-4 w-4 text-cyan-300" />
          {tr ? "Son Taratılanlar" : "Recent scans"}
          {limit > 0 && <span className="text-[11px] font-normal text-slate-500">({scans.length}/{limit})</span>}
        </h2>
        <button type="button" onClick={() => void load()} aria-label={tr ? "Yenile" : "Refresh"} className="rounded-lg p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.06]" />)}
        </div>
      ) : scans.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <Cloud className="h-7 w-7 text-slate-600" />
          <p className="text-[13px] font-medium text-slate-300">{tr ? "Henüz kayıtlı tarama yok" : "No saved scans yet"}</p>
          <p className="max-w-xs text-[12px] text-slate-500">
            {tr ? "Telefonda belge tara → «Hesabıma kaydet» → burada görünsün, bilgisayardan indir/paylaş." : "Scan on your phone → «Save to my account» → it appears here to download/share on your computer."}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {scans.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isPdf(s.mime) ? "bg-rose-500/15 text-rose-300" : "bg-sky-500/15 text-sky-300"}`}>
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-100">{s.filename}</p>
                <p className="text-[11px] text-slate-500">{fmtSize(s.sizeBytes)} · {fmtDate(s.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {busyId === s.id && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-slate-400" />}
                {onOpenInTools && isPdf(s.mime) && (
                  <button type="button" onClick={() => void doOpenInTools(s)} disabled={busyId === s.id} title={tr ? "Araçlarda aç" : "Open in tools"} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-cyan-300 disabled:opacity-50">
                    <Wrench className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => void doDownload(s)} disabled={busyId === s.id} title={tr ? "İndir" : "Download"} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => void doShare(s)} disabled={busyId === s.id} title={tr ? "Paylaş" : "Share"} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                  <Share2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => void doDelete(s)} disabled={busyId === s.id} title={tr ? "Sil" : "Delete"} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
