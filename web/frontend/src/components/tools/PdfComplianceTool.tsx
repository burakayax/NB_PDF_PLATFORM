import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";
import { useToolPageContext } from "../common/toolPageContext";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { allPass, evaluate, formatBytes, type Check, type Limits, type PdfFacts } from "../../lib/pdfCompliance";
import { fixSize, fixToA4, readPdfFacts } from "../../lib/pdfComplianceIo";

/**
 * E-başvuru / Kurum Yükleme Uyumluluk Kontrolü — cihazda çalışır.
 * Sınırları KULLANICI seçer (sabit bir «UYAP sınırı» yoktur; kurum kuralları değişir).
 */

const SIZE_PRESETS_MB = [0.5, 1, 2, 5, 10, 20] as const;
const MAX_FILE = 100 * 1024 * 1024;

export function PdfComplianceTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const { describesTool } = useToolPageContext();
  const [file, setFile] = useState<File | null>(null);
  const [useSize, setUseSize] = useState(true);
  const [sizeMb, setSizeMb] = useState("2");
  const [usePages, setUsePages] = useState(false);
  const [pages, setPages] = useState("50");
  const [a4Only, setA4Only] = useState(true);
  const [requireText, setRequireText] = useState(false);
  const [busy, setBusy] = useState<null | "check" | "fix">(null);
  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<PdfFacts | null>(null);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [fixed, setFixed] = useState<{ blob: Blob; name: string; after: Check[]; note: string } | null>(null);

  const limits = (): Limits => {
    const mb = Number(sizeMb.replace(",", "."));
    const pg = Math.floor(Number(pages));
    return {
      maxBytes: useSize && mb > 0 ? Math.round(mb * 1024 * 1024) : undefined,
      maxPages: usePages && pg > 0 ? pg : undefined,
      a4Only,
      requireText,
    };
  };

  const reset = () => {
    setFile(null);
    setFacts(null);
    setChecks(null);
    setFixed(null);
    setError(null);
  };

  const pick = (fl: File[]) => {
    const f = fl.find((x) => /\.pdf$/i.test(x.name));
    if (!f) {
      setError(tr ? "Lütfen bir PDF dosyası seçin." : "Please choose a PDF file.");
      return;
    }
    if (f.size > MAX_FILE) {
      setError(tr ? "Dosya 100 MB'ı aşıyor." : "File exceeds 100 MB.");
      return;
    }
    setError(null);
    setFile(f);
    setChecks(null);
    setFacts(null);
  };

  const check = async () => {
    if (!file) return;
    setBusy("check");
    setError(null);
    try {
      const f = await readPdfFacts(file);
      setFacts(f);
      setChecks(evaluate(f, limits()));
    } catch {
      setError(tr ? "PDF okunamadı. Dosya bozuk olabilir." : "Could not read the PDF. It may be corrupt.");
    } finally {
      setBusy(null);
    }
  };

  const fix = async () => {
    if (!file || !checks) return;
    setBusy("fix");
    setError(null);
    try {
      const l = limits();
      const needSize = checks.some((c) => c.id === "size" && c.status === "fail");
      const needA4 = checks.some((c) => c.id === "a4" && c.status === "fail");
      let bytes: Uint8Array;
      let rasterized = false;
      if (needSize) {
        const r = await fixSize(file, l);
        bytes = r.bytes;
        rasterized = true;
      } else if (needA4) {
        bytes = await fixToA4(file);
      } else return;
      const out = new File([bytes as BlobPart], file.name.replace(/\.pdf$/i, "") + "-duzeltilmis.pdf", { type: "application/pdf" });
      const after = evaluate(await readPdfFacts(out), l);
      setFixed({
        blob: out,
        name: out.name,
        after,
        note: rasterized
          ? tr
            ? "Sayfalar görüntüye çevrildi: yazı artık seçilemez ve belgedeki e-imza/kaşe korunmaz. Resmî gönderimde orijinal imzalı dosyayı kullanın."
            : "Pages were rasterized: text is no longer selectable and e-signatures/stamps are not kept. Use the original signed file for official submissions."
          : tr
            ? "Sayfalar A4'e sığdırıldı; metin ve içerik korundu."
            : "Pages were fitted to A4; text and content are preserved.",
      });
    } catch {
      setError(tr ? "Düzeltme yapılamadı. Dosya bozuk olabilir." : "Could not apply the fix. The file may be corrupt.");
    } finally {
      setBusy(null);
    }
  };

  if (fixed) {
    const ok = allPass(fixed.after);
    return (
      <ToolResultPanel ratingToolSlug="e-basvuru-uyumluluk" blob={fixed.blob} filename={fixed.name} language={language} processedOnDevice onClose={reset}>
        <p className={`mt-5 text-[13px] font-semibold ${ok ? "text-emerald-200" : "text-amber-200"}`}>
          {ok
            ? tr ? "Düzeltilmiş dosya seçtiğiniz tüm sınırlara uyuyor." : "The fixed file meets all your limits."
            : tr ? "Düzeltildi ama bazı sınırlar hâlâ aşılıyor:" : "Fixed, but some limits are still not met:"}
        </p>
        <ChecksList checks={fixed.after} tr={tr} />
        <p className="mt-3 text-left text-[12px] text-slate-300">{fixed.note}</p>
        <ValueMomentNudge language={language} source="compliance_success" />
      </ToolResultPanel>
    );
  }

  const failedFixable = checks?.some((c) => c.status === "fail" && c.fixable) ?? false;
  const sizeFailing = checks?.some((c) => c.id === "size" && c.status === "fail") ?? false;

  return (
    <div className="tool-form">
      <WorkspaceUploadField
        toolId="e-basvuru-uyumluluk"
        language={language}
        accept=".pdf,application/pdf"
        disabled={busy !== null}
        appendMode={!!file}
        label={tr ? "PDF dosyasını buraya sürükle" : "Drag your PDF here"}
        note={tr ? "Dosya sunucuya yüklenmez · 100 MB'a kadar" : "Not uploaded · up to 100 MB"}
        hideHeader={describesTool}
        onFiles={pick}
      />

      {file && (
        <div className="field field--full flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <FileText className="h-5 w-5 shrink-0 text-nb-accent" />
          <p className="min-w-0 flex-1 truncate text-[13px] text-slate-100">{file.name}</p>
          <span className="text-[12px] text-slate-400">{formatBytes(file.size)}</span>
        </div>
      )}

      <fieldset className="field field--full space-y-3">
        <span>{tr ? "Kurumun istediği sınırlar (siz belirleyin)" : "Limits the institution requires (you decide)"}</span>
        <label className="flex flex-wrap items-center gap-2 text-[13px] text-slate-200">
          <input type="checkbox" checked={useSize} onChange={(e) => setUseSize(e.target.checked)} />
          {tr ? "En fazla dosya boyutu:" : "Max file size:"}
          <input
            className="w-20 rounded-md border border-white/10 bg-transparent px-2 py-1"
            inputMode="decimal"
            value={sizeMb}
            onChange={(e) => setSizeMb(e.target.value)}
            aria-label="MB"
          />
          MB
          {SIZE_PRESETS_MB.map((m) => (
            <button key={m} type="button" className="rounded-md border border-white/10 px-2 py-0.5 text-[12px] hover:bg-white/5" onClick={() => { setUseSize(true); setSizeMb(String(m)); }}>
              {m}
            </button>
          ))}
        </label>
        <label className="flex flex-wrap items-center gap-2 text-[13px] text-slate-200">
          <input type="checkbox" checked={usePages} onChange={(e) => setUsePages(e.target.checked)} />
          {tr ? "En fazla sayfa sayısı:" : "Max page count:"}
          <input className="w-20 rounded-md border border-white/10 bg-transparent px-2 py-1" inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value)} aria-label={tr ? "sayfa" : "pages"} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-200">
          <input type="checkbox" checked={a4Only} onChange={(e) => setA4Only(e.target.checked)} />
          {tr ? "Tüm sayfalar A4 olmalı" : "All pages must be A4"}
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-200">
          <input type="checkbox" checked={requireText} onChange={(e) => setRequireText(e.target.checked)} />
          {tr ? "Seçilebilir (aranabilir) metin olmalı" : "Selectable (searchable) text required"}
        </label>
        <p className="text-[12px] text-slate-400">
          {tr
            ? "Sınırlar kurumdan kuruma değişir ve güncellenir; ilgili kurumun güncel duyurusuna bakıp buraya girin."
            : "Limits differ between institutions and change over time; check the institution's current notice and enter them here."}
        </p>
      </fieldset>

      {error && (
        <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{error}</p>
      )}

      {checks && facts && (
        <div className="field field--full">
          <span>{allPass(checks) ? (tr ? "Sonuç: uygun" : "Result: compliant") : (tr ? "Sonuç: düzeltme gerekiyor" : "Result: needs fixing")}</span>
          <ChecksList checks={checks} tr={tr} />
          <p className="mt-1 text-left text-[12px] text-slate-400">
            {tr ? `${facts.pages} sayfa · ${formatBytes(facts.bytes)}` : `${facts.pages} pages · ${formatBytes(facts.bytes)}`}
          </p>
        </div>
      )}

      {failedFixable && sizeFailing && (
        <p className="field--full flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5 text-left text-[12px] text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {tr
              ? "Boyutu düşürmek için sayfalar görüntüye çevrilir: yazı seçilemez hâle gelir ve belgedeki e-imza/kaşe korunmaz. Resmî gönderimde orijinal imzalı dosyayı kullanın."
              : "Reducing size rasterizes the pages: text becomes unselectable and e-signatures/stamps are not kept. Use the original signed file for official submissions."}
          </span>
        </p>
      )}

      <div className="field--full flex flex-wrap gap-2">
        <button type="button" className="primary-action" onClick={() => void check()} disabled={!file || busy !== null}>
          {busy === "check" ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Kontrol ediliyor…" : "Checking…"}</span> : tr ? "Kontrol et" : "Check"}
        </button>
        {failedFixable && (
          <button type="button" className="primary-action" onClick={() => void fix()} disabled={busy !== null}>
            {busy === "fix" ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Düzeltiliyor…" : "Fixing…"}</span> : tr ? "Düzelt" : "Fix"}
          </button>
        )}
      </div>

      <p className="field--full text-center text-[12px] text-slate-400">
        {tr ? "Dosyanız tarayıcınızda işlenir — sunucumuza yüklenmez." : "Processing happens in your browser — nothing is uploaded."}
      </p>
    </div>
  );
}

function ChecksList({ checks, tr }: { checks: Check[]; tr: boolean }) {
  return (
    <ul className="mt-2 space-y-1.5 text-left">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-[13px] text-slate-200">
          {c.status === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
          <span>{tr ? c.tr : c.en}</span>
        </li>
      ))}
    </ul>
  );
}
