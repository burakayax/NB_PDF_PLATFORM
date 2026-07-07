import { useEffect, useMemo, useState } from "react";
import type { Language } from "../../i18n/landing";

/**
 * Dashboard içi, davranış-tetiklemeli, kapatılabilir dönüşüm mesajı.
 *
 * Araştırma temelli ilkeler:
 *  - Yalnızca gerçek bir bağlam olduğunda gösterilir (limit doldu / kotaya yaklaşıldı /
 *    filigranlı çıktı üretiliyor). Rastgele pop-up yok.
 *  - Tek seferde tek mesaj; öncelik sırasına göre.
 *  - Kapatılınca ilgili varyant 3 gün boyunca tekrar gösterilmez (localStorage).
 *  - Aktif araç kullanımı sırasında gösterilmez (App.tsx contentPanel ile sınırlandırılır).
 */

interface QuotaSummary {
  plan: string;
  daily: { used: number; limit: number | null; resetAt: string };
  monthly: { used: number; limit: number | null };
  watermarkEnabled: boolean;
  batchLimit: number;
  fileSizeLimitMB: number;
  isAdmin?: boolean;
}

type NudgeVariant = "daily_limit" | "monthly_warning" | "ai_value" | "pro_value";

const SNOOZE_DAYS = 3;
const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
const snoozeKey = (variant: NudgeVariant) => `nb_dash_nudge_v1_${variant}_snooze_until`;

function isSnoozed(variant: NudgeVariant): boolean {
  try {
    const raw = window.localStorage.getItem(snoozeKey(variant));
    const until = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function snooze(variant: NudgeVariant) {
  try {
    window.localStorage.setItem(snoozeKey(variant), String(Date.now() + SNOOZE_MS));
  } catch {
    /* private mode */
  }
}

function copyFor(variant: NudgeVariant, tr: boolean, pct: number) {
  switch (variant) {
    case "daily_limit":
      return {
        icon: "🚀",
        title: tr ? "Bugünkü ücretsiz limitin doldu" : "You've hit today's free limit",
        body: tr
          ? "Plus ile günlük limit olmadan kaldığın yerden devam et — üstelik yapay zekâ araçları da açılır."
          : "With Plus, keep going with no daily cap — plus AI tools unlock.",
        cta: tr ? "Sınırsıza geç" : "Go unlimited",
        tone: "strong" as const,
      };
    case "monthly_warning":
      return {
        icon: "📈",
        title: tr ? `Aylık kotanın %${pct}'ini kullandın` : `You've used ${pct}% of your monthly quota`,
        body: tr
          ? "Ay bitmeden limite takılmamak için planını yükselt."
          : "Upgrade before month-end so you don't run out mid-task.",
        cta: tr ? "Planları gör" : "View plans",
        tone: "warn" as const,
      };
    case "ai_value":
      return {
        icon: "✨",
        title: tr ? "Yapay zekâyı denedin mi?" : "Have you tried AI yet?",
        body: tr
          ? "Başlangıç planıyla PDF'lerini özetle, veri çıkar ve çevir — aylık 10 yapay zekâ işlemi dahil."
          : "With Starter, summarize, extract and translate your PDFs — 10 AI operations/month included.",
        cta: tr ? "Yapay zekâyı aç" : "Unlock AI",
        tone: "value" as const,
      };
    case "pro_value":
      return {
        icon: "💎",
        title: tr ? `Aylık işlemlerinin %${pct}'i bitti` : `${pct}% of your monthly operations used`,
        body: tr
          ? "Pro ile %25 daha fazla işlem, daha büyük dosyalar ve maksimum öncelik."
          : "Pro gives +25% more operations, larger files, and max priority.",
        cta: tr ? "Pro'ya geç" : "Go Pro",
        tone: "value" as const,
      };
  }
}

const toneClass: Record<"strong" | "warn" | "value", string> = {
  strong: "border-blue-500/40 bg-gradient-to-r from-blue-500/15 to-indigo-500/10",
  warn: "border-amber-500/40 bg-gradient-to-r from-amber-500/12 to-orange-500/8",
  value: "border-violet-500/35 bg-gradient-to-r from-violet-500/12 to-blue-500/8",
};

export function DashboardLifecycleNudge({
  language = "tr",
  accessToken,
  onUpgrade,
  isTeamMember = false,
}: {
  language?: Language | string;
  accessToken?: string | null;
  onUpgrade?: () => void;
  isTeamMember?: boolean;
}) {
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const tr = language === "tr";

  useEffect(() => {
    if (isTeamMember) return;
    let cancelled = false;
    const fetchQuota = async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const res = await fetch("/api/entitlement/balance", { headers });
        if (!res.ok) return;
        const data = (await res.json()) as QuotaSummary;
        if (!cancelled) setQuota(data);
      } catch {
        /* sessiz */
      }
    };
    void fetchQuota();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isTeamMember]);

  const resolved = useMemo(() => {
    if (!quota || isTeamMember || quota.isAdmin) return null;
    const plan = quota.plan;
    const monthlyPct =
      quota.monthly.limit && quota.monthly.limit > 0
        ? Math.round((quota.monthly.used / quota.monthly.limit) * 100)
        : 0;
    const dailyFull = quota.daily.limit !== null && quota.daily.used >= quota.daily.limit;

    let variant: NudgeVariant | null = null;
    if (plan === "FREE") {
      if (dailyFull) variant = "daily_limit";
      else if (monthlyPct >= 80) variant = "monthly_warning";
      else if (quota.monthly.used >= 3) variant = "ai_value";
    } else if (plan === "PLUS") {
      if (monthlyPct >= 80) variant = "pro_value";
    }
    if (!variant) return null;
    if (isSnoozed(variant)) return null;
    return { variant, copy: copyFor(variant, tr, monthlyPct) };
  }, [quota, isTeamMember, tr]);

  if (!resolved || dismissed || !onUpgrade) return null;
  const { variant, copy } = resolved;

  return (
    <div
      role="region"
      aria-label={tr ? "Öneri" : "Suggestion"}
      className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm ${toneClass[copy.tone]}`}
    >
      <span className="text-2xl leading-none" aria-hidden>
        {copy.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{copy.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{copy.body}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={onUpgrade}
            className="rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-violet-500 hover:to-blue-500"
          >
            {copy.cta} →
          </button>
          <button
            type="button"
            onClick={() => {
              snooze(variant);
              setDismissed(true);
            }}
            className="text-[11px] font-medium text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline"
          >
            {tr ? "Şimdi değil" : "Not now"}
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label={tr ? "Kapat" : "Dismiss"}
        onClick={() => {
          snooze(variant);
          setDismissed(true);
        }}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 hover:text-slate-200"
      >
        ×
      </button>
    </div>
  );
}
