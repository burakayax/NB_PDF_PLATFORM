import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    tracesSampleRate: 0.2,
    // Render deploy'un git commit'i — hatalar "hangi sürümle geldi" diye etiketlenir.
    // Proje adı öneki CI'daki deploy kaydıyla (nb-auth-api@<sha>) birebir eşleşmeli.
    // Gelen istekler otomatik "oturum" sayılır (Node SDK varsayılanı) → Crash Free Sessions.
    release: process.env.RENDER_GIT_COMMIT ? `nb-auth-api@${process.env.RENDER_GIT_COMMIT}` : undefined,
  });
}

export { Sentry };
