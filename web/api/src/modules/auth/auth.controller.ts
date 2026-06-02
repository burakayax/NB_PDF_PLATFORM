import type { CookieOptions, Request, Response } from "express";
import {
  logGoogleOAuth,
  logLoginAttempt,
  logRegisterAttempt,
} from "../../lib/app-logger.js";
import { authLog } from "../../lib/auth-log.js";
import { env } from "../../config/env.js";
import { tryNormalizeEmailForStorage } from "../../lib/email-identity-normalize.js";
import { HttpError } from "../../lib/http-error.js";
import { createSecureToken } from "../../lib/token.js";
import {
  authCredentialsSchema,
  changePasswordSchema,
  changePasswordSnakeSchema,
  setInitialPasswordSnakeSchema,
  deleteAccountSchema,
  preferredLanguageSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.schema.js";
import {
  buildGoogleAuthorizeUrl,
  assertGoogleOAuthConfigured,
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  getGoogleRedirectUri,
} from "./auth.google.js";
import {
  GOOGLE_OAUTH_LOG,
  logGoogleCallbackQuery,
  logGoogleOAuthRedirect,
  maskRedirectUrlForLog,
} from "./google-oauth.console.js";
import {
  changeUserPassword,
  setInitialPasswordForUser,
  deleteUserAccount,
  getUserById,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  signInWithGoogle,
  type AuthSessionResult,
  updatePreferredLanguage,
  updateUserProfile,
  verifyEmailToken,
} from "./auth.service.js";
import {
  getDesktopDeviceIdFromHeaders,
  isDesktopClient,
} from "../device/device.service.js";
import {
  acceptOAuthFrontendOriginFromRequest,
  resolveOAuthSpaRedirectBase,
} from "../../lib/oauth-frontend-origin.js";
import { logAdminAudit } from "../admin/admin-audit.service.js";
import { sendMail } from "../../lib/mailer.js";
import { createAccountDeletionEmailTemplate } from "./auth.email.js";

const REFRESH_COOKIE_NAME = "nbpdf_refresh_token";
const OAUTH_STATE_COOKIE = "nbpdf_google_oauth";

/** SPA (ör. Vercel) ve API (ör. Render) farklı site ise OAuth/ref oturum çerezleri için SameSite=None + Secure gerekir. */
function hostsDifferentProduction(): boolean {
  if (env.NODE_ENV !== "production") {
    return false;
  }
  try {
    const api = new URL(env.APP_BASE_URL);
    const fe = new URL(
      env.OAUTH_FRONTEND_REDIRECT_ORIGIN || env.FRONTEND_ORIGIN,
    );
    return api.host !== fe.host;
  } catch {
    return false;
  }
}

/**
 * COOKIE_DOMAIN bazen SPA alanına (pdfplatform.app) yazılı kalır; API başka hosttaysa
 * Tarayıcı Set-Cookie’yi reddeder. Yalnızca APP_BASE_URL hostnamesinin gerçekten bu Domain ile uyumu halinde kullanılır.
 */
function cookieDomainForApiHost(): string | undefined {
  const raw = env.COOKIE_DOMAIN?.trim();
  if (!raw) {
    return undefined;
  }
  const cookieHost = raw.startsWith(".") ? raw.slice(1) : raw;
  try {
    const apiHostname = new URL(env.APP_BASE_URL).hostname;
    const matches =
      apiHostname === cookieHost || apiHostname.endsWith(`.${cookieHost}`);
    if (!matches) {
      return undefined;
    }
    return raw.startsWith(".") ? raw : `.${cookieHost}`;
  } catch {
    return undefined;
  }
}

function getCookieOptions(): CookieOptions {
  const crossSiteSplit = hostsDifferentProduction();
  const opts: CookieOptions = {
    httpOnly: true,
    path: "/api/auth",
    secure: env.NODE_ENV === "production",
    sameSite: crossSiteSplit ? "none" : "lax",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
  const domain = cookieDomainForApiHost();
  if (domain) {
    opts.domain = domain;
  }
  return opts;
}

/**
 * Google OAuth CSRF state — host-only (Domain yok); API ile SPA farklı origin ise SameSite=None.
 */
function getOAuthStateCookieOptions(): CookieOptions {
  const crossSiteSplit = hostsDifferentProduction();
  return {
    httpOnly: true,
    path: "/api/auth",
    secure: env.NODE_ENV === "production",
    sameSite: crossSiteSplit ? "none" : "lax",
    maxAge: 10 * 60 * 1000,
  };
}

/** Express: clearCookie ile maxAge/expires geçmek kullanım dışı bırakıldı — silinince çerez özellikleri eşleşmeli. */
function clearCookieMatching(
  response: Response,
  name: string,
  options: CookieOptions,
) {
  const rest = { ...options } as CookieOptions & {
    maxAge?: number;
    expires?: Date;
  };
  delete rest.maxAge;
  delete rest.expires;
  response.clearCookie(name, rest);
}

/** Cookie: `csrf|lang` | … | `desktop|port` | … | `fe|encodeURIComponent(origin)` */
function parseOAuthStateCookieValue(rawCookie: string): {
  csrfToken: string;
  preferredLanguage: "tr" | "en";
  desktopLocalPort: number | null;
  frontendOriginRaw: string | null;
} {
  const parts = rawCookie.split("|");
  const csrfToken = parts[0] ?? "";
  const preferredLanguage: "tr" | "en" = parts[1] === "tr" ? "tr" : "en";
  let idx = 2;
  let desktopLocalPort: number | null = null;

  if (parts[idx] === "desktop" && parts[idx + 1]) {
    const parsedPort = Number.parseInt(parts[idx + 1] ?? "", 10);
    if (
      !Number.isNaN(parsedPort) &&
      parsedPort >= 1024 &&
      parsedPort <= 65_535
    ) {
      desktopLocalPort = parsedPort;
    }
    idx += 2;
  }

  let frontendOriginRaw: string | null = null;
  if (parts[idx] === "fe" && parts[idx + 1]) {
    try {
      frontendOriginRaw = decodeURIComponent(parts[idx + 1] ?? "");
    } catch {
      frontendOriginRaw = null;
    }
  }

  return { csrfToken, preferredLanguage, desktopLocalPort, frontendOriginRaw };
}

function oauthRedirectBaseFromRequestCookie(request: Request): string {
  const raw = request.cookies[OAUTH_STATE_COOKIE] as string | undefined;
  if (!raw) {
    return resolveOAuthSpaRedirectBase(null);
  }
  const parsed = parseOAuthStateCookieValue(raw);
  return resolveOAuthSpaRedirectBase(parsed.frontendOriginRaw);
}

/** Google OAuth sonrası SPA yönlendirmeleri (JSON yok; yalnızca redirect). */
function oauthFrontendRedirect(
  path: "login-success" | "login-error",
  query?: Record<string, string>,
  redirectOriginBase?: string,
) {
  const base = (
    redirectOriginBase ?? env.OAUTH_FRONTEND_REDIRECT_ORIGIN
  ).replace(/\/$/, "");
  const url = new URL(`${base}/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/** Callback’te HttpError dışı (Prisma, vb.) hatalar için kullanıcıya güvenli kısa metin. */
function userFacingOAuthCallbackError(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message.slice(0, 500);
  }
  if (error instanceof Error) {
    const prisma = error as Error & {
      code?: string;
      meta?: { target?: string[] };
    };
    if (prisma.code === "P2002") {
      return "This Google account may already be linked to another profile, or a unique field conflicted. Try another Google account or contact support.";
    }
    const msg = (error.message || "").trim() || error.name;
    return msg.length > 450 ? `${msg.slice(0, 450)}…` : msg;
  }
  return "Google sign-in failed (unexpected error). Check the API terminal logs for details.";
}

function writeSession(response: Response, session: AuthSessionResult) {
  response.cookie(
    REFRESH_COOKIE_NAME,
    session.refreshToken,
    getCookieOptions(),
  );
  response.json({
    accessToken: session.accessToken,
    user: session.user,
  });
}

function clientRequestMeta(request: Request) {
  const ua = request.get("user-agent");
  return {
    ip: request.ip || request.socket?.remoteAddress,
    userAgent: typeof ua === "string" ? ua.slice(0, 500) : undefined,
    desktop: isDesktopClient(request.headers),
  };
}

function rawBodyEmail(request: Request) {
  if (
    !request.body ||
    typeof request.body !== "object" ||
    !("email" in request.body)
  ) {
    return undefined;
  }
  const v = (request.body as { email?: unknown }).email;
  if (typeof v !== "string") {
    return undefined;
  }
  const trimmed = v.trim().slice(0, 320);
  return tryNormalizeEmailForStorage(trimmed) ?? trimmed.toLowerCase();
}

function renderVerificationHtml(
  status: "success" | "error",
  title: string,
  detail: string,
) {
  const accent = status === "success" ? "#38bdf8" : "#f87171";
  const accentText = status === "success" ? "#082f49" : "#450a0a";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;min-height:100vh;background:#0f172a;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px;">
    <div style="width:min(560px,100%);background:#111827;border:1px solid #1f2937;border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.35);overflow:hidden;">
      <div style="padding:28px 28px 16px;border-bottom:1px solid #1f2937;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.18em;color:#7dd3fc;text-transform:uppercase;">PDF PLATFORM</div>
        <h1 style="margin:16px 0 0;font-size:28px;line-height:1.2;color:#f8fafc;">${title}</h1>
      </div>
      <div style="padding:28px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 14px;border-radius:999px;background:${accent};color:${accentText};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">
          ${status === "success" ? "Verified" : "Verification error"}
        </div>
        <p style="margin:18px 0 0;font-size:15px;line-height:1.8;color:#cbd5e1;">${detail}</p>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#94a3b8;">You can now return to the application and continue with your account flow.</p>
        <a href="${env.FRONTEND_ORIGIN}/?view=login&email_verified=1" style="display:inline-block;margin-top:24px;padding:12px 18px;border-radius:14px;background:#1e293b;color:#f8fafc;text-decoration:none;font-weight:700;">
          Open PDF PLATFORM
        </a>
      </div>
    </div>
  </body>
</html>`;
}

export async function registerController(request: Request, response: Response) {
  const meta = clientRequestMeta(request);
  authLog.info("POST /api/auth/register: body keys", {
    keys:
      request.body && typeof request.body === "object"
        ? Object.keys(request.body as object)
        : [],
  });
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    authLog.warn("POST /api/auth/register: validation failed", {
      issues: parsed.error.issues.map((i) => i.message),
    });
    logRegisterAttempt({
      outcome: "failure",
      email:
        typeof request.body === "object" &&
        request.body &&
        "email" in request.body
          ? String((request.body as { email?: unknown }).email)
          : null,
      reason: "validation",
      ...meta,
    });
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Registration data is invalid.",
    );
  }

  const skipEmailVerification =
    typeof request.body === "object" &&
    request.body !== null &&
    (request.body as Record<string, unknown>)["skipEmailVerification"] === true;

  try {
    const result = await registerUser(parsed.data, { skipEmailVerification });
    authLog.info("POST /api/auth/register: created", {
      userId: result.user.id,
    });
    logRegisterAttempt({
      outcome: "success",
      email: result.user.email,
      userId: result.user.id,
      ...meta,
    });
    response.status(201).json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      logRegisterAttempt({
        outcome: "failure",
        email: parsed.data.email,
        httpStatus: error.statusCode,
        reason: error.message,
        ...meta,
      });
    }
    throw error;
  }
}

