import type { Language } from "../../i18n/landing";
import { useSettings } from "../../hooks/useSettings";
import { CrawlableLink } from "../seo/CrawlableLink";
import { SocialIcon, socialLabelFromUrl, socialPlatformFromUrl } from "./socialIcons";

/**
 * Paylaşılan, href-tabanlı site footer'ı — callback gerektirmez, her sayfada (özellikle
 * blog) kullanılabilir. Araç sayfalarına iç-link taşır (blog → money-page link equity = SEO).
 * Sosyal bağlantılar site ayarlarından gelir; ikonlar landing footer'ıyla AYNI (socialIcons paylaşımlı).
 */

export function SiteFooter({ language }: { language: Language }) {
  const tr = language === "tr";
  const { site } = useSettings();
  const socialLinks = site.socialLinks ?? [];

  const cols: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: tr ? "Ürün" : "Product",
      links: [
        { label: tr ? "Tüm Araçlar" : "All Tools", href: "/" },
        { label: tr ? "Fiyatlandırma" : "Pricing", href: "/pricing" },
        { label: "Blog", href: "/blog" },
        { label: tr ? "Geliştirici API" : "Developer API", href: "/pdf-api" },
      ],
    },
    {
      heading: tr ? "Popüler Araçlar" : "Popular Tools",
      links: [
        { label: tr ? "PDF Birleştir" : "Merge PDF", href: "/tools/merge-pdf" },
        { label: tr ? "PDF → Word" : "PDF to Word", href: "/tools/pdf-to-word" },
        { label: tr ? "PDF Sıkıştır" : "Compress PDF", href: "/tools/compress" },
        { label: tr ? "PDF → JPG" : "PDF to JPG", href: "/tools/pdf-to-image" },
      ],
    },
    {
      heading: tr ? "Yasal" : "Legal",
      links: [
        { label: tr ? "Kullanım Şartları" : "Terms", href: "/terms" },
        { label: tr ? "Gizlilik" : "Privacy", href: "/privacy" },
        ...(tr ? [{ label: "KVKK", href: "/kvkk" }] : []),
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.06] bg-black/30 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-12">
          {/* Brand */}
          <div className="max-w-sm">
            <CrawlableLink href="/" className="group inline-flex items-center">
              <img
                src="/navbar-logo.png"
                alt="PDF Platform"
                className="h-11 w-auto object-contain transition-opacity group-hover:opacity-90 sm:h-12"
              />
            </CrawlableLink>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-gray-500">
              {tr
                ? "Birleştir, dönüştür, sıkıştır, düzenle — üyeliksiz ve hızlı. Yapısal araçlar cihazınızda, dosyalarınız gizli kalır."
                : "Merge, convert, compress, edit — no signup, fast. Structural tools run on your device; your files stay private."}
            </p>
            {socialLinks.length > 0 ? (
              <nav
                aria-label={tr ? "Sosyal medya" : "Social media"}
                className="mt-5 flex flex-wrap items-center gap-2"
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
                      <CrawlableLink
                        href={link.href}
                        className="text-[13.5px] text-gray-400 transition-colors hover:text-white"
                      >
                        {link.label}
                      </CrawlableLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.05] pt-6 text-[12px] text-gray-600">
          © {new Date().getFullYear()} PDF Platform. {tr ? "Tüm hakları saklıdır." : "All rights reserved."}
        </div>
      </div>
    </footer>
  );
}
