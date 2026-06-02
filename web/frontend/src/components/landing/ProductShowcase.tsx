import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductShowcaseProps {
  webScreenshot?: string;
  desktopScreenshot?: string;
  productName?: string;
  headline?: string;
  subtext?: string;
  features?: string[];
}

type Tab = "web" | "desktop";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_VARIANTS: Variants = {
  initial: { opacity: 0, y: 22 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -14,
    transition: { duration: 0.22, ease: [0.55, 0, 1, 0.45] },
  },
};

const PILL_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.88, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.07 + 0.18,
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
  exit: { opacity: 0, scale: 0.9, y: -6, transition: { duration: 0.18 } },
};

const WEB_FEATURES = [
  "Real-time preview",
  "Cloud sync",
  "20+ PDF tools",
  "Browser-based",
];
const DESK_FEATURES = [
  "Works offline",
  "Batch processing",
  "Native performance",
  "Local files",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradientPlaceholder({ variant }: { variant: Tab }) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{
        background:
          variant === "web"
            ? "linear-gradient(135deg,#0A1628 0%,#0D1F3C 50%,#091322 100%)"
            : "linear-gradient(135deg,#0A1020 0%,#0C1829 50%,#0A1525 100%)",
      }}
    >
      {/* dot-grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* center glow */}
      <div
        aria-hidden="true"
        className="absolute h-[260px] w-[420px] rounded-full blur-[90px]"
        style={{
          background:
            variant === "web"
              ? "radial-gradient(ellipse,rgba(99,102,241,0.45) 0%,transparent 70%)"
              : "radial-gradient(ellipse,rgba(34,211,238,0.3) 0%,transparent 70%)",
        }}
      />

      {/* icon box */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm">
          {variant === "web" ? (
            <svg
              className="h-8 w-8 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          ) : (
            <svg
              className="h-8 w-8 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>
        <p className="text-xs font-medium text-slate-500">
          {variant === "web" ? "Web app preview" : "Desktop app preview"}
        </p>
      </div>
    </div>
  );
}

function BrowserChrome({ screenshot }: { screenshot?: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0D1117] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.07)]">
      {/* chrome bar */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111827] px-4 py-3">
        {/* traffic lights */}
        <div className="flex shrink-0 gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80 shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
        </div>

        {/* fake tab strip */}
        <div className="flex items-end gap-px overflow-hidden">
          <div className="flex items-center gap-2 rounded-t-md border border-b-0 border-white/[0.08] bg-[#1C2333] px-4 py-1.5">
            <svg
              className="h-3 w-3 text-indigo-400 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="2"
                y1="12"
                x2="22"
                y2="12"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <span className="text-[11px] text-slate-300 whitespace-nowrap">
              PDF PLATFORM
            </span>
          </div>
        </div>

        {/* URL bar */}
        <div className="ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-[#0D1117] px-3 py-1.5">
          <svg
            className="h-3 w-3 shrink-0 text-emerald-400"
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
          <span className="truncate text-[11px] text-slate-400">
            app.nbpdfplatform.com
          </span>
        </div>

        {/* action icons */}
        <div className="ml-1 flex shrink-0 items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-md bg-white/[0.04] border border-white/[0.05]"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* viewport */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Web app preview"
            className="h-full w-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <GradientPlaceholder variant="web" />
        )}
      </div>
    </div>
  );
}

function DesktopChrome({
  screenshot,
  productName,
}: {
  screenshot?: string;
  productName: string;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0D1117] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.07)]">
      {/* title bar */}
      <div className="relative flex items-center border-b border-white/[0.06] bg-[#161B27] px-4 py-3">
        <div className="flex shrink-0 gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80 shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2">
            <svg
              className="h-3.5 w-3.5 text-cyan-400"
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
            <span className="text-[12px] font-medium text-slate-400">
              {productName}
            </span>
          </div>
        </div>
        {/* right-side fake controls */}
        <div className="ml-auto flex shrink-0 gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-md bg-white/[0.04] border border-white/[0.05]"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* viewport */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Desktop app preview"
            className="h-full w-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <GradientPlaceholder variant="desktop" />
        )}
      </div>
    </div>
  );
}

// ─── Feature Pills ────────────────────────────────────────────────────────────

const PILL_POSITIONS = [
  // left side
  "absolute left-0 top-[14%] z-20 -translate-x-[30%] sm:-translate-x-[60%]",
  "absolute left-0 bottom-[22%] z-20 -translate-x-[30%] sm:-translate-x-[60%]",
  // right side
  "absolute right-0 top-[30%] z-20 translate-x-[30%] sm:translate-x-[60%]",
  "absolute right-0 bottom-[12%] z-20 translate-x-[30%] sm:translate-x-[60%]",
];

