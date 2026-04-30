export const FEATURE_IDS = [
  "split",
  "merge",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "compress",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "html-to-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
];

export function toolSlugForFeature(id) {
  if (id === "merge") return "merge-pdf";
  if (id === "split") return "split-pdf";
  return id;
}

export const STATIC_PUBLIC_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.8" },
  { path: "/terms", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "monthly", priority: "0.4" },
  { path: "/kvkk", changefreq: "monthly", priority: "0.4" },
];
