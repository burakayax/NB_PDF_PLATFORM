import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CircleCheck, FileUser, Lock, MoveHorizontal, SquareSplitHorizontal, type LucideIcon } from "lucide-react";
import type { Language } from "../../i18n/landing";

/**
 * ÜRÜN GALERİSİ — "sekmeli ürün turu".
 *
 * Solda ne göreceğini söyleyen sekmeler, sağda tek bir büyük çerçeve: ziyaretçi sırayla
 * gezerken hep aynı yere bakar, çerçeve zıplamaz.
 *
 * Görseller uygulamanın kendisinden alınmış gerçek ekran görüntüleridir (örnek belge ve örnek
 * CV bilgileriyle). Dile göre ayrı görsel tutulur; bir ekranın İngilizce arayüzü eksikse o ekran
 * İngilizce turda hiç gösterilmez (Türkçe arayüzlü görseli İngilizce ziyaretçiye göstermeyiz).
 *
 * Erişilebilirlik: gerçek `tablist/tab/tabpanel` rolleri, ok tuşlarıyla gezinme. Otomatik geçiş;
 * fareyle üstüne gelince, odaklanınca ve "hareketi azalt" ayarında durur.
 */

type Copy = { label: string; desc: string; badge: string; path: string; alt: string };
type Shot = {
  id: string;
  Icon: LucideIcon;
  /** Renk (r,g,b) — sekme vurgusu ve çerçeve ışıması */
  accent: string;
  /** Dil → masaüstü görsel yolu; yoksa o dilde gösterilmez */
  img: Partial<Record<Language, string>>;
  /** Dil → telefon görseli (dar ekranda telefon çerçevesinde gösterilir) */
  mimg: Record<Language, string>;
  tr: Copy;
  en: Copy;
};

const SHOTS: Shot[] = [
  {
    id: "cv",
    Icon: FileUser,
    accent: "99,102,241",
    img: { tr: "/screenshots/tour-cv.webp", en: "/screenshots/tour-cv-en.webp" },
    mimg: { tr: "/screenshots/tour-m-cv.webp", en: "/screenshots/tour-m-cv-en.webp" },
    tr: {
      label: "CV'nizi canlı oluşturun",
      desc: "30 şablondan birini seçin, bilgilerinizi yazın; CV'niz yanda anında şekillensin. Hazır olunca tek tıkla PDF.",
      badge: "Bilgileriniz cihazınızda kalır",
      path: "pdfplatform.app/tools/cv-olustur",
      alt: "CV Oluştur: şablon seçimi, canlı PDF önizlemesi, CV gücü puanı ve tasarım ayarları",
    },
    en: {
      label: "Build your CV live",
      desc: "Pick one of 30 templates and type your details; your CV takes shape beside you as you write. One click to PDF.",
      badge: "Your details stay on your device",
      path: "pdfplatform.app/en/tools/cv-maker",
      alt: "CV Maker: template picker, live PDF preview, CV strength score and design settings",
    },
  },
  {
    id: "pages",
    Icon: SquareSplitHorizontal,
    accent: "59,130,246",
    img: { tr: "/screenshots/tour-pages.webp", en: "/screenshots/tour-pages-en.webp" },
    mimg: { tr: "/screenshots/tour-m-pages.webp", en: "/screenshots/tour-m-pages-en.webp" },
    tr: {
      label: "Sayfaları görerek seçin",
      desc: "Sayfa numarası tahmin etmek yok. Küçük görsellere tıklayın, hangi sayfaları aldığınızı gözünüzle görün.",
      badge: "Ücretsiz · üyeliksiz",
      path: "pdfplatform.app/tools/split-pdf",
      alt: "PDF Ayır: sayfa küçük görselleri, seçili sayfalar işaretli",
    },
    en: {
      label: "Pick pages by eye",
      desc: "No guessing page numbers. Click the thumbnails and see exactly which pages you are taking.",
      badge: "Free · no sign-up",
      path: "pdfplatform.app/en/tools/split-pdf",
      alt: "Split PDF: page thumbnails with the chosen pages highlighted",
    },
  },
  {
    id: "order",
    Icon: MoveHorizontal,
    accent: "16,185,129",
    img: { tr: "/screenshots/tour-order.webp", en: "/screenshots/tour-order-en.webp" },
    mimg: { tr: "/screenshots/tour-m-order.webp", en: "/screenshots/tour-m-order-en.webp" },
    tr: {
      label: "Sırayı değiştirin",
      desc: "Sayfaları ok düğmeleriyle ya da hedef numarayı yazarak taşıyın; sonucu indirmeden önce görün.",
      badge: "Ücretsiz · üyeliksiz",
      path: "pdfplatform.app/tools/organize-pdf",
      alt: "PDF Sayfa Düzenleme: sayfa kartları ve sıra değiştirme düğmeleri",
    },
    en: {
      label: "Reorder with a click",
      desc: "Move pages with the arrow buttons or by typing a target number, and check the result before you download.",
      badge: "Free · no sign-up",
      path: "pdfplatform.app/en/tools/organize-pdf",
      alt: "Organize PDF: page cards with reorder buttons",
    },
  },
];

const AUTO_MS = 7000;

