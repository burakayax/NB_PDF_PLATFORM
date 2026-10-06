/**
 * Konu bazlı "ilgili yazılar" — hem React blog sayfası hem prerender (Google'ın gördüğü HTML)
 * aynı sırayı kullanır. Eskiden iki yerde de "en yeni 2 yazı" gösteriliyordu: konuyla ilgisiz
 * ve her yazıda aynı iki bağlantı. Artık ortak araç / aynı ana araç / ortak etiket sayısına göre
 * sıralanır; böylece iç bağlantı gücü konuca yakın yazılara akar.
 */
import { BLOG_POSTS } from "../blog/blogContent.mjs";
import { BLOG_RELATED_TOOLS } from "./seoContent.mjs";

function overlap(a, b) {
  const set = new Set(b);
  return a.filter((x) => set.has(x)).length;
}

/**
 * @param {string} slug     Yazı slug'ı
 * @param {number} max      En fazla kaç yazı
 * @param {(p: object) => boolean} [available]  Bu dilde yayınlanıyor mu (örn. EN slug'ı var mı)
 * @returns {object[]}      BLOG_POSTS girdileri
 */
export function relatedBlogPosts(slug, max = 3, available = () => true) {
  const self = BLOG_POSTS.find((p) => p.slug === slug);
  if (!self) return [];
  const selfTools = BLOG_RELATED_TOOLS[slug] ?? [];
  const scored = BLOG_POSTS.filter((p) => p.slug !== slug && available(p)).map((p) => {
    const score =
      overlap(selfTools, BLOG_RELATED_TOOLS[p.slug] ?? []) * 3 +
      (p.tool === self.tool ? 2 : 0) +
      overlap(self.tags.tr, p.tags.tr);
    return { p, score };
  });
  const byScore = (x, y) => y.score - x.score || String(y.p.date).localeCompare(String(x.p.date));
  const related = scored.filter((x) => x.score > 0).sort(byScore).slice(0, max).map((x) => x.p);
  if (related.length) return related;
  // Hiçbir ortaklık yoksa (nadir) en yeni yazılar — boş bölüm bırakmaktan iyi.
  return scored.sort((x, y) => String(y.p.date).localeCompare(String(x.p.date))).slice(0, max).map((x) => x.p);
}
