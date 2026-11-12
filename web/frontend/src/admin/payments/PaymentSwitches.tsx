import { useCallback, useEffect, useState } from "react";
import { CreditCard, FileText, Globe2, Loader2 } from "lucide-react";

import { fetchAdminCardListStatus, fetchAdminSettings, putAdminSettingsPatches, type AdminCardListStatus } from "../../api/admin";
import { notifyRuntimeRefresh } from "../../lib/runtimeRefreshEvents";
import { ConfirmDialog, type ConfirmTone } from "./ConfirmDialog";

/**
 * Ödemeler ve iade sekmesinin üstündeki üç ana anahtar (global.flags.featureFlags).
 * Üçü de "durdur" anlamlıdır: anahtar yoksa ya da true ise DURDURULMUŞ; yalnız açıkça false → çalışır.
 * DURDURMAK anında kaydedilir (acil durumda hızlı olsun); AÇMAK ise ortada açılan ikinci onay penceresinden geçer.
 * Kayıt sırasında diğer bayraklar (yapay zekâ durumları vb.) ezilmez.
 */
const SWITCHES = [
  {
    key: "paymentsDisabled",
    title: "Ödemeler",
    onText: "KAPALI — kullanıcılar ödeme yapamaz (siz admin olarak deneyebilirsiniz)",
    offText: "AÇIK — kullanıcılar ödeme yapabilir",
    openLabel: "Ödemeleri aç",
    closeLabel: "Ödemeleri kapat",
    Icon: CreditCard,
    confirm: {
      tone: "danger" as ConfirmTone,
      title: "Ödemeler açılsın mı?",
      confirmLabel: "Evet, ödemeleri aç",
      points: [
        "Açtığınız anda kullanıcılar GERÇEK para ödeyebilir.",
        "Fatura kesme durdurulmuşsa alınan ödemeler faturasız kalır.",
        "Önce e-imza, BirFatura ve iade akışının hazır olduğundan emin olun.",
      ],
    },
  },
  {
    key: "invoicingPaused",
    title: "Fatura kesme",
    onText: "DURDURULDU — fatura, iade faturası ve fatura e-postası oluşmaz",
    offText: "AÇIK — ödeme sonrası fatura kesilir",
    openLabel: "Fatura kesmeyi aç",
    closeLabel: "Fatura kesmeyi durdur",
    Icon: FileText,
    confirm: {
      tone: "warning" as ConfirmTone,
      title: "Fatura kesme açılsın mı?",
      confirmLabel: "Evet, fatura kesmeyi aç",
      points: [
        "Bundan sonraki ödemeler için fatura planlanır; ödemeden yaklaşık 6,5 gün sonra GİB'e iletilir.",
        "Kesilen e-fatura / e-arşiv geri alınamaz; yanlış belge için iptal ya da iade süreci gerekir.",
        "BirFatura bilgilerinin ve test faturasının doğru olduğundan emin olun.",
      ],
    },
  },
  {
    key: "exportExemptionDisabled",
    title: "Yurt dışı KDV istisnası",
    onText: "KAPALI — yurt dışı adresli müşteriye de KDV'li fatura kesilir",
    offText: "AÇIK — yurt dışı müşteriye KDV %0 (ihracat istisnası) uygulanır",
    openLabel: "İstisnayı aç",
    closeLabel: "İstisnayı kapat",
    Icon: Globe2,
    confirm: {
      tone: "danger" as ConfirmTone,
      title: "Yurt dışı KDV istisnası açılsın mı?",
      confirmLabel: "Evet, istisnayı aç",
      points: [
        "Yabancı adresli VE yabancı kartlı müşteriye KDV %0 (ihracat istisnası) uygulanır.",
        "Kart ülkesi belirlenemeyen ve Türk kartlı müşteriler KDV'li kalır.",
        "Muhasebeci onayı, BIN listesi doğrulaması ve BirFatura istisna testi bitmeden açmayın.",
      ],
    },
  },
] as const;

type FlagKey = (typeof SWITCHES)[number]["key"];

function readFeatureFlags(root: unknown): Record<string, unknown> {
  if (root && typeof root === "object" && !Array.isArray(root)) {
    const ff = (root as Record<string, unknown>).featureFlags;
    if (ff && typeof ff === "object" && !Array.isArray(ff)) return { ...(ff as Record<string, unknown>) };
  }
  return {};
}

