import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { initSentry } from "./lib/sentry.js";
initSentry();
import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureDefaultAdminUser } from "./lib/ensure-default-admin.js";
import { ensureAppSettingsRow } from "./lib/ensure-app-settings.js";
import { ensureToolRegistry } from "./lib/ensure-tool-registry.js";
import { prepareLogFile, logger } from "./lib/file-log.js";

await prepareLogFile();
await ensureDefaultAdminUser();
await ensureAppSettingsRow();
await ensureToolRegistry();

if (env.NODE_ENV === "production") {
  const iyzicoUri = (
    process.env.IYZICO_URI ||
    process.env.IYZICO_BASE_URL ||
    ""
  ).toLowerCase();
  if (iyzicoUri.includes("sandbox")) {
    logger.warn("server",
      "[UYARI] IYZICO_URI sandbox ortamına işaret ediyor! Üretimde https://api.iyzipay.com kullanın.",
    );
  }
  const jwtAccess = process.env.JWT_ACCESS_SECRET || "";
  if (jwtAccess.startsWith("local-dev-")) {
    logger.error("server",
      "[HATA] JWT_ACCESS_SECRET varsayılan geliştirme değerini kullanıyor! Üretimde güçlü bir rastgele değer set edin.",
    );
    process.exit(1);
  }
}

const keyPath = env.HTTPS_KEY_PATH;
const certPath = env.HTTPS_CERT_PATH;
const useTls = Boolean(keyPath && certPath);

function listenMessage() {
  const scheme = useTls ? "https" : "http";
  logger.info("server",
    `PDF PLATFORM auth API listening on ${scheme}://0.0.0.0:${env.PORT}`,
  );
}

function attachListenError(server: http.Server | https.Server) {
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.error("server",
        `[api] Port ${env.PORT} is already in use (EADDRINUSE). Stop the other process using this port or change PORT in web/api/.env.\n` +
          `[api] Fix: stop that process, or set PORT=4001 (or another port) in web/api/.env, then restart.`,
      );
      process.exit(1);
      return;
    }
    throw err;
  });
}

const activeServer = useTls
  ? (() => {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      return https.createServer({ key, cert }, app);
    })()
  : http.createServer(app);

// Büyük PDF işlemleri (split, merge) için server socket timeout'unu 15 dakikaya çıkar.
activeServer.setTimeout(15 * 60 * 1000);
// keepAliveTimeout Server'ın Keep-Alive socket'leri kapatmadan önce bekleme süresi.
activeServer.keepAliveTimeout = 16 * 60 * 1000;

attachListenError(activeServer);
activeServer.listen(env.PORT, listenMessage);

// ── Graceful shutdown ──────────────────────────────────────────────────────
// Render.com ve Kubernetes, pod'u kapatmadan önce SIGTERM gönderir.
// Mevcut isteklerin tamamlanmasına 10 saniye izin verilir; sonra process sonlanır.
function gracefulShutdown(signal: string) {
  logger.info("server", `${signal} received — starting graceful shutdown`);
  activeServer.close((err) => {
    if (err) {
      logger.error("server", `Error during shutdown: ${err.message}`);
      process.exit(1);
    }
    logger.info("server", "HTTP server closed. Exiting.");
    process.exit(0);
  });

  // Render.com graceful shutdown window: 10 saniye.
  setTimeout(() => {
    logger.warn("server", "Graceful shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
