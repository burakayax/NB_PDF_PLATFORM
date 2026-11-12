import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";

import { saasFetch } from "../../api/saasHttp";
import type { Language } from "../../i18n/landing";

/**
 * Hesap ayarları — tanıtım e-postası izni.
 *
 * Kullanıcı istediği an açıp kapatabilir. Her değişiklik sunucuda onay
 * defterine gerçek tarihle yazılır. Yanındaki metin sunucudaki
 * SETTINGS_CONSENT_TEXT ile aynı cümledir (değişirse ikisi birlikte güncellenir).
 */

type State = { granted: boolean; grantedAt: string | null };

const COPY = {
  tr: {
    eyebrow: "E-posta tercihleri",
    title: "Kampanya, ipucu ve yenilikler",
    consent: "Kampanya, ipucu ve yeniliklerden e-posta ile haberdar olmak istiyorum.",
    note: "İsteğe bağlı. İstediğin zaman buradan ya da e-postadaki tek tıkla çıkabilirsin. Fatura, şifre ve güvenlik e-postaları bundan etkilenmez.",
    on: "Açık",
    off: "Kapalı",
    since: (d: string) => `${d} tarihinden beri açık`,
    saved: "Tercihin kaydedildi",
    error: "Kaydedilemedi, tekrar dene.",
  },
  en: {
    eyebrow: "Email preferences",
    title: "Campaigns, tips and updates",
    consent: "I'd like to receive emails about campaigns, tips and updates.",
    note: "Optional. You can turn this off any time here or with one click in any email. Invoices, password and security emails are not affected.",
    on: "On",
    off: "Off",
    since: (d: string) => `On since ${d}`,
    saved: "Preference saved",
    error: "Could not save, please try again.",
  },
} as const;

export function MarketingConsentCard({
  accessToken,
  language,
}: {
  accessToken: string | null;
  language: Language;
}) {
  const t = COPY[language === "tr" ? "tr" : "en"];
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const load = useCallback(async () => {
    if (!auth) return;
    try {
      const res = await saasFetch("/api/auth/marketing-consent", { headers: auth });
      if (res.ok) setState((await res.json()) as State);
    } catch {
      /* sessiz: kart yüklenmezse gizli kalır */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    if (!state || !auth || saving) return;
    const next = !state.granted;
    setSaving(true);
    setFlash(null);
    try {
      const res = await saasFetch("/api/auth/marketing-consent", {
        method: "PUT",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ granted: next }),
      });
      if (!res.ok) throw new Error();
      setState((await res.json()) as State);
      setFlash(t.saved);
    } catch {
      setFlash(t.error);
    } finally {
      setSaving(false);
    }
  };

  if (!state) return null;

  const sinceText =
    state.granted && state.grantedAt
      ? t.since(
          new Date(state.grantedAt).toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", {
            dateStyle: "long",
          }),
        )
      : null;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-nb-panel/50 p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t.eyebrow}</p>

      <div className="mt-3 flex items-start gap-4">
        <span
          className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200 ${
            state.granted
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
              : "border-white/[0.08] bg-white/[0.03] text-slate-500"
          }`}
          aria-hidden
        >
          <BellRing className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-nb-text">{t.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{t.consent}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{t.note}</p>
          {sinceText ? <p className="mt-2 text-xs text-cyan-300/80">{sinceText}</p> : null}
          <p className="mt-2 h-4 text-xs text-slate-400" aria-live="polite">
            {flash}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={state.granted}
            aria-label={t.title}
            disabled={saving}
            onClick={() => void toggle()}
            className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-60 ${
              state.granted
                ? "border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-blue-500"
                : "border-white/[0.12] bg-white/[0.08]"
            }`}
          >
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-200 ${
                state.granted ? "translate-x-6" : "translate-x-1"
              }`}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : null}
            </span>
          </button>
          <span className="text-[11px] font-medium text-slate-400">{state.granted ? t.on : t.off}</span>
        </div>
      </div>
    </section>
  );
}
