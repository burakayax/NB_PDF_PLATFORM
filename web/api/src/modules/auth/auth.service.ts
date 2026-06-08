import type {
  AuthProvider,
  EmailVerificationToken,
  Language,
  OrgRole,
  Plan,
  User,
  UserRole,
} from "@prisma/client";
import { logger } from "../../lib/file-log.js";
import { isEmailBlocked } from "../../lib/blocked-email.js";
import { authLog } from "../../lib/auth-log.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import {
  signAccessToken,
  signDesktopAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt.js";
import { sendMail } from "../../lib/mailer.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { prisma } from "../../lib/prisma.js";
import { resolveRoleFromEmail } from "../../lib/role-policy.js";
import { isAdminUser } from "../../lib/user-role.js";
import { ensureDesktopDeviceAccess } from "../device/device.service.js";
import { normalizeEmailForStorage } from "../../lib/email-identity-normalize.js";
import { normalizeToE164 } from "../../lib/phone-e164.js";
import { createUrlSafeToken, hashToken } from "../../lib/token.js";
import {
  createAdminNotificationEmailTemplate,
  createVerificationEmailTemplate,
} from "./auth.email.js";
import type {
  AuthCredentialsInput,
  ChangePasswordInput,
  RegisterInput,
  UpdateProfileInput,
} from "./auth.schema.js";
import {
  GOOGLE_OAUTH_LOG,
  logGoogleOAuthJwtIssued,
  previewSecret,
} from "./google-oauth.console.js";
import { createOrganizationForUser } from "../organization/organization.service.js";
import { REFUND_WINDOW_DAYS } from "../payment/payment.service.js";

type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  avatar: string | null;
  plan: Plan;
  role: UserRole;
  orgRole: OrgRole;
  organizationId: string | null;
  preferredLanguage: Language;
  timezone: string;
  isVerified: boolean;
  authProvider: AuthProvider;
  hasPassword: boolean;
  createdAt: string;
  phone: string | null;
  billingAddressLine: string | null;
  billingPostalCode: string | null;
  city: string | null;
  country: string | null;
  refundEligible?: boolean;
  isTeamMember: boolean;
  teamOwnerId: string | null;
  teamMemberRole: "MEMBER" | "MANAGER" | null;
};

type EmailVerificationTokenWithUser = EmailVerificationToken & {
  user: User;
};

export type AuthSessionResult = {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
};

export type RegistrationResult = {
  message: string;
  verificationRequired: true;
  user: PublicUser;
};

/** DB rolü ile e-posta politikası uyumsuzsa günceller (JWT oturumu doğru role ile üretilir). */
async function syncUserRoleFromEmail(user: User): Promise<User> {
  const expected = resolveRoleFromEmail(user.email);
  if (user.role === expected) {
    return user;
  }
  authLog.info("user role synced to email policy", {
    userId: user.id,
    from: user.role,
    to: expected,
  });
  return prisma.user.update({
    where: { id: user.id },
    data: { role: expected },
  });
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    avatar: user.avatar,
    plan: user.plan,
    role: user.role,
    orgRole: user.orgRole,
    organizationId: user.organizationId ?? null,
    preferredLanguage: user.preferredLanguage,
    timezone: user.timezone ?? "Europe/Istanbul",
    isVerified: user.isVerified,
    authProvider: user.authProvider,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt.toISOString(),
    phone: user.phone ?? null,
    billingAddressLine: user.billingAddressLine ?? null,
    billingPostalCode: user.billingPostalCode ?? null,
    city: user.city ?? null,
    country: user.country ?? null,
    isTeamMember: user.isTeamMember,
    teamOwnerId: user.teamOwnerId ?? null,
    teamMemberRole: (user.teamMemberRole as "MEMBER" | "MANAGER" | null) ?? null,
  };
}

