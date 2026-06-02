import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// CI'da üretim derlemesi `vite preview` ile servis edilir; yerelde dev server.
const PREVIEW_PORT = 4173;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (isCI ? `http://localhost:${PREVIEW_PORT}` : "http://localhost:5173");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Sunucu yaşam döngüsünü Playwright yönetir: hazır olana kadar bekler ve
  // testler bitince kapatır. (Manuel `&` ile başlatılan süreç CI adımını
  // sonsuza kadar açık tutuyordu.) CI'da derlenmiş çıktı preview edilir.
  webServer: isCI
    ? {
        command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
