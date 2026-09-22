import { useState } from "react";
import { Star, X } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { buildSaasApiUrl } from "../../api/saasHttp";
import { ratingAlreadyAsked, rememberRating } from "../../lib/toolRatingMemory";

/**
 * "Bu araç işini gördü mü?" — işlem biter bitmez sorulan tek soru.
 *
 * NEDEN BURADA SORULUYOR: Araştırma, uygulama içinde ve işin hemen ardından
 * sorulan mikro anketlerin, sayfada öylece duran geri bildirim bileşenlerine
 * göre yaklaşık iki katı yanıt aldığını gösteriyor. Kullanıcı sonucu tam o an
 * görmüştür; bir hafta sonra sorulan aynı soru hem hatırlanmaz hem cevaplanmaz.
 *
 * NEDEN 5 YILDIZ, BAŞPARMAK DEĞİL: Başparmak (olumlu/olumsuz) daha çok oy
 * topluyor — Netflix'in kendi geçişi bunu gösterdi. Ama sayısal bir ortalama
 * üretmiyor ve Google'ın arama sonuçlarındaki yıldızlar için gereken şey tam
 * olarak o ortalama. Dereceli yoğunluk gerektiğinde 5 puanlık ölçek doğru araç.
 *
 * NEDEN AÇIKLAMA YALNIZ DÜŞÜK PUANDA: Teşhis değeri orada. Memnun kullanıcıya
 * ek bir kutu göstermek, hiçbir şey kazandırmadan sürtünme ekler.
 *
 * TEK SORU: Yanıt oranı soru sayısı arttıkça düşüyor; burada ikinci bir soru yok.
 *
 * ARAÇ BAŞINA BİR KEZ: Aynı soruyu her işlemde yeniden sormak oy sayısını
 * artırmaz — sunucu aynı kişinin oyunu günceller, yenisini eklemez — ama aracı
 * sık kullanan kişiyi yorar. Cevap veren ya da soruyu kapatan bir daha görmez.
 * Fikrini değiştirmek isteyen, araç sayfasındaki kalıcı puan satırından
 * (ToolScore) oyunu güncelleyebilir.
 */

const L = {
  tr: {
    ask: "Bu araç işini gördü mü?",
    thanks: "Teşekkürler.",
    thanksLow: "Teşekkürler — neyin ters gittiğini yazarsanız düzeltiriz.",
    placeholder: "Ne olmadı? (isteğe bağlı)",
    send: "Gönder",
    skip: "Geç",
    failed: "Puan kaydedilemedi.",
    star: (n: number) => `${n} yıldız`,
    dismiss: "Sorma",
  },
  en: {
    ask: "Did this tool do the job?",
    thanks: "Thanks.",
    thanksLow: "Thanks — tell us what went wrong and we'll fix it.",
    placeholder: "What didn't work? (optional)",
    send: "Send",
    skip: "Skip",
    failed: "Couldn't save your rating.",
    star: (n: number) => `${n} stars`,
    dismiss: "Don't ask",
  },
} as const;

/** Bu puanın altında kısa açıklama sorulur — sunucudaki eşikle aynı.
 *  Kalıcı puan satırı (ToolScore) da aynı eşiği kullanır; iki yerde ayrı sayı
 *  durmasın diye buradan paylaşılıyor. */
export const COMMENT_ASKED_BELOW = 4;

export function ToolRating({ toolSlug, language }: { toolSlug: string; language: Language }) {
  const t = L[language === "tr" ? "tr" : "en"];
  // İlk render'da karar verilir; sonradan gizlemek soruyu bir an gösterip
  // kaybettirirdi.
  const [asked, setAsked] = useState(() => ratingAlreadyAsked(toolSlug));
  const [hover, setHover] = useState(0);
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const send = async (rating: number, text?: string) => {
    setState("sending");
    try {
      // Kimlik API'si uretimde AYRI bir adreste; duz "/api/..." yazmak PDF
      // servisine giderdi. Proje genelinde kullanilan taban yardimcisi sart.
      const res = await fetch(buildSaasApiUrl(`/api/tool-rating/${encodeURIComponent(toolSlug)}`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: rating, comment: text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      rememberRating(toolSlug, rating);
      setState("done");
    } catch {
      // Puan verememek kullanıcının işini bölmemeli; sessizce geçilir.
      setState("error");
    }
  };

  const pick = (rating: number) => {
    setValue(rating);
    // Yüksek puanda beklemeye gerek yok: tek tıkla biter.
    if (rating >= COMMENT_ASKED_BELOW) void send(rating);
  };

  if (asked) {
    return null;
  }

  if (state === "done") {
    return (
      <p className="mt-4 text-center text-[13px] text-slate-300">
        {value < COMMENT_ASKED_BELOW ? t.thanksLow : t.thanks}
      </p>
    );
  }

  const askComment = value > 0 && value < COMMENT_ASKED_BELOW && state !== "sending";

  return (
    <div className="relative mt-4 border-t border-white/[0.06] pt-4">
      {/* Soruyu bir daha görmemenin yolu. "Araç başına bir kez" kuralının
          karşılığı: cevap vermek istemeyen de bir kez karar verebilmeli. */}
      <button
        type="button"
        aria-label={t.dismiss}
        title={t.dismiss}
        onClick={() => {
          rememberRating(toolSlug, "skipped");
          setAsked(true);
        }}
        className="absolute right-0 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="text-center text-[13px] font-medium text-slate-200">{t.ask}</p>

      <div className="mt-2 flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t.star(n)}
            disabled={state === "sending"}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => pick(n)}
            className="rounded p-1 transition disabled:opacity-50"
          >
            <Star
              className={`h-6 w-6 transition ${
                n <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-slate-400"
              }`}
            />
          </button>
        ))}
      </div>

      {askComment ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={comment}
            maxLength={300}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t.placeholder}
            className="min-w-0 flex-1 rounded-lg border border-white/[0.15] bg-black/30 px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-400 focus:border-cyan-400/60"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void send(value, comment)}
              className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-[13px] font-semibold text-white"
            >
              {t.send}
            </button>
            <button
              type="button"
              onClick={() => void send(value)}
              className="rounded-lg px-3 py-2 text-[13px] text-slate-300 hover:text-white"
            >
              {t.skip}
            </button>
          </div>
        </div>
      ) : null}

      {state === "error" ? (
        <p className="mt-2 text-center text-[12px] text-rose-300">{t.failed}</p>
      ) : null}
    </div>
  );
}
