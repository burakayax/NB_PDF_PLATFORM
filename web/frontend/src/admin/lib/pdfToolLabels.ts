const PDF_TOOL_LABELS_TR: Record<string, string> = {
  split: "Sayfa ayır",
  merge: "PDF birleştir",
  "pdf-to-word": "PDF → Word",
  "word-to-pdf": "Word → PDF",
  "excel-to-pdf": "Excel → PDF",
  "pdf-to-excel": "PDF → Excel",
  compress: "Sıkıştır",
  encrypt: "Şifrele",
  "delete-pages": "Sayfa sil",
  "rotate-pdf": "PDF döndür",
  "organize-pdf": "Sayfa sırala",
  "unlock-pdf": "PDF şifre çöz",
  watermark: "Filigran",
  "page-numbers": "Sayfa numarası",
  "repair-pdf": "PDF onar",
  "pdf-to-ppt": "PDF → PowerPoint",
  "ppt-to-pdf": "PowerPoint → PDF",
  "pdf-to-image": "PDF → görüntü",
  "image-to-pdf": "Görüntü → PDF",
  "html-to-pdf": "HTML → PDF",
  "pdf-to-text": "PDF → Metin",
  "flatten-pdf": "PDF Düzleştir",
  "form-doldur": "PDF Form Doldur",
  "ustveri-temizle": "PDF Üstveri Temizle",
  "pdf-to-pdfa": "PDF → PDF/A (Arşiv)",
  "sayfa-duzeni": "Sayfa Düzeni",
  "imza-iste": "İmza İste",
  "extract-images": "PDF'ten Görsel Çıkar",
  "sozlesme-denetci": "Sözleşme Denetçisi",
  "ai-fotograf-studyosu": "AI Fotoğraf Stüdyosu",
  "cv-olustur": "CV Oluştur",
};

export function pdfToolLabelTr(featureKey: string): string {
  return PDF_TOOL_LABELS_TR[featureKey] ?? featureKey;
}

/**
 * MİSAFİR araç kimlikleri (`UserJourneyEvent.toolId`) — `ValueMomentNudge`'ın
 * `source` prop'una gömülü, PDF_TOOL_LABELS_TR'dan AYRI bir sözlük (farklı
 * biçim: alt çizgili + "_success" son eki, bkz. GuestToolCore/GuestPageTool/
 * ImageCompressTool/UdfToPdfTool/PdfAnnotate/PdfSign/PdfSnipTool/PdfEditor/
 * PdfLayoutTool/PdfMetadataTool/PdfFormFill).
 */
const GUEST_TOOL_LABELS_TR: Record<string, string> = {
  merge_success: "PDF Birleştir",
  image_to_pdf_success: "Görüntü → PDF",
  image_compress_success: "Görsel Sıkıştır",
  image_resize_success: "Görsel Yeniden Boyutlandır",
  udf_to_pdf_success: "UDF → PDF",
  rotate_pdf_success: "PDF Döndür",
  delete_pages_success: "Sayfa Sil",
  organize_pdf_success: "Sayfa Sırala",
  split_success: "Sayfa Ayır",
  annotate_success: "Not Al / İşaretle",
  sign_success: "PDF İmzala",
  snip_success: "PDF Kırp",
  editor_success: "PDF Düzenle",
  layout_success: "Sayfa Düzeni",
  metadata_clean_success: "Üstveri Temizle",
  form_fill_success: "Form Doldur",
};

/** Bilinmeyen bir toolId gelirse ("_success" sonekini atıp okunur hale getirir) çökmez. */
export function guestToolLabelTr(toolId: string): string {
  if (GUEST_TOOL_LABELS_TR[toolId]) return GUEST_TOOL_LABELS_TR[toolId];
  const cleaned = toolId.replace(/_success$/, "").replace(/_/g, " ").trim();
  return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : toolId;
}