export async function loginController(request: Request, response: Response) {
  const meta = clientRequestMeta(request);
  authLog.info("POST /auth/login: request", {
    desktop: isDesktopClient(request.headers),
    keys:
      request.body && typeof request.body === "object"
        ? Object.keys(request.body as object)
        : [],
  });
  const parsed = authCredentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    authLog.warn("POST /auth/login: validation failed", {
      issues: parsed.error.issues.map((i) => i.message),
    });
    logLoginAttempt({
      outcome: "failure",
      reason: "validation",
      email: rawBodyEmail(request) ?? null,
      ...meta,
    });
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Login data is invalid.",
    );
  }

  const deviceId = isDesktopClient(request.headers)
    ? getDesktopDeviceIdFromHeaders(request.headers)
    : "";
  try {
    const session = await loginUser(parsed.data, deviceId || undefined);
    logLoginAttempt({
      outcome: "success",
      email: session.user.email,
      userId: session.user.id,
      ...meta,
    });
    writeSession(response, session);
  } catch (error) {
    if (error instanceof HttpError) {
      logLoginAttempt({
        outcome: "failure",
        email: parsed.data.email,
        httpStatus: error.statusCode,
        reason: error.message,
        ...meta,
      });
    }
    throw error;
  }
}

export async function refreshController(request: Request, response: Response) {
  const refreshToken = request.cookies[REFRESH_COOKIE_NAME] as
    | string
    | undefined;
  if (!refreshToken) {
    throw new HttpError(401, "No active session found.");
  }

  const session = await refreshSession(refreshToken);
  writeSession(response, session);
}