function FeaturePills({
  features,
  tabKey,
}: {
  features: string[];
  tabKey: Tab;
}) {
  return (
    <AnimatePresence mode="popLayout">
      {features.slice(0, 4).map((text, i) => (
        <motion.div
          key={`${tabKey}-${i}`}
          className={PILL_POSITIONS[i]}
          variants={PILL_VARIANTS}
          custom={i}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-slate-900/85 px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: tabKey === "web" ? "#818CF8" : "#22D3EE",
                boxShadow: `0 0 6px ${tabKey === "web" ? "#818CF8" : "#22D3EE"}`,
              }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap text-[11px] font-medium tracking-wide text-slate-200">
              {text}
            </span>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductShowcase({
  webScreenshot,
  desktopScreenshot,
  productName = "PDF PLATFORM",
  headline = "Every PDF workflow,\nperfected in one place",
  subtext = "From the browser to your desktop — a seamless PDF experience built for professionals.",
  features,
}: ProductShowcaseProps) {
  const [activeTab, setActiveTab] = useState<Tab>("web");
  const sectionRef = useRef<HTMLElement>(null);

  // Inject Google Fonts once
  useEffect(() => {
    if (document.getElementById("nb-showcase-fonts")) return;
    const link = document.createElement("link");
    link.id = "nb-showcase-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&display=swap";
    document.head.appendChild(link);
  }, []);

  // Subtle parallax on scroll
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { top, height } = el.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -top / (height * 0.5)));
      el.style.setProperty("--parallax-y", `${progress * 24}px`);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const activePills =
    features ?? (activeTab === "web" ? WEB_FEATURES : DESK_FEATURES);
  const resolvedPills = features
    ? features
    : activeTab === "web"
      ? WEB_FEATURES
      : DESK_FEATURES;

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24 sm:py-36"
      style={{ background: "#080B14" }}
    >
      {/* ── Keyframe definitions ── */}
      <style>{`
        @keyframes nb-blob-a {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(50px,-35px) scale(1.09); }
          66%      { transform: translate(-25px,25px) scale(0.93); }
        }
        @keyframes nb-blob-b {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-55px,30px) scale(1.13); }
          75%      { transform: translate(35px,-20px) scale(0.9); }
        }
        @keyframes nb-blob-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(20px,-45px) scale(1.07); }
        }
      `}</style>

      {/* ── Aurora blobs ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -left-[22%] top-[8%] h-[650px] w-[650px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,1) 0%, transparent 68%)",
            opacity: 0.11,
            animation: "nb-blob-a 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -right-[18%] top-[3%] h-[560px] w-[560px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,1) 0%, transparent 68%)",
            opacity: 0.09,
            animation: "nb-blob-b 25s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-12%] left-[38%] h-[440px] w-[440px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(129,140,248,1) 0%, transparent 68%)",
            opacity: 0.07,
            animation: "nb-blob-c 17s ease-in-out infinite",
          }}
        />

        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        {/* top edge horizon line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8">
        {/* Section header */}
        <div className="mb-14 sm:mb-20 text-center">
          {/* badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-4 py-1.5 shadow-[0_0_24px_rgba(99,102,241,0.15)] backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-300">
              Product Preview
            </span>
          </div>

          {/* headline */}
          <h2
            className="mx-auto max-w-3xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-[3.25rem] leading-[1.12]"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {headline.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h2>

          {/* subtext */}
          <p
            className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-slate-400"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {subtext}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-10 flex justify-center">
          <div
            role="tablist"
            aria-label="Platform tabs"
            className="relative inline-flex items-center rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
          >
            {(["web", "desktop"] as Tab[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`relative z-10 flex items-center gap-2.5 rounded-[10px] px-5 py-2.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                  activeTab === tab
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="showcase-tab-bg"
                    className="absolute inset-0 rounded-[10px] border border-indigo-400/20 bg-gradient-to-b from-indigo-500/35 to-indigo-700/25 shadow-[0_0_20px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]"
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  />
                )}
                <span className="relative" aria-hidden="true">
                  {tab === "web" ? (
                    <svg
                      className="h-4 w-4"
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
                      className="h-4 w-4"
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
        <div className="relative px-0 sm:px-12 lg:px-20">
          {/* Feature pills — desktop only (hidden on mobile to avoid overlap) */}
          <div className="hidden sm:block">
            <FeaturePills features={resolvedPills} tabKey={activeTab} />
          </div>

          {/* Screenshot frame with crossfade */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={CONTENT_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {activeTab === "web" ? (
                <BrowserChrome screenshot={webScreenshot} />
              ) : (
                <DesktopChrome
                  screenshot={desktopScreenshot}
                  productName={productName}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Reflection glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 left-1/2 -z-10 h-28 -translate-x-1/2 blur-[70px]"
            style={{
              width: "65%",
              background:
                activeTab === "web"
                  ? "rgba(99,102,241,0.28)"
                  : "rgba(34,211,238,0.2)",
              transition: "background 0.5s ease",
            }}
          />
        </div>

        {/* Mobile pills — shown below frame on small screens */}
        <div className="mt-6 flex flex-wrap justify-center gap-2 sm:hidden">
          <AnimatePresence mode="popLayout">
            {resolvedPills.slice(0, 4).map((text, i) => (
              <motion.span
                key={`${activeTab}-m-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: { delay: i * 0.06 + 0.1 },
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-sm"
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{
                    background: activeTab === "web" ? "#818CF8" : "#22D3EE",
                  }}
                  aria-hidden="true"
                />
                {text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        {/* CTA strip */}
        <div className="mt-14 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="group relative inline-flex h-12 min-w-[190px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 px-8 text-[14px] font-semibold text-white shadow-[0_0_48px_-8px_rgba(99,102,241,0.75)] transition-all duration-200 hover:scale-[1.035] hover:shadow-[0_0_60px_-8px_rgba(99,102,241,1)] active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {/* shine sweep */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            <span className="relative z-10">Start Free Trial</span>
          </button>

          <button
            type="button"
            className="inline-flex h-12 min-w-[190px] items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-8 text-[14px] font-medium text-slate-300 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-indigo-400/50"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            View Live Demo
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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
          </button>
        </div>

        {/* Trust micro-line */}
        <p
          className="mt-5 text-center text-[12px] text-slate-600"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          No credit card required &bull; Free plan available &bull; Cancel
          anytime
        </p>
      </div>
    </section>
  );
}
