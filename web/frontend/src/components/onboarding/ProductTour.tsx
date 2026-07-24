import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * Profesyonel ürün turu (spotlight onboarding).
 *
 * İlk giren kullanıcıya arayüzü adım adım tanıtır: arka plan kararır, hedef eleman
 * aydınlatılır (halka + hafif parıltı) ve yanında açıklama baloncuğu çıkar
 * ("1. aracını seç → 2. dosya yükle → 3. işle …").
 *
 * SAĞLAMLIK ilkeleri (uyduruk değil):
 *  - Hedef DOM'da yoksa adım sessizce ATLANIR (araç seçilmemişse form yok → o adım atlanır).
 *  - Her adımda hedef görünüme kaydırılır, ölçülür; resize/scroll'da yeniden konumlanır (rAF).
 *  - Baloncuk viewport içine sıkıştırılır (taşmaz); üstte/altta yer yoksa taraf değişir.
 *  - Klavye: ← → ile gezinme, Esc ile kapatma. `prefers-reduced-motion` saygılı.
 *  - Overlay tıklamaları yutar (kullanıcı turu takip eder); yalnız baloncuk butonları etkin.
 */

export type TourStep = {
  /** Hedef elemanın CSS seçicisi. Dizi verilirse GÖRÜNÜR olan ilk seçici kullanılır
   *  (ör. desktop + mobil çıpası). Hiçbiri görünür değilse adım atlanır. */
  selector: string | string[];
  title: string;
  body: string;
  /** Baloncuğun tercih edilen yönü (yer yoksa otomatik ters çevrilir). */
  placement?: "top" | "bottom" | "auto";
};

type Rect = { top: number; left: number; width: number; height: number };

const SPOT_PAD = 8; // hedef çevresindeki boşluk (px)
const CARD_W = 340; // baloncuk genişliği (px)
const CARD_GAP = 14; // hedef ile baloncuk arası boşluk (px)
const VIEW_MARGIN = 12; // viewport kenar payı (px)

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function measure(selector: string): Rect | null {
  try {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null; // görünmez/collapsed
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  } catch {
    return null;
  }
}

/** Verilen seçici(ler) içinden GÖRÜNÜR olan ilkini çöz — desktop/mobil çıpa seçimi. */
function resolveVisible(sel: string | string[]): { selector: string; rect: Rect } | null {
  const list = Array.isArray(sel) ? sel : [sel];
  for (const s of list) {
    const r = measure(s);
    if (r) return { selector: s, rect: r };
  }
  return null;
}

