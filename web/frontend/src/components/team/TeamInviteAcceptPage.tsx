import { useEffect, useState } from "react";
import { getSaasApiBase } from "../../api/saasBase";

type State = "loading_token" | "no_token" | "loading_preview" | "form" | "accepting" | "success" | "error";
type Lang = "tr" | "en";

const T = {
  tr: {
    title: "Ekip Davetini Kabul Et",
    subtitle: (teamName: string, ownerName: string) =>
      `${ownerName} sizi "${teamName}" ekibine davet etti. Hesap oluşturun ve katılın.`,
    firstName: "Ad",
    lastName: "Soyad",
    email: "E-posta",
    password: "Şifre",
    submit: "Hesap Oluştur ve Daveti Kabul Et",
    submitting: "İşleniyor...",
    successTitle: "Ekibe Katıldınız!",
    successMsg: "Ekibe başarıyla katıldınız. Artık tüm PDF araçlarına Business erişiminiz var.",
    goPanel: "Panele Git →",
    errorTitle: "Hata Oluştu",
    retry: "Tekrar Dene",
    noTokenTitle: "Geçersiz Davet Bağlantısı",
    noTokenMsg: "Bu davet bağlantısı geçersiz veya eksik.",
    noTokenHint: "Lütfen e-postanızdaki bağlantıyı kullanın.",
    pwMin: "Şifre en az 10 karakter olmalıdır.",
    pwLower: "Şifre en az bir küçük harf içermelidir.",
    pwUpper: "Şifre en az bir büyük harf içermelidir.",
    pwDigit: "Şifre en az bir rakam içermelidir.",
    pwSymbol: "Şifre en az bir özel karakter içermelidir.",
  },
  en: {
    title: "Accept Team Invite",
    subtitle: (teamName: string, ownerName: string) =>
      `${ownerName} invited you to join "${teamName}". Create an account to get started.`,
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    password: "Password",
    submit: "Create Account & Accept Invite",
    submitting: "Processing...",
    successTitle: "You Joined the Team!",
    successMsg: "You have successfully joined the team. You now have full Business access to all PDF tools.",
    goPanel: "Go to Dashboard →",
    errorTitle: "An Error Occurred",
    retry: "Try Again",
    noTokenTitle: "Invalid Invite Link",
    noTokenMsg: "This invite link is invalid or missing.",
    noTokenHint: "Please use the link from your email.",
    pwMin: "Password must be at least 10 characters.",
    pwLower: "Password must include a lowercase letter.",
    pwUpper: "Password must include an uppercase letter.",
    pwDigit: "Password must include a number.",
    pwSymbol: "Password must include a symbol.",
  },
};

function detectLang(): Lang {
  const params = new URLSearchParams(window.location.search);
  const p = params.get("lang");
  if (p === "tr" || p === "en") return p;
  const nav = (navigator.language ?? "").toLowerCase();
  return nav.startsWith("tr") ? "tr" : "en";
}

function validatePassword(pw: string, lang: Lang): string | null {
  const t = T[lang];
  if (pw.length < 10) return t.pwMin;
  if (!/[a-z]/.test(pw)) return t.pwLower;
  if (!/[A-Z]/.test(pw)) return t.pwUpper;
  if (!/\d/.test(pw)) return t.pwDigit;
  if (!/[^A-Za-z0-9]/.test(pw)) return t.pwSymbol;
  return null;
}