async function createSession(user: User, isDesktop = false) {
  // Revoke all existing valid sessions so only one active session per user exists
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });

  const payload = {
    sub: user.id,
    email: user.email,
    plan: user.plan,
    role: user.role,
    orgRole: user.orgRole,
    ...(user.organizationId ? { organizationId: user.organizationId } : {}),
  };

  const accessToken = isDesktop
    ? signDesktopAccessToken(payload)
    : signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const refreshTokenHash = hashToken(refreshToken);

  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash: refreshTokenHash,
      expiresAt,
      userId: user.id,
    },
  });

  const publicUser = toPublicUser(user);

  if (user.plan !== "FREE") {
    try {
      const lastCheckout = await prisma.paymentCheckout.findFirst({
        where: { userId: user.id, status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, createdAt: true },
      });
      if (lastCheckout) {
        const completedAt = lastCheckout.completedAt ?? lastCheckout.createdAt;
        const ageMs = Date.now() - completedAt.getTime();
        publicUser.refundEligible = ageMs <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      } else {
        publicUser.refundEligible = false;
      }
    } catch {
      publicUser.refundEligible = false;
    }
  } else {
    publicUser.refundEligible = false;
  }

  return {
    accessToken,
    refreshToken,
    user: publicUser,
  };
}

function logGoogleOAuthSessionIssued(
  session: AuthSessionResult,
  flow: "google-login" | "google-register",
) {
  logGoogleOAuthJwtIssued({
    userId: session.user.id,
    email: session.user.email,
    accessTokenPreview: previewSecret(session.accessToken, 24),
    accessTokenLength: session.accessToken.length,
    refreshTokenPreview: previewSecret(session.refreshToken, 24),
    refreshTokenLength: session.refreshToken.length,
  });
  logger.info("auth",`${GOOGLE_OAUTH_LOG} session ready`, {
    flow,
    userId: session.user.id,
    email: session.user.email,
    plan: session.user.plan,
    role: session.user.role,
  });
}

/** E-postadaki tıklanabilir bağlantı: {FRONTEND_ORIGIN}/api/auth/verify-email?token=...
 *  FRONTEND_ORIGIN kullanılır — production'da kullanıcı bu domain'e erişir,
 *  /api/auth/* reverse-proxy veya Vite proxy üzerinden API'ye iletilir.
 */
export function buildEmailVerificationLink(rawToken: string) {
  const verifyUrl = new URL(
    "/api/auth/verify-email",
    env.FRONTEND_ORIGIN.replace(/\/$/, ""),
  );
  verifyUrl.searchParams.set("token", rawToken);
  return verifyUrl.toString();
}

async function createEmailVerificationToken(userId: string) {
  const rawToken = createUrlSafeToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
  );

  await prisma.emailVerificationToken.create({
    data: {
      tokenHash,
      expiresAt,
      userId,
    },
  });

  return rawToken;
}

async function sendVerificationEmail(user: User, rawToken: string) {
  const verificationUrl = buildEmailVerificationLink(rawToken);
  const emailTemplate = createVerificationEmailTemplate({
    verificationUrl,
    productName: "PDF PLATFORM",
    expiresInHours: env.EMAIL_VERIFICATION_TTL_HOURS,
  });

  await sendMail({
    to: user.email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  });
}

async function sendAdminNotificationEmail(user: User) {
  const notificationTemplate = createAdminNotificationEmailTemplate({
    userEmail: user.email,
    registeredAt: user.createdAt.toISOString(),
    productName: "PDF PLATFORM",
  });

  await sendMail({
    to: env.ADMIN_EMAIL,
    replyTo: user.email,
    subject: notificationTemplate.subject,
    html: notificationTemplate.html,
    text: notificationTemplate.text,
  });
}

function ensureVerificationTokenUsable(
  tokenRecord: EmailVerificationTokenWithUser | null,
): EmailVerificationTokenWithUser {
  if (!tokenRecord) {
    throw new HttpError(400, "Verification token is invalid.");
  }

  if (tokenRecord.usedAt) {
    throw new HttpError(400, "Verification token has already been used.");
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new HttpError(410, "Verification token has expired.");
  }

  return tokenRecord;
}

async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

