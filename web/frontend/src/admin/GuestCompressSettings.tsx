import { useCallback, useEffect, useState } from "react";
import {
  fetchGuestCompressSettings,
  saveGuestCompressSettings,
  type GuestCompressAdminState,
  type GuestCompressSettings as Settings,
} from "../api/admin";
import { AdminField, AdminMutedBox, AdminSection, adminInputClass } from "./mosaic/adminPrimitives";

/**
 * MİSAFİR PDF SIKIŞTIR — yönetim paneli ayarı.
 *
 * Eskiden bu değerler Render ortam değişkenindeydi. Artık buradan yönetilir: kayıt veritabanına
 * yazılır, PDF servisi ~30 sn içinde alır (yeniden dağıtım gerekmez).
 *
 * "Misafir kullanımı" anahtarı ACİL KAPATMA'dır: kapatınca ziyaretçi sıkıştıramaz, herkes üyelik
 * kapısını görür. Üyelerin hakkı (günde 3) ve paket sahipleri bundan etkilenmez.
 */

type Props = { accessToken: string };

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("tr-TR");
}

export function GuestCompressSettings({ accessToken }: Props) {
  const [state, setState] = useState<GuestCompressAdminState | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const apply = useCallback((s: GuestCompressAdminState) => {
    setState(s);
    setForm(s.config);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await fetchGuestCompressSettings(accessToken));
    } catch {
      setMsg({ tone: "err", text: "Misafir sıkıştırma ayarları okunamadı." });
    }
  }, [accessToken, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<Settings>, okText: string) => {
      setBusy(true);
      setMsg(null);
      try {
        apply(await saveGuestCompressSettings(accessToken, patch));
        setMsg({ tone: "ok", text: okText });
      } catch {
        setMsg({ tone: "err", text: "Kaydedilemedi. Değerleri kontrol edip tekrar dene." });
      } finally {
        setBusy(false);
      }
    },
    [accessToken, apply],
  );

  if (!state || !form) {
    return (
      <AdminSection title="Misafir PDF Sıkıştır hakkı" description="Üye olmayan ziyaretçilerin günlük sıkıştırma hakkı." variant="emerald">
        <AdminMutedBox>{msg ? msg.text : "Yükleniyor…"}</AdminMutedBox>
      </AdminSection>
    );
  }

  const dirty =
    form.dailyLimit !== state.config.dailyLimit ||
    form.globalDailyLimit !== state.config.globalDailyLimit ||
    form.maxMB !== state.config.maxMB;
  const member = state.memberDailyLimit;
  const tooGenerous = member != null && form.dailyLimit >= member;
  const cap = state.config.globalDailyLimit;
  const pct = cap > 0 ? Math.min(100, Math.round((state.today.operations / cap) * 100)) : 0;
  const num = (field: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [field]: Number(e.target.value) } : f));
  const b = state.bounds;

  return (
    <AdminSection
      title="Misafir PDF Sıkıştır hakkı"
      description="Üye olmayan ziyaretçilerin günlük PDF sıkıştırma hakkı. Değişiklik yaklaşık 30 saniyede geçerli olur; yeniden dağıtım gerekmez."
      variant="emerald"
    >
      {/* Durum + acil kapatma */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
          state.closed ? "border-rose-500/30 bg-rose-500/[0.08]" : "border-emerald-500/30 bg-emerald-500/[0.08]"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-white">
            Misafir kullanımı:{" "}
            <span className={state.closed ? "text-rose-300" : "text-emerald-300"}>{state.closed ? "KAPALI" : "AÇIK"}</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {state.config.enabled
              ? state.closed
                ? "Bir sınır 0 olduğu için ziyaretçiler üyelik kapısını görüyor."
                : `Ziyaretçi günde ${state.config.dailyLimit} kez sıkıştırabilir.`
              : "Acil kapatma devrede: ziyaretçiler sıkıştıramaz, üyelik kapısını görür."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void save(
              { enabled: !state.config.enabled },
              state.config.enabled ? "Misafir kullanımı KAPATILDI." : "Misafir kullanımı AÇILDI.",
            )
          }
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
            state.config.enabled ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          {state.config.enabled ? "Acil kapat" : "Yeniden aç"}
        </button>
      </div>

      <AdminMutedBox>
        <strong className="text-slate-200">Acil kapatma ne işe yarar?</strong> Bir suistimal ya da sunucu yükü fark edersen tek tıkla
        misafir kullanımını durdurur; ziyaretçiler “üye ol” kapısını görür. <strong className="text-slate-200">Üyelerin hakkı ve paket
        sahipleri etkilenmez.</strong> İstediğin an yeniden açabilirsin.
      </AdminMutedBox>

      <div className="grid gap-5 sm:grid-cols-3">
        <AdminField
          label="Kişi başı günlük hak"
          description={`${b.dailyLimit.min}–${b.dailyLimit.max}. 0 = kapalı.`}
          hint="Aynı cihaz/ağdan gelen ziyaretçi bir günde bu kadar sıkıştırabilir."
        >
          <input
            type="number"
            min={b.dailyLimit.min}
            max={b.dailyLimit.max}
            className={adminInputClass}
            value={form.dailyLimit}
            onChange={num("dailyLimit")}
          />
        </AdminField>
        <AdminField
          label="Toplam günlük kapasite"
          description="Tüm misafirlerin toplamı. 0 = kapalı."
          hint="Sunucu maliyetinin üst sınırı. Dolunca ziyaretçilere 'üye olarak devam et' denir."
        >
          <input
            type="number"
            min={b.globalDailyLimit.min}
            max={b.globalDailyLimit.max}
            className={adminInputClass}
            value={form.globalDailyLimit}
            onChange={num("globalDailyLimit")}
          />
        </AdminField>
        <AdminField label="En büyük dosya (MB)" description={`${b.maxMB.min}–${b.maxMB.max} MB`}>
          <input
            type="number"
            min={b.maxMB.min}
            max={b.maxMB.max}
            className={adminInputClass}
            value={form.maxMB}
            onChange={num("maxMB")}
          />
        </AdminField>
      </div>

      {tooGenerous ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-xs text-amber-200">
          Dikkat: misafir hakkı ({form.dailyLimit}) ücretsiz üye hakkına ({member}) eşit ya da büyük. Üyelik avantajı kalmaz; misafir
          hakkını üye hakkından küçük tut.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void save({ dailyLimit: form.dailyLimit, globalDailyLimit: form.globalDailyLimit, maxMB: form.maxMB }, "Ayarlar kaydedildi.")}
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

      {/* Bugünkü kullanım */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bugün</p>
        <p className="mt-1 text-sm text-slate-200">
          <strong>{state.today.operations}</strong> misafir işlemi · <strong>{state.today.visitors}</strong> farklı ziyaretçi
          {cap > 0 ? (
            <>
              {" "}
              · kapasite <strong>%{pct}</strong> ({state.today.operations}/{cap})
            </>
          ) : null}
        </p>
        {cap > 0 ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full ${pct >= 90 ? "bg-rose-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>

      {/* Sayaç nerede tutuluyor? */}
      {!state.bridge.secretConfigured ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-xs leading-relaxed text-rose-200">
          <strong>Sayaç geçici diskte tutuluyor.</strong> Auth sunucusunda <code>INTERNAL_SERVICE_SECRET</code> tanımlı değil; bu yüzden
          PDF servisi sayacı kendi geçici diskinde tutar ve her yeniden başlatmada sıfırlanır. Düzeltmek için Render’da <em>nb-pdf-api</em> ve{" "}
          <em>nb-auth-api</em> servislerine <strong>aynı</strong> uzun rastgele değeri <code>INTERNAL_SERVICE_SECRET</code> olarak ekle.
          Bu anahtar yalnızca iki sunucu arasında kullanılır.
        </p>
      ) : state.bridge.lastContactAt ? (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-200">
          Sayaç veritabanında tutuluyor (kalıcı). PDF servisi bu sunucuya en son <strong>{when(state.bridge.lastContactAt)}</strong> tarihinde ulaştı.
        </p>
      ) : (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3 text-xs text-amber-200">
          Ortak anahtar tanımlı, ama PDF servisi bu sunucuya henüz ulaşmadı (sunucu yeni başlamış olabilir). Bir ziyaretçi sıkıştırınca
          burası “kalıcı” olarak güncellenir; güncellenmezse iki sunucudaki anahtarın <strong>aynı</strong> olduğunu kontrol et.
        </p>
      )}
    </AdminSection>
  );
}
