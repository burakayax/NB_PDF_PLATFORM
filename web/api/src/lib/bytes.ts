/**
 * Node `Buffer` → veritabanının `Bytes` alanı.
 *
 * NEDEN GEREKLİ: `Buffer` çalışma anında ZATEN bir `Uint8Array`; aralarında
 * dönüşüm yok, fark yalnızca TİPTE. `Buffer`ın arkasındaki arabellek
 * `ArrayBufferLike` olarak tiplenmiş (kuramsal olarak `SharedArrayBuffer` da
 * olabilir), Prisma ise `Uint8Array<ArrayBuffer>` istiyor. TypeScript 5.8 bu
 * farkı görmezden geliyordu, 6.0 ise hata veriyor.
 *
 * NEDEN KOPYALAMIYORUZ: `new Uint8Array(buf)` de derlenirdi ama baytları
 * KOPYALARDI. Buraya gelen veriler yüklenen PDF'ler ve taranmış belgeler —
 * onlarca megabayt olabiliyor. Her yüklemede gereksiz bir tam kopya, boşuna
 * bellek ve CPU demek.
 *
 * NEDEN GÜVENLİ: Bu yoldan geçen `Buffer`lar dosya yüklemesinden geliyor
 * (multer / istek gövdesi). Node bunları havuzdan, düz `ArrayBuffer` üzerinde
 * tahsis eder; `SharedArrayBuffer` ancak açıkça öyle oluşturulursa devreye
 * girer ve bu kod yolunda öyle bir şey yok. Yani daraltma gerçeği yansıtıyor.
 *
 * Her iki derleyicide de (5.8 ve 6.0) derlendiği doğrulandı.
 */
export function bufferToBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  return buf as unknown as Uint8Array<ArrayBuffer>;
}
