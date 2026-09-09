import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Sunucu tarafı kod denetimi.
 *
 * En kritik kural `no-floating-promises` DEĞİL (tip bilgisi gerektirir, yavaştır);
 * burada amaç ucuz ve kesin hataları yakalamak: kullanılmayan değişken, yanlış
 * karşılaştırma, erişilemeyen kod, yakalanan hatanın yutulması.
 *
 * Ödeme ve hak sayacı gibi para akışına dokunan yerlerde sessiz hatalar pahalıya
 * mal olduğu için denetim CI'da çalıştırılır (şimdilik bloklamadan).
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "prisma/**", "scripts/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Bastırma yorumlarını otomatik SİLME: bunlar bilinçli kararları belgeliyor.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        AbortSignal: "readonly",
        Response: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-undef": "off", // tip denetimi zaten yapıyor
      "preserve-caught-error": "warn",
      "no-useless-assignment": "warn",
    },
  },
);
