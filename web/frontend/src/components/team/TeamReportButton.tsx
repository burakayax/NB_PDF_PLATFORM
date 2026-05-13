import { useState } from "react";

type Props = {
  accessToken: string;
  teamName: string;
};

export function TeamReportButton({ accessToken, teamName }: Props) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const download = async (format: "excel" | "csv") => {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/team/report?format=${format}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Rapor indirilemedi.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${teamName.replace(/\s+/g, "-")}-rapor-${ts}.${format === "excel" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:border-cyan-500/25 hover:text-white disabled:opacity-60"
      >
        {loading ? "⏳" : "📥"} Rapor İndir
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 min-w-[170px] rounded-xl border border-white/[0.08] bg-[#0f172a] shadow-2xl">
          <button
            type="button"
            onClick={() => { void download("excel"); }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white rounded-t-xl"
          >
            📊 Excel (XLSX)
          </button>
          <button
            type="button"
            onClick={() => { void download("csv"); }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white rounded-b-xl"
          >
            📄 CSV
          </button>
        </div>
      )}
    </div>
  );
}