export async function logoutController(request: Request, response: Response) {
  const refreshToken = request.cookies[REFRESH_COOKIE_NAME] as
    | string
    | undefined;
  await logoutUser(refreshToken);

  clearCookieMatching(response, REFRESH_COOKIE_NAME, getCookieOptions());
  response.status(204).send();
}

export async function meController(request: Request, response: Response) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const user = await getUserById(request.authUser.id);
  response.json({ user });
}

export async function updatePreferredLanguageController(
  request: Request,
  response: Response,
) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = preferredLanguageSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Preferred language is invalid.",
    );
  }

  const user = await updatePreferredLanguage(
    request.authUser.id,
    parsed.data.preferredLanguage,
  );
  response.json({ user });
}

export async function updateProfileController(
  request: Request,
  response: Response,
) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Profile data is invalid.",
    );
  }

  const user = await updateUserProfile(request.authUser.id, parsed.data);
  response.json({ user });
}

export async function changePasswordController(
  request: Request,
  response: Response,
) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = changePasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Password data is invalid.",
    );
  }

  const user = await changeUserPassword(request.authUser.id, parsed.data);
  response.json({ user });
}

/** POST /api/auth/change-password — JSON body: current_password, new_password */
export async function changePasswordPostController(
  request: Request,
  response: Response,
) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = changePasswordSnakeSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Password data is invalid.",
    );
  }

  const user = await changeUserPassword(request.authUser.id, {
    currentPassword: parsed.data.current_password,
    newPassword: parsed.data.new_password,
  });
  response.json({
    message: "Password has been updated successfully.",
    user,
  });
}

