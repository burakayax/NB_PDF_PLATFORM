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
import type { FeatureKey } from "../../api/subscription";
import { getWindowsDownloadUrlFromCms } from "../../lib/landingCmsMerge";
import { useSettings } from "../../hooks/useSettings";
import { CrawlableLink } from "../seo/CrawlableLink";
import PdfToolsSection from "../ui/pdf-tools-section";
import PricingSection from "../ui/pricing-section";
import { GuestToolCore, type Picked as GuestPickedFile } from "../tools/GuestToolCore";
import { GuestPageToolCore, type PageToolId } from "../tools/GuestPageTool";
import { AiPdfTool } from "../tools/AiPdfTool";
import { AiBatchTool } from "../tools/AiBatchTool";
import { AiCompareTool } from "../tools/AiCompareTool";
import { AiRedactTool } from "../tools/AiRedactTool";
import { PdfEditor } from "../tools/PdfEditor";
import { DocumentScanner } from "../tools/DocumentScanner";
import { PdfCropTool } from "../tools/PdfCropTool";
import { saveScannedPdf } from "../../lib/pendingScan";
import { useResponsive } from "../dashboard/hooks/useResponsive";
import { toolAccent } from "../tools/ToolDropzone";

/** Ana sayfada yerinde (login'siz) çalışabilen ücretsiz araçlar. */
export type FreeToolId = "merge" | "image-to-pdf" | "crop-pdf" | PageToolId;
const PAGE_TOOL_IDS = new Set<string>(["rotate-pdf", "delete-pages", "organize-pdf", "split"]);
const isPageToolId = (id: string): id is PageToolId => PAGE_TOOL_IDS.has(id);
export const isFreeToolId = (id: string): id is FreeToolId =>
  id === "merge" || id === "image-to-pdf" || id === "crop-pdf" || PAGE_TOOL_IDS.has(id);
const FREE_TOOLS: { id: FreeToolId; tr: string; en: string }[] = [
  { id: "merge", tr: "Birleştir", en: "Merge" },
  { id: "split", tr: "Böl", en: "Split" },
  { id: "crop-pdf", tr: "Kırp", en: "Crop" },
  { id: "image-to-pdf", tr: "Görsel → PDF", en: "Image → PDF" },
  { id: "rotate-pdf", tr: "Döndür", en: "Rotate" },
  { id: "delete-pages", tr: "Sayfa Sil", en: "Delete" },
  { id: "organize-pdf", tr: "Sayfa Sırala", en: "Reorder" },
];
import { LandingIcon } from "./LandingIcon";
import { ThreeStepDemo } from "./ThreeStepDemo";
import { langAsset, langAssetFallback } from "../../lib/langAsset";
import { usePwaInstall } from "../../pwa/usePwaInstall";

/**
 * Landing navbar'da kalıcı "Uygulamayı Yükle" butonu — sm+ (tablet/masaüstü)
 * gösterilir; telefonda alttaki kurulum banner'ı devreye girer. Yüklenince
 * gizlenir; iOS'ta talimat banner'ını açar.
 */
