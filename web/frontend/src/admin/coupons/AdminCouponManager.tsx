import { useState } from "react";
import { Calendar, Percent, Sparkles, Tag } from "lucide-react";
import { fetchAdminCoupons, patchAdminCoupon, postAdminCoupon, type AdminCouponRow } from "../../api/admin";
import { adminInputClass, AdminToggle } from "../mosaic/adminPrimitives";
import { AdminToolbar } from "../mosaic/AdminToolbar";
import { EmptyState } from "../mosaic/EmptyState";

type Props = {
  accessToken: string;
  items: AdminCouponRow[] | null;
  onUpdateList: (items: AdminCouponRow[]) => void;
  onError: (e: string | null) => void;
  busy: boolean;
  onBusy: (b: boolean) => void;
};

/**
 * Kupon ızgarası — Mosaic premium kart, kullanım ve oluşturma zamanı.
 * (Süre alanı veritabanında yoksa “süre yok” gösterilir.)
 */
export function AdminCouponManager({ accessToken, items, onUpdateList, onError, busy, onBusy }: Props) {
  const [q, setQ] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDisc, setNewDisc] = useState(10);
  const [newLimit, setNewLimit] = useState(1);

  const filtered =
    items?.filter(
      (c) =>
        q.trim() === "" ||
        c.code.toLowerCase().includes(q.trim().toLowerCase()),
    ) ?? null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <AdminToolbar
        searchPlaceholder="Kod ara…"
        searchValue={q}
        onSearchChange={setQ}
        actions={null}
      />

      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400/80" />
          <h2 className="text-sm font-semibold text-white">Yeni kupon</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Kod, oran, kullanıcı başına tavan</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[120px] flex-1">
            <span className="text-xs text-slate-500">Kod</span>
            <input
              className={adminInputClass}
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="w-24">
            <span className="text-xs text-slate-500">%</span>
            <input
              className={adminInputClass}
              type="number"
              min={1}
              max={100}
              value={newDisc}
              onChange={(e) => setNewDisc(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="w-32">
            <span className="text-xs text-slate-500">Limit / kişi</span>
            <input
              className={adminInputClass}
              type="number"
              min={1}
              value={newLimit}
              onChange={(e) => setNewLimit(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <button
            type="button"
            disabled={busy || newCode.trim().length < 2}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:opacity-40"
            onClick={() => {
              onBusy(true);
              onError(null);
              void postAdminCoupon(accessToken, { code: newCode.trim(), discountPercent: newDisc, usageLimitPerUser: newLimit })
                .then(() => {
                  setNewCode("");
                  return fetchAdminCoupons(accessToken);
                })
                .then((r) => onUpdateList(r.items))
                .catch((e: Error) => onError(e.message))
                .finally(() => onBusy(false));
            }}
          >
            {busy ? "Oluşturuluyor…" : "Oluştur"}
          </button>
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : filtered && filtered.length === 0 ? (
        <EmptyState
          title="Eşleşen kupon yok"
          description="Aramayı temizleyin veya yeni kupon tanımlayın."
          ctaLabel="Aramayı sıfırla"
          onCta={() => setQ("")}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered?.map((c) => {
            const usageHint = c.usageLimitPerUser > 0 ? Math.min(1, c.totalUses / (c.usageLimitPerUser * 20)) : 0;
            return (
              <li
                key={c.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-b from-slate-900/80 to-slate-950/50 shadow-lg ring-1 ring-white/[0.04] transition hover:border-cyan-500/25"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/25">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold tracking-wide text-cyan-200">{c.code}</p>
                      <p className="text-[10px] text-slate-500">Oluşturuldu · {formatDate(c.createdAt)}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.isActive
                        ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
                        : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30"
                    }`}
                  >
                    {c.isActive ? "Aktif" : "Kapalı"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-medium uppercase text-slate-500">İndirim</p>
                      <p className="flex items-baseline gap-0.5 text-3xl font-bold tabular-nums text-white">
                        {c.discountPercent}
                        <span className="text-lg text-slate-400">
                          <Percent className="inline h-4 w-4" />
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Toplam kullanım</p>
                      <p className="font-mono text-lg font-semibold text-slate-200">{c.totalUses}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                      <span>Kullanım yoğunluğu (göreli)</span>
                      <span className="font-mono">{c.totalUses} kullanım</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-cyan-400/50 transition-[width]"
                        style={{ width: `${Math.round(usageHint * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>Bitiş tarihi: veri yok (süresiz kupon)</span>
                  </div>
                  <div className="border-t border-slate-800/50 pt-3">
                    <AdminToggle
                      id={`c-${c.id}`}
                      label="Aktif"
                      checked={c.isActive}
                      onChange={(isActive) => {
                        onError(null);
                        void patchAdminCoupon(accessToken, c.id, { isActive })
                          .then((row) =>
                            onUpdateList((items ?? []).map((x) => (x.id === row.id ? { ...x, ...row, totalUses: x.totalUses } : x))),
                          )
                          .catch((e: Error) => onError(e.message));
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