export async function setInitialPasswordPostController(
  request: Request,
  response: Response,
) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = setInitialPasswordSnakeSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Password data is invalid.",
    );
  }

  const user = await setInitialPasswordForUser(
    request.authUser.id,
    parsed.data.new_password,
  );
  response.json({
    message: "Password has been set successfully.",
    user,
  });
}

const DELETE_ACCOUNT_LOG = "[auth/delete-account]";

/**
 * DELETE /api/auth/me — GDPR hesap silme.
 * Kullanıcı şifresini doğrular; eşleşirse tüm verileri siler, oturumu kapatır,
 * onay e-postası gönderir ve denetim kaydı bırakır.
 */
export async function deleteMyAccountController(
  request: Request,
  response: Response,
) {
  if (!request.authUser) {
    throw new HttpError(401, "Authentication is required.");
  }

  const parsed = deleteAccountSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request body.");
  }

  const { id: userId, email } = request.authUser;

  authLog.info(`${DELETE_ACCOUNT_LOG} deletion requested`, { userId, email });

  // deleteUserAccount verifies password and performs the delete atomically.
  const { email: deletedEmail, preferredLanguage } = await deleteUserAccount(
    userId,
    parsed.data.password,
  );

  const deletedAt = new Date().toISOString();
  authLog.info(`${DELETE_ACCOUNT_LOG} user deleted successfully`, { userId, email: deletedEmail, deletedAt });

  // Persist audit trail — userId set to null because the row no longer exists.
  try {
    await logAdminAudit(
      { userId: "deleted", email: deletedEmail },
      "USER_SELF_DELETE",
      deletedEmail,
      `User deleted own account (GDPR). deletedAt=${deletedAt}`,
      { userId, deletedAt },
    );
  } catch (auditErr) {
    // Non-fatal: account is already deleted; just log the audit failure.
    authLog.error(`${DELETE_ACCOUNT_LOG} audit log write failed (non-fatal)`, { detail: String(auditErr) });
  }

  // Clear refresh token cookie so the browser session is immediately invalidated.
  response.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  // Send confirmation email asynchronously — don't block the response.
  const lang = preferredLanguage === "tr" ? "tr" : "en";
  const emailTemplate = createAccountDeletionEmailTemplate({
    email: deletedEmail,
    deletedAt,
    lang,
  });
  sendMail({ to: deletedEmail, ...emailTemplate }).catch((mailErr: unknown) => {
    authLog.error(`${DELETE_ACCOUNT_LOG} confirmation email failed (non-fatal)`, { detail: String(mailErr) });
  });

  response.status(200).json({ message: "Account deleted successfully." });
}

