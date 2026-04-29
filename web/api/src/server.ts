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

const keyPath = env.HTTPS_KEY_PATH;
const certPath = env.HTTPS_CERT_PATH;
const useTls = Boolean(keyPath && certPath);

function listenMessage() {
  const scheme = useTls ? "https" : "http";
  console.log(`NB PDF PLARTFORM auth API listening on ${scheme}://0.0.0.0:${env.PORT}`);
}

function attachListenError(server: http.Server | https.Server) {
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[api] Port ${env.PORT} is already in use (EADDRINUSE). Another API or Docker container may be bound to it.\n` +
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