/** Prefer Google given_name/family_name; else split display name. */
function deriveGoogleFirstLast(parts: {
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
}): { firstName: string | null; lastName: string | null } {
  let fn = parts.givenName?.trim() || null;
  let ln = parts.familyName?.trim() || null;
  if (fn && ln) {
    return { firstName: fn, lastName: ln };
  }

  const full = parts.displayName?.trim();
  if (full && fn && !ln) {
    if (full.startsWith(fn)) {
      const rest = full.slice(fn.length).trim();
      return { firstName: fn, lastName: rest || null };
    }
    const idx = full.indexOf(fn);
    if (idx >= 0) {
      const rest = full.slice(idx + fn.length).trim();
      if (rest) {
        return { firstName: fn, lastName: rest };
      }
    }
  }

  if (!fn && !ln && full) {
    const p = full.split(/\s+/).filter(Boolean);
    if (p.length >= 2) {
      return { firstName: p[0]!, lastName: p.slice(1).join(" ") };
    }
    return { firstName: full, lastName: null };
  }

  return { firstName: fn, lastName: ln };
}

async function ensureOrganizationForUser(user: User): Promise<void> {
  if (user.organizationId) return;
  const orgName = user.name ?? user.email.split("@")[0] ?? "My Workspace";
  await createOrganizationForUser(user.id, orgName, "FREE");
}

export async function registerUser(
  input: RegisterInput,
  options?: { skipEmailVerification?: boolean },
): Promise<RegistrationResult> {
  if (await isEmailBlocked(input.email)) {
    authLog.warn("register rejected: email blocked", { email: input.email });
    throw new HttpError(
      403,
      "This email address cannot be used to create an account.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    authLog.warn("register rejected: email already exists", {
      email: input.email,
    });
    throw new HttpError(409, "An account with this email already exists.");
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const displayName = `${firstName} ${lastName}`.trim() || null;

  let phoneE164: string | null = null;
  if (input.phone?.trim()) {
    try {
      phoneE164 = normalizeToE164(input.phone);
    } catch (e) {
      throw new HttpError(
        400,
        e instanceof Error ? e.message : "Invalid phone number.",
      );
    }
  }
  const cityTrim = input.city?.trim() ?? "";

  const passwordHash = await hashPassword(input.password);
  const resolvedRole = resolveRoleFromEmail(input.email);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      firstName,
      lastName,
      name: displayName,
      phone: phoneE164,
      ...(cityTrim ? { city: cityTrim, country: "Turkey" } : {}),
      passwordHash,
      authProvider: "local",
      role: resolvedRole,
      isVerified: options?.skipEmailVerification === true,
      preferredLanguage: input.preferredLanguage ?? "en",
      plan: resolvedRole === "ADMIN" ? "BUSINESS" : "FREE",
    },
  });

  // İstenen teşhis çıktıları (kayıt ve e-posta akışı)
  logger.info("auth","User created");

  authLog.info("register: user saved", {
    userId: user.id,
    email: user.email,
    isVerified: user.isVerified,
    preferredLanguage: user.preferredLanguage,
  });

  if (!options?.skipEmailVerification) {
    const rawToken = await createEmailVerificationToken(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken: rawToken },
    });

    logger.info("auth","Verification email sending...");
    try {
      await sendVerificationEmail(user, rawToken);
      logger.info("auth","Email sent successfully");
    } catch (error) {
      logger.error("auth","Verification email failed — full error:", error);
      if (error instanceof Error) {
        logger.error("auth",error.stack);
      }
      authLog.error("register: verification email failed, rolling back user", {
        userId: user.id,
        email: user.email,
        error: String(error),
      });
      await prisma.user.delete({ where: { id: user.id } });
      throw new HttpError(
        503,
        "We could not send the verification email. Please try again later.",
      );
    }
  }

  let persistedUser: User = user;
  try {
    await ensureOrganizationForUser(user);
    const refetched = await prisma.user.findUnique({ where: { id: user.id } });
    if (refetched) {
      persistedUser = refetched;
    }
  } catch (error) {
    authLog.warn("register: organization creation failed (user kept)", {
      userId: user.id,
      error: String(error),
    });
  }

  try {
    await sendAdminNotificationEmail(persistedUser);
  } catch (error) {
    authLog.warn("register: admin notification email failed (user kept)", {
      userId: user.id,
      error: String(error),
    });
  }

  void import("../marketing/email-automation.js")
    .then((m) =>
      m.trySendWelcomeAfterRegistration({
        id: persistedUser.id,
        email: persistedUser.email,
        firstName: persistedUser.firstName,
        lastName: persistedUser.lastName,
        name: persistedUser.name,
        role: persistedUser.role,
      }),
    )
    .catch(() => {
      /* optional marketing email */
    });

  return {
    message:
      "Verification email sent. Please verify your email before signing in.",
    verificationRequired: true,
    user: toPublicUser(persistedUser),
  };
}

