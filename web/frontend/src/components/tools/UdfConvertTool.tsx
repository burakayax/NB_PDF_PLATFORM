import { useState } from "react";
import { AlertTriangle, Copy, FileText, Loader2, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { parseUdf, udfPlainText, UdfParseError } from "../../lib/udf";
import { writeUdf } from "../../lib/udfWrite";
import { ConvertError, docxToUdf, imagesToUdf, udfToDocx } from "../../lib/udfConvert";
import { ScannedPdfError, pdfToUdf } from "../../lib/pdfToUdf";
import { isTiffFile, tiffToPngPages } from "../../lib/tiffPages";

/**
 * UYAP / UDF araç ailesi — hepsi CİHAZDA çalışır, dosya sunucuya gitmez.
 * Beş mod: PDF→UDF, Word→UDF, UDF→Word, UDF Görüntüleyici, Görsel/TIFF→UDF.
 *
 * Bu araçlar resmi bir UYAP hizmeti değildir; e-imza dönüştürülen kopyaya taşınmaz.
 * Uyarı metni her modda formun altında görünür.
 */
export type UdfMode = "pdf-to-udf" | "word-to-udf" | "udf-to-word" | "udf-viewer" | "image-to-udf";

type Result = { blob: Blob; filename: string; note: string };

const MAX_BYTES = 40 * 1024 * 1024;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

export const UDF_DISCLAIMER_TR =
  "Bu araç resmi bir UYAP hizmeti değildir. E-imzalı belgelerin imzası dönüştürülen kopyaya taşınmaz; resmi gönderimlerde orijinal imzalı belgeyi kullanın.";
export const UDF_DISCLAIMER_EN =
  "This tool is not an official UYAP service. Signatures on e-signed documents do not carry over to the converted copy; use the original signed document for official submissions.";

const CFG: Record<UdfMode, { accept: string; multiple: boolean; ext: RegExp; tr: { label: string; note: string; run: string; busy: string }; en: { label: string; note: string; run: string; busy: string } }> = {
  "pdf-to-udf": {
    accept: ".pdf,application/pdf", multiple: false, ext: /\.pdf$/i,
    tr: { label: "PDF dosyasını buraya sürükle", note: "Metin içeren PDF · 40 MB · cihazda dönüşür", run: "UDF'ye çevir", busy: "Çevriliyor…" },
    en: { label: "Drag your PDF here", note: "PDF with selectable text · 40 MB · converted on device", run: "Convert to UDF", busy: "Converting…" },
  },
  "word-to-udf": {
    accept: ".docx", multiple: false, ext: /\.docx$/i,
    tr: { label: "Word (.docx) dosyasını buraya sürükle", note: "Word belgesi (.docx) · 40 MB · cihazda dönüşür", run: "UDF'ye çevir", busy: "Çevriliyor…" },
    en: { label: "Drag your Word (.docx) file here", note: "Word document (.docx) · 40 MB · converted on device", run: "Convert to UDF", busy: "Converting…" },
  },
  "udf-to-word": {
    accept: ".udf", multiple: false, ext: /\.udf$/i,
    tr: { label: "UDF dosyasını buraya sürükle", note: "UYAP'tan indirdiğiniz .udf · 40 MB · cihazda dönüşür", run: "Word'e çevir", busy: "Çevriliyor…" },
    en: { label: "Drag your UDF file here", note: ".udf from UYAP · 40 MB · converted on device", run: "Convert to Word", busy: "Converting…" },
  },
  "udf-viewer": {
    accept: ".udf", multiple: false, ext: /\.udf$/i,
    tr: { label: "UDF dosyasını buraya sürükle", note: "Program kurmadan görüntüleyin · dosya cihazınızdan çıkmaz", run: "Belgeyi göster", busy: "Açılıyor…" },
    en: { label: "Drag your UDF file here", note: "View without installing anything · the file stays on your device", run: "Show document", busy: "Opening…" },
  },
  "image-to-udf": {
    accept: ".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff", multiple: true, ext: IMAGE_EXT,
    tr: { label: "Görselleri buraya sürükle", note: "JPG, PNG, TIFF (çok sayfalı dahil) · her görsel ayrı sayfa · 40 MB", run: "UDF'ye çevir", busy: "Çevriliyor…" },
    en: { label: "Drag your images here", note: "JPG, PNG, TIFF (multi-page too) · one page per image · 40 MB", run: "Convert to UDF", busy: "Converting…" },
  },
};

const baseName = (n: string) => (n || "belge").replace(/\.[^.]+$/, "");
const humanSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

async function canvasPng(file: File): Promise<Uint8Array> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function toUdfImages(files: File[]): Promise<{ bytes: Uint8Array; mime: "image/png" | "image/jpeg" }[]> {
  const out: { bytes: Uint8Array; mime: "image/png" | "image/jpeg" }[] = [];
  for (const f of files) {
    if (isTiffFile(f)) {
      for (const page of await tiffToPngPages(await f.arrayBuffer())) out.push({ bytes: new Uint8Array(page), mime: "image/png" });
    } else if (/jpe?g$/i.test(f.name) || f.type === "image/jpeg") {
      out.push({ bytes: new Uint8Array(await f.arrayBuffer()), mime: "image/jpeg" });
    } else if (/png$/i.test(f.name) || f.type === "image/png") {
      out.push({ bytes: new Uint8Array(await f.arrayBuffer()), mime: "image/png" });
    } else {
      out.push({ bytes: await canvasPng(f), mime: "image/png" });
    }
  }
  return out;
}

function errorText(e: unknown, tr: boolean, name: string): string {
  if (e instanceof ScannedPdfError)
    return tr
      ? `"${name}" taranmış bir PDF gibi görünüyor (seçilebilir metin yok). Önce «Taranmış PDF (OCR)» aracıyla metne çevirin.`
      : `"${name}" looks like a scanned PDF (no selectable text). Run it through the OCR tool first.`;
  if (e instanceof UdfParseError)
    return tr ? `"${name}" geçerli bir UDF dosyası değil ya da bozuk.` : `"${name}" is not a valid UDF file or is corrupt.`;
  if (e instanceof ConvertError) return e.message;
  return tr ? `"${name}" işlenemedi. Dosya bozuk olabilir.` : `Could not process "${name}". The file may be corrupt.`;
}

export function UdfConvertTool({ language, mode }: { language: Language; mode: UdfMode }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const cfg = CFG[mode];
  const t = tr ? cfg.tr : cfg.en;
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [viewText, setViewText] = useState<{ name: string; text: string } | null>(null);

  const reset = () => {
    setFiles([]);
    setResult(null);
    setViewText(null);
    setError(null);
  };

  const add = (incoming: File[]) => {
    setError(null);
    const ok = incoming.filter((f) => cfg.ext.test(f.name));
    if (ok.length === 0) {
      setError(tr ? "Bu araç için uygun bir dosya seçin." : "Please choose a file this tool supports.");
      return;
    }
    setFiles((prev) => (cfg.multiple ? [...prev, ...ok].slice(0, 30) : [ok[0]!]));
  };

  const run = async () => {
    setError(null);
    if (files.length === 0) return;
    if (files.reduce((s, f) => s + f.size, 0) > MAX_BYTES) {
      setError(tr ? "Toplam boyut 40 MB'ı aşıyor." : "Total size exceeds 40 MB.");
      return;
    }
    setBusy(true);
    const first = files[0]!;
    try {
      if (mode === "pdf-to-udf") {
        const doc = await pdfToUdf(first);
        setResult({
          blob: new Blob([writeUdf(doc) as BlobPart], { type: "application/octet-stream" }),
          filename: `${baseName(first.name)}.udf`,
          note: tr
            ? "Metin ve paragraflar aktarıldı; yazı tipi ve boyut korunmaz. UYAP Doküman Editörü'nde açıp gerekirse biçimlendirin."
            : "Text and paragraphs were carried over; fonts and sizes are not preserved. Open it in the UYAP editor to format it.",
        });
      } else if (mode === "word-to-udf") {
        const doc = docxToUdf(new Uint8Array(await first.arrayBuffer()));
        setResult({
          blob: new Blob([writeUdf(doc) as BlobPart], { type: "application/octet-stream" }),
          filename: `${baseName(first.name)}.udf`,
          note: tr ? "Biçim, hizalama, tablo ve görseller aktarıldı." : "Formatting, alignment, tables and images were carried over.",
        });
      } else if (mode === "udf-to-word") {
        const doc = parseUdf(new Uint8Array(await first.arrayBuffer()));
        setResult({
          blob: new Blob([udfToDocx(doc) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
          filename: `${baseName(first.name)}.docx`,
          note: tr ? "Belge Word olarak düzenlenebilir hale geldi." : "The document is now editable in Word.",
        });
      } else if (mode === "udf-viewer") {
        const doc = parseUdf(new Uint8Array(await first.arrayBuffer()));
        setViewText({ name: first.name, text: udfPlainText(doc) });
      } else {
        const imgs = await toUdfImages(files);
        if (imgs.length === 0) throw new ConvertError(tr ? "Görsel okunamadı." : "No readable image.", "empty");
        setResult({
          blob: new Blob([writeUdf(imagesToUdf(imgs)) as BlobPart], { type: "application/octet-stream" }),
          filename: `${baseName(first.name)}.udf`,
          note: tr ? `${imgs.length} sayfalık UDF oluşturuldu.` : `A ${imgs.length}-page UDF was created.`,
        });
      }
    } catch (e) {
      setError(errorText(e, tr, first.name));
    } finally {
      setBusy(false);
    }
  };

  const disclaimer = (
    <p className="field--full flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5 text-left text-[12px] leading-relaxed text-amber-100/90">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{tr ? UDF_DISCLAIMER_TR : UDF_DISCLAIMER_EN}</span>
    </p>
  );

  if (result) {
    return (
      <ToolResultPanel
        ratingToolSlug={mode}
        blob={result.blob}
        filename={result.filename}
        language={language}
        processedOnDevice
        onClose={reset}
      >
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">{result.note}</p>
        <div className="mt-3">{disclaimer}</div>
        <ValueMomentNudge language={language} source="udf_convert_success" />
      </ToolResultPanel>
    );
  }

  if (viewText) {
    return (
      <div className="tool-form">
        <div className="field field--full">
          <span>{viewText.name}</span>
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900/60 p-4 text-[13px] leading-relaxed text-slate-200">
            {viewText.text.trim() || (tr ? "(Belgede metin yok.)" : "(The document has no text.)")}
          </pre>
        </div>
        <div className="field--full flex flex-wrap gap-2">
          <button
            type="button"
            className="primary-action"
            onClick={() => void navigator.clipboard?.writeText(viewText.text)}
          >
            <span className="inline-flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {tr ? "Metni kopyala" : "Copy text"}
            </span>
          </button>
          <button type="button" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-white/5" onClick={reset}>
            {tr ? "Başka dosya aç" : "Open another file"}
          </button>
        </div>
        {disclaimer}
      </div>
    );
  }

  return (
    <div>
      <div className="tool-form">
        <WorkspaceUploadField
          toolId={mode}
          language={language}
          accept={cfg.accept}
          multiple={cfg.multiple}
          disabled={busy}
          appendMode={files.length > 0}
          label={t.label}
          note={t.note}
          hideHeader={describesTool}
          onFiles={add}
        />

        {files.length > 0 && (
          <ul className="field field--full space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <FileText className="h-5 w-5 shrink-0 text-nb-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-100">{f.name}</p>
                  <p className="text-[12px] text-slate-400">{humanSize(f.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={tr ? "Kaldır" : "Remove"}
                  onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || files.length === 0}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.busy}
            </span>
          ) : (
            t.run
          )}
        </button>

        {disclaimer}

        <p className="field--full text-center text-[12px] text-slate-400">
          {tr ? "Dosyanız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Processing happens in your browser — nothing is uploaded."}
        </p>
      </div>
    </div>
  );
}
