import type { OrgRole, UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { logSuspiciousActivity } from "../lib/app-logger.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { resolveRoleFromEmail } from "../lib/role-policy.js";

function tokenRole(payload: { email: string }): UserRole {
  return resolveRoleFromEmail(payload.email);
}

function readBearerToken(request: Request) {
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
}

const BEARER_CHALLENGE = 'Bearer realm="api"';

export function requireAuth(request: Request, response: Response, next: NextFunction): void;
export function requireAuth(): (request: Request, response: Response, next: NextFunction) => void;
export function requireAuth(
  request?: Request,
  response?: Response,
  next?: NextFunction,
): ((request: Request, response: Response, next: NextFunction) => void) | void {
  // Called as requireAuth() factory form
  if (!request) {
    return (req: Request, res: Response, n: NextFunction) => {
      requireAuthImpl(req, res, n);
    };
  }
  // Called as direct middleware requireAuth (old style)
  requireAuthImpl(request, response!, next!);
}

function requireAuthImpl(request: Request, response: Response, next: NextFunction) {
  const token = readBearerToken(request);
  if (!token) {
    response
      .status(401)
      .set("WWW-Authenticate", BEARER_CHALLENGE)
      .json({ message: "Authentication is required." });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    request.authUser = {
      id: payload.sub,
      email: payload.email,
      plan: payload.plan,
      role: tokenRole(payload),
      orgRole: (payload.orgRole as OrgRole) ?? "OWNER",
      organizationId: payload.organizationId ?? null,
    };
    next();
  } catch {
    const ip = request.ip || request.socket?.remoteAddress;
    logSuspiciousActivity({
      type: "invalid_jwt",
      ip,
      path: request.originalUrl?.split("?")[0],
      method: request.method,
      userAgent: request.headers["user-agent"] as string | undefined,
      detail: "Bearer present but verify failed",
    });
    response
      .status(401)
      .set("WWW-Authenticate", BEARER_CHALLENGE)
      .json({ message: "Authentication token is invalid or expired." });
  }
}

export function attachOptionalAuth(request: Request, _response: Response, next: NextFunction) {
  const token = readBearerToken(request);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    request.authUser = {
      id: payload.sub,
      email: payload.email,
      plan: payload.plan,
      role: tokenRole(payload),
      orgRole: (payload.orgRole as OrgRole) ?? "OWNER",
      organizationId: payload.organizationId ?? null,
    };
  } catch {
    // optional auth: invalid token doesn't block the request
  }

  next();
}
