import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Receipt, RefreshCw, RotateCcw, Search, Undo2, X, Zap } from "lucide-react";

import {
  fetchAdminPayments,
  fetchAdminPaytrStatus,
  postAdminInvoiceAction,
  refundAdminPayment,
  type AdminInvoiceAction,
  type AdminPaymentRow,
  type AdminPaymentsPage,
  type AdminPaytrStatus,
  type AdminRefundResult,
} from "../../api/admin";
import { ConfirmDialog, type ConfirmTone } from "./ConfirmDialog";
import { PaymentsSummary } from "./PaymentsSummary";
import { PaymentSwitches } from "./PaymentSwitches";

/**
 * Ödemeler ve iade — yönetim ekranı.
 *
 * Ödeme sayısı büyüdüğünde iade edilecek kişiyi bulabilmek için aranabilir/süzülebilir liste.
 * İade düğmesi sunucudaki PayTR iade akışına bağlıdır: PayTR iadesi başarısız olursa kayıt ve plan
 * DEĞİŞMEZ (bkz. admin.controller → adminIssueRefundController).
 */

const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";
const FIELD =
  "w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none [color-scheme:dark]";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400";
const PAGE_SIZE = 25;

const STATUS_LABEL: Record<string, string> = {
  completed: "Tamamlandı",
  refunded: "İade edildi",
  pending: "Bekliyor",
  failed: "Başarısız",
};
const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300",
  refunded: "bg-violet-500/15 text-violet-300",
  pending: "bg-amber-500/15 text-amber-300",
  failed: "bg-rose-500/15 text-rose-300",
};
const KIND_LABEL: Record<string, string> = {
  plan: "Abonelik",
  topup: "AI kredisi",
  cvpass: "CV Geçişi",
  seats: "Ek koltuk",
};
const PLAN_LABEL: Record<string, string> = {
  FREE: "Ücretsiz",
  STARTER: "Başlangıç",
  PLUS: "Plus",
  PRO: "Pro",
  BUSINESS: "Business",
};

type Filters = {
  q: string;
  status: string;
  plan: string;
  kind: string;
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
};
const EMPTY: Filters = { q: "", status: "all", plan: "all", kind: "all", from: "", to: "", minAmount: "", maxAmount: "" };

