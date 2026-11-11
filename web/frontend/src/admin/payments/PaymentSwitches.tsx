import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchAdminCardListStatus, fetchAdminSettings, putAdminSettingsPatches, type AdminCardListStatus } from "../../api/admin";
import { notifyRuntimeRefresh } from "../../lib/runtimeRefreshEvents";

/**
 * Ödemeler ve iade sekmesinin üstündeki üç ana düğme (global.flags.featureFlags).
 * Üçü de "durdur" anlamlıdır: anahtar yoksa ya da true ise DURDURULMUŞ; yalnız açıkça false → çalışır.
 * Her tıklama anında kaydedilir; kayıt sırasında diğer bayraklar (yapay zekâ durumları vb.) ezilmez.
 */
const SWITCHES = [
  {
    key: "paymentsDisabled",
    title: "Ödemeler",
    onText: "KAPALI — kullanıcılar ödeme yapamaz (siz admin olarak deneyebilirsiniz)",
    offText: "AÇIK — kullanıcılar ödeme yapabilir",
    openLabel: "Ödemeleri aç",
    closeLabel: "Ödemeleri kapat",
  },
  {
    key: "invoicingPaused",
    title: "Fatura kesme",
    onText: "DURDURULDU — fatura, iade faturası ve fatura e-postası oluşmaz",
    offText: "AÇIK — ödeme sonrası fatura kesilir",
    openLabel: "Fatura kesmeyi aç",
    closeLabel: "Fatura kesmeyi durdur",
  },
  {
    key: "exportExemptionDisabled",
    title: "Yurt dışı KDV istisnası",
    onText: "KAPALI — yurt dışı adresli müşteriye de KDV'li fatura kesilir",
    offText: "AÇIK — yurt dışı müşteriye KDV %0 (ihracat istisnası) uygulanır",
    openLabel: "İstisnayı aç",
    closeLabel: "İstisnayı kapat",
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

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4" aria-label="Ödeme anahtarları">
      <div className="grid gap-3 md:grid-cols-3">
        {SWITCHES.map((s) => {
          const isStopped = stopped ? stopped[s.key] : null;
          const busy = busyKey === s.key;
          return (
            <div key={s.key} className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/25 p-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{s.title}</p>
                <p className={`mt-1 text-[12.5px] leading-snug ${isStopped === false ? "text-emerald-200" : "text-amber-200"}`}>
                  {isStopped === null ? "Yükleniyor…" : isStopped ? s.onText : s.offText}
                </p>
              </div>
              <button
                type="button"
                data-testid={`switch-${s.key}`}
                disabled={isStopped === null || busy}
                onClick={() => void toggle(s.key, !isStopped)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                  isStopped ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30" : "bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                }`}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isStopped ? s.openLabel : s.closeLabel}
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
    </section>
  );
}
