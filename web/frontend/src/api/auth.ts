import type { Language } from "../i18n/landing";
import { buildSaasApiUrl, saasFetch } from "./saasHttp";

/** useAuthSession ile aynı anahtar; yenileme sonrası güncel jetonu paylaşmak için dışa açık. */
export const AUTH_ACCESS_TOKEN_STORAGE_KEY = "nbpdf-access-token";

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  avatar?: string | null;
  plan: string;
  /** ISO 8601; ücretli abonelik bitişi, yoksa null veya atlanmış. */
  subscription_expiry?: string | null;
  role?: "USER" | "ADMIN";
  preferredLanguage: Language;
  isVerified?: boolean;
  authProvider?: "local" | "google";
  /** From API; when absent, local accounts are treated as having a password. */
  hasPassword?: boolean;
  createdAt: string;
  /** Billing — optional until collected before checkout. */
  phone?: string | null;
  billingAddressLine?: string | null;
  billingPostalCode?: string | null;
  city?: string | null;
  country?: string | null;
};

/** PATCH /api/auth/profile and PATCH /api/user/profile (same backend handler). */
export type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  phone?: string;
  billingAddressLine?: string;
  billingPostalCode?: string;
  city?: string;
  country?: string;
};

/** True if the user can use email/password (has a password or is a legacy local account). */
export function userEffectiveHasPassword(user: AuthUser): boolean {
  return user.hasPassword ?? user.authProvider !== "google";
}

type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export type RegisterResponse = {
  message: string;
  verificationRequired: true;
  user: AuthUser;
};

function messageFromErrorPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const o = payload as Record<string, unknown>;
  if (typeof o.message === "string" && o.message.trim()) {
    return o.message;
  }
  if (typeof o.error === "string" && o.error.trim()) {
    return o.error;
  }
  if (typeof o.detail === "string" && o.detail.trim()) {
    return o.detail;
  }
  if (Array.isArray(o.detail) && o.detail.length > 0) {
    const first = o.detail[0];
    if (first && typeof first === "object" && "msg" in first && typeof (first as { msg: unknown }).msg === "string") {
      return (first as { msg: string }).msg;
    }
  }
  return fallback;
}

async function ensureOk(response: Response, defaultMessage: string) {
  if (response.ok) {
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    const message = messageFromErrorPayload(payload, defaultMessage);
    if (import.meta.env.DEV) {
      console.warn("[auth] request failed", response.status, message);
    }
    throw new Error(message);
  }

  const message = await response.text();
  if (import.meta.env.DEV) {
    console.warn("[auth] request failed", response.status, message);
  }
  throw new Error(message || defaultMessage);
}

export type RegisterAuthPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  preferredLanguage: Language;
  /** E.164 from `NbPhoneInput`, optional at sign-up */
  phone?: string;
  /** Optional at sign-up; Turkish province name when set */
  city?: string;
};

type RegisterPayload = RegisterAuthPayload;

