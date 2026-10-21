/**
 * ARAÇ BAZINDA DOSYA İŞLEME TABLOSU — gizlilik metnindeki tablonun TEK kaynağı.
 *
 * Her araç şu üç yerden birine girer:
 *  • "device" — dosya tarayıcıdan çıkmaz (sunucuya yüklenmez).
 *  • "server" — dosya işlem için sunucuya yüklenir.
 *  • "ai"     — dosya yüklenmez; cihazda çıkarılan METİN sunucuya ve yapay zekâ sağlayıcısına gider.
 *
 * `device` grubu `lib/onDeviceTools.ts` ile BİREBİR aynı olmak zorundadır
 * (`__tests__/toolProcessing.test.ts` denetler). Böylece gizlilik metni ile araç ekranındaki
 * "cihazında çalışır" rozeti birbirinden ayrışamaz.
 *
 * SAKLAMA SÜRELERİ (koddan doğrulandı):
 *  • Yüklenen dosya: işlem biter bitmez geçici klasörden silinir (web/backend core/operations.py
 *    cleanup_path, core/jobs.py).
 *  • Çıktı dosyası: indirebilmeniz için sonuç deposunda en fazla 24 saat tutulur; depo
 *    otomatik silme kuralı S3_RESULT_TTL_HOURS=24 (render.yaml). Yerel diskte 30 dakika.
 * Bu süreler değişirse BURADAKİ sabitler ve gizlilik metni birlikte güncellenmelidir.
 */

export const OUTPUT_RETENTION_HOURS = 24;

