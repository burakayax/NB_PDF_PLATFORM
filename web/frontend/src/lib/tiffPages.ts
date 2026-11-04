/**
 * Çok sayfalı TIFF'i cihazda sayfa sayfa PNG'ye açar (Görsel → PDF için).
 *
 * Tarayıcılar TIFF'i göstermez/çizemez ve PDF'e gömülemez; bu yüzden dosya, küçük bir çözücüyle (utif2,
 * yalnızca TIFF seçilince yüklenir) sayfalarına ayrılır. Her sayfa PNG olur, sırası korunur. Dosya sunucuya gitmez.
 */

/** Dosya TIFF mi? (Bazı sistemlerde `type` boş gelir; uzantıya da bakılır.) */
export function isTiffFile(file: { name: string; type: string }): boolean {
  return /^image\/tiff?$/i.test(file.type) || /\.tiff?$/i.test(file.name);
}

async function rgbaToPng(rgba: Uint8Array, width: number, height: number): Promise<ArrayBuffer> {
  const clamped = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const data = new ImageData(clamped as Uint8ClampedArray<ArrayBuffer>, width, height);
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(width, height);
    c.getContext("2d")!.putImageData(data, 0, 0);
    return (await c.convertToBlob({ type: "image/png" })).arrayBuffer();
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  c.getContext("2d")!.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) throw new Error("TIFF sayfası görsele çevrilemedi.");
  return blob.arrayBuffer();
}

/** JPG/PNG dışındaki (ör. WebP) bir görseli tarayıcıyla çözüp PNG'ye çevirir; PDF'e gömülebilen biçimler yalnız JPG ve PNG'dir. */
async function imageToPng(file: Blob): Promise<ArrayBuffer> {
  const bmp = await createImageBitmap(file);
  try {
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) throw new Error("Görsel PNG'ye çevrilemedi.");
    return blob.arrayBuffer();
  } finally {
    bmp.close();
  }
}

/**
 * Görsel → PDF için dosyaları PDF'e gömülebilir hale getirir, dosya sırası korunur:
 * JPG/PNG olduğu gibi, çok sayfalı TIFF sayfa sayfa PNG, WebP vb. PNG olarak.
 * Hem ziyaretçi kutusu hem çalışma alanı bunu kullanır (ikisi ayrışmasın diye tek yer).
 */
export async function filesToImageInputs(files: File[]): Promise<{ bytes: ArrayBuffer; mime: string }[]> {
  const out: { bytes: ArrayBuffer; mime: string }[] = [];
  for (const f of files) {
    if (isTiffFile(f)) {
      for (const page of await tiffToPngPages(await f.arrayBuffer())) out.push({ bytes: page, mime: "image/png" });
    } else if (/^image\/(png|jpe?g)$/i.test(f.type)) {
      out.push({ bytes: await f.arrayBuffer(), mime: f.type });
    } else {
      out.push({ bytes: await imageToPng(f), mime: "image/png" });
    }
  }
  return out;
}

/** TIFF dosyasının tüm sayfalarını sırayla PNG olarak döndürür. */
export async function tiffToPngPages(bytes: ArrayBuffer): Promise<ArrayBuffer[]> {
  const UTIF = (await import("utif2")).default ?? (await import("utif2"));
  const ifds = UTIF.decode(bytes);
  const pages: ArrayBuffer[] = [];
  for (const ifd of ifds) {
    // Küçük resim/alt görüntü kayıtlarında boyut yoktur; yalnız gerçek sayfalar alınır.
    UTIF.decodeImage(bytes, ifd);
    if (!ifd.width || !ifd.height) continue;
    pages.push(await rgbaToPng(UTIF.toRGBA8(ifd), ifd.width, ifd.height));
  }
  if (pages.length === 0) throw new Error("TIFF dosyasında okunabilir sayfa yok.");
  return pages;
}
