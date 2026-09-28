import { useEffect, useState } from "react";
import { putAdminAppSettings, type AppSettingsPayload } from "../../api/admin";
// postAdminAdjustCredits removed — credit system deprecated
import { adminInputClass, AdminField } from "../mosaic/adminPrimitives";

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
    return <p className="text-slate-400">Loading…</p>;
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
      <div className="rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="font-medium text-slate-200">Bakım modu</span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Açıkken ziyaretçilere bakım sayfası gösterilir. Tek tıkla aç/kapat — redeploy gerekmez.
              Mevcut durum:{" "}
              <span className={form.globalMaintenanceMode ? "text-amber-300" : "text-emerald-400"}>
                {form.globalMaintenanceMode ? "AÇIK" : "kapalı"}
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            checked={!!form.globalMaintenanceMode}
            onChange={(e) => setK("globalMaintenanceMode")(e.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-amber-500"
            aria-label="Bakım modu"
          />
        </label>
        {form.maintenanceForcedByEnv ? (
          <p className="mt-2 rounded bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300">
            ⚠ <code className="rounded bg-black/40 px-1">MAINTENANCE_MODE</code> env'i açık — bu anahtar
            kapatılsa bile site bakımda kalır. Normal kullanım için Render'da env'i kapatın; env yalnızca
            acil override içindir.
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-slate-400">
          Değişikliği uygulamak için aşağıdaki <span className="text-slate-300">Save</span>'e basın.
        </p>
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

