import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the entire process.
 *
 * Stored on `globalThis` so that `tsx watch` / HMR reloads reuse the same
 * instance instead of spawning a fresh one (and a fresh pool) per reload,
 * which would silently leak DB connections during development.
 *
 * The one-shot startup log records `process.cwd()` and the resolved
 * `DATABASE_URL`. It is deliberately printed the first time this module
 * is imported so that "which SQLite file did we actually connect to?"
 * questions are answerable from the server log alone.
 */

const globalForPrisma = globalThis as unknown as {
  __nbPrisma?: PrismaClient;
  __nbPrismaLogged?: boolean;
};

function resolveSqliteAbsolutePath(urlValue: string | undefined): string | null {
  if (!urlValue || !urlValue.startsWith("file:")) {
    return null;
  }
  const rest = urlValue.slice("file:".length).replace(/^\/+/, "");
  if (/^[A-Za-z]:[\\/]/.test(rest) || rest.startsWith("/")) {
    return rest;
  }
  return null;
}

export const prisma = globalForPrisma.__nbPrisma ?? new PrismaClient();

if (!globalForPrisma.__nbPrisma) {
  globalForPrisma.__nbPrisma = prisma;
}

if (!globalForPrisma.__nbPrismaLogged) {
  globalForPrisma.__nbPrismaLogged = true;
  const url = process.env.DATABASE_URL;
  const absolute = resolveSqliteAbsolutePath(url);
  // Başlangıç logu — hangi veritabanı dosyasına bağlandığımızı kaydeder.
  // Üretimde url'den şifre çıkarılır.
  const safeUrl = url
    ? url.replace(/:([^:@/]+)@/, ":***@")
    : "(unset)";
  import("./file-log.js").then(({ appendLogLine }) => {
    appendLogLine(
      JSON.stringify({
        ts: new Date().toISOString(),
        kind: "startup",
        message: "prisma client initialized",
        cwd: process.cwd(),
        database_url: safeUrl,
        ...(absolute ? { absolute_path: absolute } : {}),
      }),
    );
  }).catch(() => {
    // file-log başlatılamadıysa log kaybı kabul edilebilir
  });
}
