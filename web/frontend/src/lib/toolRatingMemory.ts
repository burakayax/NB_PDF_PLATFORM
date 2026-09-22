/**
 * "Bu kişi bu araca ne demişti?" — tarayıcıda tutulan küçük hafıza.
 *
 * NEDEN GEREKLİ: İş bitiminde sorulan puan sorusu araç başına BİR KEZ sorulur.
 * Sunucu tarafı zaten aynı kişinin ikinci oyunu yeni oy olarak saymaz (oyu
 * günceller), ama sormayı durduracak bilgi sunucuda yok — oy veren çoğu kişi
 * üye değil, kimliği saklanmıyor. Bu yüzden "sordum / cevap verdi" bilgisi
 * ziyaretçinin kendi tarayıcısında durur.
 *
 * NEDEN BU VERİ BURADA DURABİLİR: Kaybolması zarar vermez. Tarayıcı verisi
 * silinirse kişi soruyu bir kez daha görür, oyu yine ESKİSİNİN YERİNE geçer —
 * ortalama şişmez. Yani en kötü ihtimal küçük bir tekrar, veri bozulması değil.
 *
 * Gizli sekmede / site verisi kapalıyken okuma ve yazma hata fırlatabilir;
 * her erişim bu yüzden sarmalanmıştır ve boş sonuç normal kabul edilir.
 */

const KEY = "nb_tool_ratings_v1";

/** Araç kimliği → verilen puan, ya da soruyu kapattıysa "skipped". */
type Store = Record<string, number | "skipped">;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* gizli sekme / site verisi kapalı — hafızasız devam edilir */
  }
}

/** Bu araca daha önce soruldu mu (cevaplandı ya da kapatıldı)? */
export function ratingAlreadyAsked(toolSlug: string): boolean {
  return toolSlug in readStore();
}

/** Bu kişinin bu araca verdiği puan — yoksa ya da kapattıysa null. */
export function myRatingFor(toolSlug: string): number | null {
  const v = readStore()[toolSlug];
  return typeof v === "number" ? v : null;
}

/** Puanı ya da "sorma" kararını hatırla. */
export function rememberRating(toolSlug: string, value: number | "skipped"): void {
  const store = readStore();
  store[toolSlug] = value;
  writeStore(store);
}
