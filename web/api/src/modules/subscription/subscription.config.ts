/**
 * Feature key union and built-in plan defaults used when `SiteSetting` / `packages.config`
 * has no overlay. Runtime entitlements resolve via `getPlanDefinitionsResolved()` (DB + fallback).
 */
import type { Plan } from "@prisma/client";
export const featureCatalog = [
  "split",
  "merge",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "compress",
  "encrypt",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "html-to-pdf",
  "pdf-to-text",
  "flatten-pdf",
] as const;

export type FeatureKey = (typeof featureCatalog)[number];

export type PlanDefinition = {
  name: Plan;
  displayName: string;
  description: string;
  dailyLimit: number | null;
  allowedFeatures: FeatureKey[];
  multiUser: boolean;
};

/** Temel araçlar — ücretli plan gerektirmez */
const FREE_TOOLS: FeatureKey[] = [
  "split",
  "merge",
  "compress",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "unlock-pdf",
  "pdf-to-text",
];

/** Starter'a ek olarak açılan araçlar */
const STARTER_TOOLS: FeatureKey[] = [
  ...FREE_TOOLS,
  "encrypt",
  "pdf-to-image",
  "image-to-pdf",
  "page-numbers",
  "watermark",
];

export const planDefinitions: Record<Plan, PlanDefinition> = {
  FREE: {
    name: "FREE",
    displayName: "Free",
    description: "Full toolkit with usage limits.",
    dailyLimit: 3,
    allowedFeatures: FREE_TOOLS,
    multiUser: false,
  },
  STARTER: {
    name: "STARTER",
    displayName: "Starter",
    description: "Great for getting started with 25 daily operations.",
    dailyLimit: 25,
    allowedFeatures: STARTER_TOOLS,
    multiUser: false,
  },
  PLUS: {
    name: "PLUS",
    displayName: "Plus",
    description: "Unlimited daily use with 600 monthly operations.",
    dailyLimit: null,
    allowedFeatures: [...featureCatalog],
    multiUser: false,
  },
  PRO: {
    name: "PRO",
    displayName: "Pro",
    description: "Unlimited usage with 1000 monthly operations and priority support.",
    dailyLimit: null,
    allowedFeatures: [...featureCatalog],
    multiUser: false,
  },
  BUSINESS: {
    name: "BUSINESS",
    displayName: "Business",
    description: "Unlimited operations for teams.",
    dailyLimit: null,
    allowedFeatures: [...featureCatalog],
    multiUser: true,
  },
};

export function isFeatureKey(value: string): value is FeatureKey {
  return featureCatalog.includes(value as FeatureKey);
}
