/**
 * SÖZLEŞME DENETÇİSİ — indirilen dosyaların adları (kurumsal, Türkçe karakterli).
 *
 *   {Belge adı} - İşaretlenmiş Sözleşme.pdf
 *   {Belge adı} - Sözleşme Denetim Raporu.pdf
 *   (hızlı tarama)  {Belge adı} - İşaretlenmiş Sözleşme (Hızlı Tarama).pdf
 *                   {Belge adı} - Sözleşme Hızlı Tarama Raporu.pdf
 *
 * Türkçe karakterler ASCII'ye ÇEVRİLMEZ. Yalnızca dosya sisteminde yasak karakterler atılır ve ad
 * Unicode NFC biçimine getirilir (bazı sistemlerde "İ", "ş" gibi harfler ayrışık bileşenlerle gelir
 * ve dosya adında bozuk görünür).
 */

// Kontrol karakterleri dosya adında bilerek ayıklanır.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[/\\?%*:|"<>\u0000-\u001f]/g;

/** Yüklenen dosyanın adından ".pdf" ve yasak karakterleri atar; makul uzunlukta tutar. */
export function cleanBaseName(original: string): string {
  const base = original
    .normalize("NFC")
    .replace(/\.pdf$/i, "")
    .replace(ILLEGAL, "")
    .replace(/\s+/g, " ")
    .trim();
  const short = base.length > 80 ? base.slice(0, 80).trimEnd() : base;
  return short || "Sözleşme";
}

export function contractDownloadNames(original: string, mode: "quick" | "full" | undefined): { annotated: string; report: string } {
  const base = cleanBaseName(original);
  const quick = mode === "quick";
  return {
    annotated: `${base} - İşaretlenmiş Sözleşme${quick ? " (Hızlı Tarama)" : ""}.pdf`,
    report: `${base} - Sözleşme ${quick ? "Hızlı Tarama" : "Denetim"} Raporu.pdf`,
  };
}
