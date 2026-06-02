import { useState } from "react";
import { X } from "lucide-react";
import { getSaasApiBase } from "../../api/saasBase";

type Props = {
  open: boolean;
  onClose: () => void;
  currentExtraSeats: number;
  activeMembers: number;
  accessToken: string;
  onSuccess: () => void;
};

export function ShrinkTeamModal({
  open,
  onClose,
  currentExtraSeats,
  activeMembers,
  accessToken,
  onSuccess,
}: Props) {
  const basePeople = 5;
  const currentTotal = basePeople + currentExtraSeats;
  // minimum: aktif üye sayısından fazla olmalı
  const minExtraSeats = Math.max(0, activeMembers - basePeople);
  // maksimum azaltma: currentExtraSeats - minExtraSeats
  const maxRemovable = currentExtraSeats - minExtraSeats;

  const [removeSeats, setRemoveSeats] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const newExtraSeats = currentExtraSeats - removeSeats;
  const newTotal = basePeople + newExtraSeats;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getSaasApiBase()}/api/team/seats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        body: JSON.stringify({ extraSeats: newExtraSeats }),
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok) {
        setError(data.message ?? "Bir hata oluştu.");
        return;
      }
      setSuccessMsg(data.message ?? `Koltuk sayısı ${newTotal} olarak güncellendi.`);
      setTimeout(() => {
        setSuccessMsg(null);
        onSuccess();
        onClose();
      }, 3000);
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  if (maxRemovable <= 0) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f172a] p-6 shadow-2xl">
          <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm text-amber-300">
            Aktif {activeMembers} üyeniz var, dolayısıyla mevcut koltuk sayısını ({currentTotal}) azaltamazsınız. Önce bazı üyeleri ekipten çıkarın.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f172a] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500/70">
            EKİBİ KÜÇÜLT
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">Koltuk Azalt</h2>
          <p className="mt-1 text-sm text-slate-400">
            Gelecek fatura döneminden itibaren koltuk sayısı azaltılır. Mevcut üyelerin erişimi bu dönem sonuna kadar devam eder.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Kaldırılacak Koltuk</p>
              <p className="text-xs text-slate-500">En fazla {maxRemovable} koltuk azaltılabilir</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRemoveSeats((n) => Math.max(1, n - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-lg font-bold"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold text-white">{removeSeats}</span>
              <button
                type="button"
                onClick={() => setRemoveSeats((n) => Math.min(maxRemovable, n + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-lg font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Mevcut:</span>
              <span className="text-slate-300">{currentTotal} kişi</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-amber-400">− Kaldırılıyor:</span>
              <span className="font-bold text-amber-300">−{removeSeats} koltuk</span>
            </div>
            <div className="mt-2 border-t border-white/[0.06] pt-2 flex items-center justify-between text-sm">
              <span className="text-slate-300 font-medium">Yeni toplam:</span>
              <span className="font-black text-white">{newTotal} kişi</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {successMsg && (
          <p className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
            {successMsg}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/[0.1] bg-white/[0.05] py-3 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-3 text-sm font-bold text-white hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
          >
            {loading ? "İşleniyor…" : `${removeSeats} Koltuğu Kaldır`}
          </button>
        </div>
      </div>
    </div>
  );
}
