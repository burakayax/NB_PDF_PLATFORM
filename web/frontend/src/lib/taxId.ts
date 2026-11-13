/**
 * Vergi kimlik numarası doğrulama (yalnızca BİÇİM + SAĞLAMA HANESİ; numaranın gerçekten kayıtlı/aktif
 * olduğunu doğrulamaz — bunu yapan açık bir GİB servisi yoktur).
 *
 * - 10 haneli: Vergi Kimlik No (VKN) — şirketler ve bazı şahıs işletmeleri.
 * - 11 haneli: T.C. Kimlik No — çoğu şahıs işletmesinin vergi numarasıdır.
 */

/** BirFatura'nın herkese açık test (demo) vergi numarası: sağlama hanesi tutmaz ama test ortamında kullanılır. */
export const BIRFATURA_TEST_VKN = "1234567801";

export function isValidVkn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  if (value === BIRFATURA_TEST_VKN) return true;
  const d = value.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + (9 - i)) % 10;
    let v = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && v === 0) v = 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

export function isValidTckn(value: string): boolean {
  if (!/^\d{11}$/.test(value) || value[0] === "0") return false;
  const d = value.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const c10 = (((odd * 7 - even) % 10) + 10) % 10;
  if (c10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** Kurumsal fatura için vergi numarası: 10 haneli VKN ya da 11 haneli T.C. Kimlik No (şahıs işletmesi). Sunucuyla aynı kural. */
export function validateCorporateTaxId(value: string): string | null {
  const v = value.trim();
  if (!/^\d{10,11}$/.test(v)) return "Vergi numarası 10 haneli (VKN) ya da 11 haneli (şahıs işletmesi için T.C. Kimlik No) olmalıdır.";
  if (v.length === 10 && !isValidVkn(v)) return "Vergi Kimlik No geçersiz görünüyor; lütfen kontrol edin.";
  if (v.length === 11 && !isValidTckn(v)) return "T.C. Kimlik No geçersiz görünüyor; lütfen kontrol edin.";
  return null;
}
