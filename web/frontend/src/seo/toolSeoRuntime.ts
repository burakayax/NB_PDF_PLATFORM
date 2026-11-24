/**
 * Araç SEO metinlerine tarayıcıda erişim — AĞIR veri (~330 KB, seoToolData.mjs) ana sayfa açılışında
 * yüklenmesin diye gerektiğinde indirilir.
 *
 *  - Ana sayfa ("/" ve "/en"): açılışta İNDİRİLMEZ; ilk çizimden sonra arka planda indirilir.
 *  - Diğer tüm adresler (araç sayfaları, çalışma alanı…): uygulama çizilmeden ÖNCE indirilir (main.tsx),
 *    böylece "bu araç var mı" kontrolleri hiçbir zaman boş veriyle çalışmaz.
 *  - Yüklenmemişken `getToolSeo` null döner; yüklenince `useToolSeoReady()` kullanan bileşenler yeniden çizilir.
 *
 * Node betikleri ve testler bu dosyayı kullanmaz; seoContent.mjs ikisini birlikte verir.
 */
import { useSyncExternalStore } from "react";
import type { SeoLang, ToolSeoCopy } from "./seoContent.mjs";

type ToolSeoModule = typeof import("./seoToolData.mjs");

let loaded: ToolSeoModule | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Ağır araç SEO verisini indirir (tekrar çağrılırsa aynı sözü döndürür). Hata olursa yeniden denenebilir. */
export function loadToolSeo(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!pending) {
    pending = import("./seoToolData.mjs")
      .then((mod) => {
        loaded = mod;
        listeners.forEach((fn) => fn());
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export function toolSeoReady(): boolean {
  return loaded !== null;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Veri yüklenince bileşenin yeniden çizilmesini sağlar; true = hazır. */
export function useToolSeoReady(): boolean {
  return useSyncExternalStore(subscribe, toolSeoReady, () => false);
}

export function getToolSeo(slug: string, language: SeoLang): ToolSeoCopy | null {
  return loaded ? loaded.getToolSeo(slug, language) : null;
}

export function getRelatedToolLinks(slug: string, language: SeoLang = "tr"): Array<{ slug: string; label: string }> {
  return loaded ? loaded.getRelatedToolLinks(slug, language) : [];
}

export function getGuideSlugsForTool(slug: string): string[] {
  return loaded ? loaded.getGuideSlugsForTool(slug) : [];
}

export function getToolGuide(slug: string, lang: string): ReturnType<ToolSeoModule["getToolGuide"]> {
  return loaded ? loaded.getToolGuide(slug, lang) : null;
}

/** Ana sayfa mı? (Yalnızca bu adreslerde ağır veri açılışta beklenmez.) */
export function isLandingPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/en" || pathname === "/en/";
}
