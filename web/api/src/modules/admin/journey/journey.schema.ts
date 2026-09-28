import { z } from "zod";

export const adminJourneyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().trim().min(1).optional(),
  onlyGuests: z.coerce.boolean().default(false),
});

export type AdminJourneyQuery = z.infer<typeof adminJourneyQuerySchema>;

export const adminJourneySummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
