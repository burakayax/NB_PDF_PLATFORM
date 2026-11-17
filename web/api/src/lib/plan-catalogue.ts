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
 * USD fiyatları yurt dışı müşteriler içindir. İhracat istisnası yönetim panelindeki
 * anahtarla açıksa (varsayılan KAPALI) KDV yoktur ve gösterilen tutar ödenen tutardır;
 * KAPALIYKEN ödeme ekranı USD tutarın üstüne %20 KDV ekler (`lib/vat.ts`,
 * `frontend/src/lib/checkoutQuote.ts` — ekran ve sunucu aynı hesabı yapar).
 */

/** Türkiye KDV oranı (2023+). `lib/vat.ts` ile aynı olmak zorunda. */
export const KDV_RATE = 0.2;

export type PaidPlanId = "STARTER" | "PLUS" | "PRO" | "BUSINESS";

/**
 * Yıllık faturalandırma YALNIZCA bu planlarda sunulur. Başlangıç aylıktır;
 * ekranda yıllık seçeneği gösterilmez (`MonthlyOnlyCard`). Başlangıç'ın yıllık
 * tutarı yine tanımlıdır ki elle üretilmiş bir istek fiyatsız kalmasın, ama
 * satın alma yolu kapalıdır.
 */
export const YEARLY_BILLING_PLANS: readonly PaidPlanId[] = ["PLUS", "PRO", "BUSINESS"];
export type CataloguePlanId = "FREE" | PaidPlanId;

