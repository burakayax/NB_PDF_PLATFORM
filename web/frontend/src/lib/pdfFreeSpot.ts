/**
 * SAYFADA BOŞ YER BULMA — QR gibi küçük bir nesnenin metne/görsele binmeyeceği
 * en uygun köşeyi önerir. Saf mantık: çizilmiş sayfa görüntüsünün pikselleri alınır.
 */
export type Pixels = { data: ArrayLike<number>; width: number; height: number };

const GRID = 90; // genişlik boyunca hücre sayısı

/**
 * @param bw kutu genişliği, sayfa genişliğinin oranı (0–1)
 * @param bh kutu yüksekliği, sayfa yüksekliğinin oranı (0–1)
 * @returns serbest alana göre konum {fx, fy} (QR aracındaki konumla aynı birim) ya da yer yoksa null
 */
export function findFreeSpot(img: Pixels, bw: number, bh: number): { fx: number; fy: number } | null {
  const { width: W, height: H, data } = img;
  const cell = Math.max(2, Math.floor(W / GRID));
  const gw = Math.floor(W / cell);
  const gh = Math.floor(H / cell);
  if (gw < 4 || gh < 4) return null;

  // Hücre başına "mürekkep" var mı? (koyu ya da renkli piksel oranı %2'yi aşarsa dolu)
  const ink = new Uint8Array(gw * gh);
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      let n = 0;
      let total = 0;
      for (let y = cy * cell; y < (cy + 1) * cell; y += 2) {
        for (let x = cx * cell; x < (cx + 1) * cell; x += 2) {
          const i = (y * W + x) * 4;
          const lum = (data[i]! * 299 + data[i + 1]! * 587 + data[i + 2]! * 114) / 1000;
          total++;
          if (lum < 240 && (data[i + 3] ?? 255) > 10) n++;
        }
      }
      ink[cy * gw + cx] = n / total > 0.02 ? 1 : 0;
    }
  }
  // Toplam tablosu
  const S = new Int32Array((gw + 1) * (gh + 1));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      S[(y + 1) * (gw + 1) + x + 1] =
        ink[y * gw + x]! + S[y * (gw + 1) + x + 1]! + S[(y + 1) * (gw + 1) + x]! - S[y * (gw + 1) + x]!;
    }
  }
  const sum = (x0: number, y0: number, x1: number, y1: number) =>
    S[y1 * (gw + 1) + x1]! - S[y0 * (gw + 1) + x1]! - S[y1 * (gw + 1) + x0]! + S[y0 * (gw + 1) + x0]!;

  const PAD = 1; // kutunun çevresinde 1 hücre ek boşluk
  const w = Math.ceil(bw * gw) + PAD * 2;
  const h = Math.ceil(bh * gh) + PAD * 2;
  if (w > gw - 2 || h > gh - 2) return null;

  let best: { cx: number; cy: number; score: number } | null = null;
  for (let cy = 1; cy <= gh - h - 1; cy++) {
    for (let cx = 1; cx <= gw - w - 1; cx++) {
      if (sum(cx, cy, cx + w, cy + h) !== 0) continue;
      // En yakın köşeye uzaklık; alt köşeler hafif tercih (QR genelde altta durur)
      const dx = Math.min(cx, gw - (cx + w));
      const dy = Math.min(cy, gh - (cy + h));
      const bottomBias = cy + h / 2 > gh / 2 ? 0 : 2;
      const score = dx + dy + bottomBias;
      if (!best || score < best.score) best = { cx, cy, score };
    }
  }
  if (!best) return null;
  const freeX = gw - w;
  const freeY = gh - h;
  // Kutunun kendi içindeki PAD payı konuma dahil edilmez (iç kutu: +PAD)
  const ix = best.cx + PAD;
  const iy = best.cy + PAD;
  const innerW = gw - (w - PAD * 2);
  const innerH = gh - (h - PAD * 2);
  void freeX;
  void freeY;
  return {
    fx: innerW > 0 ? Math.min(1, Math.max(0, ix / innerW)) : 0,
    fy: innerH > 0 ? Math.min(1, Math.max(0, iy / innerH)) : 0,
  };
}
