import { useCallback, useEffect, useState } from "react";
import { putAdminAppSettings, putAdminToolRegistry, type AppSettingsPayload, type ToolRegistryRow } from "../../api/admin";
// postAdminAdjustCredits removed — credit system deprecated
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
  const [vis, setVis] = useState(row.isVisible);
  const [maint, setMaint] = useState(row.isMaintenanceMode);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVis(row.isVisible);
    setMaint(row.isMaintenanceMode);
  }, [row]);

  const save = useCallback(async () => {
    setBusy(true);
    onError(null);
    try {
      const next = await putAdminToolRegistry(accessToken, row.toolId || row.id, {
        isVisible: vis,
        isMaintenanceMode: maint,
      });
      onUpdated(next as ToolRegistryRow);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [accessToken, row.id, vis, maint, onError, onUpdated]);

  return (
    <tr className="transition hover:bg-slate-800/40">
      <td className="px-4 py-3.5 font-mono text-xs text-cyan-100/90">{row.id}</td>
      <td className="px-4 py-3.5 text-slate-400">{row.strategy}</td>
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
          {busy ? "…" : "Kaydet"}
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
      <div className="rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
        <span className="font-medium text-slate-200">Global maintenance</span> is controlled by the API host env{" "}
        <code className="rounded bg-black/40 px-1">MAINTENANCE_MODE</code> (redeploy to apply). Displayed value reflects
        the current API:{" "}
        <span className={form.globalMaintenanceMode ? "text-amber-300" : "text-emerald-400"}>
          {form.globalMaintenanceMode ? "on" : "off"}
        </span>
        .
      </div>
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

