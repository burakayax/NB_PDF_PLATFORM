// Tip deklarasyonu: enSlugs.mjs (TR↔EN URL slug eşlemesi) için.
export type SlugLang = "tr" | "en";

export const EN_TOOL_SLUGS: Record<string, string>;
export const EN_BLOG_SLUGS: Record<string, string>;

export function toolSlugForLang(trSlug: string, lang: SlugLang): string;
export function blogSlugForLang(trSlug: string, lang: SlugLang): string;
export function toolSlugToTr(slug: string): string;
export function blogSlugToTr(slug: string): string;
export function localizedPath(barePath: string, lang: SlugLang): string;
export function canonicalBarePath(pathname: string): string;
