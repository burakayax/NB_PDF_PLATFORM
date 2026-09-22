import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Ön yüz kod denetimi.
 *
 * Amaç, biçim tartışması değil GERÇEK hata yakalamaktır. En değerli kural
 * `react-hooks/exhaustive-deps`: ekranın kendini ne zaman tazeleyeceğini
 * belirleyen bağımlılık listesi eksik kaldığında ekranda eski veri kalır ya da
 * sonsuz döngü oluşur; bu elle fark edilmesi çok zor bir hata sınıfıdır.
 *
 * Kurallar UYARI seviyesinde başlatıldı: mevcut kod tabanını tek seferde
 * kırmadan, yeni yazılan kodda sinyal vermesi için. Zamanla hata seviyesine
 * çekilebilir.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "public/**",
      "scripts/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  {
    // Bastırma yorumlarını otomatik SİLME: bunlar bilinçli kararları belgeliyor.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",

      },
    },
    rules: {
      // Kullanılmayan değişkenler: baştaki alt çizgi ile bilinçli olarak susturulabilir.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // Boş yakalama blokları bu kod tabanında bilinçli bir kalıp (sessiz geçiş).
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-undef": "off", // tip denetimi zaten yapıyor

      // React kuralları: mevcut kod tabanında ~170 bulgu var. Tek seferde
      // düzeltmek riskli olduğu için UYARI seviyesinde başlatıldı — yeni yazılan
      // kodda hemen görünür, eski kod deploy'u bloklamaz. Bunlar teker teker
      // gözden geçirilip kapatıldıkça "error" seviyesine çekilmelidir.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "no-useless-escape": "warn",
      "no-useless-assignment": "warn",
      "preserve-caught-error": "warn",
    },
  },
);
