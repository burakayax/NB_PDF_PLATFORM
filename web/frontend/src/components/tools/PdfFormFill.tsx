/**
 * PDF FORM DOLDURMA — doldurulabilir PDF formlarını cihazda doldurur.
 *
 * Dosya SUNUCUYA GİTMEZ: form alanları tarayıcıda okunur, doldurulur ve indirilir.
 * Kimlik, başvuru, sözleşme gibi belgelerde bu ayrım önemlidir.
 *
 * "Kilitle" seçeneği alanları kalıcı içeriğe çevirir (düzleştirme): karşı taraf
 * belgeyi açtığında yazdıklarını değiştiremez ve belge her okuyucuda aynı görünür.
 */
import { useCallback, useState } from "react";
import { FileText, Loader2, Lock, ShieldCheck, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  formAlanlariniOku,
  formuDoldur,
  XfaFormuHatasi,
  type FormAlani,
  type FormDegerleri,
} from "../../lib/pdfForms";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";

const METIN = {
  tr: {
    hint: "Doldurulabilir PDF formunu seç — alanlar otomatik bulunur.",
    chipDevice: "Cihazda işlenir",
    chipFree: "Kayıt gerekmez",
    chipNoInstall: "Kurulum yok",
    reading: "Form alanları okunuyor…",
    noFields:
      "Bu PDF'te doldurulabilir alan yok. Belge düz bir PDF ise üzerine yazmak için PDF Düzenle ya da PDF İşaretle araçlarını kullanabilirsin.",
    xfa: "Bu dosya eski tip (XFA) bir Adobe formu. Bu formlar tarayıcıda doldurulamıyor; dosyayı Adobe Acrobat ile açman gerekir.",
    failed: "Form okunamadı. Dosya bozuk ya da şifreli olabilir.",
    fillFailed: "Form doldurulamadı.",
    fields: "alan bulundu",
    readOnly: "salt okunur",
    flatten: "Doldurduktan sonra kilitle",
    flattenNote: "Alanlar kalıcı içeriğe dönüşür; karşı taraf değiştiremez.",
    apply: "Formu doldur",
    working: "Dolduruluyor…",
    select: "Seç…",
    another: "Başka dosya seç",
  },
  en: {
    hint: "Choose a fillable PDF form — fields are detected automatically.",
    chipDevice: "Processed on device",
    chipFree: "No sign-up",
    chipNoInstall: "No install",
    reading: "Reading form fields…",
    noFields:
      "This PDF has no fillable fields. If it is a flat PDF, use Edit PDF or Annotate PDF to write on it.",
    xfa: "This is a legacy Adobe (XFA) form. Such forms cannot be filled in the browser; open the file in Adobe Acrobat instead.",
    failed: "Could not read the form. The file may be corrupt or encrypted.",
    fillFailed: "Could not fill the form.",
    fields: "fields found",
    readOnly: "read-only",
    flatten: "Lock after filling",
    flattenNote: "Fields become permanent content; the recipient cannot change them.",
    apply: "Fill form",
    working: "Filling…",
    select: "Select…",
    another: "Choose another file",
  },
} as const;

type Sonuc = { blob: Blob; filename: string };