function LandingInstallButton({ tr }: { tr: boolean }) {
  const { canInstall, iosManual, promptInstall, reopen } = usePwaInstall();
  if (!canInstall) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => (iosManual ? reopen() : void promptInstall())}
      title={tr ? "Uygulamayı yükle" : "Install the app"}
      className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition-all"
    >
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {tr ? "Uygulamayı yükle" : "Install app"}
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onUseWebApp: () => void;
  onOpenTool: (id: FeatureKey) => void;
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
  /** AI araçları için (giriş yapan kullanıcı token'ı + yükseltme tetikleyici). */
  accessToken?: string | null;
  onUpgrade?: () => void;
  /** Belge Tarayıcı "Pro'ya Geç" → tarama kaybolmadan ÜSTTE giriş/kayıt açar. */
  onScannerUpgrade?: () => void;
  /** Kullanıcı zaten AI'a yetkili mi (ADMIN / PRO / BUSINESS) → ödemeler kapalı olsa
   *  bile AI "Yakında" gösterme, gerçek araçları aç. */
  aiAllowed?: boolean;
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
          {/* Telefon + tablet: sadece amblem (kare ikon) — uzun logo dar ekrana sığmıyor */}
          <img
            src="/emblem.png"
            alt="PDF Platform"
            className="h-10 w-10 object-contain lg:hidden"
          />
          {/* Masaüstü: tam uzun logo */}
          <img
            src="/navbar-logo.png"
            alt="PDF Platform"
            className="hidden h-14 w-auto object-contain transition-opacity group-hover:opacity-90 lg:block"
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
            ["/blog", "Blog"],
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
              <LandingInstallButton tr={tr} />
              <button
                onClick={onUseWebApp}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all"
              >
                {copy.navbar.openWorkspace}
              </button>
            </>
          ) : (
            <>
              <LandingInstallButton tr={tr} />
              {/* Mobil/tablet: tek birleşik Giriş/Kayıt butonu (giriş ekranında
                  kayıt seçeneği de var). sm+ : ayrı Giriş + Kayıt. */}
              <button
                onClick={onLogin}
                className="sm:hidden h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_24px_rgba(59,130,246,0.4)] transition-all"
              >
                {tr ? "Giriş / Kayıt" : "Sign in / up"}
              </button>
              <button
                onClick={onLogin}
                className="h-9 px-4 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all hidden sm:flex items-center"
              >
                {copy.navbar.login}
              </button>
              <button
                onClick={onRegister}
                className="hidden sm:inline-flex h-9 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_24px_rgba(59,130,246,0.4)] hover:shadow-[0_0_32px_rgba(99,102,241,0.6)] transition-all items-center"
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
  onRegister,
  onLogin,
  accessToken,
  onUpgrade,
  onScannerUpgrade,
  aiAllowed,
}: {
  language: Language;
  onUseWebApp: () => void;
  onRegister: () => void;
  onLogin: () => void;
  accessToken: string | null;
  onUpgrade: () => void;
  onScannerUpgrade?: () => void;
  aiAllowed?: boolean;
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

  const [freeTool, setFreeTool] = useState<FreeToolId>("merge");
  const [aiTool, setAiTool] = useState<"summarize" | "chat" | "extract" | "translate" | "batch" | "compare" | "redact" | null>(null);
  const [editorOn, setEditorOn] = useState(false);
  // Ödemeler kapalıyken AI araçları "Yakında" (fiyat kartlarıyla aynı sinyal). ANCAK
  // zaten AI'a yetkili kullanıcı (ADMIN / PRO / BUSINESS) — backend erişim veriyor —
  // gerçek araçları görür; ödemeleri açmaya gerek yok.
  const { flags } = useSettings();
  const aiComingSoon = flags?.featureFlags?.paymentsDisabled !== false && !aiAllowed;
  // Yüklenen dosyalar araç başına Hero'da tutulur → kullanıcı yanlışlıkla başka araca
  // geçip geri dönünce dosyaları yerinde kalır (remount'ta kaybolmaz).
  const [toolFiles, setToolFiles] = useState<Record<string, GuestPickedFile[]>>({});

  // Belge Tarayıcı (mobil): kamerayla belge → cihazda PDF. "PDF Araçlarında aç"
  // seçilirse taranan PDF'i sayfa aracına (Düzenle) aktarırız.
  const { isMobileOrTablet } = useResponsive();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const handleScannedToTools = useCallback(
    async (file: File, toolId: string) => {
      if (toolId === "pdf-duzenle") {
        // PDF Düzenle editörü (cihazda görünür, misafire açık) → taranan PDF yüklenir.
        setScannedFile(file);
        setAiTool(null);
        setEditorOn(true);
      } else if (isFreeToolId(toolId)) {
        // Cihazda çalışan araç → taranan PDF doğrudan aktarılır (initialFile).
        setScannedFile(file);
        setAiTool(null);
        setEditorOn(false);
        setFreeTool(toolId as FreeToolId);
      } else {
        // Dönüştürme (sunucu + üyelik) → PDF'i IndexedDB'de KORU, üyelik akışına al.
        // (Faz 2: giriş sonrası ilgili araç sayfası bu PDF'i geri yükler.)
        try {
          await saveScannedPdf(file);
        } catch {
          /* IndexedDB yoksa yoksay */
        }
        onRegister();
      }
    },
    [onRegister],
  );

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
              ? "Web PDF Araçları Platformu"
              : "Web PDF Tools Platform"}
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

        {/* Hızlı araç seçici + ÇALIŞAN araç — ANA SAYFADA, login YOK, sayfadan
            AYRILMADAN. Butona bas → araç alanı o araca dönüşür, işlemi orada yap. */}
        <motion.div
          {...stagger(3)}
          className="mt-10 mx-auto w-full max-w-4xl"
        >
          {/* Mobil: kamerayla belge tara (cihazda PDF) */}
          {isMobileOrTablet && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/[0.14] to-blue-500/[0.14] px-5 py-3.5 text-sm font-bold text-cyan-100 shadow-[0_10px_30px_-14px_rgba(6,182,212,0.7)] transition hover:from-cyan-500/25 hover:to-blue-500/25"
            >
              {tr ? "📸 Kamerayla Belge Tara" : "📸 Scan a document with camera"}
            </button>
          )}
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {FREE_TOOLS.map((t) => {
              const A = toolAccent(t.id);
              const Icon = A.icon;
              const active = !aiTool && !editorOn && freeTool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setFreeTool(t.id);
                    setAiTool(null);
                    setEditorOn(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_8px_24px_-8px_rgba(79,70,229,0.7)]"
                      : "border border-white/15 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : A.text}`} />
                  {tr ? t.tr : t.en}
                </button>
              );
            })}
            {/* AI araçları (Pro) — yapay zekâ özet + sohbet + veri çıkarma */}
            {(
              [
                ["summarize", tr ? "✨ AI Özet" : "✨ AI Summary"],
                ["chat", tr ? "✨ AI Sohbet" : "✨ AI Chat"],
                ["extract", tr ? "✨ AI Veri Çıkar" : "✨ AI Extract"],
                ["translate", tr ? "✨ AI Çeviri" : "✨ AI Translate"],
                ["batch", tr ? "✨ AI Toplu İşlem" : "✨ AI Batch"],
                ["compare", tr ? "✨ AI Karşılaştır" : "✨ AI Compare"],
                ["redact", tr ? "✨ AI Veri Gizle" : "✨ AI Redact"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setAiTool(id);
                  setEditorOn(false);
                }}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  aiTool === id
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.7)]"
                    : "border border-violet-400/25 bg-violet-500/[0.06] text-violet-200 hover:bg-violet-500/[0.12]"
                }`}
              >
                {label}
              </button>
            ))}
            {/* PDF Düzenle — cihazda editör */}
            <button
              type="button"
              onClick={() => {
                setEditorOn(true);
                setAiTool(null);
              }}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                editorOn
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_8px_24px_-8px_rgba(6,182,212,0.7)]"
                  : "border border-cyan-400/25 bg-cyan-500/[0.06] text-cyan-200 hover:bg-cyan-500/[0.12]"
              }`}
            >
              {tr ? "✏️ PDF Düzenle" : "✏️ Edit PDF"}
            </button>
          </div>
          {/* Birleştir/Görsel→PDF: yerinde widget. Döndür/Sil/Düzenle: yerinde
              dropzone — dosya yüklenince GuestPageToolCore kendi GENİŞ POPUP'ını açar. */}
          <div className="text-left">
            {editorOn ? (
              <PdfEditor language={language} accessToken={accessToken} initialFile={editorOn ? scannedFile : null} />
            ) : aiTool === "batch" ? (
              <AiBatchTool
                language={language}
                accessToken={accessToken}
                onLogin={onLogin}
                onUpgrade={onUpgrade}
                comingSoon={aiComingSoon}
              />
            ) : aiTool === "compare" ? (
              <AiCompareTool
                language={language}
                accessToken={accessToken}
                onLogin={onLogin}
                onUpgrade={onUpgrade}
                comingSoon={aiComingSoon}
              />
            ) : aiTool === "redact" ? (
              <AiRedactTool
                language={language}
                accessToken={accessToken}
                onLogin={onLogin}
                onUpgrade={onUpgrade}
                comingSoon={aiComingSoon}
              />
            ) : aiTool ? (
              <AiPdfTool
                key={aiTool}
                mode={aiTool}
                language={language}
                accessToken={accessToken}
                onLogin={onLogin}
                onUpgrade={onUpgrade}
                comingSoon={aiComingSoon}
              />
            ) : freeTool === "crop-pdf" ? (
              <PdfCropTool language={language} />
            ) : isPageToolId(freeTool) ? (
              <GuestPageToolCore key={freeTool} tool={freeTool} language={language} initialFile={scannedFile} />
            ) : (
              <GuestToolCore
                key={freeTool}
                tool={freeTool}
                language={language}
                onRegister={onRegister}
                filesState={[
                  toolFiles[freeTool] ?? [],
                  (upd) =>
                    setToolFiles((m) => ({
                      ...m,
                      [freeTool]: typeof upd === "function" ? upd(m[freeTool] ?? []) : upd,
                    })),
                ]}
              />
            )}
          </div>
          <p className="mt-4 text-center text-[13px] text-slate-500">
            {tr ? "↓ Tüm araçlar için aşağı kaydır" : "↓ Scroll for all tools"}
          </p>
        </motion.div>

        {/* Belge Tarayıcı (mobil) — tam ekran, cihazda işlenir */}
        <AnimatePresence>
          {scannerOpen && (
            <DocumentScanner
              open={scannerOpen}
              language={language}
              onClose={() => setScannerOpen(false)}
              onUseInTools={handleScannedToTools}
              isPro={aiAllowed}
              onUpgrade={onScannerUpgrade ?? onUpgrade}
            />
          )}
        </AnimatePresence>

        {/* Trust bar */}
        <motion.div
          {...stagger(4)}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-500"
        >
          {[
            tr ? "🔒 Dosyan cihazından çıkmaz" : "🔒 Files stay on your device",
            tr ? "🚫 Filigran yok" : "🚫 No watermark",
            tr ? "⚡ Anında işlem" : "⚡ Instant",
            tr ? "♾️ Sınırsız & ücretsiz" : "♾️ Unlimited & free",
            tr ? "🆓 Üyelik gerekmez" : "🆓 No sign-up",
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
    { value: 20, suffix: "+", label: tr ? "PDF Aracı" : "PDF Tools" },
    {
      value: 80,
      suffix: " MB",
      label: tr ? "Ücretsiz Dosya" : "Free File Size",
    },
    {
      value: 100,
      suffix: "%",
      label: tr ? "Tarayıcı Tabanlı" : "Browser-Based",
    },
    { value: 0, suffix: "₺", label: tr ? "Ücretsiz Araçlar" : "Free Tools" },
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
    icon: "⚡",
    label: tr ? "Anında" : "Instant",
  },
  {
    pos: "absolute -top-4 right-[8%] sm:-top-5 sm:right-[5%]",
    icon: "🔒",
    label: tr ? "Cihazda İşlenir" : "On-device",
  },
  {
    pos: "absolute -bottom-4 left-[8%] sm:-bottom-5 sm:left-[5%]",
    icon: "🆓",
    label: tr ? "Üyeliksiz" : "No sign-up",
  },
  {
    pos: "absolute -bottom-4 right-[8%] sm:-bottom-5 sm:right-[5%]",
    icon: "⚡",
    label: tr ? "Anında İşlem" : "Instant Processing",
  },
];

