import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { DocumentScanner } from "./DocumentScanner";

/**
 * «Belge Tara» SEO araç sayfasının çalışan çekirdeği. Kamerayla belge tarayıp
 * cihazda PDF üretir (DocumentScanner). Her cihazda çalışır; en iyi deneyim
 * telefonda (arka kamera). Aranabilir PDF / gölge temizleme / sınırsız sayfa Pro.
 */
export function DocumentScannerLaunch({
  language,
  isPro,
  onUpgrade,
  onUseInTools,
}: {
  language: Language;
  isPro?: boolean;
  onUpgrade?: () => void;
  onUseInTools?: (file: File, toolId: string) => void;
}) {
  const tr = language === "tr";
  // PWA kısayolundan (?scan=1) gelindiyse tarayıcıyı doğrudan aç.
  const [open, setOpen] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("scan") === "1",
  );

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300 ring-1 ring-cyan-400/30">
          <Camera className="h-8 w-8" />
        </div>
        <p className="mt-4 text-lg font-bold text-white">
          {tr ? "Belgeni kamerayla tara" : "Scan your document with the camera"}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
          {tr
            ? "Kamerayı belgeye doğrult — kenarlar otomatik bulunur, belge sabitlenince kendiliğinden çekilir ve PDF olur."
            : "Point the camera at the document — edges are detected automatically, it captures when steady and becomes a PDF."}
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-[16px] font-bold text-white shadow-[0_18px_44px_-12px_rgba(6,182,212,0.7)] ring-1 ring-white/10 transition hover:from-cyan-500 hover:to-blue-500"
        >
          <Camera className="h-5 w-5" />
          {tr ? "Belge Tara" : "Scan document"}
        </button>

        <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-slate-500">
          <Smartphone className="h-3.5 w-3.5" />
          {tr ? "En iyi deneyim telefonda (arka kamera)" : "Best experience on a phone (rear camera)"}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "Cihazında işlenir" : "Runs on your device" },
            { icon: <Sparkles className="h-4 w-4" />, t: tr ? "Otomatik kenar + düzeltme" : "Auto edges + correction" },
            { icon: <ImageIcon className="h-4 w-4" />, t: tr ? "Çok sayfalı → tek PDF" : "Multi-page → one PDF" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-slate-300">
              <span className="text-cyan-300">{b.icon}</span>
              {b.t}
            </div>
          ))}
        </div>

        <p className="mt-5 text-[12px] text-slate-500">
          {tr ? "Elinizde hazır fotoğraflar mı var? " : "Already have photos? "}
          <a href="/tools/image-to-pdf" className="font-semibold text-cyan-300 hover:text-cyan-200">
            {tr ? "Görsel → PDF aracını kullanın" : "Use the Image → PDF tool"}
          </a>
        </p>
      </div>

      <AnimatePresence>
        {open && (
          <DocumentScanner
            open={open}
            language={language}
            onClose={() => setOpen(false)}
            isPro={isPro}
            onUpgrade={onUpgrade}
            onUseInTools={onUseInTools}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