export async function loginUser(
  input: AuthCredentialsInput,
  deviceId?: string,
): Promise<AuthSessionResult> {
  authLog.info("login: attempt", {
    email: input.email,
    desktop: Boolean(deviceId),
  });

  let user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    authLog.warn("login failed: unknown email", { email: input.email });
    throw new HttpError(401, "Invalid email or password.");
  }

  if (!user.passwordHash) {
    authLog.warn("login failed: oauth-only account", {
      userId: user.id,
      email: input.email,
    });
    throw new HttpError(
      401,
      "This account uses Google sign-in. Please use Continue with Google.",
    );
  }

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash,
  );
  if (!passwordMatches) {
    authLog.warn("login failed: bad password", {
      userId: user.id,
      email: input.email,
    });
    throw new HttpError(401, "Invalid email or password.");
  }

  if (!user.isVerified) {
    authLog.warn("login rejected: email not verified", {
      userId: user.id,
      email: input.email,
    });
    throw new HttpError(
      403,
      "Please verify your email address before signing in.",
    );
  }

  user = await syncUserRoleFromEmail(user);

  if (isAdminUser(user) && user.plan !== "BUSINESS") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { plan: "BUSINESS" },
    });
  }

  if (deviceId) {
    await ensureDesktopDeviceAccess(user.id, deviceId, true, {
      bypassDeviceLimit: isAdminUser(user),
    });
  }

  user = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  authLog.info("login: success", { userId: user.id, email: user.email });
  return createSession(user, Boolean(deviceId));
}

export async function refreshSession(
  refreshToken: string,
): Promise<AuthSessionResult> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, "Session refresh token is invalid.");
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash: hashToken(refreshToken),
    },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new HttpError(401, "Session refresh token has expired.");
  }

  let user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw new HttpError(404, "User account could not be found.");
  }

  if (!user.isVerified) {
    throw new HttpError(
      403,
      "Please verify your email address before continuing.",
    );
  }

  user = await syncUserRoleFromEmail(user);

  await revokeRefreshToken(refreshToken);

  return createSession(user);
}

export async function logoutUser(refreshToken: string | undefined) {
  if (!refreshToken) {
    return;
  }

  await revokeRefreshToken(refreshToken);
}

export async function deleteUserAccount(userId: string, password?: string): Promise<{ email: string; preferredLanguage: Language }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User account could not be found.");
  }

  // Şifreli (local) hesaplar için şifre doğrulaması zorunlu. Google/OAuth
  // hesaplarının şifresi yoktur; bu hesaplarda silme yetkisi, oturumu doğrulayan
  // requireAuth + istemci tarafındaki "DELETE" onay ifadesiyle sağlanır (GDPR
  // Madde 17 silme hakkını engellememek için). Şifre olmadan silmeye izin verilir.
  if (user.passwordHash) {
    if (!password) {
      throw new HttpError(400, "Password is required.");
    }
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      throw new HttpError(401, "Incorrect password.");
    }
  }

  // Explicitly delete refresh tokens before the user row so any in-flight
  // token rotation cannot race past the cascade (defensive; cascade covers it).
  await prisma.refreshToken.deleteMany({ where: { userId } });

  // Deleting the user cascades to: RefreshToken, DailyUsage, PaymentCheckout,
  // CreditTransaction, EmailVerificationToken, DeviceToken, CouponUsage,
  // UserEntitlement per schema onDelete: Cascade rules.
  await prisma.user.delete({ where: { id: userId } });

  return { email: user.email, preferredLanguage: user.preferredLanguage };
}

export async function getUserById(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, "User account could not be found.");
  }

  user = await syncUserRoleFromEmail(user);
  const publicUser = toPublicUser(user);

  if (user.plan !== "FREE") {
    const lastCheckout = await prisma.paymentCheckout.findFirst({
      where: { userId, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, createdAt: true },
    });
    if (lastCheckout) {
      const completedAt = lastCheckout.completedAt ?? lastCheckout.createdAt;
      const ageMs = Date.now() - completedAt.getTime();
      publicUser.refundEligible = ageMs <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    } else {
      publicUser.refundEligible = false;
    }
  } else {
    publicUser.refundEligible = false;
  }

  return publicUser;
}

