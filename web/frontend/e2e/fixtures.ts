import { test as base, expect } from "@playwright/test";

/**
 * E2E testleri statik frontend'i (vite preview) doğrular; çalışan bir backend
 * yoktur. Uygulama açılışta `/api/public/runtime` çağrısını bekler ve sonuç
 * gelene kadar tam ekran `RuntimeBootstrapSplash` gösterir. Backend yokken
 * build'e gömülü API tabanına yapılan istek CI'da TCP zaman aşımına kadar
 * askıda kalır → splash sonsuza dek açık kalır ve tüm tıklamaları engeller.
 *
 * Tüm `/api` çağrılarını engelleyerek uygulamanın varsayılan payload ile
 * (maintenanceMode=false) deterministik ve hızlı şekilde render olmasını
 * sağlarız. Bu testler zaten yalnızca UI davranışını doğrular.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/api/**", (route) => route.abort());
    await use(page);
  },
});

export { expect };