export type PlanPrice = {
  /** TL, KDV DAHİL — müşteriye gösterilen ve ödenen tutar. */
  tryGrossMonthly: string;
  tryGrossYearly: string;
  /** USD — yurt dışı müşteriye gösterilen tutar (KDV: ihracat istisnası kapalıyken ödeme ekranında eklenir, açıkken yok). */
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
 *  Piyasa tarafı (2026-09 ölçümü; güncel rakip tablosu için 2026-11-16 revizyonuna bakın) —
 *  iLovePDF 7 $/ay, Smallpdf Pro 15 $/ay, Adobe Acrobat Pro ~19,99 $/ay, ChatPDF 19,99 $/ay.
 *  (2026-11-16: iLovePDF resmi TR sayfasında Premium 9 $/ay; Pro 12,99 $ ile Smallpdf aralığında.)
 *
 *  Yıllık TL = TAM 10 ay fiyatına 12 ay (iki ay bedava, ~%17 indirim; 2026-11-16'dan beri
 *  aylık×10: 2.790 / 4.490 / 14.990). Tutar 12'ye bölünmez; ekranda "ayda ≈X" yaklaşık yazılır
 *  ve asıl yıllık tutar ayrıca gösterilir. Yıllık USD rakip
 *  yıllık fiyatlarına (iLovePDF 60 $/yıl, Smallpdf ~108 $/yıl) göre kurulur
 *  (güncel tutarlar aşağıdaki 2026-11-16 revizyonunda).
 *
 *  FİYAT REVİZYONU (2026-10-15): TL fiyatları dolar fiyatının ~%65-70'ine çekildi
 *  (Başlangıç 129, Plus 229, Pro 399, Business 1.099); eskiden ~%50'ydi. Pro 399 ₺
 *  kullanıcı kararıdır — sonradan zam kötü algılanacağı için ödemeler açılmadan
 *  önce yapıldı. Kur 60 ₺/$'ı aşarsa TL fiyatlar yeniden gözden geçirilmeli.
 *
 *  FİYAT REVİZYONU (2026-11-16, finans raporu "PDF_Platform_Fiyatlandirma_Finans_Raporu_2026-11-15"):
 *  Ödemeler açılmadan ve en az 1 yıl değişmeyecek biçimde yeniden hesaplandı. TL (KDV dahil):
 *  Başlangıç 129 (değişmedi), Plus 279, Pro 449, Business 1.499, ek koltuk 299. Dolar: Başlangıç 4,99,
 *  Plus 7,99, Pro 12,99, Business 49,99, ek koltuk 9,99. Yıllık TL ≈ 10 ay (12'ye tam bölünür).
 *  Yıllık USD psikolojik fiyat: 59,99 / 99,99 / 499,99 (aylık fiyatlarla aynı ".99" çizgisi).
 *  Başlangıç yıllığı satılmaz (yalnız tanımlı).
 *  Başa-baş: kur 50–70 aralığında ayda 27–35 ödeyen müşteri (rapor bölüm 8).
 */
export const PLAN_PRICES: Record<PaidPlanId, PlanPrice> = {
  STARTER: {
    tryGrossMonthly: "129.00",
    tryGrossYearly: "1290.00",
    usdMonthly: "4.99",
    usdYearly: "49.92",
  },
  PLUS: {
    tryGrossMonthly: "279.00",
    tryGrossYearly: "2790.00",
    usdMonthly: "7.99",
    usdYearly: "59.99",
  },
  PRO: {
    tryGrossMonthly: "449.00",
    tryGrossYearly: "4490.00",
    usdMonthly: "12.99",
    usdYearly: "99.99",
  },
  BUSINESS: {
    tryGrossMonthly: "1499.00",
    tryGrossYearly: "14990.00",
    usdMonthly: "49.99",
    usdYearly: "499.99",
  },
};

/**
 * Aylık KDV dahil TL tutarından yıllık KDV dahil tutarı türetir: TAM 10 ay fiyatı (aylık × 10).
 * Ön yüzdeki `yearlyGrossFromMonthly` (frontend/src/lib/checkoutQuote.ts) ile
 * AYNI kural; yönetim panelinden Business aylık fiyatı değişince yıllık bununla
 * türetilir. Katalogdaki Plus/Pro/Business yıllık tutarları bu kuralın çıktısıdır
 * (`plan-catalogue.test.ts` doğrular).
 */
export function yearlyGrossFromMonthly(monthlyGross: string): string {
  const m = Number.parseFloat(monthlyGross.replace(",", "."));
  if (!Number.isFinite(m) || m <= 0) {
    throw new Error(`Geçersiz aylık tutar: ${monthlyGross}`);
  }
  return (Math.round(m * 10 * 100) / 100).toFixed(2);
}

/** Business planına eklenen her ek koltuğun fiyatı (Business'ın koltuk başı fiyatıyla aynı hizada). */
export const EXTRA_SEAT_PRICE = {
  tryGrossMonthly: "299.00",
  usdMonthly: "9.99",
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

/** Aylık sunucu işlem sınırı yok anlamına gelen büyük değer (DB'de null yerine bu tutulur). */
export const UNLIMITED_MONTHLY_OPS = 999999;

export type PlanLimits = {
  /** Günlük sunucu işlem hakkı; null = günlük sınır yok. */
  dailyOperationLimit: number | null;
  /** Aylık sunucu işlem hakkı; UNLIMITED_MONTHLY_OPS = sınırsız. */
  monthlyOperationLimit: number;
  fileSizeLimitMB: number;
  batchLimit: number;
};

/**
 * Plan başına SAYISAL LİMİTLER — tek kaynak. Ödeme, organizasyon oluşturma, abonelik
 * tanımları ve e-posta işleri buradan okur; ön yüzdeki `planConfig.ts` (üst çubuk, plan kartı,
 * uyarılar) aynı sayıları taşımak zorundadır ve `plan-catalogue.test.ts` ayrışmayı yakalar.
 * Yönetim panelindeki PlanConfig kaydı varsa çalışma anında o geçerli olur; bu değerler varsayılandır.
 */
export const PLAN_LIMITS: Record<CataloguePlanId, PlanLimits> = {
  FREE: { dailyOperationLimit: 3, monthlyOperationLimit: 30, fileSizeLimitMB: 80, batchLimit: 0 },
  STARTER: { dailyOperationLimit: 25, monthlyOperationLimit: 250, fileSizeLimitMB: 100, batchLimit: 0 },
  PLUS: { dailyOperationLimit: null, monthlyOperationLimit: 600, fileSizeLimitMB: 250, batchLimit: 0 },
  PRO: { dailyOperationLimit: null, monthlyOperationLimit: 1000, fileSizeLimitMB: 500, batchLimit: 25 },
  BUSINESS: { dailyOperationLimit: null, monthlyOperationLimit: 5000, fileSizeLimitMB: 1000, batchLimit: 100 },
};

/**
 * BUSINESS EKİP SINIRLARI (2026-11-16, finans raporu Ek A) — "sınırsız" vaadi KALDIRILDI.
 *
 * NEDEN: Business tek başına sunucu kapasitesini tüketebilecek tek plandı (PDF sunucusu tek işçi,
 * 512 MB). Sınırlar kapasiteyi korurken Pro'nun kişi başı 1.000 işlemiyle orantılı kalır.
 * Cihazda çalışan araçlar (birleştir, böl, döndür…) sunucuya gitmez; bu sınırlara girmez ve
 * sınırsız kalır. Sunucu işlemi, imza isteği ve ek koltuk tavanı EKİP HAVUZUDUR: ekibin tamamı
 * (sahibi + üyeleri) aynı sayaçtan düşer. Havuz, ek koltukla büyür.
 *
 *  - Sunucu işlemi: ayda 5.000 (5 koltuk dahil) + ek koltuk başına 1.000
 *  - Dosya boyutu: 1.000 MB (≈1 GB), toplu işlem: 100 dosya (PLAN_LIMITS.BUSINESS)
 *  - İmza isteği: ayda 300 + ek koltuk başına 60
 *  - Koltuk: 5 dahil, en fazla 50 (45 ek); fazlası özel teklif
 * Ekranlardaki, e-postalardaki ve SEO sayfalarındaki metinler bu sayıları taşır;
 * `plan-limits-sync.test.ts` ön yüz kopyasıyla ayrışmayı yakalar.
 */
export const BUSINESS_TEAM = {
  includedSeats: 5,
  maxTotalSeats: 50,
  maxExtraSeats: 45,
  /** Ek koltuk başına eklenen aylık sunucu işlemi. */
  extraSeatMonthlyOps: 1000,
  /** Ekip havuzu: ayda imza isteği (5 koltuk için). */
  signatureRequestsBase: 300,
  /** Ek koltuk başına eklenen aylık imza isteği. */
  extraSeatSignatureRequests: 60,
} as const;

/** Business ekibinin aylık sunucu işlem havuzu (ek koltuk sayısına göre). */
export function businessMonthlyOps(extraSeats: number, base: number = PLAN_LIMITS.BUSINESS.monthlyOperationLimit): number {
  const extra = Math.min(BUSINESS_TEAM.maxExtraSeats, Math.max(0, Math.trunc(extraSeats) || 0));
  return base + extra * BUSINESS_TEAM.extraSeatMonthlyOps;
}

/** Business ekibinin aylık imza isteği havuzu (ek koltuk sayısına göre). */
export function businessMonthlySignatureRequests(extraSeats: number): number {
  const extra = Math.min(BUSINESS_TEAM.maxExtraSeats, Math.max(0, Math.trunc(extraSeats) || 0));
  return BUSINESS_TEAM.signatureRequestsBase + extra * BUSINESS_TEAM.extraSeatSignatureRequests;
}

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

/**
 * Kredi paketi / CV Geçişi hangi para biriminde TAHSİL EDİLİR: fatura ülkesi belli
 * ve TR değilse USD, aksi halde (TR ya da boş) TL. Satın alma denetleyicileri ve
 * ekranda gösterilen fiyat (listeleme uçları) AYNI kuralı kullanır; ekranda
 * gördüğünüz para birimi ile kartınızdan çekilen para birimi farklı olmasın.
 */
export function chargeCurrencyForCountry(billingCountryCode: string | null | undefined): "TRY" | "USD" {
  const country = (billingCountryCode ?? "").toUpperCase().trim();
  return country !== "" && country !== "TR" ? "USD" : "TRY";
}

/**
 * Kredi paketi için ödeme sağlayıcısına gidecek tutar ve para birimi.
 * TL fiyat KDV DAHİLDİR; ödeme altyapısı KDV'yi üstüne eklediği için buraya NET (KDV hariç) tutar verilir
 * (abonelikle aynı kural). Yurt dışı: USD, KDV'siz (ihracat) — gösterilen tutar ödenen tutardır.
 */
export function topupCheckoutAmount(
  pack: { priceTRY: number; priceUSD: number },
  isForeign: boolean,
): { currency: "TRY" | "USD"; amount: string } {
  return isForeign
    ? { currency: "USD", amount: String(pack.priceUSD) }
    : { currency: "TRY", amount: netFromGrossTry(String(pack.priceTRY)) };
}

/**
 * EK AI KREDİSİ PAKETLERİ (top-up) — tek fiyat kaynağı. `ai.quota.ts` buradan okur.
 *
 * İKİ CÜZDAN: Plandan gelen AYLIK HAK her ay sıfırlanır ve yalnız basit araçlarda
 * geçer. Satın alınan KREDİ kalıcıdır; basit araçlarda aylık hak bitince devreye girer,
 * ağır araçlar (Sözleşme Denetçisi) YALNIZ krediyle çalışır.
 *
 * FİYAT GEREKÇESİ (2026-10-02, ölçülerek): Sözleşme Denetçisi tek çalışmada ~2,1 $
 * (küçük belge) ile ~3 $ (en uzun belge) arasında maliyet çıkarır — basit bir
 * araçtan (~0,035 $) 60-90 kat. TL paketleri eskiden USD paketlerinin kabaca yarı
 * fiyatındaydı ve TL kanalında denetim zarar yazdırıyordu. TL fiyatları USD fiyatının
 * 60 ₺/$ kuruyla ve %20 KDV dahil karşılığına çekildi (ör. 500 kredi: 29,99 $ ↔ 2.299 ₺);
 * böylece her paket, en uzun belgede bile en az %55 marj bırakır.
 *
 * KUR ÖLÇÜMÜ (2026-10-02, Anthropic bakiye yüklemesi): 20 $ + 4 $ vergi = 24 $ → 1.208 ₺;
 * gerçek kur ~50,3 ₺/$. Vergi dahil 1 API dolarının bize maliyeti ~60,4 ₺'dir (vergi geri
 * alınamıyorsa). 60 ₺/$ varsayımı, maliyete bu %20 vergiyi de KATAR: yani TL fiyatlar
 * vergi geri alınamasa bile %55 marj verir. Kur 60'ı aşarsa TL paketler yükseltilmelidir;
 * zarar ancak kur ~150 ₺/$ olunca başlar (`plan-catalogue.test.ts` her derlemede doğrular).
 *
 * Kredi başına fiyat, paket büyüdükçe düşer (50 → 500).
 */
export const TOPUP_PACKS = [
  // Pay-per-use — abone olmayan kullanıcı için tek/az işlem (basit araçlar).
  { id: "ai-1", credits: 1, priceUSD: 0.99, priceTRY: 29 },
  { id: "ai-5", credits: 5, priceUSD: 3.49, priceTRY: 89 },
  // Toplu paketler.
  { id: "ai-50", credits: 50, priceUSD: 4.99, priceTRY: 359 },
  // Tek bir (en uzun belge dahil) sözleşme denetimini karşılayan en küçük paket.
  { id: "ai-125", credits: 125, priceUSD: 10.49, priceTRY: 759 },
  { id: "ai-150", credits: 150, priceUSD: 11.99, priceTRY: 869, popular: true },
  { id: "ai-500", credits: 500, priceUSD: 29.99, priceTRY: 2299 },
] as const;

/**
 * CV GEÇİŞİ — tüm CV şablonlarını SÜRELİ açan tek seferlik ürün (abonelik DEĞİL, yenilenmez).
 *
 * NEDEN: Rakipler (Zety, Resume.io) ucuz deneme + pahalı otomatik yenileme satar ve en çok
 * şikâyeti buradan alır. Biz "bir kez öde, bitir, git" diyen kullanıcıya yenilemesiz kısa geçiş
 * satarız; abone olmak isteyen zaten Pro'ya geçer (Pro/Business tüm şablonları süresiz açar).
 * Cihazda çalıştığı için marjinal maliyet SIFIRDIR → fiyat değer bazlıdır, maliyet bazlı değil.
 * TL fiyat KDV dahildir. Fiyatlar tek yerden değişir; ücretsiz şablon sayısı frontend'dedir.
 */
export const CV_PASSES = [
  { id: "cv-24h", hours: 24, priceUSD: 2.99, priceTRY: 49 },
  { id: "cv-7d", hours: 168, priceUSD: 5.99, priceTRY: 99, popular: true },
] as const;

export function cvPassById(id: string) {
  return CV_PASSES.find((p) => p.id === id) ?? null;
}

/** CV Geçişi için ödeme sağlayıcısına gidecek tutar (kredi paketiyle AYNI KDV kuralı). */
export function cvPassCheckoutAmount(
  pass: { priceTRY: number; priceUSD: number },
  isForeign: boolean,
): { currency: "TRY" | "USD"; amount: string } {
  return topupCheckoutAmount(pass, isForeign);
}

/** Geçiş bitiş zamanı: süre, hâlâ geçerli bir geçişin ÜSTÜNE eklenir (üst üste satın almak süre kaybettirmez). */
export function cvPassNewExpiry(current: Date | null | undefined, hours: number, nowMs: number = Date.now()): Date {
  const base = Math.max(nowMs, current?.getTime() ?? 0);
  return new Date(base + hours * 3_600_000);
}

/** Fatura kalemi adı. */
export function cvPassInvoiceLabel(pass: { hours: number }): string {
  return pass.hours >= 168 ? "CV Şablon Geçişi (7 gün)" : `CV Şablon Geçişi (${pass.hours} saat)`;
}

/**
 * SÖZLEŞME DENETÇİSİ hak bedeli ve maliyet modeli.
 *
 * ÖLÇÜM: 3,7 bin karakterlik tuzaklı örnek sözleşmede, claude-opus-5-5 ile 4 aşama
 * (ön tarama + iki paralel analiz + 16 resmî-kaynak araması + denetim) ≈ 117 bin giriş +
 * 54 bin çıkış token + 40 arama ≈ 2,1 $. Maliyetin çoğu çıktıdır (belge uzunluğundan
 * bağımsız); belge uzadıkça yalnızca giriş payı artar: en uzun belgede (240 bin karakter)
 * ~3 $ tahmin edilir (UZUN BELGE ÖLÇÜLMEDİ — gerçek kullanım günlüğüyle doğrulanmalı).
 *
 * Hak bedeli, en ucuz paketin (500 kredi) kredi başı fiyatında bile %55 marj bırakacak
 * şekilde seçildi; bu yüzden basit araçların aylık hakkından DÜŞMEZ, yalnız kredi geçer.
 */
export const CONTRACT_AUDIT = {
  baseCredits: 85,
  charsPerCredit: 6_500,
  minCredits: 85,
  maxCredits: 122,
  /** Küçük belgede ölçülen maliyet (USD). */
  costUsdSmall: 2.1,
  /** Belge uzadıkça eklenen (giriş) maliyet: 1000 karakter başına USD. */
  costUsdPerThousandChars: 0.0038,
} as const;

/** Bir sözleşme denetiminin kredi bedeli (belge uzunluğuna göre). */
export function contractAuditCredits(chars: number): number {
  const c = CONTRACT_AUDIT;
  const raw = c.baseCredits + Math.ceil(Math.max(0, chars) / c.charsPerCredit);
  return Math.min(c.maxCredits, Math.max(c.minCredits, raw));
}

/** Tahmini gerçek maliyet (USD) — marj testi ve kalibrasyon için. */
export function contractAuditCostUsd(chars: number): number {
  return CONTRACT_AUDIT.costUsdSmall + (Math.max(0, chars) / 1000) * CONTRACT_AUDIT.costUsdPerThousandChars;
}

/**
 * SÖZLEŞME DENETÇİSİ — HIZLI TARAMA: tek geçiş, mevzuat araması yok, en çok 8 bulgu.
 *
 * ÖLÇÜM (2026-10-02, 5 sayfalık örnek, claude-opus-5-5): ~11 bin giriş + ~7,3 bin çıkış
 * token ≈ 0,19 $ ve ~66 sn — tam denetimin (~2,3 $) yaklaşık on ikide biri. Belge uzadıkça
 * yalnız giriş payı artar (uzun belge ÖLÇÜLMEDİ; 240 bin karakterde ~0,45 $ tahmin).
 *
 * Basit bir araçtan (~0,035 $) pahalı olduğu için birkaç hak harcar: basit araçlar gibi önce
 * AYLIK HAKTAN, hak bitince krediden düşer (tam denetimden farkı bu). Bedel, en ucuz paketin
 * kredi başı fiyatında bile %55 marj bırakacak şekilde seçildi; plan testindeki "hak başı
 * 0,035 $" varsayımıyla da maliyetini aşmaz (20 hak × 0,035 $ ≥ 0,45 $).
 */
export const QUICK_SCAN = {
  baseCredits: 8,
  charsPerStep: 20_000,
  maxCredits: 20,
  /** Küçük belgede ölçülen maliyet (USD). */
  costUsdSmall: 0.19,
  /** Belge uzadıkça eklenen (giriş) maliyet: 1000 karakter başına USD. */
  costUsdPerThousandChars: 0.0011,
} as const;

/** Bir hızlı taramanın hak/kredi bedeli (belge uzunluğuna göre). */
export function quickScanCredits(chars: number): number {
  const q = QUICK_SCAN;
  return Math.min(q.maxCredits, q.baseCredits + Math.floor(Math.max(0, chars) / q.charsPerStep));
}

/** Tahmini gerçek maliyet (USD) — marj testi ve kalibrasyon için. */
export function quickScanCostUsd(chars: number): number {
  return QUICK_SCAN.costUsdSmall + (Math.max(0, chars) / 1000) * QUICK_SCAN.costUsdPerThousandChars;
}
