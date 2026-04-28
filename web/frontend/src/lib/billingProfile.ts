import type { AuthUser } from "../api/auth";

export type BillingFieldKey =
  | "name"
  | "phone"
  | "billingAddressLine"
  | "billingPostalCode"
  | "city"
  | "country";

/** True when first/last name, phone, and full billing address are present (iyzico buyer block). */
export function isBillingProfileComplete(user: AuthUser): boolean {
  return getMissingBillingFields(user).length === 0;
}

export function getMissingBillingFields(user: AuthUser): BillingFieldKey[] {
  const missing: BillingFieldKey[] = [];

  const fn = user.firstName?.trim();
  const ln = user.lastName?.trim();
  const hasSplitName = Boolean(fn && ln);
  const nameParts = user.name?.trim()?.split(/\s+/).filter(Boolean) ?? [];
  const hasFullNameOnly = nameParts.length >= 2;
  if (!hasSplitName && !hasFullNameOnly) {
    missing.push("name");
  }

  if (!user.phone?.trim()) {
    missing.push("phone");
  }
  if (!user.billingAddressLine?.trim()) {
    missing.push("billingAddressLine");
  }
  if (!user.billingPostalCode?.trim()) {
    missing.push("billingPostalCode");
  }
  if (!user.city?.trim()) {
    missing.push("city");
  }
  if (!user.country?.trim()) {
    missing.push("country");
  }

  return missing;
}
