import { useEffect, useState } from "react";
import { resendVerificationEmail } from "../../api/auth";
import type { Language } from "../../i18n/landing";

const COOLDOWN_SEC = 60;

/**
 * "Doğrulama e-postasını tekrar gönder". Sunucu tarafında zaten sınırlar var (60 sn bekleme, günde 5, IP başına 5/10 dk);
 * burada ek olarak düğme 60 sn kilitlenir. Yanıt hesabın var olup olmadığını belli etmez, mesaj da buna göre genel.
 */
export function ResendVerification({ language, defaultEmail }: { language: Language; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const tr = language === "tr";

  useEffect(() => {
    if (defaultEmail && !email) setEmail(defaultEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail]);

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const send = async () => {
    const value = email.trim().toLowerCase();
    if (!value || !value.includes("@")) {
      setNote({ tone: "err", text: tr ? "Lütfen e-posta adresinizi yazın." : "Please enter your email address." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await resendVerificationEmail(value);
      setLeft(COOLDOWN_SEC);
      setNote({
        tone: "ok",
        text: tr
          ? "Bu adres onay bekleyen bir hesaba aitse yeni doğrulama e-postası gönderildi. Gelen kutunuzu ve gereksiz (spam) klasörünü kontrol edin."
          : "If this address belongs to an account awaiting verification, a new email was sent. Check your inbox and spam folder.",
      });
    } catch (e) {
      setLeft(COOLDOWN_SEC);
      setNote({
        tone: "err",
        text: e instanceof Error && e.message ? e.message : tr ? "Gönderilemedi. Lütfen biraz sonra tekrar deneyin." : "Could not send. Please try again shortly.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm">
      <p className="mb-2 text-xs text-slate-300">
        {tr ? "Doğrulama e-postası gelmediyse yeniden isteyebilirsiniz." : "Didn't get the verification email? You can request it again."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder={tr ? "E-posta adresiniz" : "Your email address"}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="button"
          disabled={busy || left > 0}
          onClick={() => void send()}
          className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-400/30 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {left > 0
            ? tr
              ? `Tekrar gönder (${left} sn)`
              : `Resend (${left}s)`
            : tr
              ? "Doğrulama e-postasını tekrar gönder"
              : "Resend verification email"}
        </button>
      </div>
      {note ? <p className={`mt-2 text-xs ${note.tone === "ok" ? "text-emerald-200" : "text-rose-300"}`}>{note.text}</p> : null}
    </div>
  );
}
