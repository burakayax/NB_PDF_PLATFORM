import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // Testlerde .env dosyası yoktur (CI). env.ts/zod tarafından zorunlu tutulan
    // ancak DB'yi etkilemeyen saf config değerlerine güvenli test varsayılanları
    // ver. DATABASE_URL / JWT_* / BILLING_ENCRYPTION_KEY CI ortamından gelir.
    env: {
      ADMIN_EMAIL: "admin@example.test",
      ROLE_ADMIN_EMAIL: "admin@example.test",
      EMAIL_USER: "ci@example.test",
      EMAIL_PASS: "ci-test-password",
    },
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
