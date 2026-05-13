import { useEffect, useState } from "react";

type State = "loading_token" | "no_token" | "form" | "accepting" | "success" | "error";

export function TeamInviteAcceptPage() {
  const [state, setState] = useState<State>("loading_token");
  const [token, setToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Registration form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setState("no_token");
    } else {
      setToken(t);
      setState("form");
    }
  }, []);

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("accepting");
    try {
      // Step 1: Register
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      if (!regRes.ok) {
        const d = await regRes.json() as { message?: string };
        throw new Error(d.message ?? "Kayıt başarısız.");
      }

      // Step 2: Login to get access token
      const loginRes = await fetch("/api/auth/login", {
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

      // Step 3: Accept invite
      const acceptRes = await fetch("/api/team/invite/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
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

  if (state === "loading_token") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (state === "no_token") {
    return (
      <InvitePageWrapper title="Geçersiz Davet Bağlantısı">
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-5 text-center">
          <p className="text-2xl mb-3">❌</p>
          <p className="text-sm text-red-400">Bu davet bağlantısı geçersiz veya eksik.</p>
          <p className="mt-2 text-xs text-slate-500">Lütfen e-postanızdaki bağlantıyı kullanın.</p>
        </div>
      </InvitePageWrapper>
    );
  }

  if (state === "success") {
    return (
      <InvitePageWrapper title="Ekibe Katıldınız!">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-5 text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-sm text-emerald-400 font-semibold">Ekibe başarıyla katıldınız.</p>
          <p className="mt-2 text-xs text-slate-500">Artık tüm PDF araçlarına Business erişiminiz var.</p>
        </div>
        <a
          href="/web"
          className="mt-5 block w-full rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-3 text-center text-sm font-bold text-white hover:from-cyan-500 hover:to-sky-500"
        >
          Panele Git →
        </a>
      </InvitePageWrapper>
    );
  }

  if (state === "error") {
    return (
      <InvitePageWrapper title="Hata Oluştu">
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-5 text-center">
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-sm text-red-400">{errorMsg}</p>
        </div>
        <button
          type="button"
          onClick={() => setState("form")}
          className="mt-4 w-full rounded-xl border border-white/[0.08] py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]"
        >
          Tekrar Dene
        </button>
      </InvitePageWrapper>
    );
  }

  return (
    <InvitePageWrapper title="Ekip Davetini Kabul Et">
      <p className="mb-6 text-sm text-slate-400 text-center">
        Daveti kabul etmek için hesap oluşturun.
      </p>
      <form onSubmit={(e) => { void handleRegisterAndAccept(e); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Ad</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Soyad</label>
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
          <label className="mb-1 block text-xs font-medium text-slate-400">E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50"
          />
        </div>
        <button
          type="submit"
          disabled={state === "accepting"}
          className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 py-3 text-sm font-bold text-white disabled:opacity-60 hover:from-cyan-500 hover:to-sky-500"
        >
          {state === "accepting" ? "İşleniyor..." : "Hesap Oluştur ve Daveti Kabul Et"}
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
