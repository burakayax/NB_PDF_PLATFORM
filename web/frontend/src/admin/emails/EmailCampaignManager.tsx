import { useEffect, useState } from "react";
import { Mail, Plus, Send, Trash2, Pencil, Clock, Tag } from "lucide-react";
import {
  fetchAdminCampaigns,
  createAdminCampaign,
  updateAdminCampaign,
  deleteAdminCampaign,
  testAdminCampaign,
  type AdminCampaignRow,
  type AdminCampaignInput,
} from "../../api/admin";
import { adminInputClass } from "../mosaic/adminPrimitives";

const EMPTY: AdminCampaignInput = {
  name: "", enabled: true, triggerDays: 3,
  subjectTr: "", subjectEn: "", eyebrowTr: "", eyebrowEn: "",
  titleTr: "", titleEn: "", introTr: "", introEn: "",
  bodyTr: "", bodyEn: "", ctaLabelTr: "", ctaLabelEn: "", ctaUrl: "", couponCode: null,
};

type Editing = { id: string | null; draft: AdminCampaignInput } | null;

/** Modül seviyesinde — render içinde tanımlanırsa her tuşta remount olup odak kaybettirir. */
function Field({ label, value, onChange, area, ph }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; ph?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      {area ? (
        <textarea className={`${adminInputClass} min-h-[90px]`} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={adminInputClass} value={value} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export function EmailCampaignManager({ accessToken }: { accessToken: string }) {
  const [items, setItems] = useState<AdminCampaignRow[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetchAdminCampaigns(accessToken);
      setItems(r.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [accessToken]);

  function startNew() { setEditing({ id: null, draft: { ...EMPTY } }); setErr(null); setNote(null); }
  function startEdit(c: AdminCampaignRow) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = c;
    setEditing({ id: c.id, draft: rest }); setErr(null); setNote(null);
  }
  function set<K extends keyof AdminCampaignInput>(k: K, v: AdminCampaignInput[K]) {
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));
  }

  async function save() {
    if (!editing) return;
    setBusy(true); setErr(null);
    try {
      const d = editing.draft;
      if (!d.name.trim() || !d.subjectTr.trim() || !d.titleTr.trim() || !d.bodyTr.trim()) {
        throw new Error("Ad, TR konu, TR başlık ve TR gövde zorunlu.");
      }
      if (editing.id) await updateAdminCampaign(accessToken, editing.id, d);
      else await createAdminCampaign(accessToken, d);
      setEditing(null);
      await refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Kaydedilemedi"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Bu e-posta kampanyası silinsin mi?")) return;
    try { await deleteAdminCampaign(accessToken, id); await refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Silinemedi"); }
  }

  async function test(id: string, locale: "tr" | "en") {
    setNote(null); setErr(null);
    try { const r = await testAdminCampaign(accessToken, id, locale); setNote(`Test gönderildi → ${r.sentTo}`); }
    catch (e) { setErr(e instanceof Error ? e.message : "Test gönderilemedi"); }
  }

  async function toggle(c: AdminCampaignRow) {
    try {
      const u = await updateAdminCampaign(accessToken, c.id, { enabled: !c.enabled });
      setItems((prev) => (prev ?? []).map((x) => (x.id === u.id ? u : x)));
    } catch (e) { setErr(e instanceof Error ? e.message : "Güncellenemedi"); }
  }

  const F = Field;

  // ── Editör ──
  if (editing) {
    const d = editing.draft;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-cyan-400/80" />
          <h2 className="text-sm font-semibold text-white">{editing.id ? "E-postayı düzenle" : "Yeni e-posta"}</h2>
        </div>
        {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Ad (iç etiket)" value={d.name} onChange={(v) => set("name", v)} ph="Yükseltme / AI" />
          <label className="block">
            <span className="text-xs text-slate-500">Kayıttan kaç gün sonra</span>
            <input type="number" min={0} max={365} className={adminInputClass} value={d.triggerDays}
              onChange={(e) => set("triggerDays", Math.max(0, Math.min(365, Number(e.target.value) || 0)))} />
          </label>
        </div>

        <div className="rounded-xl border border-slate-800/60 p-3">
          <p className="mb-2 text-xs font-semibold text-cyan-300">🇹🇷 Türkçe</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Konu (subject)" value={d.subjectTr} onChange={(v) => set("subjectTr", v)} />
            <F label="Üst etiket (eyebrow)" value={d.eyebrowTr} onChange={(v) => set("eyebrowTr", v)} ph="Yükseltme" />
            <F label="Başlık" value={d.titleTr} onChange={(v) => set("titleTr", v)} />
            <F label="Giriş (intro)" value={d.introTr} onChange={(v) => set("introTr", v)} />
          </div>
          <div className="mt-3"><F label="Gövde (çift satır = paragraf, **kalın**)" value={d.bodyTr} onChange={(v) => set("bodyTr", v)} area /></div>
          <div className="mt-3"><F label="Buton yazısı" value={d.ctaLabelTr} onChange={(v) => set("ctaLabelTr", v)} ph="Planları gör" /></div>
        </div>

        <div className="rounded-xl border border-slate-800/60 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-400">🇬🇧 English</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Subject" value={d.subjectEn} onChange={(v) => set("subjectEn", v)} />
            <F label="Eyebrow" value={d.eyebrowEn} onChange={(v) => set("eyebrowEn", v)} />
            <F label="Title" value={d.titleEn} onChange={(v) => set("titleEn", v)} />
            <F label="Intro" value={d.introEn} onChange={(v) => set("introEn", v)} />
          </div>
          <div className="mt-3"><F label="Body (blank line = paragraph, **bold**)" value={d.bodyEn} onChange={(v) => set("bodyEn", v)} area /></div>
          <div className="mt-3"><F label="Button label" value={d.ctaLabelEn} onChange={(v) => set("ctaLabelEn", v)} /></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Buton bağlantısı (boş = çalışma alanı)" value={d.ctaUrl} onChange={(v) => set("ctaUrl", v)} ph="https://www.pdfplatform.app/#pricing" />
          <F label="İndirim kupon kodu (opsiyonel)" value={d.couponCode ?? ""} onChange={(v) => set("couponCode", v.trim() ? v.trim().toUpperCase() : null)} ph="HOSGELDIN20" />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={d.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4 accent-cyan-500" />
          Etkin (zamanlayıcı gönderir)
        </label>

        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void save()}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-40">
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button type="button" onClick={() => setEditing(null)}
            className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5">İptal</button>
        </div>
      </div>
    );
  }

  // ── Liste ──
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-cyan-400/80" />
          <h2 className="text-sm font-semibold text-white">Pazarlama e-postaları</h2>
        </div>
        <button type="button" onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
          <Plus className="h-4 w-4" /> Yeni e-posta
        </button>
      </div>
      <p className="text-xs text-slate-500">Kayıttan N gün sonra, izin veren ücretsiz kullanıcılara otomatik gönderilir. Test kendine gider.</p>
      {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</p>}
      {note && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{note}</p>}

      {items === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-slate-800/60 px-4 py-6 text-center text-sm text-slate-500">Henüz e-posta yok. "Yeni e-posta" ile ekleyin.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${c.enabled ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    {c.couponCode && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200"><Tag className="h-3 w-3" />{c.couponCode}</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{c.subjectTr}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Clock className="h-3 w-3" />Kayıttan {c.triggerDays}. gün</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => void toggle(c)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${c.enabled ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-700/40 text-slate-400"}`}>
                    {c.enabled ? "Etkin" : "Kapalı"}
                  </button>
                  <button type="button" onClick={() => void test(c.id, "tr")} title="Kendine test gönder"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/5"><Send className="h-3.5 w-3.5" />Test</button>
                  <button type="button" onClick={() => startEdit(c)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/5"><Pencil className="h-3.5 w-3.5" />Düzenle</button>
                  <button type="button" onClick={() => void remove(c.id)} title="Sil"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
