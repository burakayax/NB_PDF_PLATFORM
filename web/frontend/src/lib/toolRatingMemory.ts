/**
 * "Bu kişi bu araca ne demişti?" — tarayıcıda tutulan küçük hafıza.
 *
 * İKİ AYRI BİLGİ TUTULUR, ÇÜNKÜ İKİ AYRI SORUYA CEVAP VERİRLER:
 *
 *   value    → Bu kişinin bu araca verdiği puan. Araç sayfasındaki KALICI puan
 *              satırı bunu kullanır: yıldızları kendi oyuyla dolu gösterir.
 *   prompted → İş bitiminde çıkan SORU kullanıldı mı (cevaplandı ya da
 *              kapatıldı). Yalnızca o soruyu susturur.
 *
 * NEDEN AYRI: Önce tek bir kayıt vardı ve kalıcı satırdan oy vermek, iş
 * bitimindeki soruyu da kalıcı olarak susturuyordu. Sonuç: kullanıcı bir kez
 * yukarıdan puan verince hiçbir işlemin sonunda soru görmüyordu. Oysa bu ikisi
 * farklı şeyler — biri "puanım şu", diğeri "bu soruyu gördüm, bir daha sorma".
 *
 * NEDEN SUNUCUDA DEĞİL: Oy veren çoğu kişi üye değil ve kimliğini saklamıyoruz.
 * Kaybolması zarar vermez: tarayıcı verisi silinirse kişi soruyu bir kez daha
 * görür, oyu yine ESKİSİNİN YERİNE geçer — ortalama şişmez.
 *
 * Gizli sekmede / site verisi kapalıyken okuma ve yazma hata fırlatabilir; her
 * erişim sarmalanmıştır ve boş sonuç normal kabul edilir.
 */

const KEY = "nb_tool_ratings_v1";

type Entry = { value?: number; prompted?: boolean };
type Store = Record<string, Entry>;

/**
 * Eski biçimi okur.
 *
 * İlk sürüm araç başına tek bir değer yazıyordu: puan (sayı) ya da "skipped".
 * O kayıtlarda puanın NEREDEN verildiği bilinmiyor. Sayı görünce soruyu
 * "kullanılmamış" sayıyoruz — böylece hatalı susturmadan etkilenen kullanıcılar
 * soruyu yeniden görür. "skipped" ise zaten bilinçli bir "sorma" kararıydı,
 * ona saygı gösterilir.
 */
function normalize(raw: unknown): Entry | null {
  if (typeof raw === "number") return { value: raw };
  if (raw === "skipped") return { prompted: true };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Entry;
    const entry: Entry = {};
    if (typeof r.value === "number") entry.value = r.value;
    if (r.prompted === true) entry.prompted = true;
    return entry;
  }
  return null;
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Store = {};
    for (const [slug, deger] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = normalize(deger);
      if (entry) out[slug] = entry;
    }
    return out;
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

function update(toolSlug: string, degistir: (mevcut: Entry) => Entry): void {
  const store = readStore();
  store[toolSlug] = degistir(store[toolSlug] ?? {});
  writeStore(store);
}

/** Bu kişinin bu araca verdiği puan — yoksa null. */
export function myRatingFor(toolSlug: string): number | null {
  return readStore()[toolSlug]?.value ?? null;
}

/**
 * İş bitimindeki soru daha önce KULLANILDI mı (cevaplandı ya da kapatıldı)?
 * Yalnızca o soruyu susturur; kalıcı puan satırını etkilemez.
 */
export function promptAlreadyUsed(toolSlug: string): boolean {
  return readStore()[toolSlug]?.prompted === true;
}

/**
 * Verilen puanı hatırla.
 *
 * `fromPrompt` — oy iş bitimindeki sorudan mı geldi? Yalnızca o durumda soru
 * bir daha gösterilmez. Kalıcı satırdan verilen oy soruyu SUSTURMAZ; kullanıcı
 * oraya fikrini değiştirmeye gelir, bir dahaki işlemde sorulmasın demek değildir.
 */
export function rememberVote(
  toolSlug: string,
  value: number,
  opts: { fromPrompt: boolean },
): void {
  update(toolSlug, (mevcut) => ({
    ...mevcut,
    value,
    prompted: opts.fromPrompt ? true : mevcut.prompted,
  }));
}

/** Kullanıcı iş bitimindeki soruyu kapattı — bir daha gösterme. */
export function rememberPromptDismissed(toolSlug: string): void {
  update(toolSlug, (mevcut) => ({ ...mevcut, prompted: true }));
}
