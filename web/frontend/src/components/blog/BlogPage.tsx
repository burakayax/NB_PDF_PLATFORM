import { useEffect } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, Lightbulb, Newspaper, Sparkles } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { getBlogPost, getBlogPostsSorted } from "../../blog/blogContent.mjs";
import type { BlogBlock, BlogPost, BlogPostCopy } from "../../blog/blogContent.mjs";
import { SiteFooter } from "../common/SiteFooter";

type Accent = { grad: string; soft: string; text: string; ring: string; chip: string };
const ACCENTS: Record<string, Accent> = {
  fuchsia: { grad: "from-fuchsia-500 to-violet-600", soft: "from-fuchsia-500/20 to-violet-600/20", text: "text-fuchsia-300", ring: "border-fuchsia-400/30", chip: "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200" },
  blue: { grad: "from-blue-500 to-indigo-600", soft: "from-blue-500/20 to-indigo-600/20", text: "text-blue-300", ring: "border-blue-400/30", chip: "border-blue-400/25 bg-blue-500/10 text-blue-200" },
  violet: { grad: "from-violet-500 to-purple-600", soft: "from-violet-500/20 to-purple-600/20", text: "text-violet-300", ring: "border-violet-400/30", chip: "border-violet-400/25 bg-violet-500/10 text-violet-200" },
  cyan: { grad: "from-cyan-500 to-blue-600", soft: "from-cyan-500/20 to-blue-600/20", text: "text-cyan-300", ring: "border-cyan-400/30", chip: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200" },
  emerald: { grad: "from-emerald-500 to-teal-600", soft: "from-emerald-500/20 to-teal-600/20", text: "text-emerald-300", ring: "border-emerald-400/30", chip: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" },
  amber: { grad: "from-amber-500 to-orange-600", soft: "from-amber-500/20 to-orange-600/20", text: "text-amber-300", ring: "border-amber-400/30", chip: "border-amber-400/25 bg-amber-500/10 text-amber-200" },
};
const accentOf = (a: string) => ACCENTS[a] ?? ACCENTS.fuchsia;

const fmtDate = (iso: string, tr: boolean) => {
  try {
    return new Date(iso).toLocaleDateString(tr ? "tr-TR" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch { return iso; }
};

function Header({
  language,
  isAuthenticated,
  onOpenApp,
  onLogin,
  onRegister,
  onSwitchLanguage,
}: {
  language: Language;
  isAuthenticated: boolean;
  onOpenApp: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onSwitchLanguage: (lang: "tr" | "en") => void;
}) {
  const tr = language === "tr";
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b1020]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <a href="/" className="flex items-center gap-2">
          <img src="/emblem.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-sm font-bold tracking-tight text-white">PDF Platform</span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href="/blog" className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:text-white sm:inline-block">Blog</a>
          {/* Dil değiştirici — doğrudan girişte (Google'dan gelen) kullanıcı dili değiştirebilsin */}
          <div className="flex items-center rounded-lg border border-white/10 p-0.5 text-xs font-bold">
            <button type="button" onClick={() => onSwitchLanguage("tr")} aria-pressed={tr} className={`rounded-md px-2 py-1 transition ${tr ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>TR</button>
            <button type="button" onClick={() => onSwitchLanguage("en")} aria-pressed={!tr} className={`rounded-md px-2 py-1 transition ${!tr ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>EN</button>
          </div>
          {isAuthenticated ? (
            <button type="button" onClick={onOpenApp} className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15">{tr ? "Uygulamaya git" : "Open app"}</button>
          ) : (
            <>
              <button type="button" onClick={onLogin} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:text-white">{tr ? "Giriş yap" : "Log in"}</button>
              <button type="button" onClick={onRegister} className="rounded-lg bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15">{tr ? "Üye Ol" : "Sign up"}</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh bg-[radial-gradient(125%_125%_at_50%_-10%,#16213e_0%,#0b1020_42%,#070b14_100%)] text-white">{children}</div>
);

// ─── Blok renderer ────────────────────────────────────────────────────────────
function Blocks({ blocks, accent, tr }: { blocks: BlogBlock[]; accent: Accent; tr: boolean }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        if (b.t === "lead") return <p key={i} className="text-[18px] leading-relaxed text-slate-200">{b.x}</p>;
        if (b.t === "p") return <p key={i} className="text-[16px] leading-[1.75] text-slate-300">{b.x}</p>;
        if (b.t === "h2") return <h2 key={i} className="!mt-11 flex items-center gap-3 text-[22px] font-extrabold tracking-tight text-white sm:text-2xl"><span className={`h-6 w-1.5 rounded-full bg-gradient-to-b ${accent.grad}`} />{b.x}</h2>;
        if (b.t === "h3") return <h3 key={i} className="!mt-7 text-lg font-bold text-white">{b.x}</h3>;
        if (b.t === "ul") return <ul key={i} className="space-y-2 pl-1">{b.items.map((it, j) => <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-300"><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r ${accent.grad}`} />{it}</li>)}</ul>;
        if (b.t === "ol") return <ol key={i} className="space-y-2 pl-1">{b.items.map((it, j) => <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-300"><span className={`shrink-0 font-bold ${accent.text}`}>{j + 1}.</span>{it}</li>)}</ol>;
        if (b.t === "tip") return (
          <div key={i} className={`flex gap-3 rounded-2xl border ${accent.ring} bg-white/[0.03] p-4`}>
            <Lightbulb className={`mt-0.5 h-5 w-5 shrink-0 ${accent.text}`} />
            <p className="text-[14px] leading-relaxed text-slate-300"><b className="text-white">{tr ? "İpucu: " : "Tip: "}</b>{b.x}</p>
          </div>
        );
        if (b.t === "steps") return (
          <div key={i} className="space-y-3">
            {b.items.map((s, j) => (
              <div key={j} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${accent.grad} text-[15px] font-black text-white`}>{j + 1}</span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-white">{s.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-slate-400">{s.x}</p>
                </div>
              </div>
            ))}
          </div>
        );
        if (b.t === "cta") return (
          <a key={i} href={b.tool} className={`group flex items-center justify-between gap-4 rounded-2xl border ${accent.ring} bg-gradient-to-r ${accent.soft} p-5 transition hover:brightness-110`}>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[15px] font-black text-white"><Sparkles className={`h-4 w-4 ${accent.text}`} />{b.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{b.x}</p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r ${accent.grad} px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition group-hover:gap-2.5`}>{b.btn}<ArrowRight className="h-4 w-4" /></span>
          </a>
        );
        return null;
      })}
    </div>
  );
}

// ─── Blog index ───────────────────────────────────────────────────────────────
export function BlogIndexPage({ language, onLogin, onRegister, isAuthenticated, onOpenApp, onSwitchLanguage }: { language: Language; onLogin: () => void; onRegister: () => void; isAuthenticated: boolean; onOpenApp: () => void; onSwitchLanguage: (lang: "tr" | "en") => void }) {
  const tr = language === "tr";
  const posts = getBlogPostsSorted() as BlogPost[];
  useEffect(() => { document.title = tr ? "Blog — PDF Platform" : "Blog — PDF Platform"; }, [tr]);
  return (
    <Shell>
      <Header language={language} isAuthenticated={isAuthenticated} onOpenApp={onOpenApp} onLogin={onLogin} onRegister={onRegister} onSwitchLanguage={onSwitchLanguage} />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-12 sm:pt-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-[12px] font-semibold text-fuchsia-300"><Newspaper className="h-3.5 w-3.5" />{tr ? "Rehberler & İpuçları" : "Guides & Tips"}</span>
          <h1 className="mt-4 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">PDF Platform Blog</h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">{tr ? "PDF işlerini hızlandıran pratik rehberler: birleştirme, veri çıkarma, çeviri ve yapay zekâ araçlarıyla iş akışınızı kolaylaştırın." : "Practical guides to speed up your PDF work: merging, data extraction, translation and AI tools to simplify your workflow."}</p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {posts.map((p) => {
            const c = p[tr ? "tr" : "en"] as BlogPostCopy;
            const a = accentOf(p.accent);
            const tags = p.tags[tr ? "tr" : "en"];
            return (
              <a key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]">
                <div className={`relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${a.soft}`}>
                  <div className={`pointer-events-none absolute -top-10 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-gradient-to-b ${a.grad} opacity-30 blur-3xl`} />
                  <Newspaper className={`h-12 w-12 ${a.text} opacity-80`} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => <span key={t} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${a.chip}`}>{t}</span>)}
                  </div>
                  <h2 className="text-[17px] font-extrabold leading-snug text-white transition group-hover:text-white">{c.title}</h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-relaxed text-slate-400">{c.excerpt}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fmtDate(p.date, tr)}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{p.readMinutes} {tr ? "dk okuma" : "min read"}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </main>
      <SiteFooter language={language} />
    </Shell>
  );
}

// ─── Blog post ────────────────────────────────────────────────────────────────
export function BlogPostPage({ slug, language, onLogin, onRegister, isAuthenticated, onOpenApp, onSwitchLanguage }: { slug: string; language: Language; onLogin: () => void; onRegister: () => void; isAuthenticated: boolean; onOpenApp: () => void; onSwitchLanguage: (lang: "tr" | "en") => void }) {
  const tr = language === "tr";
  const post = getBlogPost(slug) as BlogPost | null;
  const c = post ? (post[tr ? "tr" : "en"] as BlogPostCopy) : null;

  useEffect(() => { if (c) document.title = `${c.title} — PDF Platform`; }, [c]);

  if (!post || !c) {
    return (
      <Shell>
        <Header language={language} isAuthenticated={isAuthenticated} onOpenApp={onOpenApp} onLogin={onLogin} onRegister={onRegister} onSwitchLanguage={onSwitchLanguage} />
        <main className="mx-auto max-w-3xl px-5 py-24 text-center">
          <p className="text-lg font-bold text-white">{tr ? "Yazı bulunamadı" : "Post not found"}</p>
          <a href="/blog" className="mt-4 inline-block text-fuchsia-300 hover:text-fuchsia-200">← Blog</a>
        </main>
      </Shell>
    );
  }

  const a = accentOf(post.accent);
  const tags = post.tags[tr ? "tr" : "en"];
  const related = getBlogPostsSorted().filter((p) => p.slug !== post.slug).slice(0, 2) as BlogPost[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: c.title,
    description: c.description,
    datePublished: post.date,
    dateModified: post.updated,
    inLanguage: tr ? "tr" : "en",
    author: { "@type": "Organization", name: "PDF Platform" },
    publisher: { "@type": "Organization", name: "PDF Platform", logo: { "@type": "ImageObject", url: "https://www.pdfplatform.app/logo.png" } },
    mainEntityOfPage: `https://www.pdfplatform.app/blog/${post.slug}`,
  };

  return (
    <Shell>
      <Header language={language} isAuthenticated={isAuthenticated} onOpenApp={onOpenApp} onLogin={onLogin} onRegister={onRegister} onSwitchLanguage={onSwitchLanguage} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8">
        <a href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" />{tr ? "Tüm yazılar" : "All posts"}</a>

        {/* Başlık bloğu */}
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.map((t) => <span key={t} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${a.chip}`}>{t}</span>)}
          </div>
          <h1 className="text-[30px] font-black leading-tight tracking-tight text-white sm:text-[38px]">{c.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-slate-400">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(post.date, tr)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{post.readMinutes} {tr ? "dk okuma" : "min read"}</span>
            <span className="text-slate-500">PDF Platform</span>
          </div>
        </div>

        {/* Aksан banner */}
        <div className={`mt-7 h-1 w-full rounded-full bg-gradient-to-r ${a.grad}`} />

        {/* Gövde */}
        <article className="mt-8">
          <Blocks blocks={c.blocks} accent={a} tr={tr} />
        </article>

        {/* SSS */}
        {c.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-xl font-extrabold text-white">{tr ? "Sık Sorulan Sorular" : "Frequently Asked Questions"}</h2>
            <div className="space-y-3">
              {c.faq.map((f, i) => (
                <details key={i} className="group rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-[15px] font-semibold text-slate-100">{f.q}<span className="text-slate-500 transition group-open:rotate-45">+</span></summary>
                  <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Ana araç CTA */}
        <a href={post.tool} className={`mt-12 flex flex-col items-center gap-3 rounded-3xl border ${a.ring} bg-gradient-to-b ${a.soft} to-transparent p-8 text-center transition hover:brightness-110 sm:flex-row sm:justify-between sm:text-left`}>
          <div>
            <p className="text-lg font-black text-white">{tr ? "Hemen deneyin" : "Try it now"}</p>
            <p className="mt-1 text-[14px] text-slate-300">{tr ? "Bu rehberdeki aracı açın ve saniyeler içinde sonucu alın." : "Open the tool from this guide and get results in seconds."}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r ${a.grad} px-6 py-3 text-sm font-bold text-white shadow-lg`}>{tr ? "Aracı Aç" : "Open Tool"}<ArrowRight className="h-4 w-4" /></span>
        </a>

        {/* İlgili yazılar */}
        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-lg font-bold text-slate-200">{tr ? "İlgili yazılar" : "Related posts"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((p) => {
                const rc = p[tr ? "tr" : "en"] as BlogPostCopy;
                const ra = accentOf(p.accent);
                return (
                  <a key={p.slug} href={`/blog/${p.slug}`} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]">
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${ra.text}`}>{p.tags[tr ? "tr" : "en"][0]}</p>
                    <p className="mt-1.5 text-[15px] font-bold leading-snug text-white">{rc.title}</p>
                    <p className="mt-1.5 line-clamp-2 text-[12px] text-slate-400">{rc.excerpt}</p>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <SiteFooter language={language} />
    </Shell>
  );
}
