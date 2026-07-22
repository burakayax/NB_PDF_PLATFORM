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
import { PDFDocument, degrees, rgb, LineCapStyle } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { zipSync } from "fflate";
import { PdfEncryptedError } from "./clientPdfCore";
import type {
  SearchableWord,
  SearchablePage,
  SignatureItem,
  AnnotationItem,
} from "./clientPdfCore";

// Geriye-uyum: `./clientPdf`'ten doğrudan import eden çağıranlar (SearchablePdfTool,
// testler, summaryPdf) bu hafif sembolleri buradan almaya devam edebilsin.
export { PdfEncryptedError, pdfBytesToBlob, zipBytesToBlob } from "./clientPdfCore";
export type {
  SearchableWord,
  SearchablePage,
  SignatureItem,
  AnnotationItem,
} from "./clientPdfCore";

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

/**
 * Görselleri, üzerine GÖRÜNMEZ metin katmanı (OCR) gömülü ARANABİLİR PDF'e çevirir.
 * Görsel göze aynı görünür; arkasındaki metin seçilebilir/aranabilir olur (Ctrl+F,
 * kopyala, ekran okuyucu). Türkçe için Unicode font (`fontBytes`, ör. Roboto)
 * fontkit ile gömülür. Her şey cihazda; dosya sunucuya gitmez.
 */
