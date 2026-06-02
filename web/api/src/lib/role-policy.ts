import type { UserRole } from "@prisma/client";

import { env } from "../config/env.js";
import { normalizeEmailForStorage } from "./email-identity-normalize.js";

/** Tek hesap yönetici olabilir; Gmail kanonik formu ile eşleşir (nokta/plus varyantları aynı). */
export const ADMIN_EMAIL = env.ROLE_ADMIN_EMAIL;

export function normalizeEmail(email: string): string {
  try {
    return normalizeEmailForStorage(email);
  } catch {
    return email.trim().toLowerCase();
  }
}

/** Yeni kullanıcılar ve oturum senkronu için: yalnızca ADMIN_EMAIL → ADMIN. */
export function resolveRoleFromEmail(email: string): UserRole {
  return normalizeEmail(email) === ADMIN_EMAIL ? "ADMIN" : "USER";
}

export function isAdminEmail(email: string): boolean {
  return resolveRoleFromEmail(email) === "ADMIN";
}
