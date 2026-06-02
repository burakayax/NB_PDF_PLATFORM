import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Yalnızca testlerin çalıştırdığı dosyaları ölç. Vitest 4 ile `include`
      // glob'u verildiğinde eşleşen TÜM dosyalar (test edilmeyenler %0) sayılır
      // ve eşik gerçekçi olmaktan çıkar. `all: false` + include yok → kapı
      // yalnızca gerçekten test edilen kod için anlamlı kalır.
      all: false,
      exclude: ["src/__tests__/**"],
      // Eşikler, test edilen kod için regresyon korumasıdır (mevcut taban ~%30).
      // Yeni testlerle kademeli olarak %40+'a çıkarılmalı.
      thresholds: {
        lines: 25,
        functions: 25,
        branches: 15,
        statements: 25,
      },
    },
  },
});
