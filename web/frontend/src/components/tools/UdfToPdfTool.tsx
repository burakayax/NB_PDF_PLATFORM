import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { ProBatchNotice } from "./ProBatchNotice";
import { isPaidPlan, useCurrentPlan } from "../../lib/currentPlan";
import { zipStore } from "../../lib/zipStore";
import { parseUdf, udfPlainText, UdfParseError, type UdfDocument } from "../../lib/udf";
import { udfToPdf } from "../../lib/udfPdf";

/**
 * UDF → PDF — UYAP Doküman Formatı'ndaki belgeyi PDF'e çevirir.
 *
 * Tamamen CİHAZDA çalışır: dosya sunucuya GİTMEZ. Bu araçta gizlilik teorik bir
 * satış cümlesi değil, gereklilik — UDF dosyaları dava dilekçesi, müzekkere ve
 * kişisel veri içeren adli evrak taşır.
 *
 * Tek dosya → PDF; birden fazla dosya → tek ZIP. Belgenin düz metni de ayrıca
 * indirilebilir (dilekçeyi Word'e yapıştırmak isteyen için).
 */

type Picked = { id: string; file: File };
type Parsed = { name: string; doc: UdfDocument };
type Result = {
  blob: Blob;
  filename: string;
  count: number;
  /** Önizleme + .txt indirmesi için çözülen düz metin. */
  text: string;
  textName: string;
};

const MAX_FILES = 20;
const MAX_BYTES = 40 * 1024 * 1024;
const PREVIEW_CHARS = 1200;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function humanSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function baseName(name: string): string {
  return (name || "belge").replace(/\.[^.]+$/, "");
}

/** Ayrıştırma hatasını kullanıcının anlayacağı cümleye çevirir. */
function errorText(e: unknown, tr: boolean, fileName: string): string {
  const code = e instanceof UdfParseError ? e.code : null;
  if (code === "not-zip") {
    return tr
      ? `"${fileName}" geçerli bir UDF dosyası değil. UYAP'tan indirdiğiniz dosyanın uzantısı .udf olmalı.`
      : `"${fileName}" is not a valid UDF file. The file downloaded from UYAP should have a .udf extension.`;
  }
  if (code === "no-content-xml") {
    return tr
      ? `"${fileName}" içinde belge metni (content.xml) bulunamadı. Dosya eksik indirilmiş olabilir.`
      : `No document body (content.xml) was found inside "${fileName}". The download may be incomplete.`;
  }
  if (code === "empty") {
    return tr ? `"${fileName}" boş görünüyor.` : `"${fileName}" appears to be empty.`;
  }
  return tr
    ? `"${fileName}" okunamadı. Dosya bozuk olabilir.`
    : `Could not read "${fileName}". The file may be corrupt.`;
}

