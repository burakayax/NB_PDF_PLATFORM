/// <reference types="vite/client" />

/** Vite `envPrefix`: `vite.config.ts` içinde `VITE_` ve `NEXT_PUBLIC_` ile eşleşen değişkenler bundle’a dahil edilir. */
interface ImportMetaEnv {
  /** Kamu kanonik kök (SEO); backend APP_BASE_URL ile aynı üretim alanı önerilir. */
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_SAAS_API_BASE?: string;
  readonly NEXT_PUBLIC_API_URL?: string;
  readonly VITE_PDF_PROXY_TARGET?: string;
  readonly VITE_SAAS_PROXY_TARGET?: string;
  readonly VITE_DISABLE_OBFUSCATION?: string;
  /** Google Analytics 4 Measurement ID (örn. G-XXXXXXXXXX). Placeholder ile GA yüklenmez. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
