import { describe, it, expect } from "vitest";
import { ON_DEVICE_SEO_TOOLS } from "../components/tools/GuestSeoToolPage";
import { TOOL_SLUGS } from "../seo/seoContent.mjs";

/**
 * "DOSYAN CİHAZINDAN ÇIKMAZ" İDDİASI DOĞRU OLMALI.
 *
 * Araç sayfasındaki güven rozetleri bu listeye bakar. Listeye sunucuda çalışan
 * bir araç eklenirse sayfa, dosyanın hiç yüklenmediğini söyler — bu bir gizlilik
 * yanlış beyanıdır ve kullanıcı buna güvenerek hassas belge yükler.
 *
 * Bu yüzden sunucuya iş gönderen araçlar burada AÇIKÇA yasaklanır: biri listeye
 * eklenmeye çalışılırsa test düşer.
 */

/** Dosyayı ya da metni sunucuya gönderen araçlar — asla "cihazda" sayılamaz. */
const SUNUCUYA_GIDENLER = [
  "pdf-duzenle", // gerçek metin değişimi sunucuda
  "pdf-ozetle",
  "pdf-sohbet",
  "pdf-veri-cikar",
  "pdf-ceviri",
  "ai-toplu-islem",
  "pdf-karsilastir",
  "hassas-veri-gizle",
  "imza-iste", // imza isteği karşı tarafa iletilir
  "compress",
  "pdf-to-word",
  "word-to-pdf",
  "pdf-to-excel",
  "excel-to-pdf",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "unlock-pdf",
  "encrypt",
  "repair-pdf",
  "html-to-pdf",
];

describe("cihazda işleme iddiası", () => {
  it("sunucuda çalışan hiçbir araç cihazda sayılmıyor", () => {
    const yanlis = SUNUCUYA_GIDENLER.filter((s) => ON_DEVICE_SEO_TOOLS.has(s));
    expect(yanlis).toEqual([]);
  });

  it("listedeki her araç gerçekten var olan bir araç", () => {
    const tanimsiz = [...ON_DEVICE_SEO_TOOLS].filter((s) => !TOOL_SLUGS.includes(s));
    expect(tanimsiz).toEqual([]);
  });

  it("liste boş değil", () => {
    expect(ON_DEVICE_SEO_TOOLS.size).toBeGreaterThan(5);
  });
});