export async function googleOAuthStartController(
  request: Request,
  response: Response,
) {
  const meta = clientRequestMeta(request);
  try {
    assertGoogleOAuthConfigured();
  } catch (error) {
    if (error instanceof HttpError) {
      logGoogleOAuth({
        outcome: "failure",
        step: "start",
        reason: error.message,
        ...meta,
      });
      authLog.error(
        `${GOOGLE_OAUTH_LOG} start FAILED (not configured or misconfigured)`,
        {
          message: error.message,
          ...meta,
        },
      );
      const failUrl = oauthFrontendRedirect("login-error", {
        reason: error.message,
      });
      logGoogleOAuthRedirect({
        kind: "login-error",
        urlMasked: maskRedirectUrlForLog(failUrl),
      });
      response.redirect(failUrl);
      return;
    }
    throw error;
  }

  const langParam =
    typeof request.query.lang === "string" ? request.query.lang : "";
  const preferredLanguage = langParam === "tr" ? "tr" : "en";
  const desktopPortRaw =
    typeof request.query.desktop_port === "string"
      ? request.query.desktop_port.trim()
      : "";
  let desktopLocalPort: number | null = null;
  if (desktopPortRaw) {
    const parsed = Number.parseInt(desktopPortRaw, 10);
    if (!Number.isNaN(parsed) && parsed >= 1024 && parsed <= 65_535) {
      desktopLocalPort = parsed;
    }
  }
  const frontendOriginQuery =
    typeof request.query.frontend_origin === "string"
      ? request.query.frontend_origin.trim()
      : "";
  let trustedFrontendOrigin = "";
  if (
    frontendOriginQuery &&
    acceptOAuthFrontendOriginFromRequest(frontendOriginQuery)
  ) {
    trustedFrontendOrigin = frontendOriginQuery.replace(/\/$/, "");
  } else if (frontendOriginQuery) {
    authLog.warn("GET /auth/google: ignoring untrusted frontend_origin", {
      preview: frontendOriginQuery.slice(0, 120),
    });
  }
  const state = createSecureToken(24);
  let oauthCookieValue = `${state}|${preferredLanguage}`;
  if (desktopLocalPort !== null) {
    oauthCookieValue += `|desktop|${desktopLocalPort}`;
  }
  if (trustedFrontendOrigin) {
    oauthCookieValue += `|fe|${encodeURIComponent(trustedFrontendOrigin)}`;
  }
  response.cookie(
    OAUTH_STATE_COOKIE,
    oauthCookieValue,
    getOAuthStateCookieOptions(),
  );
  // Embed desktop port in Google `state` so redirect still works if the OAuth cookie is dropped
  // (browser privacy / cross-site edge cases). CSRF token is the hex prefix before ".d<port>".
  const stateForGoogle =
    desktopLocalPort !== null ? `${state}.d${desktopLocalPort}` : state;
  const authorizeUrl = buildGoogleAuthorizeUrl(stateForGoogle);
  authLog.info(`${GOOGLE_OAUTH_LOG} start → redirect to Google accounts`, {
    preferredLanguage,
    redirectUri: getGoogleRedirectUri(),
    statePreview: `${state.slice(0, 8)}…`,
    authorizeUrlLength: authorizeUrl.length,
  });
  authLog.info("GET /auth/google: redirect to Google", { preferredLanguage });
  response.redirect(authorizeUrl);
}

