import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { COMMON_FIELDS, PETITION_TEMPLATES } from "../../content/petitionTemplates";
import { buildPetition, missingRequired, todayTr, type Values } from "../../lib/petitionBuild";
import { writeUdf } from "../../lib/udfWrite";
import { udfToPdf } from "../../lib/udfPdf";
import { UDF_DISCLAIMER_EN, UDF_DISCLAIMER_TR } from "./UdfConvertTool";

/** Dilekçe / form şablonları — cihazda doldurulur, PDF veya UDF olarak indirilir. */
export function PetitionTemplateTool({ language }: { language: Language }) {
  const tr = language === "tr";
  const [tid, setTid] = useState(PETITION_TEMPLATES[0]!.id);
  const [values, setValues] = useState<Values>({ tarih: todayTr() });
  const [format, setFormat] = useState<"pdf" | "udf">("pdf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);

  const t = PETITION_TEMPLATES.find((x) => x.id === tid)!;
  const fields = [...t.fields, ...COMMON_FIELDS];
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const create = async () => {
    const miss = missingRequired(t, values);
    if (miss.length) {
      const names = fields.filter((f) => miss.includes(f.key)).map((f) => (tr ? f.tr : f.en));
      setError((tr ? "Lütfen doldurun: " : "Please fill in: ") + names.join(", "));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const doc = buildPetition(t, values);
      const base = t.id;
      if (format === "udf") {
        setResult({ blob: new Blob([writeUdf(doc) as BlobPart], { type: "application/octet-stream" }), name: `${base}.udf` });
      } else {
        const [regular, bold] = await Promise.all([
          fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer()),
          fetch("/fonts/Roboto-Bold.ttf").then((r) => r.arrayBuffer()),
        ]);
        const bytes = await udfToPdf(doc, { regular, bold });
        setResult({ blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), name: `${base}.pdf` });
      }
    } catch {
      setError(tr ? "Belge oluşturulamadı. Lütfen tekrar deneyin." : "Could not create the document. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const note = (
    <p className="field--full flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3.5 py-2.5 text-left text-[12px] leading-relaxed text-amber-100/90">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {tr
          ? "Şablonlar genel bilgilendirme amaçlıdır, hukuki danışmanlık değildir; kendi durumunuza uyarlayın, gerekirse bir avukata danışın. "
          : "Templates are for general information only and are not legal advice; adapt them to your case and consult a lawyer if needed. "}
        {format === "udf" ? (tr ? UDF_DISCLAIMER_TR : UDF_DISCLAIMER_EN) : ""}
      </span>
    </p>
  );

  if (result) {
    return (
      <ToolResultPanel ratingToolSlug="dilekce-sablonlari" blob={result.blob} filename={result.name} language={language} processedOnDevice onClose={() => setResult(null)}>
        <p className="mt-5 text-[13px] font-semibold text-emerald-200">{tr ? "Dilekçeniz hazır. İmzalamadan önce metni gözden geçirin." : "Your letter is ready. Review the text before signing."}</p>
        <div className="mt-3">{note}</div>
        <ValueMomentNudge language={language} source="petition_success" />
      </ToolResultPanel>
    );
  }

  return (
    <div className="tool-form">
      <label className="field field--full">
        <span>{tr ? "Şablon" : "Template"}</span>
        <select value={tid} onChange={(e) => { setTid(e.target.value); setError(null); }}>
          {PETITION_TEMPLATES.map((x) => (
            <option key={x.id} value={x.id}>{tr ? x.tr.name : x.en.name}</option>
          ))}
        </select>
        <small className="text-slate-400">{tr ? t.tr.desc : t.en.desc}</small>
      </label>

      {fields.map((f) => (
        <label key={`${tid}-${f.key}`} className="field field--full">
          <span>{(tr ? f.tr : f.en) + (f.optional ? (tr ? " (isteğe bağlı)" : " (optional)") : "")}</span>
          {f.multiline ? (
            <textarea rows={3} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          ) : (
            <input value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </label>
      ))}

      <div className="field field--full" role="radiogroup" aria-label={tr ? "Biçim" : "Format"}>
        <span>{tr ? "Çıktı biçimi" : "Output format"}</span>
        <div className="flex gap-4 text-[13px] text-slate-200">
          <label className="flex items-center gap-1.5"><input type="radio" checked={format === "pdf"} onChange={() => setFormat("pdf")} />PDF</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={format === "udf"} onChange={() => setFormat("udf")} />UDF ({tr ? "UYAP" : "UYAP"})</label>
        </div>
      </div>

      {note}

      {error && (
        <p className="field--full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] text-red-300" role="alert">{error}</p>
      )}

      <button type="button" className="primary-action" onClick={() => void create()} disabled={busy}>
        {busy ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{tr ? "Hazırlanıyor…" : "Preparing…"}</span> : tr ? "Dilekçeyi oluştur" : "Create letter"}
      </button>
      <p className="field--full text-center text-[12px] text-slate-400">
        {tr ? "Bilgileriniz tarayıcınızda kalır — sunucumuza gönderilmez." : "Your details stay in your browser — nothing is sent to our servers."}
      </p>
    </div>
  );
}
