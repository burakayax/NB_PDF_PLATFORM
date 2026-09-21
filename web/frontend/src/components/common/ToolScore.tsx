import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { buildSaasApiUrl } from "../../api/saasHttp";
import { myRatingFor, rememberRating } from "../../lib/toolRatingMemory";

/**
 * Araç sayfasındaki KALICI puan satırı — ortalama + yıldızlar + oy sayısı.
 *
 * NEDEN İŞ BİTİMİNDEKİ SORUYA EK OLARAK VAR:
 *
 * 1) PUAN DEĞİŞEBİLMELİ. Bugün tökezleyen araç yarın düzelebilir, iyi çalışan
 *    araç bozulabilir. Google Play, Trustpilot ve Amazon'un üçü de aynı çözümü
 *    kullanıyor: kişi başına TEK oy, ama sahibi istediği zaman güncelleyebilir.
 *    Sunucu zaten böyle davranıyor (oy eklenmez, güncellenir); eksik olan tek
 *    şey kişinin oyuna geri dönebileceği bir yerdi — burası o yer.
 *
 * 2) GOOGLE'IN GÖRÜNÜRLÜK KURALI. Yapısal veri kuralları, sayfada görünmeyen
 *    içeriğin işaretlenmesini yasaklıyor: puan bilgisinin ziyaretçiye o sayfada
 *    görünür olması gerekiyor. Arama sonucunda yıldız çıkarmanın ön koşulu bu
 *    satırın varlığı.
 *
 * NEDEN ASIL TOPLAMA BURADA DEĞİL: Sayfada öylece duran geri bildirim alanları
 * ~%5-15 yanıt alıyor; işin hemen ardından sorulan tek soru ~%25-40. Oyun büyük
 * kısmı iş bitiminde toplanır (bkz. ToolRating), burası düzeltme kapısıdır.
 *
 * UYDURMA PUAN YOK: Hiç oy yoksa ortalama uydurulmaz, "ilk puanı sen ver"
 * denir. Sunucu da eşiği geçmeyen aracın ortalamasını yayınlamaz.
 */

const L = {
  tr: {
    none: "Bu araca ilk puanı sen ver",
    countOne: "1 değerlendirme",
    count: (n: number) => `${n} değerlendirme`,
    mine: "Senin puanın",
    change: "Puanını değiştir",
    star: (n: number) => `${n} yıldız ver`,
    saving: "Kaydediliyor…",
  },
  en: {
    none: "Be the first to rate this tool",
    countOne: "1 rating",
    count: (n: number) => `${n} ratings`,
    mine: "Your rating",
    change: "Change your rating",
    star: (n: number) => `Rate ${n} stars`,
    saving: "Saving…",
  },
} as const;

type Summary = { ratingValue: number; ratingCount: number };

/**
 * Ekrandaki görünüm, HANGİ araca ait olduğuyla birlikte tutulur.
 *
 * Tek sayfa uygulamada araç değişince aynı bileşen yeniden kullanılıyor; slug
 * ile birlikte saklanmasaydı bir an önceki aracın puanı yeni aracın başlığı
 * altında görünürdü. Sıfırlamayı çizim sırasında yapmak, "araç değişti"
 * bilgisini ayrıca temizlemekten hem daha kısa hem daha güvenli.
 */
type View = {
  slug: string;
  summary: Summary | null;
  /** Sunucuya ulaşılamadı — bozuk bir puan satırı hiç olmamasından kötü. */
  failed: boolean;
  /** Bu ziyaretçinin kendi oyu (tarayıcı hafızasından). */
  mine: number | null;
};

export function ToolScore({
  slug,
  language,
  className,
}: {
  slug: string;
  language: Language;
  className?: string;
}) {
  const t = L[language === "tr" ? "tr" : "en"];
  const [view, setView] = useState<View>(() => ({
    slug,
    summary: null,
    failed: false,
    mine: myRatingFor(slug),
  }));
  const [hover, setHover] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (target: string, signal?: AbortSignal) => {
      try {
        const res = await fetch(buildSaasApiUrl(`/api/tool-rating/${encodeURIComponent(target)}`), {
          signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: Summary = await res.json();
        setView({
          slug: target,
          summary: { ratingValue: data.ratingValue, ratingCount: data.ratingCount },
          failed: false,
          mine: myRatingFor(target),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setView({ slug: target, summary: null, failed: true, mine: myRatingFor(target) });
      }
    },
    [],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(slug, ac.signal);
    return () => ac.abort();
  }, [slug, load]);

  const vote = async (value: number) => {
    setSaving(true);
    try {
      const res = await fetch(buildSaasApiUrl(`/api/tool-rating/${encodeURIComponent(slug)}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: { summary?: Summary } = await res.json();
      rememberRating(slug, value);
      if (data.summary) {
        setView({
          slug,
          summary: {
            ratingValue: data.summary.ratingValue,
            ratingCount: data.summary.ratingCount,
          },
          failed: false,
          mine: value,
        });
      } else {
        await load(slug);
      }
    } catch {
      // Puan verememek kullanıcının işini bölmemeli; sessizce geçilir.
    } finally {
      setSaving(false);
    }
  };

  // Görünüm başka bir araca aitse (slug yeni değişti) henüz çizilmez.
  const current = view.slug === slug ? view : null;
  const summary = current?.summary ?? null;
  const mine = current?.mine ?? null;

  if (current?.failed || !summary) {
    return null;
  }

  const hasVotes = summary.ratingCount > 0;
  // Yıldızlar: kendi oyu varsa onu gösterir (kullanıcı kendi kararını görmeli),
  // yoksa ortalamayı.
  const shown = hover || mine || (hasVotes ? Math.round(summary.ratingValue) : 0);
  const average = summary.ratingValue.toLocaleString(language === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${className ?? ""}`}>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t.star(n)}
            title={mine ? t.change : t.star(n)}
            disabled={saving}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => void vote(n)}
            className="rounded p-0.5 transition disabled:opacity-50"
          >
            <Star
              className={`h-4 w-4 transition ${
                n <= shown ? "fill-amber-400 text-amber-400" : "text-slate-600"
              }`}
            />
          </button>
        ))}
      </div>

      {hasVotes ? (
        <span className="text-[13px] text-slate-400">
          <span className="font-semibold text-slate-200">{average}</span>{" "}
          <span className="text-slate-500">·</span>{" "}
          {summary.ratingCount === 1 ? t.countOne : t.count(summary.ratingCount)}
        </span>
      ) : (
        <span className="text-[13px] text-slate-500">{t.none}</span>
      )}

      {saving ? <span className="text-[12px] text-slate-500">{t.saving}</span> : null}
      {!saving && mine ? (
        <span className="text-[12px] text-emerald-300/80">
          {t.mine}: {mine}
        </span>
      ) : null}
    </div>
  );
}
