// Sentry yalnızca onay verilince VE dinamik import ile yüklenir.
// Böylece @sentry/react başlangıç paketinden çıkar (initial JS küçülür, ana iş parçacığı yükü azalır).
import type * as SentryNS from "@sentry/react";

let _sentry: typeof SentryNS | null = null;
let _initPromise: Promise<void> | null = null;

/** Yalnızca errorMonitoring onayı verilmişse Sentry başlatılır (GDPR Madde 7). */
export function initSentry(hasErrorMonitoringConsent: boolean): Promise<void> {
  if (!hasErrorMonitoringConsent) return Promise.resolve();
  if (_initPromise) return _initPromise;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return Promise.resolve();

  _initPromise = import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.2,
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.05,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
        ],
      });
      _sentry = Sentry;
    })
    .catch((err) => {
      console.warn("[sentry] yüklenemedi:", err);
    });

  return _initPromise;
}

export function reportErrorToSentry(error: unknown, context?: Record<string, unknown>) {
  if (!_sentry) return;
  _sentry.captureException(error, context ? { extra: context } : undefined);
}
