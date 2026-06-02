/**
 * Kimlik doğrulama akışı E2E testleri.
 * Gerçek API bağlantısı gerektirmez — mock server veya test ortamı gerekebilir.
 * Bu testler UI davranışını (form validasyonu, hata mesajları) doğrular.
 */
import { test, expect } from "./fixtures";

test.describe("Auth Akışı — Form Validasyonu", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test("Giriş sayfası yüklendiğinde e-posta ve şifre alanları görünür", async ({ page }) => {
    await page.goto("/?view=login");
    // E-posta alanı
    await expect(page.getByLabel(/e-posta|email/i).first()).toBeVisible({ timeout: 5000 });
    // Şifre alanı
    await expect(page.getByLabel(/şifre|password/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("Boş form gönderildiğinde giriş butonu çalışmaz (HTML5 required)", async ({ page }) => {
    await page.goto("/?view=login");
    const submitButton = page.getByRole("button", { name: /giriş|sign in|login/i }).first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // URL değişmemeli — hâlâ login sayfasında
      await expect(page).toHaveURL(/login|view=login/, { timeout: 2000 });
    }
  });

  test("Geçersiz e-posta formatı hata gösterir", async ({ page }) => {
    await page.goto("/?view=login");
    const emailInput = page.getByLabel(/e-posta|email/i).first();
    if (await emailInput.isVisible()) {
      await emailInput.fill("geçersiz-email");
      await page.getByRole("button", { name: /giriş|sign in|login/i }).first().click();
      // Tarayıcı HTML5 validasyonu veya uygulama hata mesajı
      const isInvalid = await emailInput.evaluate((el) => !(el as HTMLInputElement).validity.valid);
      expect(isInvalid).toBe(true);
    }
  });
});

test.describe("Kayıt Sayfası — Form Validasyonu", () => {
  test("Kayıt sayfası gerekli alanları içeriyor", async ({ page }) => {
    await page.goto("/?view=register");
    await expect(page.getByLabel(/e-posta|email/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/şifre|password/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Landing Page — SEO ve Erişilebilirlik", () => {
  test("Landing sayfası yüklendiğinde başlık mevcut", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PDF/i, { timeout: 10000 });
  });

  test("Lang attribute doğru ayarlı", async ({ page }) => {
    await page.goto("/");
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(["tr", "en"]).toContain(lang);
  });

  test("OG meta etiketleri mevcut", async ({ page }) => {
    await page.goto("/");
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toBeTruthy();
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toBeTruthy();
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute("content");
    expect(twitterCard).toBe("summary_large_image");
  });

  test("robots.txt doğru kısıtlıyor", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(response?.status()).toBe(200);
    const body = await response?.text();
    expect(body).toContain("Disallow: /workspace");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Sitemap:");
  });
});
