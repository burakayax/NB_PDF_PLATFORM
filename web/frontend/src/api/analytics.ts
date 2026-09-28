import type { Language } from "../i18n/landing";
import { getSaasApiBase } from "./saasBase";
const SESSION_KEY = "nbpdf-analytics-session-id";

export type PageViewPayload = {
  view: string;
  path: string;
  sessionId: string;
  language: Language;
  referrer?: string;
};

export function getOrCreateSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

export type JourneyEventPayload = {
  name: string;
  toolId?: string;
  extra?: Record<string, string | number | boolean>;
};

/**
 * Kullanıcı yolculuğu (funnel) olayını backend'e yazar — bkz. `trackFunnelEvent`
 * (`lib/analytics.ts`). Fire-and-forget: UI hiçbir şekilde bunu beklemez, hata
 * yutulur (ölçüm asla kullanıcı akışını bozmamalı).
 */
export function trackJourneyEvent(payload: JourneyEventPayload, accessToken?: string | null) {
  try {
    void fetch(`${getSaasApiBase()}/api/analytics/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        ...payload,
        sessionId: getOrCreateSessionId(),
      }),
    }).catch(() => {
      /* ölçüm hatası kullanıcı akışını etkilemez */
    });
  } catch {
    /* private mod / fetch yok */
  }
}

export async function trackPageView(payload: Omit<PageViewPayload, "sessionId">, accessToken?: string | null) {
  await fetch(`${getSaasApiBase()}/api/analytics/page-view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({
      ...payload,
      sessionId: getOrCreateSessionId(),
    }),
  });
}
