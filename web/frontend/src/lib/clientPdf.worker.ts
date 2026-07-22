/**
 * Web Worker — pdf-lib yapısal işlemlerini ANA THREAD dışında çalıştırır.
 * Böylece büyük PDF işlenirken arayüz DONMAZ (kullanıcı kaydırabilir/iptal edebilir).
 * clientPdf.ts'teki AYNI (test edilmiş) fonksiyonları kullanır — mantık tek yerde kalır.
 * Sonuç (Uint8Array) transfer edilerek kopyalamadan ana thread'e geçirilir.
 */
import {
  mergePdfs,
  imagesToPdf,
  rotatePdf,
  deletePages,
  reorderPages,
  splitPagesToZip,
  getPdfPageCount,
  cropPdf,
  applySignatures,
  applyAnnotations,
} from "./clientPdf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Op = (...args: any[]) => Promise<unknown>;
const ops: Record<string, Op> = {
  mergePdfs,
  imagesToPdf,
  rotatePdf,
  deletePages,
  reorderPages,
  splitPagesToZip,
  getPdfPageCount,
  cropPdf,
  applySignatures,
  applyAnnotations,
};

// Worker global'i — webworker lib'i (DOM ile çakışabilir) yerine minimal tipleme.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

ctx.onmessage = async (e: MessageEvent) => {
  const { id, op, args } = e.data as { id: number; op: string; args: unknown[] };
  try {
    const fn = ops[op];
    if (!fn) throw new Error(`unknown op: ${op}`);
    const result = await fn(...args);
    if (result instanceof Uint8Array) {
      ctx.postMessage({ id, ok: true, result }, [result.buffer]);
    } else {
      ctx.postMessage({ id, ok: true, result });
    }
  } catch (err) {
    ctx.postMessage({
      id,
      ok: false,
      errorName: err instanceof Error ? err.name : "Error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
};
