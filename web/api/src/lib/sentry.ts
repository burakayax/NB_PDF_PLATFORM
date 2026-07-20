import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.2,
    // Render deploy'un git commit'i — hatalar "hangi sürümle geldi" diye etiketlenir.
    release: process.env.RENDER_GIT_COMMIT || undefined,
  });
}

export { Sentry };
