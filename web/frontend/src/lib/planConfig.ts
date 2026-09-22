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
  "extract-images",
];

/** Tüm araç kataloğundaki toplam araç sayısı (Plus ve üzeri tüm araçları içerir). */
export const TOTAL_TOOL_COUNT = 23;

export interface PlanDefinition {
  id: PlanId;
  nameTr: string;
  nameEn: string;
  /** Kart adının altındaki kısa açıklama — admin Plan Kartı CMS'inden override edilir. */
  taglineTr?: string;
  taglineEn?: string;
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
      "Tüm temel PDF araçları — ücretsiz",
      "Birleştir, böl, döndür, sıkıştır, görsel→PDF",
      "Yapısal araçlar cihazınızda çalışır (dosya yüklenmez)",
      "Filigransız, reklamsız temiz çıktı — her planda",
      "Dosya boyutu ≤ 80 MB",
      "Ağır dönüştürmelerde adil kullanım",
    ],
    featuresEn: [
      "All everyday PDF tools — free",
      "Merge, split, rotate, compress, image→PDF",
      "Structural tools run on your device (no upload)",
      "Clean output — no watermark, no ads (every plan)",
      "Files up to 80 MB",
      "Fair use on heavy conversions",
    ],
    dailyOpsLimit: 3,
    monthlyOpsLimit: 30,
    fileSizeMB: 80,
    batchLimit: 0,
    watermark: false,
    seats: 1,
  },
  {
    id: "STARTER",
    nameTr: "Başlangıç",
    nameEn: "Starter",
    taglineTr: "Ara sıra dönüştürme yapanlar için.",
    taglineEn: "For occasional converters.",
    badge: {
      textTr: "En İyi Başlangıç",
      textEn: "Best for Getting Started",
      color: "green",
    },
    pricing: {
      monthly: { TRY: 9900, USD: 399 },
      yearly: { TRY: 99000, USD: 3999 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Ücretsiz'deki her şey",
      "✨ Aylık 5 yapay zekâ işlemi (özetle, veri çıkar…)",
      "Günde 25 sunucu işlemi (dönüştür/sıkıştır)",
      "Dosya boyutu ≤ 100 MB",
      "Toplu işlem — 2 dosya",
      "Hızlı işlem sırası + e-posta destek",
    ],
    featuresEn: [
      "Everything in Free",
      "✨ 5 AI operations/month (summarize, extract…)",
      "25 server operations/day (convert/compress)",
      "Files up to 100 MB",
      "Batch — 2 files",
      "Fast queue + email support",
    ],
    dailyOpsLimit: 25,
    monthlyOpsLimit: 250,
    fileSizeMB: 100,
    batchLimit: 2,
    watermark: false,
    seats: 1,
  },
  {
    id: "PLUS",
    nameTr: "Plus",
    nameEn: "Plus",
    taglineTr: "Düzenli PDF işi olanlar için.",
    taglineEn: "For regular PDF work.",
    badge: {
      textTr: "En Popüler",
      textEn: "Most Popular",
      color: "blue",
    },
    pricing: {
      monthly: { TRY: 17900, USD: 699 },
      yearly: { TRY: 179000, USD: 6999 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Ücretsiz'deki her şey",
      "✨ Aylık 15 yapay zekâ işlemi",
      "Sınırsız sunucu dönüştürme (günlük limit yok)",
      "Dosya boyutu ≤ 250 MB",
      "Toplu işlem — 5 dosya",
      "Öncelikli sıra + e-posta destek",
    ],
    featuresEn: [
      "Everything in Free",
      "✨ 15 AI operations/month",
      "Unlimited server conversions (no daily cap)",
      "Files up to 250 MB",
      "Batch — 5 files",
      "Priority queue + email support",
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
    taglineTr: "Yapay zekâ ve API isteyenler için.",
    taglineEn: "For AI tools and API access.",
    badge: {
      textTr: "+25% İşlem",
      textEn: "+25% More Ops",
      color: "amber",
    },
    pricing: {
      monthly: { TRY: 29900, USD: 1199 },
      yearly: { TRY: 299000, USD: 11999 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Plus'taki her şey",
      "✨ Aylık 40 yapay zekâ işlemi",
      "✨ Tüm AI araçları: Özetle, Veri Çıkar, Çeviri, Karşılaştır, Gizle, Toplu",
      "Geliştirici API erişimi (AI uçları)",
      "Dosya boyutu ≤ 500 MB",
      "Toplu işlem — 25 dosya",
      "Öncelikli destek",
    ],
    featuresEn: [
      "Everything in Plus",
      "✨ 40 AI operations/month",
      "✨ All AI tools: Summarize, Extract, Translate, Compare, Redact, Batch",
      "Developer API access (AI endpoints)",
      "Files up to 500 MB",
      "Batch — 25 files",
      "Priority support",
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
    taglineTr: "Ekipler ve kurumlar için.",
    taglineEn: "For teams and organizations.",
    badge: {
      textTr: "Ekipler İçin",
      textEn: "For Teams",
      color: "violet",
    },
    pricing: {
      monthly: { TRY: 79900, USD: 3999 },
      yearly: { TRY: 799000, USD: 39999 },
    },
    monthlyOnlyBilling: true,
    featuresTr: [
      "Pro'daki her şey — aylık 100 yapay zekâ işlemi",
      "Ekip yönetimi — 5+ kişi",
      "Merkezi faturalama & yönetim paneli",
      "Sınırsız dosya boyutu",
      "Sınırsız toplu işlem",
      "Ticari kullanım hakkı",
      "Öncelikli destek + özel entegrasyon",
    ],
    featuresEn: [
      "Everything in Pro — 100 AI operations/month",
      "Team management — 5+ seats",
      "Central billing & admin panel",
      "Unlimited file size",
      "Unlimited batch",
      "Commercial usage rights",
      "Priority support + custom integration",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: null,
    fileSizeMB: null,
    batchLimit: 999,
    watermark: false,
    seats: "5+",
  },
];

/**
 * Prices are stored in minor units (kuruş for TRY, cents for USD). Always divide by 100.
 *
 * TL TUTARLARI KDV DAHİLDİR — müşteri ne görüyorsa onu öder.
 * BU DEĞERLER `web/api/src/lib/plan-catalogue.ts` İLE BİREBİR AYNI OLMAK
 * ZORUNDADIR; `plan-catalogue.test.ts` ayrışmayı derlemede yakalar. Burada
 * tutulmalarının tek sebebi sunucuya ulaşılamadığında ekranın boş kalmaması.
 */
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
