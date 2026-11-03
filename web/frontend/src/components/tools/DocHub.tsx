import { useState } from "react";
import type { Language } from "../../i18n/landing";
import { DocConvertTool, type DocMode } from "./DocConvertTool";
import { isDocToolSlug } from "../../lib/docToolSlugs";

/** Adres /tools/<araç> ise o sekmeyi açar. */
function modeFromPath(): DocMode | null {
  if (typeof window === "undefined") return null;
  const slug = window.location.pathname.replace(/^\/en/, "").replace("/tools/", "").replace(/\/$/, "");
  return isDocToolSlug(slug) ? slug : null;
}

const TABS: { id: DocMode; tr: string; en: string }[] = [
  { id: "txt-to-pdf", tr: "TXT → PDF", en: "TXT → PDF" },
  { id: "markdown-to-pdf", tr: "Markdown → PDF", en: "Markdown → PDF" },
  { id: "rtf-to-pdf", tr: "RTF → PDF", en: "RTF → PDF" },
  { id: "odt-to-pdf", tr: "ODT → PDF", en: "ODT → PDF" },
  { id: "epub-to-pdf", tr: "EPUB → PDF", en: "EPUB → PDF" },
  { id: "pdf-to-epub", tr: "PDF → EPUB", en: "PDF → EPUB" },
  { id: "pdf-to-markdown", tr: "PDF → Markdown", en: "PDF → Markdown" },
];

/** Tek bir araç sayfası için bileşen (SEO sayfaları + panel ortak kullanır). */
export function DocModeTool({ language, mode }: { language: Language; mode: DocMode }) {
  return <DocConvertTool key={mode} language={language} mode={mode} />;
}

/** Panel içi: tüm ek dönüştürmeler tek yerde, üstte sekmelerle. */
export function DocHub({ language, initial }: { language: Language; initial?: DocMode }) {
  const tr = language === "tr";
  const [mode, setMode] = useState<DocMode>(initial ?? modeFromPath() ?? "txt-to-pdf");
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
              mode === t.id ? "border-sky-400/50 bg-sky-400/10 text-sky-200" : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            {tr ? t.tr : t.en}
          </button>
        ))}
      </div>
      <DocModeTool language={language} mode={mode} />
    </div>
  );
}
