/**
 * Sayfa numarası tespiti (cihazda, pdf.js).
 *
 * Sayfa Düzeni "yaprağa sığdır" kipinde 4 sayfa tek kâğıda girince her küçük
 * sayfanın kendi alt numarası da görünür; kullanıcı yaprağın TEK numarası olsun
 * ister. Belgenin kendi numarasını silmenin tek yolu, o metnin yerini bulup
 * üstünü beyazla kapatmaktır.
 *
 * KURAL (bilerek dar tutuldu, belge içeriğini yanlışlıkla silmesin):
 *  - Yalnızca sayfanın alt %12'si ya da üst %8'indeki,
 *  - tek başına duran kısa metin: "3", "- 3 -", "Sayfa 3", "3 / 12", "Page 3 of 12".
 * Taranmış (resim) PDF'lerde metin olmadığı için hiçbir şey bulunmaz.
 */
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/** Sayfanın SOL-ALT köşesine göre kutu (nokta). */
export type NumaraKutusu = { x: number; y: number; w: number; h: number };

const NUMARA =
  /^(?:sayfa|page|syf\.?|s\.?|p\.?)?\s*[-–—]?\s*\d{1,4}\s*(?:[-–—]|(?:\/|of|\\)\s*\d{1,4})?\s*[-–—]?$/i;

/** Bir metin öğesi tek başına sayfa numarası gibi mi? */
export function sayfaNumarasiMi(metin: string): boolean {
  const t = metin.trim();
  return t.length > 0 && t.length <= 14 && NUMARA.test(t);
}

type Satir = { str: string; x: number; y: number; w: number; h: number };

/** Satırdaki öğeleri soldan sağa birleştirir ("Sayfa" + "3" ayrı öğe gelebilir). */
function satirlaraBirlestir(oge: Satir[]): Satir[] {
  const sirali = [...oge].sort((a, b) => b.y - a.y || a.x - b.x);
  const satirlar: Satir[] = [];
  for (const o of sirali) {
    const son = satirlar[satirlar.length - 1];
    if (son && Math.abs(son.y - o.y) < Math.max(2, o.h * 0.4) && o.x - (son.x + son.w) < o.h * 1.5) {
      son.str += o.str;
      son.w = o.x + o.w - son.x;
      son.h = Math.max(son.h, o.h);
    } else {
      satirlar.push({ ...o });
    }
  }
  return satirlar;
}

/**
 * Her sayfa için kapatılacak numara kutularını döndürür (sayfa dizisiyle aynı sırada).
 * Dönmüş sayfalar atlanır (koordinat eşlemesi belirsiz olur, yanlış yeri kapatmak
 * numarayı bırakmaktan kötüdür).
 */
export async function sayfaNumaralariniBul(bytes: Uint8Array): Promise<NumaraKutusu[][]> {
  // pdf.js veriyi devralıp kopyasını tüketebilir; çağıranın bayt dizisi bozulmasın.
  const doc = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const sonuc: NumaraKutusu[][] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const sayfa = await doc.getPage(i);
      const kutular: NumaraKutusu[] = [];
      if (sayfa.rotate % 360 === 0) {
        const [x0, y0, , y1] = sayfa.view;
        const yukseklik = y1 - y0;
        const icerik = await sayfa.getTextContent();
        const ogeler: Satir[] = [];
        for (const it of icerik.items) {
          const t = it as { str?: string; transform?: number[]; width?: number; height?: number };
          if (typeof t.str !== "string" || !t.str.trim() || !t.transform) continue;
          ogeler.push({
            str: t.str,
            x: t.transform[4] - x0,
            y: t.transform[5] - y0,
            w: t.width ?? 0,
            h: t.height || Math.abs(t.transform[3]) || 10,
          });
        }
        for (const s of satirlaraBirlestir(ogeler)) {
          const altta = s.y < yukseklik * 0.12;
          const ustte = s.y > yukseklik * 0.92;
          if (!(altta || ustte) || !sayfaNumarasiMi(s.str)) continue;
          kutular.push({ x: s.x - 2, y: s.y - s.h * 0.25, w: s.w + 4, h: s.h * 1.3 });
        }
      }
      sonuc.push(kutular);
    }
  } finally {
    await doc.destroy();
  }
  return sonuc;
}

const onbellek = new WeakMap<Uint8Array, Promise<NumaraKutusu[][]>>();

/** Aynı belge için tespiti bir kez yapar (önizleme her ayar değişiminde yeniden çağırır). */
export function sayfaNumaralariniBulOnbellekli(bytes: Uint8Array): Promise<NumaraKutusu[][]> {
  let p = onbellek.get(bytes);
  if (!p) {
    p = sayfaNumaralariniBul(bytes);
    onbellek.set(bytes, p);
  }
  return p;
}
