import type { FeatureKey } from "../api/subscription";

export type PlanId = "FREE" | "STARTER" | "PLUS" | "PRO" | "BUSINESS";
export type Currency = "TRY" | "USD";
export type BillingCycle = "MONTHLY" | "YEARLY";

/**
 * Starter planında erişilebilen araçlar. Backend kaynağı:
 * `web/api/src/modules/subscription/subscription.config.ts` → STARTER_TOOLS.
 * Pazarlama kartındaki araç sayısı ve "araçları gör" modalı bu listeden türetilir;
 * iki taraf değişirse ikisi birlikte güncellenmelidir.
 */
export const STARTER_TOOL_IDS: FeatureKey[] = [
  "split",
  "merge",
  "compress",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "unlock-pdf",
  "pdf-to-text",
  "encrypt",
  "pdf-to-image",
  "image-to-pdf",
  "page-numbers",
  "watermark",
];

/** Tüm araç kataloğundaki toplam araç sayısı (Plus ve üzeri tüm araçları içerir). */
export const TOTAL_TOOL_COUNT = 22;

export interface PlanDefinition {
  id: PlanId;
  nameTr: string;
  nameEn: string;
  badge?: { textTr: string; textEn: string; color: string };
  pricing: {
    monthly: { TRY: number; USD: number };
    yearly: { TRY: number; USD: number };
  };
  yearlyOnlyBilling?: boolean;
  monthlyOnlyBilling?: boolean;
  displayMonthlyEquivalent?: boolean;
  featuresTr: string[];
  featuresEn: string[];
  dailyOpsLimit: number | null;
  monthlyOpsLimit: number | null;
  fileSizeMB: number | null;
  batchLimit: number;
  watermark: boolean;
  seats: number | string;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "FREE",
    nameTr: "Ücretsiz",
    nameEn: "Free",
    pricing: {
      monthly: { TRY: 0, USD: 0 },
      yearly: { TRY: 0, USD: 0 },
    },
    monthlyOnlyBilling: true,
    featuresTr: [
      "3 işlem/gün",
      "30 işlem/ay",
      "Temel araçlar",
      "Maks. 80 MB",
      "Filigranlı çıktı",
      "Standart hız",
    ],
    featuresEn: [
      "3 ops/day",
      "30 ops/month",
      "Basic tools",
      "Max 80 MB",
      "Output watermarked",
      "Standard speed",
    ],
    dailyOpsLimit: 3,
    monthlyOpsLimit: 30,
    fileSizeMB: 80,
    batchLimit: 0,
    watermark: true,
    seats: 1,
  },
  {
    id: "STARTER",
    nameTr: "Başlangıç",
    nameEn: "Starter",
    badge: {
      textTr: "En İyi Başlangıç",
      textEn: "Best for Getting Started",
      color: "green",
    },
    pricing: {
      monthly: { TRY: 4900, USD: 1599 },
      yearly: { TRY: 49000, USD: 15900 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "25 işlem/gün",
      "250 işlem/ay",
      "13 araç",
      "100 MB dosya",
      "2 batch",
      "Hafif filigran",
      "Hızlı sıra",
    ],
    featuresEn: [
      "25 ops/day",
      "250 ops/month",
      "13 tools",
      "100 MB files",
      "Batch 2",
      "Light watermark",
      "Fast queue",
    ],
    dailyOpsLimit: 25,
    monthlyOpsLimit: 250,
    fileSizeMB: 100,
    batchLimit: 2,
    watermark: true,
    seats: 1,
  },
  {
    id: "PLUS",
    nameTr: "Plus",
    nameEn: "Plus",
    badge: {
      textTr: "En Popüler",
      textEn: "Most Popular",
      color: "blue",
    },
    pricing: {
      monthly: { TRY: 14900, USD: 4799 },
      yearly: { TRY: 149000, USD: 47990 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Sınırsız günlük",
      "600 işlem/ay",
      "Tüm araçlar",
      "250 MB dosya",
      "5 batch",
      "Filigran yok",
      "Öncelikli sıra",
      "E-posta destek",
    ],
    featuresEn: [
      "Unlimited daily",
      "600 ops/month",
      "All tools",
      "250 MB files",
      "Batch 5",
      "No watermark",
      "Priority queue",
      "Email support",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: 600,
    fileSizeMB: 250,
    batchLimit: 5,
    watermark: false,
    seats: 1,
  },
  {
    id: "PRO",
    nameTr: "Pro",
    nameEn: "Pro",
    badge: {
      textTr: "+25% İşlem",
      textEn: "+25% More Ops",
      color: "amber",
    },
    pricing: {
      monthly: { TRY: 29900, USD: 9799 },
      yearly: { TRY: 299000, USD: 97990 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Sınırsız günlük",
      "1000 işlem/ay",
      "Tüm araçlar",
      "500 MB dosya",
      "25 batch",
      "Filigran yok",
      "Max öncelik",
      "Öncelikli destek",
      "Analitik",
    ],
    featuresEn: [
      "Unlimited daily",
      "1000 ops/month",
      "All tools",
      "500 MB files",
      "Batch 25",
      "No watermark",
      "Max priority",
      "Priority support",
      "Analytics",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: 1000,
    fileSizeMB: 500,
    batchLimit: 25,
    watermark: false,
    seats: 1,
  },
  {
    id: "BUSINESS",
    nameTr: "Business",
    nameEn: "Business",
    badge: {
      textTr: "Ekipler İçin",
      textEn: "For Teams",
      color: "violet",
    },
    pricing: {
      monthly: { TRY: 79900, USD: 25000 },
      yearly: { TRY: 799000, USD: 250000 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Sınırsız",
      "Sınırsız gün/ay",
      "Tüm araçlar + özel",
      "Sınırsız dosya",
      "Sınırsız batch",
      "Ticari hak",
      "5+ kişi",
      "Admin dashboard",
      "Öncelikli destek",
      "Özel entegrasyon",
    ],
    featuresEn: [
      "Unlimited",
      "Unlimited daily/mo",
      "All tools + custom",
      "Unlimited files",
      "Unlimited batch",
      "Commercial rights",
      "5+ team",
      "Admin dashboard",
      "Priority support",
      "Custom integration",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: null,
    fileSizeMB: null,
    batchLimit: 999,
    watermark: false,
    seats: "5+",
  },
];

/** Prices are stored in minor units (kuruş for TRY, cents for USD). Always divide by 100. */
export function formatPrice(
  plan: PlanDefinition,
  currency: Currency,
  cycle: BillingCycle,
): string {
  const raw =
    cycle === "YEARLY"
      ? plan.pricing.yearly[currency]
      : plan.pricing.monthly[currency];
  const faceValue = raw / 100;
  if (faceValue === 0) return currency === "TRY" ? "₺0" : "$0";
  if (currency === "USD") return `$${faceValue.toFixed(2)}`;
  return `₺${Math.round(faceValue).toLocaleString("tr-TR")}`;
}

export function getMonthlyEquivalent(
  plan: PlanDefinition,
  currency: Currency,
): string {
  const monthly = plan.pricing.yearly[currency] / 100 / 12;
  if (currency === "USD") return `$${monthly.toFixed(2)}/mo`;
  return `₺${Math.round(monthly).toLocaleString("tr-TR")}/ay`;
}

export function getYearlySavings(
  plan: PlanDefinition,
  currency: Currency,
): string {
  const monthly = plan.pricing.monthly[currency] / 100;
  const actual = plan.pricing.yearly[currency] / 100;
  const savings = monthly * 12 - actual;
  if (savings <= 0) return "";
  if (currency === "USD") return `$${savings.toFixed(0)}`;
  return `₺${Math.round(savings).toLocaleString("tr-TR")}`;
}
