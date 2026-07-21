/**
 * clientPdf ÇEKİRDEĞİ — pdf-lib/fontkit/fflate GEREKTİRMEYEN hafif parçalar.
 *
 * NEDEN AYRI DOSYA: `PdfEncryptedError`, `pdfBytesToBlob`, `zipBytesToBlob` ve
 * saf tipler; hem ağır `clientPdf.ts` (pdf-lib) hem de ana-thread'de statik
 * çalışan `clientPdfWorker.ts` tarafından kullanılıyor. Bunlar buraya çekilerek
 * ana JS paketi (main chunk) pdf-lib'i EAGER indirmekten kurtulur: landing/blog
 * ziyaretçisi hiç araç açmadan yüzlerce KB pdf-lib indirmez. Ağır işlemler ancak
 * bir araç çalıştırıldığında (worker veya lazy chunk) yüklenir.
 *
 * KRİTİK: `PdfEncryptedError` TEK KAYNAK olmalı — çağıranlar `instanceof
 * PdfEncryptedError` ile kontrol ediyor; sınıf çoğaltılırsa instanceof kırılır.
 */

/** pdf-lib şifreli PDF'i çözemez; çağıran bunu yakalayıp sunucu yoluna düşer. */
export class PdfEncryptedError extends Error {
  constructor() {
    super("PDF is encrypted; client-side processing not supported.");
    this.name = "PdfEncryptedError";
  }
}

/** Aranabilir PDF için tek kelime — konum KAYNAK GÖRÜNTÜ pikselinde (sol-üst origin). */
export type SearchableWord = { text: string; x0: number; y0: number; x1: number; y1: number };
export type SearchablePage = {
  bytes: ArrayBuffer | Uint8Array;
  mime: string;
  words: SearchableWord[];
};

/**
 * İmza/alan yerleşimi — koordinatlar sayfaya oranlı (0..1), ZOOM'dan bağımsız.
 * `yNorm` ÜST-tabanlıdır (sol-üst köşe); pdf-lib alt-sol origin'e çevrilir.
 */
export type SignatureItem = {
  pngBytes: Uint8Array;
  aspect: number; // görselin en/boy oranı (w/h)
  page: number; // 0-tabanlı sayfa
  xNorm: number; // sol-üst x / sayfa genişliği
  yNorm: number; // sol-üst y / sayfa yüksekliği (üstten)
  wNorm: number; // genişlik / sayfa genişliği
  opacity?: number; // 0..1 saydamlık (varsayılan 1)
  /** Ekran saat yönünde derece (varsayılan 0); merkez etrafında döndürülür. */
  rotationDeg?: number;
};

/**
 * Yorumlama (annotation) öğeleri — hepsi sayfaya ORANLI koordinatlarla (0..1),
 * `yNorm` ÜST-tabanlıdır (sol-üst köşe). Renk 0..1 [r,g,b]. Cihazda pdf-lib ile
 * vektörel olarak gömülür (metin hariç; metin Türkçe-güvenli PNG olarak gelir).
 */
export type AnnotationItem =
  | {
      type: "highlight" | "rect";
      page: number;
      xNorm: number;
      yNorm: number;
      wNorm: number;
      hNorm: number;
      color: [number, number, number];
      /** rect için kenarlık kalınlığı (pt); highlight'ta yok sayılır. */
      borderWidth?: number;
    }
  | {
      type: "pen";
      page: number;
      /** Ardışık nokta dizisi [xNorm, yNorm]; aralar çizgiyle birleştirilir. */
      pointsNorm: Array<[number, number]>;
      color: [number, number, number];
      thickness: number; // pt
      /** Fosforlu/keçeli kalem için 0..1 saydamlık (yazı görünür kalsın). */
      opacity?: number;
    }
  | {
      type: "line";
      page: number;
      x1Norm: number;
      y1Norm: number;
      x2Norm: number;
      y2Norm: number;
      color: [number, number, number];
      thickness: number; // pt
      arrow?: boolean; // uç noktada ok başı çiz
    }
  | {
      type: "image"; // metin kutusu / not — PNG olarak gömülür
      page: number;
      xNorm: number;
      yNorm: number;
      wNorm: number;
      aspect: number;
      pngBytes: Uint8Array;
    };

/** Yardımcı: Uint8Array → indirilebilir Blob (application/pdf). */
export function pdfBytesToBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Yardımcı: ZIP bytes → Blob (application/zip). */
export function zipBytesToBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/zip" });
}
