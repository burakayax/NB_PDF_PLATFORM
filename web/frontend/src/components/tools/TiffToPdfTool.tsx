/**
 * TIFF'ten PDF'e — tek veya çok sayfalı TIFF/TIF dosyalarını PDF'e çevirir (taranmış belge, UYAP/e-başvuru evrakı).
 *
 * Her şey cihazda yapılır (utif2 + pdf-lib); dosya sunucuya gitmez. Çok sayfalı TIFF'in her sayfası
 * PDF'te ayrı sayfa olur, sıra korunur. Birden çok TIFF seçilirse dosya sırasıyla tek PDF'te birleşir.
 * Motor "Görselden PDF'e" ile aynıdır (`filesToImageInputs` + `imagesToPdf`).
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, FileType2, Loader2, Trash2 } from "lucide-react";
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
        appendMode={items.length > 0}
        hideBenefits={items.length > 0}
        label={tr ? "TIFF dosyalarını buraya sürükle" : "Drag your TIFF files here"}
        note={tr ? "TIF / TIFF · çok sayfalı olabilir · cihazınızdan çıkmaz" : "TIF / TIFF · may be multi-page · stays on your device"}
        hideHeader={describesTool}
        onFiles={add}
      />

      {items.length === 0 && (
        <div className="field--full mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-slate-300">
          <p className="font-semibold text-slate-100">{tr ? "Bu araç ne işe yarar?" : "What is this tool for?"}</p>
          <p className="mt-1">
            {tr
              ? "Tarayıcı ve fotokopi makineleri taramayı çoğu zaman TIFF (.tif) olarak kaydeder; başvuru ekranları ve e-postalar ise PDF ister. Bu araç TIFF dosyanızı PDF'e çevirir. Sonuçta yazı seçilemez, dosya bir görüntü gibi PDF'e konur."
              : "Scanners and copiers often save scans as TIFF (.tif), while online forms and email want a PDF. This tool turns your TIFF into a PDF. The result is an image placed in a PDF, so the text is not selectable."}
          </p>
          <p className="mt-2 font-semibold text-slate-100">{tr ? "Çok sayfalı TIFF nedir?" : "What is a multi-page TIFF?"}</p>
          <p className="mt-1">
            {tr
              ? "Tek bir TIFF dosyasının içinde birden fazla sayfa olabilir. Örneğin 10 sayfalık bir belgeyi taradığınızda tek bir .tif dosyası çıkar. Araç bu sayfaların hepsini sırayla PDF'e koyar; bir fotoğraf gibi tek sayfalık TIFF ise tek sayfalık PDF olur."
              : "One TIFF file can hold several pages. Scan a 10-page document and you may get a single .tif file. The tool puts every page into the PDF in order; a single-page TIFF, like a photo, becomes a one-page PDF."}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <>
        <p className="field--full mt-4 text-[13px] font-semibold uppercase tracking-wide text-cyan-200">
          {tr ? `Eklenen dosya${items.length > 1 ? "lar" : ""} (${items.length})` : `Added file${items.length > 1 ? "s" : ""} (${items.length})`}
        </p>
        <ul className="field--full mt-2 space-y-2.5" aria-label={tr ? "Seçilen dosyalar" : "Selected files"}>
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-4 rounded-2xl border-2 border-cyan-400/50 bg-cyan-400/[0.10] px-5 py-5 shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-200"><FileType2 className="h-6 w-6" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-white">{it.file.name}</span>
                <span className="mt-0.5 block text-[13px] text-slate-300">TIFF · {mb(it.file.size)}</span>
              </span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr ? "Yukarı al" : "Move up"} className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={tr ? "Aşağı al" : "Move down"} className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} aria-label={tr ? "Kaldır" : "Remove"} className="rounded-md p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        </>
      )}

      {items.length > 0 && (
      <div className="field field--full mt-3 flex flex-wrap items-center gap-3 text-[13px] text-slate-200">
        <label className="flex items-center gap-1.5">
          {tr ? "Sayfa boyutu:" : "Page size:"}
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value as ImagePageSize)}>
            <option value="original">{tr ? "Taramanın kendi boyutu" : "Same as the scan"}</option>
            <option value="a4">{tr ? "A4'e sığdır" : "Fit to A4"}</option>
          </select>
        </label>
      </div>
      )}

      {error && <p className="field--full mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2.5 text-[13px] text-amber-200" role="alert">{error}</p>}

      {items.length > 0 && (
        <button type="button" className="primary-action mt-3" onClick={() => void run()} disabled={busy}>
          {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Çevriliyor…" : "Converting…"}</span> : tr ? "PDF'e çevir" : "Convert to PDF"}
        </button>
      )}
      <p className="field--full mt-2 text-center text-[12px] text-slate-400">
        {tr ? "Dosyalarınız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Your files are processed in your browser — never uploaded."}
      </p>
    </div>
  );
}
