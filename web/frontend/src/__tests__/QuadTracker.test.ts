import { describe, it, expect } from "vitest";
import { QuadTakipci, koseKaymasi } from "../lib/quadTracker";
import type { Quad } from "../lib/documentScan";

const W = 1000;
function kare(x: number, y: number, k = 400): Quad {
  return [
    { x, y },
    { x: x + k, y },
    { x: x + k, y: y + k },
    { x, y: y + k },
  ];
}

/**
 * Kullanıcı bildirimi: "Çerçeve çıkıyor, bazen tam buluyor ama hemen kayboluyor."
 * Sebep, tespitin tek bir karede başarısız olmasının çerçeveyi silmesi ve en ufak
 * titremenin kararlılık sayacını sıfırlamasıydı.
 */
describe("canlı kenar takipçisi", () => {
  it("tek bir başarısız karede çerçeveyi söndürmez", () => {
    const t = new QuadTakipci();
    t.guncelle(kare(100, 100), W, 0);
    const d = t.guncelle(null, W, 120);
    expect(d.quad).not.toBeNull();
    expect(d.taze).toBe(false);
  });

  it("koruma süresi dolunca çerçeveyi bırakır", () => {
    const t = new QuadTakipci({ korumaMs: 500 });
    t.guncelle(kare(100, 100), W, 0);
    expect(t.guncelle(null, W, 900).quad).toBeNull();
  });

  it("küçük el titremesini yumuşatır (çerçeve zıplamaz)", () => {
    const t = new QuadTakipci({ alfa: 0.35 });
    t.guncelle(kare(100, 100), W, 0);
    const d = t.guncelle(kare(110, 100), W, 120);
    // Düzleştirme sayesinde çerçeve 10 piksellik sıçramanın tamamını almaz.
    expect(d.quad![0]!.x).toBeGreaterThan(100);
    expect(d.quad![0]!.x).toBeLessThan(108);
  });

  it("titreme olsa da kararlılık birikir ve otomatik çekim tetiklenir", () => {
    const t = new QuadTakipci({ gerekliKararliMs: 1000 });
    let d = t.guncelle(kare(100, 100), W, 0);
    for (let i = 1; i <= 16; i++) {
      // Her karede birkaç piksel oynasın + arada tespit kaçsın.
      const olcum = i % 4 === 0 ? null : kare(100 + (i % 3), 100 + (i % 2));
      d = t.guncelle(olcum, W, i * 120);
    }
    expect(d.kararlilik).toBe(1);
    expect(d.cekilsin).toBe(true);
  });

  it("tek karelik uçuk sıçramayı kabul etmez", () => {
    const t = new QuadTakipci();
    t.guncelle(kare(100, 100), W, 0);
    const d = t.guncelle(kare(800, 600), W, 120);
    expect(d.quad![0]!.x).toBeLessThan(200);
  });

  it("sıçrama üst üste doğrulanırsa yeni konuma geçer (belge gerçekten taşındı)", () => {
    const t = new QuadTakipci({ sicramaOnayi: 2 });
    t.guncelle(kare(100, 100), W, 0);
    t.guncelle(kare(600, 400), W, 120);
    const d = t.guncelle(kare(600, 400), W, 240);
    expect(d.quad![0]!.x).toBeGreaterThan(500);
    expect(d.kararlilik).toBe(0); // yeni konumda sabitlik sıfırdan sayılır
  });

  it("belge sürüklenirken otomatik çekim tetiklenmez", () => {
    const t = new QuadTakipci({ gerekliKararliMs: 1000 });
    let d = t.guncelle(kare(100, 100), W, 0);
    for (let i = 1; i <= 12; i++) d = t.guncelle(kare(100 + i * 20, 100), W, i * 120);
    expect(d.cekilsin).toBe(false);
  });

  it("zayıf güvenli ölçümle otomatik çekim yapmaz (çerçeve yine çizilir)", () => {
    const t = new QuadTakipci({ gerekliKararliMs: 600, cekimGuveni: 0.6 });
    let d = t.guncelle(kare(100, 100), W, 0, 0.35);
    for (let i = 1; i <= 10; i++) d = t.guncelle(kare(100, 100), W, i * 120, 0.35);
    expect(d.quad).not.toBeNull();
    expect(d.cekilsin).toBe(false);
  });

  it("güven yükselince çekim tetiklenir", () => {
    const t = new QuadTakipci({ gerekliKararliMs: 600, cekimGuveni: 0.6 });
    let d = t.guncelle(kare(100, 100), W, 0, 0.9);
    for (let i = 1; i <= 10; i++) d = t.guncelle(kare(100, 100), W, i * 120, 0.9);
    expect(d.cekilsin).toBe(true);
  });

  it("sıfırlayınca hiçbir şey hatırlamaz", () => {
    const t = new QuadTakipci();
    t.guncelle(kare(100, 100), W, 0);
    t.sifirla();
    expect(t.guncelle(null, W, 10).quad).toBeNull();
  });

  it("köşe kayması ortalama uzaklığı verir", () => {
    expect(koseKaymasi(kare(0, 0), kare(3, 4))).toBeCloseTo(5);
  });
});
