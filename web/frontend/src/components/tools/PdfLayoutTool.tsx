/**
 * SAYFA DÜZENİ — birden çok sayfayı tek yaprağa sığdırır ya da kitapçık dizer.
 *
 * İki kip:
 *  - "Yaprağa sığdır": 2/4/6/8/9/16 sayfa tek kâğıda. Kâğıt ve mürekkep tasarrufu.
 *  - "Kitapçık": çift taraflı yazdırıp ortadan katlayınca sırayla okunan kitapçık.
 *
 * Kitapçıkta sıralamayı kullanıcı düşünmez; yazdırma yönergesi ekranda yazılıdır
 * çünkü yanlış yazdırma ancak kâğıt katlandıktan sonra fark edilir.
 */
import { useCallback, useState } from "react";
import { BookOpen, FileText, Grid2x2, Loader2, Lock, ShieldCheck, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { nUpYap, kitapcikYap } from "../../lib/pdfImposition";
import { ValueMomentNudge } from "./ValueMomentNudge";
import { ToolResultPanel } from "../common/ToolResultPanel";
import { WorkspaceUploadField } from "../common/WorkspaceUploadField";

const METIN = {
  tr: {
    hint: "PDF'i seç — sayfaları tek kâğıda sığdır ya da kitapçık olarak diz.",
    chipDevice: "Cihazda işlenir",
    chipFree: "Kayıt gerekmez",
    chipNoInstall: "Kurulum yok",
    failed: "Belge okunamadı. Dosya bozuk ya da şifreli olabilir.",
    applyFailed: "Sayfa düzeni uygulanamadı.",
    modeNup: "Yaprağa sığdır",
    modeBooklet: "Kitapçık",
    nupNote: "Birden çok sayfayı tek kâğıda yerleştirir; kâğıt ve mürekkepten tasarruf edersin.",
    bookletNote:
      "Sayfaları öyle dizer ki çift taraflı yazdırıp ortadan katladığında sırayla okunan bir kitapçık olur.",
    perSheet: "Bir yaprağa kaç sayfa",
    frame: "Her sayfanın çevresine ince çerçeve çiz",
    printHint: "Yazdırırken: çift taraflı, «kısa kenardan çevir» seçeneğiyle bas; sonra ortadan katla.",
    pageCount: "sayfa",
    apply: "Uygula",
    working: "Uygulanıyor…",
    another: "Başka dosya seç",
  },
  en: {
    hint: "Pick a PDF — fit several pages on one sheet or impose it as a booklet.",
    chipDevice: "Processed on device",
    chipFree: "No sign-up",
    chipNoInstall: "No install",
    failed: "Could not read the document. The file may be corrupt or encrypted.",
    applyFailed: "Could not apply the layout.",
    modeNup: "Fit on sheet",
    modeBooklet: "Booklet",
    nupNote: "Places several pages on a single sheet, saving paper and ink.",
    bookletNote:
      "Orders the pages so that printing double-sided and folding in the middle gives a booklet that reads in order.",
    perSheet: "Pages per sheet",
    frame: "Draw a thin frame around each page",
    printHint: "When printing: use double-sided, «flip on short edge», then fold in the middle.",
    pageCount: "pages",
    apply: "Apply",
    working: "Applying…",
    another: "Choose another file",
  },
} as const;

type Kip = "nup" | "kitapcik";
type Sonuc = { blob: Blob; filename: string };

export function PdfLayoutTool({
  language,
}: {
  language: Language;
  accessToken?: string | null;
  initialFile?: File | null;
}) {
  const t = METIN[language === "tr" ? "tr" : "en"];
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("belge.pdf");
  const [kip, setKip] = useState<Kip>("nup");
  const [adet, setAdet] = useState(4);
  const [cerceve, setCerceve] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const dosyaYukle = useCallback(async (f: File | undefined) => {
    if (!f) return;
    setHata(null);
    try {
      setBytes(new Uint8Array(await f.arrayBuffer()));
      setFileName(f.name);
    } catch {
      setHata(METIN.tr.failed);
    }
  }, []);

  const uygula = async () => {
    if (!bytes) return;
    setCalisiyor(true);
    setHata(null);
    try {
      const cikti = kip === "kitapcik" ? await kitapcikYap(bytes) : await nUpYap(bytes, { adet, cerceve });
      const ek = kip === "kitapcik" ? "kitapcik" : `${adet}li`;
      setSonuc({
        blob: new Blob([cikti as unknown as BlobPart], { type: "application/pdf" }),
        filename: fileName.replace(/\.pdf$/i, "") + `-${ek}.pdf`,
      });
    } catch (e) {
      setHata(e instanceof Error && e.message ? e.message : t.applyFailed);
    } finally {
      setCalisiyor(false);
    }
  };

  if (sonuc) {
    return (
      <ToolResultPanel
        blob={sonuc.blob}
        filename={sonuc.filename}
        language={language}
        processedOnDevice
        subtitle={kip === "kitapcik" ? t.printHint : undefined}
        onClose={() => setSonuc(null)}
      >
        <ValueMomentNudge language={language} source="layout_success" />
      </ToolResultPanel>
    );
  }

  if (!bytes) {
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2 text-[13px] text-slate-400">
        <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
        <span className="truncate">{fileName}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {([
          { id: "nup" as Kip, ad: t.modeNup, not: t.nupNote, Icon: Grid2x2 },
          { id: "kitapcik" as Kip, ad: t.modeBooklet, not: t.bookletNote, Icon: BookOpen },
        ]).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setKip(m.id)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              kip === m.id
                ? "border-cyan-400/40 bg-cyan-500/10"
                : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <m.Icon className="h-4 w-4 text-cyan-300" />
              {m.ad}
            </span>
            <span className="mt-1 block text-[12px] leading-relaxed text-slate-400">{m.not}</span>
          </button>
        ))}
      </div>

      {kip === "nup" && (
        <>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">{t.perSheet}</span>
            <select
              value={adet}
              onChange={(e) => setAdet(Number(e.target.value))}
              className="w-full rounded-xl border border-white/[0.1] bg-nb-panel/70 px-3 py-2.5 text-sm text-nb-text"
            >
              {[2, 4, 6, 8, 9, 16].map((n) => (
                <option key={n} value={n}>
                  {n} {t.pageCount}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={cerceve}
              onChange={(e) => setCerceve(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-transparent"
            />
            <span className="text-sm text-slate-200">{t.frame}</span>
          </label>
        </>
      )}

      {kip === "kitapcik" && (
        <p className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.08] px-4 py-3 text-[12px] leading-relaxed text-cyan-100">
          {t.printHint}
        </p>
      )}

      {hata && <p className="mt-3 text-[13px] text-rose-300">{hata}</p>}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={() => setBytes(null)}
          className="shrink-0 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-[13px] font-semibold text-slate-200"
        >
          {t.another}
        </button>
        <button
          type="button"
          onClick={() => void uygula()}
          disabled={calisiyor}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
        >
          {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Grid2x2 className="h-4 w-4" />}
          {calisiyor ? t.working : t.apply}
        </button>
      </div>
    </div>
  );
}