export function TeamInviteAcceptPage() {
  const [lang] = useState<Lang>(detectLang);
  const t = T[lang];

  const [state, setState] = useState<State>("loading_token");
  const [token, setToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [teamName, setTeamName] = useState("");
  const [ownerName, setOwnerName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setState("no_token");
      return;
    }
    setToken(t);
    setState("loading_preview");

    fetch(`${getSaasApiBase()}/api/team/invite/preview?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json() as { message?: string };
          throw new Error(d.message ?? "Invite not found.");
        }
        return res.json() as Promise<{ email: string; teamName: string; ownerName: string }>;
      })
      .then((data) => {
        setEmail(data.email);
        setTeamName(data.teamName);
        setOwnerName(data.ownerName);
        setState("form");
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "Davet bilgileri alınamadı.");
        setState("error");
      });
  }, []);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError) {
      setPasswordError(validatePassword(val, lang));
    }
  };

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    const pwErr = validatePassword(password, lang);
    if (pwErr) {
      setPasswordError(pwErr);
      return;
    }
    setPasswordError(null);

    setState("accepting");
    try {
      const regRes = await fetch(`${getSaasApiBase()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          preferredLanguage: lang,
          skipEmailVerification: true,
        }),
      });
      if (!regRes.ok) {
        const d = await regRes.json() as { message?: string };
        throw new Error(d.message ?? "Kayıt başarısız.");
      }

      const loginRes = await fetch(`${getSaasApiBase()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) {
        const d = await loginRes.json() as { message?: string };
        throw new Error(d.message ?? "Giriş başarısız.");
      }
      const loginData = await loginRes.json() as { accessToken?: string };
      const accessToken = loginData.accessToken;
      if (!accessToken) throw new Error("Giriş tokeni alınamadı.");

      const acceptRes = await fetch(`${getSaasApiBase()}/api/team/invite/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!acceptRes.ok) {
        const d = await acceptRes.json() as { message?: string };
        throw new Error(d.message ?? "Davet kabul edilemedi.");
      }

      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Bir hata oluştu.");
      setState("error");
    }
  };

  if (state === "loading_token" || state === "loading_preview") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (state === "no_token") {
    return (
      <InvitePageWrapper title={t.noTokenTitle}>
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-5 text-center">
          <p className="text-2xl mb-3">❌</p>
          <p className="text-sm text-red-400">{t.noTokenMsg}</p>
          <p className="mt-2 text-xs text-slate-500">{t.noTokenHint}</p>
        </div>
      </InvitePageWrapper>
    );
  }

  if (state === "success") {
    return (
      <InvitePageWrapper title={t.successTitle}>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-5 text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-sm text-emerald-400 font-semibold">{t.successMsg}</p>
        </div>
        <a
          href="/web"
          className="mt-5 block w-full rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-3 text-center text-sm font-bold text-white hover:from-cyan-500 hover:to-sky-500"
        >
          {t.goPanel}
        </a>
      </InvitePageWrapper>
    );
  }

  if (state === "error") {
    return (
      <InvitePageWrapper title={t.errorTitle}>
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-5 text-center">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-sm text-red-400">{errorMsg}</p>
        </div>
        <button
          type="button"
          onClick={() => setState("form")}
          className="mt-4 w-full rounded-xl border border-white/[0.08] py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]"
        >
          {t.retry}
        </button>
      </InvitePageWrapper>
    );
  }

  return (
    <InvitePageWrapper title={t.title}>
      {teamName && (
        <p className="mb-6 text-sm text-slate-400 text-center">
          {t.subtitle(teamName, ownerName)}
        </p>
      )}
      <form onSubmit={(e) => { void handleRegisterAndAccept(e); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">{t.firstName}</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">{t.lastName}</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">{t.email}</label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-sm text-slate-400 outline-none cursor-not-allowed"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">{t.password}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            minLength={10}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50 bg-white/[0.04] ${
              passwordError ? "border-red-500/60" : "border-white/[0.08]"
            }`}
          />
          {passwordError && (
            <p className="mt-1.5 text-xs text-red-400">{passwordError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={state === "accepting"}
          className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-3 text-sm font-bold text-white disabled:opacity-60 hover:from-cyan-500 hover:to-sky-500"
        >
          {state === "accepting" ? t.submitting : t.submit}
        </button>
      </form>
    </InvitePageWrapper>
  );
}

function InvitePageWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080f] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-500/70">
            NB PDF PLATFORM
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f172a] p-6 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
