import type { FeatureKey } from "../api/subscription";
import { WORKSPACE_TOOL_IDS } from "./workspaceFeatures";
import { canonicalBarePath, toolSlugToTr } from "../seo/enSlugs.mjs";

/** Alternate URL segments for prettier SEO paths (maps slug → internal tool id). */
const SLUG_TO_FEATURE: Partial<Record<string, FeatureKey>> = {
  "merge-pdf": "merge",
  "split-pdf": "split",
};

export function toolSlugForFeature(id: FeatureKey): string {
  if (id === "merge") return "merge-pdf";
  if (id === "split") return "split-pdf";
  return id;
}

/** Sitemap ve dahili SEO için `/tools/:slug` segmentleri (REGISTRY sırasıyla). */
export const WORKSPACE_TOOL_PATH_SLUGS: readonly string[] = WORKSPACE_TOOL_IDS.map((id) =>
  toolSlugForFeature(id),
);

export function featureFromWorkspaceToolSlug(rawSlug: string): FeatureKey | null {
  // İngilizce URL slug'ı (ör. "edit-pdf") önce kanonik TR slug'ına indirgenir.
  const slug = toolSlugToTr(rawSlug);
  const mapped = SLUG_TO_FEATURE[slug];
  if (mapped) {
    return mapped;
  }
  if (WORKSPACE_TOOL_IDS.includes(slug as FeatureKey)) {
    return slug as FeatureKey;
  }
  return null;
}

/** `/tools/:slug` → tool id, or null if path is not a workspace tools route. */
export function parseWorkspaceToolPath(pathname: string): FeatureKey | null {
  // /en öneki + İngilizce slug tek biçime indirgenir: /en/tools/edit-pdf de
  // /tools/pdf-duzenle de aynı aracı çözer.
  const raw = canonicalBarePath(pathname);
  if (raw === "/workspace") {
    return "split";
  }
  const m = /^\/tools\/([^/]+)$/.exec(raw);
  if (!m?.[1]) {
    return null;
  }
  return featureFromWorkspaceToolSlug(m[1]);
}
