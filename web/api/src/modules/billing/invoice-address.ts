/**
 * Fatura alıcı adresi denetimi.
 *
 * Vergi Usul Kanunu md. 230: faturada alıcının adı-soyadı/unvanı ve ADRESİ bulunmalıdır.
 * Yurt içi alıcıda adres; açık adres + ilçe + il olarak eksiksiz istenir. Yurt dışında ilçe kavramı
 * ülkeye göre değiştiğinden yalnız açık adres + şehir zorunludur.
 */
export type InvoiceAddressField = "billingAddressLine" | "billingDistrict" | "city";

export function missingInvoiceAddressFields(
  u: { addressLine: string | null | undefined; district: string | null | undefined; city: string | null | undefined },
  countryCode: string,
): InvoiceAddressField[] {
  const missing: InvoiceAddressField[] = [];
  if (!u.addressLine?.trim()) missing.push("billingAddressLine");
  if (countryCode.toUpperCase() === "TR" && !u.district?.trim()) missing.push("billingDistrict");
  if (!u.city?.trim()) missing.push("city");
  return missing;
}