async function sendAuthRequest<T>(path: string, body?: RegisterPayload | Record<string, string>): Promise<T | null> {
  const response = await saasFetch(`/api/auth${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  await ensureOk(response, "Authentication request failed.");
  if (response.status === 204) {
    return null;
  }

  return response.json() as Promise<T>;
}

export async function registerAuthUser(payload: RegisterAuthPayload) {
  const body: Record<string, string | Language> = {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    preferredLanguage: payload.preferredLanguage,
  };
  const pt = payload.phone?.trim();
  if (pt) {
    body.phone = pt;
  }
  const ct = payload.city?.trim();
  if (ct) {
    body.city = ct;
  }
  if (import.meta.env.DEV) {
    console.info("[auth] POST /api/auth/register", {
      email: body.email,
      preferredLanguage: body.preferredLanguage,
      hasPhone: Boolean(body.phone?.trim()),
      hasCity: Boolean(body.city?.trim()),
    });
  }
  const response = await sendAuthRequest<RegisterResponse>("/register", body);
  if (!response) {
    throw new Error("Registration response was empty.");
  }
  return response;
}

export async function loginAuthUser(email: string, password: string) {
  const payload = { email: email.trim().toLowerCase(), password };
  if (import.meta.env.DEV) {
    console.info("[auth] POST /api/auth/login", { email: payload.email });
  }
  const response = await sendAuthRequest<AuthResponse>("/login", payload);
  if (!response) {
    throw new Error("Login response was empty.");
  }
  return response;
}

/**
 * HttpOnly yenileme çerezi varsa yeni access token döner.
 * Çerez yoksa veya oturum geçersizse 401 beklenir; bu normaldir (misafir veya süresi dolmuş oturum) — konsola uyarı yazılmaz.
 */
export async function refreshAuthSession(): Promise<AuthResponse | null> {
  const response = await saasFetch(`/api/auth/refresh`, {
    method: "POST",
  });
  if (response.status === 401) {
    return null;
  }
  await ensureOk(response, "Session refresh failed.");
  return response.json() as Promise<AuthResponse>;
}

export async function logoutAuthUser() {
  await sendAuthRequest("/logout");
}

export async function fetchAuthenticatedUser(
  accessToken: string,
  options?: { silentUnauthorized?: boolean },
) {
  const response = await saasFetch(`/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && options?.silentUnauthorized && response.status === 401) {
    throw new Error("Unauthorized");
  }

  await ensureOk(response, "User session could not be verified.");
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export function getGoogleOAuthStartUrl(language: Language) {
  const lang = language === "tr" ? "tr" : "en";
  let url = buildSaasApiUrl(`/api/auth/google?lang=${encodeURIComponent(lang)}`);
  if (typeof window !== "undefined" && window.location?.origin) {
    url += `&frontend_origin=${encodeURIComponent(window.location.origin)}`;
  }
  return url;
}

export async function updateAuthProfile(accessToken: string, body: UpdateProfileInput) {
  const payloadBody: Record<string, string> = {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
  };
  if (body.phone !== undefined) {
    payloadBody.phone = body.phone.trim();
  }
  if (body.billingAddressLine !== undefined) {
    payloadBody.billingAddressLine = body.billingAddressLine.trim();
  }
  if (body.billingPostalCode !== undefined) {
    payloadBody.billingPostalCode = body.billingPostalCode.trim();
  }
  if (body.city !== undefined) {
    payloadBody.city = body.city.trim();
  }
  if (body.country !== undefined) {
    payloadBody.country = body.country.trim();
  }

  const response = await saasFetch(`/api/auth/profile`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payloadBody),
  });

  await ensureOk(response, "Profile could not be updated.");
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function changeAuthPassword(accessToken: string, body: { currentPassword: string; newPassword: string }) {
  const response = await saasFetch(`/api/auth/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      current_password: body.currentPassword,
      new_password: body.newPassword,
    }),
  });

  await ensureOk(response, "Password could not be changed.");
  const payload = (await response.json()) as { user: AuthUser; message?: string };
  return payload.user;
}

export async function setInitialAuthPassword(accessToken: string, newPassword: string) {
  const response = await saasFetch(`/api/auth/set-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      new_password: newPassword,
    }),
  });

  await ensureOk(response, "Password could not be set.");
  const payload = (await response.json()) as { user: AuthUser; message?: string };
  return payload.user;
}

export async function updateAuthPreferredLanguage(accessToken: string, preferredLanguage: Language) {
  const response = await saasFetch(`/api/auth/preferences/language`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ preferredLanguage }),
  });

  await ensureOk(response, "Preferred language could not be updated.");
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function requestPasswordReset(email: string, preferredLanguage: Language): Promise<{ message: string }> {
  const response = await saasFetch(`/api/auth/forgot-password/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), preferredLanguage }),
  });
  await ensureOk(response, "Could not send reset code.");
  return response.json() as Promise<{ message: string }>;
}

export async function verifyPasswordResetCodeApi(email: string, code: string): Promise<{ resetToken: string }> {
  const response = await saasFetch(`/api/auth/forgot-password/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  });
  await ensureOk(response, "Code verification failed.");
  return response.json() as Promise<{ resetToken: string }>;
}

export async function completePasswordResetApi(resetToken: string, newPassword: string): Promise<{ message: string }> {
  const response = await saasFetch(`/api/auth/forgot-password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken, newPassword }),
  });
  await ensureOk(response, "Password could not be reset.");
  return response.json() as Promise<{ message: string }>;
}

