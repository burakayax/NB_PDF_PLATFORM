import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import {
  getToolSeo,
  getRelatedToolLinks,
  getGuideSlugsForTool,
} from "../../seo/seoContent.mjs";

type Props = {
  slug: string;
  language: Language;
  onLogin: () => void;
  onRegister: () => void;
  children: ReactNode;
  /** Oturum açıksa header giriş/üye-ol yerine "Panele git" gösterir (yanıltıcı olmasın). */
  isAuthenticated?: boolean;
  /** Oturum açık kullanıcıyı workspace'e (panele) götür. */
  onOpenApp?: () => void;
};

/**
 * Genel misafir araç sayfası (SEO + tam sayfa) — herhangi bir aracı (AiPdfTool,
 * PdfEditor…) SEO içeriğiyle (H1 + açıklama + SSS) sarar. Prerender ile aynı içerik.
 */
// Yalnızca bu araçlar tamamen cihazda (tarayıcıda) çalışır; dosya sunucuya
// gitmez. Diğerleri (PDF Düzenle sunucuda, AI araçları Anthropic'e metin
// gönderir) için "cihazdan çıkmaz" iddiası yanıltıcı olur — o yüzden ayrım.
const ON_DEVICE_SEO_TOOLS = new Set<string>(["pdf-imzala", "pdf-yorumla"]);

export function GuestSeoToolPage({ slug, language, onLogin, onRegister, children, isAuthenticated, onOpenApp }: Props) {
  const tr = language === "tr";
  const seo = getToolSeo(slug, language);
  const onDevice = ON_DEVICE_SEO_TOOLS.has(slug);
  const relatedTools = getRelatedToolLinks(slug, language) as Array<{ slug: string; label: string }>;

  // "İlgili Rehberler" başlıkları — ağır blogContent.mjs'i (tüm yazı gövdeleri) ANA
  // PAKETE sokmamak için dinamik import ile lazy çekilir. Bu bölüm sayfa altında ve
  // kritik değil; prerender SEO'su generate-seo-files.mjs tarafından ayrıca üretilir.
  const [guides, setGuides] = useState<Array<{ slug: string; title: string }>>([]);
  useEffect(() => {
    const guideSlugs = getGuideSlugsForTool(slug) as string[];
    if (guideSlugs.length === 0) {
      setGuides([]);
      return;
    }
    let alive = true;
    void import("../../blog/blogContent.mjs").then((m) => {
      if (!alive) return;
      setGuides(
        guideSlugs
          .map((g) => {
            const p = m.getBlogPost(g);
            const c = p ? (p[language] ?? p.tr) : null;
            return c ? { slug: g, title: c.title as string } : null;
          })
          .filter((x): x is { slug: string; title: string } => x !== null),
      );
    });
    return () => {
      alive = false;
    };
  }, [slug, language]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <button type="button" onClick={isAuthenticated ? onOpenApp : onLogin} className="flex items-center gap-2">
            <img src="/emblem.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold tracking-tight">PDF Platform</span>
          </button>
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-300 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                {tr ? "Oturum açık" : "Signed in"}
              </span>
              <button type="button" onClick={onOpenApp}
                className="rounded-lg bg-cyan-500/15 px-3.5 py-1.5 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/30 transition hover:bg-cyan-500/25">
                {tr ? "Panele git" : "Go to app"}
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:pt-14">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[12px] font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            {onDevice
              ? tr ? "Ücretsiz · Gizli · Kurulum yok" : "Free · Private · No install"
              : tr ? "Ücretsiz · Güvenli · Kurulum yok" : "Free · Secure · No install"}
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
          {(onDevice
            ? [
                { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "Dosyan cihazından çıkmaz" : "Files never leave your device" },
                { icon: <Zap className="h-4 w-4" />, t: tr ? "Anında işlem" : "Instant processing" },
                { icon: <Lock className="h-4 w-4" />, t: tr ? "Sınırsız & ücretsiz" : "Unlimited & free" },
              ]
            : [
                { icon: <ShieldCheck className="h-4 w-4" />, t: tr ? "İşlem sonrası dosyan silinir" : "Files deleted after processing" },
                { icon: <Zap className="h-4 w-4" />, t: tr ? "Hızlı, güvenli işleme" : "Fast, secure processing" },
                { icon: <Lock className="h-4 w-4" />, t: tr ? "Şifreli aktarım" : "Encrypted transfer" },
              ]
          ).map((b, i) => (
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

        {relatedTools.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-center text-lg font-bold text-slate-200">
              {tr ? "İlgili Araçlar" : "Related Tools"}
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {relatedTools.map((r) => (
                <a
                  key={r.slug}
                  href={`/tools/${r.slug}`}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-center text-[13px] font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:bg-white/[0.05] hover:text-white"
                >
                  {r.label}
                </a>
              ))}
            </div>
          </section>
        )}

        {guides.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-center text-lg font-bold text-slate-200">
              {tr ? "İlgili Rehberler" : "Related Guides"}
            </h2>
            <ul className="mx-auto max-w-2xl space-y-2">
              {guides.map((g) => (
                <li key={g.slug}>
                  <a
                    href={`/blog/${g.slug}`}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] font-medium text-slate-300 transition hover:border-amber-400/25 hover:bg-white/[0.05] hover:text-white"
                  >
                    <span className="text-amber-300">📄</span>
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
