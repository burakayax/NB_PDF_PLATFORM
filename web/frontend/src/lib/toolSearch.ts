/**
 * Araç arama eşleştirmesi: büyük/küçük harf ve Türkçe aksan farkı yok sayılır
 * ("donu" → "Dönüştür", "SIKISTIR" → "Sıkıştır", "isaretle" → "İşaretle").
 */
export function normalizeSearch(s: string): string {
  return s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Sorgu boşsa her şey eşleşir; aksi halde etiketlerden biri sorguyu içermeli. */
export function matchesSearch(query: string, ...labels: string[]): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return labels.some((l) => normalizeSearch(l).includes(q));
}
