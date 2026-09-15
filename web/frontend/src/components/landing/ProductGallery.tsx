import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crop,
  LayoutGrid,
  PenLine,
  SquareSplitHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "../../i18n/landing";
import { langAsset, langAssetFallback } from "../../lib/langAsset";

/**
 * ÜRÜN GALERİSİ — SaaS sitelerinin standart "sekmeli ürün turu" düzeni.
 *
 * Neden bu düzen: Tek bir ekran görüntüsü ürünün genişliğini anlatamaz; yan yana
 * dizilmiş birden çok görsel ise dikkati dağıtır. Solda ne göreceğini söyleyen
 * sekmeler, sağda tek bir büyük çerçeve → ziyaretçi sırayla gezerken hep aynı
 * yere bakar, çerçeve zıplamaz.
 *
 * Görseller dile göre değişir (`langAsset`): Türkçe kullanıcıya Türkçe arayüz,
 * İngilizce kullanıcıya İngilizce arayüz gösterilir.
 *
 * Erişilebilirlik: sekmeler gerçek `tablist/tab/tabpanel` rolleriyle kurulur,
 * ok tuşlarıyla gezilir. Otomatik geçiş; fareyle üstüne gelince, odaklanınca ve
 * kullanıcı "hareketi azalt" dediğinde durur.
 */

type Shot = {
  id: string;
  Icon: LucideIcon;
  /** Kaynak yol (Türkçe). EN sürümü `-en` ekiyle otomatik aranır. */
  img: string;
  accent: string;
  tr: { label: string; desc: string };
  en: { label: string; desc: string };
};

const SHOTS: Shot[] = [
  {
    id: "workspace",
    Icon: LayoutGrid,
    img: "/screenshots/app-workspace.png",
    accent: "59,130,246",
    tr: {
      label: "Tek çalışma alanı",
      desc: "40 aracın tamamı soldaki menüde. Dosyanı bir kez yükle, araçlar arasında kaybolmadan geç.",
    },
    en: {
      label: "One workspace",
      desc: "All 40 tools in the side menu. Load your file once and move between tools without losing it.",
    },
  },
  {
    id: "pages",
    Icon: SquareSplitHorizontal,
    img: "/screenshots/app-pages.png",
    accent: "139,92,246",
    tr: {
      label: "Sayfaları görerek seç",
      desc: "Sayfa numarası tahmin etmek yok. Küçük görsellere tıkla, ne aldığını gözünle gör.",
    },
    en: {
      label: "Pick pages by eye",
      desc: "No guessing page numbers. Click the thumbnails and see exactly what you are taking.",
    },
  },
  {
    id: "editor",
    Icon: PenLine,
    img: "/screenshots/app-editor.png",
    accent: "6,182,212",
    tr: {
      label: "Belgeyi gerçekten düzenle",
      desc: "Mevcut yazıyı sil, yenisini yaz, görsel ekle. Üstünü kapatan bir yama değil, gerçek düzenleme.",
    },
    en: {
      label: "Really edit the document",
      desc: "Delete existing text, type new text, add images — real editing, not a patch over the top.",
    },
  },
  {
    id: "crop",
    Icon: Crop,
    img: "/screenshots/app-crop.png",
    accent: "16,185,129",
    tr: {
      label: "Anında önizleme",
      desc: "Kırpma kutusunu sürükle, sonucu aynı anda gör. İndirmeden önce sürprizle karşılaşma.",
    },
    en: {
      label: "Instant preview",
      desc: "Drag the crop box and watch the result live. No surprises after you download.",
    },
  },
];

const AUTO_MS = 7000;

