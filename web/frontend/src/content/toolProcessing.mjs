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
  ["image-to-pdf", "Görselden PDF'e", "Image to PDF", "device", "80 MB üstü veya parolalı dosyada sunucu kullanılır", "Over 80 MB or password-protected files use the server"],
  ["pdf-imzala", "PDF İmzala", "Sign PDF", "device", "", ""],
  ["pdf-yorumla", "PDF Yorumla", "Annotate PDF", "device", "", ""],
  ["pdf-kesit-al", "PDF Kesit Al", "PDF Snip", "device", "", ""],
  ["gorsel-sikistir", "Görsel Sıkıştır", "Compress Image", "device", "", ""],
  ["gorsel-boyutlandir", "Görsel Boyutlandır", "Resize Image", "device", "", ""],
  ["belge-tara", "Belge Tarayıcı", "Document Scanner", "device", "«Hesabıma kaydet» dersen tarama hesabında saklanır", "Scans are stored in your account only if you choose “Save to my account”"],
  ["aranabilir-pdf", "Aranabilir PDF (OCR)", "Searchable PDF (OCR)", "device", "", ""],
  ["taranmis-pdf-ocr", "Taranmış PDF'ten Metne (OCR)", "Scanned PDF to Text (OCR)", "device", "", ""],
  ["form-doldur", "Form Doldur", "Fill Form", "device", "", ""],
  ["ustveri-temizle", "Gizli Bilgi Temizle", "Clean Metadata", "device", "", ""],
  ["pdf-qr-ekle", "PDF'ye QR Kod Ekle", "Add QR Code to PDF", "device", "", ""],
  ["pdf-birlestir-icindekiler", "Birleştir + İçindekiler", "Merge + Table of Contents", "device", "", ""],
  ["sayfa-duzeni", "Sayfa Düzeni", "Page Layout", "device", "", ""],
  ["udf-to-pdf", "UDF'den PDF'e", "UDF to PDF", "device", "", ""],
  ["pdf-to-udf", "PDF'ten UDF'ye", "PDF to UDF", "device", "", ""],
  ["word-to-udf", "Word'den UDF'ye", "Word to UDF", "device", "", ""],
  ["udf-to-word", "UDF'den Word'e", "UDF to Word", "device", "", ""],
  ["udf-viewer", "UDF Görüntüleyici", "UDF Viewer", "device", "", ""],
  ["image-to-udf", "Görsel ve TIFF'ten UDF'ye", "Image / TIFF to UDF", "device", "", ""],
  ["txt-to-pdf", "TXT'den PDF'e", "TXT to PDF", "device", "", ""],
  ["markdown-to-pdf", "Markdown'dan PDF'e", "Markdown to PDF", "device", "", ""],
  ["rtf-to-pdf", "RTF'den PDF'e", "RTF to PDF", "device", "", ""],
  ["odt-to-pdf", "ODT'den PDF'e", "ODT to PDF", "device", "", ""],
  ["epub-to-pdf", "EPUB'tan PDF'e", "EPUB to PDF", "device", "", ""],
  ["pdf-to-epub", "PDF'ten EPUB'a", "PDF to EPUB", "device", "", ""],
  ["pdf-to-markdown", "PDF'ten Markdown'a", "PDF to Markdown", "device", "", ""],
  ["e-basvuru-uyumluluk", "E-başvuru Uyumluluk Kontrolü", "Filing Compliance Check", "device", "", ""],
  ["dilekce-sablonlari", "Dilekçe Şablonları", "Petition Templates", "device", "", ""],
  ["kimlik-karti-tek-sayfa", "Kimlik Ön–Arka Tek Sayfa", "ID Front+Back on One Page", "device", "Kimlik fotoğrafı yalnızca tarayıcıda işlenir; sunucuya gönderilmez", "The ID photo is processed only in the browser and never sent to a server"],
  ["tiff-to-pdf", "TIFF'ten PDF'e", "TIFF'ten PDF'e", "device", "", ""],
  ["pdf-ust-alt-bilgi", "Üst / Alt Bilgi Ekle", "Add Header / Footer", "device", "", ""],
  ["pdf-sesli-oku", "Sesli Okuma", "Read Aloud", "device", "Yapay zekâ sesi tarayıcıda çalışır; metin sunucuya gönderilmez", "The AI voice runs in the browser; the text is never sent to a server"],
  ["ai-fotograf-studyosu", "Fotoğraf Stüdyosu", "Photo Studio", "device", "Yapay zekâ modelleri tarayıcıda çalışır; fotoğraf cihazdan çıkmaz", "AI models run in the browser; the photo never leaves your device"],
  ["cv-olustur", "CV Oluştur", "CV Maker", "device", "", ""],
  // ── Sunucuda ──
  ["compress", "PDF Sıkıştır", "Compress PDF", "server", "", ""],
  ["pdf-to-word", "PDF'ten Word'e", "PDF to Word", "server", "", ""],
  ["word-to-pdf", "Word'den PDF'e", "Word to PDF", "server", "", ""],
  ["pdf-to-excel", "PDF'ten Excel'e", "PDF to Excel", "server", "", ""],
  ["excel-to-pdf", "Excel'den PDF'e", "Excel to PDF", "server", "", ""],
  ["pdf-to-ppt", "PDF'ten PowerPoint'e", "PDF to PowerPoint", "server", "", ""],
  ["ppt-to-pdf", "PowerPoint'ten PDF'e", "PowerPoint to PDF", "server", "", ""],
  ["pdf-to-image", "PDF'ten Görsele", "PDF to Image", "server", "", ""],
  ["html-to-pdf", "HTML'den PDF'e", "HTML to PDF", "server", "", ""],
  ["pdf-to-text", "PDF'ten Metne", "PDF to Text", "server", "", ""],
  ["encrypt", "PDF Şifrele", "Encrypt PDF", "server", "", ""],
  ["unlock-pdf", "PDF Şifre Kaldır", "Unlock PDF", "server", "", ""],
  ["watermark", "Filigran Ekle", "Add Watermark", "server", "", ""],
  ["page-numbers", "Sayfa Numarası", "Page Numbers", "server", "", ""],
  ["extract-images", "Görselleri Çıkar", "Extract Images", "server", "", ""],
  ["pdf-to-pdfa", "PDF'ten PDF/A'ya", "PDF to PDF/A", "server", "", ""],
  ["grayscale-pdf", "Siyah-Beyaz Yap", "Grayscale", "server", "", ""],
  ["resize-pdf", "PDF Boyutlandır", "Resize PDF", "server", "", ""],
  ["flip-pdf", "Sayfaları Çevir", "Flip Pages", "server", "", ""],
  ["alternate-mix-pdf", "Sırayla Birleştir", "Interleave", "server", "", ""],
  ["deskew-pdf", "Eğri Taramayı Düzelt", "Deskew PDF", "server", "", ""],
  ["flatten-pdf", "PDF Düzleştir", "Flatten PDF", "server", "", ""],
  ["repair-pdf", "PDF Onar", "Repair PDF", "server", "", ""],
  ["hassas-veri-gizle", "Hassas Veri Gizle", "Redact Sensitive Data", "server", "Yapay zekâ ile tespit seçilirse metin yapay zekâ sağlayıcısına da gider", "If you pick AI detection, the text also goes to the AI provider"],
  ["pdf-duzenle", "PDF Düzenle", "Edit PDF", "server", "Metin tanıma (OCR) cihazda yapılır", "Text recognition (OCR) runs on your device"],
  ["imza-iste", "İmza İste", "Request Signature", "server", "Belge ve imzalı kopya sen silene kadar saklanır; imza bağlantısı 14 gün geçerli", "The document and signed copy are kept until you delete them; the signing link is valid for 14 days"],
  // ── Yapay zekâ ──
  ["pdf-ozetle", "PDF Özetle", "Summarize PDF", "ai", "", ""],
  ["pdf-sohbet", "PDF ile Sohbet", "Chat with PDF", "ai", "", ""],
  ["pdf-ceviri", "PDF Çeviri", "Translate PDF", "ai", "", ""],
  ["pdf-sinav-olustur", "Soru / Test Oluştur", "Quiz Maker", "ai", "", ""],
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
