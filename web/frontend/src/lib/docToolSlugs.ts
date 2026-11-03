/** Ek dönüştürme araçlarının adresleri (txt/markdown/rtf/odt/epub → PDF, PDF → epub/markdown) — tek kaynak. */
export const DOC_TOOL_SLUGS = ["txt-to-pdf", "markdown-to-pdf", "rtf-to-pdf", "odt-to-pdf", "epub-to-pdf", "pdf-to-epub", "pdf-to-markdown"] as const;
export type DocToolSlug = (typeof DOC_TOOL_SLUGS)[number];
export const isDocToolSlug = (s: string | null | undefined): s is DocToolSlug => !!s && (DOC_TOOL_SLUGS as readonly string[]).includes(s);
export const DOC_TOOL_PATHS: readonly string[] = DOC_TOOL_SLUGS.map((s) => `/tools/${s}`);
