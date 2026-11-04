import { useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { DocReadError, decodeText, epubToBlocks, mdToBlocks, odtToBlocks, rtfToBlocks, txtToBlocks, type Block } from "../../lib/docText";
import { blocksToEpub, blocksToMarkdown, pdfToBlocks } from "../../lib/docExport";
import { blocksToPdf } from "../../lib/blocksPdf";
import { ScannedPdfError } from "../../lib/pdfToUdf";

/**
 * Ek dönüştürmeler — hepsi CİHAZDA çalışır, dosya sunucuya gitmez.
 * TXT / Markdown / RTF / ODT / EPUB'tan PDF'e, PDF'ten EPUB'a, PDF'ten Markdown'a.
 */
export type DocMode = "txt-to-pdf" | "markdown-to-pdf" | "rtf-to-pdf" | "odt-to-pdf" | "epub-to-pdf" | "pdf-to-epub" | "pdf-to-markdown";

export const DOC_MODES: DocMode[] = ["txt-to-pdf", "markdown-to-pdf", "rtf-to-pdf", "odt-to-pdf", "epub-to-pdf", "pdf-to-epub", "pdf-to-markdown"];

type Result = { blob: Blob; filename: string; note: string };

const MAX_BYTES = 60 * 1024 * 1024;

const CFG: Record<DocMode, { accept: string; ext: RegExp; tr: { label: string; note: string; run: string }; en: { label: string; note: string; run: string } }> = {
  "txt-to-pdf": {
    accept: ".txt,.text,.log,text/plain", ext: /\.(txt|text|log)$/i,
    tr: { label: "Metin (.txt) dosyasını buraya sürükle", note: "Türkçe karakterler korunur (UTF-8 ve eski ANSI) · 60 MB · cihazda dönüşür", run: "PDF'ye çevir" },
    en: { label: "Drag your text (.txt) file here", note: "Turkish and other characters preserved (UTF-8 and legacy ANSI) · 60 MB · converted on device", run: "Convert to PDF" },
  },
  "markdown-to-pdf": {
    accept: ".md,.markdown,.txt", ext: /\.(md|markdown|txt)$/i,
    tr: { label: "Markdown (.md) dosyasını buraya sürükle", note: "Başlık, liste, alıntı, kod ve tablo satırları · 60 MB · cihazda dönüşür", run: "PDF'ye çevir" },
    en: { label: "Drag your Markdown (.md) file here", note: "Headings, lists, quotes, code and table rows · 60 MB · converted on device", run: "Convert to PDF" },
  },
  "rtf-to-pdf": {
    accept: ".rtf,application/rtf,text/rtf", ext: /\.rtf$/i,
    tr: { label: "RTF dosyasını buraya sürükle", note: "Zengin Metin Biçimi (.rtf) · 60 MB · cihazda dönüşür", run: "PDF'ye çevir" },
    en: { label: "Drag your RTF file here", note: "Rich Text Format (.rtf) · 60 MB · converted on device", run: "Convert to PDF" },
  },
  "odt-to-pdf": {
    accept: ".odt,application/vnd.oasis.opendocument.text", ext: /\.odt$/i,
    tr: { label: "ODT dosyasını buraya sürükle", note: "LibreOffice / OpenOffice belgesi (.odt) · 60 MB · cihazda dönüşür", run: "PDF'ye çevir" },
    en: { label: "Drag your ODT file here", note: "LibreOffice / OpenOffice document (.odt) · 60 MB · converted on device", run: "Convert to PDF" },
  },
  "epub-to-pdf": {
    accept: ".epub,application/epub+zip", ext: /\.epub$/i,
    tr: { label: "EPUB e-kitabını buraya sürükle", note: "DRM'siz e-kitap (.epub) · 60 MB · cihazda dönüşür", run: "PDF'ye çevir" },
    en: { label: "Drag your EPUB e-book here", note: "DRM-free e-book (.epub) · 60 MB · converted on device", run: "Convert to PDF" },
  },
  "pdf-to-epub": {
    accept: ".pdf,application/pdf", ext: /\.pdf$/i,
    tr: { label: "PDF dosyasını buraya sürükle", note: "Metin içeren PDF · 60 MB · cihazda dönüşür", run: "EPUB'a çevir" },
    en: { label: "Drag your PDF here", note: "PDF with selectable text · 60 MB · converted on device", run: "Convert to EPUB" },
  },
  "pdf-to-markdown": {
    accept: ".pdf,application/pdf", ext: /\.pdf$/i,
    tr: { label: "PDF dosyasını buraya sürükle", note: "Metin içeren PDF · 60 MB · cihazda dönüşür", run: "Markdown'a çevir" },
    en: { label: "Drag your PDF here", note: "PDF with selectable text · 60 MB · converted on device", run: "Convert to Markdown" },
  },
};

const baseName = (n: string) => (n || "belge").replace(/\.[^.]+$/, "");
const humanSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function errorText(e: unknown, tr: boolean, name: string): string {
  if (e instanceof ScannedPdfError)
    return tr
      ? `"${name}" taranmış bir PDF gibi görünüyor (seçilebilir metin yok). Önce «Taranmış PDF (OCR)» aracıyla metne çevirin.`
      : `"${name}" looks like a scanned PDF (no selectable text). Run it through the OCR tool first.`;
  if (e instanceof DocReadError) {
    if (e.code === "empty") return tr ? `"${name}" içinde dönüştürülecek metin bulunamadı.` : `No text to convert was found in "${name}".`;
    return tr ? `"${name}" geçerli bir dosya değil ya da bozuk.` : `"${name}" is not a valid file or is corrupt.`;
  }
  return tr ? `"${name}" işlenemedi. Dosya bozuk ya da şifreli olabilir.` : `Could not process "${name}". The file may be corrupt or protected.`;
}

export function DocConvertTool({ language, mode }: { language: Language; mode: DocMode }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const cfg = CFG[mode];
  const t = tr ? cfg.tr : cfg.en;
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const add = (incoming: File[]) => {
    setError(null);
    const ok = incoming.find((f) => cfg.ext.test(f.name));
    if (!ok) {
      setError(tr ? "Bu araç için uygun bir dosya seçin." : "Please choose a file this tool supports.");
      return;
    }
    setFile(ok);
  };

  const run = async () => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(tr ? "Dosya 60 MB'ı aşıyor." : "File exceeds 60 MB.");
      return;
    }
    setBusy(true);
    try {
      const name = baseName(file.name);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let blocks: Block[];
      let title = name;
      if (mode === "txt-to-pdf") blocks = txtToBlocks(decodeText(bytes));
      else if (mode === "markdown-to-pdf") blocks = mdToBlocks(decodeText(bytes));
      else if (mode === "rtf-to-pdf") blocks = rtfToBlocks(new TextDecoder("latin1").decode(bytes));
      else if (mode === "odt-to-pdf") blocks = odtToBlocks(bytes);
      else if (mode === "epub-to-pdf") {
        const r = epubToBlocks(bytes);
        blocks = r.blocks;
        title = r.title || name;
      } else blocks = await pdfToBlocks(file);

      if (blocks.length === 0) throw new DocReadError("empty", "empty");

      if (mode === "pdf-to-markdown") {
        setResult({
          blob: new Blob([blocksToMarkdown(blocks)], { type: "text/markdown;charset=utf-8" }),
          filename: `${name}.md`,
          note: tr ? "Başlıklar, listeler ve paragraflar Markdown'a aktarıldı. Tablo ve görseller aktarılmaz." : "Headings, lists and paragraphs were carried over to Markdown. Tables and images are not included.",
        });
      } else if (mode === "pdf-to-epub") {
        setResult({
          blob: new Blob([blocksToEpub(blocks, { title, lang: tr ? "tr" : "en" }) as BlobPart], { type: "application/epub+zip" }),
          filename: `${name}.epub`,
          note: tr ? "Metin e-kitaba aktarıldı (başlıklara göre bölümlendi, içindekiler eklendi). Görseller ve sayfa düzeni aktarılmaz." : "Text was carried into the e-book (split by headings, with a table of contents). Images and page layout are not included.",
        });
      } else {
        const pdf = await blocksToPdf(blocks, { title });
        setResult({
          blob: new Blob([pdf as BlobPart], { type: "application/pdf" }),
          filename: `${name}.pdf`,
          note:
            mode === "epub-to-pdf" || mode === "odt-to-pdf" || mode === "rtf-to-pdf"
              ? tr ? "Metin, başlıklar ve listeler aktarıldı. Görseller ve karmaşık sayfa düzeni aktarılmaz." : "Text, headings and lists were carried over. Images and complex page layout are not included."
              : tr ? "Türkçe karakterler korunarak A4 PDF oluşturuldu." : "An A4 PDF was created with all characters preserved.",
        });
      }
    } catch (e) {
      setError(errorText(e, tr, file.name));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ToolResultPanel ratingToolSlug={mode} blob={result.blob} filename={result.filename} language={language} processedOnDevice onClose={reset}>
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">{result.note}</p>
        <ValueMomentNudge language={language} source="doc_convert_success" />
      </ToolResultPanel>
    );
  }

  return (
    <div>
      <div className="tool-form">
        <WorkspaceUploadField
          toolId={mode}
          language={language}
          accept={cfg.accept}
          multiple={false}
          disabled={busy}
          appendMode={false}
          label={t.label}
          note={t.note}
          hideHeader={describesTool}
          onFiles={add}
        />

        {file && (
          <ul className="field field--full space-y-2">
            <li className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-nb-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-100">{file.name}</p>
                <p className="text-[12px] text-slate-400">{humanSize(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                aria-label={tr ? "Kaldır" : "Remove"}
                onClick={() => setFile(null)}
                className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          </ul>
        )}

        {error && (
          <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="primary-action" onClick={() => void run()} disabled={busy || !file}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr ? "Çevriliyor…" : "Converting…"}
            </span>
          ) : (
            t.run
          )}
        </button>

        <p className="field--full text-center text-[12px] text-slate-400">
          {tr ? "Dosyanız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Processing happens in your browser — nothing is uploaded."}
        </p>
      </div>
    </div>
  );
}
