/**
 * SAYFA DÜZENİ (dizgi) — cihazda.
 *
 * İki iş yapar:
 *
 *  1) N-UP: birden çok sayfayı TEK yaprağa sığdırır (2, 4, 6, 8, 9, 16).
 *     Kâğıt ve mürekkep tasarrufu; ders notu, sunum çıktısı, kontrol listesi
 *     yazdıranların en sık istediği şey.
 *
 *  2) KİTAPÇIK: sayfaları öyle bir sıraya dizer ki, çift taraflı yazdırıp
 *     ortadan katladığında elinde sırayla okunan bir kitapçık kalır.
 *
 * KİTAPÇIK SIRALAMASININ MATEMATİĞİ (kaynaklarla doğrulandı): Sayfa sayısı 4'ün
 * katına tamamlanır (eksikler boş sayfayla). N sayfalık bir kitapçıkta ilk
 * yaprağın ÖN yüzünde N ve 1, ARKA yüzünde 2 ve N-1 bulunur; sonraki yaprak bir
 * adım içeri kayar (N-2 ve 3, sonra 4 ve N-3) ve orta yaprağa kadar böyle gider.
 * Yani k'ıncı yaprak (0'dan başlayarak):
 *      ön  → [N - 2k, 2k + 1]
 *      arka → [2k + 2, N - 2k - 1]
 *
 * Bu sıra yanlış kurulursa çıktı basıldıktan ve katlandıktan SONRA anlaşılır —
 * kullanıcı kâğıdı çöpe atar. Bu yüzden sıralama ayrı bir işlevde tutulur ve
 * testlerle sabitlenir.
 */
import { PDFDocument, type PDFEmbeddedPage } from "pdf-lib";

/** A4 dikey (nokta cinsinden, 72 nokta = 1 inç). */
export const A4 = { en: 595.28, boy: 841.89 };

export type NUpSecenekleri = {
  /** Bir yaprağa kaç sayfa: 2, 4, 6, 8, 9 ya da 16. */
  adet: number;
  /** Sayfalar arası ve kenar boşluğu (nokta). */
  bosluk?: number;
  /** Her küçük sayfanın çevresine ince çerçeve çiz. */
  cerceve?: boolean;
};

/** Bir yaprakta kaç sütun/satır olacağını verir (kâğıdı en verimli dolduracak biçimde). */
export function izgara(adet: number, yatayKagit: boolean): { sutun: number; satir: number } {
  const tablo: Record<number, [number, number]> = {
    2: [1, 2],
    4: [2, 2],
    6: [2, 3],
    8: [2, 4],
    9: [3, 3],
    16: [4, 4],
  };
  const [a, b] = tablo[adet] ?? [2, 2];
  // Yatay kâğıtta sütun sayısı fazla, dikeyde satır sayısı fazla olur.
  return yatayKagit ? { sutun: Math.max(a, b), satir: Math.min(a, b) } : { sutun: Math.min(a, b), satir: Math.max(a, b) };
}

/**
 * Kitapçık için yaprak sırasını üretir.
 *
 * @param sayfaSayisi kaynak belgedeki sayfa sayısı
 * @returns Her elemanı bir YAPRAK YÜZÜ olan dizi; her yüzde soldan sağa iki
 *   sayfa numarası (1'den başlar). `null` boş sayfa demektir.
 */
export function kitapcikSirasi(sayfaSayisi: number): (number | null)[][] {
  if (sayfaSayisi <= 0) return [];
  const N = Math.ceil(sayfaSayisi / 4) * 4; // 4'ün katına tamamla
  const varMi = (n: number) => (n >= 1 && n <= sayfaSayisi ? n : null);
  const yuzler: (number | null)[][] = [];
  for (let k = 0; k < N / 4; k++) {
    yuzler.push([varMi(N - 2 * k), varMi(2 * k + 1)]); // ön yüz
    yuzler.push([varMi(2 * k + 2), varMi(N - 2 * k - 1)]); // arka yüz
  }
  return yuzler;
}

/**
 * Kaynak sayfaları TEK TEK gömer.
 *
 * NEDEN TEK TEK: Kütüphane hepsini birden gömerken, içeriği HİÇ olmayan bir
 * sayfaya rastlarsa tüm işlemi hata ile durduruyor ("Can't embed page with
 * missing Contents"). Gerçek belgelerde tamamen boş sayfa olabilir (ör. bölüm
 * arası); tek boş sayfa yüzünden kullanıcının 200 sayfalık işi başarısız
 * olmamalı. Gömülemeyen sayfanın yeri çıktıda boş bırakılır.
 */
async function sayfalariGom(
  cikti: PDFDocument,
  kaynak: PDFDocument,
): Promise<(PDFEmbeddedPage | null)[]> {
  const sonuc: (PDFEmbeddedPage | null)[] = [];
  for (const sayfa of kaynak.getPages()) {
    // Hata gömme anında değil KAYDETME anında ortaya çıkıyor; bu yüzden sayfa
    // önceden elenir: içerik akışı yoksa gömmeye hiç kalkışılmaz.
    if (!sayfa.node.Contents()) {
      sonuc.push(null);
      continue;
    }
    try {
      const [g] = await cikti.embedPages([sayfa]);
      sonuc.push(g ?? null);
    } catch {
      sonuc.push(null); // bozuk sayfa → yeri boş kalır
    }
  }
  if (sonuc.every((g) => g === null)) {
    throw new Error("Belgede yerleştirilebilecek sayfa yok.");
  }
  return sonuc;
}

