import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, MessageSquareWarning, RefreshCw, Star } from "lucide-react";

import { saasFetch } from "../../api/saasHttp";
import { TOOL_SEO } from "../../seo/seoContent.mjs";

/**
 * Araç puanları — yönetim görünümü.
 *
 * NEDEN VAR: Düşük puan tek başına bir şey söylemez; asıl bilgi kullanıcının
 * NEDEN düşük verdiğidir. Bu ekran ikisini yan yana koyar: hangi araç zayıf ve
 * o araçta insanlar ne yazmış.
 *
 * SIRALAMA KASITLI: Ortalaması en düşük araç en üstte. Panel bir övünme tablosu
 * değil, düzeltilecek işler listesi; en iyi aracı üstte göstermenin kimseye
 * faydası yok.
 */

/**
 * Araç kimliğinin okunur karşılığı.
 *
 * Panel ham kimlikleri ("pdf-ozetle") gösteriyordu; düşük puan alan aracı
 * ararken bunları çözmek gereksiz iş. Ad, sayfaların kendi başlığından gelir —
 * ayrı bir liste tutulsaydı yeni araç eklendiğinde unutulurdu.
 */
function toolName(slug: string): string {
  return TOOL_SEO[slug]?.tr?.h1 ?? slug;
}

type Distribution = Record<"1" | "2" | "3" | "4" | "5", number>;

type ToolRow = {
  toolSlug: string;
  ratingValue: number;
  ratingCount: number;
  publishable: boolean;
  distribution: Distribution;
  lastAt: string | null;
};

type Complaint = {
  toolSlug: string;
  value: number;
  comment: string;
  createdAt: string;
};

type Payload = {
  minRatingsToPublish: number;
  commentAskedBelow: number;
  bestRating: number;
  totals: { ratings: number; toolsRated: number; average: number; publishable: number };
  tools: ToolRow[];
  comments: Complaint[];
};

const CARD = "rounded-2xl border border-white/[0.08] bg-white/[0.02]";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

/** Ortalamaya göre renk: kırmızı uyarı, kehribar izle, yeşil iyi. */
function toneFor(value: number): { text: string; bar: string; ring: string } {
  if (value < 3) return { text: "text-rose-300", bar: "bg-rose-400", ring: "border-rose-400/25" };
  if (value < 4) return { text: "text-amber-300", bar: "bg-amber-400", ring: "border-amber-400/25" };
  return { text: "text-emerald-300", bar: "bg-emerald-400", ring: "border-emerald-400/25" };
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-500"}
        />
      ))}
    </span>
  );
}

/** Puan dağılımı — 5'ten 1'e ince çubuklar. Ortalamanın nereden geldiğini gösterir. */
function DistributionBars({ distribution, total }: { distribution: Distribution; total: number }) {
  return (
    <div className="space-y-1">
      {(["5", "4", "3", "2", "1"] as const).map((k) => {
        const n = distribution[k] ?? 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="w-3 text-right text-[10px] text-slate-400">{k}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={`h-full rounded-full ${Number(k) >= 4 ? "bg-emerald-400/70" : Number(k) === 3 ? "bg-amber-400/70" : "bg-rose-400/70"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-[10px] tabular-nums text-slate-400">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ToolRatingsTab({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saasFetch("/api/admin/tool-ratings?limit=100", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData((await res.json()) as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Puanlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${CARD} mx-6 my-6 p-6 text-center`}>
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
        <p className="mt-2 text-sm text-slate-300">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-sm text-cyan-300 underline">
          Yeniden dene
        </button>
      </div>
    );
  }

  const empty = !data || data.tools.length === 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">Araç puanları</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-300">
            Kullanıcılar işlem biter bitmez puan veriyor. 4 yıldızın altında «ne olmadı?» sorusu
            açılıyor; yazdıkları aşağıda. Bir araç{" "}
            <b className="text-slate-300">{data?.minRatingsToPublish ?? 10} puana</b> ulaşana kadar
            arama sonuçlarında yıldız gösterilmez.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.05]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Yenile
        </button>
      </div>

      {/* Özet */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Toplam puan", value: data?.totals.ratings ?? 0 },
          { label: "Puanlanan araç", value: data?.totals.toolsRated ?? 0 },
          { label: "Genel ortalama", value: data?.totals.average ?? 0, stars: true },
          { label: "Yıldız yayınlanan", value: data?.totals.publishable ?? 0 },
        ].map((k) => (
          <div key={k.label} className={`${CARD} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{k.value}</p>
            {k.stars && typeof k.value === "number" && k.value > 0 ? (
              <div className="mt-1">
                <Stars value={k.value} />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {empty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] px-6 py-16 text-center">
          <Star className="h-8 w-8 text-slate-500" />
          <p className="mt-3 text-sm font-semibold text-slate-300">Henüz puan yok</p>
          <p className="mt-1 max-w-md text-[13px] text-slate-300">
            Kullanıcılar araçları kullanıp sonuç ekranına ulaştıkça puanlar burada birikecek.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Araç tablosu */}
          <div className={CARD}>
            <div className="border-b border-white/[0.06] px-5 py-3">
              <p className="text-[13px] font-bold text-white">Araçlar</p>
              <p className="text-[11px] text-slate-400">En düşük ortalama üstte — düzeltilecek yer orası.</p>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {data?.tools.map((t) => {
                const tone = toneFor(t.ratingValue);
                return (
                  <div key={t.toolSlug} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-slate-100">{toolName(t.toolSlug)}</span>
                        <span className="truncate font-mono text-[11px] text-slate-400">{t.toolSlug}</span>
                        {t.publishable ? (
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            yıldız yayında
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/[0.12] px-2 py-0.5 text-[10px] text-slate-300">
                            {(data?.minRatingsToPublish ?? 10) - t.ratingCount} puan kaldı
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`text-lg font-black tabular-nums ${tone.text}`}>
                          {t.ratingValue.toFixed(1)}
                        </span>
                        <Stars value={t.ratingValue} />
                        <span className="text-[11px] text-slate-400">
                          {t.ratingCount} puan · son {formatDate(t.lastAt)}
                        </span>
                      </div>
                    </div>
                    <DistributionBars distribution={t.distribution} total={t.ratingCount} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Şikâyetler */}
          <div className={CARD}>
            <div className="border-b border-white/[0.06] px-5 py-3">
              <p className="flex items-center gap-2 text-[13px] font-bold text-white">
                <MessageSquareWarning className="h-4 w-4 text-amber-400" /> Ne ters gitti?
              </p>
              <p className="text-[11px] text-slate-400">
                {data?.commentAskedBelow ?? 4} yıldızın altında yazılan açıklamalar, en yeniden eskiye.
              </p>
            </div>
            {data && data.comments.length > 0 ? (
              <div className="max-h-[560px] divide-y divide-white/[0.05] overflow-y-auto">
                {data.comments.map((c, i) => (
                  <div key={`${c.toolSlug}-${c.createdAt}-${i}`} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[12px] font-semibold text-slate-300">{toolName(c.toolSlug)}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Stars value={c.value} size={12} />
                        <span className="text-[11px] text-slate-400">{formatDate(c.createdAt)}</span>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-200">{c.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] text-slate-300">Henüz açıklama yazılmamış.</p>
                <p className="mt-1 text-[12px] text-slate-400">
                  Bu iyi haber — düşük puan veren olmamış ya da yazmamış.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
