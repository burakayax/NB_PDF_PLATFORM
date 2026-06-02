import * as Sentry from "@sentry/react";

let _sentryInitialized = false;

/** Yalnızca errorMonitoring onayı verilmişse Sentry başlatılır (GDPR Madde 7). */
export function initSentry(hasErrorMonitoringConsent: boolean) {
  if (!hasErrorMonitoringConsent) return;
  if (_sentryInitialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

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

  _sentryInitialized = true;
}

export function reportErrorToSentry(error: unknown, context?: Record<string, unknown>) {
  if (!_sentryInitialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