export async function imagesToSearchablePdf(
  pages: SearchablePage[],
  fontBytes: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error("No pages.");
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const font = await out.embedFont(fontBytes, { subset: true });
  for (const pg of pages) {
    const isPng = pg.mime.includes("png");
    const img = isPng ? await out.embedPng(pg.bytes) : await out.embedJpg(pg.bytes);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    for (const w of pg.words) {
      const h = Math.max(1, w.y1 - w.y0);
      const size = h * 0.8;
      try {
        // opacity 0 → görünmez ama seçilebilir/aranabilir. pdf-lib origin sol-alt.
        page.drawText(w.text, {
          x: w.x0,
          y: img.height - w.y1 + h * 0.15,
          size,
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      } catch {
        /* fontta olmayan karakter → o kelimeyi atla, PDF bozulmasın */
      }
    }
  }
  return out.save();
}

/**
 * İmza (ve metin) görsellerini PDF'e GÖMER — cihazda, düzleştirilmiş çıktı.
 * Aynı görsel birden çok yerde kullanılıyorsa bir kez embed edilir (boyut).
 */
export async function applySignatures(
  pdfBytes: ArrayBuffer | Uint8Array,
  items: SignatureItem[],
): Promise<Uint8Array> {
  const doc = await loadPdf(pdfBytes);
  const pages = doc.getPages();
  const embedCache = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const it of items) {
    const page = pages[it.page];
    if (!page) continue;
    let img = embedCache.get(it.pngBytes);
    if (!img) {
      img = await doc.embedPng(it.pngBytes);
      embedCache.set(it.pngBytes, img);
    }
    const { width: pw, height: ph } = page.getSize();
    const w = it.wNorm * pw;
    const h = it.aspect > 0 ? w / it.aspect : w;
    const op = it.opacity ?? 1;
    const rot = it.rotationDeg ?? 0;
    if (!rot) {
      const x = it.xNorm * pw;
      const y = ph - it.yNorm * ph - h; // üst-tabanlı → pdf-lib alt-sol origin
      page.drawImage(img, { x, y, width: w, height: h, opacity: op });
    } else {
      // Merkez etrafında döndür: pdf-lib köşe-pivotludur, pivot'u telafi ederiz.
      // Ekran saat yönü → pdf-lib (y-yukarı) saat tersi olduğundan açı ters işaretli.
      const phi = (-rot * Math.PI) / 180;
      const cx = it.xNorm * pw + w / 2;
      const cy = ph - it.yNorm * ph - h / 2;
      const rx = (w / 2) * Math.cos(phi) - (h / 2) * Math.sin(phi);
      const ry = (w / 2) * Math.sin(phi) + (h / 2) * Math.cos(phi);
      page.drawImage(img, {
        x: cx - rx,
        y: cy - ry,
        width: w,
        height: h,
        opacity: op,
        rotate: degrees(-rot),
      });
    }
  }
  return doc.save();
}

/**
 * Yorumlama öğelerini PDF'e GÖMER — cihazda, düzleştirilmiş çıktı. Vurgu, kutu,
 * serbest çizim, ok/çizgi ve metin/not tek geçişte işlenir.
 */
export async function applyAnnotations(
  pdfBytes: ArrayBuffer | Uint8Array,
  items: AnnotationItem[],
): Promise<Uint8Array> {
  const doc = await loadPdf(pdfBytes);
  const pages = doc.getPages();
  const imgCache = new Map<Uint8Array, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const it of items) {
    const page = pages[it.page];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();
    const col = "color" in it ? rgb(it.color[0], it.color[1], it.color[2]) : rgb(0, 0, 0);
    if (it.type === "highlight" || it.type === "rect") {
      const w = it.wNorm * pw;
      const h = it.hNorm * ph;
      const x = it.xNorm * pw;
      const y = ph - it.yNorm * ph - h; // üst-taban → pdf-lib alt-sol
      if (it.type === "highlight") {
        page.drawRectangle({ x, y, width: w, height: h, color: col, opacity: 0.35 });
      } else {
        page.drawRectangle({
          x,
          y,
          width: w,
          height: h,
          borderColor: col,
          borderWidth: it.borderWidth ?? 2,
          opacity: 0,
          borderOpacity: 1,
        });
      }
    } else if (it.type === "pen") {
      const pts = it.pointsNorm;
      for (let i = 1; i < pts.length; i++) {
        page.drawLine({
          start: { x: pts[i - 1][0] * pw, y: ph - pts[i - 1][1] * ph },
          end: { x: pts[i][0] * pw, y: ph - pts[i][1] * ph },
          thickness: it.thickness,
          color: col,
          lineCap: LineCapStyle.Round,
          opacity: it.opacity ?? 1,
        });
      }
    } else if (it.type === "line") {
      const start = { x: it.x1Norm * pw, y: ph - it.y1Norm * ph };
      const end = { x: it.x2Norm * pw, y: ph - it.y2Norm * ph };
      page.drawLine({ start, end, thickness: it.thickness, color: col, lineCap: LineCapStyle.Round });
      if (it.arrow) {
        const ang = Math.atan2(end.y - start.y, end.x - start.x);
        const head = Math.max(8, it.thickness * 4);
        const spread = Math.PI / 7;
        for (const s of [ang + Math.PI - spread, ang + Math.PI + spread]) {
          page.drawLine({
            start: end,
            end: { x: end.x + head * Math.cos(s), y: end.y + head * Math.sin(s) },
            thickness: it.thickness,
            color: col,
            lineCap: LineCapStyle.Round,
          });
        }
      }
    } else if (it.type === "image") {
      let img = imgCache.get(it.pngBytes);
      if (!img) {
        img = await doc.embedPng(it.pngBytes);
        imgCache.set(it.pngBytes, img);
      }
      const w = it.wNorm * pw;
      const h = it.aspect > 0 ? w / it.aspect : w;
      const x = it.xNorm * pw;
      const y = ph - it.yNorm * ph - h;
      page.drawImage(img, { x, y, width: w, height: h });
    }
  }
  return doc.save();
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

/** AYIR — her seçili sayfayı AYRI PDF yapıp tek ZIP'e toplar. `pages0`: 0-tabanlı
 * sayfa index'leri. (Tek-PDF "single" modu için `reorderPages` kullanılır.) */
export async function splitPagesToZip(
  bytes: ArrayBuffer | Uint8Array,
  pages0: number[],
  baseName = "sayfa",
): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const files: Record<string, Uint8Array> = {};
  for (const i of pages0) {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, [i]);
    copied.forEach((p) => out.addPage(p));
    files[`${baseName}_${i + 1}.pdf`] = await out.save();
  }
  return zipSync(files);
}
