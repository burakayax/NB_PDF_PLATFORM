import type { FeatureKey } from "../api/subscription";

export type PlanId = "FREE" | "STARTER" | "PLUS" | "PRO" | "BUSINESS";
export type Currency = "TRY" | "USD";
export type BillingCycle = "MONTHLY" | "YEARLY";

/**
 * Ücretsiz planda (üye girişiyle) açık olan araçlar. Backend kaynağı:
 * `web/api/src/modules/subscription/subscription.config.ts` → FREE_TOOLS.
 * Araç kartlarındaki "Ücretsiz üyelik" rozeti buradan türetilir.
 */
export const FREE_PLAN_TOOL_IDS: FeatureKey[] = [
  "split",
  "merge",
  "compress",
  "word-to-pdf",
  "pdf-to-word",
  "pdf-to-image",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "unlock-pdf",
  "pdf-to-text",
  "image-to-pdf",
  "sayfa-duzeni",
  "form-doldur",
  "ustveri-temizle",
  "imza-iste",
];

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
  "word-to-pdf",
  "pdf-to-word",
  "sayfa-duzeni",
  "form-doldur",
  "ustveri-temizle",
  "imza-iste",
  "page-numbers",
  "watermark",
  "extract-images",
];

/**
 * Plana göre kilitlenen araçların toplamı (Plus ve üzeri hepsini içerir) — sunucudaki
 * `featureCatalog` (subscription.config.ts) uzunluğuyla AYNI (33). Sitenin toplam araç
 * sayısı (cihazda çalışanlar ve yapay zekâ araçları dahil) bundan ayrıdır ve sayfa
 * metinlerinde otomatik sayaçtan gelir.
 */
