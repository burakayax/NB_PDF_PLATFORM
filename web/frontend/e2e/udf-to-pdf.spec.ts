import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";

/**
 * UDF → PDF aracı GERÇEK tarayıcıda uçtan uca.
 *
 * Birim testler ayrıştırma ve çizimi kilitliyor; burada kontrol edilen, misafir
 * kullanıcının /tools/udf-to-pdf adresine gidip gerçekten bir dosya çevirip
 * indirebilmesi — yani rota bağlantısı, tembel yükleme ve font indirmesi.
 */

/** Gerçek UYAP çıktısıyla aynı iskelette bir .udf üretir. */
function sampleUdf(): Buffer {
  const text = "Sayın Hâkimliğe,Müvekkilim adına iş bu dilekçeyi sunarım.";
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
<content><![CDATA[${text}]]></content>
<properties><pageFormat leftMargin="42.5" rightMargin="28.3" topMargin="14.1" bottomMargin="14.1" paperOrientation="1" /></properties>
<elements resolver="hvl-default">
<paragraph Alignment="1" LeftIndent="0.0" RightIndent="0.0"><content startOffset="0" length="16" family="Times New Roman" size="12" bold="true" /></paragraph>
<paragraph Alignment="3" LeftIndent="0.0" RightIndent="0.0"><content startOffset="16" length="41" family="Times New Roman" size="12" /></paragraph>
</elements>
<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>
</template>`;
  return Buffer.from(zipSync({ "content.xml": strToU8(xml) }));
}

test("misafir kullanıcı UDF dosyasını PDF olarak indirebiliyor", async ({ page }) => {
  // Sonuç paneli, varsa tarayıcının "farklı kaydet" penceresini kullanır; başsız
  // tarayıcıda o pencere açılamaz ve indirme olayı hiç doğmaz. Yeteneği kapatıp
  // klasik indirme yoluna düşürüyoruz — kullanıcıların çoğunun gördüğü yol da bu.
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "showSaveFilePicker");
  });

  await page.goto("/tools/udf-to-pdf");

  // Sayfa gerçekten araç sayfası olarak açılmalı (login'e atmamalı).
  await expect(page).toHaveURL(/\/tools\/udf-to-pdf$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/UDF/i);

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "dilekce.udf",
    mimeType: "application/octet-stream",
    buffer: sampleUdf(),
  });

  await expect(page.getByText("dilekce.udf")).toBeVisible();

  const convert = page.getByRole("button", { name: /PDF'e çevir|Convert to PDF/i });
  await expect(convert).toBeEnabled();
  await convert.click();

  // Ortak sonuç paneli açılmalı.
  const download = page.getByRole("button", { name: /^İndir$|^Download$/ });
  await expect(download).toBeVisible({ timeout: 20_000 });

  // Belgenin metni gerçekten çözülmüş mü — Türkçe harfler dahil.
  await expect(page.getByText("Sayın Hâkimliğe")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await download.click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe("dilekce.pdf");
});
