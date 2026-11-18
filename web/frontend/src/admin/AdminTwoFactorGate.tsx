import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { getSaasApiBase } from "../api/saasBase";

/**
 * Yönetim paneli önündeki e-posta kodu kapısı.
 * Doğrulanmış tarayıcıda (12 saat) hiçbir şey göstermez; değilse kodu yöneticinin e-postasına yollar ve ister.
 */
type Props = { accessToken: string; userEmail: string; onLogout: () => void; children: ReactNode };
type Stage = "checking" | "needCode" | "ok";

async function call(path: string, accessToken: string, method: "GET" | "POST", body?: unknown) {
  const res = await fetch(`${getSaasApiBase()}/api/auth/admin-2fa/${path}`, {
    method,
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: { message?: string; cooldownSeconds?: number; enabled?: boolean; verified?: boolean } = {};
  try {
    data = await res.json();
  } catch {
    /* gövde yok */
  }
  return { ok: res.ok, data };
}

export function AdminTwoFactorGate({ accessToken, userEmail, onLogout, children }: Props) {
  const [stage, setStage] = useState<Stage>("checking");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const sentRef = useRef(false);

  const send = useCallback(async () => {
    setMsg(null);
    const r = await call("send", accessToken, "POST", {});
    if (r.ok) {
      setWait(r.data.cooldownSeconds ?? 60);
      setMsg(`Doğrulama kodu ${userEmail} adresine gönderildi.`);
    } else {
      setMsg(r.data.message ?? "Kod gönderilemedi.");
    }
  }, [accessToken, userEmail]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await call("status", accessToken, "GET");
        if (!alive) return;
        if (!r.ok || r.data.verified) {
          setStage("ok"); // durum alınamazsa panel kendi 403'ünü gösterir; kapıda takılmayız
          return;
        }
        setStage("needCode");
        if (!sentRef.current) {
          sentRef.current = true;
          void send();
        }
      } catch {
        if (alive) setStage("ok");
      }
    })();
    return () => {
      alive = false;
    };
  }, [accessToken, send]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || code.replace(/\D/g, "").length !== 6) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await call("verify", accessToken, "POST", { code: code.replace(/\D/g, "") });
      if (r.ok) setStage("ok");
      else setMsg(r.data.message ?? "Kod hatalı veya süresi dolmuş.");
    } catch {
      setMsg("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "ok") return <>{children}</>;
  if (stage === "checking") return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-lg font-semibold">Yönetici doğrulaması</h1>
        <p className="text-sm text-slate-400">
          Güvenliğiniz için <b className="text-slate-200">{userEmail}</b> adresine 6 haneli bir kod gönderdik. Kod 10 dakika geçerlidir.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="000000"
          aria-label="Doğrulama kodu"
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-sky-400"
        />
        {msg ? <p className="text-sm text-amber-300">{msg}</p> : null}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Doğrulanıyor…" : "Doğrula ve gir"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" disabled={wait > 0} onClick={() => void send()} className="text-sky-300 disabled:text-slate-500">
            {wait > 0 ? `Yeni kod (${wait} sn)` : "Kodu yeniden gönder"}
          </button>
          <button type="button" onClick={onLogout} className="text-slate-400 hover:text-slate-200">
            Çıkış
          </button>
        </div>
      </form>
    </div>
  );
}
