import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Language } from "../../i18n/landing";

type Highlight = { left: number; top: number; width: number; height: number };
type Step = {
  img: string;
  title: string;
  caption: string;
  accent: string; // rgb triplet
  hl: Highlight;
};

const AUTO_MS = 3000;

/**
 * "3 Adımda Tamamla" canlı demo — gerçek uygulama ekran görüntüleriyle.
 * Üç adım otomatik döner; her adımda ilgili bölge (araç listesi → dosya seç
 * → indir/paylaş butonları) parlayan bir çerçeveyle VURGULANIR. Sekmelere
 * tıklanarak da gezilebilir; fareyle üzerine gelince otomatik geçiş durur.
 */
export function ThreeStepDemo({ language }: { language: Language }) {
  const tr = language === "tr";
  const steps: Step[] = tr
    ? [
        {
          img: "/demo/step1.png",
          title: "Aracı Seç",
          caption: "Soldaki menüden ihtiyacın olan PDF aracını seç.",
          accent: "59,130,246",
          hl: { left: 0.6, top: 5, width: 13, height: 90 },
        },
        {
          img: "/demo/step2.png",
          title: "Dosyanı Yükle",
          caption: "Sürükle-bırak ya da “Dosya Seç” ile dosyanı ekle.",
          accent: "139,92,246",
          hl: { left: 16, top: 25, width: 30, height: 14 },
        },
        {
          img: "/demo/step3.jpg",
          title: "Sayfaları Seç & Düzenle",
          caption: "Sayfaları görsel olarak seç, sil, sırala veya döndür.",
          accent: "236,72,153",
          hl: { left: 3, top: 16, width: 34, height: 62 },
        },
        {
          img: "/demo/step4.png",
          title: "Otomatik İndir & Paylaş",
          caption:
            "İşlem biter ve dosyan otomatik indirilir — ayrıca Paylaş ya da Aç. Kaydet'e gerek yok!",
          accent: "6,182,212",
          hl: { left: 67, top: 85, width: 32, height: 12 },
        },
      ]
    : [
        {
          img: "/demo/step1.png",
          title: "Pick your tool",
          caption: "Choose the PDF tool you need from the left menu.",
          accent: "59,130,246",
          hl: { left: 0.6, top: 5, width: 13, height: 90 },
        },
        {
          img: "/demo/step2.png",
          title: "Upload your file",
          caption: "Drag & drop or click “Select file” to add your file.",
          accent: "139,92,246",
          hl: { left: 16, top: 25, width: 30, height: 14 },
        },
        {
          img: "/demo/step3.jpg",
          title: "Select & arrange pages",
          caption: "Visually select, delete, reorder or rotate pages.",
          accent: "236,72,153",
          hl: { left: 3, top: 16, width: 34, height: 62 },
        },
        {
          img: "/demo/step4.png",
          title: "Auto-download & share",
          caption:
            "It's done and saved automatically — plus Share or Open. No Save button needed!",
          accent: "6,182,212",
          hl: { left: 67, top: 85, width: 32, height: 12 },
        },
      ];

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(
      () => setActive((a) => (a + 1) % steps.length),
      AUTO_MS,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, steps.length]);

  const step = steps[active]!;

  return (
    <div
      className="mx-auto mb-14 max-w-4xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Demo ekranı */}
      <div className="relative aspect-[1440/690] w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d1120] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)]">
        <AnimatePresence mode="wait">
          <motion.img
            key={active}
            src={step.img}
            alt={step.title}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </AnimatePresence>

        {/* Vurgu çerçevesi — ilgili bölgeyi işaretler, nabız gibi parlar */}
        <motion.div
          key={`hl-${active}`}
          className="pointer-events-none absolute rounded-xl"
          style={{
            left: `${step.hl.left}%`,
            top: `${step.hl.top}%`,
            width: `${step.hl.width}%`,
            height: `${step.hl.height}%`,
            border: `2px solid rgba(${step.accent},0.95)`,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            boxShadow: [
              `0 0 0 0 rgba(${step.accent},0.5), 0 0 22px rgba(${step.accent},0.35)`,
              `0 0 0 8px rgba(${step.accent},0), 0 0 30px rgba(${step.accent},0.5)`,
            ],
          }}
          transition={{
            opacity: { duration: 0.4 },
            boxShadow: { duration: 1.4, repeat: Infinity, repeatType: "reverse" },
          }}
        />

        {/* Adım rozeti + açıklama (alt şerit) */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-4 py-3 sm:px-5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: `rgb(${step.accent})` }}
          >
            {active + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white sm:text-base">
              {step.title}
            </p>
            <p className="truncate text-[11px] text-slate-300 sm:text-xs">
              {step.caption}
            </p>
          </div>
        </div>
      </div>

      {/* Adım sekmeleri */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {steps.map((s, i) => {
          const isActive = i === active;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setActive(i)}
              className={`group rounded-xl border px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-white/20 bg-white/[0.06]"
                  : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
              style={
                isActive
                  ? { boxShadow: `0 0 0 1px rgba(${s.accent},0.5)` }
                  : undefined
              }
            >
              <span className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{
                    background: isActive
                      ? `rgb(${s.accent})`
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className={`truncate text-[12px] font-semibold sm:text-sm ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  {s.title}
                </span>
              </span>
              {/* İlerleme çizgisi (aktif adımda dolar) */}
              <span className="mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                {isActive && !paused && (
                  <motion.span
                    key={`bar-${active}`}
                    className="block h-full rounded-full"
                    style={{ background: `rgb(${s.accent})` }}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: AUTO_MS / 1000, ease: "linear" }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
