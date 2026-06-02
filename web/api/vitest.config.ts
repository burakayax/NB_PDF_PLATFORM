import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Yalnızca testlerin çalıştırdığı dosyaları ölç. Vitest 4 ile `include`
      // glob'u verildiğinde eşleşen TÜM dosyalar (test edilmeyenler %0) sayılır
      // ve eşik gerçekçi olmaktan çıkar. `all: false` + include yok → kapı
      // yalnızca gerçekten test edilen kod için anlamlı kalır.
      all: false,
      exclude: ["src/__tests__/**", "src/**/*.d.ts"],
      // Eşikler, test edilen kod için regresyon korumasıdır.
      // Yeni testlerle kademeli olarak yükseltilmeli.
      thresholds: {
        lines: 25,
        functions: 25,
        branches: 15,
        statements: 25,
      },
    },
  },
});
