import { useEffect, useState } from "react";
import { completeGoogleSignup } from "../../api/auth";

/**
 * GOOGLE İLE YENİ HESAP — onay ekranı. Google'dan dönen kişi sistemde yoksa hesap burada, zorunlu onaylar
 * işaretlenince açılır. Jeton adres çubuğundan hemen silinir. Başarıda /login-success ile oturum kurulur.
 */
export function GoogleSignupPage() {
  const [token, setToken] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [notice, setNotice] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tr = (document.documentElement.lang || "tr").startsWith("tr");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token")?.trim() || null;
    if (t && typeof window.history?.replaceState === "function") {
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        /* adres temizlenemezse akış bozulmasın */
      }
    }
    setToken(t);
  }, []);

  const ok = terms && notice;

  async function submit() {
    if (!token || !ok || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await completeGoogleSignup({ token, termsAccepted: true, privacyNoticeRead: true, marketingConsent: marketing });
      window.location.replace(`/login-success?token=${encodeURIComponent(r.accessToken)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr ? "Hesap açılamadı. Lütfen Google ile tekrar deneyin." : "Could not create the account. Please try Google sign-in again.");
      setBusy(false);
    }
  }

  const box = "mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/10 accent-cyan-500";
  const link = "underline underline-offset-2 hover:text-white";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#05080f] px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">PDF Platform</p>
        <h1 className="mt-2 text-xl font-semibold text-white">{tr ? "Hesabınızı tamamlayın" : "Complete your account"}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
          {tr
            ? "Google hesabınızla yeni bir PDF Platform hesabı açmak üzeresiniz. Devam etmek için aşağıdaki onayları işaretleyin."
            : "You are about to create a new PDF Platform account with your Google account. Please confirm the items below to continue."}
        </p>

        {!token ? (
          <p className="mt-5 text-[13px] text-rose-300">
            {tr ? "Bağlantı geçersiz veya süresi dolmuş. Lütfen Google ile tekrar deneyin." : "This link is invalid or has expired. Please try Google sign-in again."}
          </p>
        ) : (
          <div className="mt-5 space-y-3 text-left">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className={box} />
              <span className="text-[12px] leading-relaxed text-slate-300">
                {tr ? (
                  <>
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className={link}>Hizmet Şartları</a>
                    {" ve "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className={link}>Gizlilik Politikası</a>
                    {"’nı okudum ve kabul ediyorum."} <span className="text-red-400">*</span>
                  </>
                ) : (
                  <>
                    I have read and accept the{" "}
                    <a href="/en/terms" target="_blank" rel="noopener noreferrer" className={link}>Terms of Service</a>
                    {" and "}
                    <a href="/en/privacy" target="_blank" rel="noopener noreferrer" className={link}>Privacy Policy</a>. <span className="text-red-400">*</span>
                  </>
                )}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={notice} onChange={(e) => setNotice(e.target.checked)} className={box} />
              <span className="text-[12px] leading-relaxed text-slate-300">
                {tr ? (
                  <>
                    <a href="/kvkk" target="_blank" rel="noopener noreferrer" className={link}>KVKK Aydınlatma Metni</a>
                    {"’ni okudum."} <span className="text-red-400">*</span>
                  </>
                ) : (
                  <>
                    I have read the <a href="/kvkk" target="_blank" rel="noopener noreferrer" className={link}>privacy (KVKK) notice</a>. <span className="text-red-400">*</span>
                  </>
                )}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 pt-1">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className={box} />
              <span className="text-[12px] leading-relaxed text-slate-400">
                {tr
                  ? "Kampanya, ipucu ve yeniliklerden e-posta ile haberdar olmak istiyorum. (İsteğe bağlı — istediğiniz zaman tek tıkla çıkabilirsiniz.)"
                  : "I'd like to receive emails about campaigns, tips and updates. (Optional — you can unsubscribe anytime with one click.)"}
              </span>
            </label>

            {error ? <p role="alert" className="text-xs text-rose-400">{error}</p> : null}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!ok || busy}
              className="mt-2 inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-6 text-base font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (tr ? "Hesap açılıyor…" : "Creating account…") : tr ? "Hesabı oluştur" : "Create account"}
            </button>
            <a href="/register" className="block text-center text-[12px] text-slate-400 hover:text-white">
              {tr ? "Vazgeç" : "Cancel"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