export const TOTAL_TOOL_COUNT = 33;

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
      "Birleştir, böl, döndür, sil, sırala, görsel→PDF: üyeliksiz ve sınırsız — dosyan cihazından çıkmaz",
      "Ücretsiz üyelikle sunucu araçlarında günde 3 işlem (ayda 30): sıkıştır, Word ↔ PDF, PDF→JPG…",
      "✏️ PDF Düzenle: günde {editorFree} düzenleme (yazıyı silin, değiştirin, görsel/imza ekleyin)",
      "✨ Hoş geldin hediyesi: 3 ücretsiz yapay zekâ işlemi",
      "Filigransız, reklamsız temiz çıktı — her planda",
      "Dosya boyutu ≤ 80 MB",
    ],
    featuresEn: [
      "Merge, split, rotate, delete, reorder, image→PDF: no account, unlimited — your file never leaves your device",
      "With a free account, 3 operations a day (30 a month) on server tools: compress, Word ↔ PDF, PDF→JPG…",
      "✏️ Edit PDF: {editorFree} edits a day (delete or change text, add images/signatures)",
      "✨ Welcome gift: 3 free AI operations",
      "Clean output — no watermark, no ads (every plan)",
      "Files up to 80 MB",
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
    pricing: {
      monthly: { TRY: 12900, USD: 399 },
      yearly: { TRY: 129000, USD: 3999 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Ücretsiz'deki her şey + PDF şifreleme, filigran, sayfa numarası, görselleri çıkarma",
      "Tüm CV şablonları ve AI Fotoğraf Stüdyosu açık",
      "✏️ PDF Düzenle: günde {editorStarter} düzenleme (Ücretsiz'de {editorFree})",
      "✨ Aylık 5 yapay zekâ işlemi (özetle, veri çıkar…); Sözleşme Denetçisi ek krediyle",
      "Günde 25, ayda en fazla 250 sunucu işlemi (dönüştür/sıkıştır)",
      "Dosya boyutu ≤ 100 MB",
      "E-posta destek",
    ],
    featuresEn: [
      "Everything in Free + PDF encryption, watermark, page numbers, extract images",
      "All CV templates and the AI Photo Studio unlocked",
      "✏️ Edit PDF: {editorStarter} edits a day ({editorFree} on Free)",
      "✨ 5 AI operations/month (summarize, extract…); Contract Auditor with extra credits",
      "25 server operations a day (250 a month): convert/compress",
      "Files up to 100 MB",
      "Email support",
    ],
    dailyOpsLimit: 25,
    monthlyOpsLimit: 250,
    fileSizeMB: 100,
    batchLimit: 0,
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
      monthly: { TRY: 22900, USD: 699 },
      yearly: { TRY: 229200, USD: 5004 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Başlangıç'taki her şey + Excel, PowerPoint ve HTML dönüşümleri, gelişmiş PDF araçları",
      "✏️ PDF Düzenle sınırsız + taranmış belgelerde otomatik yazı tanıma (OCR)",
      "✨ Aylık 15 yapay zekâ işlemi; Sözleşme Denetçisi ek krediyle",
      "Günlük limit yok — ayda 600 sunucu işlemi",
      "Dosya boyutu ≤ 250 MB",
      "Ayda 10 imza isteği",
      "E-posta destek",
    ],
    featuresEn: [
      "Everything in Starter + Excel, PowerPoint and HTML conversions, advanced PDF tools",
      "✏️ Unlimited Edit PDF + automatic text recognition (OCR) for scanned documents",
      "✨ 15 AI operations/month; Contract Auditor with extra credits",
      "No daily cap — 600 server operations a month",
      "Files up to 250 MB",
      "10 signature requests a month",
      "Email support",
    ],
    dailyOpsLimit: null,
    monthlyOpsLimit: 600,
    fileSizeMB: 250,
    batchLimit: 0,
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
      textTr: "Ayda 1.000 işlem",
      textEn: "1,000 ops / month",
      color: "amber",
    },
    pricing: {
      monthly: { TRY: 39900, USD: 1199 },
      yearly: { TRY: 399600, USD: 9000 },
    },
    displayMonthlyEquivalent: true,
    featuresTr: [
      "Plus'taki her şey",
      "✨ Aylık 40 yapay zekâ işlemi (Plus'ta 15); Sözleşme Denetçisi ek krediyle",
      "Toplu işlem: tek seferde 25 dosya",
      "Geliştirici API erişimi (AI uçları)",
      "Günlük limit yok — ayda 1.000 sunucu işlemi (Plus'ta 600)",
      "Dosya boyutu ≤ 500 MB (Plus'ta 250)",
      "Ayda 20 imza isteği",
      "Öncelikli destek: e-postan öne alınır",
    ],
    featuresEn: [
      "Everything in Plus",
      "✨ 40 AI operations/month (Plus: 15); Contract Auditor with extra credits",
      "Batch processing: 25 files at once",
      "Developer API access (AI endpoints)",
      "No daily cap — 1,000 server operations a month (Plus: 600)",
      "Files up to 500 MB (Plus: 250)",
      "20 signature requests a month",
      "Priority support: your emails are answered first",
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
      monthly: { TRY: 109900, USD: 3999 },
      yearly: { TRY: 1099200, USD: 39996 },
    },
    featuresTr: [
      "Pro'daki her şey — aylık 100 yapay zekâ işlemi; Sözleşme Denetçisi ek krediyle",
      "Ekip yönetimi: 5 kişi dahil, istediğin kadar ek kişi",
      "Ortak yönetim paneli: kişi başı kullanım raporu, tek fatura",
      "Sunucu işlem sınırı yok",
      "Sınırsız toplu işlem ve sınırsız imza isteği",
      "Çok yüksek dosya boyutu sınırı",
      "Öncelikli destek: e-postan öne alınır",
    ],
    featuresEn: [
      "Everything in Pro — 100 AI operations/month; Contract Auditor with extra credits",
      "Team management: 5 seats included, add as many more as you need",
      "Shared admin panel: per-member usage report, one invoice",
      "No server operation limit",
      "Unlimited batch processing and unlimited signature requests",
      "Very high file size limit",
      "Priority support: your emails are answered first",
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
