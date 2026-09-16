/**
 * FİYAT KATALOĞU — sistemdeki TEK fiyat kaynağı.
 *
 * NEDEN BU DOSYA VAR: Fiyatlar daha önce dört ayrı yerde tanımlıydı (ana sayfa
 * kartları, uygulama içi yükseltme ekranı, ödeme denetleyicisi, veritabanı
 * varsayılanları) ve hiçbiri diğerini tutmuyordu. Kullanıcı 249 ₺ görüp 358,80 ₺
 * ödüyordu. Artık her yer buradan okur; `plan-catalogue.test.ts` ayrışmayı
 * engeller.
 *
 * TL FİYATLARI KDV DAHİLDİR. Türkiye'de tüketiciye gösterilen fiyatın vergi
 * dahil olması yasal zorunluluk; müşteri ne görüyorsa onu öder. iyzico'ya
 * KDV hariç (net) tutar gider, bu yüzden `netFromGrossTry` ile çevrilir.
 *
 * USD fiyatları yurt dışı müşteriler içindir ve ihracat istisnası nedeniyle
 * KDV'siz, yani gösterilen tutar ödenen tutardır.
 */

/** Türkiye KDV oranı (2023+). `lib/vat.ts` ile aynı olmak zorunda. */
export const KDV_RATE = 0.2;

export type PaidPlanId = "STARTER" | "PLUS" | "PRO" | "BUSINESS";

/**
 * Yıllık faturalandırma YALNIZCA bu planlarda sunulur. Başlangıç ve Plus
 * aylıktır; ekranda da yıllık seçeneği gösterilmez (`MonthlyOnlyCard`).
 * Diğer planların yıllık tutarları yine tanımlıdır ki elle üretilmiş bir
 * istek fiyatsız kalmasın, ama satın alma yolu kapalıdır.
 */
export const YEARLY_BILLING_PLANS: readonly PaidPlanId[] = ["PRO", "BUSINESS"];
export type CataloguePlanId = "FREE" | PaidPlanId;

export type PlanPrice = {
  /** TL, KDV DAHİL — müşteriye gösterilen ve ödenen tutar. */
  tryGrossMonthly: string;
  tryGrossYearly: string;
  /** USD, vergisiz — yurt dışı müşteriye gösterilen ve ödenen tutar. */
  usdMonthly: string;
  usdYearly: string;
};

/**
 * Fiyatlandırma gerekçesi (2026-09, ölçülerek belirlendi):
 *
 *  Maliyet tarafı — tek değişken gider yapay zekâ çağrılarıdır. Ölçülen en kötü
 *  durum hak başına ~0,035 $ (Claude Haiku 4.5; 1 $/M giriş, 5 $/M çıkış).
 *  Sunucu tarafı işlemlerin marjinal para maliyeti yoktur (sabit kapasite).
 *
 *  Marj tabanı — HER plan, aylık yapay zekâ hakkının TAMAMI kullanılsa bile
 *  (gerçekte kullanım bunun çok altındadır) ödeme komisyonu sonrası en az %55
 *  brüt marj bırakır. `plan-catalogue.test.ts` bunu her derlemede doğrular.
 *
 *  Piyasa tarafı — iLovePDF 7 $/ay (Türkiye'de de dolar), Smallpdf Pro 15 $/ay,
 *  Adobe Acrobat Pro ~19,99 $/ay, yapay zekâlı ChatPDF tek başına 19,99 $/ay.
 *  Pro'muz 11,99 $: iLovePDF'in üstünde (bizde yapay zekâ var), yapay zekâ
 *  odaklı rakiplerin belirgin altında.
 *
 *  Yıllık = 10 ay fiyatına 12 ay (iki ay bedava, ~%17 indirim).
 */
export const PLAN_PRICES: Record<PaidPlanId, PlanPrice> = {
  STARTER: {
    tryGrossMonthly: "99.00",
    tryGrossYearly: "990.00",
    usdMonthly: "3.99",
    usdYearly: "39.99",
  },
  PLUS: {
    tryGrossMonthly: "179.00",
    tryGrossYearly: "1790.00",
    usdMonthly: "6.99",
    usdYearly: "69.99",
  },
  PRO: {
    tryGrossMonthly: "299.00",
    tryGrossYearly: "2990.00",
    usdMonthly: "11.99",
    usdYearly: "119.99",
  },
  BUSINESS: {
    tryGrossMonthly: "799.00",
    tryGrossYearly: "7990.00",
    usdMonthly: "39.99",
    usdYearly: "399.99",
  },
};

/** Business planına eklenen her ek koltuğun fiyatı (Business'ın koltuk başı fiyatıyla aynı hizada). */
export const EXTRA_SEAT_PRICE = {
  tryGrossMonthly: "159.00",
  usdMonthly: "7.99",
} as const;

/**
 * Plan başına aylık yapay zekâ hakkı.
 *
 * NEDEN BURADA: Hak sayısı doğrudan maliyettir, yani fiyatın ayrılmaz parçası.
 * Ayrı dosyada tutulunca biri artırılıp diğeri unutuluyordu. `env` değerleri
 * bunları geçersiz kılabilir (acil durum ayarı), ama varsayılan burasıdır.
 */
/**
 * KUR RİSKİ: Yapay zekâ maliyeti dolar, TL fiyatları sabittir. Lira değer
 * kaybettikçe TL kanalının marjı daralır. Aşağıdaki hak sayıları, kur 60 ₺/$
 * olsa bile %55 marj kalacak şekilde seçildi (`plan-catalogue.test.ts` her
 * derlemede doğrular). Kur bunun üstüne çıkarsa TL fiyatları yükseltilmelidir.
 */
export const AI_MONTHLY_CREDITS: Record<CataloguePlanId, number> = {
  FREE: 0,
  STARTER: 5,
  PLUS: 15,
  PRO: 40,
  BUSINESS: 100,
};

/** Ölçülen en kötü durum: bir yapay zekâ hakkının bize maliyeti (USD). */
export const AI_COST_PER_CREDIT_USD = 0.035;

/** KDV dahil TL tutarından iyzico'ya gidecek net (KDV hariç) tutarı üretir. */
export function netFromGrossTry(gross: string): string {
  const g = Number.parseFloat(gross.replace(",", "."));
  if (!Number.isFinite(g) || g <= 0) {
    throw new Error(`Geçersiz KDV dahil tutar: ${gross}`);
  }
  return (Math.round((g / (1 + KDV_RATE)) * 100) / 100).toFixed(2);
}
