import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } from "pdf-lib";
import { nUpYap, kitapcikYap } from "../lib/pdfImposition";

/** 4 sayfa, hepsi AYNI büyük görseli (tek nesne) kullanır — gerçek belgelerde ortak logo/arka plan gibi. */
async function ortakGorselliPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const ham = new Uint8Array(200 * 200);
  let x = 12345;
  for (let i = 0; i < ham.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff; // sıkıştırılamayan sahte gürültü
    ham[i] = x >> 16;
  }
  const gorsel = ctx.register(
    ctx.stream(ham, { Type: "XObject", Subtype: "Image", Width: 200, Height: 200, ColorSpace: "DeviceGray", BitsPerComponent: 8 }),
  );
  for (let i = 0; i < 4; i++) {
    const sayfa = doc.addPage([300, 400]);
    sayfa.node.setXObject(PDFName.of("Im1"), gorsel);
    sayfa.pushOperators(pushGraphicsState(), concatTransformationMatrix(250, 0, 0, 250, 25, 75), drawObject("Im1"), popGraphicsState());
  }
  return doc.save({ useObjectStreams: false });
}

describe("sayfa düzeni — ortak kaynaklar bir kez gömülür", () => {
  it("4'lü düzen çıktısı, ortak görseli 4 kez taşımaz", async () => {
    const girdi = await ortakGorselliPdf();
    const cikti = await nUpYap(girdi, { adet: 4 });
    // Görsel ~40 KB; 4 kopya olsaydı çıktı ~160 KB olurdu. Tek kopya + küçük ek yük beklenir.
    expect(cikti.byteLength).toBeLessThan(girdi.byteLength * 1.3);
  });

  it("kitapçık çıktısı da ortak görseli çoğaltmaz", async () => {
    const girdi = await ortakGorselliPdf();
    const cikti = await kitapcikYap(girdi);
    expect(cikti.byteLength).toBeLessThan(girdi.byteLength * 1.3);
  });
});
