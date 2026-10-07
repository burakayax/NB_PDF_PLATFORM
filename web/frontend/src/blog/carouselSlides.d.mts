export const MAX_CONTENT_SLIDES: number;
export const MIN_CONTENT_SLIDES: number;
export function firstSentence(text: unknown, max?: number): string;
export function extractContentSlides(
  blocks: Array<{ t: string; x?: string; items?: unknown[] }>,
): Array<{ title: string; text: string }>;
export const CAROUSEL_COPY: Record<
  "tr" | "en",
  {
    swipe: string;
    stepLabel: (n: number, total: number) => string;
    pointLabel: (n: number, total: number) => string;
    ctaTitle: string;
    ctaBody: string;
    ctaTry: string;
  }
>;
