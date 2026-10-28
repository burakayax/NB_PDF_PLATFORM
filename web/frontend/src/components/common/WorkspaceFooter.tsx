import { useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Lock, ShieldCheck, Zap } from "lucide-react";
import type { Language } from "../../i18n/landing";
import { useSettings } from "../../hooks/useSettings";
import { localizedPath } from "../../seo/enSlugs.mjs";
import { PaytrBadge } from "./PaytrBadge";
import { SocialIcon, socialLabelFromUrl, socialPlatformFromUrl } from "./socialIcons";

type LegalKind = "terms" | "privacy" | "kvkk";

interface Props {
  language: Language;
  onOpenLegal: (kind: LegalKind) => void;
  onContact: () => void;
}

/**
 * Bağlantı grubu. Masaüstünde (md+) başlık + açık liste; telefonda akordeon: başlık satırının tamamı
 * 44px+ dokunma alanıdır, uzun bağlantı yığını varsayılan kapalıdır (yanlış dokunmayı ve kaydırmayı azaltır).
 */
function FooterGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] md:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between text-left text-[12px] font-bold uppercase tracking-[0.16em] text-slate-300 md:pointer-events-none md:mb-2 md:min-h-0 md:cursor-default"
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-slate-400 transition-transform md:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>
      <ul className={`${open ? "block" : "hidden"} pb-3 md:block md:pb-0`}>{children}</ul>
    </div>
  );
}

/**
 * Çalışma alanı (giriş yapmış kullanıcı) alt bilgisi. İçerik sütununun tam genişliğini kaplar, kısa
 * sayfalarda da en alta oturur. Yasal sayfalar uygulama içinde açılır (çalışma alanından çıkarmaz).
 */
export function WorkspaceFooter({ language, onOpenLegal, onContact }: Props) {
  const tr = language === "tr";
  const { site } = useSettings();
  const socialLinks = site.socialLinks ?? [];
  const yol = (p: string) => localizedPath(p, language);

  // Telefonda 44px dokunma alanı, masaüstünde kompakt.
  const linkClass =
    "group inline-flex min-h-[44px] w-full items-center gap-1 text-[14px] text-slate-300 transition-colors hover:text-white focus:outline-none focus-visible:text-white focus-visible:underline md:min-h-[30px] md:text-[13px] md:text-slate-400";

  const trust = [
    { icon: <Lock className="h-3.5 w-3.5" />, text: tr ? "Şifreli bağlantı" : "Encrypted connection" },
    { icon: <ShieldCheck className="h-3.5 w-3.5" />, text: tr ? "Güvenli oturum" : "Secure session" },
    { icon: <Zap className="h-3.5 w-3.5" />, text: tr ? "Hızlı işleme" : "Fast processing" },
  ];

  return (
    <footer className="relative mt-auto w-full shrink-0 overflow-hidden border-t border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-black/20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
      />

      <div className="relative mx-auto grid w-full max-w-5xl gap-6 px-4 pb-4 pt-8 sm:px-6 md:grid-cols-[1.2fr_2fr] md:gap-12 md:px-8 lg:max-w-6xl xl:max-w-7xl">
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
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-slate-400">
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
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-white md:h-9 md:w-9"
                  >
                    <SocialIcon platform={socialPlatformFromUrl(url)} className="h-[18px] w-[18px]" />
                  </a>
                );
              })}
            </nav>
          ) : null}
        </div>

        {/* Bağlantı grupları: telefonda akordeon, md+ üç sütun */}
        <div className="border-t border-white/[0.06] md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-6 md:border-t-0 xl:grid-cols-4">
          <FooterGroup title={tr ? "Keşfet" : "Explore"}>
            <li><a className={linkClass} href={yol("/pricing")}>{tr ? "Fiyatlandırma" : "Pricing"}</a></li>
            <li><a className={linkClass} href={yol("/blog")}>Blog</a></li>
            <li><a className={linkClass} href={yol("/pdf-api")}>{tr ? "Geliştirici API" : "Developer API"}</a></li>
          </FooterGroup>
          <FooterGroup title={tr ? "Popüler Araçlar" : "Popular Tools"}>
            <li><a className={linkClass} href={yol("/tools/merge-pdf")}>{tr ? "PDF Birleştir" : "Merge PDF"}</a></li>
            <li><a className={linkClass} href={yol("/tools/pdf-to-word")}>{tr ? "PDF → Word" : "PDF to Word"}</a></li>
            <li><a className={linkClass} href={yol("/tools/compress")}>{tr ? "PDF Sıkıştır" : "Compress PDF"}</a></li>
            <li><a className={linkClass} href={yol("/tools/pdf-to-image")}>{tr ? "PDF → JPG" : "PDF to JPG"}</a></li>
          </FooterGroup>
          <FooterGroup title={tr ? "Destek" : "Support"}>
            <li>
              <button type="button" className={linkClass} onClick={onContact}>
                {tr ? "İletişim" : "Contact"}
                <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
              </button>
            </li>
            <li>
              <a className={linkClass} href="mailto:info@pdfplatform.app">info@pdfplatform.app</a>
            </li>
          </FooterGroup>
          <FooterGroup title={tr ? "Yasal" : "Legal"}>
            <li><button type="button" className={linkClass} onClick={() => onOpenLegal("terms")}>{tr ? "Hizmet Şartları" : "Terms of Service"}</button></li>
            <li><button type="button" className={linkClass} onClick={() => onOpenLegal("privacy")}>{tr ? "Gizlilik Politikası" : "Privacy Policy"}</button></li>
            <li><button type="button" className={linkClass} onClick={() => onOpenLegal("kvkk")}>{tr ? "KVKK Aydınlatma" : "KVKK Disclosure"}</button></li>
            {tr ? (
              <>
                <li><a className={linkClass} href={yol("/legal/on-bilgilendirme")}>Ön Bilgilendirme</a></li>
                <li><a className={linkClass} href={yol("/legal/mesafeli-satis")}>Mesafeli Satış</a></li>
              </>
            ) : null}
          </FooterGroup>
        </div>
      </div>

      {/* Alt çubuk: telefonda güvenli alan (çentik/ana çubuk) kadar ekstra alt boşluk */}
      <div className="relative border-t border-white/[0.06] bg-black/25 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-4 text-center sm:px-6 md:flex-row md:justify-between md:px-8 md:text-left lg:max-w-6xl xl:max-w-7xl">
          <ul className="flex flex-wrap items-center justify-center gap-2 md:order-2">
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
          <div className="text-[12px] text-slate-400 md:order-1">
            <p>© {new Date().getFullYear()} NB Global Studio. {tr ? "Tüm hakları saklıdır." : "All rights reserved."}</p>
            <p className="mt-0.5">{tr ? "Verimlilik için ❤️ ile yapıldı" : "Made with ❤️ for productivity"}</p>
            <PaytrBadge height={16} tr={tr} className="mt-2" />
          </div>
        </div>
      </div>
    </footer>
  );
}
