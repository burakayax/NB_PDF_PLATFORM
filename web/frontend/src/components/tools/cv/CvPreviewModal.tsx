import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import type { CvModel } from "./cvModel";
import { paginate } from "./cvPdf";
import { CvPage, PAGE_H, PAGE_W, type CvStyleOpts, type CvTemplate } from "./cvTemplates";

/** Ekran görüntüsüyle kopyalanmasın diye önizlemenin üstüne binen tekrarlı filigran (yalnız önizleme; indirilen PDF'te YOK). */
function watermarkBg(text: string): string {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='520' height='270'>" +
    `<text x='40' y='150' transform='rotate(-24 260 135)' font-family='Arial' font-weight='800' font-size='26' fill='#334155' fill-opacity='0.26' stroke='#ffffff' stroke-opacity='0.35' stroke-width='0.8' paint-order='stroke'>${text}</text>` +
    "</svg>";
  return `url("data:image/svg+xml;utf8,${svg.replace(/#/g, "%23")}")`;
}

type Props = {
  model: CvModel;
  tpl: CvTemplate;
  size: "s" | "m" | "l";
  accent: string | null;
  style?: CvStyleOpts;
  tr: boolean;
  locked: boolean;
  empty: boolean;
  busy: boolean;
  onDownload: () => void;
  onClose: () => void;
};

/** Tam ekran CV önizlemesi (siteden çıkmadan açılan pencere). Filigranlıdır; indirilen PDF filigransızdır. */
export function CvPreviewModal({ model, tpl, size, accent, style, tr, locked, empty, busy, onDownload, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pages, setPages] = useState(1);

  // Esc ile kapat + arka sayfa kaydırılmasın
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // Okunaklı boyut: pencere genişliğine sığdır (en çok 1.25×)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1.25, Math.max(0.35, (el.clientWidth - 32) / PAGE_W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const repaginate = useCallback(() => {
    const root = pageRef.current?.firstElementChild as HTMLElement | null;
    if (root) setPages(paginate(root));
  }, []);
  useLayoutEffect(() => { repaginate(); }, [model, tpl, style, scale, repaginate]);
  useEffect(() => {
    void document.fonts.ready.then(repaginate);
    const t = window.setTimeout(repaginate, 400);
    return () => window.clearTimeout(t);
  }, [model, tpl, repaginate]);

  const wm = watermarkBg(tr ? "PDF PLATFORM · ÖNİZLEME" : "PDF PLATFORM · PREVIEW");

  return (
    <div role="dialog" aria-modal="true" aria-label={tr ? "CV önizleme" : "CV preview"} className="fixed inset-0 z-[90] flex flex-col bg-slate-950/95 backdrop-blur-sm print:hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">{tr ? "CV önizleme" : "CV preview"} <span className="font-normal text-slate-400">· {pages} {tr ? "sayfa" : pages > 1 ? "pages" : "page"}</span></p>
          <p className="truncate text-[12px] text-slate-400">{tr ? "Önizleme filigranlıdır; indirdiğiniz PDF'te filigran olmaz." : "The preview is watermarked; the PDF you download has no watermark."}</p>
        </div>
        <button type="button" disabled={locked || busy} onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span className="hidden sm:inline">{tr ? "PDF olarak indir" : "Download PDF"}</span>
        </button>
        <button type="button" onClick={onClose} aria-label={tr ? "Önizlemeyi kapat" : "Close preview"} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-white/20">
          <X className="h-4 w-4" /><span className="hidden sm:inline">{tr ? "Kapat" : "Close"}</span>
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-4 py-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div
          className="relative mx-auto select-none overflow-hidden rounded-lg bg-white shadow-[0_24px_70px_-24px_rgba(0,0,0,0.9)]"
          style={{ width: PAGE_W * scale, height: pages * PAGE_H * scale, WebkitUserSelect: "none", userSelect: "none" }}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          <div ref={pageRef} style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <CvPage m={model} tpl={tpl} size={size} accent={accent} style={style} />
          </div>
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-sky-500/60" style={{ top: (i + 1) * PAGE_H * scale }} />
          ))}
          {empty ? <p className="pointer-events-none absolute inset-x-0 top-24 px-8 text-center text-[15px] font-semibold text-slate-500">{tr ? "CV'niz henüz boş. Bilgilerinizi girin; önizleme burada görünür." : "Your CV is still empty. Enter your details and the preview appears here."}</p> : null}
          <div className="pointer-events-auto absolute inset-0" style={{ backgroundImage: wm, backgroundRepeat: "repeat" }} aria-hidden />
        </div>
      </div>
    </div>
  );
}
