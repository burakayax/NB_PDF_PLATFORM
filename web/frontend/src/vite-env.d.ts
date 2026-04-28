/// <reference types="vite/client" />

/** Vite `envPrefix`: `vite.config.ts` içinde `VITE_` ve `NEXT_PUBLIC_` ile eşleşen değişkenler bundle’a dahil edilir. */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_SAAS_API_BASE?: string;
  readonly NEXT_PUBLIC_API_URL?: string;
  readonly VITE_PDF_PROXY_TARGET?: string;
  readonly VITE_SAAS_PROXY_TARGET?: string;
  readonly VITE_DISABLE_OBFUSCATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