function BrowserChrome({ screenshot, language }: { screenshot?: boolean; language: Language }) {
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
      {/* Viewport — oran görsele eşitlendi ki object-cover kırpmasın, sol araç menüsü görünsün */}
      <div className="relative aspect-[1366/657] overflow-hidden">
        {screenshot ? (
          <img
            src={langAsset("/screenshots/web-app.png", language)}
            onError={langAssetFallback("/screenshots/web-app.png")}
            alt="PDF Platform web uygulaması"
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
            alt="PDF Platform masaüstü uygulaması (yakında)"
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

  useEffect(() => {
    const img = new Image();
    img.src = "/screenshots/web-app.png";
    img.onload = () => setWebOk(true);
    img.onerror = () => setWebOk(false);
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
              ? "Tarayıcıdan çalışan güçlü bir PDF platformu — kurulum gerekmez."
              : "A powerful PDF platform right in your browser — no install needed."}
          </p>
        </motion.div>

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
              <BrowserChrome screenshot={webOk} language={language} />
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
  ai:       { r: "217,70,239",  iconBg: "bg-fuchsia-500/15", iconText: "text-fuchsia-300" },
  ocr:      { r: "245,158,11",  iconBg: "bg-amber-500/15",   iconText: "text-amber-300"   },
  edit:     { r: "6,182,212",   iconBg: "bg-cyan-500/15",    iconText: "text-cyan-300"    },
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

        {/* Gerçek ekran görüntüleriyle canlı, vurgulu demo */}
        <ThreeStepDemo language={language} />

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
      ? "Web uygulaması tarayıcıdan anında açılıyor; ekiplerimiz kurulum yapmadan her yerden erişiyor. İş akışımız için çok kritik."
      : "The web app opens instantly in any browser — our teams access it anywhere with zero installation. Critical for our workflow.",
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
              "Evet. Yüklenen dosyalar şifreli bağlantı üzerinden iletilir ve 1 saat sonra otomatik olarak silinir. Yakında çıkacak masaüstü uygulamasında dosyalar hiç sunucuya gönderilmeyecek.",
          },
          {
            question: "Masaüstü uygulaması çevrimdışı çalışacak mı?",
            answer:
              "Yakında geliyor. Windows masaüstü uygulaması internet bağlantısı olmadan da tam işlevsellikle çalışacak.",
          },
          {
            question: "Dosyalarım sunucularda ne kadar süre saklanıyor?",
            answer:
              "Web işlemlerinde dosyalar 1 saat sonra kalıcı olarak silinir. Yakında çıkacak masaüstü uygulamasında dosyalar hiç sunucuya gönderilmeyecek.",
          },
          {
            question: "Planımı istediğim zaman değiştirebilir miyim?",
            answer:
              "Evet. Kredi paketleri tek seferlik alımdır; aboneliği ise istediğiniz zaman iptal edebilirsiniz.",
          },
          {
            question: "Dosya boyutu sınırı var mı?",
            answer:
              "Web uygulamasında 100 MB'a kadar dosya desteklenmektedir. Yakında çıkacak masaüstü uygulamasında pratik limit çok daha yüksek olacaktır.",
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
              "Yes. Files are transferred over encrypted connections and permanently deleted after 1 hour. With the upcoming desktop app, files will never leave your device.",
          },
          {
            question: "Will the desktop app work offline?",
            answer:
              "Coming soon. The Windows desktop app will work fully offline with no internet connection required.",
          },
          {
            question: "How long are my files stored on your servers?",
            answer:
              "Web-processed files are permanently deleted after 1 hour. The upcoming desktop app will process files without sending them to a server.",
          },
          {
            question: "Can I switch plans at any time?",
            answer:
              "Yes. Credit packs are one-time purchases; subscriptions can be cancelled any time from your dashboard.",
          },
          {
            question: "Is there a file size limit?",
            answer:
              "The web app supports files up to 100 MB. The upcoming Windows desktop app will handle much larger files locally.",
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

/** Sosyal medya URL'sinden okunabilir platform etiketi üretir (footer + aria). */
function socialLabelFromUrl(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "Bağlantı";
  }
  const map: Array<[RegExp, string]> = [
    [/(^|\.)x\.com$/, "X"],
    [/(^|\.)twitter\.com$/, "X"],
    [/(^|\.)instagram\.com$/, "Instagram"],
    [/(^|\.)linkedin\.com$/, "LinkedIn"],
    [/(^|\.)(facebook\.com|fb\.com)$/, "Facebook"],
    [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
    [/(^|\.)github\.com$/, "GitHub"],
    [/(^|\.)tiktok\.com$/, "TikTok"],
    [/(^|\.)(t\.me|telegram\.(me|org))$/, "Telegram"],
    [/(^|\.)pinterest\.(com|[a-z]{2})$/, "Pinterest"],
    [/(^|\.)threads\.(net|com)$/, "Threads"],
    [/(^|\.)(reddit\.com)$/, "Reddit"],
    [/(^|\.)(medium\.com)$/, "Medium"],
  ];
  for (const [re, label] of map) {
    if (re.test(host)) {
      return label;
    }
  }
  return host;
}

/** Sosyal medya URL'sinden platform anahtarı (ikon seçimi için). */
type SocialPlatform =
  | "x"
  | "instagram"
  | "linkedin"
  | "facebook"
  | "youtube"
  | "github"
  | "tiktok"
  | "telegram"
  | "pinterest"
  | "threads"
  | "reddit"
  | "medium"
  | "link";

function socialPlatformFromUrl(url: string): SocialPlatform {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "link";
  }
  const map: Array<[RegExp, SocialPlatform]> = [
    [/(^|\.)(x\.com|twitter\.com)$/, "x"],
    [/(^|\.)instagram\.com$/, "instagram"],
    [/(^|\.)linkedin\.com$/, "linkedin"],
    [/(^|\.)(facebook\.com|fb\.com)$/, "facebook"],
    [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
    [/(^|\.)github\.com$/, "github"],
    [/(^|\.)tiktok\.com$/, "tiktok"],
    [/(^|\.)(t\.me|telegram\.(me|org))$/, "telegram"],
    [/(^|\.)pinterest\.(com|[a-z]{2})$/, "pinterest"],
    [/(^|\.)threads\.(net|com)$/, "threads"],
    [/(^|\.)reddit\.com$/, "reddit"],
    [/(^|\.)medium\.com$/, "medium"],
  ];
  for (const [re, key] of map) {
    if (re.test(host)) {
      return key;
    }
  }
  return "link";
}

/** Marka sosyal medya ikonları (24×24 viewBox, currentColor). */
const SOCIAL_ICON_PATHS: Record<SocialPlatform, string> = {
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  github:
    "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  telegram:
    "M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  pinterest:
    "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z",
  threads:
    "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.331-3.082.881-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65zm1.036-11.775c-.234 0-.472.007-.714.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.84 2.784 1.768 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 00-2.24-.222z",
  reddit:
    "M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.746.076-5.229.834-7.059 2.032-.478-.46-1.126-.746-1.84-.746C1.192 9.134 0 10.32 0 11.779c0 1.06.63 1.972 1.535 2.384-.038.246-.057.494-.057.743 0 3.763 4.827 6.82 10.762 6.82 5.936 0 10.763-3.057 10.763-6.82 0-.249-.019-.497-.056-.743.905-.412 1.535-1.324 1.535-2.384zm-17.224 1.816c0-.834.679-1.512 1.515-1.512.833 0 1.511.678 1.511 1.512 0 .833-.678 1.512-1.511 1.512-.836 0-1.515-.679-1.515-1.512zm9.052 4.997c-.878.876-2.303 1.302-4.354 1.302l-.019-.003-.02.003c-2.048 0-3.474-.426-4.354-1.302-.161-.161-.161-.422 0-.583.16-.16.421-.16.582 0 .688.687 1.888 1.021 3.772 1.021l.02.002.019-.002c1.884 0 3.084-.334 3.772-1.021.16-.16.422-.16.582 0 .161.161.161.422 0 .583zm-.19-3.485c-.834 0-1.512-.679-1.512-1.512 0-.834.678-1.512 1.512-1.512.833 0 1.511.678 1.511 1.512 0 .833-.678 1.512-1.511 1.512z",
  medium:
    "M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42zM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z",
  link: "M10.59 13.41a1 1 0 001.42 0l4-4a3 3 0 10-4.24-4.24l-1.3 1.3a1 1 0 001.42 1.42l1.3-1.3a1 1 0 011.4 1.4l-4 4a1 1 0 000 1.42zm2.82-2.82a1 1 0 00-1.42 0l-4 4a3 3 0 004.24 4.24l1.3-1.3a1 1 0 00-1.42-1.42l-1.3 1.3a1 1 0 01-1.4-1.4l4-4a1 1 0 000-1.42z",
};

function SocialIcon({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d={SOCIAL_ICON_PATHS[platform]} />
    </svg>
  );
}

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
  const { site } = useSettings();
  const socialLinks = site.socialLinks ?? [];

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
        { label: "Blog", href: "/blog" },
        { label: tr ? "Geliştirici API" : "Developer API", href: "/pdf-api" },
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
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-12">
          {/* Brand */}
          <div className="max-w-sm">
            <button
              onClick={onUseWebApp}
              aria-label={copy.navbar.productLabel}
              className="group flex items-center"
            >
              <img
                src="/navbar-logo.png"
                alt="PDF Platform"
                className="h-11 w-auto object-contain transition-opacity group-hover:opacity-90 sm:h-12"
              />
            </button>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-gray-500">
              {copy.footer.description}
            </p>
            {socialLinks.length > 0 ? (
              <nav
                aria-label={tr ? "Sosyal medya" : "Social media"}
                className="mt-5 flex flex-wrap items-center gap-2.5"
              >
                {socialLinks.map((url) => {
                  const label = socialLabelFromUrl(url);
                  const platform = socialPlatformFromUrl(url);
                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-gray-400 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
                    >
                      <SocialIcon platform={platform} className="h-[18px] w-[18px]" />
                    </a>
                  );
                })}
              </nav>
            ) : null}
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 md:flex md:gap-x-16">
            {cols.map((col) => (
              <div key={col.heading} className="min-w-[7rem]">
                <p className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                  {col.heading}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {"action" in link ? (
                        <button
                          onClick={link.action}
                          className="text-left text-[13.5px] text-gray-400 transition-colors hover:text-white"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <CrawlableLink
                          href={link.href ?? "#"}
                          className="text-[13.5px] text-gray-400 transition-colors hover:text-white"
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
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-6 text-center sm:flex-row sm:justify-between sm:gap-3 sm:px-8 sm:text-left">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} NB Global Studio.{" "}
            {tr ? "Tüm hakları saklıdır." : "All rights reserved."}
          </p>
          <p className="text-xs text-gray-600">Made with ❤️ for productivity</p>
        </div>
      </div>
    </footer>
  );
}

// ─── LandingPage (main export) ────────────────────────────────────────────────

export function LandingPage({
  language,
  onLanguageChange,
  onUseWebApp,
  onOpenTool,
  isAuthenticated,
  authGreeting,
  onLogin,
  onRegister,
  onOpenTerms,
  onOpenPrivacy,
  onOpenKvkk,
  onOpenAbout,
  onContactClick,
  organizationName = "PDF Platform",
  onSelectPlan,
  accessToken,
  onUpgrade,
  onScannerUpgrade,
  aiAllowed,
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
          onRegister={onRegister}
          onLogin={onLogin}
          accessToken={accessToken ?? null}
          onUpgrade={onUpgrade ?? onRegister}
          onScannerUpgrade={onScannerUpgrade}
          aiAllowed={aiAllowed}
          windowsDownloadUrl={windowsDownloadUrl}
        />
        {/* TOOL-FIRST: araçlar hemen hero'nun altında — ziyaretçi siteyi açar
            açmaz ücretsiz araçlara tıklayıp (login'siz) kullanabilir. */}
        <PdfToolsSection
          language={language}
          onUseWebApp={onUseWebApp}
          onOpenTool={onOpenTool}
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
        <PricingSection
          language={language}
          onUseWebApp={onUseWebApp}
          onSelectPlan={onSelectPlan}
        />
        {/* Testimonials: GERÇEK kullanıcı yorumu olmadığı için gösterilmiyor —
            uydurma referans dürüstlük + yasal (sahte endorsement) + Google E-E-A-T
            açısından riskli. Gerçek yorumlar toplanınca <Testimonials /> geri eklenir. */}
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