/** Dar ekran (telefon) mı? Yalnızca bir görsel yüklensin diye CSS yerine durum olarak izlenir. */
function usePhone(): boolean {
  const q = "(max-width: 639px)";
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setPhone(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

export function ProductGallery({
  language,
  onUseWebApp,
}: {
  language: Language;
  onUseWebApp: () => void;
}) {
  const tr = language === "tr";
  const shots = SHOTS.filter((s) => s.img[language]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const phone = usePhone();

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Otomatik ilerleme — durdurulabilir, hareketi azalt ayarına saygılı.
  useEffect(() => {
    if (paused || reduceMotion) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % shots.length), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [active, paused, reduceMotion, shots.length]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setActive((i) => (e.key === "ArrowRight" ? (i + 1) % shots.length : (i - 1 + shots.length) % shots.length));
      const next = tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
      next?.forEach((b) => b.getAttribute("aria-selected") === "true" && b.focus());
    },
    [shots.length],
  );

  const shot = shots[Math.min(active, shots.length - 1)];
  const copy = shot[language];
  const src = shot.img[language] as string;

  return (
    <section id="showcase" className="relative overflow-hidden px-5 py-14 sm:px-8 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.09)_0%,transparent_60%)]" />

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
            {tr ? "Ürünü yakından görün" : "See the product up close"}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            {tr
              ? "Bu görüntüler uygulamanın kendisinden alındı; yalnızca örnek belge ve örnek CV bilgileri kullanıldı."
              : "These are screenshots of the app itself, using only a sample document and a sample CV."}
          </p>
        </motion.div>

        {/* Sekmeler + çerçeve */}
        <div
          className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:items-center lg:gap-12"
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
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-3 lg:overflow-visible lg:pb-0"
          >
            {shots.map((s, i) => {
              const on = i === active;
              const c = s[language];
              const TabIcon = s.Icon;
              return (
                <button
                  key={s.id}
                  role="tab"
                  id={`tab-${s.id}`}
                  aria-selected={on}
                  aria-controls={`shot-${s.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-2xl border px-4 py-4 text-left transition duration-200 lg:flex-shrink ${
                    on
                      ? "border-white/20 bg-white/[0.07]"
                      : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
                  }`}
                  style={on ? { boxShadow: `0 18px 40px -24px rgba(${s.accent},0.8)` } : undefined}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10"
                      style={{
                        background: `linear-gradient(140deg, rgba(${s.accent},0.34), rgba(${s.accent},0.08))`,
                        color: `rgb(${s.accent})`,
                      }}
                    >
                      <TabIcon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <span className={`whitespace-nowrap text-[14px] font-bold lg:whitespace-normal ${on ? "text-white" : "text-slate-300"}`}>
                      {c.label}
                    </span>
                  </span>

                  {/* Açıklama + güven etiketi yalnız geniş ekranda; dar ekranda sekme çip gibi durur */}
                  <span className="mt-2.5 hidden text-[13px] leading-relaxed text-slate-400 lg:block">{c.desc}</span>
                  <span className="mt-3 hidden items-center gap-1.5 text-[11.5px] font-semibold text-slate-300 lg:inline-flex">
                    <CircleCheck className="h-3.5 w-3.5" style={{ color: `rgb(${s.accent})` }} aria-hidden="true" />
                    {c.badge}
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
                        transition={{ duration: paused ? 0 : AUTO_MS / 1000, ease: "linear" }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Çerçeve: telefonda telefon, diğerlerinde tarayıcı */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -bottom-10 top-8 -z-10 blur-[80px] transition-colors duration-500"
              style={{ background: `rgba(${shot.accent},0.22)` }}
            />
            {phone ? (
              <div className="mx-auto w-[min(100%,270px)] rounded-[2.4rem] border border-white/[0.14] bg-[#05080f] p-2 shadow-[0_40px_90px_-35px_rgba(0,0,0,0.95)] ring-1 ring-black/40">
                <div className="relative aspect-[390/844] overflow-hidden rounded-[1.9rem] bg-[#070d19]">
                  <span aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-black/80" />
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${shot.id}-${language}-m`}
                      id={`shot-${shot.id}`}
                      role="tabpanel"
                      aria-labelledby={`tab-${shot.id}`}
                      src={shot.mimg[language]}
                      alt={copy.alt}
                      width={780}
                      height={1688}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b1220] shadow-[0_50px_110px_-40px_rgba(0,0,0,0.95)] ring-1 ring-black/40">
                {/* Üst çubuk */}
                <div className="flex items-center gap-3 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.02] px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((n) => (
                      <span key={n} className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    ))}
                  </span>
                  <span className="mx-auto flex max-w-[340px] flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.07] bg-black/30 px-3 py-1 text-[11px] text-slate-400">
                    <Lock className="h-3 w-3 text-emerald-400/80" aria-hidden="true" />
                    <span className="truncate">{copy.path}</span>
                  </span>
                  <span className="w-[42px]" aria-hidden="true" />
                </div>

                {/* Görsel */}
                <div className="relative aspect-[16/10] bg-[#070d19]">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={`${shot.id}-${language}`}
                      id={`shot-${shot.id}`}
                      role="tabpanel"
                      aria-labelledby={`tab-${shot.id}`}
                      src={src}
                      alt={copy.alt}
                      width={1920}
                      height={1200}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      initial={{ opacity: 0, scale: 1.012 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Dar ekranda açıklama çerçevenin altında */}
            <div className="mt-4 text-center lg:hidden">
              <p className="text-[13px] leading-relaxed text-slate-400">{copy.desc}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-300">
                <CircleCheck className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {copy.badge}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={onUseWebApp}
            className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 font-semibold text-white shadow-[0_0_50px_-8px_rgba(99,102,241,0.7)] transition hover:from-blue-500 hover:to-indigo-500"
          >
            {tr ? "Kendin dene — ücretsiz" : "Try it yourself — free"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
