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
};

export function pdfToolLabelTr(featureKey: string): string {
  return PDF_TOOL_LABELS_TR[featureKey] ?? featureKey;
}
