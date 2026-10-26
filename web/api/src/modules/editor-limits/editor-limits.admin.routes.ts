/**
 * PDF Düzenle günlük hakları — yönetim uçları (`/api/admin/editor-limits`). Tamamı admin korumalı.
 * Değişiklik veritabanına yazılır; ek dağıtım gerekmez.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { logAdminAudit } from "../admin/admin-audit.service.js";
import {
  EDITOR_LIMITS_BOUNDS,
  EDITOR_LIMITS_DEFAULTS,
  readEditorLimits,
  writeEditorLimits,
} from "./editor-limits.config.js";

export const editorLimitsAdminRouter = Router();
editorLimitsAdminRouter.use(requireAdmin);

function actorOf(request: { authUser?: { id: string; email: string } }) {
  return { userId: request.authUser?.id ?? "", email: request.authUser?.email ?? "system" };
}

async function snapshot() {
  return { config: await readEditorLimits(), defaults: EDITOR_LIMITS_DEFAULTS, bounds: EDITOR_LIMITS_BOUNDS };
}

editorLimitsAdminRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await snapshot());
  }),
);

const b = EDITOR_LIMITS_BOUNDS;
const patchSchema = z
  .object({
    guest: z.number().int().min(b.min).max(b.max).optional(),
    free: z.number().int().min(b.min).max(b.max).optional(),
    starter: z.number().int().min(b.min).max(b.max).optional(),
  })
  .strict();

editorLimitsAdminRouter.put(
  "/",
  asyncHandler(async (request, response) => {
    const patch = patchSchema.parse(request.body);
    await writeEditorLimits(patch);
    await logAdminAudit(
      actorOf(request),
      "editor_limits.config",
      "editor.limits",
      "PDF Düzenle günlük hakları güncellendi",
      patch,
    );
    response.json(await snapshot());
  }),
);
