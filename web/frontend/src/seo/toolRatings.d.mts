// Tip deklarasyonu: toolRatings.mjs (derleme anında üretilen araç puanları) için.
// tsc bu .mjs'i derlemez; tipleri buradan alır. Vite/esbuild .mjs'i bundle eder.

export interface ToolRatingSummary {
  /** Bir ondalık basamağa yuvarlanmış ortalama (Google nokta ayırıcı ister). */
  ratingValue: number;
  ratingCount: number;
}

/** Araç kimliği → yalnızca YAYINLANABİLİR puan özeti (eşiği geçenler). */
export declare const TOOL_RATINGS: Record<string, ToolRatingSummary>;

/** Verinin çekildiği an (ISO). Boşsa puan hiç çekilememiş demektir. */
export declare const TOOL_RATINGS_FETCHED_AT: string | null;

/** Ölçek sınırları — işaretlemeye bestRating/worstRating olarak yazılır. */
export declare const RATING_BEST: number;
export declare const RATING_WORST: number;
