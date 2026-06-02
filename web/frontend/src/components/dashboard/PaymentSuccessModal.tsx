import { useEffect, useRef } from "react";
import type { Language } from "../../i18n/landing";

type PaymentSuccessModalProps = {
  open: boolean;
  planName: string | null;
  language: Language;
  onClose: () => void;
  addedSeats?: number;
};

export function PaymentSuccessModal({
  open,
  planName,
  language,
  onClose,
  addedSeats,
}: PaymentSuccessModalProps) {
  const tr = language === "tr";
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const planLabel = planName ?? (tr ? "Yeni Planınız" : "Your New Plan");
  const isSeatsMode = (addedSeats ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-success-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/[0.1] bg-gradient-to-b from-nb-bg-elevated/98 to-nb-bg/98 p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl">

        {/* Glow */}
        <div className="pointer-events-none absolute -top-12 left-1/2 h-36 w-72 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden />

        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/40 bg-gradient-to-br from-emerald-500/25 to-cyan-500/15 shadow-[0_0_40px_-8px_rgba(16,185,129,0.5)]">
          <svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Texts */}
        <div className="text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80">
            {tr ? "Ödeme Onaylandı" : "Payment Confirmed"}
          </p>
          <h2
            id="payment-success-title"
            className="mb-3 text-2xl font-black tracking-tight text-nb-text"
          >
            {isSeatsMode
              ? (tr ? `${addedSeats} Koltuk Eklendi 🎉` : `${addedSeats} Seats Added 🎉`)
              : (tr ? "Hoş Geldiniz! 🎉" : "Welcome Aboard! 🎉")}
          </h2>
          <p className="mb-1 text-base font-semibold text-nb-text/90">
            {isSeatsMode
              ? (tr
                  ? `${addedSeats} ekstra koltuk başarıyla hesabınıza eklendi.`
                  : `${addedSeats} extra seats have been added to your account.`)
              : (tr
                  ? `${planLabel} planına başarıyla geçtiniz.`
                  : `You've successfully upgraded to ${planLabel}.`)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-nb-muted">
            {isSeatsMode
              ? (tr
                  ? "Yeni koltuklar hemen aktif oldu. Ekip üyelerinizi davet edebilirsiniz."
                  : "New seats are immediately active. You can now invite more team members.")
              : (tr
                  ? "Hesabınız hemen aktif edildi. Tüm premium araçlara ve özelliklerinize erişebilirsiniz."
                  : "Your account has been activated immediately. You now have full access to all premium tools and features.")}
          </p>
        </div>

        {/* Feature highlights */}
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <ul className="space-y-2">
            {(isSeatsMode
              ? [
                  tr ? `${addedSeats} yeni koltuk hemen kullanılabilir` : `${addedSeats} new seats immediately available`,
                  tr ? "Ekip panosundan yeni üyeleri davet edin" : "Invite new members from the team dashboard",
                  tr ? "Koltuklar mevcut aboneliğinize eklendi" : "Seats added to your existing subscription",
                ]
              : [
                  tr ? "Tüm premium PDF araçlarına erişim" : "Access to all premium PDF tools",
                  tr ? "Öncelikli işlem kuyruğu" : "Priority processing queue",
                  tr ? "Büyük dosya desteği" : "Large file support",
                ]
            ).map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-nb-text/80">
                <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500/90 to-cyan-500/80 px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-[0_4px_24px_-6px_rgba(16,185,129,0.5)] transition hover:from-emerald-400 hover:to-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        >
          {isSeatsMode
            ? (tr ? "Ekip Panosuna Git" : "Go to Team Dashboard")
            : (tr ? "Araçları Keşfet" : "Explore Tools")}
        </button>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={tr ? "Kapat" : "Close"}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-nb-muted transition hover:bg-white/[0.07] hover:text-nb-text focus:outline-none"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
