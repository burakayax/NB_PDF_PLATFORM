/**
 * Çerez onayı E2E testleri.
 * Platform: Playwright / Chromium
 * Gereklilik: Uygulama http://localhost:5173'te çalışıyor olmalı.
 */
import { test, expect } from "./fixtures";

test.describe("Çerez Onayı Akışı", () => {
  test.beforeEach(async ({ page }) => {
    // Her test izole bir context'te çalışır → localStorage zaten boştur
    // (yeni ziyaretçi). Burada `addInitScript` ile temizlik YAPMA: "Tümünü
    // Kabul Et" analitiği açıp sayfayı yeniden yüklediğinden, kalıcı init
    // script reload'da tekrar çalışıp yeni kaydedilen onayı silerdi.
    await page.goto("/");
  });

  test("İlk ziyarette çerez banner'ı görünür", async ({ page }) => {
    // Banner görünene kadar bekle
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });

  test("Tümünü Kabul Et banner'ı kapatır", async ({ page }) => {
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Tümünü Kabul Et|Accept All/i }).first().click();

    // Banner kapanmalı
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // localStorage'a kaydedilmeli
    const consent = await page.evaluate(() => localStorage.getItem("nbpdf-cookie-consent-v3"));
    expect(consent).toBeTruthy();
    const parsed = JSON.parse(consent!);
    expect(parsed.decided).toBe(true);
    expect(parsed.analytics).toBe(true);
  });

  test("Yalnızca Zorunlu seçeneği analytics=false kaydeder", async ({ page }) => {
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Yalnızca Zorunlu|Necessary Only/i }).first().click();

    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    const consent = await page.evaluate(() => localStorage.getItem("nbpdf-cookie-consent-v3"));
    const parsed = JSON.parse(consent!);
    expect(parsed.decided).toBe(true);
    expect(parsed.analytics).toBe(false);
    expect(parsed.marketing).toBe(false);
  });

  test("Tercihleri Özelleştir ekranı açılır ve kaydeder", async ({ page }) => {
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: /Tercihleri Özelleştir|Customize/i }).first().click();

    // Özelleştirme ekranı açılmalı
    await expect(page.getByLabel(/Analitik|Analytics/i).first()).toBeVisible();

    // Pazarlama'yı işaretle
    await page.getByLabel(/Pazarlama|Marketing/i).first().check();

    await page.getByRole("button", { name: /Tercihleri Kaydet|Save Preferences/i }).first().click();

    const consent = await page.evaluate(() => localStorage.getItem("nbpdf-cookie-consent-v3"));
    const parsed = JSON.parse(consent!);
    expect(parsed.decided).toBe(true);
    expect(parsed.marketing).toBe(true);
  });

  test("Onay verildikten sonra banner tekrar gösterilmez", async ({ page }) => {
    // Onay ver
    await page.addInitScript(() => {
      localStorage.setItem(
        "nbpdf-cookie-consent-v3",
        JSON.stringify({ decided: true, necessary: true, analytics: true, marketing: false }),
      );
    });
    await page.goto("/");

    // Banner görünmemeli
    const dialog = page.getByRole("dialog").filter({ hasText: /çerez|cookie/i });
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