export async function googleOAuthCallbackController(
  request: Request,
  response: Response,
) {
  const meta = clientRequestMeta(request);
  const oauthErr =
    typeof request.query.error === "string" ? request.query.error : "";
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state =
    typeof request.query.state === "string" ? request.query.state : "";

  logGoogleCallbackQuery({
    hasError: Boolean(oauthErr),
    error: oauthErr || undefined,
    hasCode: Boolean(code),
    hasState: Boolean(state),
  });

  if (oauthErr) {
    const rdBase = oauthRedirectBaseFromRequestCookie(request);
    clearCookieMatching(
      response,
      OAUTH_STATE_COOKIE,
      getOAuthStateCookieOptions(),
    );
    const desc =
      typeof request.query.error_description === "string"
        ? request.query.error_description
        : oauthErr;
    logGoogleOAuth({
      outcome: "failure",
      step: "callback",
      reason: desc.slice(0, 500),
      ...meta,
    });
    authLog.error(
      `${GOOGLE_OAUTH_LOG} callback: Google returned error to redirect_uri`,
      {
        error: oauthErr,
        errorDescription: desc.slice(0, 500),
        ...meta,
      },
    );
    const url = oauthFrontendRedirect(
      "login-error",
      { reason: desc.slice(0, 500) },
      rdBase,
    );
    logGoogleOAuthRedirect({
      kind: "login-error",
      urlMasked: maskRedirectUrlForLog(url),
    });
    response.redirect(url);
    return;
  }

  if (!code || !state) {
    const rdBase = oauthRedirectBaseFromRequestCookie(request);
    clearCookieMatching(
      response,
      OAUTH_STATE_COOKIE,
      getOAuthStateCookieOptions(),
    );
    logGoogleOAuth({
      outcome: "failure",
      step: "callback",
      reason: "missing_code_or_state",
      ...meta,
    });
    authLog.error(`${GOOGLE_OAUTH_LOG} callback: missing code or state`, {
      ...meta,
    });
    const url = oauthFrontendRedirect(
      "login-error",
      { reason: "Missing authorization response from Google." },
      rdBase,
    );
    logGoogleOAuthRedirect({
      kind: "login-error",
      urlMasked: maskRedirectUrlForLog(url),
    });
    response.redirect(url);
    return;
  }

  const rawCookie = request.cookies[OAUTH_STATE_COOKIE] as string | undefined;
  clearCookieMatching(
    response,
    OAUTH_STATE_COOKIE,
    getOAuthStateCookieOptions(),
  );

  if (!rawCookie) {
    logGoogleOAuth({
      outcome: "failure",
      step: "callback",
      reason: "oauth_cookie_missing",
      ...meta,
    });
    authLog.error(
      `${GOOGLE_OAUTH_LOG} callback: OAuth state cookie missing (expired or blocked)`,
      { ...meta },
    );
    const url = oauthFrontendRedirect("login-error", {
      reason: "Sign-in session expired. Please try again.",
    });
    logGoogleOAuthRedirect({
      kind: "login-error",
      urlMasked: maskRedirectUrlForLog(url),
    });
    response.redirect(url);
    return;
  }

  const parsedOAuth = parseOAuthStateCookieValue(rawCookie);
  const oauthSpaRedirectBase = resolveOAuthSpaRedirectBase(
    parsedOAuth.frontendOriginRaw,
  );
  const expectedState = parsedOAuth.csrfToken;
  const preferredLanguage = parsedOAuth.preferredLanguage;
  let desktopLocalPort = parsedOAuth.desktopLocalPort;

  const stateFromQuery =
    typeof request.query.state === "string" ? request.query.state : "";
  let stateCsrf = stateFromQuery;
  let portFromEmbeddedState: number | null = null;
  const embeddedPort = /\.d(\d+)$/.exec(stateFromQuery);
  if (embeddedPort) {
    stateCsrf = stateFromQuery.slice(0, -embeddedPort[0].length);
    const p = Number.parseInt(embeddedPort[1] ?? "", 10);
    if (!Number.isNaN(p) && p >= 1024 && p <= 65_535) {
      portFromEmbeddedState = p;
    }
  }
  if (desktopLocalPort === null && portFromEmbeddedState !== null) {
    desktopLocalPort = portFromEmbeddedState;
  }

  if (!expectedState || stateCsrf !== expectedState) {
    logGoogleOAuth({
      outcome: "failure",
      step: "callback",
      reason: "state_mismatch",
      ...meta,
    });
    authLog.error(
      `${GOOGLE_OAUTH_LOG} callback: state mismatch (possible CSRF or stale session)`,
      {
        ...meta,
      },
    );
    const url = oauthFrontendRedirect(
      "login-error",
      { reason: "Invalid sign-in state. Please try again." },
      oauthSpaRedirectBase,
    );
    logGoogleOAuthRedirect({
      kind: "login-error",
      urlMasked: maskRedirectUrlForLog(url),
    });
    response.redirect(url);
    return;
  }

  try {
    authLog.info(
      `${GOOGLE_OAUTH_LOG} callback: exchanging authorization code for tokens`,
      {
        codeLength: code.length,
        statePreview: `${state.slice(0, 8)}…`,
        preferredLanguage,
      },
    );
    const googleAccess = await exchangeGoogleAuthorizationCode(code);
    authLog.info(
      `${GOOGLE_OAUTH_LOG} callback: fetching userinfo with access token`,
    );
    const profile = await fetchGoogleProfile(googleAccess);

    const session = await signInWithGoogle({
      email: profile.email,
      googleId: profile.googleId,
      name: profile.name,
      givenName: profile.givenName,
      familyName: profile.familyName,
      avatar: profile.avatar,
      preferredLanguage,
    });

    response.cookie(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      getCookieOptions(),
    );
    authLog.info("GET /auth/google/callback: session issued", {
      userId: session.user.id,
      email: session.user.email,
    });
    logGoogleOAuth({
      outcome: "success",
      step: "callback",
      email: session.user.email,
      userId: session.user.id,
      ...meta,
    });

    const redirectUrl =
      desktopLocalPort !== null
        ? `http://127.0.0.1:${desktopLocalPort}/oauth?token=${encodeURIComponent(session.accessToken)}`
        : oauthFrontendRedirect(
            "login-success",
            { token: session.accessToken },
            oauthSpaRedirectBase,
          );
    authLog.info(`${GOOGLE_OAUTH_LOG} callback: issuing HTTP redirect`, {
      redirectKind:
        desktopLocalPort !== null ? "desktop-localhost" : "login-success",
      maskedUrl: maskRedirectUrlForLog(redirectUrl),
    });
    logGoogleOAuthRedirect({
      kind: "login-success",
      urlMasked: maskRedirectUrlForLog(redirectUrl),
    });
    response.redirect(redirectUrl);
  } catch (error) {
    const message = userFacingOAuthCallbackError(error);
    const stack = error instanceof Error ? error.stack : undefined;
    authLog.warn("GET /auth/google/callback: failed", {
      message,
      raw: error instanceof Error ? error.message : String(error),
    });
    authLog.error(`${GOOGLE_OAUTH_LOG} callback: unhandled failure`, {
      userMessage: message,
      httpStatus: error instanceof HttpError ? error.statusCode : undefined,
      stack,
      rawError: error instanceof Error ? error.message : String(error),
      ...meta,
    });
    logGoogleOAuth({
      outcome: "failure",
      step: "callback",
      reason: message.slice(0, 500),
      httpStatus: error instanceof HttpError ? error.statusCode : undefined,
      ...meta,
    });
    const url = oauthFrontendRedirect(
      "login-error",
      { reason: message },
      oauthSpaRedirectBase,
    );
    logGoogleOAuthRedirect({
      kind: "login-error",
      urlMasked: maskRedirectUrlForLog(url),
    });
    response.redirect(url);
  }
}

