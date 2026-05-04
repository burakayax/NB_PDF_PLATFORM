import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureDefaultAdminUser } from "./lib/ensure-default-admin.js";
import { ensureAppSettingsRow } from "./lib/ensure-app-settings.js";
import { ensureToolRegistry } from "./lib/ensure-tool-registry.js";
import { prepareLogFile } from "./lib/file-log.js";

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
    console.warn(
      "[UYARI] IYZICO_URI sandbox ortamına işaret ediyor! Üretimde https://api.iyzipay.com kullanın.",
    );
  }
  const jwtAccess = process.env.JWT_ACCESS_SECRET || "";
  if (jwtAccess.startsWith("local-dev-")) {
    console.error(
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
  console.log(
    `PDF PLATFORM auth API listening on ${scheme}://0.0.0.0:${env.PORT}`,
  );
}

function attachListenError(server: http.Server | https.Server) {
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[api] Port ${env.PORT} is already in use (EADDRINUSE). Stop the other process using this port or change PORT in web/api/.env.\n` +
          `[api] Fix: stop that process, or set PORT=4001 (or another port) in web/api/.env, then restart.`,
      );
      process.exit(1);
      return;
    }
    throw err;
  });
}

if (useTls) {
  const key = fs.readFileSync(keyPath);
  const cert = fs.readFileSync(certPath);
  const server = https.createServer({ key, cert }, app);
  attachListenError(server);
  server.listen(env.PORT, listenMessage);
} else {
  const server = http.createServer(app);
  attachListenError(server);
  server.listen(env.PORT, listenMessage);
}
