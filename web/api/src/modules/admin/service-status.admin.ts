import type { Request, Response } from "express";
import { loadServiceStatus } from "../../lib/service-health.js";
import { HttpError } from "../../lib/http-error.js";

/** GET /api/admin/service-status?days=7 — bileşen bazında çalışma oranı, kesinti/sinyal-yok dönemleri, 5xx özeti. */
export async function adminServiceStatusController(req: Request, res: Response): Promise<void> {
  const days = Number.parseInt(String(req.query["days"] ?? "7"), 10);
  if (!Number.isFinite(days) || days < 1 || days > 90) throw new HttpError(400, "days 1-90 arasında olmalı.");
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 3600 * 1000);
  res.json(await loadServiceStatus(from, to));
}
