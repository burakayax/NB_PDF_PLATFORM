import { test, expect } from "@playwright/test";
import sharp from "sharp";

/**
 * HEDEF BOYUT MODU GERÇEKTEN HEDEFİN ALTINA İNMELİ.
 *
 * Bu iddia kullanıcıyı doğrudan etkiler: "60 KB" diyip 90 KB dosya veren bir araç,
 * kullanıcıyı başvuru ekranında hataya sokar. Kalite araması tarayıcının kendi
 * kodlayıcısına dayandığı için yalnızca gerçek tarayıcıda doğrulanabilir.
 */

/** Sıkıştırılması zor, gürültülü ve büyük bir JPEG üretir. */
async function buyukJpeg(): Promise<Buffer> {
  const w = 1600;
  const h = 1200;
  const px = Buffer.alloc(w * h * 3);
  // Rastgele gürültü: düz renk kolay sıkışır ve testi anlamsız kılar.
  for (let i = 0; i < px.length; i += 1) px[i] = (i * 7919) % 256;
  return sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();
}

test("hedef boyut modu dosyayı istenen sınırın altına indiriyor", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showSaveFilePicker");
  });

  await page.goto("/tools/gorsel-sikistir");
  await expect(page).toHaveURL(/gorsel-sikistir|compress-image/);

  const kaynak = await buyukJpeg();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "vesikalik.jpg",
    mimeType: "image/jpeg",
    buffer: kaynak,
  });

  // Hedef boyut moduna geç ve 50 KB seç.
  await page.getByRole("button", { name: /Hedef boyuta göre|To a target size/i }).click();
  await page.getByRole("button", { name: /^50 KB$/ }).click();

  await page.getByRole("button", { name: /^Sıkıştır$|^Compress$/ }).click();

  const indir = page.getByRole("button", { name: /^İndir$|^Download$/ });
  await expect(indir).toBeVisible({ timeout: 30_000 });

  // Hedefin tutturulduğu AÇIKÇA yazmalı.
  await expect(page.getByText(/Hedef tutturuldu|Target met/i)).toBeVisible();

  // Kullanılan kalite kullanıcıya söylenmeli (dürüstlük şartı).
  // İki nokta şart: sayfadaki SSS metni de "quality used" ifadesini içeriyor,
  // aranan ise sonuç ekranındaki "Kullanılan kalite: %42 — …" satırı.
  await expect(page.getByText(/(?:Kullanılan kalite|Quality used):/)).toBeVisible();

  const indirmePromise = page.waitForEvent("download");
  await indir.click();
  const dosya = await indirmePromise;

  const yol = await dosya.path();
  const { statSync } = await import("node:fs");
  const boyut = statSync(yol).size;
  console.log(`kaynak=${kaynak.length} bayt, cikti=${boyut} bayt`);

  expect(boyut).toBeLessThanOrEqual(50 * 1024);
  expect(boyut).toBeGreaterThan(0);
});
