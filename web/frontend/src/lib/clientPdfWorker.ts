/**
 * Ana-thread sarmalayıcı: pdf-lib yapısal işlemlerini (birleştir/görsel→pdf/döndür/
 * sil/sırala/ayır/sayfa-say) bir Web Worker'a yönlendirir → büyük PDF'te UI DONMAZ.
 *
 * GÜVENLİK AĞI: Worker oluşturulamaz/çökerse (eski tarayıcı, CSP, OOM) işlem ANA
 * THREAD'e zarifçe geri düşer → en kötü ihtimalle bugünkü davranış; sonuç ASLA bozulmaz.
 *
 * ÖNEMLİ (paket boyutu): pdf-lib'i ANA CHUNK'a sokmamak için ağır `./clientPdf`
 * modülü YALNIZCA fallback anında dinamik `import()` ile yüklenir. Hafif semboller
 * (pdfBytesToBlob, zipBytesToBlob, PdfEncryptedError, tipler) pdf-lib'siz
 * `./clientPdfCore`'dan re-export edilir → landing/blog ziyaretçisi pdf-lib indirmez.
 */
export { PdfEncryptedError, pdfBytesToBlob, zipBytesToBlob } from "./clientPdfCore";
export type {
  SearchableWord,
  SearchablePage,
  SignatureItem,
  AnnotationItem,
} from "./clientPdfCore";

import { PdfEncryptedError } from "./clientPdfCore";
// Tip-yalnızca: derleme sonrası SİLİNİR, çalışma zamanında pdf-lib çekmez.
import type * as Direct from "./clientPdf";

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  op: string;
  args: unknown[];
};

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, Pending>();

// Ağır motoru YALNIZCA fallback gerektiğinde (worker yok/çöktü) lazy yükle; bir kez
// yüklenince belleğe alınır. Böylece pdf-lib ana pakete girmez, ilk yükleme küçülür.
let directModP: Promise<typeof Direct> | null = null;
const loadDirect = (): Promise<typeof Direct> => (directModP ??= import("./clientPdf"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runDirect = async (op: string, args: unknown[]): Promise<any> => {
  const mod = await loadDirect();
  return (mod as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[op](...args);
};

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL("./clientPdf.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent) => {
      const { id, ok, result, errorName, errorMessage } = e.data as {
        id: number;
        ok: boolean;
        result?: unknown;
        errorName?: string;
        errorMessage?: string;
      };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok) p.resolve(result);
      else if (errorName === "PdfEncryptedError") p.reject(new PdfEncryptedError());
      else p.reject(new Error(errorMessage || "worker error"));
    };
    w.onerror = () => {
      // Worker seviyesinde kurtarılamaz hata: bir daha worker kullanma, bekleyenleri
      // ana thread'e düşür (aynı deterministik kod → aynı sonuç, sadece thread farkı).
      workerBroken = true;
      worker = null;
      const items = [...pending.values()];
      pending.clear();
      for (const p of items) runDirect(p.op, p.args).then(p.resolve, p.reject);
    };
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

function call<T>(op: string, args: unknown[]): Promise<T> {
  const w = getWorker();
  if (!w) return runDirect(op, args) as Promise<T>;
  return new Promise<T>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, op, args });
    try {
      w.postMessage({ id, op, args });
    } catch {
      pending.delete(id);
      runDirect(op, args).then(resolve, reject);
    }
  });
}

export function mergePdfs(files: Array<ArrayBuffer | Uint8Array>): Promise<Uint8Array> {
  return call("mergePdfs", [files]);
}
export function imagesToPdf(images: Parameters<typeof Direct.imagesToPdf>[0]): Promise<Uint8Array> {
  return call("imagesToPdf", [images]);
}
export function rotatePdf(
  bytes: ArrayBuffer | Uint8Array,
  rotations: Record<number, number>,
): Promise<Uint8Array> {
  return call("rotatePdf", [bytes, rotations]);
}
export function deletePages(
  bytes: ArrayBuffer | Uint8Array,
  pagesToDelete: number[],
): Promise<Uint8Array> {
  return call("deletePages", [bytes, pagesToDelete]);
}
export function reorderPages(bytes: ArrayBuffer | Uint8Array, order: number[]): Promise<Uint8Array> {
  return call("reorderPages", [bytes, order]);
}
export function splitPagesToZip(
  bytes: ArrayBuffer | Uint8Array,
  pages0: number[],
  baseName = "sayfa",
): Promise<Uint8Array> {
  return call("splitPagesToZip", [bytes, pages0, baseName]);
}
export function getPdfPageCount(bytes: ArrayBuffer | Uint8Array): Promise<number> {
  return call("getPdfPageCount", [bytes]);
}
// KIRP — sayfaların görünür alanını (CropBox) daraltır; büyük PDF'te worker donmayı önler.
export function cropPdf(
  bytes: ArrayBuffer | Uint8Array,
  crop: Parameters<typeof Direct.cropPdf>[1],
  pages?: number[],
): Promise<Uint8Array> {
  return call("cropPdf", [bytes, crop, pages]);
}
// İmzala / Yorumla — pdf-lib ile görsel/çizim gömme + save; büyük PDF'te worker donmayı önler.
export function applySignatures(
  pdfBytes: Parameters<typeof Direct.applySignatures>[0],
  items: Parameters<typeof Direct.applySignatures>[1],
): Promise<Uint8Array> {
  return call("applySignatures", [pdfBytes, items]);
}
export function applyAnnotations(
  pdfBytes: Parameters<typeof Direct.applyAnnotations>[0],
  items: Parameters<typeof Direct.applyAnnotations>[1],
): Promise<Uint8Array> {
  return call("applyAnnotations", [pdfBytes, items]);
}
