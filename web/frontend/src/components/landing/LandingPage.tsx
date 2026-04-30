import { useEffect, useMemo, useState } from "react";
import { submitContactForm } from "../../api/contact";
import { getSaasApiBase } from "../../api/saasBase";
import { useSettings } from "../../hooks/useSettings";
import {
  getWindowsDownloadUrlFromCms,
  mergeLandingWithCms,
  resolveCmsAssetUrl,
} from "../../lib/landingCmsMerge";
import {
  ADMIN_PREVIEW_HIGHLIGHT,
  isCmsPreviewActive,
} from "../../lib/cmsPreview";
import { landingTranslations, type Language } from "../../i18n/landing";
import { LandingIcon } from "./LandingIcon";
import { LandingPricingSection } from "./LandingPricingSection";
import { Marquee } from "../ui/marquee";
import { CrawlableLink } from "../seo/CrawlableLink";

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onUseWebApp: () => void;
  isAuthenticated: boolean;

  /** Giriş yapılmışsa: "Merhaba, Ahmet" / "Hello, Alex" (yalnızca ad). */
  authGreeting?: string;
  onLogin: () => void;
  onRegister: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenKvkk: () => void;
};

export function LandingPage({
  language,
  onLanguageChange,
  onUseWebApp,
  isAuthenticated,
  authGreeting,
  onLogin,
  onRegister,
  onOpenTerms,
  onOpenPrivacy,
  onOpenKvkk,
}: LandingPageProps) {
  const { cms: cmsContent, flags: runtimeFlags } = useSettings();
  const contactFormEnabled = runtimeFlags.featureFlags?.contactForm !== false;
  const windowsDownloadUrl = useMemo(
    () => getWindowsDownloadUrlFromCms(cmsContent),
    [cmsContent],
  );

  const { copy, heroImageSrc, logoSrc } = useMemo(() => {
    const base = landingTranslations[language];
    const merged = mergeLandingWithCms(base, cmsContent ?? null, language);
    const apiBase = getSaasApiBase();
    const assets = cmsContent?.assets as
      | {
          heroImageUrl?: string;
          logoUrl?: string;
          screenshot1Url?: string;
          screenshot2Url?: string;
        }
      | undefined;
    const hero =
      resolveCmsAssetUrl(assets?.heroImageUrl, apiBase) ??
      "/app-preview-main.png";
    const logo = resolveCmsAssetUrl(assets?.logoUrl, apiBase);
    const s1 = resolveCmsAssetUrl(assets?.screenshot1Url, apiBase);
    const s2 = resolveCmsAssetUrl(assets?.screenshot2Url, apiBase);
    let copyOut = merged;
    if (s1 || s2) {
      copyOut = {
        ...merged,
        screenshots: {
          ...merged.screenshots,
          items: merged.screenshots.items.map((item, i) => {
            if (i === 0 && s1) {
              return { ...item, src: s1 };
            }
            if (i === 1 && s2) {
              return { ...item, src: s2 };
            }
            return item;
          }),
        },
      };
    }
    return { copy: copyOut, heroImageSrc: hero, logoSrc: logo };
  }, [cmsContent, language]);
  // Product showcase source map:
  // - `Convert` uses `copy.screenshots.items[0].src`
  // - `Compress` uses `copy.screenshots.items[1].src`
  // - `Merge` uses `heroImageSrc`
  // - `Sign` reuses `copy.screenshots.items[1].src`
  //
  // If a CMS asset exists, `screenshot1Url` / `screenshot2Url` above can override
  // the `landing.ts` values before this mapping runs.
  //Trusted için dil desteği ekliyoruz.
  const trustedText =
    language === "tr"
      ? "1.000'den fazla kullanıcı tarafından güveniliyor"
      : "Trusted by 1,000+ users";
  const seoHeadlineFallback =
    language === "tr"
      ? "PDF duzenleme, donusturme ve birlestirme platformu"
      : "PDF editing, conversion, and merge PDF platform";
  const seoDescriptionFallback =
    language === "tr"
      ? "PDF converter, merge PDF ve compress PDF araclarini tek bir profesyonel akista kullanin."
      : "Use PDF converter, merge PDF, and compress PDF tools in one professional workflow.";

  // Fotoğrafların göründüğü yer için dil desteği ekliyoruz.
  const showcaseFeatures = useMemo(() => {
    const screenshots = copy.screenshots?.items ?? [];
    const firstShot = screenshots[0];
    const secondShot = screenshots[1];

    const localizedContent =
      language === "tr"
        ? {
            convert: {
              title: "Dosyaları tek akışta dönüştürün",
              description:
                "Word, Excel, PowerPoint ve görselleri temiz bir arayüzle saniyeler içinde PDF'e çevirin.",
              eyebrow: "Akıllı dönüşüm",
            },
            compress: {
              title: "Kaliteyi koruyarak boyutu küçültün",
              description:
                "Paylaşım ve arşivleme için dosya ağırlığını düşürün, onizleme netliğini premium seviyede tutun.",
              eyebrow: "Verimli sıkıştırma",
            },
            merge: {
              title: "Birden fazla dosyayı tek bir PDF'de birleştirin",
              description:
                "Sürükle-bırak akışı ile sayfaları hizalayın, belgeleri düzenleyin ve tek PDF olarak çıktı alın.",
              eyebrow: "Düzenli birleştirme",
            },
            sign: {
              title: "İmza sürecini daha hızlı tamamlayın",
              description:
                "Sözleşmeleri tek panelde hazırlayın, imza alanlarını yerleştirin ve profesyonel bir teslim deneyimi sunun.",
              eyebrow: "Güvenli imza",
            },
          }
        : {
            convert: {
              title: "Convert files in one polished flow",
              description:
                "Turn Word, Excel, PowerPoint, and images into PDF in seconds with a focused, premium workflow.",
              eyebrow: "Smart conversion",
            },
            compress: {
              title: "Reduce size without losing clarity",
              description:
                "Optimize documents for sharing and storage while keeping previews sharp and presentation-ready.",
              eyebrow: "Efficient compression",
            },
            merge: {
              title: "Combine documents into one delivery",
              description:
                "Arrange pages, organize uploads, and export a single PDF from a calm drag-and-drop workspace.",
              eyebrow: "Structured merging",
            },
            sign: {
              title: "Move signing from friction to flow",
              description:
                "Prepare agreements, place signature fields, and complete approvals from one clean control surface.",
              eyebrow: "Secure signing",
            },
          };

    return [
      {
        key: "convert" as const,
        label: "Convert",
        src: firstShot?.src ?? heroImageSrc,
        ...localizedContent.convert,
      },
      {
        key: "compress" as const,
        label: "Compress",
        src: secondShot?.src ?? firstShot?.src ?? heroImageSrc,
        ...localizedContent.compress,
      },
      {
        key: "merge" as const,
        label: "Merge",
        src: heroImageSrc,
        ...localizedContent.merge,
      },
      {
        key: "sign" as const,
        label: "Sign",
        src: secondShot?.src ?? heroImageSrc,
        ...localizedContent.sign,
      },
    ];
  }, [copy.screenshots.items, heroImageSrc, language]);
  const [activeShowcaseIndex, setActiveShowcaseIndex] = useState(0);
  const [visibleShowcaseIndex, setVisibleShowcaseIndex] = useState(0);
  const [isShowcaseTransitioning, setIsShowcaseTransitioning] = useState(false);
  const [isShowcasePaused, setIsShowcasePaused] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Auto-rotate the passive showcase every 3.6s.
  // Hover pauses the cycle on desktop via `isShowcasePaused`.
  useEffect(() => {
    if (!isCmsPreviewActive()) {
      return;
    }
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) {
        return;
      }
      const d = ev.data as { type?: string; section?: string } | null;
      if (
        !d ||
        d.type !== ADMIN_PREVIEW_HIGHLIGHT ||
        typeof d.section !== "string"
      ) {
        return;
      }
      document
        .querySelectorAll(".nb-preview-flash")
        .forEach((node) => node.classList.remove("nb-preview-flash"));
      const el = document.querySelector(
        `[data-nb-preview="${d.section.replace(/["\\]/g, "")}"]`,
      );
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("nb-preview-flash");
        window.setTimeout(() => el.classList.remove("nb-preview-flash"), 2200);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Split the animation into 2 phases:
  // 1. fade/slide out current preview
  // 2. swap the visible feature
  useEffect(() => {
    if (isShowcasePaused) {
      return;
    }

    const rotateTimer = window.setInterval(() => {
      setActiveShowcaseIndex(
        (current) => (current + 1) % showcaseFeatures.length,
      );
    }, 3600);

    return () => window.clearInterval(rotateTimer);
  }, [isShowcasePaused, showcaseFeatures.length]);

  useEffect(() => {
    if (activeShowcaseIndex === visibleShowcaseIndex) {
      return;
    }

    setIsShowcaseTransitioning(true);
    const swapTimer = window.setTimeout(
      () => setVisibleShowcaseIndex(activeShowcaseIndex),
      170,
    );
    const settleTimer = window.setTimeout(
      () => setIsShowcaseTransitioning(false),
      380,
    );

    return () => {
      window.clearTimeout(swapTimer);
      window.clearTimeout(settleTimer);
    };
  }, [activeShowcaseIndex, visibleShowcaseIndex]);

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactError("");
    setContactSuccess("");

    if (!contactName.trim()) {
      setContactError(copy.contactSection.validation.nameRequired);
      return;
    }

    if (contactName.trim().length < 2) {
      setContactError(copy.contactSection.validation.nameTooShort);
      return;
    }

    if (!contactEmail.trim()) {
      setContactError(copy.contactSection.validation.emailRequired);
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contactEmail.trim())) {
      setContactError(copy.contactSection.validation.emailInvalid);
      return;
    }

    if (!contactMessage.trim()) {
      setContactError(copy.contactSection.validation.messageRequired);
      return;
    }

    if (contactMessage.trim().length < 10) {
      setContactError(copy.contactSection.validation.messageTooShort);
      return;
    }

    try {
      setContactSubmitting(true);
      await submitContactForm({
        name: contactName.trim(),
        email: contactEmail.trim(),
        message: contactMessage.trim(),
        website: contactWebsite.trim(),
      });
      setContactSuccess(copy.contactSection.success);
      setContactName("");
      setContactEmail("");
      setContactMessage("");
      setContactWebsite("");
    } catch (error) {
      setContactError(
        error instanceof Error
          ? error.message
          : copy.contactSection.errorFallback,
      );
    } finally {
      setContactSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-nb-bg font-sans text-nb-text antialiased">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[min(720px,85vh)] bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(34,211,238,0.35),transparent_65%),radial-gradient(circle_at_85%_15%,rgba(129,140,232,0.08),transparent_35%)]" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col px-4 sm:px-8 lg:px-12 pb-16 pt-3 overflow-hidden">
        <header
          aria-label="Site header"
          className="mb-12 rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-5 py-5 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.05)_inset] backdrop-blur-md xl:px-8"
        >
          <div className="flex flex-col items-center text-center gap-6 lg:flex-row lg:text-left lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/18 to-indigo-500/12 shadow-[0_0_48px_rgba(34,211,238,0.2)]">
                <img
                  src={logoSrc ?? "/logo.png"}
                  alt="NB PDF PLATFORM"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-xl object-cover"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-cyan-200/75">
                  {copy.navbar.studioTagline}
                </p>
                <span className="text-lg font-semibold tracking-[0.14em] text-white">
                  {copy.navbar.productLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                {copy.navbar.platformTag}
              </span>

              {/* DİL SEÇİMİ KONTEYNER */}
              <div
                className="relative"
                onMouseEnter={() => setIsLangOpen(true)}
                onMouseLeave={() => setIsLangOpen(false)}
              >
                {/* Tetikleyici Buton */}
                <button
                  type="button"
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 outline-none"
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                    LNG
                  </span>
                  <span className="w-[20px] text-cyan-400 uppercase">
                    {language}
                  </span>
                  <svg
                    className={`h-3 w-3 text-slate-500 transition-transform ${isLangOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Aşağı Açılan Menü */}
                {isLangOpen && (
                  <div className="absolute left-1/2 top-full z-[100] mt-2 w-40 -translate-x-1/2 animate-in fade-in zoom-in-95 duration-200">
                    {/* Görünmez Köprü (Mouse kayarken kapanmaması için) */}
                    <div className="absolute -top-2 left-0 h-2 w-full" />

                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f172a] p-1.5 shadow-2xl backdrop-blur-3xl">
                      <button
                        onClick={() => {
                          onLanguageChange("tr");
                          setIsLangOpen(false); // SEÇİNCE KAPATIR
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[11px] font-medium transition ${
                          language === "tr"
                            ? "bg-white text-slate-950"
                            : "text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        <span>DenemeTr</span>
                        <span className="text-[9px] opacity-50">TR</span>
                      </button>

                      <button
                        onClick={() => {
                          onLanguageChange("en");
                          setIsLangOpen(false); // SEÇİNCE KAPATIR
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[11px] font-medium transition ${
                          language === "en"
                            ? "bg-white text-slate-950"
                            : "text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        <span>English</span>
                        <span className="text-[9px] opacity-50">EN</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {contactFormEnabled ? (
                <CrawlableLink
                  href="#contact"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-white/5"
                >
                  {copy.navbar.contact}
                </CrawlableLink>
              ) : null}

              {isAuthenticated ? (
                <>
                  <span className="max-w-[min(280px,calc(100vw-12rem))] truncate rounded-full border border-white/12 bg-white/[0.07] px-4 py-2 text-sm font-medium text-slate-100">
                    {authGreeting ?? copy.navbar.signedInFallback}
                  </span>
                  <button
                    type="button"
                    onClick={onUseWebApp}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    {copy.navbar.openWorkspace}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onLogin}
                    className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-white/5"
                  >
                    {copy.navbar.login}
                  </button>
                  <button
                    type="button"
                    onClick={onRegister}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  >
                    {copy.navbar.register}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* --- PREMIUM VE MINIMAL HERO SECTION --- */}
        <section
          data-nb-preview="hero"
          aria-label="Hero"
          className="-mt-15 relative flex flex-col items-center justify-center pt-0 pb-20 text-center lg:pt-10 lg:pb-24"
        >
          {/* Arka Plandaki Soft Aura - Çok daha rafine bir parlama */}
          <div className="absolute left-1/2 top-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.05] blur-[120px]" />

          <div className="relative z-10 max-w-5xl px-4">
            {/* Üst Küçük Etiket (Badge) - Minimal */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/10 bg-cyan-500/5 px-3 py-1 backdrop-blur-sm opacity-80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500"></span>
              </span>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400/90">
                {copy.hero.kicker}
              </p>
            </div>

            {/* Ana Başlık - Boyutu düşürdük, font ağırlığını azalttık, satır aralığını açtık */}
            {/* Ana Başlık - Mobil için text-3xl'e çektik ve min-h sildik */}
            <h1 className="mx-auto max-w-4xl bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-6xl lg:text-7xl leading-[1.2] sm:leading-[1.15]">
              {copy.hero.headline?.trim() || seoHeadlineFallback}
            </h1>

            {/* Alt Açıklama - İtalikliği kaldırdık, daha kurumsal yaptık */}
            <p className="mx-auto mt-6 min-h-[60px] max-w-2xl text-base font-normal leading-relaxed text-slate-400">
              {copy.hero.description?.trim() || seoDescriptionFallback}
            </p>

            {/* Hedef Kitle Etiketleri - Başlığın altında, sönük ve elit */}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {copy.hero.audience.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)] backdrop-blur-md"
                >
                  {/* Parlayan Nokta - Statik ve belirgin */}
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]"></span>

                  {item}
                </span>
              ))}
            </div>
            {/* Dil desteğini yukarıda ekledik. Trusted yazısını çekiyoruz. */}
            <div className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-400">
              {/* Üst Satır: Ateşli Trusted Yazısı */}
              <br />
              🔥 {copy.trustedText.trusted}
            </div>

            {/* Alt Satır: Bilgilendirme Metinleri */}
            <p className="mt-2 text-sm text-slate-500">
              {copy.trustedText.payment} • {copy.trustedText.freePlan}
            </p>
            {/* Butonlar - Premium Işıltılı */}
            <div
              data-nb-preview="hero-buttons"
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <button
                type="button"
                onClick={onUseWebApp}
                className="group relative inline-flex h-14 min-w-[190px] items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-base font-bold text-slate-950 transition-all hover:scale-[1.02] hover:bg-slate-100 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] active:scale-95"
              >
                <span className="relative z-10">{copy.hero.primaryCta}</span>
              </button>

              <CrawlableLink
                href={windowsDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 min-w-[190px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-8 text-base font-bold text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
              >
                {copy.hero.secondaryCta}
              </CrawlableLink>
            </div>
          </div>
        </section>
        {/* Hap Bilgi Barı - Taşıdığımız 3 Kutucuk */}
        <section
          aria-label="Highlights"
          className="mt-8 md:-mt-16 mb-16 rounded-[32px] border border-white/[0.05] bg-slate-900/40 px-6 md:px-9 py-8 shadow-2xl backdrop-blur-2xl flex items-center justify-center"
        >
          <div className=" mt-2 grid gap-6 md:grid-cols-3">
            {copy.hero.highlights.map((item, index) => (
              <div
                key={item.label}
                className="flex min-h-[80px] items-start gap-4 p-2 transition-all hover:scale-[1.03]"
              >
                <div
                  className={`mt-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 ${index === 0 ? "bg-cyan-500/10 text-cyan-400" : index === 1 ? "bg-indigo-500/10 text-indigo-400" : "bg-blue-500/10 text-blue-400"}`}
                >
                  <LandingIcon
                    kind={
                      index === 0 ? "shield" : index === 1 ? "speed" : "secure"
                    }
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Marquee language={language} />

        <section
          data-nb-preview="features"
          aria-label="Features"
          className="relative pt-16 pb-8 px-6 overflow-hidden"
        >
          <div className="relative z-10 mx-auto max-w-6xl rounded-[48px] border border-white/5 bg-slate-900/20 p-6 md:p-24 backdrop-blur-3xl shadow-[0_32px_100px_-20px_rgba(0,0,0,0.7)]">
            {" "}
            <div className="absolute -right-[10%] top-1/2 -z-10 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[120px] opacity-30" />
            <div className="absolute -left-[10%] top-1/4 -z-10 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[120px] opacity-30" />
            <div className="relative z-10 mb-12 max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400/90">
                {copy.features.kicker}
              </p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                {copy.features.title}
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {copy.features.items.map((item) => (
                <article
                  key={item.title}
                  className="group relative overflow-hidden rounded-[32px] border border-white/5 bg-slate-900/40 p-8 transition-all duration-500 hover:-translate-y-2 hover:border-cyan-500/30 hover:bg-slate-900/60 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7),0_0_20px_rgba(34,211,238,0.1)]"
                >
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-cyan-500/5 blur-2xl transition-all group-hover:bg-cyan-500/10" />

                  <div className="relative z-10">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-slate-950 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                      <LandingIcon kind={item.icon} />
                    </div>
                    <h3 className="mt-8 text-2xl font-bold text-white tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-slate-400 group-hover:text-slate-300">
                      {item.benefit}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --- GÜVEN BÖLÜMÜ (PREMIUM AMBİYANS VE MODERN KARTLAR) --- */}
        <section aria-label="Trust" className="relative pt-8 pb-16 px-6 overflow-hidden">
          {/* 1. ANA AMBİYANS IŞIĞI (Ekran görüntüsündeki o sağdan vuran derin parıltı efekti) */}
          <div className="absolute -right-[10%] top-1/2 -z-10 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-indigo-600/20 blur-[140px] opacity-50 animate-pulse" />
          <div className="absolute -left-[10%] top-1/4 -z-10 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[120px] opacity-30" />

          {/* İNCE DIŞ ÇERÇEVE VE CAM PANEL */}
          <div className="mx-auto max-w-6xl rounded-[48px] border border-white/5 bg-slate-900/20 p-12 md:p-24 backdrop-blur-3xl shadow-[0_32px_100px_-20px_rgba(0,0,0,0.7)]">
            {/* BAŞLIK ALANI */}
            <div className="mb-24 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-cyan-400 mb-6 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                {copy.trust.kicker}
              </p>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-[1.1] mb-8">
                {copy.trust.title}
              </h2>
              <p className="text-lg md:text-xl text-slate-400 font-light leading-relaxed">
                {copy.trust.description}
              </p>
            </div>

            {/* YENİLENMİŞ KART TASARIMI (Keskin ve Kurumsal) */}
            <div className="grid gap-6 md:grid-cols-3">
              {copy.trust.points.map((item, index) => (
                <div
                  key={item.title}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.03] bg-slate-950/40 p-10 transition-all duration-500 hover:border-white/10 hover:bg-slate-950/60"
                >
                  {/* Kart İçi Gizli Işıltı (Sadece Hoverda çıkar) */}
                  <div className="absolute -right-8 -top-8 -z-10 h-32 w-32 rounded-full bg-indigo-500/0 blur-3xl transition-all duration-700 group-hover:bg-indigo-500/10" />

                  <div>
                    {/* Numara Tasarımı */}
                    <div className="mb-10 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-sm font-bold text-slate-400 group-hover:border-indigo-500/30 group-hover:text-indigo-300 transition-all">
                      0{index + 1}
                    </div>

                    <h3 className="text-2xl font-bold tracking-tight text-white mb-4 group-hover:translate-x-1 transition-transform duration-300">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">
                      {item.description}
                    </p>
                  </div>

                  {/* Alt Süsleme Çizgisi */}
                  <div className="mt-12 h-[1px] w-12 bg-white/10 group-hover:w-full group-hover:bg-gradient-to-r group-hover:from-indigo-500 group-hover:to-transparent transition-all duration-700" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- BÖLÜM SONU --- */}

        {/* ---- EKRAN ALINTILARI BÖLÜMÜ ---- */}
        <section aria-label="Product showcase" className="py-28 space-y-32">
          <h2 className="sr-only">
            {language === "tr"
              ? "PDF duzenleme ozellikleri"
              : "PDF editing and conversion features"}
          </h2>
          {showcaseFeatures.map((item, index) => {
            const isReversed = index % 2 === 1;

            return (
              <div
                key={item.key}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center px-4"
              >
                {/* TEXT */}
                <div
                  className={`space-y-4 ${isReversed ? "lg:order-2" : "lg:order-1"}`}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
                    {item.eyebrow}
                  </p>

                  <h3 className="text-3xl font-bold text-white">
                    {item.title}
                  </h3>

                  <p className="text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* IMAGE */}
                <div
                  className={`rounded-2xl overflow-hidden border border-white/10 shadow-2xl ${isReversed ? "lg:order-1" : "lg:order-2"}`}
                >
                  <img
                    src={item.src}
                    alt={`${item.title} - ${item.description}`}
                    width={1600}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            );
          })}
        </section>

        <LandingPricingSection
          language={language}
          kicker={copy.pricing.kicker}
          title={copy.pricing.title}
          description={copy.pricing.description}
          onUseWebApp={onUseWebApp}
        />

        {contactFormEnabled ? (
          <section id="contact" aria-label="Contact" className="scroll-mt-8 py-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  {copy.contactSection.kicker}
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {copy.contactSection.title}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                  {copy.contactSection.description}
                </p>
              </div>

              <form
                className="rounded-[30px] border border-white/[0.07] bg-white/[0.035] p-7 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)_inset]"
                onSubmit={handleContactSubmit}
              >
                <div className="grid gap-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">
                      {copy.contactSection.nameLabel}
                    </span>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      disabled={contactSubmitting}
                      className="w-full rounded-xl border border-white/[0.08] bg-nb-bg-soft/90 px-4 py-3.5 text-nb-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 ease-out focus:border-nb-primary/50 focus:ring-2 focus:ring-nb-primary/15 hover:border-white/12 disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">
                      {copy.contactSection.emailLabel}
                    </span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      disabled={contactSubmitting}
                      className="w-full rounded-xl border border-white/[0.08] bg-nb-bg-soft/90 px-4 py-3.5 text-nb-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 ease-out focus:border-nb-primary/50 focus:ring-2 focus:ring-nb-primary/15 hover:border-white/12 disabled:opacity-60"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">
                      {copy.contactSection.messageLabel}
                    </span>
                    <textarea
                      value={contactMessage}
                      onChange={(event) =>
                        setContactMessage(event.target.value)
                      }
                      rows={6}
                      disabled={contactSubmitting}
                      className="w-full rounded-xl border border-white/[0.08] bg-nb-bg-soft/90 px-4 py-3.5 text-nb-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 ease-out focus:border-nb-primary/50 focus:ring-2 focus:ring-nb-primary/15 hover:border-white/12 disabled:opacity-60"
                    />
                  </label>

                  <label className="hidden" aria-hidden="true">
                    <span>{copy.contactSection.honeypotLabel}</span>
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={contactWebsite}
                      onChange={(event) =>
                        setContactWebsite(event.target.value)
                      }
                    />
                  </label>

                  {contactError ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {contactError}
                    </div>
                  ) : null}

                  {contactSuccess ? (
                    <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                      {contactSuccess}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-gradient-to-b from-nb-primary-mid to-nb-primary px-7 text-base font-semibold text-slate-950 shadow-[0_16px_40px_-12px_rgba(34,211,238,0.45)] transition duration-300 ease-out hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {contactSubmitting
                      ? copy.contactSection.submitting
                      : copy.contactSection.submit}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        <section data-nb-preview="final-cta" aria-label="Final call to action" className="py-10">
          <div className="rounded-[34px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(15,23,42,0.92),rgba(129,140,232,0.1))] p-9 shadow-[0_36px_100px_-20px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset] sm:p-11 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
                {copy.finalCta.kicker}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {copy.finalCta.title}
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-200/85">
                {copy.finalCta.description}
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row lg:mt-0">
              <button
                type="button"
                onClick={onUseWebApp}
                className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-7 text-base font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                {copy.finalCta.primaryCta}
              </button>
              <CrawlableLink
                href={windowsDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-14 items-center justify-center rounded-2xl border px-7 text-base font-semibold transition ${
                  windowsDownloadUrl === "#"
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-slate-400"
                    : "border-white/20 bg-white/10 text-white hover:-translate-y-0.5 hover:bg-white/15"
                }`}
                aria-disabled={windowsDownloadUrl === "#"}
              >
                {copy.finalCta.secondaryCta}
              </CrawlableLink>
            </div>
          </div>
        </section>
      </main>

      <footer
        data-nb-preview="footer"
        className="relative border-t border-white/[0.06] bg-nb-bg-soft/95"
      >
        <nav aria-label="SEO internal links" className="sr-only">
          <CrawlableLink href="/pricing">Pricing</CrawlableLink>
          <CrawlableLink href="/terms">Terms</CrawlableLink>
          <CrawlableLink href="/privacy">Privacy</CrawlableLink>
          <CrawlableLink href="/kvkk">KVKK</CrawlableLink>
          <CrawlableLink href="/tools/merge-pdf">Merge PDF</CrawlableLink>
          <CrawlableLink href="/tools/compress">Compress PDF</CrawlableLink>
        </nav>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-slate-400 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div>
            <p className="font-semibold tracking-[0.18em] text-slate-200">
              {copy.navbar.productLabel}
            </p>
            <p className="mt-1">{copy.footer.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>{copy.footer.availability}</span>
            <span>{copy.footer.security}</span>
            <button
              type="button"
              onClick={onOpenTerms}
              className="text-slate-200 transition hover:text-white"
            >
              {copy.footer.termsLabel}
            </button>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="text-slate-200 transition hover:text-white"
            >
              {copy.footer.privacyLabel}
            </button>
            <button
              type="button"
              onClick={onOpenKvkk}
              className="text-slate-200 transition hover:text-white"
            >
              {copy.footer.kvkkLabel}
            </button>
            {contactFormEnabled ? (
              <CrawlableLink
                href="#contact"
                className="text-slate-200 transition hover:text-white"
              >
                {copy.footer.contact}
              </CrawlableLink>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
