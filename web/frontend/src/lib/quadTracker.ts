/**
 * CANLI KENAR TAKİBİ — kare kare tespiti "sakin" bir çerçeveye çevirir.
 *
 * SORUN (kullanıcı bildirdi): Çerçeve çıkıyor, bazen belgeye tam oturuyor, ama
 * hemen kayboluyor ve tespit yeniden aramaya başlıyor. Sebebi, her kameranın
 * karesinin BAĞIMSIZ değerlendirilmesiydi: tespit bir karede başarısız olduğu
 * anda çerçeve siliniyor, ufak bir el titremesi de kararlılık sayacını sıfırlıyordu.
 * Otomatik çekim bu yüzden neredeyse hiç tetiklenmiyordu.
 *
 * ÇÖZÜM (canlı belge tarama literatüründeki standart yaklaşım):
 *  1) DÜZLEŞTİRME — köşeler üstel düzleştirme ile yumuşatılır
 *     (yeni = α·ölçüm + (1−α)·önceki). Tespitin doğal gürültüsü ekrana yansımaz.
 *  2) KAYIP KARE KORUMASI — tespit başarısız olduğunda çerçeve hemen silinmez,
 *     kısa bir süre (koruma süresi) son iyi konumda tutulur. Tek bir başarısız
 *     kare artık görüntüyü söndürmez.
 *  3) SIÇRAMA REDDİ — birdenbire çok uzağa atlayan (masa kenarı, gölge, desen)
 *     bir ölçüm tek başına kabul edilmez; ancak arka arkaya doğrulanırsa
 *     (kullanıcı gerçekten belgeyi taşımıştır) yeni konuma geçilir.
 *  4) SÜRE TABANLI KARARLILIK — "sabit tut" göstergesi kare sayısına değil
 *     GEÇEN SÜREYE bakar; kare hızı cihazdan cihaza değiştiği için kare saymak
 *     yavaş telefonda çekimi imkânsız kılıyordu.
 *
 * Bu dosya saf hesaptır (DOM/WASM yok) — test edilebilir.
 */
import type { Quad, Pt } from "./documentScan";

export type TakipAyarlari = {
  /** Düzleştirme katsayısı: büyük = daha çevik, küçük = daha sakin. */
  alfa: number;
  /** Tespit kaybolunca çerçevenin ekranda tutulacağı süre (ms). */
  korumaMs: number;
  /** Bu orandan (kare genişliğine göre) fazla sıçrayan ölçüm şüphelidir. */
  sicramaOrani: number;
  /** Şüpheli konum kaç kez üst üste doğrulanırsa kabul edilir. */
  sicramaOnayi: number;
  /** Kararlı sayılmak için köşe kayması bu oranın altında kalmalı. */
  kararliOran: number;
  /** Otomatik çekim için gereken kesintisiz kararlı süre (ms). */
  gerekliKararliMs: number;
};

export const VARSAYILAN_TAKIP: TakipAyarlari = {
  alfa: 0.35,
  korumaMs: 900,
  sicramaOrani: 0.25,
  sicramaOnayi: 2,
  kararliOran: 0.045,
  gerekliKararliMs: 1100,
};

export type TakipDurumu = {
  /** Ekrana çizilecek (düzleştirilmiş) dörtgen; yoksa null. */
  quad: Quad | null;
  /** 0–1 arası "sabit tutma" doluluğu. */
  kararlilik: number;
  /** Otomatik çekim tetiklenmeli mi. */
  cekilsin: boolean;
  /** Şu an gerçek bir ölçüm mü, yoksa koruma süresinde mi tutuluyor. */
  taze: boolean;
};

function harmanla(onceki: Quad, yeni: Quad, alfa: number): Quad {
  return onceki.map((p, i) => ({
    x: p.x + (yeni[i]!.x - p.x) * alfa,
    y: p.y + (yeni[i]!.y - p.y) * alfa,
  })) as Quad;
}