/** [id, trAd, enAd, nerede, trNot, enNot] */
const ROWS = [
  // ── Cihazda ──
  ["merge", "PDF Birleştir", "Merge PDF", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["split", "PDF Böl", "Split PDF", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["rotate-pdf", "PDF Döndür", "Rotate PDF", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["delete-pages", "Sayfa Sil", "Delete Pages", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["organize-pdf", "Sayfa Sırala", "Reorder Pages", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["image-to-pdf", "Görsel → PDF", "Image to PDF", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["pdf-imzala", "PDF İmzala", "Sign PDF", "device", "", ""],
  ["pdf-yorumla", "PDF Yorumla", "Annotate PDF", "device", "", ""],
  ["pdf-kesit-al", "PDF Kesit Al", "PDF Snip", "device", "", ""],
  ["gorsel-sikistir", "Görsel Sıkıştır", "Compress Image", "device", "", ""],
  ["gorsel-boyutlandir", "Görsel Boyutlandır", "Resize Image", "device", "", ""],
  ["belge-tara", "Belge Tarayıcı", "Document Scanner", "device", "«Hesabıma kaydet» dersen tarama hesabında saklanır", "Scans are stored in your account only if you choose “Save to my account”"],
  ["aranabilir-pdf", "Aranabilir PDF (OCR)", "Searchable PDF (OCR)", "device", "", ""],
  ["taranmis-pdf-ocr", "Taranmış PDF → Metin (OCR)", "Scanned PDF to Text (OCR)", "device", "", ""],
  ["form-doldur", "Form Doldur", "Fill Form", "device", "", ""],
  ["ustveri-temizle", "Üstveri Temizle", "Clean Metadata", "device", "", ""],
  ["sayfa-duzeni", "Sayfa Düzeni", "Page Layout", "device", "", ""],
  ["udf-to-pdf", "UDF → PDF", "UDF to PDF", "device", "", ""],
  ["ai-fotograf-studyosu", "Fotoğraf Stüdyosu", "Photo Studio", "device", "Yapay zekâ modelleri tarayıcıda çalışır; fotoğraf cihazdan çıkmaz", "AI models run in the browser; the photo never leaves your device"],
  ["cv-olustur", "CV Oluştur", "CV Maker", "device", "", ""],
  // ── Sunucuda ──
  ["compress", "PDF Sıkıştır", "Compress PDF", "server", "", ""],
  ["pdf-to-word", "PDF → Word", "PDF to Word", "server", "", ""],
  ["word-to-pdf", "Word → PDF", "Word to PDF", "server", "", ""],
  ["pdf-to-excel", "PDF → Excel", "PDF to Excel", "server", "", ""],
  ["excel-to-pdf", "Excel → PDF", "Excel to PDF", "server", "", ""],
  ["pdf-to-ppt", "PDF → PowerPoint", "PDF to PowerPoint", "server", "", ""],
  ["ppt-to-pdf", "PowerPoint → PDF", "PowerPoint to PDF", "server", "", ""],
  ["pdf-to-image", "PDF → Görsel", "PDF to Image", "server", "", ""],
  ["html-to-pdf", "HTML → PDF", "HTML to PDF", "server", "", ""],
  ["pdf-to-text", "PDF → Metin", "PDF to Text", "server", "", ""],
  ["encrypt", "PDF Şifrele", "Encrypt PDF", "server", "", ""],
  ["unlock-pdf", "PDF Şifre Kaldır", "Unlock PDF", "server", "", ""],
  ["watermark", "Filigran Ekle", "Add Watermark", "server", "", ""],
  ["page-numbers", "Sayfa Numarası", "Page Numbers", "server", "", ""],
  ["extract-images", "Görselleri Çıkar", "Extract Images", "server", "", ""],
  ["pdf-to-pdfa", "PDF → PDF/A", "PDF to PDF/A", "server", "", ""],
  ["grayscale-pdf", "Gri Tonlama", "Grayscale", "server", "", ""],
  ["resize-pdf", "PDF Boyutlandır", "Resize PDF", "server", "", ""],
  ["flip-pdf", "Sayfaları Çevir", "Flip Pages", "server", "", ""],
  ["alternate-mix-pdf", "Serpiştir", "Interleave", "server", "", ""],
  ["deskew-pdf", "Eğri Tarama Düzeltme", "Deskew PDF", "server", "", ""],
  ["flatten-pdf", "PDF Düzleştir", "Flatten PDF", "server", "", ""],
  ["repair-pdf", "PDF Onar", "Repair PDF", "server", "", ""],
  ["hassas-veri-gizle", "Hassas Veri Gizle", "Redact Sensitive Data", "server", "Yapay zekâ ile tespit seçilirse metin yapay zekâ sağlayıcısına da gider", "If you pick AI detection, the text also goes to the AI provider"],
  ["pdf-duzenle", "PDF Düzenle", "Edit PDF", "server", "Metin tanıma (OCR) cihazda yapılır", "Text recognition (OCR) runs on your device"],
  ["imza-iste", "İmza İste", "Request Signature", "server", "Belge ve imzalı kopya sen silene kadar saklanır; imza bağlantısı 14 gün geçerli", "The document and signed copy are kept until you delete them; the signing link is valid for 14 days"],
  // ── Yapay zekâ ──
  ["pdf-ozetle", "PDF Özetle", "Summarize PDF", "ai", "", ""],
  ["pdf-sohbet", "PDF ile Sohbet", "Chat with PDF", "ai", "", ""],
  ["pdf-ceviri", "PDF Çeviri", "Translate PDF", "ai", "", ""],
  ["pdf-karsilastir", "PDF Karşılaştır", "Compare PDFs", "ai", "", ""],
  ["pdf-veri-cikar", "Veri Çıkar", "Extract Data", "ai", "", ""],
  ["ai-toplu-islem", "Toplu Yapay Zekâ", "Batch AI", "ai", "", ""],
  ["sozlesme-denetci", "Sözleşme Denetçisi", "Contract Auditor", "ai", "", ""],
];

export const TOOL_PROCESSING = ROWS.map(([id, nameTr, nameEn, where, noteTr, noteEn]) => ({
  id,
  nameTr,
  nameEn,
  where,
  noteTr,
  noteEn,
}));

const H = OUTPUT_RETENTION_HOURS;

const WHERE_TR = {
  device: "Tarayıcında (cihazda)",
  server: "Sunucuda",
  ai: "Metin sunucuda + yapay zekâ sağlayıcısında",
};
const WHERE_EN = {
  device: "In your browser (on device)",
  server: "On our server",
  ai: "Text on our server + AI provider",
};
const UPLOAD_TR = {
  device: "Yüklenmez",
  server: "İşlem biter bitmez silinir",
  ai: "Dosya yüklenmez; cihazda çıkarılan metin işlenir, saklanmaz",
};
const UPLOAD_EN = {
  device: "Not uploaded",
  server: "Deleted as soon as processing ends",
  ai: "File not uploaded; text extracted on device is processed, not stored",
};
const OUTPUT_TR = {
  device: "Sunucuda hiç oluşmaz",
  server: `En fazla ${H} saat, sonra otomatik silinir`,
  ai: "Sonuç sunucuda saklanmaz",
};
const OUTPUT_EN = {
  device: "Never created on our server",
  server: `At most ${H} hours, then deleted automatically`,
  ai: "Result is not stored on our server",
};

const clean = (s) => String(s).replace(/\|/g, "/");

/** Gizlilik metni için "| a | b |" biçiminde tablo satırları (başlık dahil). */
export function toolProcessingTableLines(lang) {
  const tr = lang === "tr";
  const header = tr
    ? "| Araç | Nerede işlenir | Yüklediğin dosya | Çıktı dosyası | Not |"
    : "| Tool | Where it is processed | Your uploaded file | Output file | Note |";
  const lines = [header];
  for (const t of TOOL_PROCESSING) {
    const w = t.where;
    lines.push(
      `| ${clean(tr ? t.nameTr : t.nameEn)} | ${tr ? WHERE_TR[w] : WHERE_EN[w]} | ${tr ? UPLOAD_TR[w] : UPLOAD_EN[w]} | ${tr ? OUTPUT_TR[w] : OUTPUT_EN[w]} | ${clean(tr ? t.noteTr : t.noteEn) || "—"} |`,
    );
  }
  return lines;
}
