/**
 * DÖRTGEN GEÇERLİLİK KONTROLÜ — belge tespitinin "saçma" sonuçlarını eler.
 *
 * SORUN (kullanıcı bildirdi): Kitap sayfası ya da kenarı belirsiz sayfa
 * taranırken otomatik odak saçmalıyor. Sebep: dedektör kenar bulamayınca
 * metin bloğuna, sayfa ortasındaki kıvrıma ya da gölgeye tutunup çarpık,
 * kendini kesen veya aşırı ince/uzun bir dörtgen döndürüyordu; sonuç hiçbir
 * geometrik denetimden geçmeden ekrana çiziliyor ve kırpmada kullanılıyordu.
 *
 * Gerçek bir kâğıdın perspektifli görüntüsü her zaman şu özelliklere sahiptir:
 *  - dışbükeydir (kendini kesmez, içe çökmez),
 *  - iç açıları 45°–135° arasındadır (telefon açısıyla bile),
 *  - karşılıklı kenarları birbirine kabaca yakın uzunluktadır,
 *  - aşırı ince bir şerit değildir.
 * Bu dosya saf hesaptır (DOM yok) — test edilebilir.
 */
import type { Quad, Pt } from "./documentScan";

function uzunluk(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** (b-a) x (c-b) çapraz çarpımı. */
function capraz(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

/** b köşesindeki iç açı (derece). */
function aci(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (n === 0) return 0;
  const c0 = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n));
  return (Math.acos(c0) * 180) / Math.PI;
}

export function dortgenAlani(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    a += q[i]!.x * q[j]!.y - q[j]!.x * q[i]!.y;
  }
  return Math.abs(a) / 2;
}

export type GecerlilikAyari = {
  minAci: number;
  maxAci: number;
  /** Karşılıklı kenarların kısa/uzun oranı bunun altına inmemeli. */
  minKarsiOran: number;
  /** Uzun/kısa kenar oranı bunu aşmamalı (ince şerit değil). */
  maxEnBoy: number;
  /** En kısa kenar, karenin kısa kenarının bu oranından küçük olmamalı. */
  minKenarOrani: number;
};

export const VARSAYILAN_GECERLILIK: GecerlilikAyari = {
  minAci: 45,
  maxAci: 135,
  minKarsiOran: 0.4,
  maxEnBoy: 4.5,
  minKenarOrani: 0.1,
};

/**
 * Dörtgen gerçek bir belge görüntüsü olabilir mi?
 * @param w,h  tespitin yapıldığı karenin boyutu
 */
export function quadGecerli(
  q: Quad,
  w: number,
  h: number,
  ayar: GecerlilikAyari = VARSAYILAN_GECERLILIK,
): boolean {
  for (const p of q) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  }

  // Dışbükeylik: dört köşede çapraz çarpımın işareti aynı olmalı.
  let pozitif = 0;
  let negatif = 0;
  for (let i = 0; i < 4; i++) {
    const c = capraz(q[i]!, q[(i + 1) % 4]!, q[(i + 2) % 4]!);
    if (c > 0) pozitif++;
    else if (c < 0) negatif++;
    else return false; // üç köşe doğrusal
  }
  if (pozitif !== 4 && negatif !== 4) return false;

  // İç açılar.
  for (let i = 0; i < 4; i++) {
    const a = aci(q[(i + 3) % 4]!, q[i]!, q[(i + 1) % 4]!);
    if (a < ayar.minAci || a > ayar.maxAci) return false;
  }

  // Kenar uzunlukları: üst, sağ, alt, sol.
  const ust = uzunluk(q[0], q[1]);
  const sag = uzunluk(q[1], q[2]);
  const alt = uzunluk(q[2], q[3]);
  const sol = uzunluk(q[3], q[0]);
  const enKisa = Math.min(ust, sag, alt, sol);
  if (enKisa < Math.min(w, h) * ayar.minKenarOrani) return false;

  const oran = (a: number, b: number) => Math.min(a, b) / Math.max(a, b);
  if (oran(ust, alt) < ayar.minKarsiOran || oran(sol, sag) < ayar.minKarsiOran) return false;

  const yatay = (ust + alt) / 2;
  const dikey = (sol + sag) / 2;
  if (Math.max(yatay, dikey) / Math.min(yatay, dikey) > ayar.maxEnBoy) return false;

  return true;
}

/**
 * Dörtgen kadrajın kenarlarından ne kadar uzak? Kitap sayfasında belge
 * genellikle kadrajı doldurur; dedektörün bulduğu küçük bir iç dörtgen büyük
 * olasılıkla metin bloğu ya da kıvrımdır. 0 = kenara yapışık, 1 = çok içeride.
 */
export function kenarBosluguOrani(q: Quad, w: number, h: number): number {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const sol = Math.min(...xs);
  const sag = w - Math.max(...xs);
  const ust = Math.min(...ys);
  const alt = h - Math.max(...ys);
  return Math.max(0, Math.min(sol, sag, ust, alt)) / Math.min(w, h);
}

/**
 * Çekim anında dedektör sonucuna güvenilir mi? Güvenilmezse çağıran taraf
 * tam kareye (kenarsız sayfa varsayımı) düşer; kullanıcı köşeleri sürükleyebilir.
 *
 * Reddedilenler: geçersiz geometri ve kadrajın %12'sinden küçük kırıntılar.
 */
export function cekimSonucuGuvenilir(q: Quad, w: number, h: number): boolean {
  if (!quadGecerli(q, w, h)) return false;
  return dortgenAlani(q) / (w * h) >= 0.12;
}