export function UdfToPdfTool({ language }: { language: Language }) {
  const tr = language === "tr";
  // Toplu çevirme Pro kazanımıdır; tek dosya herkese açık kalır.
  const paid = isPaidPlan(useCurrentPlan());
  const [files, setFiles] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [fonts, setFonts] = useState<{ regular: ArrayBuffer; bold: ArrayBuffer } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (files.length > 0) listRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [files.length]);

  // Türkçe harfler için Unicode font şart; ilk dosya seçilince arkada indirilir.
  useEffect(() => {
    if (files.length === 0 || fonts) return;
    let alive = true;
    void Promise.all([
      fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
      fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()),
    ])
      .then(([regular, bold]) => {
        if (alive) setFonts({ regular, bold });
      })
      .catch(() => {
        /* dönüştürme anında tekrar denenir */
      });
    return () => {
      alive = false;
    };
  }, [files.length, fonts]);

  const addFiles = useCallback(
    (incoming: File[]) => {
      setError(null);
      const udfs = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".udf"));
      if (udfs.length === 0) {
        setError(
          tr
            ? "Lütfen .udf uzantılı bir dosya ekleyin (UYAP'tan indirdiğiniz belge)."
            : "Please add a .udf file (the document you downloaded from UYAP).",
        );
        return;
      }
      setFiles((prev) => {
        const next = [...prev];
        for (const f of udfs) {
          if (next.length >= MAX_FILES) break;
          next.push({ id: uid(), file: f });
        }
        return next;
      });
    },
    [tr],
  );

  const remove = (id: string) => setFiles((prev) => prev.filter((p) => p.id !== id));

  const reset = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const totalIn = files.reduce((s, f) => s + f.file.size, 0);

  const run = async () => {
    setError(null);
    if (files.length === 0) {
      setError(tr ? "En az 1 UDF dosyası ekleyin." : "Add at least one UDF file.");
      return;
    }
    if (totalIn > MAX_BYTES) {
      setError(tr ? "Toplam boyut 40 MB'ı aşıyor." : "Total size exceeds 40 MB.");
      return;
    }

    setBusy(true);
    try {
      let loaded = fonts;
      if (!loaded) {
        const [regular, bold] = await Promise.all([
          fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
          fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()),
        ]);
        loaded = { regular, bold };
        setFonts(loaded);
      }

      // Ücretsiz kullanıcıda yalnız ilk dosya işlenir. Bu, düğmeye basılmadan
      // ÖNCE hem kartta hem düğme metninde yazar; burada sürpriz yapılmaz.
      const islenecek = paid ? files : files.slice(0, 1);

      // 1) Ayrıştır — bir dosya bozuksa hangisi olduğunu söyleyebilmek için ayrı adım.
      const parsed: Parsed[] = [];
      for (const p of islenecek) {
        const bytes = new Uint8Array(await p.file.arrayBuffer());
        try {
          parsed.push({ name: p.file.name, doc: parseUdf(bytes) });
        } catch (e) {
          setError(errorText(e, tr, p.file.name));
          return;
        }
      }

      // 2) Çiz.
      const pdfs: { name: string; bytes: Uint8Array }[] = [];
      for (const item of parsed) {
        pdfs.push({
          name: `${baseName(item.name)}.pdf`,
          bytes: await udfToPdf(item.doc, loaded),
        });
      }

      const text = parsed.map((p) => udfPlainText(p.doc)).join("\n\n———\n\n");
      const textName = `${baseName(parsed[0]!.name)}.txt`;

      if (pdfs.length === 1) {
        const only = pdfs[0]!;
        setResult({
          blob: new Blob([only.bytes as BlobPart], { type: "application/pdf" }),
          filename: only.name,
          count: 1,
          text,
          textName,
        });
      } else {
        const zip = zipStore(pdfs.map((p) => ({ name: p.name, data: p.bytes })));
        setResult({
          blob: new Blob([zip as BlobPart], { type: "application/zip" }),
          filename: "udf-pdf.zip",
          count: pdfs.length,
          text,
          textName,
        });
      }
    } catch (e) {
      setError(errorText(e, tr, files[0]?.file.name ?? ""));
    } finally {
      setBusy(false);
    }
  };

  const downloadText = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.textName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // ── Sonuç — TÜM araçlarla ortak panel ─────────────────────────────────────
  if (result) {
    const preview = result.text.slice(0, PREVIEW_CHARS);
    return (
      <ToolResultPanel
        ratingToolSlug="udf-to-pdf"
        blob={result.blob}
        filename={result.filename}
        language={language}
        processedOnDevice
        onClose={reset}
      >
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">
          {result.count > 1
            ? tr
              ? `${result.count} UDF dosyası PDF'e çevrildi.`
              : `${result.count} UDF files converted to PDF.`
            : tr
              ? "UDF belgeniz PDF'e çevrildi."
              : "Your UDF document was converted to PDF."}
        </p>

        {result.text.trim() ? (
          <div className="mt-4 text-left">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-300">
                {tr ? "Belgenin metni" : "Document text"}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
                onClick={downloadText}
              >
                <FileText className="h-3.5 w-3.5" />
                {tr ? "Metni .txt indir" : "Download text (.txt)"}
              </button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900/60 p-3 text-[12px] leading-relaxed text-slate-300">
              {preview}
              {result.text.length > PREVIEW_CHARS ? "…" : ""}
            </pre>
          </div>
        ) : null}

        <ValueMomentNudge language={language} source="guest_tool_success" />
      </ToolResultPanel>
    );
  }

  return (
    <div>
      <div className="tool-form">
        <WorkspaceUploadField
          language={language}
          accept=".udf"
          multiple
          disabled={busy}
          appendMode={files.length > 0}
          note={
            tr
              ? paid
                ? "UYAP'tan indirdiğiniz .udf dosyası · tek seferde 20 dosyaya kadar · 40 MB"
                : "UYAP'tan indirdiğiniz .udf dosyası · tek dosya ücretsiz · toplu çevirme Pro'da"
              : paid
                ? ".udf files from UYAP · up to 20 files at once · 40 MB"
                : ".udf files from UYAP · one file free · batch conversion is Pro"
          }
          onFiles={(fl) => addFiles(fl)}
        />

        {files.length > 0 && (
          <div className="field field--full">
            <span>
              {tr ? "Seçilen dosyalar" : "Selected files"} — {files.length}{" "}
              {tr ? "dosya" : "files"} · {humanSize(totalIn)}
            </span>
            <ul ref={listRef} className="space-y-2">
              {files.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
                >
                  <FileText className="h-5 w-5 shrink-0 text-nb-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">{p.file.name}</p>
                    <p className="text-[11px] text-slate-400">{humanSize(p.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label={tr ? "Kaldır" : "Remove"}
                    disabled={busy}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!paid && (
          <ProBatchNotice
            language={language}
            fileCount={files.length}
            toolName={tr ? "UDF çevirme" : "UDF conversion"}
            source="udf_to_pdf"
          />
        )}

        {error && (
          <p
            className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          className="primary-action"
          onClick={() => void run()}
          disabled={busy || files.length === 0}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr ? "Çevriliyor…" : "Converting…"}
            </span>
          ) : !paid && files.length > 1 ? (
            // Düğme metni ne olacağını birebir söyler — kullanıcı bilerek basar.
            tr ? "İlk dosyayı çevir (ücretsiz)" : "Convert the first file (free)"
          ) : tr ? (
            "PDF'e çevir"
          ) : (
            "Convert to PDF"
          )}
        </button>

        <p className="field--full text-center text-[12px] text-slate-400">
          {tr
            ? "Dosyanız tarayıcınızda çevrilir — sunucumuza yüklenmez."
            : "Conversion happens in your browser — nothing is uploaded."}
        </p>
      </div>
    </div>
  );
}
