import { useEffect, useState } from "react";
import type { Language } from "../../i18n/landing";
import { ws } from "../../i18n/workspace";

interface ActivityEntry {
  id: string;
  toolId: string;
  toolLabel: string;
  type: "consume" | "bonus" | "refund";
  amount: number;
  createdAt: string;
}

interface DashboardRecentActivityProps {
  language: Language;
  accessToken?: string | null;
}

function useRecentActivity(accessToken: string | null | undefined) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    const abortCtrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/entitlement/transactions?limit=10", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: abortCtrl.signal,
        });
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setEntries(
          (data.transactions ?? data ?? []).map((t: Record<string, unknown>) => ({
            id: String(t.id ?? t.txId ?? Math.random()),
            toolId: String(t.toolId ?? ""),
            toolLabel: String(t.toolId ?? ""),
            type: (t.type as "consume" | "bonus" | "refund") ?? "consume",
            amount: Number(t.amount ?? 0),
            createdAt: String(t.createdAt ?? ""),
          }))
        );
      } catch {
        // ignore
      } finally {
        if (!abortCtrl.signal.aborted) setLoading(false);
      }
    })();
    return () => abortCtrl.abort();
  }, [accessToken]);

  return { entries, loading };
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 py-3">
      <div className="h-8 w-8 shrink-0 rounded-xl bg-white/[0.06]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
        <div className="h-3 w-20 rounded bg-white/[0.04]" />
      </div>
      <div className="h-4 w-12 rounded bg-white/[0.06]" />
    </div>
  );
}

function TypeDot({ type }: { type: "consume" | "bonus" | "refund" }) {
  if (type === "bonus") {
    return <span className="h-2 w-2 rounded-full bg-emerald-400" />;
  }
  if (type === "refund") {
    return <span className="h-2 w-2 rounded-full bg-amber-400" />;
  }
  return <span className="h-2 w-2 rounded-full bg-nb-primary" />;
}

export function DashboardRecentActivity({
  language,
  accessToken,
}: DashboardRecentActivityProps) {
  const L = ws(language);
  const { entries, loading } = useRecentActivity(accessToken);
  const tr = language === "tr";

  const typeLabel = (type: "consume" | "bonus" | "refund") => {
    if (type === "consume") return L.creditTxTypeConsume;
    if (type === "bonus") return L.creditTxTypeBonus;
    return L.creditTxTypeRefund;
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(tr ? "tr-TR" : "en-US", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-lg sm:rounded-xl md:rounded-2xl border border-white/[0.08] bg-nb-panel/60 p-2.5 sm:p-3 md:p-4 lg:p-5 2xl:p-6">
      <h2 className="mb-2 sm:mb-2.5 md:mb-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-semibold text-nb-heading">
        {L.creditDashboardRecentHeading}
      </h2>

      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white/[0.06] h-8" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <svg
            className="h-10 w-10 text-nb-muted/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.25}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-sm text-nb-muted">{L.emptyStateTitle}</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="divide-y divide-white/[0.06] md:hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 sm:gap-3 py-2 sm:py-3">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-nb-bg-elevated">
                  <TypeDot type={entry.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] sm:text-xs font-medium text-nb-text">
                    {L.creditTxToolLabel(entry.toolLabel)}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-nb-muted">{formatDate(entry.createdAt)}</p>
                </div>
                <span
                  className={`shrink-0 text-[11px] sm:text-xs font-semibold tabular-nums ${
                    entry.type === "consume"
                      ? "text-rose-300"
                      : entry.type === "bonus"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {entry.type === "consume" ? "−" : "+"}
                  {Math.abs(entry.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Desktop: Full table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs lg:text-sm">
              <thead>
                <tr className="text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider text-nb-muted">
                  <th className="pb-2 pr-2 sm:pr-4">{tr ? "Araç" : "Tool"}</th>
                  <th className="pb-2 pr-2 sm:pr-4">{tr ? "Tür" : "Type"}</th>
                  <th className="hidden pb-2 pr-2 sm:pr-4 lg:table-cell">
                    {tr ? "Tarih" : "Date"}
                  </th>
                  <th className="pb-2 text-right pr-0 sm:pr-2">{tr ? "Miktar" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="text-nb-text">
                    <td className="py-2 sm:py-2.5 pr-2 sm:pr-4 text-[10px] sm:text-xs font-medium">
                      <span className="flex items-center gap-1.5 sm:gap-2">
                        <TypeDot type={entry.type} />
                        <span className="truncate max-w-[100px] sm:max-w-[120px] lg:max-w-none">
                          {L.creditTxToolLabel(entry.toolLabel)}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 sm:py-2.5 pr-2 sm:pr-4 text-[10px] sm:text-xs text-nb-muted">
                      {typeLabel(entry.type)}
                    </td>
                    <td className="hidden py-2 sm:py-2.5 pr-2 sm:pr-4 text-[10px] sm:text-xs text-nb-muted lg:table-cell">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td
                      className={`py-2 sm:py-2.5 text-right text-[10px] sm:text-xs font-semibold tabular-nums pr-0 sm:pr-2 ${
                        entry.type === "consume"
                          ? "text-rose-300"
                          : entry.type === "bonus"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {entry.type === "consume" ? "−" : "+"}
                      {Math.abs(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
