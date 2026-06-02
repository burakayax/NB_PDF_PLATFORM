import { useState } from "react";
import { X } from "lucide-react";
import { useCheckoutCurrency } from "../../contexts/CheckoutCurrencyContext";

const SEAT_PRICE_TRY = 199;  // ₺/kişi/ay (net, KDV hariç)
const SEAT_PRICE_USD = 5.99; // $/kişi/ay
const YEARLY_DISCOUNT = 0.83; // %17 tasarruf

type Props = {
  open: boolean;
  onClose: () => void;
  currentExtraSeats: number;
  onPurchaseIntent: (billingCycle: "MONTHLY" | "YEARLY", extraSeats: number) => void;
};

export function GrowTeamModal({ open, onClose, currentExtraSeats, onPurchaseIntent }: Props) {
  const { currency } = useCheckoutCurrency();
  const effectiveCurrency = currency === "TRY" ? "TRY" : "USD";
  const unitPrice = effectiveCurrency === "TRY" ? SEAT_PRICE_TRY : SEAT_PRICE_USD;
  const sym = effectiveCurrency === "TRY" ? "₺" : "$";
  const fmt = (n: number) =>
    effectiveCurrency === "TRY"
      ? `₺${Math.round(n).toLocaleString("tr-TR")}`
      : `$${n.toFixed(2)}`;

  const [newSeats, setNewSeats] = useState(1);

  const basePeople = 5;
  const currentTotal = basePeople + currentExtraSeats;
  const newTotal = currentTotal + newSeats;
  const monthlyTotal = newSeats * unitPrice;
  const yearlyTotal = Math.round(monthlyTotal * 12 * YEARLY_DISCOUNT * 100) / 100;
  const yearlyPerMonth = yearlyTotal / 12;

  if (!open) return null;

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
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-500/70">
            EKİBİ BÜYÜT
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">Ekstra Koltuk Ekle</h2>
          <p className="mt-1 text-sm text-slate-400">
            Şu an {currentTotal} kişilik ekibinize yeni koltuk ekleyin. {sym}{unitPrice}/kişi/ay.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Eklenecek Koltuk</p>
              <p className="text-xs text-slate-500">her koltuk {fmt(unitPrice)}/ay (KDV hariç)</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNewSeats((n) => Math.max(1, n - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 text-lg font-bold"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold text-white">{newSeats}</span>
              <button
                type="button"
                onClick={() => setNewSeats((n) => Math.min(95 - currentExtraSeats, n + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-lg font-bold"
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
              <span className="text-emerald-400">+ Ekleniyor:</span>
              <span className="font-bold text-emerald-300">+{newSeats} koltuk</span>
            </div>
            <div className="mt-2 border-t border-white/[0.06] pt-2 flex items-center justify-between text-sm">
              <span className="text-slate-300 font-medium">Yeni toplam:</span>
              <span className="font-black text-white">{newTotal} kişi</span>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Aylık</p>
            <p className="text-2xl font-black text-white">{fmt(monthlyTotal)}</p>
            <p className="text-xs text-slate-500 mt-0.5">/ay (KDV hariç)</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Yıllık</p>
            <p className="text-2xl font-black text-white">{fmt(yearlyPerMonth)}</p>
            <p className="text-xs text-emerald-500 mt-0.5">{fmt(yearlyTotal)}/yıl · %17 tasarruf</p>
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-500 text-center">
          Ödeme onayında KDV dökümü, promosyon kodu ve yasal onay adımları gösterilecektir.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { onPurchaseIntent("MONTHLY", newSeats); }}
            className="rounded-xl border border-white/[0.1] bg-white/[0.05] py-3 text-sm font-semibold text-white hover:bg-white/[0.08]"
          >
            Aylık Öde
          </button>
          <button
            type="button"
            onClick={() => { onPurchaseIntent("YEARLY", newSeats); }}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white hover:from-emerald-500 hover:to-teal-500"
          >
            Yıllık Öde
          </button>
        </div>
      </div>
    </div>
  );
}
