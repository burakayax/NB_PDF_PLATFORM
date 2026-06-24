// Tip deklarasyonu: seoContent.mjs (tek gerçek SEO içerik kaynağı) için.
// tsc bu .mjs'i derlemez; tipleri buradan alır. Vite/esbuild .mjs'i bundle eder.

export type SeoLang = "tr" | "en";

export interface ToolSeoFaqItem {
  q: string;
  a: string;
}

export interface ToolSeoCopy {
  title: string;
  description: string;
  h1: string;
  intro: string;
  keywords: string[];
  faq: ToolSeoFaqItem[];
}

export interface PageSeoCopy {
  title: string;
  description: string;
  h1: string;
  intro: string;
  faq?: ToolSeoFaqItem[];
}

export const BRAND: string;
export const DEFAULT_OG_IMAGE: string;
export const DEFAULT_OG_IMAGE_WIDTH: string;
export const DEFAULT_OG_IMAGE_HEIGHT: string;
export const TOOL_SLUGS: string[];

export const TOOL_SEO: Record<string, Record<SeoLang, ToolSeoCopy>>;
export const LANDING_SEO: Record<SeoLang, PageSeoCopy>;
export const PRICING_SEO: Record<SeoLang, PageSeoCopy>;
export const LEGAL_SEO: Record<
  "terms" | "privacy" | "kvkk",
  Record<SeoLang, PageSeoCopy>
>;
export const SOFTWARE_FEATURE_LIST: Record<SeoLang, string[]>;

export function getToolSeo(slug: string, language: SeoLang): ToolSeoCopy | null;
