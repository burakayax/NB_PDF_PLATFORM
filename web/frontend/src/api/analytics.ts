import type { Language } from "../i18n/landing";
import { getSaasApiBase } from "./saasBase";
import { isAnalyticsConsentGranted } from "../hooks/useCookieConsent";
const SESSION_KEY = "nbpdf-analytics-session-id";

export type PageViewPayload = {
  view: string;
  path: string;
  sessionId: string;
  language: Language;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

/**
 * ZİYARETÇİ NEREDEN GELDİ — reklam/paylaşım bağlantısındaki etiketler.
 *
 * Bağlantıda `utm_source` / `utm_medium` / `utm_campaign` varsa onlar; yoksa reklam tıklama kimliğinden
 * (gclid → Google reklamı, fbclid → Facebook/Instagram, ttclid → TikTok, msclkid → Bing) türetilir.
 * Uygulama sayfalar arasında geçerken adres çubuğundaki etiketler silinir; bu yüzden sayfa ilk
 * yüklendiğinde okunup bu sekmenin oturumuna (sessionStorage) yazılır ve her sayfa kaydına eklenir.
 * Hiçbir kişisel veri içermez.
 */
const SOURCE_KEY = "nbpdf-visit-source";
type VisitSource = { utmSource?: string; utmMedium?: string; utmCampaign?: string };

function readSourceFromUrl(search: string): VisitSource {
  const q = new URLSearchParams(search);
  const clean = (v: string | null) => (v && v.trim() ? v.trim().slice(0, 100) : undefined);
  const source = clean(q.get("utm_source"));
  const medium = clean(q.get("utm_medium"));
  const campaign = clean(q.get("utm_campaign"));
  if (source || medium || campaign) return { utmSource: source, utmMedium: medium, utmCampaign: campaign };
  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid")) return { utmSource: "google", utmMedium: "cpc" };
  if (q.get("fbclid")) return { utmSource: "facebook", utmMedium: "paid" };
  if (q.get("ttclid")) return { utmSource: "tiktok", utmMedium: "paid" };
  if (q.get("msclkid")) return { utmSource: "bing", utmMedium: "cpc" };
  return {};
}

function captureVisitSource(): void {
  if (typeof window === "undefined") return;
  try {
    const found = readSourceFromUrl(window.location.search);
    if (found.utmSource || found.utmMedium || found.utmCampaign) {
      window.sessionStorage.setItem(SOURCE_KEY, JSON.stringify(found));
    }
  } catch {
    /* özel mod / depolama kapalı */
  }
}
// Modül yüklenirken, uygulama adresi değiştirmeden ÖNCE okunur.
captureVisitSource();

function getVisitSource(): VisitSource {
  try {
    const raw = window.sessionStorage.getItem(SOURCE_KEY);
    return raw ? (JSON.parse(raw) as VisitSource) : {};
  } catch {
    return {};
  }
}

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
  // Analitik onayı yoksa HİÇBİR şey gönderilmez ve cihaza kalıcı oturum kimliği yazılmaz.
  if (!isAnalyticsConsentGranted()) return;
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
  if (!isAnalyticsConsentGranted()) return;
  await fetch(`${getSaasApiBase()}/api/analytics/page-view`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({
      ...getVisitSource(),
      ...payload,
      sessionId: getOrCreateSessionId(),
    }),
  });
}