/** Gömülü sayfayı verilen kutuya, oranını BOZMADAN ortalayarak yerleştirir. */
function kutuyaYerlestir(
  gomulu: PDFEmbeddedPage,
  kutu: { x: number; y: number; en: number; boy: number },
) {
  const olcek = Math.min(kutu.en / gomulu.width, kutu.boy / gomulu.height);
  const en = gomulu.width * olcek;
  const boy = gomulu.height * olcek;
  return {
    x: kutu.x + (kutu.en - en) / 2,
    y: kutu.y + (kutu.boy - boy) / 2,
    width: en,
    height: boy,
  };
}

/**
 * Birden çok sayfayı tek yaprağa sığdırır.
 *
 * Kaynak sayfaların oranı korunur (esnetilmez); sayfa yatay ise yaprak da yatay
 * seçilir, böylece kâğıt daha çok dolar.
 */
export async function nUpYap(
  bytes: ArrayBuffer | Uint8Array,
  secenekler: NUpSecenekleri,
): Promise<Uint8Array> {
  const adet = [2, 4, 6, 8, 9, 16].includes(secenekler.adet) ? secenekler.adet : 4;
  const bosluk = secenekler.bosluk ?? 12;

  const kaynak = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const toplam = kaynak.getPageCount();
  if (toplam === 0) throw new Error("Belgede sayfa yok.");

  const ilk = kaynak.getPage(0);
  const kaynakYatay = ilk.getWidth() > ilk.getHeight();
  // 2'li düzende kâğıdı çevirmek en verimlisi: iki dikey sayfa yan yana sığar.
  const yaprakYatay = adet === 2 ? !kaynakYatay : kaynakYatay;
  const yaprakEn = yaprakYatay ? A4.boy : A4.en;
  const yaprakBoy = yaprakYatay ? A4.en : A4.boy;
  const { sutun, satir } = izgara(adet, yaprakYatay);

  const cikti = await PDFDocument.create();
  const gomulu = await sayfalariGom(cikti, kaynak);

  const hucreEn = (yaprakEn - bosluk * (sutun + 1)) / sutun;
  const hucreBoy = (yaprakBoy - bosluk * (satir + 1)) / satir;

  for (let i = 0; i < toplam; i += adet) {
    const yaprak = cikti.addPage([yaprakEn, yaprakBoy]);
    for (let j = 0; j < adet && i + j < toplam; j++) {
      const s = j % sutun;
      const r = Math.floor(j / sutun);
      const kutu = {
        x: bosluk + s * (hucreEn + bosluk),
        // pdf-lib'in başlangıç noktası SOL ALT; satırları yukarıdan aşağı dizmek
        // için satır sırası ters çevrilir.
        y: yaprakBoy - bosluk - (r + 1) * hucreBoy - r * bosluk,
        en: hucreEn,
        boy: hucreBoy,
      };
      const g = gomulu[i + j];
      if (g) yaprak.drawPage(g, kutuyaYerlestir(g, kutu));
      if (secenekler.cerceve) {
        yaprak.drawRectangle({
          x: kutu.x,
          y: kutu.y,
          width: kutu.en,
          height: kutu.boy,
          borderWidth: 0.5,
          borderOpacity: 0.35,
          opacity: 0,
        });
      }
    }
  }

  return cikti.save({ useObjectStreams: false });
}

/**
 * Kitapçık dizgisi: çift taraflı yazdırıp ortadan katlandığında sırayla okunan
 * bir kitapçık veren PDF üretir.
 *
 * Çıktı yaprakları YATAY olur ve her yaprakta iki sayfa yan yana durur.
 */
export async function kitapcikYap(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const kaynak = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const toplam = kaynak.getPageCount();
  if (toplam === 0) throw new Error("Belgede sayfa yok.");

  const ilk = kaynak.getPage(0);
  // Yaprak: kaynak sayfanın iki katı genişlikte, aynı yükseklikte.
  const yaprakEn = ilk.getWidth() * 2;
  const yaprakBoy = ilk.getHeight();

  const cikti = await PDFDocument.create();
  const gomulu = await sayfalariGom(cikti, kaynak);
  const yuzler = kitapcikSirasi(toplam);

  for (const yuz of yuzler) {
    const yaprak = cikti.addPage([yaprakEn, yaprakBoy]);
    yuz.forEach((sayfaNo, sira) => {
      if (!sayfaNo) return; // boş sayfa
      const g = gomulu[sayfaNo - 1];
      if (!g) return;
      const kutu = { x: sira * (yaprakEn / 2), y: 0, en: yaprakEn / 2, boy: yaprakBoy };
      yaprak.drawPage(g, kutuyaYerlestir(g, kutu));
    });
  }

  return cikti.save({ useObjectStreams: false });
}
