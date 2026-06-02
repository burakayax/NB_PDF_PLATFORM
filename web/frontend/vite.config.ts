import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JavaScriptObfuscator from "javascript-obfuscator";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const MISSING_ENV_MSG =
  ".env dosyası bulunamadı. Lütfen SETUP.md dosyasını kontrol edin.";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

/** Uretim çıktısında ek sıkıştırma (gerçek güvenlik değil; caydırıcı). */
function productionObfuscatePlugin(): Plugin {
  return {
    name: "nb-js-obfuscate",
    apply: "build",
    enforce: "post",
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith(".js")) {
        return null;
      }
      try {
        const result = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          simplify: true,
          stringArray: true,
          stringArrayEncoding: ["base64"],
          stringArrayThreshold: 0.5,
          identifierNamesGenerator: "hexadecimal",
          renameGlobals: false,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          selfDefending: false,
          debugProtection: false,
        });
        return { code: result.getObfuscatedCode(), map: null };
      } catch (err) {
        console.warn("[nb-js-obfuscate] chunk skipped:", chunk.fileName, err);
        return null;
      }
    },
  };
}

/**
 * Kök `npm run dev` pdf/api/ui süreçlerini paralel başlatır; ilk saniyelerde sağlık uçları henüz yanıt vermeyebilir.
 * Tek deneme kısa zaman aşımıyla yanlış uyarı üretir; bir süre yeniden deneyip yalnızca sürekli başarısızsa uyarı verilir.
 */
function warnIfBackendHealthUnreachable(opts: {
  pluginName: string;
  label: string;
  target: string;
  failureBanner: string;
}): Plugin {
  const base = opts.target.replace(/\/$/, "");
  const url = `${base}/api/health`;
  const initialDelayMs = 1200;
  const attemptTimeoutMs = 8000;
  const retryIntervalMs = 2000;
  const maxAttempts = 30;
  // Deneme
  return {
    name: opts.pluginName,
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        let attempt = 0;

        const tryOnce = async () => {
          attempt++;
          const ac = new AbortController();
          const timer = setTimeout(() => ac.abort(), attemptTimeoutMs);
          try {
            const res = await fetch(url, { signal: ac.signal });
            clearTimeout(timer);
            if (res.ok) {
              return;
            }
            console.warn(
              `[vite] ${opts.label} beklenmiyor: ${url} → HTTP ${res.status}`,
            );
          } catch {
            clearTimeout(timer);
          }

          if (attempt >= maxAttempts) {
            console.warn(opts.failureBanner);
            return;
          }
          setTimeout(() => {
            void tryOnce();
          }, retryIntervalMs);
        };

        setTimeout(() => {
          void tryOnce();
        }, initialDelayMs);
      });
    },
  };
}

/** PDF FastAPI (:8000); yalnızca frontend çalışıyorsa veya uvicorn geç açılıyorsa uyarır. */
function warnIfPdfApiUnreachable(pdfTarget: string): Plugin {
  return warnIfBackendHealthUnreachable({
    pluginName: "nb-warn-pdf-api",
    label: "PDF API",
    target: pdfTarget,
    failureBanner:
      "\n[vite] ─────────────────────────────────────────────────────\n" +
      "[vite] PDF API'ye ulaşılamıyor (" +
      pdfTarget +
      "). Bu pencerede yalnızca Vite çalışıyor olabilir veya `[pdf]` sürecinde Python hatası vardır.\n" +
      "[vite] PDF araçları için: proje kökünde `npm run dev` veya `node scripts/run-pdf-api.mjs`; `web/.venv` ve `pip install -r web/backend/requirements.txt` kontrol edin.\n" +
      "[vite] ─────────────────────────────────────────────────────\n",
  });
}

/** Kimlik Express API (:4000); paralel başlatmada gecikmeli dinlenebilir. */
function warnIfSaasApiUnreachable(saasTarget: string): Plugin {
  return warnIfBackendHealthUnreachable({
    pluginName: "nb-warn-saas-api",
    label: "Kimlik API",
    target: saasTarget,
    failureBanner:
      "\n[vite] ─────────────────────────────────────────────────────\n" +
      "[vite] Kimlik API'ye ulaşılamıyor (" +
      saasTarget +
      ").\n" +
      "[vite] `/api/auth/google` ve diğer kimlik istekleri bu yüzden proxy hatası verir.\n" +
      "[vite] Çözüm: `web/api` içinde `npm run dev` veya proje kökünde `npm run dev` (api+ui birlikte); `[api]` çıktısına bakın.\n" +
      "[vite] ─────────────────────────────────────────────────────\n",
  });
}

