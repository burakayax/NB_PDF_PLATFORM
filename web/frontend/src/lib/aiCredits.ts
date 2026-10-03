/**
 * AI HAK / KREDİ — ekranda gösterilen tek kaynak.
 *
 * İKİ CÜZDAN:
 *  • AYLIK HAK  — plandan gelir, her ay başında yenilenir, devretmez. Basit araçlarda ve
 *                 hızlı sözleşme taramasında geçer.
 *  • KREDİ      — ek kredi paketinden satın alınır, SÜRESİ DOLMAZ, ay sonunda sıfırlanmaz.
 *                 Basit araçlarda ve hızlı taramada aylık hak bitince devreye girer; detaylı
 *                 sözleşme denetimi YALNIZ krediyle çalışır. Yönetici hesabında sınır yoktur.
 *
 * Formüller sunucudaki `lib/plan-catalogue.ts` ile AYNI olmak zorundadır
 * (`plan-catalogue.test.ts` ayrışmayı yakalar). Asıl düşüm her zaman sunucuda yapılır.
 */
export const CONTRACT_AUDIT_CREDITS = {
  baseCredits: 85,
  charsPerCredit: 6_500,
  minCredits: 85,
  maxCredits: 122,
};

/** Hızlı tarama (tek geçiş, mevzuatsız). */
export const QUICK_SCAN_CREDITS = {
  quickBase: 8,
  quickCharsPerStep: 20_000,
  quickMax: 20,
};

/**
 * Onay penceresindeki metnin sürümü (sunucudaki `CONSENT_VERSION` ile aynı olması GEREKMEZ: sunucu,
 * kullanıcının hangi sürümü onayladığını deftere yazar). Metin değişirse bu tarih de güncellenir.
 */
export const CONTRACT_CONSENT_VERSION = "2026-10-02";

/** Bir detaylı sözleşme denetiminin tahmini kredi bedeli (belge uzunluğuna göre). */
export function estimateContractCredits(chars: number): number {
  const c = CONTRACT_AUDIT_CREDITS;
  const raw = c.baseCredits + Math.ceil(Math.max(0, chars) / c.charsPerCredit);
  return Math.min(c.maxCredits, Math.max(c.minCredits, raw));
}

/** Bir hızlı taramanın tahmini hak/kredi bedeli (belge uzunluğuna göre). */
export function estimateQuickScanCredits(chars: number): number {
  const q = QUICK_SCAN_CREDITS;
  return Math.min(q.quickMax, q.quickBase + Math.floor(Math.max(0, chars) / q.quickCharsPerStep));
}

/** Yardım penceresinde gösterilen araç bedelleri (kredi/hak). */
export const AI_TOOL_COSTS: Array<{ tr: string; en: string; cost: string; costEn?: string; heavy?: boolean }> = [
  { tr: "PDF Özetle", en: "Summarize PDF", cost: "1" },
  { tr: "PDF ile Sohbet (her soru)", en: "Chat with PDF (per question)", cost: "1" },
  { tr: "PDF Veri Çıkar", en: "Extract Data", cost: "1" },
  { tr: "PDF Karşılaştır", en: "Compare PDFs", cost: "1" },
  { tr: "Hassas Veri Gizle", en: "Redact Data", cost: "1" },
  { tr: "PDF Çeviri", en: "Translate PDF", cost: "1 (her 20 bin karakter için +1)", costEn: "1 (+1 per 20k characters)" },
  {
    tr: "Sözleşme Denetçisi — hızlı tarama (aylık haktan, bitince krediden)",
    en: "Contract Auditor — quick scan (monthly allowance, then credits)",
    cost: `${QUICK_SCAN_CREDITS.quickBase}–${QUICK_SCAN_CREDITS.quickMax} (belge uzunluğuna göre)`,
    costEn: `${QUICK_SCAN_CREDITS.quickBase}–${QUICK_SCAN_CREDITS.quickMax} (by document length)`,
  },
  {
    tr: "Sözleşme Denetçisi — detaylı denetim (yalnız krediden)",
    en: "Contract Auditor — detailed audit (credits only)",
    cost: `${CONTRACT_AUDIT_CREDITS.minCredits}–${CONTRACT_AUDIT_CREDITS.maxCredits} (belge uzunluğuna göre)`,
    costEn: `${CONTRACT_AUDIT_CREDITS.minCredits}–${CONTRACT_AUDIT_CREDITS.maxCredits} (by document length)`,
    heavy: true,
  },
];