export async function updatePreferredLanguage(
  userId: string,
  preferredLanguage: Language,
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { preferredLanguage },
  });

  return toPublicUser(user);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const displayName = `${firstName} ${lastName}`.trim() || null;

  const data: {
    firstName: string;
    lastName: string;
    name: string | null;
    phone?: string | null;
    billingAddressLine?: string | null;
    billingPostalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } = {
    firstName,
    lastName,
    name: displayName,
  };

  if (input.phone !== undefined) {
    const trimmed = input.phone.trim();
    if (trimmed.length === 0) {
      data.phone = null;
    } else {
      try {
        data.phone = normalizeToE164(trimmed);
      } catch (e) {
        throw new HttpError(
          400,
          e instanceof Error ? e.message : "Invalid phone number.",
        );
      }
    }
  }
  if (input.billingAddressLine !== undefined) {
    const v = input.billingAddressLine.trim();
    data.billingAddressLine = v.length > 0 ? v : null;
  }
  if (input.billingPostalCode !== undefined) {
    const v = input.billingPostalCode.trim();
    data.billingPostalCode = v.length > 0 ? v : null;
  }
  if (input.city !== undefined) {
    const v = input.city.trim();
    data.city = v.length > 0 ? v : null;
  }
  if (input.country !== undefined) {
    const v = input.country.trim();
    data.country = v.length > 0 ? v : null;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return toPublicUser(user);
}

export async function changeUserPassword(
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, "User account could not be found.");
  }

  if (!user.passwordHash) {
    throw new HttpError(
      400,
      "This account does not use a password. Use Google sign-in or contact support if you need access.",
    );
  }

  const currentMatches = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );
  if (!currentMatches) {
    authLog.warn("password change rejected: wrong current password", {
      userId: user.id,
    });
    throw new HttpError(401, "Current password is incorrect.");
  }

  if (input.currentPassword === input.newPassword) {
    authLog.warn("password change rejected: new password same as current", {
      userId: user.id,
    });
    throw new HttpError(
      400,
      "New password must be different from your current password.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  authLog.info("security_event", {
    event: "password_changed",
    userId: updated.id,
    email: updated.email,
  });
  return toPublicUser(updated);
}

export async function setInitialPasswordForUser(
  userId: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, "User account could not be found.");
  }

  if (user.passwordHash) {
    throw new HttpError(
      400,
      "A password is already set for this account. Use change password instead.",
    );
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  authLog.info("security_event", {
    event: "initial_password_set",
    userId: updated.id,
    email: updated.email,
  });
  return toPublicUser(updated);
}

