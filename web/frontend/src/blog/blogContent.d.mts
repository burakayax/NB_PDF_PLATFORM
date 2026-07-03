// Tip deklarasyonu: blogContent.mjs (tek gerçek blog içerik kaynağı) için.
export type BlogLang = "tr" | "en";

export type BlogBlock =
  | { t: "p" | "lead" | "h2" | "h3" | "tip"; x: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "steps"; items: Array<{ title: string; x: string }> }
  | { t: "cta"; title: string; x: string; btn: string; tool: string };

export interface BlogFaqItem {
  q: string;
  a: string;
}

export interface BlogPostCopy {
  title: string;
  description: string;
  excerpt: string;
  blocks: BlogBlock[];
  faq: BlogFaqItem[];
}

export interface BlogPost {
  slug: string;
  date: string;
  updated: string;
  readMinutes: number;
  tags: { tr: string[]; en: string[] };
  accent: string;
  tool: string;
  tr: BlogPostCopy;
  en: BlogPostCopy;
}

export const BLOG_BASE: string;
export const BLOG_POSTS: BlogPost[];
export function getBlogPost(slug: string): BlogPost | null;
export function getBlogPostsSorted(): BlogPost[];