export function ProductGallery({
  language,
  onUseWebApp,
}: {
  language: Language;
  onUseWebApp: () => void;
}) {
  const tr = language === "tr";
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Otomatik ilerleme — durdurulabilir, hareketi azalt ayarına saygılı.
  useEffect(() => {
    if (paused || reduceMotion) return;
    const t = window.setTimeout(
      () => setActive((i) => (i + 1) % SHOTS.length),
      AUTO_MS,
    );
    return () => window.clearTimeout(t);
  }, [active, paused, reduceMotion]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setActive((i) =>
      e.key === "ArrowRight"
        ? (i + 1) % SHOTS.length
        : (i - 1 + SHOTS.length) % SHOTS.length,
    );
    const next = tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    next?.forEach((b) => b.getAttribute("aria-selected") === "true" && b.focus());
  }, []);

  const shot = SHOTS[active];
  const copy = shot[language];

  return (
    <section id="showcase" className="relative overflow-hidden px-5 py-24 sm:px-8 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06)_0%,transparent_65%)]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {tr ? "Ürün Turu" : "Product Tour"}
          </span>
          <h2
            className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-[2.75rem]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Ekranlarla tanışın" : "See it in action"}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            {tr
              ? "Aşağıdaki görüntülerin hepsi gerçek uygulamadan — tanıtım için hazırlanmış çizimler değil."
              : "Every shot below comes from the real app — not a marketing illustration."}
          </p>
        </motion.div>

        {/* Sekmeler + çerçeve */}
        <div
          className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {/* Sekme listesi */}
          <div
            ref={tabsRef}
            role="tablist"
            aria-label={tr ? "Ürün ekranları" : "Product screens"}
            onKeyDown={onKeyDown}
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-2.5 lg:overflow-visible lg:pb-0"
          >
            {SHOTS.map((s, i) => {
              const on = i === active;
              const c = s[language];
              const TabIcon = s.Icon;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={on}
                  aria-controls={`shot-${s.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition duration-200 lg:flex-shrink ${
                    on
                      ? "border-white/20 bg-white/[0.07]"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
                  }`}
                  style={
                    on
                      ? { boxShadow: `0 18px 40px -24px rgba(${s.accent},0.8)` }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10"
                      style={{
                        background: `linear-gradient(140deg, rgba(${s.accent},0.32), rgba(${s.accent},0.08))`,
                        color: `rgb(${s.accent})`,
                      }}
                    >
                      <TabIcon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span
                      className={`whitespace-nowrap text-[13.5px] font-bold lg:whitespace-normal ${
                        on ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {c.label}
                    </span>
                  </span>

                  {/* Açıklama yalnız geniş ekranda; dar ekranda çip gibi durur */}
                  <span className="mt-2 hidden text-[12.5px] leading-relaxed text-slate-400 lg:block">
                    {c.desc}
                  </span>

                  {/* Otomatik geçiş göstergesi */}
                  {on && !reduceMotion && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
                      <motion.span
                        key={`${s.id}-${paused ? "p" : "r"}`}
                        className="block h-full"
                        style={{ background: `rgb(${s.accent})` }}
                        initial={{ width: "0%" }}
                        animate={{ width: paused ? "0%" : "100%" }}
                        transition={{
                          duration: paused ? 0 : AUTO_MS / 1000,
                          ease: "linear",
                        }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tarayıcı çerçevesi */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-6 -bottom-8 top-10 -z-10 blur-[70px] transition-colors duration-500"
              style={{ background: `rgba(${shot.accent},0.18)` }}
            />
            <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b1220] shadow-[0_50px_110px_-40px_rgba(0,0,0,0.95)]">
              {/* Üst çubuk */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <span className="flex gap-1.5">
                  {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                    <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  ))}
                </span>
                <span className="mx-auto flex max-w-[280px] flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.06] bg-black/30 px-3 py-1 text-[11px] text-slate-400">
                  pdfplatform.app
                </span>
                <span className="w-[42px]" />
              </div>

              {/* Görsel */}
              <div className="relative aspect-[16/9]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={shot.id}
                    id={`shot-${shot.id}`}
                    role="tabpanel"
                    src={langAsset(shot.img, language)}
                    onError={langAssetFallback(shot.img)}
                    alt={copy.label}
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                    initial={{ opacity: 0, scale: 1.015 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  />
                </AnimatePresence>
              </div>
            </div>

            {/* Dar ekranda açıklama çerçevenin altında */}
            <p className="mt-4 text-center text-[13px] leading-relaxed text-slate-400 lg:hidden">
              {copy.desc}
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onUseWebApp}
            className="inline-flex h-12 min-w-[210px] items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 font-semibold text-white shadow-[0_0_50px_-8px_rgba(99,102,241,0.7)] transition hover:from-blue-500 hover:to-indigo-500"
          >
            {tr ? "Kendin dene — ücretsiz" : "Try it yourself — free"}
          </button>
        </div>
      </div>
    </section>
  );
}
