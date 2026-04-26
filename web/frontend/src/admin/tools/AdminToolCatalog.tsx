import { useState } from "react";
import { CCToolRow } from "../command/centerParts";
import type { ToolRegistryRow } from "../../api/admin";
import { AdminToolbar } from "../mosaic/AdminToolbar";
import { EmptyState } from "../mosaic/EmptyState";
import { Wrench } from "lucide-react";

type Props = {
  tools: ToolRegistryRow[] | null;
  accessToken: string;
  onUpdated: (row: ToolRegistryRow) => void;
  onError: (e: string | null) => void;
};

/**
 * Araç kataloğu — her satır yerine veri-yoğun kart (Mosaic katalog deseni).
 */
export function AdminToolCatalog({ tools, accessToken, onUpdated, onError }: Props) {
  const [q, setQ] = useState("");
  const filtered = tools?.filter(
    (t) => q.trim() === "" || t.id.toLowerCase().includes(q.toLowerCase()) || t.strategy.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <AdminToolbar
        searchPlaceholder="Tool id veya strateji ara…"
        searchValue={q}
        onSearchChange={setQ}
      />
      {tools === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : !filtered || filtered.length === 0 ? (
        <EmptyState
          title="Araç bulunamadı"
          description="Filtreleri sıfırlayın veya farklı anahtar deneyin."
          ctaLabel="Aramayı temizle"
          onCta={() => setQ("")}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <div
              key={row.id}
              className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/30 ring-1 ring-white/[0.04]"
            >
              <div className="flex items-center gap-2 border-b border-slate-800/50 bg-slate-800/20 px-4 py-2.5">
                <Wrench className="h-4 w-4 text-cyan-400/70" />
                <span className="font-mono text-sm font-semibold text-cyan-100/90">{row.id}</span>
                <span className="text-xs text-slate-500">· {row.strategy}</span>
              </div>
              <table className="w-full">
                <tbody>
                  <CCToolRow row={row} accessToken={accessToken} onUpdated={onUpdated} onError={onError} />
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
