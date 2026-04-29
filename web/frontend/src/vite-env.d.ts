/// <reference types="vite/client" />

/** Vite `envPrefix`: `vite.config.ts` içinde `VITE_` ve `NEXT_PUBLIC_` ile eşleşen değişkenler bundle’a dahil edilir. */
interface ImportMetaEnv {
  /** Kamu kanonik kök (SEO); backend APP_BASE_URL ile aynı üretim alanı önerilir. */
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_SAAS_API_BASE?: string;
  readonly NEXT_PUBLIC_API_URL?: string;
  /**
   * true iken yerel SPA (localhost) üzerinden uzak NEXT_PUBLIC_API_URL / VITE_SAAS_API_BASE kullanılır.
   * Varsayılan false: dev’de uzak taban yok sayılıp Vite proxy (/api → local :4000) kullanılır.
   */
  readonly VITE_USE_REMOTE_SAAS_IN_DEV?: string;
  readonly VITE_PDF_PROXY_TARGET?: string;
  readonly VITE_SAAS_PROXY_TARGET?: string;
  readonly VITE_DISABLE_OBFUSCATION?: string;
  /** Google Analytics 4 Measurement ID (örn. G-XXXXXXXXXX). Placeholder ile GA yüklenmez. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
  /** When true at build-time, maintenance UI is forced on for this SPA bundle only (local .env); combined with API `MAINTENANCE_MODE`. */
  readonly VITE_MAINTENANCE_MODE?: string;
  /** true: robots.txt Disallow all + noindex meta (dev / preview; set false on production deploy when ready). */
  readonly VITE_BLOCK_SEARCH_INDEXING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
