import { prisma } from "../../lib/prisma.js";
import { decryptField, encryptField } from "../../lib/encryption.js";
import { lookupBinCountry } from "../../lib/bin-country.js";
import { exportExemptionOpen } from "../../lib/feature-switches.js";
import { logger } from "../../lib/file-log.js";
import { getPaytrCredentials } from "./paytr/paytr.service.js";
import { queryPaytrStatus } from "./paytr/paytr.client.js";

/**
 * KART KANITI — yurt dışı KDV istisnasının dayanağı.
 *
 * Amaç: yabancı para birimli ödemede kartın yurt içi/yurt dışı olduğunu belirleyip faturada istisna
 * uygulanıp uygulanmayacağına karar vermek ve karar için kanıt tutmak (KVKK md. 5/2-ç ve 5/2-e).
 *
 * Ne saklanır: kartın ilk 6 hanesi (BIN) — AES-256-GCM ile ŞİFRELİ — ve bulunan ülke ("TR", "DE"… ya da
 * "??" = bilinmiyor). Son 4 hane, tam numara, provizyon kodu ASLA saklanmaz.
 * Saklama süresi: ilgili ödeme/fatura kaydıyla aynı (10 yıl); süre dolunca BIN silinir (dataRetentionJobs).
 * Okuma: yalnızca yönetici ekranında, istek anında çözülür (readCardEvidence).
 */

export const CARD_COUNTRY_UNKNOWN = "??";
export type CardVerdict = "TR" | "FOREIGN" | "UNKNOWN";

/**
 * Yalnız Türk bankalarının kullandığı kart programları / ağı. Bu markalardan biri gelirse kart KESİN Türk kartıdır.
 * Tek yönlüdür: VISA/MASTERCARD gibi ortak markalar hiçbir şey kanıtlamaz (yurt içi ve yurt dışı kartlar taşır).
 * UYARI: PayTR `kart_marka` için değer listesi yayımlamıyor; liste canlı verilerle doğrulanmalıdır.
 * Yanlış/eksik olması yalnız KDV'li tarafa yanılmaya yol açar (vergi kaybı olmaz).
 */
const TURKISH_ONLY_BRANDS = new Set([
  "BONUS", "WORLD", "MAXIMUM", "AXESS", "PARAF", "CARDFINANS", "ADVANTAGE", "SAGLAM", "COMBO", "TROY",
]);

export function isTurkishOnlyBrand(brand: unknown): boolean {
  const b = String(brand ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  return TURKISH_ONLY_BRANDS.has(b);
}

/** Eski (iyzico) kayıtlar BIN'i düz 6 hane olarak tutuyor; yenileri şifreli. */
function readBin(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (/^\d{6}$/.test(stored)) return stored;
  try {
    return decryptField(stored);
  } catch {
    return null;
  }
}

export function verdictFromCountry(cardCountry: string | null | undefined): CardVerdict {
  const c = (cardCountry ?? "").toUpperCase().trim();
  if (!c || c === CARD_COUNTRY_UNKNOWN) return "UNKNOWN";
  if (c === "TR" || c === "TURKEY") return "TR";
  return "FOREIGN";
}

/**
 * PayTR Durum Sorgu'dan kartın ilk 6 hanesini alır, ülkesini bulur, şifreleyerek kaydeder.
 * Yalnız istisna anahtarı AÇIKKEN ve para birimi TRY değilken çalışır. ASLA hata fırlatmaz.
 */
export async function captureCardEvidence(checkout: {
  id: string;
  conversationId: string;
  paymentCurrency?: string | null;
  iyzicoPaymentId?: string | null;
}): Promise<CardVerdict | null> {
  try {
    if ((checkout.paymentCurrency ?? "TRY").toUpperCase() === "TRY") return null;
    if (!(await exportExemptionOpen())) return null;
    if (!checkout.iyzicoPaymentId?.startsWith("paytr:")) return null;

    const existing = await prisma.paymentCheckout.findUnique({
      where: { id: checkout.id },
      select: { cardCountry: true },
    });
    if (existing?.cardCountry) return verdictFromCountry(existing.cardCountry);

    const merchantOid = checkout.iyzicoPaymentId.slice("paytr:".length);
    const res = await queryPaytrStatus(merchantOid, getPaytrCredentials());
    const bin = res.ok ? /^\d{6}/.exec(String(res.raw.masked_pan ?? ""))?.[0] ?? null : null;
    const brandIsTurkish = res.ok && isTurkishOnlyBrand(res.raw.kart_marka);
    // Türk-özel marka, BIN listesinden daha güçlü: çelişirse güvenli taraf (TR → KDV'li).
    const country = brandIsTurkish ? "TR" : bin ? lookupBinCountry(bin) : null;

    await prisma.paymentCheckout.update({
      where: { id: checkout.id },
      data: {
        cardCountry: country ?? CARD_COUNTRY_UNKNOWN,
        cardBin: bin ? encryptField(bin) : null,
      },
    });
    // BIN değeri loglanmaz.
    logger.info("payment", "[card-evidence] kayıt alındı", {
      conversationId: checkout.conversationId,
      binFound: Boolean(bin),
      brandIsTurkish,
      country: country ?? CARD_COUNTRY_UNKNOWN,
    });
    return verdictFromCountry(country);
  } catch (e) {
    logger.warn("payment", "[card-evidence] alınamadı — bilinmiyor sayılacak", {
      conversationId: checkout.conversationId,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** Yönetici ekranı için: kayıtlı kanıtı çözerek döndürür. */
export async function readCardEvidence(conversationId: string): Promise<{
  bin: string | null;
  country: string | null;
  verdict: CardVerdict;
} | null> {
  const row = await prisma.paymentCheckout.findUnique({
    where: { conversationId },
    select: { cardBin: true, cardCountry: true },
  });
  if (!row || (!row.cardBin && !row.cardCountry)) return null;
  return { bin: readBin(row.cardBin), country: row.cardCountry ?? null, verdict: verdictFromCountry(row.cardCountry) };
}
