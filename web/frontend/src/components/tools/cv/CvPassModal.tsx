import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, Loader2, Lock, X } from "lucide-react";
import type { Language } from "../../../i18n/landing";
import { useSettings } from "../../../hooks/useSettings";
import { createCvPassCheckout, fetchCvPasses, type CvPass } from "../../../api/payment";
import { launchIyzicoCheckout } from "../../../lib/iyzicoLaunch";

type Props = {
  language: Language;
  accessToken: string | null;
  onClose: () => void;
  /** Aylık/yıllık abonelik seçeneği için (Pro tüm şablonları süresiz açar). */
  onUpgrade: () => void;
};

export const passLabel = (hours: number, tr: boolean): string =>
  hours >= 168 ? (tr ? "7 gün" : "7 days") : hours >= 24 && hours % 24 === 0 ? (tr ? `${hours / 24} gün` : `${hours / 24} day${hours > 24 ? "s" : ""}`) : tr ? `${hours} saat` : `${hours} hours`;

/** Kalan süreyi kısa yazar: "3 gün", "5 saat", "40 dk". */
export function remainingLabel(untilIso: string, tr: boolean, now: number = Date.now()): string {
  const ms = Date.parse(untilIso) - now;
  if (!(ms > 0)) return tr ? "bitti" : "ended";
  const h = ms / 3_600_000;
  if (h >= 48) return tr ? `${Math.floor(h / 24)} gün` : `${Math.floor(h / 24)} days`;
  if (h >= 1) return tr ? `${Math.floor(h)} saat` : `${Math.floor(h)} h`;
  return tr ? `${Math.max(1, Math.round(ms / 60_000))} dk` : `${Math.max(1, Math.round(ms / 60_000))} min`;
}

/**
 * CV GEÇİŞİ — tek seferlik, yenilenmeyen. Tüm CV şablonları süre boyunca açılır; süre bitince
 * kilitlenir (taslak cihazda kalır). Ödemeler kapalıyken "Yakında" gösterilir.
 */
export function CvPassModal({ language, accessToken, onClose, onUpgrade }: Props) {
  const tr = language === "tr";
  const { flags } = useSettings();
  const paymentsDisabled = flags?.featureFlags?.paymentsDisabled !== false;
  const [passes, setPasses] = useState<CvPass[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void fetchCvPasses().then(setPasses); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function buy(p: CvPass) {
    if (!accessToken) return;
    setBusy(p.id);
    setMsg(null);
    try {
      launchIyzicoCheckout(await createCvPassCheckout(accessToken, p.id));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : tr ? "Ödeme başlatılamadı." : "Couldn't start payment.");
      setBusy(null);
    }
  }

  const price = (p: CvPass) => (tr ? `${p.priceTRY.toLocaleString("tr-TR")} ₺` : `$${p.priceUSD}`);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={tr ? "CV Geçişi" : "CV pass"} className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0b1020] shadow-2xl">
        <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        <div className="border-b border-white/[0.06] bg-gradient-to-b from-sky-500/[0.1] to-transparent px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-200"><Clock className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black text-white">{tr ? "CV Geçişi" : "CV pass"}</h2>
              <p className="text-[12px] text-slate-400">{tr ? "Abonelik değil: tek ödeme, yenileme yok. Süre boyunca tüm şablonlar açılır." : "Not a subscription: one payment, no renewal. Every template is unlocked for the period."}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 p-5">
          {passes.map((p) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${p.popular ? "border-sky-400/40 bg-sky-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
              <div>
                <p className="flex items-center gap-2 text-[15px] font-bold text-white">
                  {passLabel(p.hours, tr)}
                  {p.popular ? <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-200">{tr ? "Avantajlı" : "Best value"}</span> : null}
                </p>
                <p className="text-[12px] text-slate-400">{price(p)} · {tr ? "KDV dahil" : "VAT incl. where applicable"}</p>
              </div>
              {paymentsDisabled ? (
                <span className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-bold text-slate-400">{tr ? "Yakında" : "Coming soon"}</span>
              ) : (
                <button type="button" onClick={() => void buy(p)} disabled={busy === p.id} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{tr ? "Satın Al" : "Buy"}
                </button>
              )}
            </div>
          ))}
          {!passes.length ? <p className="py-4 text-center text-[13px] text-slate-400">{tr ? "Seçenekler yükleniyor…" : "Loading options…"}</p> : null}
          {msg ? <p className="text-center text-[13px] font-semibold text-red-300">{msg}</p> : null}
          {paymentsDisabled ? <p className="pt-1 text-center text-[12px] text-slate-400">{tr ? "Ödeme sistemi çok yakında açılıyor." : "Payments are coming very soon."}</p> : null}
          <ul className="space-y-1 pt-2 text-[12px] text-slate-400">
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{tr ? "Süre bitince şablonlar yeniden kilitlenir; taslağınız cihazınızda kalır." : "When time runs out the templates lock again; your draft stays on your device."}</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{tr ? "İndirdiğiniz PDF'ler sizindir, süre bitince de geçerli kalır." : "PDFs you downloaded stay yours after the pass ends."}</li>
            <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />{tr ? "Yeniden satın alırsanız süre kalan sürenin üstüne eklenir." : "If you buy again, the time is added on top of what remains."}</li>
          </ul>
          <button type="button" onClick={() => { onClose(); onUpgrade(); }} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-semibold text-slate-200 hover:bg-white/[0.08]">
            <Lock className="h-3.5 w-3.5" />{tr ? "Sürekli kullanacaksanız Pro daha uygun: tüm şablonlar süresiz açık" : "Using it regularly? Pro unlocks every template permanently"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
