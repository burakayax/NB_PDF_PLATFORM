import type { Language } from "../i18n/landing";
import { getPublicSiteOrigin } from "../lib/siteOrigin";
import { toolSlugForFeature } from "../lib/toolRoutes";
import type { FeatureKey } from "../api/subscription";

type SeoRouteConfig = {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
  follow: boolean;
  ogImage?: string;
};

export type SeoRouteContext = {
  pathname: string;
  view: string;
  language: Language;
  selectedFeatureId?: FeatureKey | null;
  isAuthenticated?: boolean;
};

const BRAND = "NB PDF PLATFORM";

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
}

function seoForPublicPage(language: Language): Pick<SeoRouteConfig, "title" | "description"> {
  if (language === "tr") {
    return {
      title: "PDF editing ve donusturme platformu | NB PDF PLATFORM",
      description:
        "PDF editing, PDF converter, merge PDF ve compress PDF islemlerini tek bir profesyonel platformda yonetin.",
    };
  }
  return {
    title: "PDF editing and conversion platform | NB PDF PLATFORM",
    description:
      "Use PDF editing, PDF converter, merge PDF, and compress PDF workflows in one professional platform.",
  };
}

export function resolveRouteSeo(context: SeoRouteContext): SeoRouteConfig {
  const pathname = normalizePath(context.pathname);
  const publicSeo = seoForPublicPage(context.language);

  if (context.view === "web" && context.selectedFeatureId) {
    const slug = toolSlugForFeature(context.selectedFeatureId);
    return {
      title: `${slug.replace(/-/g, " ")} | ${BRAND}`,
      description:
        context.language === "tr"
          ? "PDF aracini guvenli sekilde calistirin, dosyanizi hizlica isleyin ve sonuclari indirin."
          : "Run the PDF tool securely, process files quickly, and download results.",
      canonicalPath: `/tools/${slug}`,
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
    };
  }

  if (context.view === "landing" || pathname === "/") {
    return {
      ...publicSeo,
      canonicalPath: "/",
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
    };
  }

  if (context.view === "pricing" || pathname === "/pricing") {
    return {
      title: `Pricing | ${BRAND}`,
      description:
        context.language === "tr"
          ? "PDF editing ve donusturme araclari icin planlari ve kredi paketlerini inceleyin."
          : "Explore plans and credit packs for PDF editing and conversion workflows.",
      canonicalPath: "/pricing",
      index: true,
      follow: true,
      ogImage: "/app-preview-main.png",
    };
  }

  if (pathname === "/admin-login" || context.view === "admin_login") {
    return {
      title: `Admin login | ${BRAND}`,
      description: "Administrator sign-in for NB PDF PLATFORM operations.",
      canonicalPath: "/admin-login",
      index: false,
      follow: false,
      ogImage: "/app-preview-main.png",
    };
  }

  if (
    context.view === "login" ||
    context.view === "register" ||
    context.view === "forgot_password"
  ) {
    return {
      title: `${BRAND} account access`,
      description: "Sign in or create an account to access your PDF workspace.",
      canonicalPath: "/",
      index: false,
      follow: false,
      ogImage: "/app-preview-main.png",
    };
  }

  if (context.view === "terms") {
    return {
      title: `Terms of service | ${BRAND}`,
      description: "Read the terms of service for NB PDF PLATFORM.",
      canonicalPath: "/terms",
      index: true,
      follow: true,
    };
  }

  if (context.view === "privacy") {
    return {
      title: `Privacy policy | ${BRAND}`,
      description: "Read the privacy policy for NB PDF PLATFORM.",
      canonicalPath: "/privacy",
      index: true,
      follow: true,
    };
  }

  if (context.view === "kvkk") {
    return {
      title: `KVKK | ${BRAND}`,
      description: "Read KVKK data processing information for NB PDF PLATFORM.",
      canonicalPath: "/kvkk",
      index: true,
      follow: true,
    };
  }

  return {
    ...publicSeo,
    canonicalPath: "/",
    index: true,
    follow: true,
    ogImage: "/app-preview-main.png",
  };
}

export function toAbsoluteUrl(pathOrUrl: string): string {
  const origin = getPublicSiteOrigin();
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${path}`;
}
