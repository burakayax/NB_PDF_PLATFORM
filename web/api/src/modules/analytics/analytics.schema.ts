import { z } from "zod";

export const pageViewSchema = z.object({
  view: z.string().trim().min(1).max(80),
  path: z.string().trim().min(1).max(160),
  sessionId: z.string().trim().min(8).max(64),
  language: z.enum(["tr", "en"]).optional(),
  referrer: z.string().trim().max(500).optional(),
});

export type PageViewInput = z.infer<typeof pageViewSchema>;

/**
 * Kullanıcı yolculuğu (funnel) olayı — misafir/üye hangi araçta başarılı oldu,
 * üye-ol/ödeme ekranına ne oldu gibi olayların admin panelinde okunabilir bir
 * hikayeye dönüştürülebilmesi için backend'e de yazılır (bkz. lib/analytics.ts
 * `trackFunnelEvent`). `extra` küçük, serbest bir bağlam nesnesidir (plan, step…).
 */
export const journeyEventSchema = z.object({
  sessionId: z.string().trim().min(8).max(64),
  name: z.string().trim().min(1).max(60),
  toolId: z.string().trim().min(1).max(60).optional(),
  extra: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type JourneyEventInput = z.infer<typeof journeyEventSchema>;
