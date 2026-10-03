import { useEffect, useRef, useState } from "react";
import {
  downloadAdminContractReviewProof,
  fetchAdminContractReviews,
  verifyAdminContractReviewPdf,
  type AdminContractReviewRow,
  type AdminContractVerifyResult,
} from "../api/admin";
import { BosDurum, Katlanir } from "./analytics/AdminAnalytics";

const STATUS: Record<string, { label: string; cls: string }> = {
  DONE: { label: "Tamamlandı", cls: "bg-emerald-500/15 text-emerald-300" },
  RUNNING: { label: "Sürüyor", cls: "bg-sky-500/15 text-sky-300" },
  FAILED: { label: "Başarısız (iade)", cls: "bg-rose-500/15 text-rose-300" },
};
const CHARGE: Record<string, string> = { admin_exempt: "Yönetici (düşüm yok)", credit: "Kredi", monthly_then_credit: "Aylık hak → kredi" };
const KIND: Record<string, string> = { annotated: "boyalı PDF", report: "rapor PDF" };

const ts = (iso: string) => iso.slice(0, 19).replace("T", " ");

/**
 * Sözleşme Denetçisi kayıtları — anlaşmazlıkta "kim, ne zaman, neyi onayladı, ne düşüldü, ne indirdi?"
 * sorusunun cevabı. Delil çıktısı (düz metin) ve kullanıcının elindeki PDF'in doğrulaması buradan yapılır.
 */
export function ContractReviewAdminSection({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<AdminContractReviewRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [verify, setVerify] = useState<AdminContractVerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetchAdminContractReviews(accessToken, 100);
        setRows(r.items);
        setTotal(r.total);
      } catch {
        setRows([]);
      }
    })();
  }, [accessToken]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setErr(null);
    setVerify(null);
    try {
      setVerify(await verifyAdminContractReviewPdf(accessToken, f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Doğrulama yapılamadı.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Katlanir baslik="Sözleşme Denetçisi kayıtları" aciklama="Onay, düşülen hak/kredi, iade, indirme ve PDF doğrulama (anlaşmazlık için delil)">
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-[12px] font-bold text-slate-200">Kullanıcının elindeki PDF’i doğrula</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
          Kullanıcı “bu rapor yanlıştı” derse dosyayı buraya yükleyin. Dosyaya gömülü imzalı kayıt bizim ürettiğimiz rapor mu, içeriği
          değiştirilmiş mi ve ne zaman/kim için üretildi sorusu yanıtlanır. Kayıt yoksa dosya bizim çıktımız olarak doğrulanamaz.
        </p>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="mt-2 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50"
        >
          {busy ? "Doğrulanıyor…" : "PDF seç ve doğrula"}
        </button>
        {err && <p className="mt-2 text-[12px] text-rose-300">{err}</p>}
        {verify && (
          <div className="mt-3 space-y-2 text-[12px]">
            <p className={`font-bold ${verify.verified ? "text-emerald-300" : "text-rose-300"}`}>
              {verify.verified ? "DOĞRULANDI — gömülü rapor PDF PLATFORM tarafından üretilmiş ve değiştirilmemiş." : "DOĞRULANAMADI"}
            </p>
            {verify.reason && <p className="text-slate-300">{verify.reason}</p>}
            {verify.checks?.map((c) => (
              <p key={c.name} className={c.ok ? "text-emerald-300" : "text-rose-300"}>
                {c.ok ? "✓" : "✕"} {c.name}
              </p>
            ))}
            {verify.log && (
              <p className="text-slate-300">
                İşlem {verify.log.id} · {verify.log.userEmail} · {verify.log.mode === "quick" ? "hızlı tarama" : "detaylı denetim"} · {verify.log.units} · onay{" "}
                {ts(verify.log.consentAt)} UTC · durum {verify.log.status}
                {verify.log.downloads.length > 0 &&
                  ` · indirmeler: ${verify.log.downloads.map((d) => `${KIND[d.kind] ?? d.kind} ${ts(d.at)}`).join(", ")}`}
              </p>
            )}
            {verify.original && (
              <details className="rounded-lg border border-white/[0.06] p-2">
                <summary className="cursor-pointer font-semibold text-slate-200">Orijinal rapor (gömülü kayıttan)</summary>
                <p className="mt-1 text-slate-200">{verify.original.headline}</p>
                <p className="mt-1 text-slate-400">{verify.original.summary}</p>
                <ul className="mt-1 list-disc pl-4 text-slate-300">
                  {verify.original.findings.map((f, i) => (
                    <li key={i}>
                      [{f.severity}] {f.title} — {f.clause}
                      {f.page ? `, sayfa ${f.page}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {verify.note && <p className="text-[11px] text-slate-500">{verify.note}</p>}
          </div>
        )}
      </div>

      {rows === null ? (
        <BosDurum metin="Yükleniyor…" />
      ) : rows.length === 0 ? (
        <BosDurum metin="Henüz Sözleşme Denetçisi kaydı yok." />
      ) : (
        <div className="overflow-x-auto">
          <p className="mb-2 text-[11px] text-slate-500">
            Son {rows.length} kayıt (toplam {total}).
          </p>
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-semibold">Onay zamanı</th>
                <th className="py-2 pr-3 font-semibold">Kullanıcı</th>
                <th className="py-2 pr-3 font-semibold">İşlem</th>
                <th className="py-2 pr-3 font-semibold">Düşülen</th>
                <th className="py-2 pr-3 font-semibold">Durum</th>
                <th className="py-2 pr-3 font-semibold">İndirme</th>
                <th className="py-2 font-semibold">Delil</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] align-top hover:bg-white/[0.02]">
                  <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">{ts(r.consentAt)}</td>
                  <td className="max-w-[190px] truncate py-2 pr-3 text-slate-300">{r.userEmail}</td>
                  <td className="py-2 pr-3 text-slate-200">{r.mode === "quick" ? "Hızlı tarama" : "Detaylı denetim"}</td>
                  <td className="py-2 pr-3 text-slate-300">
                    {r.units} <span className="text-slate-500">({CHARGE[r.chargeSource] ?? r.chargeSource})</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[r.status]?.cls ?? ""}`}>{STATUS[r.status]?.label ?? r.status}</span>
                    {r.refundedAt && <p className="mt-0.5 max-w-[200px] text-[10.5px] text-slate-500">{r.failReason}</p>}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {r.downloads.length === 0 ? (
                      <span className="text-slate-500">yok</span>
                    ) : (
                      r.downloads.map((d, i) => (
                        <div key={i}>
                          {KIND[d.kind] ?? d.kind} · {ts(d.at)}
                        </div>
                      ))
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void downloadAdminContractReviewProof(accessToken, r.id)}
                      className="rounded-lg border border-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                    >
                      İndir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Katlanir>
  );
}
