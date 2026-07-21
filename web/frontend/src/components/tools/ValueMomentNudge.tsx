import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * "Değer-anı" nudge'ı — kullanıcı ücretsiz bir işlemi BAŞARIYLA bitirdiğinde (değer taze,
 * tatmin yüksek) gösterilen HAFİF, rahatsız etmeyen bir dokunuş. Reaktif limit modalının
 * aksine PROAKTİF: misafiri ücretsiz kayda (huni girişi) davet eder.
 *
 * Nezaket: kapatılabilir; kapatınca 24 saat snooze (localStorage) → nag etmez. Sonuç
 * ekranında inline durur (popup/blocking DEĞİL). CTA gerçek link (/register) — SPA yükler.
 */
const SNOOZE_KEY = "nb_value_nudge_snooze_until";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  try {
    const v = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10);
    return Number.isFinite(v) && Date.now() < v;
  } catch {
    return false;
  }
}

export function ValueMomentNudge({ language }: { language: Language }) {
  const tr = language === "tr";
  const [hidden, setHidden] = useState(() => isSnoozed());
  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* private mode */
    }
    setHidden(true);
  };

  return (
    <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/[0.10] to-fuchsia-500/[0.08] p-3.5 pr-10 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
        <Sparkles className="h-4 w-4" />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-slate-300">
        {tr
          ? "Beğendin mi? Ücretsiz hesapla günde daha fazla işlem, yapay zekâ araçları ve dönüştürmeler."
          : "Liked that? A free account unlocks more daily operations, AI tools, and conversions."}
      </p>
      <a
        href="/register"
        className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2 text-[13px] font-bold text-white transition hover:from-indigo-500 hover:to-fuchsia-500"
      >
        {tr ? "Ücretsiz başla" : "Start free"}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tr ? "Kapat" : "Dismiss"}
        className="absolute right-2 top-2 rounded-lg p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
