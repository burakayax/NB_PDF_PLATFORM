export type PlanId = "FREE" | "PLUS" | "PRO" | "BUSINESS";
export type Currency = "TRY" | "USD";
export type BillingCycle = "MONTHLY" | "YEARLY";

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
      "5 işlem/gün",
      "50 işlem/ay",
      "Sadece: Birleştir, Böl, Sıkıştır",
      "Maks. 20 MB dosya boyutu",
      "Filigran ile çıktı",
      "Yavaş kuyruk önceliği",
    ],
    featuresEn: [
      "5 ops/day",
      "50 ops/month",
      "Only: Merge, Split, Compress",
      "Max 20 MB file size",
      "Output with watermark",
      "Slow queue priority",
    ],
    dailyOpsLimit: 5,
    monthlyOpsLimit: 50,
    fileSizeMB: 20,
    batchLimit: 0,
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
      monthly: { TRY: 220, USD: 699 },
      yearly: { TRY: 220, USD: 699 },
    },
    monthlyOnlyBilling: true,
    featuresTr: [
      "Sınırsız günlük işlem",
      "500 işlem/ay",
      "Tüm 20+ PDF araçları",
      "200 MB dosya boyutu",
      "5'e kadar toplu işlem",
      "Filigran yok",
      "Orta kuyruk önceliği",
    ],
    featuresEn: [
      "Unlimited daily ops",
      "500 ops/month",
      "All 20+ PDF tools",
      "200 MB file size",
      "Batch up to 5 files",
      "No watermark",
      "Medium queue priority",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: 500,
    fileSizeMB: 200,
    batchLimit: 5,
    watermark: false,
    seats: 1,
  },
  {
    id: "PRO",
    nameTr: "Pro",
    nameEn: "Pro",
    badge: {
      textTr: "%20 Daha Fazla İşlem",
      textEn: "+20% More Operations",
      color: "amber",
    },
    pricing: {
      monthly: { TRY: 158, USD: 499 },
      yearly: { TRY: 1900, USD: 5900 },
    },
    yearlyOnlyBilling: true,
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Sınırsız günlük işlem",
      "800 işlem/ay",
      "Tüm 20+ PDF araçları",
      "500 MB dosya boyutu",
      "20'ye kadar toplu işlem",
      "Filigran yok",
      "Yüksek kuyruk önceliği",
    ],
    featuresEn: [
      "Unlimited daily ops",
      "800 ops/month",
      "All 20+ PDF tools",
      "500 MB file size",
      "Batch up to 20 files",
      "No watermark",
      "High queue priority",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: 800,
    fileSizeMB: 500,
    batchLimit: 20,
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
      monthly: { TRY: 650, USD: 2000 },
      yearly: { TRY: 6240, USD: 19200 },
    },
    featuresTr: [
      "Sınırsız işlem",
      "5+ kişilik ekip",
      "Admin dashboard & raporlar",
      "Sınırsız dosya boyutu",
      "50+ toplu işlem",
      "Filigran yok",
      "En yüksek kuyruk önceliği",
    ],
    featuresEn: [
      "Unlimited operations",
      "5+ member team",
      "Admin dashboard & reports",
      "Unlimited file size",
      "Batch 50+ files",
      "No watermark",
      "Highest queue priority",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: null,
    fileSizeMB: null,
    batchLimit: 50,
    watermark: false,
    seats: "5+",
  },
];

export function formatPrice(
  plan: PlanDefinition,
  currency: Currency,
  cycle: BillingCycle,
): string {
  const sym = currency === "TRY" ? "₺" : "$";
  const divisor = currency === "USD" ? 100 : 1;
  const price =
    cycle === "YEARLY"
      ? plan.pricing.yearly[currency] / divisor
      : plan.pricing.monthly[currency] / divisor;

  if (price === 0) return `${sym}0`;
  if (currency === "USD") return `$${(price / 100).toFixed(2)}`;
  return `${sym}${price.toLocaleString("tr-TR")}`;
}

export function getMonthlyEquivalent(
  plan: PlanDefinition,
  currency: Currency,
): string {
  const divisor = currency === "USD" ? 100 : 1;
  const yearly = plan.pricing.yearly[currency] / divisor;
  const monthly = yearly / 12;
  if (currency === "USD") return `$${(monthly / 100).toFixed(2)}/mo`;
  return `₺${Math.round(monthly).toLocaleString("tr-TR")}/ay`;
}

export function getYearlySavings(
  plan: PlanDefinition,
  currency: Currency,
): string {
  const divisor = currency === "USD" ? 100 : 1;
  const monthly = plan.pricing.monthly[currency] / divisor;
  const yearlyEquiv = monthly * 12;
  const actual = plan.pricing.yearly[currency] / divisor;
  const savings = yearlyEquiv - actual;
  if (savings <= 0) return "";
  if (currency === "USD") return `$${(savings / 100).toFixed(0)}`;
  return `₺${Math.round(savings).toLocaleString("tr-TR")}`;
}
