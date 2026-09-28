import type { Request, Response } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { adminJourneyQuerySchema, adminJourneySummaryQuerySchema } from "./journey.schema.js";
import { getJourneyFunnelSummary, listJourneySessions } from "./journey.service.js";

export async function adminJourneySessionsController(request: Request, response: Response) {
  const parsed = adminJourneyQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }
  const { days, limit, cursor, onlyGuests } = parsed.data;

  const result = await listJourneySessions({
    days,
    limit,
    onlyGuests,
    cursor: cursor ? new Date(cursor) : undefined,
  });

  response.json(result);
}

export async function adminJourneySummaryController(request: Request, response: Response) {
  const parsed = adminJourneySummaryQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  }
  const summary = await getJourneyFunnelSummary(parsed.data.days);
  response.json(summary);
}
