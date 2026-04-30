/**
 * FastAPI PDF servisini (uvicorn) başlatır; çalışma dizini `web/` olmalıdır.
 * Önce `web/.venv` içindeki Python kullanılır; yoksa sistem `python` / `python3` denenir.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const webDir = path.join(root, "web");
const isWin = process.platform === "win32";

function resolvePython() {
  const venvCandidates = isWin
    ? [path.join(webDir, ".venv", "Scripts", "python.exe")]
    : [
        path.join(webDir, ".venv", "bin", "python3"),
        path.join(webDir, ".venv", "bin", "python"),
      ];
  for (const p of venvCandidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return isWin ? "python" : "python3";
}

const prod = process.argv.includes("--prod");
const python = resolvePython();
const backendDir = path.join(webDir, "backend");

const importCheck = spawnSync(python, ["-c", "from app.main import app"], {
  cwd: backendDir,
  encoding: "utf8",
  env: process.env,
});
if (importCheck.status !== 0) {
  console.error("[run-pdf-api] app.main yüklenemedi (PDF API başlatılamaz).");
  console.error(importCheck.stderr || importCheck.stdout || "");
  console.error(
    "[run-pdf-api] Proje kökünde çalıştırın: web\\.venv\\Scripts\\python.exe -m pip install -r web\\backend\\requirements.txt",
  );
  console.error("[run-pdf-api] veya: npm run install-all");
  process.exit(1);
}

const noReload =
  process.env.PDF_API_NO_RELOAD === "1" ||
  process.env.PDF_API_NO_RELOAD === "true";
const port = (process.env.PDF_API_PORT || "8000").trim() || "8000";
const workersRaw = (process.env.PDF_UVICORN_WORKERS || "1").trim();
let uvicornWorkers = parseInt(workersRaw, 10);
if (!Number.isFinite(uvicornWorkers) || uvicornWorkers < 1) {
  uvicornWorkers = 1;
}
if (uvicornWorkers > 64) {
  uvicornWorkers = 64;
}
const args = [
  "-m",
  "uvicorn",
  "app.main:app",
  "--app-dir",
  "backend",
  "--host",
  "127.0.0.1",
  "--port",
  port,
];
const keepAlive = (process.env.PDF_UVICORN_TIMEOUT_KEEP_ALIVE || "300").trim();
if (keepAlive && keepAlive !== "0") {
  args.push("--timeout-keep-alive", keepAlive);
}
if (uvicornWorkers > 1) {
  args.push("--workers", String(uvicornWorkers));
}
const useReload = !prod && !noReload && uvicornWorkers === 1;
if (useReload) {
  args.push("--reload");
} else if (!prod && !noReload && uvicornWorkers > 1) {
  console.warn(
    "[run-pdf-api] PDF_UVICORN_WORKERS>1 iken --reload kullanılamaz; tek işlemci geliştirme için PDF_UVICORN_WORKERS=1 bırakın.",
  );
}

console.log(`[run-pdf-api] ${python}`);
console.log(
  `[run-pdf-api] http://127.0.0.1:${port}/api/health — bu adres yalnızca bu pencere açıkken çalışır; kapatırsanız PDF API durur.`,
);
if (port !== "8000") {
  console.log(
    "[run-pdf-api] Farklı port kullanılıyor; web/frontend/.env içinde VITE_PDF_PROXY_TARGET=http://127.0.0.1:" +
      port +
      " ayarlayın.",
  );
}

const pdfApiEnv = { ...process.env };
if (!pdfApiEnv.NB_SAAS_API_BASE?.trim()) {
  pdfApiEnv.NB_SAAS_API_BASE = "http://127.0.0.1:4000";
}
/** Yerel ``npm run dev``: FastAPI ``saas_session_ok`` Node’a takılmadan inspect yapabilsin (saas_gate.py). Üretim ``--prod`` ile ayarlanmaz. */
if (!prod) {
  const e = (pdfApiEnv.ENV || pdfApiEnv.ENVIRONMENT || "").trim().toLowerCase();
  if (!e) {
    pdfApiEnv.ENV = "development";
    pdfApiEnv.ENVIRONMENT = "development";
    console.log(
      "[run-pdf-api] ENV=development — yerelde inspect-pdf Node oturum kontrolünü atlayabilir (Vercel üretiminde asla).",
    );
  }
}

const child = spawn(python, args, {
  cwd: webDir,
  stdio: "inherit",
  env: pdfApiEnv,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
