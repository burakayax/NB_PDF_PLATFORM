import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Sparkles, X, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { useSettings } from "../../hooks/useSettings";
import { fetchTopupPacks, topupGrant, type TopupPack } from "../../api/ai";

type Props = {
  language: Language;
  accessToken: string | null;
  /** Admin → test için kredi ekleyebilir (ödeme kapalıyken). */
  isAdmin?: boolean;
  /** Mevcut bonus kredi (gösterim). */
  bonus?: number;
  onClose: () => void;
  /** Kredi verildikten sonra (admin test) kotayı tazele. */
  onGranted?: () => void;
};

/** Ek AI kredisi (top-up) satın alma penceresi. Ödeme açılınca "Satın Al" aktif olur;
 * şimdilik "Yakında". Admin test için kredi ekleyebilir. */
export function TopUpModal({ language, accessToken, isAdmin, bonus, onClose, onGranted }: Props) {
  const tr = language === "tr";
  const { flags } = useSettings();
  const paymentsDisabled = flags?.featureFlags?.paymentsDisabled !== false;
  const [packs, setPacks] = useState<TopupPack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void fetchTopupPacks(accessToken).then(setPacks); }, [accessToken]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function adminAdd(p: TopupPack) {
    setBusy(p.id); setMsg(null);
    try {
      await topupGrant(p.id, accessToken);
      setMsg(tr ? `+${p.credits} kredi eklendi (test).` : `+${p.credits} credits added (test).`);
      onGranted?.();
    } catch { setMsg(tr ? "Eklenemedi." : "Failed."); }
    finally { setBusy(null); }
  }

  const price = (p: TopupPack) => (tr ? `${p.priceTRY.toLocaleString("tr-TR")} ₺` : `$${p.priceUSD}`);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0b1020] shadow-2xl">
        <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        <div className="border-b border-white/[0.06] bg-gradient-to-b from-fuchsia-500/[0.08] to-transparent px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/25 to-indigo-600/25 text-fuchsia-200"><Zap className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black text-white">{tr ? "Ek AI Kredisi" : "Extra AI Credits"}</h2>
              <p className="text-[12px] text-slate-400">{tr ? "Aylık hakkın bitince kullanılır, aylar arası kalıcı." : "Used when your monthly quota runs out; carries over."}</p>
            </div>
          </div>
          {typeof bonus === "number" && bonus > 0 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-300"><Check className="h-3.5 w-3.5" />{tr ? `Mevcut bonus: ${bonus} kredi` : `Current bonus: ${bonus} credits`}</p>
          )}
        </div>

        <div className="space-y-2.5 p-5">
          {packs.map((p) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${p.popular ? "border-fuchsia-400/40 bg-fuchsia-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
              <div>
                <p className="flex items-center gap-2 text-[15px] font-bold text-white">
                  {p.credits} {tr ? "AI kredisi" : "AI credits"}
                  {p.popular && <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold text-fuchsia-200">{tr ? "Popüler" : "Popular"}</span>}
                </p>
                <p className="text-[12px] text-slate-400">{price(p)}</p>
              </div>
              {paymentsDisabled ? (
                isAdmin ? (
                  <button type="button" onClick={() => void adminAdd(p)} disabled={busy === p.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-3.5 py-2 text-[13px] font-bold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50">
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{tr ? "Test için ekle" : "Add (test)"}
                  </button>
                ) : (
                  <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-bold text-slate-400">{tr ? "Yakında" : "Coming soon"}</span>
                )
              ) : (
                <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110">
                  {tr ? "Satın Al" : "Buy"}
                </button>
              )}
            </div>
          ))}
          {msg && <p className="text-center text-[13px] font-semibold text-emerald-300">{msg}</p>}
          {paymentsDisabled && !isAdmin && (
            <p className="pt-1 text-center text-[12px] text-slate-500">{tr ? "Ödeme sistemi çok yakında açılıyor." : "Payments are coming very soon."}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
