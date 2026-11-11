import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Açılır-kapanır bölüm (Hesaplar ekranı düzeni için).
 *
 * İçerik ilk açılışa kadar ÇİZİLMEZ (içindeki panelin sunucu istekleri de o zamana kadar yapılmaz);
 * bir kez açılınca bellekte kalır, kapatınca yalnızca gizlenir — yazılan alanlar kaybolmaz.
 */
export function CollapsibleSection({
  title,
  summary,
  badge,
  defaultOpen = false,
  nested = false,
  children,
}: {
  title: string;
  /** Başlığın altında tek satır özet (kapalıyken de görünür). */
  summary?: string;
  /** Başlığın yanında küçük etiket (ör. "3 eksik"). */
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** İç içe (alt) bölüm: daha hafif görünür. */
  nested?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);

  function toggle() {
    setOpen((v) => !v);
    setEverOpened(true);
  }

  return (
    <section
      className={
        nested
          ? "overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/30"
          : "overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40"
      }
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/30"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate font-semibold text-white ${nested ? "text-xs" : "text-sm"}`}>{title}</span>
            {badge ? <span className="shrink-0">{badge}</span> : null}
          </span>
          {summary ? <span className="mt-0.5 block truncate text-[11px] text-slate-400">{summary}</span> : null}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {everOpened ? <div className={`${open ? "" : "hidden"} border-t border-slate-700/40 p-4`}>{children}</div> : null}
    </section>
  );
}