export async function verifyEmailController(
  request: Request,
  response: Response,
) {
  const token =
    typeof request.query.token === "string" ? request.query.token.trim() : "";
  authLog.info("GET /verify-email", { hasToken: Boolean(token) });
  if (!token) {
    response
      .status(400)
      .send(
        renderVerificationHtml(
          "error",
          "Verification link is invalid",
          "The verification token is missing or malformed.",
        ),
      );
    return;
  }

  try {
    const result = await verifyEmailToken(token);
    response
      .status(200)
      .send(
        renderVerificationHtml(
          "success",
          "Email verified",
          `${result.email} is now verified. You can sign in with your email and password.`,
        ),
      );
  } catch (error) {
    if (error instanceof HttpError) {
      response
        .status(error.statusCode)
        .send(
          renderVerificationHtml("error", "Verification failed", error.message),
        );
      return;
    }
    throw error;
  }
}

/** GDPR Madde 20 — Kullanıcı verilerini JSON olarak dışa aktarır. */
export async function exportMyDataController(request: Request, response: Response) {
  const userId = request.authUser?.id;
  if (!userId) throw new HttpError(401, "Authentication required.");

  const { prisma } = await import("../../lib/prisma.js");

  const [user, operationLogs, downloadLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, name: true,
        plan: true, preferredLanguage: true, timezone: true, country: true,
        city: true, authProvider: true, isVerified: true,
        createdAt: true, lastLoginAt: true,
        invoiceType: true, billingCountryCode: true, billingPostalCode: true,
        companyName: true, taxOffice: true, isKvkkConsented: true,
        kvkkConsentedAt: true,
      },
    }),
    prisma.operationLog.findMany({
      where: { userId },
      select: { id: true, toolType: true, fileCount: true, totalFileSizeMB: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.downloadLog.findMany({
      where: { userId },
      select: { id: true, toolId: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) throw new HttpError(404, "User not found.");

  // Dışa aktarma isteğini denetim günlüğüne yaz
  await prisma.adminAuditLog.create({
    data: {
      userId,
      userEmail: user.email,
      action: "GDPR_DATA_EXPORT",
      summary: `User ${user.email} exported their personal data.`,
    },
  });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    gdprNote: "This export fulfils GDPR Article 20 (data portability). Sensitive fields (password hash, encryption keys) are excluded.",
    profile: user,
    operationHistory: operationLogs,
    downloadHistory: downloadLogs,
  };

  const filename = `nbpdf-data-export-${userId.slice(0, 8)}-${Date.now()}.json`;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  response.json(exportPayload);
}
