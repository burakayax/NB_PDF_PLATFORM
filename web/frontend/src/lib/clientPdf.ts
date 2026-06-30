/**
 * Tarayıcı-içi (client-side) PDF motoru — pdf-lib ile. Dosyalar SUNUCUYA HİÇ
 * GİTMEDEN cihazda işlenir: anında sonuç, %100 gizlilik, sıfır sunucu maliyeti,
 * çevrimdışı çalışır. Yapısal araçlar (birleştir, görsel→PDF, döndür, sayfa sil,
 * yeniden sırala) buradan koşar; dönüştürme/OCR/sıkıştırma gibi ağır işler
 * sunucuda kalır.
 *
 * NOT: pdf-lib şifre korumalı (encrypted) PDF'leri ÇÖZEMEZ. Şifreli dosyalar
 * için sunucu yoluna düşülür (çağıran taraf `PdfEncryptedError`'ı yakalar).
 */
import { PDFDocument, degrees } from "pdf-lib";

export class PdfEncryptedError extends Error {
  constructor() {
    super("PDF is encrypted; client-side processing not supported.");
    this.name = "PdfEncryptedError";
  }
}

async function loadPdf(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  try {
    // ignoreEncryption: false → şifreliyse hata fırlatır (sunucuya düşmek için).
    return await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (msg.includes("encrypt")) throw new PdfEncryptedError();
    throw e;
  }
}

/** Birden fazla PDF'i tek belgede birleştirir. Sayfalar `files` sırasına göre eklenir. */
export async function mergePdfs(
  files: Array<ArrayBuffer | Uint8Array>,
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("No files to merge.");
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await loadPdf(bytes);
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  return out.save();
}

type ImageInput = { bytes: ArrayBuffer | Uint8Array; mime: string };

/** Görselleri (JPG/PNG) tek PDF'e çevirir. Her görsel kendi boyutunda bir sayfa olur. */
export async function imagesToPdf(images: ImageInput[]): Promise<Uint8Array> {
  if (images.length === 0) throw new Error("No images.");
  const out = await PDFDocument.create();
  for (const img of images) {
    const isPng = img.mime.includes("png");
    const embedded = isPng
      ? await out.embedPng(img.bytes)
      : await out.embedJpg(img.bytes);
    const page = out.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  }
  return out.save();
}

/** Sayfaları döndürür. `rotations`: sayfa index → derece (0/90/180/270). */
export async function rotatePdf(
  bytes: ArrayBuffer | Uint8Array,
  rotations: Record<number, number>,
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  for (const [idxStr, deg] of Object.entries(rotations)) {
    const i = Number(idxStr);
    if (pages[i] && deg % 360 !== 0) {
      const current = pages[i]!.getRotation().angle;
      pages[i]!.setRotation(degrees((current + deg) % 360));
    }
  }
  return doc.save();
}

/** Belirtilen (0-tabanlı) sayfaları siler. */
export async function deletePages(
  bytes: ArrayBuffer | Uint8Array,
  pagesToDelete: number[],
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  // Büyükten küçüğe sil ki index'ler kaymasın.
  const sorted = [...new Set(pagesToDelete)].sort((a, b) => b - a);
  for (const i of sorted) {
    if (i >= 0 && i < doc.getPageCount()) doc.removePage(i);
  }
  if (doc.getPageCount() === 0) throw new Error("All pages would be deleted.");
  return doc.save();
}

/** Sayfaları yeni sıraya göre yeniden dizer. `order`: yeni sırada eski index'ler. */
export async function reorderPages(
  bytes: ArrayBuffer | Uint8Array,
  order: number[],
): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, order);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

/** PDF sayfa sayısı (şifreliyse `PdfEncryptedError` fırlatır). Görsel seçici
 * modalı `maxPage`'i önceden ister. */
export async function getPdfPageCount(
  bytes: ArrayBuffer | Uint8Array,
): Promise<number> {
  const doc = await loadPdf(bytes);
  return doc.getPageCount();
}

/** Yardımcı: Uint8Array → indirilebilir Blob (application/pdf). */
export function pdfBytesToBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
