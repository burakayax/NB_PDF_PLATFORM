import { useState } from "react";
import type { Language } from "../../i18n/landing";
import { UdfToPdfTool } from "./UdfToPdfTool";
import { UdfConvertTool, type UdfMode } from "./UdfConvertTool";

export type UdfHubMode = "udf-to-pdf" | UdfMode;

const TABS: { id: UdfHubMode; tr: string; en: string }[] = [
  { id: "udf-to-pdf", tr: "UDF → PDF", en: "UDF → PDF" },
  { id: "pdf-to-udf", tr: "PDF → UDF", en: "PDF → UDF" },
  { id: "word-to-udf", tr: "Word → UDF", en: "Word → UDF" },
  { id: "udf-to-word", tr: "UDF → Word", en: "UDF → Word" },
  { id: "udf-viewer", tr: "UDF Görüntüleyici", en: "UDF Viewer" },
  { id: "image-to-udf", tr: "Görsel / TIFF → UDF", en: "Image / TIFF → UDF" },
];

/** Tek bir araç sayfası için doğru bileşeni verir (SEO sayfaları + panel ortak kullanır). */
export function UdfModeTool({ language, mode }: { language: Language; mode: UdfHubMode }) {
  return mode === "udf-to-pdf" ? (
    <UdfToPdfTool language={language} />
  ) : (
    <UdfConvertTool key={mode} language={language} mode={mode} />
  );
}

/** Panel içi: tüm UDF / UYAP araçları tek yerde, üstte sekmelerle. */
export function UdfHub({ language, initial = "udf-to-pdf" }: { language: Language; initial?: UdfHubMode }) {
  const tr = language === "tr";
  const [mode, setMode] = useState<UdfHubMode>(initial);
  return (
    <div>
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
              mode === t.id
                ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            {tr ? t.tr : t.en}
          </button>
        ))}
      </div>
      <UdfModeTool language={language} mode={mode} />
    </div>
  );
}
