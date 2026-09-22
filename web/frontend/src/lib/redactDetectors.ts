/**
 * Hassas Veri Gizle — cihazda çalışan tespit motoru (saf mantık, UI'dan bağımsız).
 *
 * Bileşenden AYRI dosyada: hem test edilebilir kalsın hem de testler koca bir
 * React bileşenini kapsam ölçümüne sürüklemesin (vitest `all: false`).
 */

/** TC Kimlik No doğrulama (resmî algoritma) — 11 haneli her sayı TC değildir;
 *  fatura/sipariş numaralarını "TC" diye işaretlememek için şart. */
export function isValidTcNo(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = v.split("").map(Number) as number[];
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;
  if ((odd * 7 - even) % 10 !== d[9]!) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10]!;
}

/** Luhn — kredi kartı numarasını rastgele uzun sayılardan ayırır. */
export function isLuhnValid(v: string): boolean {
  const s = v.replace(/[ -]/g, "");
  if (!/^\d{13,19}$/.test(s)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let n = Number(s[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/**
 * Cihazda regex tespiti — yapılandırılmış veri (AI'sız, anında, ücretsiz).
 *
 * `group`: etiketli alanlarda ("Fatura No: ABC-123") YALNIZCA değeri gizlemek için
 * yakalama grubu indeksi. Etiketin kendisi gizlenirse belge okunamaz hâle gelir.
 * `validate`: sağlama toplamı olan türlerde yanlış pozitifi keser (TC, kredi kartı).
 */
export type Detector = {
  type: string;
  tr: string;
  en: string;
  re: RegExp;
  group?: number;
  validate?: (v: string) => boolean;
};
export const DETECTORS: Detector[] = [
  { type: "eposta", tr: "E-posta", en: "Email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { type: "tc", tr: "TC Kimlik No", en: "National ID", re: /\b[1-9]\d{10}\b/g, validate: isValidTcNo },
  // IBAN: yalnız TR değil — her ülke formatı (2 harf + 2 rakam + 11-30 alnum).
  { type: "iban", tr: "IBAN", en: "IBAN", re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g },
  { type: "kart", tr: "Kart No", en: "Card number", re: /\b(?:\d[ -]?){12,18}\d\b/g, validate: isLuhnValid },
  { type: "telefon", tr: "Telefon", en: "Phone", re: /(?:\+90|0)?[ ]?5\d{2}[ ]?\d{3}[ ]?\d{2}[ ]?\d{2}\b/g },
  // Sabit hat (alan kodu 2xx/3xx/4xx) — cep dışındaki numaralar da kişisel veri.
  { type: "telefon", tr: "Telefon", en: "Phone", re: /(?:\+90|0)[ ]?[234]\d{2}[ ]?\d{3}[ ]?\d{2}[ ]?\d{2}\b/g },
  // ── Etiketli (bağlamsal) alanlar: yalnızca değeri yakala ────────────────────
  { type: "vergi", tr: "Vergi No", en: "Tax ID", re: /(?:vergi\s*(?:kimlik\s*)?(?:no|numaras[ıi])|vkn|tax\s*(?:id|number))\s*[:\-]?\s*(\d{10,11})/gi, group: 1 },
  { type: "fatura", tr: "Fatura / Belge No", en: "Invoice / Document no.", re: /(?:fatura|irsaliye|belge|makbuz|invoice|receipt)\s*(?:no|numaras[ıi]|number)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/.]{2,})/gi, group: 1 },
  { type: "siparis", tr: "Sipariş No", en: "Order no.", re: /(?:sipari[şs]|order)\s*(?:no|numaras[ıi]|number|id)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/.]{2,})/gi, group: 1 },
  { type: "musteri", tr: "Müşteri / Abone No", en: "Customer no.", re: /(?:m[üu][şs]teri|abone|customer|account)\s*(?:no|numaras[ıi]|number|id)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/.]{2,})/gi, group: 1 },
  { type: "sicil", tr: "Sicil / SGK No", en: "Registration no.", re: /(?:sicil|sgk|ticaret\s*sicil|mersis)\s*(?:no|numaras[ıi])?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/.]{4,})/gi, group: 1 },
  { type: "pasaport", tr: "Pasaport No", en: "Passport no.", re: /(?:pasaport|passport)\s*(?:no|numaras[ıi]|number)?\s*[:\-]?\s*([A-Z]\d{6,9})/gi, group: 1 },
  { type: "postakodu", tr: "Posta Kodu", en: "Postal code", re: /(?:posta\s*kodu|zip|postal\s*code)\s*[:\-]?\s*(\d{5})/gi, group: 1 },
  { type: "plaka", tr: "Plaka", en: "License plate", re: /\b(0[1-9]|[1-7]\d|8[01])\s?[A-Z]{1,3}\s?\d{2,4}\b/g },
  { type: "tarih", tr: "Tarih", en: "Date", re: /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/g },
  // EN SONDA: yukarıdaki özel türlerin hiçbirine girmeyen uzun numaralar
  // (sağlaması tutmayan TC, hesap/dosya/referans no, OCR'da bozulmuş kimlik…).
  // Kullanıcı listeden seçtiği için fazladan öneri zararsız; kaçırılan veri değil.
  { type: "numara", tr: "Diğer numara", en: "Other number", re: /\b\d{8,}\b/g },
];

/**
 * Metindeki yapılandırılmış hassas veriyi cihazda bulur (saf fonksiyon — test edilebilir).
 * Aynı değer birden fazla türe uyarsa İLK (en özel) tür kazanır; sıralama DETECTORS'takidir.
 */
export function detectSensitiveByRegex(
  text: string,
  tr: boolean,
): Array<{ type: string; label: string; value: string }> {
  const out: Array<{ type: string; label: string; value: string }> = [];
  const seen = new Set<string>();
  for (const d of DETECTORS) {
    for (const m of text.matchAll(d.re)) {
      // Etiketli alanlarda yalnızca yakalama grubunu al ("Fatura No: X" → "X"),
      // aksi halde etiket de gizlenir ve belge okunamaz hâle gelir.
      const raw = d.group !== undefined ? m[d.group] : m[0];
      if (!raw) continue;
      const v = raw.trim();
      const key = v.toLowerCase();
      if (v.length < 4 || seen.has(key)) continue;
      if (d.validate && !d.validate(v)) continue;
      seen.add(key);
      out.push({ type: d.type, label: tr ? d.tr : d.en, value: v });
    }
  }
  return out;
}
