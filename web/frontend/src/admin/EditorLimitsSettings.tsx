import { useCallback, useEffect, useState } from "react";
import {
  fetchEditorLimits,
  saveEditorLimits,
  type EditorLimitsAdminState,
  type EditorLimitsSettings as Settings,
} from "../api/admin";
import { AdminField, AdminMutedBox, AdminSection, adminInputClass } from "./mosaic/adminPrimitives";

/**
 * PDF DÜZENLE — günlük düzenleme hakları (yönetim paneli).
 *
 * Hak, kullanıcı «PDF'i Hazırla» dediğinde düşer. Plus, Pro, Business ve yönetici sınırsızdır.
 * Kayıt veritabanına yazılır; ek dağıtım gerekmez. 0 = o grup için düzenleme kapalı.
 */
type Props = { accessToken: string };

export function EditorLimitsSettings({ accessToken }: Props) {
  const [state, setState] = useState<EditorLimitsAdminState | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const apply = useCallback((s: EditorLimitsAdminState) => {
    setState(s);
    setForm(s.config);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await fetchEditorLimits(accessToken));
    } catch {
      setMsg({ tone: "err", text: "PDF Düzenle hakları okunamadı." });
    }
  }, [accessToken, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state || !form) {
    return (
      <AdminSection title="PDF Düzenle günlük hakları" description="Üyeliksiz, ücretsiz ve Başlangıç kullanıcılarının günlük düzenleme hakkı." variant="emerald">
        <AdminMutedBox>{msg ? msg.text : "Yükleniyor…"}</AdminMutedBox>
      </AdminSection>
    );
  }

  const dirty = form.guest !== state.config.guest || form.free !== state.config.free || form.starter !== state.config.starter;
  const b = state.bounds;
  const num = (field: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [field]: Number(e.target.value) } : f));
  const ordered = form.guest <= form.free && form.free <= form.starter;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      apply(await saveEditorLimits(accessToken, form));
      setMsg({ tone: "ok", text: "Haklar kaydedildi; birkaç saniye içinde geçerli olur." });
    } catch {
      setMsg({ tone: "err", text: "Kaydedilemedi. Değerleri kontrol edip tekrar dene." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection
      title="PDF Düzenle günlük hakları"
      description="Hak, kullanıcı «PDF'i Hazırla» dediğinde düşer. Plus ve üzeri planlar sınırsızdır. Fiyat kartları ve editördeki uyarılar bu değerleri otomatik gösterir."
      variant="emerald"
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <AdminField label="Üyeliksiz ziyaretçi" description={`${b.min}–${b.max}. 0 = kapalı.`} hint="Aynı cihaz/ağdan gelen ziyaretçi günde bu kadar düzenleme yapabilir.">
          <input type="number" min={b.min} max={b.max} className={adminInputClass} value={form.guest} onChange={num("guest")} />
        </AdminField>
        <AdminField label="Ücretsiz üye" description={`${b.min}–${b.max}. 0 = kapalı.`}>
          <input type="number" min={b.min} max={b.max} className={adminInputClass} value={form.free} onChange={num("free")} />
        </AdminField>
        <AdminField label="Başlangıç planı" description={`${b.min}–${b.max}. 0 = kapalı.`} hint="Ücretli planın avantajı: ücretsiz üyeden yüksek olmalı.">
          <input type="number" min={b.min} max={b.max} className={adminInputClass} value={form.starter} onChange={num("starter")} />
        </AdminField>
      </div>

      {!ordered ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-xs text-amber-200">
          Dikkat: hak sırası mantıklı değil. Üyeliksiz ≤ Ücretsiz üye ≤ Başlangıç olmalı; yoksa üyeliğin ya da planın avantajı kalmaz.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void save()}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
        >
          Kaydet
        </button>
        {dirty ? (
          <button type="button" className="text-xs text-slate-400 underline" onClick={() => setForm(state.config)}>
            Vazgeç
          </button>
        ) : null}
        {msg ? (
          <span role="status" className={`text-xs ${msg.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {msg.text}
          </span>
        ) : null}
      </div>
    </AdminSection>
  );
}
