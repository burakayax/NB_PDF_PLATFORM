import type { ReactNode } from "react";
import { Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getToolSeo } from "../../seo/seoContent.mjs";

type Props = {
  slug: string;
  language: Language;
  onLogin: () => void;
  onRegister: () => void;
  children: ReactNode;
};

/**
 * Genel misafir araç sayfası (SEO + tam sayfa) — herhangi bir aracı (AiPdfTool,
 * PdfEditor…) SEO içeriğiyle (H1 + açıklama + SSS) sarar. Prerender ile aynı içerik.
 */
export function GuestSeoToolPage({ slug, language, onLogin, onRegister, children }: Props) {
  const tr = language === "tr";
  const seo = getToolSeo(slug, language);

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button type="button" onClick={onLogin} className="flex items-center gap-2">
            <img src="/emblem.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold tracking-tight">PDF Platform</span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLogin}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:text-white">
              {tr ? "Giriş yap" : "Log in"}
            </button>
            <button type="button" onClick={onRegister}
              className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15">
              {tr ? "Üye Ol" : "Sign up"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:pt-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[12px] font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            {tr ? "Ücretsiz · Gizli · Kurulum yok" : "Free · Private · No install"}
          </span>
          <h1 className="mt-4 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent sm:text-4xl md:text-5xl">
            {seo?.h1 ?? slug}
          </h1>
          {seo?.intro && (
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
              {seo.intro}
            </p>
          )}
        </div>

        <div className="mt-9">{children}</div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "Dosyan cihazından çıkmaz" : "Files never leave your device" },
            { icon: <Zap className="h-4 w-4" />, t: tr ? "Anında işlem" : "Instant processing" },
            { icon: <Lock className="h-4 w-4" />, t: tr ? "Sınırsız & ücretsiz" : "Unlimited & free" },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[12px] text-slate-300">
              <span className="text-cyan-300">{b.icon}</span>
              {b.t}
            </div>
          ))}
        </div>

        {seo?.faq && seo.faq.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-4 text-center text-lg font-bold text-slate-200">
              {tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}
            </h2>
            <div className="space-y-3">
              {seo.faq.map((item, i) => (
                <details key={i}
                  className="group rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-200">
                    {item.q}
                    <span className="text-slate-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
