import { useEffect, useState } from "react";
import { fetchServiceStatus, type ComponentStatus, type ServiceStatus } from "../api/serviceStatus";
import { BosDurum, Katlanir } from "./analytics/AdminAnalytics";

const NAMES: Record<"api" | "db" | "pdf", string> = { api: "Auth API", db: "Veritabanı", pdf: "PDF API" };
const ts = (iso: string) => iso.slice(0, 16).replace("T", " ");

function pctClass(c: ComponentStatus) {
  if (c.uptimePct === null) return "text-slate-400";
  return c.uptimePct >= 99.5 ? "text-emerald-300" : c.uptimePct >= 98 ? "text-amber-300" : "text-rose-300";
}

/**
 * Kendi hizmet sağlık kaydımız: dış izleyiciden (UptimeRobot) bağımsız. "Servis kesildi" iddialarında
 * ilk bakılacak yer. Kayıt yazımı yalnız sistem ayaktayken mümkündür; uzun boşluk "sinyal yok" olarak görünür.
 */
export function ServiceStatusSection({ accessToken }: { accessToken: string }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<ServiceStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    void fetchServiceStatus(accessToken, days)
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : "Yüklenemedi."));
    return () => {
      alive = false;
    };
  }, [accessToken, days]);

  const btn = (d: number) =>
    `rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${days === d ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-white/[0.1] text-slate-300 hover:border-cyan-400/30"}`;

  return (
    <Katlanir baslik="Hizmet durumu (kendi kaydımız)" aciklama="Çalışma oranı, kesinti ve sinyal-yok dönemleri, 5xx hataları — dış izleyiciden bağımsız">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[1, 7, 30, 90].map((d) => (
          <button key={d} type="button" onClick={() => setDays(d)} className={btn(d)}>
            Son {d} gün
          </button>
        ))}
      </div>
      {err ? <p className="text-[12px] text-rose-300">{err}</p> : null}
      {!data && !err ? <BosDurum metin="Yükleniyor…" /> : null}
      {data ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Bileşen</th>
                  <th className="py-2 pr-3 font-semibold">Çalışma</th>
                  <th className="py-2 pr-3 font-semibold">Kapalı (dk)</th>
                  <th className="py-2 pr-3 font-semibold">Sinyal yok (dk)</th>
                  <th className="py-2 font-semibold">Dönem</th>
                </tr>
              </thead>
              <tbody>
                {(["api", "db", "pdf"] as const).map((k) => {
                  const c = data.components[k];
                  return (
                    <tr key={k} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-3 text-slate-200">{NAMES[k]}</td>
                      <td className={`py-2 pr-3 font-semibold ${pctClass(c)}`}>{c.uptimePct === null ? "veri yok" : `%${c.uptimePct}`}</td>
                      <td className="py-2 pr-3 text-slate-300">{c.downMinutes}</td>
                      <td className="py-2 pr-3 text-slate-300">{c.noSignalMinutes}</td>
                      <td className="py-2 text-slate-300">{c.incidents.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(["api", "db", "pdf"] as const).some((k) => data.components[k].incidents.length > 0) ? (
            <div className="mt-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Dönemler (UTC)</p>
              <ul className="space-y-1 text-[12px] text-slate-300">
                {(["api", "db", "pdf"] as const).flatMap((k) =>
                  data.components[k].incidents.slice(0, 15).map((i, idx) => (
                    <li key={`${k}-${idx}`}>
                      <span className={i.type === "down" ? "text-rose-300" : "text-amber-300"}>{i.type === "down" ? "KESİNTİ" : "SİNYAL YOK"}</span>{" "}
                      · {NAMES[k]} · {ts(i.start)} → {ts(i.end)} ({i.minutes} dk)
                    </li>
                  )),
                )}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-slate-400">Bu aralıkta kesinti veya sinyal kaybı kaydı yok.</p>
          )}

          {data.failures.length > 0 ? (
            <div className="mt-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">5xx hataları (PDF API)</p>
              <ul className="space-y-1 text-[12px] text-slate-300">
                {data.failures.slice(0, 15).map((f) => (
                  <li key={`${f.path}-${f.status}`}>
                    {f.status} · {f.path} · {f.count} kez · {ts(f.first)} … {ts(f.last)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Not: Bu kayıt sistem ayaktayken yazılır. Auth API tamamen kapalıysa kayıt yazılamaz; o dönem “sinyal yok” görünür. Bağımsız doğrulama için dış izleyici
            (UptimeRobot) geçmişiyle birlikte okuyun.
          </p>
        </>
      ) : null}
    </Katlanir>
  );
}
