import { ArrowUpRight, Lock, ShieldCheck, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { useSettings } from "../../hooks/useSettings";
import { localizedPath } from "../../seo/enSlugs.mjs";
import { SocialIcon, socialLabelFromUrl, socialPlatformFromUrl } from "./socialIcons";

type LegalKind = "terms" | "privacy" | "kvkk";

interface Props {
  language: Language;
  onOpenLegal: (kind: LegalKind) => void;
  onContact: () => void;
}

/**
 * Çalışma alanı (giriş yapmış kullanıcı) alt bilgisi. Web tarafındaki footer ile aynı marka dilini
 * taşır ama uygulama içinde olduğu için daha kompakt: marka bloğu, üç bağlantı sütunu, güven rozetleri
 * ve alt telif satırı. Yasal sayfalar uygulama içinde açılır (çalışma alanından çıkarmaz).
 */
export function WorkspaceFooter({ language, onOpenLegal, onContact }: Props) {
  const tr = language === "tr";
  const { site } = useSettings();
  const socialLinks = site.socialLinks ?? [];
  const yol = (p: string) => localizedPath(p, language);

  const linkClass =
    "group inline-flex min-h-[28px] items-center gap-1 text-[13px] text-slate-400 transition-colors hover:text-white focus:outline-none focus-visible:text-white focus-visible:underline";

  const trust = [
    { icon: <Lock className="h-3.5 w-3.5" />, text: tr ? "Şifreli bağlantı" : "Encrypted connection" },
    { icon: <ShieldCheck className="h-3.5 w-3.5" />, text: tr ? "Güvenli oturum" : "Secure session" },
    { icon: <Zap className="h-3.5 w-3.5" />, text: tr ? "Hızlı işleme" : "Fast processing" },
  ];

  return (
    <footer className="relative mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative grid gap-8 px-6 py-8 sm:px-8 md:grid-cols-[1.3fr_2fr] md:gap-12">
        {/* Marka */}
        <div>
          <div className="flex items-center gap-3">
            <img src="/emblem.png" alt="" aria-hidden="true" className="h-10 w-10 object-contain" />
            <div>
              <p
                className="text-base font-extrabold leading-tight tracking-tight text-white"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                PDF Platform
              </p>
              <p className="text-[12px] text-slate-400">by NB Global Studio</p>
            </div>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-slate-400">
            {tr
              ? "Belgelerinizi birleştirin, dönüştürün, sıkıştırın ve düzenleyin — tek yerden, hızlı ve güvenle."
              : "Merge, convert, compress and edit your documents — in one place, fast and secure."}
          </p>
          {socialLinks.length > 0 ? (
            <nav aria-label={tr ? "Sosyal medya" : "Social media"} className="mt-4 flex flex-wrap items-center gap-2">
              {socialLinks.map((url) => {
                const label = socialLabelFromUrl(url);
                return (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="me noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-slate-400 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-white"
                  >
                    <SocialIcon platform={socialPlatformFromUrl(url)} className="h-4 w-4" />
                  </a>
                );
              })}
            </nav>
          ) : null}
        </div>

        {/* Bağlantı sütunları */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
          <div>
            <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-300">
              {tr ? "Keşfet" : "Explore"}
            </p>
            <ul className="space-y-1">
              <li><a className={linkClass} href={yol("/pricing")}>{tr ? "Fiyatlandırma" : "Pricing"}</a></li>
              <li><a className={linkClass} href={yol("/blog")}>Blog</a></li>
              <li><a className={linkClass} href={yol("/pdf-api")}>{tr ? "Geliştirici API" : "Developer API"}</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-300">
              {tr ? "Destek" : "Support"}
            </p>
            <ul className="space-y-1">
              <li>
                <button type="button" className={linkClass} onClick={onContact}>
                  {tr ? "İletişim" : "Contact"}
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                </button>
              </li>
              <li>
                <a className={linkClass} href="mailto:info@pdfplatform.app">info@pdfplatform.app</a>
              </li>
            </ul>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-300">
              {tr ? "Yasal" : "Legal"}
            </p>
            <ul className="space-y-1">
              <li><button type="button" className={linkClass} onClick={() => onOpenLegal("terms")}>{tr ? "Hizmet Şartları" : "Terms of Service"}</button></li>
              <li><button type="button" className={linkClass} onClick={() => onOpenLegal("privacy")}>{tr ? "Gizlilik Politikası" : "Privacy Policy"}</button></li>
              <li><button type="button" className={linkClass} onClick={() => onOpenLegal("kvkk")}>{tr ? "KVKK Aydınlatma" : "KVKK Disclosure"}</button></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Alt çubuk */}
      <div className="relative flex flex-col items-center gap-3 border-t border-white/[0.06] bg-black/20 px-6 py-4 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <p className="text-[12px] text-slate-400">
          © {new Date().getFullYear()} NB Global Studio. {tr ? "Tüm hakları saklıdır." : "All rights reserved."}
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {trust.map((b) => (
            <li
              key={b.text}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[12px] font-medium text-slate-300"
            >
              <span className="text-cyan-300">{b.icon}</span>
              {b.text}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
