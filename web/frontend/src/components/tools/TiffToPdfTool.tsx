/**
 * TIFF'ten PDF'e — tek veya çok sayfalı TIFF/TIF dosyalarını PDF'e çevirir (taranmış belge, UYAP/e-başvuru evrakı).
 *
 * Her şey cihazda yapılır (utif2 + pdf-lib); dosya sunucuya gitmez. Çok sayfalı TIFF'in her sayfası
 * PDF'te ayrı sayfa olur, sıra korunur. Birden çok TIFF seçilirse dosya sırasıyla tek PDF'te birleşir.
 * Motor "Görselden PDF'e" ile aynıdır (`filesToImageInputs` + `imagesToPdf`).
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { imagesToPdf, type ImagePageSize } from "../../lib/clientPdf";
import { pdfBytesToBlob } from "../../lib/clientPdfCore";
import { filesToImageInputs, isTiffFile } from "../../lib/tiffPages";

const MAX_FILES = 30;
const MAX_BYTES = 200 * 1024 * 1024;

type Item = { id: string; file: File };
let seq = 0;

export const tiffOutputName = (name: string) => `${name.replace(/\.tiff?$/i, "").trim() || "tarama"}.pdf`;

export function TiffToPdfTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<ImagePageSize>("original");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const add = (files: File[]) => {
    setError(null);
    const tiffs = files.filter(isTiffFile);
    const skipped = files.length - tiffs.length;
    const room = MAX_FILES - items.length;
    const take = tiffs.slice(0, Math.max(0, room));
    if (take.length === 0) {
      setError(tr ? "Lütfen TIFF (.tif / .tiff) dosyası seçin. JPG, PNG ve WebP için «Görselden PDF'e» aracını kullanın." : "Please choose a TIFF (.tif / .tiff) file. For JPG, PNG and WebP use the Image to PDF tool.");
      return;
    }
    const big = take.find((f) => f.size > MAX_BYTES);
    if (big) {
      setError(tr ? `${big.name} 200 MB'tan büyük.` : `${big.name} is larger than 200 MB.`);
      return;
    }
    if (skipped > 0 || tiffs.length > take.length) {
      setError(tr ? "Bazı dosyalar atlandı (yalnız TIFF kabul edilir; en çok 30 dosya)." : "Some files were skipped (only TIFF is accepted; up to 30 files).");
    }
    setItems((p) => [...p, ...take.map((file) => ({ id: `t${++seq}`, file }))]);
  };

  const move = (i: number, d: -1 | 1) =>
    setItems((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i]!, n[j]!] = [n[j]!, n[i]!];
      return n;
    });

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const inputs = await filesToImageInputs(items.map((x) => x.file));
      const bytes = await imagesToPdf(inputs, pageSize);
      setResult({ blob: pdfBytesToBlob(bytes), name: tiffOutputName(items[0]!.file.name) });
    } catch {
      setError(
        tr
          ? "Dosya çevrilemedi. TIFF bozuk ya da desteklenmeyen bir sıkıştırma kullanıyor olabilir."
          : "Could not convert the file. The TIFF may be corrupt or use an unsupported compression.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ToolResultPanel
        ratingToolSlug="tiff-to-pdf"
        blob={result.blob}
        filename={result.name}
        language={language}
        processedOnDevice
        onClose={() => { setResult(null); setItems([]); }}
      >
        <ValueMomentNudge language={language} source="tiff_to_pdf_success" />
      </ToolResultPanel>
    );
  }

  const mb = (n: number) => `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;

  return (
    <div className="tool-form">
      <WorkspaceUploadField
        toolId="tiff-to-pdf"
        language={language}
        accept="image/tiff,.tif,.tiff"
        multiple
        disabled={busy}
        label={tr ? "TIFF dosyalarını buraya sürükle" : "Drag your TIFF files here"}
        note={tr ? "TIF / TIFF · çok sayfalı olabilir · cihazınızdan çıkmaz" : "TIF / TIFF · may be multi-page · stays on your device"}
        hideHeader={describesTool}
        onFiles={add}
      />

      {items.length > 0 && (
        <ul className="field--full mt-3 space-y-2" aria-label={tr ? "Seçilen dosyalar" : "Selected files"}>
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{it.file.name}</span>
              <span className="shrink-0 text-[12px] text-slate-400">{mb(it.file.size)}</span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr ? "Yukarı al" : "Move up"} className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={tr ? "Aşağı al" : "Move down"} className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} aria-label={tr ? "Kaldır" : "Remove"} className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="field field--full mt-3 flex flex-wrap items-center gap-3 text-[13px] text-slate-200">
        <label className="flex items-center gap-1.5">
          {tr ? "Sayfa boyutu:" : "Page size:"}
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as ImagePageSize)}>
            <option value="original">{tr ? "Taramanın kendi boyutu" : "Same as the scan"}</option>
            <option value="a4">{tr ? "A4'e sığdır" : "Fit to A4"}</option>
          </select>
        </label>
      </div>

      {error && <p className="field--full mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-[13px] text-amber-200" role="alert">{error}</p>}

      <button type="button" className="primary-action mt-3" onClick={() => void run()} disabled={busy || items.length === 0}>
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Çevriliyor…" : "Converting…"}</span> : tr ? "PDF'e çevir" : "Convert to PDF"}
      </button>
      <p className="field--full mt-2 text-center text-[12px] text-slate-400">
        {tr ? "Dosyalarınız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Your files are processed in your browser — never uploaded."}
      </p>
    </div>
  );
}
