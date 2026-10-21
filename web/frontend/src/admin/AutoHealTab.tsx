import { useCallback, useEffect, useState } from "react";
import {
  fetchAutoHeal,
  runAutoHealNow,
  saveAutoHeal,
  setAutoHealIncidentStatus,
  type AutoHealAdminState,
  type AutoHealIncident,
  type AutoHealSeverity,
} from "../api/admin";
import { AdminField, AdminMutedBox, AdminSection, adminInputClass } from "./mosaic/adminPrimitives";

/**
 * HATA İZLEME — yönetim paneli.
 *
 * Site hataları (sayfa + sunucu) toplanır, gerçek olmayanlar (eklenti, bot, enjekte betik) elenir,
 * kalanlara önem derecesi verilir ve önemli olanlar e-postayla bildirilir. Yapay zekâ kullanmaz.
 */

type Props = { accessToken: string };

const SEV_LABEL: Record<AutoHealSeverity, string> = { low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik" };
const SEV_CLASS: Record<AutoHealSeverity, string> = {
  low: "border-slate-500/40 bg-slate-500/15 text-slate-200",
  medium: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  high: "border-orange-500/50 bg-orange-500/15 text-orange-200",
  critical: "border-rose-500/50 bg-rose-500/20 text-rose-200",
};
const NOISE_LABEL: Record<string, string> = {
  extension: "Tarayıcı eklentisi",
  "injected-script": "Dışarıdan çalıştırılan betik",
  bot: "Bot / otomatik ziyaretçi",
  "browser-noise": "Bilinen zararsız tarayıcı uyarısı",
  "cross-origin-script": "Başka siteden yüklenen betik",
};

function when(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
}

export function AutoHealTab({ accessToken }: Props) {
  const [state, setState] = useState<AutoHealAdminState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await fetchAutoHeal(accessToken));
    } catch {
      setMsg({ tone: "err", text: "Hata izleme bilgisi okunamadı." });
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const act = useCallback(async (fn: () => Promise<AutoHealAdminState>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      setState(await fn());
      setMsg({ tone: "ok", text: okText });
    } catch {
      setMsg({ tone: "err", text: "İşlem yapılamadı. Tekrar dene." });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!state) {
    return (
      <AdminSection title="Hata izleme" description="Site hatalarının otomatik izlenmesi." variant="emerald">
        <AdminMutedBox>{msg ? msg.text : "Yükleniyor…"}</AdminMutedBox>
      </AdminSection>
    );
  }

  const cfg = state.config;
  const open = state.incidents.filter((i) => i.status === "open");
  const shown = filter === "open" ? open : state.incidents;
  const noiseTotal = Object.values(state.noise).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <AdminSection
        title="Hata izleme"
        description="Site hataları 7/24 izlenir; gerçek olmayanlar elenir, önemli olanlar e-postayla bildirilir."
        variant="emerald"
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
            cfg.enabled ? "border-emerald-500/30 bg-emerald-500/[0.08]" : "border-slate-500/30 bg-slate-500/[0.08]"
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-white">
              İzleme: <span className={cfg.enabled ? "text-emerald-300" : "text-slate-300"}>{cfg.enabled ? "AÇIK" : "KAPALI"}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Son analiz: {when(state.lastRunAt)} · Açık olay: {open.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => runAutoHealNow(accessToken), "Analiz tamamlandı.")}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
            >
              Şimdi analiz et
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => saveAutoHeal(accessToken, { enabled: !cfg.enabled }), cfg.enabled ? "İzleme kapatıldı." : "İzleme açıldı.")}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              {cfg.enabled ? "İzlemeyi kapat" : "İzlemeyi aç"}
            </button>
          </div>
        </div>

        <AdminMutedBox>
          Hataları toplar, aynı hataları tek olayda birleştirir, eklenti/bot/dışarıdan çalıştırılan betik kaynaklı sahte hataları eler ve
          önem derecesi verir. Seçtiğin dereceden yüksek yeni olaylar için e-posta gönderir (saatte en fazla 6). Kod değiştirmez, hiçbir şeyi
          kendiliğinden düzeltmez.
        </AdminMutedBox>

        <div className="grid gap-5 sm:grid-cols-3">
          <AdminField label="E-posta alt sınırı" description="Bu derece ve üstü olaylar e-postayla bildirilir.">
            <select
              className={adminInputClass}
              disabled={busy}
              value={cfg.emailMinSeverity}
              onChange={(e) => void act(() => saveAutoHeal(accessToken, { emailMinSeverity: e.target.value }), "Ayar kaydedildi.")}
            >
              {(Object.keys(SEV_LABEL) as AutoHealSeverity[]).map((s) => (
                <option key={s} value={s}>
                  {SEV_LABEL[s]} ve üstü
                </option>
              ))}
            </select>
          </AdminField>
        </div>

        {msg ? (
          <span role="status" className={`text-xs ${msg.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
            {msg.text}
          </span>
        ) : null}
      </AdminSection>

      <AdminSection title="Elenen sahte hatalar" description={`Son 24 saatte ${noiseTotal} kayıt gerçek hata sayılmadı.`} variant="default">
        <ul className="grid gap-2 sm:grid-cols-2">
          {Object.entries(state.noise).map(([k, v]) => (
            <li key={k} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">
              <span>{NOISE_LABEL[k] ?? k}</span>
              <span className="font-semibold tabular-nums text-white">{v}</span>
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection title="Hata olayları" description="Aynı hata tek satırda toplanır. Gereksizse “yok say”, giderildiyse “çözüldü” de." variant="default">
        <div className="flex gap-2">
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f ? "border-sky-400/60 bg-sky-500/20 text-sky-100" : "border-white/10 text-slate-400 hover:bg-white/[0.05]"
              }`}
            >
              {f === "open" ? `Açık (${open.length})` : `Hepsi (${state.incidents.length})`}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <AdminMutedBox>{filter === "open" ? "Açık hata olayı yok." : "Henüz hata olayı yok."}</AdminMutedBox>
        ) : (
          <ul className="space-y-2">
            {shown.map((i: AutoHealIncident) => (
              <li key={i.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${SEV_CLASS[i.severity]}`}>{SEV_LABEL[i.severity]}</span>
                      <span className="text-[11px] text-slate-400">{i.server ? "Sunucu" : "Sayfa"}</span>
                      {i.status !== "open" ? (
                        <span className="text-[11px] text-slate-500">{i.status === "ignored" ? "yok sayıldı" : "çözüldü"}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-white">{i.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {i.count} kez · son 30 dk’da {i.visitors} ziyaretçi · son görülme {when(i.lastSeenAt)}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    {i.status === "open" ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void act(() => setAutoHealIncidentStatus(accessToken, i.id, "ignored"), "Olay yok sayıldı.")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06] disabled:opacity-50">
                          Yok say
                        </button>
                        <button type="button" disabled={busy} onClick={() => void act(() => setAutoHealIncidentStatus(accessToken, i.id, "resolved"), "Olay çözüldü olarak işaretlendi.")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                          Çözüldü
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => void act(() => setAutoHealIncidentStatus(accessToken, i.id, "open"), "Olay yeniden açıldı.")} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.06] disabled:opacity-50">
                        Yeniden aç
                      </button>
                    )}
                  </div>
                </div>
                {openId === i.id ? (
                  <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs text-slate-300">
                    <div><dt className="inline text-slate-500">Kaynak: </dt><dd className="inline break-all">{i.source ?? "—"}</dd></div>
                    <div><dt className="inline text-slate-500">Adres: </dt><dd className="inline break-all">{i.url ?? "—"}</dd></div>
                    <div><dt className="inline text-slate-500">İlk görülme: </dt><dd className="inline">{when(i.firstSeenAt)}</dd></div>
                    <div><dt className="inline text-slate-500">E-posta: </dt><dd className="inline">{i.notifiedAt ? `${when(i.notifiedAt)} (${SEV_LABEL[i.notifiedSeverity ?? "low"]})` : "gönderilmedi"}</dd></div>
                    {i.stack ? <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-slate-400">{i.stack}</pre> : null}
                  </dl>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
