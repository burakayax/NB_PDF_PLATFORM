import type { CountryCode } from "libphonenumber-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/** Parse and normalize to E.164, or null if empty. Throws if non-empty input is invalid. */
export function normalizeToE164(raw: string | undefined, defaultCountry: CountryCode = "TR"): string | null {
  const s = raw?.trim();
  if (!s) {
    return null;
  }
  const p = parsePhoneNumberFromString(s, defaultCountry);
  if (p?.isValid()) {
    return p.number;
  }
  if (E164_PATTERN.test(s)) {
    return s;
  }
  throw new Error("Invalid phone number. Use international format (e.g. +905321234567).");
}
