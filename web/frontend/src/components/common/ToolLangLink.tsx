import type { MouseEvent } from "react";
import type { Language } from "../../i18n/landing";
import { rememberLanguageChoice } from "../../hooks/usePreferredLanguage";
import { localizedPath } from "../../seo/enSlugs.mjs";
import { getToolSeo, useToolSeoReady } from "../../seo/toolSeoRuntime";

/** Karşı dildeki aynı aracın adresi; o dilde sayfa yoksa null (düğme gösterilmez). */
export function toolLangHref(slug: string, language: Language): { target: Language; href: string } | null {
  const target: Language = language === "tr" ? "en" : "tr";
  if (!getToolSeo(slug, target)) return null;
  return { target, href: localizedPath(`/tools/${slug}`, target) };
}

/**
 * Misafir araç sayfalarının üst çubuğundaki dil bağlantısı. Gerçek <a href>:
 * arama motoru izleyebilir, JavaScript olmadan da çalışır.
 */
export function ToolLangLink({ slug, language, className = "" }: { slug: string; language: Language; className?: string }) {
  useToolSeoReady(); // araç metinleri geç yüklenirse yeniden çiz
  const link = toolLangHref(slug, language);
  if (!link) return null;
  const { target, href } = link;
  const label = target === "en" ? "Switch to English" : "Türkçe sayfaya geç";
  // Seçim kaydedilmezse, daha önce diğer dili seçmiş kullanıcıda seçim geri döner.
  const remember = (e: MouseEvent) => {
    if (e.button === 0) rememberLanguageChoice(target);
  };
  return (
    <a
      href={href}
      hrefLang={target}
      lang={target}
      aria-label={label}
      title={label}
      onClick={remember}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-1.5 text-xs font-bold uppercase text-gray-300 transition hover:bg-white/10 ${className}`}
    >
      {target}
    </a>
  );
}
