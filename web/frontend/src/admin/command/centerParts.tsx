import { useCallback, useEffect, useState } from "react";
import { putAdminAppSettings, putAdminToolRegistry, postAdminAdjustCredits, type AppSettingsPayload, type ToolRegistryRow } from "../../api/admin";
import { adminInputClass, AdminField } from "../mosaic/adminPrimitives";

export function CCToolRow({
  row,
  accessToken,
  onUpdated,
  onError,
}: {
  row: ToolRegistryRow;
  accessToken: string;
  onUpdated: (r: ToolRegistryRow) => void;
  onError: (e: string | null) => void;
}) {
  const [cost, setCost] = useState(String(row.creditCost));
  const [vis, setVis] = useState(row.isVisible);
  const [maint, setMaint] = useState(row.isMaintenanceMode);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCost(String(row.creditCost));
    setVis(row.isVisible);
    setMaint(row.isMaintenanceMode);
  }, [row]);

  const save = useCallback(async () => {
    setBusy(true);
    onError(null);
    try {
      const c = Math.max(0, Math.floor(Number(cost) || 0));
      const next = await putAdminToolRegistry(accessToken, row.toolId || row.id, {
        cost: c,
        isVisible: vis,
        isMaintenanceMode: maint,
      });
      onUpdated(next as ToolRegistryRow);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [accessToken, row.id, cost, vis, maint, onError, onUpdated]);

  return (
    <tr className="transition hover:bg-slate-800/40">
      <td className="px-4 py-3.5 font-mono text-xs text-cyan-100/90">{row.id}</td>
      <td className="px-4 py-3.5 text-slate-400">{row.strategy}</td>
      <td className="px-4 py-3.5">
        <input
          className={`${adminInputClass} w-20 font-mono text-xs`}
          type="number"
          min={0}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </td>
      <td className="px-4 py-3.5">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-600" checked={vis} onChange={(e) => setVis(e.target.checked)} />
      </td>
      <td className="px-4 py-3.5">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600"
          checked={maint}
          onChange={(e) => setMaint(e.target.checked)}
        />
      </td>
      <td className="px-4 py-3.5 text-right">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-40"
        >
          {busy ? "…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export function SiteForm({
  site,
  accessToken,
  saving,
  setSaving,
  onLoaded,
  onError,
}: {
  site: AppSettingsPayload | null;
  accessToken: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onLoaded: (s: AppSettingsPayload) => void;
  onError: (e: string | null) => void;
}) {
  const [form, setForm] = useState<Partial<AppSettingsPayload> | null>(null);
  useEffect(() => {
    if (site) {
      setForm(site);
    }
  }, [site]);
  if (!form) {
    return <p className="text-slate-500">Loading…</p>;
  }
  const setK =
    (k: keyof AppSettingsPayload) =>
    (v: string | boolean | null) => {
      setForm((f) => (f ? { ...f, [k]: v } : f));
    };
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setSaving(true);
          onError(null);
          try {
            const next = await putAdminAppSettings(accessToken, {
              siteName: form.siteName,
              logoUrl: form.logoUrl,
              globalMaintenanceMode: form.globalMaintenanceMode,
              seoTitle: form.seoTitle,
              seoDescription: form.seoDescription,
              seoKeywords: form.seoKeywords,
            });
            onLoaded(next);
            setForm(next);
          } catch (err) {
            onError(err instanceof Error ? err.message : "Save failed");
          } finally {
            setSaving(false);
          }
        })();
      }}
    >
      <AdminField label="Site name">
        <input className={adminInputClass} value={form.siteName} onChange={(e) => setK("siteName")(e.target.value)} required />
      </AdminField>
      <AdminField label="Logo URL">
        <input
          className={adminInputClass}
          value={form.logoUrl ?? ""}
          onChange={(e) => setK("logoUrl")(e.target.value.trim() === "" ? null : e.target.value)}
        />
      </AdminField>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600"
          checked={form.globalMaintenanceMode}
          onChange={(e) => setK("globalMaintenanceMode")(e.target.checked)}
        />
        Global maintenance
      </label>
      <AdminField label="SEO title">
        <input className={adminInputClass} value={form.seoTitle ?? ""} onChange={(e) => setK("seoTitle")(e.target.value || null)} />
      </AdminField>
      <AdminField label="SEO description">
        <textarea className={`${adminInputClass} min-h-[88px]`} value={form.seoDescription ?? ""} onChange={(e) => setK("seoDescription")(e.target.value || null)} />
      </AdminField>
      <AdminField label="SEO keywords">
        <input className={adminInputClass} value={form.seoKeywords ?? ""} onChange={(e) => setK("seoKeywords")(e.target.value || null)} />
      </AdminField>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
    </form>
  );
}

export function CreditAdjustPanel({
  user,
  accessToken,
  onDone,
  onError,
}: {
  user: { id: string; email: string; creditBalance: number };
  accessToken: string;
  onDone: () => void;
  onError: (e: string | null) => void;
}) {
  const [delta, setDelta] = useState("10");
  const [reason, setReason] = useState("Support adjustment");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="break-all font-mono text-xs text-slate-500">{user.email}</p>
      <p className="mt-2 text-sm text-slate-400">
        Balance: <span className="font-mono text-cyan-300">{user.creditBalance}</span>
      </p>
      <label className="mt-4 block text-xs font-medium text-slate-500">Amount (+/−)</label>
      <input
        className={`${adminInputClass} mt-1 font-mono`}
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        inputMode="numeric"
      />
      <label className="mt-3 block text-xs font-medium text-slate-500">Reason</label>
      <input className={`${adminInputClass} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              onError(null);
              try {
                const n = Math.trunc(Number(delta));
                if (!Number.isFinite(n) || n === 0) {
                  throw new Error("Non-zero integer required.");
                }
                if (!reason.trim()) {
                  throw new Error("Reason required.");
                }
                await postAdminAdjustCredits(accessToken, user.id, n, reason.trim());
                onDone();
              } catch (e) {
                onError(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "…" : "Apply"}
        </button>
      </div>
    </div>
  );
}