export function PdfFormFill({
  language,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
}) {
  const t = METIN[language === "tr" ? "tr" : "en"];
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("form.pdf");
  const [alanlar, setAlanlar] = useState<FormAlani[] | null>(null);
  const [degerler, setDegerler] = useState<FormDegerleri>({});
  const [kilitle, setKilitle] = useState(true);
  const [okuyor, setOkuyor] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const dosyaYukle = useCallback(
    async (f: File | undefined) => {
      if (!f) return;
      setOkuyor(true);
      setHata(null);
      setAlanlar(null);
      try {
        const b = new Uint8Array(await f.arrayBuffer());
        const bulunan = await formAlanlariniOku(b);
        setBytes(b);
        setFileName(f.name);
        setAlanlar(bulunan);
        const baslangic: FormDegerleri = {};
        for (const a of bulunan) {
          if (a.saltOkunur) continue;
          if (a.tip === "onay") baslangic[a.ad] = Boolean(a.deger);
          else if (Array.isArray(a.deger)) baslangic[a.ad] = a.deger;
          else baslangic[a.ad] = typeof a.deger === "string" ? a.deger : "";
        }
        setDegerler(baslangic);
      } catch (e) {
        setHata(e instanceof XfaFormuHatasi ? t.xfa : t.failed);
      } finally {
        setOkuyor(false);
      }
    },
    [t],
  );

  const doldur = async () => {
    if (!bytes) return;
    setCalisiyor(true);
    setHata(null);
    try {
      // Türkçe harflerin kaybolmaması için Unicode font gömülür (WinAnsi tuzağı).
      const font = await fetch("/fonts/Roboto-Regular.ttf").then((r) => r.arrayBuffer());
      const cikti = await formuDoldur(bytes, degerler, { duzlestir: kilitle, fontBytes: font });
      setSonuc({
        blob: new Blob([cikti as unknown as BlobPart], { type: "application/pdf" }),
        filename:
          fileName.replace(/\.pdf$/i, "") + (language === "tr" ? "-dolduruldu.pdf" : "-filled.pdf"),
      });
    } catch (e) {
      setHata(e instanceof XfaFormuHatasi ? t.xfa : t.fillFailed);
    } finally {
      setCalisiyor(false);
    }
  };

  const yaz = (ad: string, v: string | boolean | string[]) =>
    setDegerler((d) => ({ ...d, [ad]: v }));

  if (sonuc) {
    return (
      <ToolResultPanel
        blob={sonuc.blob}
        filename={sonuc.filename}
        language={language}
        processedOnDevice
        onClose={() => setSonuc(null)}
      >
        <ValueMomentNudge language={language} source="form_fill_success" />
      </ToolResultPanel>
    );
  }

  if (!bytes || !alanlar) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="tool-form">
          <WorkspaceUploadField
            language={language}
            accept="application/pdf,.pdf"
            note={t.hint}
            onFiles={(files) => void dosyaYukle(files[0])}
          />
        </div>
        {okuyor && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.reading}
          </p>
        )}
        {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: t.chipDevice },
            { icon: <Zap className="h-4 w-4" />, t: t.chipFree },
            { icon: <Lock className="h-4 w-4" />, t: t.chipNoInstall },
          ].map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[12px] font-medium text-slate-300"
            >
              <span className="text-cyan-300">{c.icon}</span>
              {c.t}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const doldurulabilir = alanlar.filter((a) => a.tip !== "buton");

  if (doldurulabilir.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3 text-[13px] leading-relaxed text-amber-200">
          {t.noFields}
        </p>
        <button
          type="button"
          onClick={() => {
            setBytes(null);
            setAlanlar(null);
          }}
          className="mt-3 rounded-xl border border-white/[0.1] px-4 py-2 text-[13px] font-semibold text-slate-200"
        >
          {t.another}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-[13px] text-slate-400">
        <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="truncate">{fileName}</span>
        <span className="shrink-0 text-slate-500">
          · {doldurulabilir.length} {t.fields}
        </span>
      </div>

      <div className="space-y-3">
        {doldurulabilir.map((a) => {
          const kimlik = `form-alan-${a.ad}`;
          const etiket = (
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              {a.ad}
              {a.saltOkunur && <span className="ml-1.5 text-slate-500">({t.readOnly})</span>}
            </span>
          );
          if (a.tip === "onay") {
            return (
              <label key={a.ad} htmlFor={kimlik} className="flex items-center gap-2.5">
                <input
                  id={kimlik}
                  type="checkbox"
                  disabled={a.saltOkunur}
                  checked={Boolean(degerler[a.ad])}
                  onChange={(e) => yaz(a.ad, e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                <span className="text-sm text-slate-200">{a.ad}</span>
              </label>
            );
          }
          if ((a.tip === "liste" || a.tip === "secim") && a.secenekler?.length) {
            return (
              <label key={a.ad} htmlFor={kimlik} className="block">
                {etiket}
                <select
                  id={kimlik}
                  disabled={a.saltOkunur}
                  value={typeof degerler[a.ad] === "string" ? (degerler[a.ad] as string) : ""}
                  onChange={(e) => yaz(a.ad, e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
                >
                  <option value="">{t.select}</option>
                  {a.secenekler.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label key={a.ad} htmlFor={kimlik} className="block">
              {etiket}
              {a.cokSatirli ? (
                <textarea
                  id={kimlik}
                  rows={3}
                  disabled={a.saltOkunur}
                  maxLength={a.enFazlaKarakter}
                  value={typeof degerler[a.ad] === "string" ? (degerler[a.ad] as string) : ""}
                  onChange={(e) => yaz(a.ad, e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
                />
              ) : (
                <input
                  id={kimlik}
                  type="text"
                  disabled={a.saltOkunur}
                  maxLength={a.enFazlaKarakter}
                  value={typeof degerler[a.ad] === "string" ? (degerler[a.ad] as string) : ""}
                  onChange={(e) => yaz(a.ad, e.target.value)}
                  className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
                />
              )}
            </label>
          );
        })}
      </div>

      <label className="mt-5 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={kilitle}
          onChange={(e) => setKilitle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent"
        />
        <span className="text-sm text-slate-200">
          {t.flatten}
          <span className="block text-[12px] text-slate-500">{t.flattenNote}</span>
        </span>
      </label>

      {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}

      <button
        type="button"
        onClick={() => void doldur()}
        disabled={calisiyor}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
      >
        {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {calisiyor ? t.working : t.apply}
      </button>
    </div>
  );
}