function saasProxyOptions(saasProxyTarget: string) {
  const target = saasProxyTarget;
  return {
    target,
    changeOrigin: true,
    configure(proxy: {
      on: (ev: string, fn: (...args: unknown[]) => void) => void;
    }) {
      proxy.on("error", (err: unknown, _req: unknown, res: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("\n[vite] Kimlik API proxy hatası:", message);
        console.error(`[vite] Hedef: ${target}`);
        console.error(
          "[vite] Google girişi için Express API çalışmalı: `web/api` → `npm run dev` veya kökte `npm run dev`.\n",
        );
        const sr = res as ServerResponse | undefined;
        if (sr && typeof sr.writeHead === "function" && !sr.headersSent) {
          const body =
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kimlik API</title></head><body>' +
            "<h1>Kimlik API'ye ulaşılamıyor</h1>" +
            `<p>Vite bu isteği <code>${target}</code> adresine iletemedi (ör. bağlantı reddedildi).</p>` +
            "<p><strong>Çözüm:</strong> Terminalde proje kökünde <code>npm run dev</code> çalıştırın veya ayrı bir pencerede <code>web/api</code> klasöründe <code>npm run dev</code> (varsayılan port 4000).</p>" +
            "<p><code>VITE_SAAS_PROXY_TARGET</code> farklı bir adrese işaret ediyorsa .env ile hedefi API’nin gerçek adresiyle eşleştirin.</p>" +
            "</body></html>";
          sr.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          sr.end(body);
        }
      });
    },
  };
}

export default defineConfig(({ command, mode, isPreview }) => {
  // `vite preview` de command === "serve" ile çalışır; ancak preview yalnızca
  // önceden derlenmiş dist/'i servis eder ve .env'e ihtiyaç duymaz. CI'da .env
  // bulunmadığından bu kontrol preview'ı process.exit(1) ile öldürüyordu
  // (E2E'de ERR_CONNECTION_REFUSED'ın kök nedeni). Sadece gerçek dev server'a uygula.
  if (
    command === "serve" &&
    !isPreview &&
    !fs.existsSync(path.join(frontendRoot, ".env"))
  ) {
    console.error(MISSING_ENV_MSG);
    process.exit(1);
  }

  const env = loadEnv(mode, frontendRoot, "");
  const pdfProxyTarget = (
    env.VITE_PDF_PROXY_TARGET || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
  const saasProxyTarget = (
    env.VITE_SAAS_PROXY_TARGET || "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
  /** Kimlik / abonelik Express API; `/api` PDF’e gitmeden önce eşleşmeli. */
  const saasProxy = saasProxyOptions(saasProxyTarget);
  const apiProxy = {
    target: pdfProxyTarget,
    changeOrigin: true,
    /** Büyük PDF indirmelerinde ve yavaş bağlantılarda proxy’nin erken kesmesini önler. */
    timeout: 900_000,
    proxyTimeout: 900_000,
  };
  const saasApiPrefixes = [
    "auth",
    "admin",
    "subscription",
    "payment",
    "fake-payment",
    "credit-checkout",
    "entitlement",
    "access",
    "contact",
    "analytics",
    "user",
    "device",
    "license",
    "errors",
    "public",
    "media",
    "billing",
    "team",
  ];

  const isProd = mode === "production";
  // Obfuscation removed: caused ~30% bundle size increase, broke source maps, provided zero real security
  // To opt-in to obfuscation set VITE_DISABLE_OBFUSCATION=false
  const disableObfuscation = env.VITE_DISABLE_OBFUSCATION !== "false";

  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    resolve: {
      alias: {
        "@": path.resolve(frontendRoot, "src"),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(command === "serve"
        ? [
            warnIfPdfApiUnreachable(pdfProxyTarget),
            warnIfSaasApiUnreachable(saasProxyTarget),
          ]
        : []),
      ...(isProd && !disableObfuscation ? [productionObfuscatePlugin()] : []),
    ],
    server: {
      port: 5173,
      proxy: {
        ...Object.fromEntries(
          saasApiPrefixes.map((p) => [`/api/${p}`, saasProxy]),
        ),
        "/api": apiProxy,
      },
    },
    preview: {
      port: 4173,
      proxy: {
        ...Object.fromEntries(
          saasApiPrefixes.map((p) => [`/api/${p}`, saasProxy]),
        ),
        "/api": apiProxy,
      },
    },
    build: {
      minify: "esbuild",
      target: "es2020",
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/pdfjs-dist")) {
              return "pdfjs";
            }
            if (id.includes("node_modules/react-dom")) {
              return "react-dom";
            }
            if (id.includes("node_modules/react/")) {
              return "react";
            }
          },
        },
      },
      ...(isProd
        ? {
            esbuild: {
              drop: ["console", "debugger"],
              legalComments: "none",
            },
          }
        : {}),
    },
  };
});
