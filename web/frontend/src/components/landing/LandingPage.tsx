/*
  TO ADD SCREENSHOTS:
  - Web app:     public/screenshots/web-app.png     (önerilen: 1280×800px)
  - Desktop app: public/screenshots/desktop-app.png (önerilen: 1280×800px)
  Dosyalar bu konuma yerleştirildiğinde sayfa otomatik olarak gösterir.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { landingTranslations, type Language } from "../../i18n/landing";
import { getWindowsDownloadUrlFromCms } from "../../lib/landingCmsMerge";
import { useSettings } from "../../hooks/useSettings";
import { CrawlableLink } from "../seo/CrawlableLink";
import PdfToolsSection from "../ui/pdf-tools-section";
import PricingSection from "../ui/pricing-section";
import { LandingIcon } from "./LandingIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onUseWebApp: () => void;
  isAuthenticated: boolean;
  authGreeting?: string;
  onLogin: () => void;
  onRegister: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenKvkk: () => void;
  onContactClick: () => void;
  onOpenAbout: () => void;
  canonicalBaseUrl?: string;
  organizationName?: string;
  onSelectPlan?: (planId: "STARTER" | "PLUS" | "PRO" | "BUSINESS") => void;
};

type ShowcaseTab = "web" | "desktop";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function injectFonts() {
  if (document.getElementById("nb-lp-fonts")) return;
  const link = document.createElement("link");
  link.id = "nb-lp-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function useInViewOnce(ref: React.RefObject<Element | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}


// ─── Animated Background ──────────────────────────────────────────────────────

function GradientBackground() {
  return (
    <>
      <style>{`
        @keyframes gb-drift-a {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(4%,6%) scale(1.06); }
        }
        @keyframes gb-drift-b {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-5%,-4%) scale(1.08); }
        }
        @keyframes gb-drift-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(3%,-5%) scale(1.05); }
        }
        @keyframes gb-noise {
          0%,100% { opacity: 0.035; }
          50%      { opacity: 0.055; }
        }
      `}</style>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: -1, overflow: "hidden", background: "#080b14" }}
        aria-hidden="true"
      >
        {/* Blob A – derin mavi sol üst */}
        <div style={{
          position: "absolute", top: "-30%", left: "-20%",
          width: "80vw", height: "80vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, rgba(29,78,216,0.18), transparent 60%)",
          animation: "gb-drift-a 26s ease-in-out infinite",
          filter: "blur(120px)",
        }} />
        {/* Blob B – indigo sağ */}
        <div style={{
          position: "absolute", top: "-10%", right: "-25%",
          width: "65vw", height: "65vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 55% 40%, rgba(67,56,202,0.14), transparent 60%)",
          animation: "gb-drift-b 34s ease-in-out infinite",
          filter: "blur(130px)",
        }} />
        {/* Blob C – cyan-blue ince çizgi sol orta */}
        <div style={{
          position: "absolute", top: "40%", left: "-5%",
          width: "45vw", height: "45vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 45% 50%, rgba(14,116,144,0.12), transparent 60%)",
          animation: "gb-drift-c 20s ease-in-out infinite",
          filter: "blur(100px)",
        }} />
        {/* Üst ince parlak şerit */}
        <div style={{
          position: "absolute", top: 0, left: "15%",
          width: "70%", height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)",
        }} />
        {/* Noise doku katmanı */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
          animation: "gb-noise 8s ease-in-out infinite",
          mixBlendMode: "overlay",
        }} />
      </div>
    </>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({
  language,
  onLanguageChange,
  isAuthenticated,
  authGreeting,
  onLogin,
  onRegister,
  onUseWebApp,
  windowsDownloadUrl,
}: {
  language: Language;
  onLanguageChange: (l: Language) => void;
  isAuthenticated: boolean;
  authGreeting?: string;
  onLogin: () => void;
  onRegister: () => void;
  onUseWebApp: () => void;
  windowsDownloadUrl: string;
}) {
  const scrolled = useScrolled();
  const tr = language === "tr";
  const copy = landingTranslations[language];
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    if (langOpen) {
      document.addEventListener("mouseup", onDoc);
    }
    return () => document.removeEventListener("mouseup", onDoc);
  }, [langOpen]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/55 backdrop-blur-xl border-b border-white/[0.07]"
          : "bg-black/20 backdrop-blur-md"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={copy.navbar.productLabel}
          className="flex items-center group shrink-0"
        >
          <img
            src="/navbar-logo.png"
            alt="PDF PLATFORM"
            className="h-14 w-auto object-contain transition-opacity group-hover:opacity-90"
          />
        </button>

        {/* Nav links */}
        <nav
          className="hidden md:flex items-center gap-1"
          aria-label="Ana navigasyon"
        >
          {[
            ["#showcase", tr ? "Önizleme" : "Preview"],
            ["#tools", tr ? "Araçlar" : "Tools"],
            ["#pricing", tr ? "Fiyat" : "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <CrawlableLink
              key={href}
              href={href}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
            >
              {label}
            </CrawlableLink>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-all"
              aria-label={tr ? "Dil seçimi" : "Language"}
            >
              <span className="text-cyan-400 uppercase">{language}</span>
              <svg
                className={`w-3 h-3 text-gray-500 transition-transform ${langOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-32 rounded-xl border border-white/10 bg-[#0f172a] shadow-2xl overflow-hidden">
                {(["tr", "en"] as Language[]).map((l) => (
                  <button
                    key={l}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onLanguageChange(l);
                      setLangOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-xs font-semibold text-left transition-colors ${language === l ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                  >
                    {l === "tr" ? "🇹🇷 Türkçe" : "🇬🇧 English"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <>
              <span className="hidden sm:block max-w-[140px] truncate text-sm text-gray-300">
                {authGreeting}
              </span>
              <button
                onClick={onUseWebApp}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all"
              >
                {copy.navbar.openWorkspace}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onLogin}
                className="h-9 px-4 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all hidden sm:flex items-center"
              >
                {copy.navbar.login}
              </button>
              <button
                onClick={onRegister}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_24px_rgba(59,130,246,0.4)] hover:shadow-[0_0_32px_rgba(99,102,241,0.6)] transition-all"
              >
                {copy.navbar.register}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  language,
  onUseWebApp,
  windowsDownloadUrl,
}: {
  language: Language;
  onUseWebApp: () => void;
  windowsDownloadUrl: string;
}) {
  const tr = language === "tr";
  const copy = landingTranslations[language];

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 28 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  });

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-16 px-5 sm:px-8 text-center overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          {...stagger(0)}
          className="mb-8 inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-blue-500/25 bg-blue-500/10 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
              style={{
                animation: "lp-ping-slow 1.5s cubic-bezier(0,0,0.2,1) infinite",
              }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-300">
            {tr
              ? "Web + Masaüstü · PDF Araçları Platformu"
              : "Web + Desktop · PDF Tools Platform"}
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          {...stagger(1)}
          className="text-[2.6rem] sm:text-6xl md:text-7xl font-black leading-[1.08] tracking-tight text-white"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {tr ? (
            <>
              PDF İşlemlerini
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Hızla ve Güvenle
              </span>{" "}
              Tamamla
            </>
          ) : (
            <>
              Process PDFs
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Faster and Safer
              </span>{" "}
              Than Ever
            </>
          )}
        </motion.h1>

        {/* Subheading */}
        <motion.p
          {...stagger(2)}
          className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {copy.hero.description}
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...stagger(3)}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.button
            onClick={onUseWebApp}
            whileHover={{ y: -4, boxShadow: "0 24px 60px rgba(59,130,246,0.55), 0 0 0 1px rgba(99,102,241,0.35)" }}
            whileTap={{ scale: 0.97, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="group relative inline-flex h-13 items-center justify-center px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base shadow-2xl shadow-blue-500/30 hover:from-blue-500 hover:to-indigo-500 transition-colors overflow-hidden"
          >
            <div
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:translate-x-full transition-transform duration-500"
              aria-hidden="true"
            />
            <span className="relative">
              {tr
                ? "Ücretsiz Başla — Kredi Kartı Gerekmez"
                : "Start Free — No Credit Card"}
            </span>
          </motion.button>
          <div className="relative">
            <span className="inline-flex h-13 items-center gap-3 px-8 rounded-2xl border border-white/15 bg-white/[0.05] text-white font-semibold text-base opacity-50 cursor-not-allowed">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              {copy.hero.secondaryCta}
            </span>
            <span className="absolute -top-2 -right-1 bg-amber-500 text-[11px] font-bold text-white px-2 py-0.5 rounded-full whitespace-nowrap">
              {tr ? "Yakında" : "Coming"}
            </span>
          </div>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          {...stagger(4)}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500"
        >
          {[
            "🔒 SSL " + (tr ? "Şifreli" : "Encrypted"),
            "⭐ 4.9/5 " + (tr ? "Puan" : "Rating"),
            "👥 1,000+ " + (tr ? "Kullanıcı" : "Users"),
            "🔄 99.9% " + (tr ? "Çalışma Süresi" : "Uptime"),
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </motion.div>

        {/* Audience pills */}
        <motion.div
          {...stagger(5)}
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          {copy.hero.audience.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300"
            >
              <span
                className="w-1 h-1 rounded-full bg-blue-400"
                aria-hidden="true"
              />
              {tag}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ language }: { language: Language }) {
  const tr = language === "tr";
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref as React.RefObject<Element>);

  const stats = [
    {
      value: 1000,
      suffix: "+",
      label: tr ? "Aktif Kullanıcı" : "Active Users",
    },
    { value: 20, suffix: "+", label: tr ? "PDF Aracı" : "PDF Tools" },
    {
      value: 99.9,
      suffix: "%",
      label: tr ? "Çalışma Süresi" : "Uptime SLA",
      decimals: 1,
    },
    {
      value: 100,
      suffix: "%",
      label: tr ? "Tarayıcı Tabanlı" : "Browser-Based",
    },
  ];

  return (
    <div
      ref={ref}
      className="border-y border-white/[0.06] bg-white/[0.015] backdrop-blur-sm py-12"
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="text-center"
          >
            <div className="flex items-baseline justify-center gap-0.5">
              {inView ? (
                <NumberFlow
                  value={s.value}
                  format={
                    s.decimals
                      ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                      : {}
                  }
                  className="text-4xl sm:text-5xl font-black text-white"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  transformTiming={{ duration: 800, easing: "ease-out" }}
                />
              ) : (
                <span
                  className="text-4xl sm:text-5xl font-black text-white"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  0
                </span>
              )}
              <span className="text-2xl font-black text-blue-400">
                {s.suffix}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Product Showcase ─────────────────────────────────────────────────────────

const SHOWCASE_PILLS = (tr: boolean) => [
  {
    pos: "absolute -top-4 left-[8%] sm:-top-5 sm:left-[5%]",
    icon: "🔄",
    label: tr ? "Gerçek Zamanlı" : "Real-time Sync",
  },
  {
    pos: "absolute -top-4 right-[8%] sm:-top-5 sm:right-[5%]",
    icon: "🔒",
    label: tr ? "256-bit Şifre" : "256-bit Encryption",
  },
  {
    pos: "absolute -bottom-4 left-[8%] sm:-bottom-5 sm:left-[5%]",
    icon: "☁️",
    label: tr ? "Bulut Depolama" : "Cloud Storage",
  },
  {
    pos: "absolute -bottom-4 right-[8%] sm:-bottom-5 sm:right-[5%]",
    icon: "⚡",
    label: tr ? "Anında İşlem" : "Instant Processing",
  },
];

function BrowserChrome({ screenshot }: { screenshot?: boolean }) {
  return (
    <div className="rounded-[16px] overflow-hidden border border-white/[0.1] bg-[#0D1117] shadow-[0_0_80px_rgba(59,130,246,0.15),0_40px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Chrome bar */}
      <div className="flex items-center gap-3 bg-[#111827] border-b border-white/[0.06] px-4 py-3">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-[#0D1117] border border-white/[0.07] px-3 py-1.5">
          <svg
            className="w-3 h-3 text-emerald-400 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[11px] text-gray-500 truncate">
            pdfplatform.app
          </span>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.05]"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      {/* Viewport */}
      <div className="relative aspect-video overflow-hidden">
        {screenshot ? (
          <img
            src="/screenshots/web-app.png"
            alt="PDF PLATFORM web uygulaması"
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <ScreenshotPlaceholder variant="web" />
        )}
      </div>
    </div>
  );
}

function DesktopChrome({
  screenshot,
  name,
}: {
  screenshot?: boolean;
  name: string;
}) {
  return (
    <div className="rounded-[16px] overflow-hidden border border-white/[0.1] bg-[#0D1117] shadow-[0_0_80px_rgba(139,92,246,0.12),0_40px_100px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Title bar */}
      <div className="relative flex items-center bg-[#161B27] border-b border-white/[0.06] px-4 py-3">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-[12px] font-medium text-gray-400">
              {name}
            </span>
          </div>
        </div>
        <div className="ml-auto flex gap-1 shrink-0">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.05]"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      {/* Viewport */}
      <div className="relative aspect-video overflow-hidden">
        {screenshot ? (
          <img
            src="/screenshots/desktop-app.png"
            alt="PDF PLATFORM masaüstü uygulaması"
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <ScreenshotPlaceholder variant="desktop" />
        )}
      </div>
    </div>
  );
}

function ScreenshotPlaceholder({ variant }: { variant: ShowcaseTab }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative"
      style={{
        background:
          variant === "web"
            ? "linear-gradient(135deg,#0A1628 0%,#0D1F3C 50%,#091322 100%)"
            : "linear-gradient(135deg,#0A1020 0%,#0C1829 50%,#0A1525 100%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "radial-gradient(circle,rgba(255,255,255,0.15) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="absolute opacity-30 w-[350px] h-[180px] blur-[80px] rounded-full"
        style={{
          background:
            variant === "web"
              ? "radial-gradient(ellipse,rgba(59,130,246,0.6),transparent 70%)"
              : "radial-gradient(ellipse,rgba(139,92,246,0.5),transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${variant === "web" ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-violet-500 to-purple-700"}`}
        >
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-gray-400 text-sm font-medium">
          Screenshot coming soon
        </p>
        <p className="text-gray-600 text-xs">
          {variant === "web"
            ? "Place web-app.png in /public/screenshots/"
            : "Place desktop-app.png in /public/screenshots/"}
        </p>
      </div>
    </div>
  );
}

function ProductShowcase({
  language,
  onUseWebApp,
  organizationName,
  windowsDownloadUrl,
}: {
  language: Language;
  onUseWebApp: () => void;
  organizationName: string;
  windowsDownloadUrl: string;
}) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("web");
  const tr = language === "tr";

  // /screenshots/web-app.png var mı? Vite'da runtime check mümkün değil.
  // Dosyayı public/screenshots/ altına koyduk — eğer varsa img yüklenecek, yoksa onerror gizler.
  const [webOk, setWebOk] = useState(true);
  const [deskOk, setDeskOk] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = "/screenshots/web-app.png";
    img.onload = () => setWebOk(true);
    img.onerror = () => setWebOk(false);
    const dImg = new Image();
    dImg.src = "/screenshots/desktop-app.png";
    dImg.onload = () => setDeskOk(true);
    dImg.onerror = () => setDeskOk(false);
  }, []);

  const pills = SHOWCASE_PILLS(tr);

  return (
    <section
      id="showcase"
      className="relative py-24 sm:py-32 px-5 sm:px-8 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.06)_0%,transparent_65%)]" />
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-[0.25em] mb-6">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
            </span>
            {tr ? "Ürün Önizlemesi" : "Product Preview"}
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr
              ? "Her PDF İş Akışı,\nTek Platformda"
              : "Every PDF Workflow,\nOne Platform"}
          </h2>
          <p
            className="text-gray-400 max-w-xl mx-auto"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr
              ? "Güçlü bir web uygulaması ve yerel Windows masaüstü uygulaması — tek ekosistem."
              : "A powerful web app and a native Windows desktop app — one seamless ecosystem."}
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-10">
          <div
            role="tablist"
            aria-label={tr ? "Platform seçimi" : "Platform tabs"}
            className="inline-flex items-center rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-1 backdrop-blur-md"
          >
            {(["web", "desktop"] as ShowcaseTab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${activeTab === tab ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="showcase-tab"
                    className="absolute inset-0 rounded-[10px] border border-indigo-400/20 bg-gradient-to-b from-indigo-500/30 to-indigo-700/20 shadow-[0_0_20px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                )}
                <span className="relative" aria-hidden="true">
                  {tab === "web" ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </span>
                <span className="relative">
                  {tab === "web" ? "Web App" : "Desktop App"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Frame + pills */}
        <div className="relative px-4 sm:px-8 lg:px-16">
          {/* Floating pills */}
          <AnimatePresence mode="popLayout">
            {pills.map((p, i) => (
              <motion.div
                key={`${activeTab}-pill-${i}`}
                className={`${p.pos} z-20 hidden sm:block`}
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: {
                    delay: i * 0.08 + 0.2,
                    duration: 0.38,
                    ease: [0.22, 1, 0.36, 1] as const,
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.9,
                  y: -6,
                  transition: { duration: 0.18 },
                }}
              >
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-slate-900/85 px-3 py-2 shadow-xl backdrop-blur-md whitespace-nowrap">
                  <span className="text-base">{p.icon}</span>
                  <span className="text-[11px] font-semibold text-gray-200">
                    {p.label}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Screenshot frame */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 18 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1] as const,
                },
              }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
            >
              {activeTab === "web" ? (
                <BrowserChrome screenshot={webOk} />
              ) : (
                <DesktopChrome screenshot={deskOk} name={organizationName} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Glow reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 left-1/2 -z-10 -translate-x-1/2 h-24 blur-[70px] transition-all duration-500"
            style={{
              width: "60%",
              background:
                activeTab === "web"
                  ? "rgba(59,130,246,0.25)"
                  : "rgba(139,92,246,0.2)",
            }}
          />
        </div>

        {/* CTA strip */}
        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.button
            onClick={onUseWebApp}
            whileHover={{ y: -4, boxShadow: "0 20px 55px rgba(99,102,241,0.6), 0 0 0 1px rgba(99,102,241,0.35)" }}
            whileTap={{ scale: 0.97, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="group relative inline-flex h-12 min-w-[200px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 font-semibold text-white shadow-[0_0_50px_-8px_rgba(99,102,241,0.7)] transition-all"
          >
            <div
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:translate-x-full transition-transform duration-500"
              aria-hidden="true"
            />
            <span className="relative">
              {tr ? "Ücretsiz Dene" : "Start Free Trial"}
            </span>
          </motion.button>
          <motion.div
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
          >
            <div className="relative">
              <span className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-8 font-medium text-gray-300 opacity-50 cursor-not-allowed">
                {tr ? "Masaüstü Uygulaması" : "View Live Demo"}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </span>
              <span className="absolute -top-2 -right-1 bg-amber-500 text-black text-[11px] font-bold px-2 py-1 rounded">
                {tr ? "Yakında" : "Coming"}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEAT_COLORS: Record<string, { r: string; iconBg: string; iconText: string }> = {
  merge:    { r: "59,130,246",  iconBg: "bg-blue-500/15",    iconText: "text-blue-300"    },
  split:    { r: "139,92,246",  iconBg: "bg-violet-500/15",  iconText: "text-violet-300"  },
  convert:  { r: "99,102,241",  iconBg: "bg-indigo-500/15",  iconText: "text-indigo-300"  },
  secure:   { r: "16,185,129",  iconBg: "bg-emerald-500/15", iconText: "text-emerald-300" },
  compress: { r: "245,158,11",  iconBg: "bg-amber-500/15",   iconText: "text-amber-300"   },
  excel:    { r: "34,197,94",   iconBg: "bg-green-500/15",   iconText: "text-green-300"   },
  session:  { r: "6,182,212",   iconBg: "bg-cyan-500/15",    iconText: "text-cyan-300"    },
};

function Features({ language }: { language: Language }) {
  const tr = language === "tr";
  const copy = landingTranslations[language];

  return (
    <section className="relative py-24 sm:py-32 px-5 sm:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_bottom,rgba(99,102,241,0.09)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_top,rgba(6,182,212,0.06)_0%,transparent_55%)]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6">
            ✦ {copy.features.kicker}
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white max-w-3xl mx-auto"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {copy.features.title}
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {copy.features.items.map((item, i) => {
            const col = FEAT_COLORS[item.icon] ?? FEAT_COLORS.merge;
            const isSession = item.icon === "session";
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{
                  y: -8,
                  boxShadow: `0 20px 50px rgba(${col.r},0.16), 0 0 0 1px rgba(${col.r},0.22)`,
                  transition: { duration: 0.22, ease: "easeOut" },
                }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.45 }}
                className="group relative flex flex-col gap-4 p-6 lg:p-7 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-transparent cursor-default overflow-hidden"
              >
                {/* Top accent line on hover */}
                <div
                  className="absolute inset-x-0 top-0 h-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, rgba(${col.r},0.85), transparent)` }}
                />
                {/* Radial glow from top */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% -5%, rgba(${col.r},0.11), transparent 65%)` }}
                />
                {/* Shimmer sweep */}
                <div
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"
                  style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.045) 50%, transparent 65%)" }}
                />

                {isSession && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {tr ? "Özel" : "Exclusive"}
                    </span>
                  </div>
                )}

                {/* Icon with spring hover */}
                <motion.div
                  className={`relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${col.iconBg}`}
                  whileHover={{ scale: 1.15, rotate: 8, transition: { type: "spring", stiffness: 350, damping: 10 } }}
                >
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ boxShadow: `0 0 18px rgba(${col.r},0.55)` }}
                  />
                  <LandingIcon kind={item.icon} className={`h-5 w-5 ${col.iconText} relative z-10`} />
                </motion.div>

                <div className="relative z-10">
                  <h3
                    className="text-white font-bold text-base mb-2 leading-snug"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
                    {item.benefit}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks({ language }: { language: Language }) {
  const tr = language === "tr";

  const steps = tr
    ? [
        {
          icon: "⚙️", title: "Aracı Seç",
          desc: "20+ profesyonel araç arasından seç. İşlem saniyeler içinde tamamlanır.",
          r: "59,130,246", badge: "from-blue-600 to-indigo-600",
          iconGrad: "from-blue-500/20 to-indigo-600/20",
        },
        {
          icon: "⬆️", title: "PDF'ini Yükle",
          desc: "Sürükle-bırak ya da tıkla. Tarayıcıdan anında başla.",
          r: "139,92,246", badge: "from-violet-600 to-purple-600",
          iconGrad: "from-violet-500/20 to-purple-600/20",
        },
        {
          icon: "⬇️", title: "Sonucu İndir",
          desc: "Dosyan hazır. Güvenli, gizli bir şekilde indir.",
          r: "6,182,212", badge: "from-cyan-600 to-blue-600",
          iconGrad: "from-cyan-500/20 to-blue-600/20",
        },
      ]
    : [
        {
          icon: "⬆️", title: "Upload Your PDF",
          desc: "Drag & drop or click to upload. Start instantly from your browser.",
          r: "59,130,246", badge: "from-blue-600 to-indigo-600",
          iconGrad: "from-blue-500/20 to-indigo-600/20",
        },
        {
          icon: "⚙️", title: "Choose Your Tool",
          desc: "Select from 20+ professional tools. Processing completes in seconds.",
          r: "139,92,246", badge: "from-violet-600 to-purple-600",
          iconGrad: "from-violet-500/20 to-purple-600/20",
        },
        {
          icon: "⬇️", title: "Download Result",
          desc: "Your file is ready instantly. Download it securely and privately.",
          r: "6,182,212", badge: "from-cyan-600 to-blue-600",
          iconGrad: "from-cyan-500/20 to-blue-600/20",
        },
      ];

  return (
    <section className="relative py-24 sm:py-32 px-5 sm:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.05)_0%,transparent_65%)]" />
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-6">
            ✦ {tr ? "Nasıl Çalışır?" : "How It Works"}
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "3 Adımda Tamamla" : "As Simple as 1-2-3"}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Glowing gradient connector */}
          <div className="hidden md:block absolute top-[52px] left-[calc(33%+20px)] right-[calc(33%+20px)] h-px" aria-hidden="true">
            <div className="h-full bg-gradient-to-r from-blue-500/35 via-violet-500/35 to-cyan-500/35" />
            <div className="absolute inset-0 blur-sm bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-cyan-500/30" />
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{
                y: -10,
                boxShadow: `0 24px 60px rgba(${step.r},0.2), 0 0 0 1px rgba(${step.r},0.2)`,
                transition: { duration: 0.22, ease: "easeOut" },
              }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="group relative flex flex-col items-center text-center p-7 pt-16 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent backdrop-blur-sm cursor-default overflow-visible"
            >
              {/* Top accent line */}
              <div
                className="absolute inset-x-0 top-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${step.r},1), transparent)` }}
              />
              {/* Background radial glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(${step.r},0.13), transparent 60%)` }}
              />
              {/* Shimmer */}
              <div
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"
                style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.04) 50%, transparent 65%)" }}
              />

              {/* Step number badge */}
              <motion.div
                className={`absolute -top-5 right-4 rounded-full bg-gradient-to-br ${step.badge} flex items-center justify-center text-white font-bold z-10`}
                style={{ width: '40px', height: '40px', fontSize: '16px', lineHeight: '1', boxShadow: `0 0 10px rgba(${step.r},0.35)` }}
                whileHover={{ scale: 1.25, boxShadow: `0 0 20px rgba(${step.r},0.7)`, transition: { type: "spring", stiffness: 400, damping: 10 } }}
              >
                {i + 1}
              </motion.div>

              {/* Icon container */}
              <motion.div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.iconGrad} border border-white/10 flex items-center justify-center text-3xl mb-5 relative`}
                whileHover={{ scale: 1.12, rotate: -6, boxShadow: `0 0 28px rgba(${step.r},0.38)`, transition: { type: "spring", stiffness: 300, damping: 12 } }}
              >
                {step.icon}
              </motion.div>

              <h3
                className="text-lg font-bold text-white mb-2 relative z-10"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {step.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed relative z-10 group-hover:text-gray-300 transition-colors duration-300">
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = (tr: boolean) => [
  {
    name: tr ? "Ahmet Yılmaz" : "Alex Carter",
    role: tr
      ? "İhale Uzmanı, İnşaat A.Ş."
      : "Procurement Specialist, BuildCorp",
    initials: tr ? "AY" : "AC",
    color: "from-blue-600 to-indigo-600",
    quote: tr
      ? "İhale dosyalarını birleştirmek için kullandığımız en hızlı araç. Formatlamayı bozmadan anında PDF oluşturuyor."
      : "The fastest PDF merge tool we've used. Combines tender documents without breaking formatting — instant output.",
  },
  {
    name: tr ? "Neslihan Kaya" : "Sara Mitchell",
    role: tr ? "Muhasebe Müdürü, FinansLtd." : "Finance Manager, FinGroup Ltd.",
    initials: tr ? "FK" : "SM",
    color: "from-violet-600 to-purple-700",
    quote: tr
      ? "Excel tablolarını PDF'e çevirmek artık 10 kat hızlı. Biçimlendirme bozulmadan çalışıyor."
      : "Converting Excel reports to PDF is 10× faster now. Tables stay intact, formatting never breaks.",
    highlight: true,
  },
  {
    name: tr ? "Murat Demir" : "James Liu",
    role: tr
      ? "Operasyon Yöneticisi, LojistikPro"
      : "Operations Manager, LogiFlow",
    initials: tr ? "MD" : "JL",
    color: "from-cyan-600 to-blue-700",
    quote: tr
      ? "Windows uygulaması internet bağlantısı olmadan da çalışıyor. Saha ekiplerimiz için çok kritik."
      : "The Windows app works offline. Critical for our field teams who often lack internet access.",
  },
  {
    name: tr ? "Zeynep Şahin" : "Emily Ross",
    role: tr ? "Hukuk Asistanı, Hukuk Bürosu" : "Legal Assistant, LexFirm LLP",
    initials: tr ? "ZŞ" : "ER",
    color: "from-indigo-600 to-violet-600",
    quote: tr
      ? "Toplu PDF sıkıştırma özelliği harika. 200 dosyayı dakikalar içinde işledi, kalite mükemmel."
      : "Batch compression is excellent. Processed 200 court filings in minutes while preserving quality.",
  },
  {
    name: tr ? "Emre Çelik" : "Daniel Park",
    role: tr ? "IT Yöneticisi, TechFirm" : "IT Manager, TechStart Inc.",
    initials: tr ? "EÇ" : "DP",
    color: "from-emerald-600 to-cyan-700",
    quote: tr
      ? "Şifreleme ve filigran özellikleri son derece güvenilir. Kurumsal kullanım için biçilmiş kaftan."
      : "The encryption and watermark features are rock-solid. Perfect for corporate document security workflows.",
    highlight: true,
  },
  {
    name: tr ? "Selin Arslan" : "Olivia Bennett",
    role: tr ? "Proje Koordinatörü, AgencyX" : "Project Coordinator, AgencyX",
    initials: tr ? "SA" : "OB",
    color: "from-rose-600 to-pink-700",
    quote: tr
      ? "Müşteri sunumlarını PDF'e çevirip birleştirmek hiç bu kadar kolay olmamıştı. Kesinlikle tavsiye ederim."
      : "Turning client presentations into polished PDFs has never been easier. Highly recommended.",
  },
];

function Testimonials({ language }: { language: Language }) {
  const tr = language === "tr";
  const testimonials = TESTIMONIALS(tr);

  return (
    <section className="relative py-24 sm:py-32 px-5 sm:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.06)_0%,transparent_55%)]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
            ★ {tr ? "Kullanıcı Yorumları" : "Testimonials"}
          </span>
          <h2
            className="text-3xl sm:text-4xl font-extrabold text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr
              ? "Gerçek Kullanıcılar, Gerçek Sonuçlar"
              : "Real Users, Real Results"}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              className={`flex flex-col p-6 rounded-2xl border transition-all ${
                t.highlight
                  ? "border-blue-500/30 bg-gradient-to-b from-blue-950/40 to-slate-950/40 shadow-lg shadow-blue-500/5"
                  : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]"
              }`}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {"★★★★★".split("").map((s, k) => (
                  <span key={k} className="text-amber-400 text-sm">
                    {s}
                  </span>
                ))}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed flex-1 mb-5">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function Faq({ language }: { language: Language }) {
  const tr = language === "tr";
  const copy = landingTranslations[language];
  const [open, setOpen] = useState<number | null>(null);

  const items = copy.faq?.length
    ? copy.faq
    : tr
      ? [
          {
            question: "PDF'lerimi yüklediğimde verilerim güvende mi?",
            answer:
              "Evet. Yüklenen dosyalar şifreli bağlantı üzerinden iletilir ve 1 saat sonra otomatik olarak silinir. Windows uygulamasında dosyalar hiç sunucuya gönderilmez.",
          },
          {
            question: "Masaüstü uygulama çevrimdışı çalışıyor mu?",
            answer:
              "Evet. Windows masaüstü uygulaması internet bağlantısı olmadan da tam işlevsellikle çalışır.",
          },
          {
            question: "Dosyalarım sunucularda ne kadar süre saklanıyor?",
            answer:
              "Web işlemlerinde dosyalar 1 saat sonra kalıcı olarak silinir. Masaüstü uygulamasında hiç sunucuya gönderilmez.",
          },
          {
            question: "Planımı istediğim zaman değiştirebilir miyim?",
            answer:
              "Evet. Kredi paketleri tek seferlik alımdır; aboneliği ise istediğiniz zaman iptal edebilirsiniz.",
          },
          {
            question: "Dosya boyutu sınırı var mı?",
            answer:
              "Web uygulamasında 100 MB'a kadar dosya desteklenmektedir. Windows uygulamasında pratik limit çok daha yüksektir.",
          },
          {
            question: "Ücretsiz deneme sunuyor musunuz?",
            answer:
              "Evet. Kayıt olmadan birkaç işlemi ücretsiz deneyebilirsiniz. Kredi paketi satın almadan önce platformu keşfedin.",
          },
        ]
      : [
          {
            question: "Is my data secure when I upload PDFs?",
            answer:
              "Yes. Files are transferred over encrypted connections and permanently deleted after 1 hour. With the Windows app, files never leave your device.",
          },
          {
            question: "Does the desktop app work offline?",
            answer:
              "Yes. The Windows desktop app works fully offline with no internet connection required.",
          },
          {
            question: "How long are my files stored on your servers?",
            answer:
              "Web-processed files are permanently deleted after 1 hour. Desktop app files are never sent to a server.",
          },
          {
            question: "Can I switch plans at any time?",
            answer:
              "Yes. Credit packs are one-time purchases; subscriptions can be cancelled any time from your dashboard.",
          },
          {
            question: "Is there a file size limit?",
            answer:
              "The web app supports files up to 100 MB. The Windows desktop app handles much larger files locally.",
          },
          {
            question: "Do you offer a free trial?",
            answer:
              "Yes. You can try several operations without signing up. Explore the platform before purchasing any credits.",
          },
        ];

  return (
    <section id="faq" className="relative py-24 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-sm font-medium mb-6">
            ? {tr ? "Sık Sorulan Sorular" : "FAQ"}
          </span>
          <h2
            className="text-3xl sm:text-4xl font-extrabold text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {tr ? "Merak Ettikleriniz" : "Common Questions"}
          </h2>
        </motion.div>

        <div className="divide-y divide-white/[0.06]">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                aria-expanded={open === i}
              >
                <span
                  className={`text-sm sm:text-base font-semibold transition-colors ${open === i ? "text-white" : "text-gray-300 group-hover:text-white"}`}
                >
                  {item.question}
                </span>
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-sm transition-all ${open === i ? "border-blue-500/40 text-blue-400 rotate-45" : "border-white/15 text-gray-500 group-hover:border-white/25"}`}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                      height: "auto",
                      opacity: 1,
                      transition: {
                        duration: 0.3,
                        ease: [0.22, 1, 0.36, 1] as const,
                      },
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      transition: { duration: 0.22 },
                    }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 text-sm text-gray-400 leading-relaxed">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta({
  language,
  onUseWebApp,
  windowsDownloadUrl,
}: {
  language: Language;
  onUseWebApp: () => void;
  windowsDownloadUrl: string;
}) {
  const tr = language === "tr";
  const copy = landingTranslations[language];

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-950/50 via-indigo-950/50 to-violet-950/50 border-y border-white/[0.06]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12)_0%,transparent_65%)]" />
      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <h2
            className="text-4xl sm:text-5xl font-black text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {copy.finalCta.title}
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
            {copy.finalCta.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              onClick={onUseWebApp}
              whileHover={{ y: -4, boxShadow: "0 20px 55px rgba(59,130,246,0.55), 0 0 0 1px rgba(99,102,241,0.3)" }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-500 hover:to-indigo-500 shadow-2xl shadow-blue-500/30 transition-colors"
            >
              {copy.finalCta.primaryCta}
            </motion.button>
            <motion.div
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              <div className="relative">
                <span className="inline-block px-8 py-4 rounded-xl border border-white/20 bg-white/5 text-white font-semibold opacity-50 cursor-not-allowed">
                  {copy.finalCta.secondaryCta}
                </span>
                <span className="absolute -top-2 -right-1 bg-amber-500 text-black text-[11px] font-bold px-2 py-1 rounded">
                  {tr ? "Yakında" : "Coming"}
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({
  language,
  onOpenTerms,
  onOpenPrivacy,
  onOpenKvkk,
  onUseWebApp,
  onOpenAbout,
  onContactClick,
}: {
  language: Language;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenKvkk: () => void;
  onUseWebApp: () => void;
  onOpenAbout: () => void;
  onContactClick: () => void;
}) {
  const tr = language === "tr";
  const copy = landingTranslations[language];

  const cols = [
    {
      heading: tr ? "Ürün" : "Product",
      links: [
        { label: tr ? "Araçlar" : "Tools", action: onUseWebApp },
        { label: "Merge PDF", action: onUseWebApp },
        { label: "Split PDF", action: onUseWebApp },
        { label: tr ? "Sıkıştır" : "Compress PDF", action: onUseWebApp },
      ],
    },
    {
      heading: tr ? "Şirket" : "Company",
      links: [
        { label: tr ? "Hakkımızda" : "About", action: onOpenAbout },
        { label: tr ? "İletişim" : "Contact", action: onContactClick },
        { label: "Blog", href: "#" },
      ],
    },
    {
      heading: tr ? "Yasal" : "Legal",
      links: [
        { label: copy.footer.termsLabel, action: onOpenTerms },
        { label: copy.footer.privacyLabel, action: onOpenPrivacy },
        ...(tr ? [{ label: "KVKK", action: onOpenKvkk }] : []),
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.06] bg-black/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <button
            onClick={onUseWebApp}
            aria-label={copy.navbar.productLabel}
            className="flex items-center mb-4 group"
          >
            <img
              src="/navbar-logo.png"
              alt="PDF PLATFORM"
              className="h-14 w-auto object-contain transition-opacity group-hover:opacity-90"
            />
          </button>
          <p className="text-xs text-gray-600 leading-relaxed max-w-[200px]">
            {copy.footer.description}
          </p>
        </div>

        {/* Link columns */}
        {cols.map((col) => (
          <div key={col.heading}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4">
              {col.heading}
            </p>
            <ul className="space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  {"action" in link ? (
                    <button
                      onClick={link.action}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <CrawlableLink
                      href={link.href ?? "#"}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </CrawlableLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.04] px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} NB Global Studio.{" "}
          {tr ? "Tüm hakları saklıdır." : "All rights reserved."}
        </p>
        <p className="text-xs text-gray-700">Made with ❤️ for productivity</p>
      </div>
    </footer>
  );
}

// ─── LandingPage (main export) ────────────────────────────────────────────────

export function LandingPage({
  language,
  onLanguageChange,
  onUseWebApp,
  isAuthenticated,
  authGreeting,
  onLogin,
  onRegister,
  onOpenTerms,
  onOpenPrivacy,
  onOpenKvkk,
  onOpenAbout,
  onContactClick,
  organizationName = "PDF PLATFORM",
  onSelectPlan,
}: LandingPageProps) {
  const { cms: cmsContent } = useSettings();
  const windowsDownloadUrl = getWindowsDownloadUrlFromCms(cmsContent);

  // Google Fonts inject
  useEffect(() => {
    injectFonts();
  }, []);

  return (
    <div className="min-h-screen text-white antialiased">
      <GradientBackground />
      <Navbar
        language={language}
        onLanguageChange={onLanguageChange}
        isAuthenticated={isAuthenticated}
        authGreeting={authGreeting}
        onLogin={onLogin}
        onRegister={onRegister}
        onUseWebApp={onUseWebApp}
        windowsDownloadUrl={windowsDownloadUrl}
      />

      <main>
        <Hero
          language={language}
          onUseWebApp={onUseWebApp}
          windowsDownloadUrl={windowsDownloadUrl}
        />
        <StatsBar language={language} />
        <ProductShowcase
          language={language}
          onUseWebApp={onUseWebApp}
          organizationName={organizationName}
          windowsDownloadUrl={windowsDownloadUrl}
        />
        <Features language={language} />
        <HowItWorks language={language} />
        <PdfToolsSection language={language} onUseWebApp={onUseWebApp} />
        <PricingSection
          language={language}
          onUseWebApp={onUseWebApp}
          onSelectPlan={onSelectPlan}
        />
        <Testimonials language={language} />
        <Faq language={language} />
        <FinalCta
          language={language}
          onUseWebApp={onUseWebApp}
          windowsDownloadUrl={windowsDownloadUrl}
        />
      </main>

      <Footer
        language={language}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
        onOpenKvkk={onOpenKvkk}
        onUseWebApp={onUseWebApp}
        onOpenAbout={onOpenAbout}
        onContactClick={onContactClick}
      />
    </div>
  );
}
