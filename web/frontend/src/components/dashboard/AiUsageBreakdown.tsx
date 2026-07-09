import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { fetchAiQuota, type AiQuota } from "../../api/ai";

/** AI işlem türü → kullanıcıya gösterilen araç adı + ikon. */
const OP_LABELS: Record<string, { tr: string; en: string; emoji: string }> = {
  summarize: { tr: "PDF Özetle", en: "Summarize PDF", emoji: "✨" },
  chat: { tr: "PDF ile Sohbet", en: "Chat with PDF", emoji: "💬" },
  translate: { tr: "PDF Çeviri", en: "Translate PDF", emoji: "🌍" },
  extract: { tr: "PDF Veri Çıkar", en: "Extract Data", emoji: "📋" },
  compare: { tr: "PDF Karşılaştır", en: "Compare PDFs", emoji: "⚖️" },
  redact: { tr: "Hassas Veri Gizle", en: "Redact Data", emoji: "🛡️" },
};

/**
 * Navbar AI rozetine tıklayınca açılan panelde: bu ay her AI aracından kaç istek
 * yapıldığının araç bazında dökümü.
 */
export function AiUsageBreakdown({
  language,
  accessToken,
}: {
  language: Language;
  accessToken: string | null;
}) {
  const tr = language === "tr";
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAiQuota(accessToken).then((q) => {
      if (alive) {
        setQuota(q);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [accessToken]);

  if (loading || !quota) return null;

  const byOp = quota.byOp ?? {};
  const entries = Object.entries(byOp)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const max = entries.reduce((m, [, n]) => Math.max(m, n), 0);

  return (
    <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-fuchsia-300" aria-hidden />
        <h3 className="text-base font-bold text-white">
          {tr ? "AI Kullanımı — Araç Bazında" : "AI Usage — By Tool"}
        </h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        {tr
          ? "Bu ay her AI aracından kaç istek yaptığın."
          : "How many requests you made to each AI tool this month."}
        {quota.unlimited
          ? ""
          : ` · ${tr ? "Kalan" : "Remaining"}: ${quota.remaining}/${quota.limit}`}
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {tr ? "Bu ay henüz AI aracı kullanmadın." : "No AI usage yet this month."}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {entries.map(([op, n]) => {
            const label = OP_LABELS[op] ?? { tr: op, en: op, emoji: "🤖" };
            const pct = max > 0 ? Math.round((n / max) * 100) : 0;
            return (
              <li key={op}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span aria-hidden>{label.emoji}</span>
                    {tr ? label.tr : label.en}
                  </span>
                  <span className="font-bold tabular-nums text-white">{n}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          <li className="flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-sm font-semibold text-slate-300">
            <span>{tr ? "Toplam istek" : "Total requests"}</span>
            <span className="tabular-nums text-white">{total}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
