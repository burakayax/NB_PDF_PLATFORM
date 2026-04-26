import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  icon?: ReactNode;
};

/**
 * Veri yok — Mosaic tarzı boş durum.
 */
export function EmptyState({ title, description, ctaLabel, onCta, icon }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 px-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800/60 ring-1 ring-white/[0.06]">
        {icon ?? <Inbox className="h-9 w-9 text-slate-500" strokeWidth={1.25} />}
      </div>
      <p className="mt-4 text-base font-semibold text-slate-200">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {ctaLabel && onCta ? (
        <button
          type="button"
          onClick={onCta}
          className="mt-6 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