/** İki dörtgenin ortalama köşe kayması (piksel). */
export function koseKaymasi(a: Quad, b: Quad): number {
  let t = 0;
  for (let i = 0; i < 4; i++) t += Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
  return t / 4;
}

export class QuadTakipci {
  private ayar: TakipAyarlari;
  private duzlenmis: Quad | null = null;
  private sonOlcumAni = 0;
  private kararliMs = 0;
  private sonAn = 0;
  private aday: Quad | null = null;
  private adaySayisi = 0;

  constructor(ayar: Partial<TakipAyarlari> = {}) {
    this.ayar = { ...VARSAYILAN_TAKIP, ...ayar };
  }

  sifirla(): void {
    this.duzlenmis = null;
    this.sonOlcumAni = 0;
    this.kararliMs = 0;
    this.sonAn = 0;
    this.aday = null;
    this.adaySayisi = 0;
  }

  /**
   * @param olcum   bu karede bulunan dörtgen (bulunamadıysa null)
   * @param genislik kare genişliği (eşikler buna göre ölçeklenir)
   * @param simdi   zaman damgası (ms)
   */
  guncelle(olcum: Quad | null, genislik: number, simdi: number = Date.now()): TakipDurumu {
    const dt = this.sonAn ? Math.min(simdi - this.sonAn, 500) : 0;
    this.sonAn = simdi;
    const a = this.ayar;

    if (!olcum) {
      // Tespit bu karede başarısız: çerçeveyi hemen söndürme, kısa süre koru.
      if (this.duzlenmis && simdi - this.sonOlcumAni <= a.korumaMs) {
        // Koruma süresinde kararlılık ne artar ne sıfırlanır — belge yerinde
        // duruyor olabilir, yalnızca dedektör bir kareyi kaçırdı.
        return this.durum(false);
      }
      this.sifirlaYumusak();
      return { quad: null, kararlilik: 0, cekilsin: false, taze: false };
    }

    if (!this.duzlenmis) {
      this.duzlenmis = olcum;
      this.sonOlcumAni = simdi;
      this.kararliMs = 0;
      return this.durum(true);
    }

    const kayma = koseKaymasi(this.duzlenmis, olcum);

    if (kayma > genislik * a.sicramaOrani) {
      // Şüpheli sıçrama: aynı yeni konum üst üste doğrulanmadıkça kabul etme.
      const adayaYakin = this.aday ? koseKaymasi(this.aday, olcum) < genislik * a.kararliOran * 2 : false;
      this.aday = olcum;
      this.adaySayisi = adayaYakin ? this.adaySayisi + 1 : 1;
      if (this.adaySayisi >= a.sicramaOnayi) {
        this.duzlenmis = olcum;
        this.sonOlcumAni = simdi;
        this.kararliMs = 0;
        this.aday = null;
        this.adaySayisi = 0;
        return this.durum(true);
      }
      // Sıçrama yok sayıldı → eski çerçeve korunur (ekran sabit kalır).
      return this.durum(false);
    }

    this.aday = null;
    this.adaySayisi = 0;
    this.sonOlcumAni = simdi;
    this.kararliMs = kayma < genislik * a.kararliOran ? this.kararliMs + dt : 0;
    this.duzlenmis = harmanla(this.duzlenmis, olcum, a.alfa);
    return this.durum(true);
  }

  /** Koruma süresi dolduğunda: çerçeveyi bırak ama ayarları koru. */
  private sifirlaYumusak(): void {
    this.duzlenmis = null;
    this.kararliMs = 0;
    this.aday = null;
    this.adaySayisi = 0;
  }

  private durum(taze: boolean): TakipDurumu {
    const oran = Math.min(1, this.kararliMs / this.ayar.gerekliKararliMs);
    return {
      quad: this.duzlenmis ? (this.duzlenmis.map((p: Pt) => ({ ...p })) as Quad) : null,
      kararlilik: oran,
      cekilsin: oran >= 1,
      taze,
    };
  }
}
