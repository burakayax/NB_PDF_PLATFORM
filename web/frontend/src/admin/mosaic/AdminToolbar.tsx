import { Search } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

type Props = {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSubmit?: (e: FormEvent) => void;
  isSearching?: boolean;
  filters?: ReactNode;
  actions?: ReactNode;
};

/**
 * Yönetim sayfaları — üst arama + filtre + aksiyon alanı.
 */
export function AdminToolbar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onSubmit,
  isSearching,
  filters,
  actions,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form
        className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
      >
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-600/50 bg-slate-900/60 py-2.5 pl-10 pr-3 text-sm text-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] placeholder:text-slate-600 outline-none transition focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/15"
            autoComplete="off"
          />
        </div>
        {isSearching ? (
          <span className="shrink-0 self-center text-xs font-medium text-cyan-400/80">…</span>
        ) : null}
        {filters ? <div className="flex flex-wrap items-center gap-2 sm:ml-1">{filters}</div> : null}
      </form>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
