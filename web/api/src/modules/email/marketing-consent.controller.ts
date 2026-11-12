/**
 * Hesap ayarlarından tanıtım e-postası izni (`/api/auth/marketing-consent`).
 *
 * NEDEN VAR: İzin yalnızca kayıt formunda alınıyordu; kullanıcı sonradan
 * onaylayamıyor ya da geri alamıyordu. Her değişiklik kanıt defterine
 * GERÇEK tarihle yazılır (kanal: "settings") — İYS'ye bildirim bu kayıttan yapılır.
 */

import type { Request, Response } from "express";
import { z } from "zod";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { recordMarketingConsent, SETTINGS_CONSENT_TEXT } from "./marketing-consent.service.js";

const bodySchema = z.object({ granted: z.boolean() });

async function currentState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      preferredLanguage: true,
      marketingConsent: true,
      marketingConsentAt: true,
      marketingUnsubscribedAt: true,
    },
  });
  if (!user) throw new HttpError(404, "Kullanıcı bulunamadı.");
  return user;
}

export async function getMarketingConsentController(request: Request, response: Response) {
  if (!request.authUser) throw new HttpError(401, "Oturum gerekli.");
  const u = await currentState(request.authUser.id);
  response.json({
    granted: u.marketingConsent && u.marketingUnsubscribedAt === null,
    grantedAt: u.marketingConsentAt?.toISOString() ?? null,
  });
}

export async function setMarketingConsentController(request: Request, response: Response) {
  if (!request.authUser) throw new HttpError(401, "Oturum gerekli.");
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Geçersiz istek.");

  const userId = request.authUser.id;
  const { granted } = parsed.data;
  const u = await currentState(userId);
  const already = u.marketingConsent && u.marketingUnsubscribedAt === null;

  // Aynı durumu tekrar kaydetmek defterde gürültü yaratır.
  if (granted === already) {
    response.json({ granted: already, grantedAt: u.marketingConsentAt?.toISOString() ?? null });
    return;
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: granted
      ? { marketingConsent: true, marketingConsentAt: now, marketingUnsubscribedAt: null }
      : { marketingConsent: false, marketingUnsubscribedAt: now },
  });

  await recordMarketingConsent({
    userId,
    email: u.email,
    granted,
    source: "settings",
    consentText: granted ? SETTINGS_CONSENT_TEXT[u.preferredLanguage === "tr" ? "tr" : "en"] : null,
    ip: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  });

  response.json({ granted, grantedAt: granted ? now.toISOString() : null });
}
