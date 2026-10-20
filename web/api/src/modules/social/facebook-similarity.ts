/**
 * Facebook metinlerinde tekrar denetimi.
 *
 * Aynı ya da çok benzer metni tekrar paylaşmak erişimi düşürüyor. Karşılaştırma sözcük
 * kümeleri üzerinden (Jaccard); etiket ve "link ilk yorumda" gibi sabit parçalar sayılmaz.
 */

export const SIMILARITY_LIMIT = 0.6;

function words(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase("tr")
      .replace(/#\S+/gu, " ")
      .replace(/link ilk yorumda/gu, " ")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2),
  );
}

export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

/** Son gönderilerden herhangi birine eşik üstü benziyor mu? */
export function isTooSimilar(body: string, recent: string[]): boolean {
  return recent.some((r) => similarity(body, r) >= SIMILARITY_LIMIT);
}
