/**
 * CİHAZDA ÇALIŞAN ARAÇLAR — tek kaynak.
 *
 * Bir aracın dosyayı sunucuya gönderip göndermediği, kullanıcıya gösterdiğimiz
 * gizlilik iddiasını belirler. Yanlış listeye giren araç, kullanıcıya "dosyan
 * cihazından çıkmaz" diyerek hassas belge yüklemesine yol açar — bu yüzden liste
 * `__tests__/onDeviceClaims.test.ts` ile denetlenir.
 *
 * İki liste var çünkü iki ayrı soruya cevap veriyorlar:
 *  • ON_DEVICE_SEO_TOOLS — araç SEO sayfasının başındaki gizlilik rozeti
 *  • ON_DEVICE_TOOLS — yükleme panelindeki "cihazında çalışır" rozeti; buna
 *    misafirde/çalışma alanında tarayıcıda işlenen yapısal araçlar da dahildir
 *    (birleştir, böl, döndür… — bunların ayrı bir SEO sayfası yoktur).
 */

export const ON_DEVICE_SEO_TOOLS: ReadonlySet<string> = new Set([
  "pdf-imzala",
  "pdf-yorumla",
  "pdf-kesit-al",
  "gorsel-sikistir",
  "gorsel-boyutlandir",
  "belge-tara",
  "aranabilir-pdf",
  "taranmis-pdf-ocr",
  "form-doldur",
  "ustveri-temizle",
  "sayfa-duzeni",
  "udf-to-pdf",
]);

/** Yapısal araçlar — pdf-lib ile tarayıcıda işlenir, sunucuya dosya gitmez. */
const ON_DEVICE_STRUCTURAL = [
  "merge",
  "split",
  "rotate-pdf",
  "delete-pages",
  "organize-pdf",
  "image-to-pdf",
] as const;

export const ON_DEVICE_TOOLS: ReadonlySet<string> = new Set([
  ...ON_DEVICE_SEO_TOOLS,
  ...ON_DEVICE_STRUCTURAL,
]);

export function isOnDeviceTool(id: string): boolean {
  return ON_DEVICE_TOOLS.has(id);
}
