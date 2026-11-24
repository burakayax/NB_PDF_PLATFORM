import { useEffect, useState } from "react";
import { fetchToolCalls, type ToolCallsResponse } from "../api/serviceStatus";
import { BosDurum, Katlanir } from "./analytics/AdminAnalytics";

const ts = (iso: string) => iso.slice(0, 16).replace("T", " ");
const RANGES: Array<{ h: number; label: string }> = [
  { h: 1, label: "Son 1 saat" },
  { h: 24, label: "Son 24 saat" },
  { h: 24 * 7, label: "Son 7 gün" },
  { h: 24 * 30, label: "Son 30 gün" },
];

/**
 * Sunucuda çalışan araçların kaydı: hangi araç, kim (üye e-postası ya da misafir), sonuç, süre, dosya boyutu.
 * Cihazda çalışan araçlar (birleştirme vb.) sunucuya gitmediği için burada GÖRÜNMEZ. Dosya içeriği/adı ve IP yazılmaz;
 * kayıtlar 30 gün saklanır.
 */
export function ToolCallsSection({ accessToken }: { accessToken: string }) {
  const [hours, setHours] = useState(24);
  const [outcome, setOutcome] = useState<"all" | "ok" | "error">("all");
  const [tool, setTool] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ToolCallsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    void fetchToolCalls(accessToken, { hours, outcome, tool, page })
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : "Yüklenemedi."));
    return () => {
      alive = false;
    };
  }, [accessToken, hours, outcome, tool, page]);

  const btn = (on: boolean) =>
    `rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${on ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-white/[0.1] text-slate-300 hover:border-white/[0.2]"}`;
  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;

  return (
    <Katlanir baslik="Araç kullanım kaydı (sunucu)" aciklama="Hangi araç, kim tarafından, kaç kez; başarılı mı hatalı mı ve neden — 30 gün saklanır">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.h} type="button" className={btn(hours === r.h)} onClick={() => { setHours(r.h); setPage(1); }}>
            {r.label}
          </button>
        ))}
        <span className="mx-1 text-slate-600">|</span>
        {(["all", "ok", "error"] as const).map((o) => (
          <button key={o} type="button" className={btn(outcome === o)} onClick={() => { setOutcome(o); setPage(1); }}>
            {o === "all" ? "Tümü" : o === "ok" ? "Başarılı" : "Hatalı"}
          </button>
        ))}
        {tool ? (
          <button type="button" className={btn(true)} onClick={() => { setTool(""); setPage(1); }}>
            Araç: {tool} ✕
          </button>
        ) : null}
      </div>
      {err ? <p className="text-[12px] text-rose-300">{err}</p> : null}
      {!data && !err ? <BosDurum metin="Yükleniyor…" /> : null}
      {data ? (
        <>
          {data.summary.length === 0 ? (
            <p className="text-[12px] text-slate-400">Bu aralıkta sunucuya giden araç isteği kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-semibold">Araç</th>
                    <th className="py-2 pr-3 font-semibold">Toplam</th>
                    <th className="py-2 pr-3 font-semibold">Başarılı</th>
                    <th className="py-2 pr-3 font-semibold">Hatalı</th>
                    <th className="py-2 pr-3 font-semibold">Üye / misafir</th>
                    <th className="py-2 pr-3 font-semibold">Ort. süre</th>
                    <th className="py-2 font-semibold">En sık hata nedeni</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((s) => (
                    <tr key={s.tool} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-3">
                        <button type="button" className="text-cyan-200 underline-offset-2 hover:underline" onClick={() => { setTool(s.tool); setPage(1); }}>
                          {s.tool}
                        </button>
                      </td>
                      <td className="py-2 pr-3 text-slate-200">{s.total}</td>
                      <td className="py-2 pr-3 text-emerald-300">{s.ok}</td>
                      <td className={`py-2 pr-3 ${s.error > 0 ? "font-semibold text-rose-300" : "text-slate-400"}`}>{s.error}</td>
                      <td className="py-2 pr-3 text-slate-300">{s.members} / {s.guestCalls}</td>
                      <td className="py-2 pr-3 text-slate-300">{s.avgMs === null ? "—" : `${(s.avgMs / 1000).toFixed(1)} sn`}</td>
                      <td className="py-2 text-slate-300">{s.topReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mb-1 mt-5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Son istekler ({data.total}) — sayfa {page}/{pages}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Zaman (UTC)</th>
                  <th className="py-2 pr-3 font-semibold">Araç</th>
                  <th className="py-2 pr-3 font-semibold">Kim</th>
                  <th className="py-2 pr-3 font-semibold">Sonuç</th>
                  <th className="py-2 pr-3 font-semibold">Süre</th>
                  <th className="py-2 font-semibold">Boyut</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id} className="border-b border-white/[0.04]">
                    <td className="py-2 pr-3 text-slate-300">{ts(i.at)}</td>
                    <td className="py-2 pr-3 text-slate-200">{i.tool}</td>
                    <td className="py-2 pr-3 text-slate-300">
                      {i.who}
                      {i.verified === false ? <span className="ml-1 text-amber-300">(e-posta onaysız)</span> : null}
                    </td>
                    <td className={`py-2 pr-3 ${i.ok ? "text-emerald-300" : "text-rose-300"}`}>
                      {i.ok ? `Başarılı (${i.status})` : `${i.status} · ${i.reason ?? "Hata"}`}
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{i.durationMs === null ? "—" : `${(i.durationMs / 1000).toFixed(1)} sn`}</td>
                    <td className="py-2 text-slate-300">{i.sizeKb === null ? "—" : i.sizeKb >= 1024 ? `${(i.sizeKb / 1024).toFixed(1)} MB` : `${i.sizeKb} KB`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" className={btn(false)} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Önceki
            </button>
            <button type="button" className={btn(false)} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </button>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Not: Cihazda çalışan araçlar (ör. birleştirme, bölme) sunucuya gitmez, bu yüzden burada görünmez. Süre, sunucunun yanıt başlattığı ana kadardır.
            “Misafir”, oturum anahtarı olmayan veya süresi dolmuş istek demektir. Dosya içeriği, dosya adı ve IP kaydedilmez.
          </p>
        </>
      ) : null}
    </Katlanir>
  );
}
