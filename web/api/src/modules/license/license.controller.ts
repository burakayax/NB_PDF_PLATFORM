import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { getDesktopDeviceIdFromHeaders, isDesktopClient } from "../device/device.service.js";
import { authorizeDesktopOperation, validateDesktopLicense } from "./license.service.js";
import { desktopAuthorizeSchema } from "./license.schema.js";
import { logSuspiciousActivity } from "../../lib/app-logger.js";
import { prisma } from "../../lib/prisma.js";

/**
 * KNOWN LIMITATION: X-NB-Device-Id ve X-NB-Client-Type başlıkları istemci tarafından
 * gönderilmekte ve sunucu tarafında kriptografik olarak doğrulanmamaktadır.
 * Bu başlıklar teorik olarak taklit edilebilir (spoofing).
 * Kısa vadeli önlem: cihaz ID'si veritabanındaki kayıtlı cihazlarla karşılaştırılır;
 * şüpheli istekler loglanır. Uzun vadede sunucu tarafından imzalı cihaz token'ları
 * kullanılmalıdır (HMAC veya JWT tabanlı device attestation).
 */
async function validateDeviceIdOrLog(
  userId: string,
  deviceId: string | undefined,
  request: Request,
): Promise<void> {
  if (!deviceId) return;

  // Cihaz ID uzunluk/format kontrolü — beklenmedik değerleri logla
  if (deviceId.length < 10 || deviceId.length > 256) {
    logSuspiciousActivity({
      type: "suspicious_header",
      ip: request.ip ?? "unknown",
      path: request.path,
      method: request.method,
      detail: `Unusual X-NB-Device-Id length: ${deviceId.length}`,
    });
    return;
  }

  // Cihaz veritabanına kayıtlı değilse şüpheli istek olarak logla
  const deviceCount = await prisma.desktopDevice.count({
    where: { userId },
  });
  if (deviceCount === 0) {
    logSuspiciousActivity({
      type: "suspicious_header",
      ip: request.ip ?? "unknown",
      path: request.path,
      method: request.method,
      detail: `X-NB-Device-Id sent but no registered devices found for user ${userId}`,
    });
  }
}

function requireUserId(request: Request) {
  const userId = request.authUser?.id;
  if (!userId) {
    throw new HttpError(401, "Authentication is required.");
  }
  return userId;
}

/**
 * Desktop clients must send a non-empty X-NB-Device-Id; web callers omit it.
 */
function resolveDesktopDeviceIdForRequest(request: Request): string | undefined {
  if (!isDesktopClient(request.headers)) {
    return undefined;
  }
  const deviceId = getDesktopDeviceIdFromHeaders(request.headers);
  if (!deviceId) {
    throw new HttpError(400, "Desktop device identifier is required.");
  }
  return deviceId;
}

export async function validateLicenseController(request: Request, response: Response) {
  const userId = requireUserId(request);
  const deviceId = resolveDesktopDeviceIdForRequest(request);
  await validateDeviceIdOrLog(userId, deviceId, request);
  const result = await validateDesktopLicense(userId, deviceId);
  response.json(result);
}

/** Desktop-only gate (device header required). Web apps continue to use GET /license/validate. */
export async function checkLicenseController(request: Request, response: Response) {
  const userId = requireUserId(request);
  if (!isDesktopClient(request.headers)) {
    throw new HttpError(400, "GET /license/check is for desktop clients only. Use GET /license/validate from web.");
  }
  const deviceId = resolveDesktopDeviceIdForRequest(request);
  const result = await validateDesktopLicense(userId, deviceId);
  response.json(result);
}

export async function authorizeDesktopOperationController(request: Request, response: Response) {
  const userId = requireUserId(request);
  if (!isDesktopClient(request.headers)) {
    throw new HttpError(400, "This endpoint requires a desktop client (X-NB-Client-Type: desktop).");
  }
  const parsed = desktopAuthorizeSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Desktop authorization payload is invalid.");
  }

  const deviceId = resolveDesktopDeviceIdForRequest(request);
  await validateDeviceIdOrLog(userId, deviceId, request);
  const result = await authorizeDesktopOperation(userId, parsed.data, deviceId);
  response.json(result);
}
