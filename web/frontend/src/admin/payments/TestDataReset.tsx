import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { resetAdminTestPayments, type TestResetCounts } from "../../api/admin";

/**
 * TEK SEFERLİK araç: canlıya geçmeden önce yönetici hesaplarının TEST ödeme/fatura kayıtlarını siler.
 * Önce "Önizle" ile ne silineceği sayılır; silmek için kutuya SIL yazılması gerekir. Geri alınamaz.
 * Sunucu, ödemeler AÇIKKEN bu işlemi reddeder ve yalnız yönetici hesaplarına dokunur.
 */
export function TestDataReset({ accessToken }: { accessToken: string }) {
  const [counts, setCounts] = useState<TestResetCounts | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function preview() {
    setBusy(true);
    setMsg(null);
    try {
      setCounts((await resetAdminTestPayments(accessToken)).counts);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Önizleme alınamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await resetAdminTestPayments(accessToken, "SIL");
      setCounts(r.counts);
      setDone(r.deleted);
      setWord("");
      if (r.deleted) window.setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  const empty = counts !== null && counts.payments === 0 && counts.couponUses === 0;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Trash2 className="h-4 w-4" /> Test verilerini temizle (canlıya geçmeden önce, tek seferlik)
      </h3>
      <p className="mt-1 text-[12px] text-slate-400">
        Yönetici hesaplarına ait test ödemelerini ve bağlı fatura kayıtlarını siler; KDV özeti ve gelir sayaçları sıfırlanır.
        Başka kullanıcıların ödemelerine, ziyaretçi kayıtlarına ve araç kullanım sayaçlarına dokunmaz.
        BirFatura ve PayTR panellerindeki kayıtlar silinmez. <b className="text-amber-300">Geri alınamaz</b> — önce veritabanı yedeği alın.
        Ödemeler AÇIKKEN çalışmaz.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void preview()}
          disabled={busy}
          className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50"
        >
          {busy && !counts ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Önizle (silmez)"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-sm text-amber-300">{msg}</p> : null}
      {counts ? (
        <div className="mt-3 space-y-2 text-sm text-slate-200">
          <ul className="list-disc pl-5 text-[13px]">
            <li>{counts.payments} ödeme kaydı</li>
            <li>{counts.invoices} fatura kaydı</li>
            <li>{counts.couponUses} kupon kullanımı</li>
            <li>
              Sıfırlanacak sayaçlar: ek AI kredisi ({counts.usersWithBonusCredits} hesap), CV geçişi ({counts.usersWithCvPass} hesap), ek koltuk ({counts.teamsWithExtraSeats} ekip)
            </li>
            <li className={counts.otherUsersPaymentsKept > 0 ? "text-amber-300" : ""}>
              Yönetici dışı kullanıcıların ödemesi (SİLİNMEZ): {counts.otherUsersPaymentsKept}
            </li>
          </ul>
          {done ? (
            <p className="text-emerald-400">Silindi. Sayfa yenileniyor…</p>
          ) : empty ? (
            <p className="text-slate-400">Silinecek test kaydı kalmadı.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Silmek için SIL yazın"
                aria-label="Onay metni"
                className="w-48 rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => void wipe()}
                disabled={busy || word !== "SIL"}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Siliniyor…" : "Test kayıtlarını KALICI sil"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