export function PaymentSwitches({ accessToken }: { accessToken: string }) {
  const [stopped, setStopped] = useState<Record<FlagKey, boolean> | null>(null);
  const [busyKey, setBusyKey] = useState<FlagKey | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [binStatus, setBinStatus] = useState<AdminCardListStatus | null>(null);
  const [pending, setPending] = useState<FlagKey | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchAdminCardListStatus(accessToken)
      .then((r) => {
        if (alive) setBinStatus(r);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [accessToken]);

  const load = useCallback(async () => {
    try {
      const all = await fetchAdminSettings(accessToken);
      const ff = readFeatureFlags(all["global.flags"]);
      setStopped({
        paymentsDisabled: ff.paymentsDisabled !== false,
        invoicingPaused: ff.invoicingPaused !== false,
        exportExemptionDisabled: ff.exportExemptionDisabled !== false,
      });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Anahtarlar okunamadı.");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: FlagKey, nextStopped: boolean) => {
    setBusyKey(key);
    setErr(null);
    try {
      // Güncel ayarı yeniden oku: başka bayrakları ezmeden yalnız bu anahtarı yaz.
      const all = await fetchAdminSettings(accessToken);
      const fr = all["global.flags"];
      const root = fr && typeof fr === "object" && !Array.isArray(fr) ? { ...(fr as Record<string, unknown>) } : {};
      const ff = readFeatureFlags(root);
      ff[key] = nextStopped;
      await putAdminSettingsPatches(accessToken, { "global.flags": { ...root, featureFlags: ff } });
      setStopped((prev) => (prev ? { ...prev, [key]: nextStopped } : prev));
      notifyRuntimeRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusyKey(null);
    }
  };

  const pendingDef = SWITCHES.find((x) => x.key === pending) ?? null;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4" aria-label="Ödeme anahtarları">
      <div className="grid gap-3 md:grid-cols-3">
        {SWITCHES.map((s) => {
          const isStopped = stopped ? stopped[s.key] : null;
          const busy = busyKey === s.key;
          const live = isStopped === false;
          const Icon = s.Icon;
          return (
            <div
              key={s.key}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${
                live
                  ? "border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.12] to-emerald-500/[0.02]"
                  : "border-white/[0.09] bg-gradient-to-br from-white/[0.05] to-white/[0.01]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    live ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-white/[0.1] bg-white/[0.05] text-slate-300"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                    isStopped === null
                      ? "border-white/[0.1] text-slate-400"
                      : live
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`} aria-hidden />
                  {isStopped === null ? "…" : live ? "Açık" : "Kapalı"}
                </span>
              </div>

              <p className="mt-3 text-[14px] font-bold tracking-tight text-white">{s.title}</p>
              <p className="mt-1 min-h-[3.1em] text-[12px] leading-snug text-slate-400">
                {isStopped === null ? "Yükleniyor…" : isStopped ? s.onText : s.offText}
              </p>

              <button
                type="button"
                role="switch"
                aria-checked={live}
                data-testid={`switch-${s.key}`}
                disabled={isStopped === null || busy}
                onClick={() => (isStopped ? setPending(s.key) : void toggle(s.key, true))}
                className={`mt-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                  live
                    ? "border-rose-400/25 bg-rose-500/10 hover:bg-rose-500/20"
                    : "border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/20"
                }`}
              >
                <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${live ? "text-rose-100" : "text-emerald-100"}`}>
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isStopped ? s.openLabel : s.closeLabel}
                </span>
                <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${live ? "bg-emerald-500" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${live ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-[12px] text-rose-200">{err}</p>}
      {binStatus && (
        <p className={`mt-3 text-[12px] leading-snug ${binStatus.stale ? "text-amber-200" : "text-slate-400"}`} data-testid="bin-status">
          Kart (BIN) listesi: {binStatus.entries.toLocaleString("tr-TR")} kayıt
          {binStatus.generatedAt ? ` · ${binStatus.ageDays ?? "?"} gün önce güncellendi` : " · hiç güncellenmedi"}
          {` · son 30 günde kart ülkesi kaydı alınan ${binStatus.total30d} ödemenin ${binStatus.unknown30d}’i belirlenemedi`}
          {binStatus.stale ? " — LİSTE BOŞ YA DA ESKİ: yurt dışı istisnası açılmadan önce güncelleyin (aylık otomatik güncelleme önerisi GitHub’da açılır)." : "."}
        </p>
      )}
      {pendingDef && (
        <ConfirmDialog
          tone={pendingDef.confirm.tone}
          title={pendingDef.confirm.title}
          points={[...pendingDef.confirm.points]}
          confirmLabel={pendingDef.confirm.confirmLabel}
          busy={busyKey === pendingDef.key}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const k = pendingDef.key;
            void toggle(k, false).finally(() => setPending(null));
          }}
        />
      )}
    </section>
  );
}
