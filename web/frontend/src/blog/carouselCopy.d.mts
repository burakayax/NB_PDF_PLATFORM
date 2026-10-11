export const CURATED_CAROUSELS: Record<string, { hook: string; slides: Array<[string, string]> }>;
export function curatedCarousel(slug: string): { hook: string; slides: Array<{ title: string; text: string }> } | null;
