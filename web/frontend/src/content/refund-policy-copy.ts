/**
 * Standalone 7-day refund guarantee copy.
 * Consumed by pricing page components and any future refund-policy UI.
 */

export type RefundCopy = {
  /** Short badge shown inline near pricing cards */
  pricingBadge: string;
  /** Larger badge / section heading */
  badge: string;
  /** Main headline for a dedicated guarantee block */
  headline: string;
  /** One-paragraph explanation of the 7-day guarantee */
  subtext: string;
  /** What happens after the 7-day window — reassures late cancellers */
  afterWindowMessage: string;
  /** FAQ question */
  faqQuestion: string;
  /** FAQ answer */
  faqAnswer: string;
};

export const refundPolicyCopy: Record<"tr" | "en", RefundCopy> = {
  tr: {
    pricingBadge: "7 gün para iade garantisi",
    badge: "💰 7 Gün İade Garantisi",
    headline: "7 Gün Koşulsuz İade",
    subtext:
      "Satın alma tarihinden itibaren 7 gün içinde memnun kalmazsanız ücretin tamamını iade ediyoruz. Gerekçe belirtmenize gerek yok — hesabınızdan tek tıkla talep edebilirsiniz.",
    afterWindowMessage:
      "7 günü geçtikten sonra iptal ederseniz mevcut abonelik döneminiz sonuna kadar tüm özelliklere erişiminiz kesintisiz devam eder. Paranız boşa gitmez.",
    faqQuestion: "Para iade politikanız nedir?",
    faqAnswer:
      "Satın alımdan itibaren 7 gün içinde başvurursanız ücretin tamamını iade ediyoruz. 7 günü geçtikten sonra aboneliğinizi iptal ederseniz dönem sonuna kadar platforma erişiminiz açık kalır.",
  },
  en: {
    pricingBadge: "7-day money-back guarantee",
    badge: "💰 7-Day Money-Back Guarantee",
    headline: "7-Day No-Questions-Asked Refund",
    subtext:
      "Not satisfied within 7 days of purchase? We'll refund every penny. No questions asked — one email and it's done.",
    afterWindowMessage:
      "Cancel after 7 days and you keep full access until your current billing period ends. Your money never goes to waste.",
    faqQuestion: "What is your refund policy?",
    faqAnswer:
      "We offer a full refund within 7 days of purchase. After 7 days, you can cancel anytime and retain access until the end of your billing period.",
  },
};
