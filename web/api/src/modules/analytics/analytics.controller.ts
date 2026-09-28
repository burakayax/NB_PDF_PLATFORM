import type { Request, Response } from "express";
import { HttpError } from "../../lib/http-error.js";
import { journeyEventSchema, pageViewSchema } from "./analytics.schema.js";
import { recordJourneyEvent, recordPageView } from "./analytics.service.js";

export async function pageViewController(request: Request, response: Response) {
  const parsed = pageViewSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Page view payload is invalid.");
  }

  const result = await recordPageView(parsed.data, {
    userId: request.authUser?.id,
    userAgent: request.headers["user-agent"],
  });

  response.status(202).json(result);
}

export async function journeyEventController(request: Request, response: Response) {
  const parsed = journeyEventSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Event payload is invalid.");
  }

  const result = await recordJourneyEvent(parsed.data, {
    userId: request.authUser?.id,
  });

  response.status(202).json(result);
}
