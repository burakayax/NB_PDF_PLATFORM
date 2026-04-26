const PDF_TOOL_LABELS_TR: Record<string, string> = {
  split: "Sayfa ayır",
  merge: "PDF birleştir",
  "pdf-to-word": "PDF → Word",
  "word-to-pdf": "Word → PDF",
  "excel-to-pdf": "Excel → PDF",
  "pdf-to-excel": "PDF → Excel",
  compress: "Sıkıştır",
  encrypt: "Şifrele",
};

export function pdfToolLabelTr(featureKey: string): string {
  return PDF_TOOL_LABELS_TR[featureKey] ?? featureKey;
}
