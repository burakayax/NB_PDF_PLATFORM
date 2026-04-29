/**
 * Kök `npm run dev` içinde UI kanalı: mümkünse PDF FastAPI ayakta olunca Vite’ı başlatır.
 * Windows’ta `fetch(127.0.0.1)` bazen takılabildiği için `node:http` + `setTimeout` kullanılır.
 * Toplam bekleme üst sınırı aşılırsa Vite yine de başlar (site her zaman açılır).
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const feDir = path.join(root, "web", "frontend");

function loadFrontendEnvPort() {
  const envPath = path.join(feDir, ".env");
  if (!fs.existsSync(envPath)) {
    return null;
  }
  try {
    const rawFile = fs.readFileSync(envPath, "utf8");
    const m = rawFile.match(/^\s*VITE_PDF_PROXY_TARGET\s*=\s*(\S+)/m);
    if (!m?.[1]) {
      return null;
    }
    const targetRaw = m[1].trim().replace(/^["']|["']$/g, "");
    try {
      const u = new URL(targetRaw.includes("://") ? targetRaw : `http://${targetRaw}`);
      return u.port ? parseInt(u.port, 10) : 8000;
    } catch {
      const portMatch = targetRaw.match(/:(\d+)\/?$/);
      return portMatch ? parseInt(portMatch[1], 10) : null;
    }
  } catch {
    return null;
  }
}

const pdfPortStr =
  (process.env.PDF_API_PORT || "").trim() ||
  (() => {
    const fromEnv = loadFrontendEnvPort();
    return fromEnv != null ? String(fromEnv) : "8000";
  })();
const healthUrl = `http://127.0.0.1:${pdfPortStr}/api/health`;

/** Tek istekte en fazla kaç ms beklenir (socket takılırsa kesilir). */
const requestMs = Number(process.env.VITE_WAIT_FOR_PDF_FETCH_MS || "2500");
/** PDF için poll aralığı (ms). */
const intervalMs = Number(process.env.VITE_WAIT_FOR_PDF_MS || "400");
/** Bu süre dolunca Vite koşulsuz başlar (varsayılan ~14 s). */
const maxWaitMs = Number(process.env.VITE_WAIT_FOR_PDF_MAX_MS || "14000");

function pdfHealthyOnce() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(v);
    };

    let u;
    try {
      u = new URL(healthUrl);
    } catch {
      done(false);
      return;
    }

    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: "GET",
        headers: { Connection: "close", Accept: "*/*" },
      },
      (res) => {
        res.resume();
        done(res.statusCode === 200);
      },
    );

    req.on("error", () => done(false));
    req.setTimeout(requestMs, () => {
      req.destroy();
      done(false);
    });
    req.end();

    setTimeout(() => {
      if (!settled) {
        req.destroy();
        done(false);
      }
    }, requestMs + 250);
  });
}

async function main() {
  let ok = false;

  if (maxWaitMs > 0) {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      if (await pdfHealthyOnce()) {
        ok = true;
        console.log(`[run-vite-when-ready] PDF API hazır (${healthUrl}). Vite başlatılıyor…`);
        break;
      }
      if (Date.now() + intervalMs >= deadline) {
        break;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  } else {
    console.warn("[run-vite-when-ready] PDF beklemesi kapalı (VITE_WAIT_FOR_PDF_MAX_MS<=0); doğrudan Vite.");
  }

  if (!ok && maxWaitMs > 0) {
    console.warn(
      `[run-vite-when-ready] PDF API ${maxWaitMs}ms içinde doğrulanamadı (${healthUrl}). Vite yine de başlatılıyor.`,
    );
  }

  const isWin = process.platform === "win32";
  const npmCmd = isWin ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["run", "dev", "--prefix", "web/frontend"], {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error("[run-vite-when-ready]", e);
  process.exit(1);
});