export async function signInWithGoogle(params: {
  email: string;
  googleId: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  avatar: string | null;
  preferredLanguage: Language;
}): Promise<AuthSessionResult> {
  const email = normalizeEmailForStorage(params.email);
  const googleId = params.googleId.trim();
  const derived = deriveGoogleFirstLast({
    givenName: params.givenName,
    familyName: params.familyName,
    displayName: params.name,
  });

  logger.info("auth",`${GOOGLE_OAUTH_LOG} signInWithGoogle: lookup`, {
    email,
    name: params.name ?? null,
    googleId,
    firstName: derived.firstName,
    lastName: derived.lastName,
  });

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    if (existing.authProvider !== "google") {
      logger.error("auth",
        `${GOOGLE_OAUTH_LOG} signInWithGoogle ERROR: email already used by local account`,
        {
          email,
          existingAuthProvider: existing.authProvider,
        },
      );
      authLog.warn("google oauth rejected: email registered locally", {
        email,
      });
      throw new HttpError(
        409,
        params.preferredLanguage === "tr"
          ? "Bu e-posta adresi ile kayıtlı bir hesap zaten var. E-posta ve şifrenizle giriş yapın veya farklı bir Google hesabı kullanın."
          : "An account with this email already exists. Sign in with your email and password, or use a different Google account.",
      );
    }

    let user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId,
        name: params.name,
        avatar: params.avatar,
        role: resolveRoleFromEmail(email),
        ...(derived.firstName != null ? { firstName: derived.firstName } : {}),
        ...(derived.lastName != null ? { lastName: derived.lastName } : {}),
        ...(existing.isVerified
          ? {}
          : {
              isVerified: true,
              verifiedAt: new Date(),
            }),
      },
    });

    logger.info("auth",
      `${GOOGLE_OAUTH_LOG} user record updated (existing Google user)`,
      {
        userId: user.id,
        email: user.email,
        googleId,
      },
    );
    authLog.info("google login: success", {
      userId: user.id,
      email: user.email,
    });
    const synced = await syncUserRoleFromEmail(user);
    if (isAdminUser(synced) && synced.plan !== "BUSINESS") {
      user = await prisma.user.update({
        where: { id: synced.id },
        data: { plan: "BUSINESS" },
      });
    }
    const session = await createSession(isAdminUser(synced) ? (synced.plan === "BUSINESS" ? synced : user) : synced);
    logGoogleOAuthSessionIssued(session, "google-login");
    return session;
  }

  if (await isEmailBlocked(email)) {
    authLog.warn("google oauth rejected: email blocked", { email });
    throw new HttpError(
      403,
      "This email address cannot be used to create an account.",
    );
  }

  let persistedGoogleUser: User = await prisma.user.create({
    data: {
      email,
      googleId,
      firstName: derived.firstName,
      lastName: derived.lastName,
      name: params.name,
      avatar: params.avatar,
      passwordHash: null,
      authProvider: "google",
      role: resolveRoleFromEmail(email),
      isVerified: true,
      verifiedAt: new Date(),
      preferredLanguage: params.preferredLanguage,
      plan: resolveRoleFromEmail(email) === "ADMIN" ? "BUSINESS" : "FREE",
    },
  });

  logger.info("auth",`${GOOGLE_OAUTH_LOG} user record created (new Google user)`, {
    userId: persistedGoogleUser.id,
    email: persistedGoogleUser.email,
    googleId,
    preferredLanguage: params.preferredLanguage,
  });
  authLog.info("google register: user created", {
    userId: persistedGoogleUser.id,
    email: persistedGoogleUser.email,
  });

  try {
    await ensureOrganizationForUser(persistedGoogleUser);
    const refetched = await prisma.user.findUnique({
      where: { id: persistedGoogleUser.id },
    });
    if (refetched) {
      persistedGoogleUser = refetched;
    }
  } catch (error) {
    authLog.warn("google register: organization creation failed (user kept)", {
      userId: persistedGoogleUser.id,
      error: String(error),
    });
  }

  try {
    await sendAdminNotificationEmail(persistedGoogleUser);
  } catch (error) {
    logger.warn("auth",
      `${GOOGLE_OAUTH_LOG} admin notification email failed (user kept)`,
      {
        userId: persistedGoogleUser.id,
        error: String(error),
      },
    );
    authLog.warn(
      "google register: admin notification email failed (user kept)",
      {
        userId: persistedGoogleUser.id,
        error: String(error),
      },
    );
  }

  void import("../marketing/email-automation.js")
    .then((m) =>
      m.trySendWelcomeAfterRegistration({
        id: persistedGoogleUser.id,
        email: persistedGoogleUser.email,
        firstName: persistedGoogleUser.firstName,
        lastName: persistedGoogleUser.lastName,
        name: persistedGoogleUser.name,
        role: persistedGoogleUser.role,
      }),
    )
    .catch(() => {});

  const session = await createSession(persistedGoogleUser);
  logGoogleOAuthSessionIssued(session, "google-register");
  return session;
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const tokenRecord = ensureVerificationTokenUsable(
    await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    }),
  );

  if (tokenRecord.user.isVerified) {
    throw new HttpError(400, "Email address is already verified.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRecord.userId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verificationToken: null,
      },
    }),
    prisma.emailVerificationToken.update({
      where: { id: tokenRecord.id },
      data: {
        usedAt: new Date(),
      },
    }),
  ]);

  authLog.info("verify-email: success", {
    userId: tokenRecord.userId,
    email: tokenRecord.user.email,
  });

  return {
    message: "Your email address has been verified successfully.",
    email: tokenRecord.user.email,
  };
}
