/**
 * YÜKLEME SIRASINDA SINIR KONTROLÜ — dosya yüklenip "PDF kontrol ediliyor" aşamasında
 * sayfa sayısı bilindiği için, seçili araç için fazla uzun belge HEMEN dosya kartında
 * anlatılır; kullanıcı düğmeye basıp boşuna beklemez.
 *
 * Sınırların değeri sunucudan gelir (kontrol cevabındaki `page_limits`), böylece tek
 * kaynak sunucudadır; burada sabit sayı tutulmaz.
 */
export type PageLimits = Record<string, number>;

type LimitCheckItem = {
  pageCount: number | null;
  pageLimits?: PageLimits | null;
};

const TOOL_NAME: Record<string, { tr: string; en: string }> = {
  "pdf-to-word": { tr: "Word'e dönüştürme", en: "Word conversion" },
  "pdf-to-ppt": { tr: "PowerPoint'e dönüştürme", en: "PowerPoint conversion" },
};

/** Seçili araç için belge çok uzunsa kullanıcıya gösterilecek mesaj; sorun yoksa null. */
export function uploadLimitMessage(
  item: LimitCheckItem,
  featureId: string,
  language: "tr" | "en",
): string | null {
  const limit = item.pageLimits?.[featureId];
  const pages = item.pageCount;
  if (!limit || !pages || pages <= limit) return null;
  const name = TOOL_NAME[featureId]?.[language] ?? featureId;
  return language === "tr"
    ? `Bu belge ${pages} sayfa. ${name} en fazla ${limit} sayfalık belgelerde yapılabiliyor. Belgeyi «PDF Böl» aracıyla ${limit} sayfalık parçalara ayırıp her parçayı ayrı ayrı dönüştürebilirsiniz.`
    : `This document has ${pages} pages. ${name} works on documents of up to ${limit} pages. Split it into ${limit}-page parts with the “Split PDF” tool and convert each part separately.`;
}
