/**
 * Hata izleme — yönetim uçları (`/api/admin/autoheal`). Tamamı admin korumalı.
 */
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";
import { logAdminAudit } from "../admin/admin-audit.service.js";
import { AUTOHEAL_DEFAULTS, SEVERITIES, readAutoHealConfig, writeAutoHealConfig } from "./autoheal.config.js";
import { readAutoHealState, runTriage, setIncidentStatus } from "./autoheal.service.js";

export const autoHealAdminRouter = Router();
autoHealAdminRouter.use(requireAdmin);

function actorOf(request: { authUser?: { id: string; email: string } }) {
  return { userId: request.authUser?.id ?? "", email: request.authUser?.email ?? "system" };
}

async function snapshot() {
  const [config, state] = await Promise.all([readAutoHealConfig(), readAutoHealState()]);
  return {
    config,
    defaults: AUTOHEAL_DEFAULTS,
    lastRunAt: state.lastRunAt,
    noise: state.noise,
    noiseSince: state.noiseSince,
    incidents: state.incidents,
  };
}

autoHealAdminRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await snapshot());
  }),
);

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    emailMinSeverity: z.enum(SEVERITIES as unknown as [string, ...string[]]).optional(),
  })
  .strict();

autoHealAdminRouter.put(
  "/",
  asyncHandler(async (request, response) => {
    const patch = patchSchema.parse(request.body);
    await writeAutoHealConfig(patch as Parameters<typeof writeAutoHealConfig>[0]);
    await logAdminAudit(actorOf(request), "autoheal.config", "autoheal.config", "Hata izleme ayarları güncellendi", patch);
    response.json(await snapshot());
  }),
);

autoHealAdminRouter.post(
  "/incidents/:id/status",
  asyncHandler(async (request, response) => {
    const { status } = z.object({ status: z.enum(["open", "ignored", "resolved"]) }).parse(request.body);
    const id = String(request.params.id ?? "");
    const inc = await setIncidentStatus(id, status);
    if (!inc) throw new HttpError(404, "Olay bulunamadı.");
    await logAdminAudit(actorOf(request), "autoheal.incident", id, `Hata olayı: ${status}`, { status });
    response.json(await snapshot());
  }),
);

/** Elle analiz turu başlatır (beklemeden sonuç görmek için). */
autoHealAdminRouter.post(
  "/run",
  asyncHandler(async (_request, response) => {
    await runTriage();
    response.json(await snapshot());
  }),
);