export function ProductTour({
  steps,
  open,
  onClose,
  language,
}: {
  steps: TourStep[];
  open: boolean;
  /** `shown`: tur en az bir adımı GERÇEKTEN gösterdi mi. false ise (hedef bulunamadı)
   *  çağıran "görüldü" işaretlememeli ki sonra tekrar denenebilsin. */
  onClose: (completed: boolean, shown: boolean) => void;
  language: Language;
}) {
  const tr = language === "tr";
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const rafRef = useRef<number | null>(null);
  const shownRef = useRef(false); // en az bir adım gösterildi mi
  const reduce = prefersReducedMotion();

  // İleri/geri gezinirken hedefi olan bir sonraki adımı bul (hedefsiz adımları atla).
  const findStepWithTarget = useCallback(
    (from: number, dir: 1 | -1): number => {
      let i = from;
      while (i >= 0 && i < steps.length) {
        if (resolveVisible(steps[i]!.selector)) return i;
        i += dir;
      }
      return -1;
    },
    [steps],
  );

  // Açılışta ilk hedefli adıma konumlan.
  useEffect(() => {
    if (!open) return;
    setReady(false);
    const first = findStepWithTarget(0, 1);
    if (first < 0) {
      onClose(false, false); // gösterilecek hedef yok → "görüldü" işaretleme, tekrar denenebilsin
      return;
    }
    setIndex(first);
  }, [open, findStepWithTarget, onClose]);

  const step = steps[index];

  // Hedefi görünüme kaydır + ölç. Adım değişince çalışır.
  useLayoutEffect(() => {
    if (!open || !step) return;
    let cancelled = false;
    setReady(false);
    const resolved = resolveVisible(step.selector);
    if (!resolved) {
      // Görünür hedef yok → sonraki hedefli adıma geç (yoksa bitir).
      const next = findStepWithTarget(index + 1, 1);
      if (next < 0) onClose(false, shownRef.current);
      else setIndex(next);
      return;
    }
    const activeSelector = resolved.selector;
    document
      .querySelector(activeSelector)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center", inline: "nearest" });
    // Kaydırma otursun diye kısa gecikme, sonra ölç.
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const r = measure(activeSelector);
      if (r) {
        setRect(r);
        setReady(true);
        shownRef.current = true; // en az bir adım gerçekten gösterildi
      }
    }, reduce ? 0 : 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, step, index, findStepWithTarget, onClose, reduce]);

  // Resize/scroll'da yeniden ölç (rAF ile throttle).
  useEffect(() => {
    if (!open || !step) return;
    const onMove = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const resolved = resolveVisible(step.selector);
        if (resolved) setRect(resolved.rect);
      });
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, step]);

  const isLast = useCallback(() => findStepWithTarget(index + 1, 1) < 0, [findStepWithTarget, index]);
  const isFirst = useCallback(() => findStepWithTarget(index - 1, -1) < 0, [findStepWithTarget, index]);

  const goNext = useCallback(() => {
    const next = findStepWithTarget(index + 1, 1);
    if (next < 0) onClose(true, shownRef.current);
    else setIndex(next);
  }, [findStepWithTarget, index, onClose]);

  const goBack = useCallback(() => {
    const prev = findStepWithTarget(index - 1, -1);
    if (prev >= 0) setIndex(prev);
  }, [findStepWithTarget, index]);

  // Klavye gezintisi.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false, shownRef.current);
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goBack, onClose]);

  if (!open || !step || !rect || !ready) {
    // Overlay'i erken göstermeyelim (hedef ölçülene dek boş kalır → zıplama olmaz).
    return open ? <div className="fixed inset-0 z-[200] bg-slate-950/60" aria-hidden /> : null;
  }

  // Spotlight kutusu (hedef + padding).
  const spot = {
    top: Math.max(0, rect.top - SPOT_PAD),
    left: Math.max(0, rect.left - SPOT_PAD),
    width: rect.width + SPOT_PAD * 2,
    height: rect.height + SPOT_PAD * 2,
  };

  // Baloncuk konumu: altta yer varsa alta, yoksa üste. Yatayda viewport'a sıkıştır.
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const spaceBelow = vh - (spot.top + spot.height);
  const placeBelow =
    step.placement === "bottom" ? true : step.placement === "top" ? false : spaceBelow > 220;
  const cardTop = placeBelow ? spot.top + spot.height + CARD_GAP : undefined;
  const cardBottom = placeBelow ? undefined : vh - spot.top + CARD_GAP;
  let cardLeft = spot.left + spot.width / 2 - CARD_W / 2;
  cardLeft = Math.min(Math.max(VIEW_MARGIN, cardLeft), vw - CARD_W - VIEW_MARGIN);

  // Görünür (hedefli) adım sırası — ilerleme göstergesi için.
  const visibleSteps: number[] = [];
  for (let i = 0; i < steps.length; i++) if (resolveVisible(steps[i]!.selector)) visibleSteps.push(i);
  const posInVisible = visibleSteps.indexOf(index);
  const totalVisible = visibleSteps.length;

  const trans = reduce ? "none" : "top .35s cubic-bezier(.4,0,.2,1), left .35s cubic-bezier(.4,0,.2,1), width .35s cubic-bezier(.4,0,.2,1), height .35s cubic-bezier(.4,0,.2,1)";

  return (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label={tr ? "Kullanım turu" : "Product tour"}
      // Overlay tıklamalarını yut (kullanıcı yanlışlıkla arka planla etkileşmesin).
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Spotlight: dev box-shadow ile her yeri karart, hedefi aç + cyan halka/parıltı. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          borderRadius: 14,
          boxShadow:
            "0 0 0 9999px rgba(2,6,23,0.74), 0 0 0 2px rgba(34,211,238,0.75), 0 0 42px rgba(34,211,238,0.35)",
          transition: trans,
          pointerEvents: "none",
        }}
      />

      {/* Açıklama baloncuğu */}
      <div
        style={{
          position: "fixed",
          top: cardTop,
          bottom: cardBottom,
          left: cardLeft,
          width: CARD_W,
          maxWidth: `calc(100vw - ${VIEW_MARGIN * 2}px)`,
        }}
        className="rounded-2xl border border-cyan-400/25 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onClose(false, shownRef.current)}
          aria-label={tr ? "Turu kapat" : "Close tour"}
          className="absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-cyan-300 ring-1 ring-cyan-400/25">
            {posInVisible + 1} / {totalVisible}
          </span>
        </div>

        <h3 className="mt-2.5 pr-6 text-[16px] font-bold leading-tight text-white">{step.title}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-300">{step.body}</p>

        {/* İlerleme noktaları */}
        <div className="mt-4 flex items-center gap-1.5">
          {visibleSteps.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                i === posInVisible ? "w-5 bg-cyan-400" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onClose(false, shownRef.current)}
            className="text-[12.5px] font-medium text-slate-400 transition hover:text-slate-200"
          >
            {tr ? "Turu atla" : "Skip tour"}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst() && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 rounded-xl border border-white/12 px-3 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.06]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {tr ? "Geri" : "Back"}
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_28px_-10px_rgba(34,211,238,0.7)] transition hover:from-cyan-400 hover:to-blue-500"
            >
              {isLast() ? (
                <>
                  {tr ? "Bitir" : "Finish"}
                  <Check className="h-4 w-4" />
                </>
              ) : (
                <>
                  {tr ? "İleri" : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
