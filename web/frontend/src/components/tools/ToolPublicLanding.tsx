import { useState } from "react";
import { getToolSeo } from "../../seo/seoContent.mjs";
import type { Language } from "../../i18n/landing";

type ToolPublicLandingProps = {
  /** Araç slug'ı (örn. "merge-pdf") — seoContent ile birebir. */
  slug: string;
  language: Language;
  /** Birincil CTA — "Ücretsiz Kullan" (giriş/üyelik akışını başlatır; pending-tool saklanır). */
  onUse: () => void;
  /** İkincil — "Giriş yap". */
  onLogin: () => void;
};

/**
 * Giriş yapmamış kullanıcı bir araç deep-link'ine (`/tools/<slug>`) geldiğinde
 * LOGIN'e atılmak yerine bu PUBLIC tanıtım sayfasını görür. İçerik (H1 + açıklama
 * + SSS) statik prerender ile AYNI kaynaktan (`getToolSeo`) gelir → Google'ın JS
 * ile render ettiği sayfa, indekslediği prerender içerikle tutarlı olur.
 * Aracı kullanmak için CTA ile giriş/üyelik akışına yönlendirilir.
 */
export function ToolPublicLanding({
  slug,
  language,
  onUse,
  onLogin,
}: ToolPublicLandingProps) {
  const tr = language === "tr";
  const seo = getToolSeo(slug, language);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // seo null ise (bilinmeyen slug) çağıran taraf bu bileşeni hiç render etmez;
  // yine de defansif bir geri dönüş bırakıyoruz.
  if (!seo) return null;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#0d1120] to-[#060910] text-white">
      {/* Üst bar */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={onLogin}
          className="flex items-center gap-2"
          aria-label="PDF Platform"
        >
          <img src="/emblem.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold tracking-tight text-white">
            PDF Platform
          </span>
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
        >
          {tr ? "Giriş yap" : "Log in"}
        </button>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8 sm:pt-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
          ✦ {tr ? "Ücretsiz PDF aracı" : "Free PDF tool"}
        </span>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          {seo.h1}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
          {seo.intro}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_16px_40px_-10px_rgba(79,70,229,0.6)] transition hover:from-blue-500 hover:to-indigo-500"
          >
            {tr ? "Ücretsiz Kullan →" : "Use it free →"}
          </button>
          <span className="text-sm text-slate-500">
            {tr
              ? "Kurulum yok · kart gerekmez"
              : "No install · no card required"}
          </span>
        </div>

        {/* SSS — prerender ile aynı içerik */}
        {seo.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-lg font-bold text-slate-200">
              {tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}
            </h2>
            <div className="space-y-3">
              {seo.faq.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className={`overflow-hidden rounded-xl border transition ${
                      isOpen
                        ? "border-blue-500/40 bg-blue-500/[0.06]"
                        : "border-white/[0.08] bg-white/[0.025] hover:border-white/15"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-slate-200">
                        {item.q}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <p className="px-5 pb-4 text-sm leading-relaxed text-slate-400">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Alt CTA */}
        <div className="mt-14 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center">
          <p className="text-lg font-bold text-white">
            {tr ? "Hemen denemeye hazır mısın?" : "Ready to try it now?"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {tr
              ? "Ücretsiz hesabınla saniyeler içinde başla."
              : "Get started in seconds with your free account."}
          </p>
          <button
            type="button"
            onClick={onUse}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 text-sm font-bold text-white shadow-[0_16px_40px_-10px_rgba(79,70,229,0.6)] transition hover:from-blue-500 hover:to-indigo-500"
          >
            {tr ? "Ücretsiz Kullan →" : "Use it free →"}
          </button>
        </div>
      </main>
    </div>
  );
}
