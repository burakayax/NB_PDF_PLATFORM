import { useEffect, useState, type ReactNode } from "react";

/**
 * Ziyaretçiler ve satışlar ekranının ortak yapı taşları: bölüm kutusu, süzgeçler ve tablo.
 * Hepsi sade ve tutarlı: her bölüm bir başlık, tek cümlelik açıklama, kendi süzgeçleri ve bir tablo içerir.
 */

export const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";
const FIELD =
  "rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] text-slate-100 outline-none transition focus:border-cyan-400/40 [color-scheme:dark]";

export function Section({
  id,
  title,
  help,
  filters,
  children,
}: {
  id?: string;
  title: string;
  help: string;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${CARD} scroll-mt-24`}>
      <div className="border-b border-white/[0.06] px-5 py-4">
        <h3 className="text-[15px] font-black tracking-tight text-white">{title}</h3>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-slate-400">{help}</p>
        {filters ? <div className="mt-3 flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      <div className="p-0">{children}</div>
    </section>
  );
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchFilter({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${FIELD} w-52 placeholder:text-slate-500`}
    />
  );
}

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Sayı sütunları sağa yaslanır. */
  numeric?: boolean;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  pageSize = 15,
  onRowClick,
  expanded,
  renderExpanded,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  empty: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  expanded?: string | null;
  renderExpanded?: (row: T) => ReactNode;
}) {
  const [shown, setShown] = useState(pageSize);
  // Süzgeç değişince liste yeniden başa döner.
  useEffect(() => {
    setShown(pageSize);
  }, [rows.length, pageSize]);

  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-[13px] text-slate-400">{empty}</p>;
  }
  const visible = rows.slice(0, shown);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wide text-slate-500">
              {columns.map((c) => (
                <th key={c.header} className={`px-4 py-2.5 font-semibold ${c.numeric ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {visible.map((row) => {
              const key = rowKey(row);
              const isOpen = expanded === key;
              return (
                <RowGroup key={key} open={isOpen} colSpan={columns.length} extra={isOpen && renderExpanded ? renderExpanded(row) : null}>
                  <tr
                    className={`align-top text-slate-200 ${onRowClick ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${isOpen ? "bg-white/[0.03]" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.header} className={`px-4 py-2.5 ${c.numeric ? "text-right tabular-nums" : ""} ${c.className ?? ""}`}>
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-2.5 text-[12px] text-slate-400">
        <span>
          {rows.length} kayıttan {Math.min(shown, rows.length)} tanesi gösteriliyor
        </span>
        {shown < rows.length ? (
          <button
            type="button"
            onClick={() => setShown((n) => n + pageSize)}
            className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-slate-200 transition hover:bg-white/[0.05]"
          >
            Daha fazla göster
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RowGroup({ children, open, colSpan, extra }: { children: ReactNode; open: boolean; colSpan: number; extra: ReactNode }) {
  return (
    <>
      {children}
      {open && extra ? (
        <tr>
          <td colSpan={colSpan} className="bg-black/20 px-4 py-3">
            {extra}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  const cls = {
    neutral: "border-white/[0.1] text-slate-300",
    good: "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200",
    warn: "border-amber-400/30 bg-amber-500/[0.08] text-amber-200",
    bad: "border-rose-400/30 bg-rose-500/[0.08] text-rose-200",
    info: "border-sky-400/30 bg-sky-500/[0.08] text-sky-200",
  }[tone];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${cls}`}>{children}</span>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/[0.1] bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-[10px] px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
            value === o.value ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const valueCls = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-white";
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-[12px] font-semibold text-slate-400">{label}</p>
      <p className={`mt-1 text-[28px] font-black leading-none tabular-nums ${valueCls}`}>{value}</p>
      <p className="mt-2 text-[11.5px] leading-snug text-slate-500">{hint}</p>
    </div>
  );
}
