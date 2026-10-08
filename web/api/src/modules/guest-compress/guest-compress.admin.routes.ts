/**
 * Misafir PDF Sıkıştır — yönetim uçları (`/api/admin/guest-compress`). Tamamı admin korumalı.
 *
 * Panelden yapılan değişiklik veritabanına yazılır; PDF servisi ~30 sn içinde alır
 * (deploy / ortam değişkeni gerekmez).
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { logAdminAudit } from "../admin/admin-audit.service.js";
import { planDefinitions } from "../subscription/subscription.config.js";
import {
  GUEST_COMPRESS_BOUNDS,
  GUEST_COMPRESS_DEFAULTS,
  isGuestCompressClosed,
  readGuestCompressConfig,
  writeGuestCompressConfig,
} from "./guest-compress.config.js";
import { getBridgeLastContact } from "./guest-compress.internal.js";
import { guestCompressToday } from "./guest-compress.usage.js";

export const guestCompressAdminRouter = Router();
guestCompressAdminRouter.use(requireAdmin);

function actorOf(request: { authUser?: { id: string; email: string } }) {
  return { userId: request.authUser?.id ?? "", email: request.authUser?.email ?? "system" };
}

async function snapshot() {
  const [config, today] = await Promise.all([readGuestCompressConfig(), guestCompressToday()]);
  const last = getBridgeLastContact();
  return {
    config,
    defaults: GUEST_COMPRESS_DEFAULTS,
    bounds: GUEST_COMPRESS_BOUNDS,
    closed: isGuestCompressClosed(config),
    today,
    /** Ücretsiz üyenin günlük hakkı — misafir hakkı bundan KÜÇÜK kalmalı (üyelik avantajı). */
    memberDailyLimit: planDefinitions.FREE.dailyLimit,
    bridge: {
      /** PDF servisi ile ortak anahtar tanımlı mı? Tanımsızsa sayaç PDF servisinin geçici diskinde tutulur. */
      secretConfigured: Boolean((process.env.INTERNAL_SERVICE_SECRET ?? "").trim()),
      /** Bu sunucu örneğine PDF servisinin son ulaştığı an (yoksa henüz hiç ulaşmadı / yeniden başladı). */
      lastContactAt: last ? last.toISOString() : null,
    },
  };
}

guestCompressAdminRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await snapshot());
  }),
);

const b = GUEST_COMPRESS_BOUNDS;
const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    dailyLimit: z.number().int().min(b.dailyLimit.min).max(b.dailyLimit.max).optional(),
    globalDailyLimit: z.number().int().min(b.globalDailyLimit.min).max(b.globalDailyLimit.max).optional(),
    maxMB: z.number().int().min(b.maxMB.min).max(b.maxMB.max).optional(),
  })
  .strict();

guestCompressAdminRouter.put(
  "/",
  asyncHandler(async (request, response) => {
    const patch = patchSchema.parse(request.body);
    await writeGuestCompressConfig(patch);
    await logAdminAudit(
      actorOf(request),
      "guest_compress.config",
      "guest.compress",
      "Misafir PDF Sıkıştır ayarları güncellendi",
      patch,
    );
    response.json(await snapshot());
  }),
);
