import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { ustveriOku, ustveriTemizle, jpegUstveriSil } from "../lib/pdfMetadata";

/**
 * PDF ÜSTVERİ TEMİZLEME.
 *
 * Korunan davranışlar: belge özelliklerinin GERÇEKTEN silinmesi, XMP bloğunun ve
 * belge kimliğinin de gitmesi (çoğu araç bunları atlıyor), gömülü JPEG'lerin
 * EXIF/GPS bloklarının ayıklanması ve görüntünün bozulmaması.
 */

/** Üstveri dolu bir örnek belge. */
async function ornekBelge(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  pdf.setTitle("Gizli Teklif");
  pdf.setAuthor("Ayşe Yılmaz");
  pdf.setSubject("Fiyat görüşmesi");
  pdf.setKeywords(["teklif", "gizli"]);
  pdf.setCreator("Kurum Şablonu 3.2");
  pdf.setProducer("Şirket PDF Üreteci");
  return pdf.save();
}

/** İçinde XMP bloğu olan belge. */
async function xmpliBelge(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  const xmp = pdf.context.stream("<?xpacket begin=''?><x:xmpmeta/>", {
    Type: "Metadata",
    Subtype: "XML",
  });
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(xmp));
  return pdf.save();
}

/** EXIF bloğu taşıyan küçük bir JPEG (gerçek işaret yapısıyla). */
function exifliJpeg(): Uint8Array {
  const exifGovde = new Uint8Array(20).fill(0x41); // sahte EXIF içeriği
  const app1Uzunluk = exifGovde.length + 2;
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, (app1Uzunluk >> 8) & 0xff, app1Uzunluk & 0xff, ...exifGovde, // APP1 (EXIF)
    0xff, 0xe2, 0x00, 0x06, 0x49, 0x43, 0x43, 0x00, // APP2 (ICC renk profili — KORUNMALI)
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x01, // DQT (görüntü verisi)
    0xff, 0xda, 0x00, 0x03, 0x01, 0x11, 0x22, 0x33, // SOS + veri
  ]);
}

describe("üstveri okuma", () => {
  it("dolu alanları listeler", async () => {
    const ozet = await ustveriOku(await ornekBelge());
    expect(ozet.alanlar["Title"]).toBe("Gizli Teklif");
    expect(ozet.alanlar["Author"]).toBe("Ayşe Yılmaz");
    expect(ozet.alanlar["Producer"]).toBe("Şirket PDF Üreteci");
  });

  it("belgeyi açarken üstveriyi DEĞİŞTİRMEZ", async () => {
    // Kütüphane varsayılan ayarla "Producer" alanına kendi adını yazıyor;
    // temizleme aracında bu, silineni yenisiyle değiştirmek olurdu.
    const ozet = await ustveriOku(await ornekBelge());
    expect(ozet.alanlar["Producer"]).not.toMatch(/pdf-lib/i);
  });

  it("XMP bloğunu tespit eder", async () => {
    expect((await ustveriOku(await xmpliBelge())).xmpVar).toBe(true);
  });
});

describe("üstveri temizleme", () => {
  it("belge özelliklerini siler", async () => {
    const { bytes } = await ustveriTemizle(await ornekBelge());
    const ozet = await ustveriOku(bytes);
    expect(ozet.alanlar).toEqual({});
  });

  it("XMP bloğunu da siler (çoğu araç bunu atlıyor)", async () => {
    const { bytes } = await ustveriTemizle(await xmpliBelge());
    expect((await ustveriOku(bytes)).xmpVar).toBe(false);
  });

  it("belge kimliğini siler", async () => {
    const { bytes } = await ustveriTemizle(await ornekBelge());
    expect((await ustveriOku(bytes)).kimlikVar).toBe(false);
  });

  it("temizlik sonrası kendi adını da yazmaz", async () => {
    const { bytes } = await ustveriTemizle(await ornekBelge());
    const metin = new TextDecoder("latin1").decode(bytes);
    expect(metin).not.toMatch(/pdf-lib/i);
  });

  it("sayfalar korunur (belge bozulmaz)", async () => {
    const { bytes } = await ustveriTemizle(await ornekBelge());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("kullanıcı isterse yeni değer yazabilir", async () => {
    const { bytes } = await ustveriTemizle(await ornekBelge(), {
      yeniAlanlar: { Title: "Teklif", Author: "Şirket" },
    });
    const ozet = await ustveriOku(bytes);
    expect(ozet.alanlar["Title"]).toBe("Teklif");
    expect(ozet.alanlar["Author"]).toBe("Şirket");
    expect(ozet.alanlar["Subject"]).toBeUndefined();
  });
});

describe("gömülü görsel EXIF temizliği", () => {
  it("EXIF bloğunu atar, renk profilini ve görüntüyü korur", () => {
    const { cikti, temizlendi } = jpegUstveriSil(exifliJpeg());
    expect(temizlendi).toBe(true);
    const metin = Array.from(cikti);
    // APP1 (0xFFE1) gitmeli
    expect(metin.some((b, i) => b === 0xff && metin[i + 1] === 0xe1)).toBe(false);
    // APP2/ICC (0xFFE2) ve SOS (0xFFDA) kalmalı
    expect(metin.some((b, i) => b === 0xff && metin[i + 1] === 0xe2)).toBe(true);
    expect(metin.some((b, i) => b === 0xff && metin[i + 1] === 0xda)).toBe(true);
    expect(cikti.length).toBeLessThan(exifliJpeg().length);
  });

  it("üstverisi olmayan JPEG'e dokunmaz", () => {
    const sade = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x03, 0x01, 0x22]);
    const { cikti, temizlendi } = jpegUstveriSil(sade);
    expect(temizlendi).toBe(false);
    expect(cikti).toBe(sade);
  });

  it("JPEG olmayan veriyi olduğu gibi bırakır", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(jpegUstveriSil(png).temizlendi).toBe(false);
  });

  it("PDF'e gömülü JPEG'in EXIF'ini temizler ve sayar", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    const stream = PDFRawStream.of(
      pdf.context.obj({
        Type: "XObject",
        Subtype: "Image",
        Filter: "DCTDecode",
        Width: 1,
        Height: 1,
        ColorSpace: "DeviceRGB",
        BitsPerComponent: 8,
      }),
      exifliJpeg(),
    );
    pdf.context.register(stream);
    const kaynak = await pdf.save();

    expect((await ustveriOku(kaynak)).exifliGorsel).toBe(1);
    const { bytes, temizlenenGorsel } = await ustveriTemizle(kaynak, { gorselleriTemizle: true });
    expect(temizlenenGorsel).toBe(1);
    expect((await ustveriOku(bytes)).exifliGorsel).toBe(0);
  });

  it("seçenek kapalıyken görsellere dokunmaz", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]);
    pdf.context.register(
      PDFRawStream.of(pdf.context.obj({ Filter: "DCTDecode" }), exifliJpeg()),
    );
    const { bytes, temizlenenGorsel } = await ustveriTemizle(await pdf.save());
    expect(temizlenenGorsel).toBe(0);
    expect((await ustveriOku(bytes)).exifliGorsel).toBe(1);
  });
});