function money(n: number, currency: string): string {
  const sym = currency === "TRY" ? "₺" : currency === "USD" ? "$" : `${currency} `;
  return `${sym}${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PaymentsTab({ accessToken }: { accessToken: string }) {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminPaymentsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState<AdminPaymentRow | null>(null);
  const [statusRow, setStatusRow] = useState<AdminPaymentRow | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminPayments(accessToken, { ...applied, limit: String(PAGE_SIZE), offset: String(offset) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ödemeler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, applied, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = () => {
    setOffset(0);
    setApplied(draft);
  };
  const clear = () => {
    setDraft(EMPTY);
    setOffset(0);
    setApplied(EMPTY);
  };
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") apply();
  };

  const onRefunded = (r: AdminRefundResult, row: AdminPaymentRow) => {
    setTarget(null);
    setNotice({
      ok: r.providerRefunded,
      text: r.providerRefunded
        ? `${row.user.email} için iade PayTR üzerinden yapıldı; hesap planı Ücretsiz'e alındı.`
        : `${row.user.email} kaydı iade edildi ve plan Ücretsiz'e alındı, ANCAK para PayTR üzerinden otomatik iade EDİLMEDİ (bu ödeme PayTR kaydı değil). Parayı elle iade edin.`,
    });
    void load();
  };

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Ödemeler ve iade</h1>
        <p className="mt-0.5 text-[12px] text-slate-400">
          Kişiyi e-posta, ad, tarih ya da tutara göre bulun; satırdaki “İade et” ile iadeyi başlatın.
        </p>
      </div>

      <PaymentSwitches accessToken={accessToken} />

      <PaymentsSummary accessToken={accessToken} />

      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] ${
            notice.ok ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-amber-400/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filtreler */}
      <div className={`${CARD} p-4`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={LABEL}>Ara (e-posta, ad, sipariş no, fatura)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input className={`${FIELD} pl-9`} value={draft.q} onChange={set("q")} onKeyDown={onEnter} placeholder="ornek@mail.com veya Ayşe Yılmaz" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Durum</label>
            <select className={FIELD} value={draft.status} onChange={set("status")}>
              <option value="all" className="bg-slate-900">Hepsi</option>
              <option value="completed" className="bg-slate-900">Tamamlandı</option>
              <option value="refunded" className="bg-slate-900">İade edildi</option>
              <option value="pending" className="bg-slate-900">Bekliyor</option>
              <option value="failed" className="bg-slate-900">Başarısız</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Plan</label>
            <select className={FIELD} value={draft.plan} onChange={set("plan")}>
              <option value="all" className="bg-slate-900">Hepsi</option>
              {Object.entries(PLAN_LABEL).filter(([k]) => k !== "FREE").map(([k, v]) => (
                <option key={k} value={k} className="bg-slate-900">{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tür</label>
            <select className={FIELD} value={draft.kind} onChange={set("kind")}>
              <option value="all" className="bg-slate-900">Hepsi</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k} className="bg-slate-900">{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tarih (başlangıç)</label>
            <input type="date" className={FIELD} value={draft.from} onChange={set("from")} onKeyDown={onEnter} />
          </div>
          <div>
            <label className={LABEL}>Tarih (bitiş)</label>
            <input type="date" className={FIELD} value={draft.to} onChange={set("to")} onKeyDown={onEnter} />
          </div>
          <div>
            <label className={LABEL}>En az tutar (₺)</label>
            <input type="number" min="0" className={FIELD} value={draft.minAmount} onChange={set("minAmount")} onKeyDown={onEnter} />
          </div>
          <div>
            <label className={LABEL}>En çok tutar (₺)</label>
            <input type="number" min="0" className={FIELD} value={draft.maxAmount} onChange={set("maxAmount")} onKeyDown={onEnter} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={apply} className="rounded-lg bg-cyan-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-cyan-500">
            Filtrele
          </button>
          <button type="button" onClick={clear} className="rounded-lg border border-white/[0.12] px-4 py-2 text-[13px] font-semibold text-slate-200 hover:bg-white/[0.05]">
            Temizle
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 py-2 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
          </button>
        </div>
      </div>

      {/* Özet */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`${CARD} p-4`}>
            <p className={LABEL}>Süzülen kayıt</p>
            <p className="text-2xl font-bold text-white">{data.total}</p>
          </div>
          <div className={`${CARD} p-4`}>
            <p className={LABEL}>Tamamlanan</p>
            <p className="text-2xl font-bold text-emerald-300">{money(data.totals.completedAmount, "TRY")}</p>
            <p className="text-[11px] text-slate-500">{data.totals.completedCount} ödeme</p>
          </div>
          <div className={`${CARD} p-4`}>
            <p className={LABEL}>İade edilen</p>
            <p className="text-2xl font-bold text-violet-300">{money(data.totals.refundedAmount, "TRY")}</p>
            <p className="text-[11px] text-slate-500">{data.totals.refundedCount} ödeme</p>
          </div>
        </div>
      )}

      {data?.truncated && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
          Çok sayıda kayıt var; yalnızca en yeni 5000 kayıt tarandı. Eski bir ödemeyi bulmak için tarih aralığı daraltın.
        </p>
      )}
      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">{error}</p>}

      {/* Tablo */}
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.08em] text-slate-400">
            <tr>
              <th className="px-4 py-3">İşlem tarihi</th>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Fatura</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  Bu filtreyle eşleşen ödeme yok.
                </td>
              </tr>
            )}
            {data?.rows.map((r) => (
              <tr key={r.conversationId} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                  {dateTime(r.completedAt ?? r.createdAt)}
                  {r.refundedAt && <div className="text-[11px] text-violet-300">İade: {dateTime(r.refundedAt)}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-100">{r.user.name || "—"}</div>
                  <div className="text-[11.5px] text-slate-400">{r.user.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {KIND_LABEL[r.kind] ?? r.kind}
                  {r.kind === "plan" && (
                    <div className="text-[11.5px] text-slate-400">
                      {PLAN_LABEL[r.plan] ?? r.plan} · {r.billingCycle === "YEARLY" ? "yıllık" : "aylık"}
                    </div>
                  )}
                  {r.discountPercent ? <div className="text-[11px] text-amber-300">%{r.discountPercent} indirim</div> : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-100">
                  {money(r.amount, r.currency)}
                  {r.kdvAmount && <div className="text-[11px] font-normal text-slate-500">KDV {r.kdvAmount}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[r.status] ?? "bg-white/10 text-slate-300"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  <div className="mt-1 text-[10.5px] text-slate-500">{r.provider === "paytr" ? "PayTR" : "Diğer sağlayıcı"}</div>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  <InvoiceCell accessToken={accessToken} row={r} onChanged={() => void load()} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {r.provider === "paytr" && (
                      <button
                        type="button"
                        onClick={() => setStatusRow(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] px-3 py-1.5 text-[12px] font-semibold text-slate-100 hover:bg-white/[0.06]"
                      >
                        PayTR durumunu sorgula
                      </button>
                    )}
                    {r.refundable ? (
                      <button
                        type="button"
                        onClick={() => setTarget(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 px-3 py-1.5 text-[12px] font-semibold text-rose-200 hover:bg-rose-500/10"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> İade et
                      </button>
                    ) : r.provider !== "paytr" ? (
                      <span className="text-[11px] text-slate-600">—</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sayfalama */}
      {data && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-[12px] text-slate-400">
          <span>
            Sayfa {page} / {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-lg border border-white/[0.12] px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-40"
            >
              Önceki
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded-lg border border-white/[0.12] px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      {statusRow && <StatusDialog accessToken={accessToken} row={statusRow} onClose={() => setStatusRow(null)} />}

      {target && (
        <RefundDialog
          accessToken={accessToken}
          row={target}
          windowDays={data?.refundWindowDays ?? 7}
          onClose={() => setTarget(null)}
          onDone={(r) => onRefunded(r, target)}
        />
      )}
    </div>
  );
}

const INVOICE_ACTION_LABEL: Record<AdminInvoiceAction, string> = {
  AUTO: "Otomatiğe döndür",
  VAT: "KDV'li kes (vadesinde)",
  CANCEL: "Fatura kesme",
  NOW: "Şimdi kes",
  NOW_VAT: "Şimdi KDV'li kes",
};

function cardNote(country: string | null | undefined): string | null {
  if (!country) return null;
  if (country === "??") return "Kart: belirlenemedi";
  return country === "TR" || country === "TURKEY" ? "Kart: yurt içi" : `Kart: yurt dışı (${country})`;
}

/** Fatura sütunu: ertelenmiş fatura durumu ve yönetici kararı (KDV'li kes / kesme / şimdi kes). */
function InvoiceCell({ accessToken, row, onChanged }: { accessToken: string; row: AdminPaymentRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<AdminInvoiceAction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState<AdminInvoiceAction | null>(null);

  const act = async (a: AdminInvoiceAction) => {
    setBusy(a);
    setErr(null);
    try {
      const r = await postAdminInvoiceAction(accessToken, row.conversationId, a);
      if (r.outcome === "paused") setErr("Fatura kesme DURDURULMUŞ: önce üstteki 'Fatura kesme' düğmesini açın.");
      else if (r.outcome === "failed") setErr("Fatura kesilemedi (BirFatura hatası); sonraki saatlik turda yeniden denenir.");
      else onChanged();
      if (r.outcome === "paused" || r.outcome === "failed") onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      setBusy(null);
      setAsking(null);
    }
  };

  const btnBase =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50";
  const btnNeutral = `${btnBase} border-white/[0.12] bg-white/[0.04] text-slate-100 hover:bg-white/[0.1]`;
  const btnPrimary = `${btnBase} border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20`;
  const btnDanger = `${btnBase} border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20`;
  const card = cardNote(row.cardCountry);

  if (row.invoiceNo) return <span>{row.invoiceNo}</span>;
  if (row.status !== "completed") {
    return <span>{row.invoiceStatus === "skipped_refunded" ? "İade: fatura kesilmedi" : row.invoiceStatus ?? "—"}</span>;
  }
  if (row.invoiceStatus === "issued") return <span>Kesildi</span>;
  if (row.invoiceStatus === "processing") return <span>Kesiliyor…</span>;

  const cancelled = row.invoiceStatus === "cancelled";
  const due = row.invoiceDueAt ? dateTime(row.invoiceDueAt) : null;
  const headline = cancelled
    ? "Fatura kesilmeyecek (karar verildi)"
    : row.invoiceStatus === "scheduled"
      ? `${row.invoiceAction === "VAT" ? "KDV'li" : "Otomatik"} kesilecek: ${due ?? "—"}`
      : "Fatura yok";

  return (
    <div className="min-w-[210px] space-y-1.5">
      <div className="text-[11.5px] text-slate-300">{headline}</div>
      {card && <div className="text-[11px] text-slate-500">{card}</div>}
      <div className="flex flex-wrap gap-1.5">
        {!cancelled && row.invoiceAction !== "VAT" && (
          <button type="button" className={btnNeutral} disabled={busy !== null} onClick={() => setAsking("VAT")}>
            <Receipt className="h-3 w-3" aria-hidden />{INVOICE_ACTION_LABEL.VAT}
          </button>
        )}
        {!cancelled && row.invoiceAction === "VAT" && (
          <button type="button" className={btnNeutral} disabled={busy !== null} onClick={() => setAsking("AUTO")}>
            <RotateCcw className="h-3 w-3" aria-hidden />{INVOICE_ACTION_LABEL.AUTO}
          </button>
        )}
        <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => setAsking("NOW")}>
          <Zap className="h-3 w-3" aria-hidden />{INVOICE_ACTION_LABEL.NOW}
        </button>
        <button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => setAsking("NOW_VAT")}>
          <Zap className="h-3 w-3" aria-hidden />{INVOICE_ACTION_LABEL.NOW_VAT}
        </button>
        {cancelled ? (
          <button type="button" className={btnNeutral} disabled={busy !== null} onClick={() => setAsking("AUTO")}>
            <RotateCcw className="h-3 w-3" aria-hidden />Yeniden planla
          </button>
        ) : (
          <button type="button" className={btnDanger} disabled={busy !== null} onClick={() => setAsking("CANCEL")}>
            <Ban className="h-3 w-3" aria-hidden />{INVOICE_ACTION_LABEL.CANCEL}
          </button>
        )}
      </div>
      {err && <div className="text-[11px] text-rose-200">{err}</div>}
      {asking && (
        <ConfirmDialog
          tone={INVOICE_CONFIRM[asking].tone}
          title={INVOICE_CONFIRM[asking].title}
          subtitle={`${row.user.email} · sipariş ${row.conversationId}`}
          points={INVOICE_CONFIRM[asking].points}
          confirmLabel={INVOICE_CONFIRM[asking].confirmLabel}
          busy={busy !== null}
          onCancel={() => setAsking(null)}
          onConfirm={() => void act(asking)}
        />
      )}
    </div>
  );
}

/** Fatura karar düğmelerinin ortada açılan ikinci onay metinleri. */
const INVOICE_CONFIRM: Record<AdminInvoiceAction, { tone: ConfirmTone; title: string; confirmLabel: string; points: string[] }> = {
  AUTO: {
    tone: "info",
    title: "Otomatiğe döndürülsün mü?",
    confirmLabel: "Evet, otomatiğe döndür",
    points: [
      "Daha önce verdiğiniz karar kaldırılır.",
      "Fatura planlanan günde, kart ve adrese bakılarak sistem tarafından otomatik kesilir.",
    ],
  },
  VAT: {
    tone: "info",
    title: "KDV'li kesilsin mi?",
    confirmLabel: "Evet, KDV'li kes",
    points: [
      "Fatura yine planlanan günde (ödemeden yaklaşık 6,5 gün sonra) kesilir, ama KDV'li olur.",
      "Müşterinin Türkiye'den olduğundan eminseniz doğru seçimdir.",
      "Bu sürede iade olursa fatura hiç kesilmez.",
    ],
  },
  NOW: {
    tone: "warning",
    title: "Fatura şimdi kesilsin mi?",
    confirmLabel: "Evet, şimdi kes",
    points: [
      "Fatura hemen GİB'e iletilir; geri alınamaz.",
      "KDV durumunu sistem kart ve adrese bakarak kendisi belirler.",
      "7 günlük iade süresi dolmadan kesilirse, müşteri iade ederse iptal ya da iade faturası gerekir.",
    ],
  },
  NOW_VAT: {
    tone: "warning",
    title: "Fatura şimdi ve KDV'li kesilsin mi?",
    confirmLabel: "Evet, şimdi KDV'li kes",
    points: [
      "Fatura hemen GİB'e iletilir; geri alınamaz.",
      "KDV mutlaka uygulanır (yurt içi müşteri gibi).",
      "7 günlük iade süresi dolmadan kesilirse, müşteri iade ederse iptal ya da iade faturası gerekir.",
    ],
  },
  CANCEL: {
    tone: "danger",
    title: "Bu satışa fatura kesilmesin mi?",
    confirmLabel: "Evet, fatura kesme",
    points: [
      "Satış geçerliyse fatura kesmemek yasal risktir (fatura 7 gün içinde kesilmek zorundadır).",
      "Yalnızca satış gerçekten iptal ya da iade edildiyse kullanın.",
      "Sonradan vazgeçerseniz 'Yeniden planla' ile geri alabilirsiniz.",
    ],
  },
};

const STATUS_FIELD_LABEL: Record<string, string> = {
  payment_amount: "Sipariş tutarı",
  payment_total: "Müşterinin ödediği",
  payment_date: "İşlem tarihi",
  currency: "Para birimi",
  net_tutar: "Kesinti sonrası net",
  kesinti_tutari: "Kesinti",
  taksit: "Taksit",
  odeme_tipi: "Ödeme tipi",
  kart_marka: "Kart markası",
  kart_bin: "Kartın ilk 6 hanesi (BIN)",
};

/** PayTR Durum Sorgu cevabını yorumsuz, olduğu gibi gösterir (tahmin yok). */
function PaytrStatusView({ status }: { status: AdminPaytrStatus }) {
  if (!status.ok) {
    return (
      <p className="mt-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[12px] leading-relaxed text-amber-100">
        PayTR cevabı: <strong>{status.errNo}</strong> — {status.errMsg}
      </p>
    );
  }
  const f = status.fields;
  const returns = Array.isArray(f.returns) ? f.returns : [];
  return (
    <div className="mt-2 rounded-md border border-emerald-400/25 bg-emerald-500/[0.07] px-2.5 py-2 text-[12px] text-slate-100">
      <p className="font-semibold text-emerald-200">PayTR bu siparişi buluyor.</p>
      <dl className="mt-1.5 space-y-1">
        <div className="flex justify-between gap-3"><dt className="text-slate-400">Test işlemi mi?</dt><dd>{status.testMode ? "Evet (test)" : "Hayır (canlı)"}</dd></div>
        {Object.entries(STATUS_FIELD_LABEL).map(([k, label]) =>
          f[k] !== undefined && f[k] !== "" ? (
            <div key={k} className="flex justify-between gap-3"><dt className="text-slate-400">{label}</dt><dd>{String(f[k])}</dd></div>
          ) : null,
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-slate-400">PayTR'deki iadeler</dt>
          <dd>{returns.length === 0 ? "Yok" : `${returns.length} kayıt: ${JSON.stringify(returns)}`}</dd>
        </div>
      </dl>
      <div className="mt-2 border-t border-white/[0.08] pt-2">
        <p className="font-semibold text-slate-200">Kayıtlı kart kanıtı (şifreli saklanır, burada çözülür)</p>
        {status.savedEvidence ? (
          <dl className="mt-1 space-y-1">
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Kartın ilk 6 hanesi</dt><dd>{status.savedEvidence.bin ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-400">Bulunan ülke</dt><dd>{status.savedEvidence.country === "??" ? "belirlenemedi" : status.savedEvidence.country ?? "—"}</dd></div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-400">Karar</dt>
              <dd>{status.savedEvidence.verdict === "FOREIGN" ? "Yurt dışı kart" : status.savedEvidence.verdict === "TR" ? "Yurt içi kart → KDV'li" : "Belirlenemedi → KDV'li"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-1 text-slate-400">Bu ödeme için kart kanıtı kaydedilmemiş (yalnız yabancı para birimli ödemelerde ve istisna açıkken alınır).</p>
        )}
      </div>
    </div>
  );
}

function StatusDialog({ accessToken, row, onClose }: { accessToken: string; row: AdminPaymentRow; onClose: () => void }) {
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState<AdminPaytrStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetchAdminPaytrStatus(accessToken, row.conversationId);
        if (alive) setStatus(r);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "PayTR durumu sorgulanamadı.");
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [accessToken, row.conversationId]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="PayTR durumu">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-base font-bold text-white">PayTR durumu</h2>
        <p className="mt-1 text-[12px] text-slate-400">{row.user.email} · sipariş {row.conversationId} (para hareketi yapmaz, yalnız sorgular)</p>
        {busy && <p className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Sorgulanıyor…</p>}
        {err && <p className="mt-3 text-[12px] text-rose-200">{err}</p>}
        {status && <PaytrStatusView status={status} />}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-[12.5px] font-semibold text-slate-100 hover:bg-white/[0.06]">Kapat</button>
        </div>
      </div>
    </div>
  );
}

function RefundDialog({
  accessToken,
  row,
  windowDays,
  onClose,
  onDone,
}: {
  accessToken: string;
  row: AdminPaymentRow;
  windowDays: number;
  onClose: () => void;
  onDone: (r: AdminRefundResult) => void;
}) {
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const outsideWindow = !row.withinRefundWindow;
  const canSubmit = reason.trim().length > 0 && (!outsideWindow || force) && !busy;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await refundAdminPayment(accessToken, row.conversationId, reason.trim(), outsideWindow && force));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İade yapılamadı.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="İade onayı">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-base font-bold text-white">İadeyi onayla</h2>
        <dl className="mt-3 space-y-1.5 rounded-xl border border-white/[0.08] bg-black/25 p-3 text-[12.5px]">
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Kullanıcı</dt><dd className="text-right text-slate-100">{row.user.name || "—"}<br />{row.user.email}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Ürün</dt><dd className="text-slate-100">{KIND_LABEL[row.kind]} · {PLAN_LABEL[row.plan] ?? row.plan}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">İşlem tarihi</dt><dd className="text-slate-100">{dateTime(row.completedAt ?? row.createdAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">İade tutarı</dt><dd className="font-bold text-rose-200">{money(row.amount, row.currency)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Sağlayıcı</dt><dd className="text-slate-100">{row.provider === "paytr" ? "PayTR (otomatik iade)" : "PayTR dışı (para elle iade edilir)"}</dd></div>
        </dl>

        <p className="mt-3 text-[12px] leading-relaxed text-amber-200">
          Bu işlem geri alınamaz. {row.provider === "paytr" ? "Tutar müşterinin kartına PayTR üzerinden iade edilir. " : ""}
          Müşterinin planı Ücretsiz'e düşer.
        </p>

        {outsideWindow && (
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-[12px] text-amber-100">
            <input type="checkbox" className="mt-0.5" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span>Ödeme {windowDays} günlük iade süresini aşmış. Süreyi bilerek aşarak iade etmek istiyorum.</span>
          </label>
        )}

        <label className={`${LABEL} mt-3`} htmlFor="refund-reason">İade nedeni (zorunlu)</label>
        <textarea
          id="refund-reason"
          rows={2}
          maxLength={500}
          className={FIELD}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Örn: müşteri talebi, 7 gün içinde cayma"
        />

        {err && <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-white/[0.12] px-4 py-2 text-[13px] font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-50">
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-rose-500 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} İadeyi yap
          </button>
        </div>
      </div>
    </div>
  );
}
