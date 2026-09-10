/**
 * Cihaz içi araç çalıştırma — sunucuya gitmeden tarayıcıda üretilen çıktı.
 *
 * Buradaki asıl güvence şu: hangi durumda ÜRETİR, hangi durumda üretmeyip
 * sunucuya bırakır. İkincisi yanlış olursa kullanıcı ya boş bir belge alır
 * ya da hiçbir şey olmaz.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Record<string, unknown[][]> = {};
function spy(name: string, result: unknown) {
  return (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return Promise.resolve(result);
  };
}

vi.mock("../lib/clientPdfWorker", () => ({
  mergePdfs: (...a: unknown[]) => spy("mergePdfs", new Uint8Array([1]))(...a),
  imagesToPdf: (...a: unknown[]) => spy("imagesToPdf", new Uint8Array([2]))(...a),
  rotatePdf: (...a: unknown[]) => spy("rotatePdf", new Uint8Array([3]))(...a),
  deletePages: (...a: unknown[]) => spy("deletePages", new Uint8Array([4]))(...a),
  reorderPages: (...a: unknown[]) => spy("reorderPages", new Uint8Array([5]))(...a),
  splitPagesToZip: (...a: unknown[]) => spy("splitPagesToZip", new Uint8Array([6]))(...a),
  getPdfPageCount: (...a: unknown[]) => spy("getPdfPageCount", 10)(...a),
  pdfBytesToBlob: (b: Uint8Array) => new Blob([b as BlobPart], { type: "application/pdf" }),
  zipBytesToBlob: (b: Uint8Array) => new Blob([b as BlobPart], { type: "application/zip" }),
}));

import { runClientPdfTool, type ClientToolInput } from "../lib/clientToolRun";

const pdf = (n = "a.pdf") => new File(["%PDF"], n, { type: "application/pdf" });

function input(over: Partial<ClientToolInput> = {}): ClientToolInput {
  return {
    toolId: "merge",
    files: [pdf()],
    pageCountHint: 5,
    rotatePageRotations: {},
    deletePagesText: "",
    organizePageOrder: [],
    pagesText: "",
    splitMode: "single",
    language: "tr",
    fallbackFilename: "sonuc.pdf",
    expandPages: (text) =>
      text
        .split(",")
        .map((p) => Number(p.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    ...over,
  };
}

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
});

describe("runClientPdfTool", () => {
  it("birleştirmede tüm dosyaları kullanır", async () => {
    const r = await runClientPdfTool(
      input({ toolId: "merge", files: [pdf("1.pdf"), pdf("2.pdf")] }),
    );
    expect(r?.filename).toBe("sonuc.pdf");
    expect(calls.mergePdfs?.[0]?.[0]).toHaveLength(2);
  });

  it("döndürmede tam tur açıları yok sayar", async () => {
    const yok = await runClientPdfTool(
      input({ toolId: "rotate-pdf", rotatePageRotations: { "1": 360 } }),
    );
    expect(yok).toBeNull();

    await runClientPdfTool(
      input({ toolId: "rotate-pdf", rotatePageRotations: { "2": 90 } }),
    );
    // Ekranda 2. sayfa, kitaplıkta 1 numaralı indeks olmalı.
    expect(calls.rotatePdf?.[0]?.[1]).toEqual({ 1: 90 });
  });

  it("tüm sayfaları silme isteğini cihazda karşılamaz", async () => {
    const hepsi = await runClientPdfTool(
      input({ toolId: "delete-pages", deletePagesText: "1,2,3", pageCountHint: 3 }),
    );
    expect(hepsi).toBeNull();

    const bir = await runClientPdfTool(
      input({ toolId: "delete-pages", deletePagesText: "2", pageCountHint: 3 }),
    );
    expect(bir).not.toBeNull();
    expect(calls.deletePages?.[0]?.[1]).toEqual([1]);
  });

  it("ayırmada ayrı dosya seçilirse ZIP üretir", async () => {
    const zip = await runClientPdfTool(
      input({ toolId: "split", pagesText: "1,2", splitMode: "separate" }),
    );
    expect(zip?.filename).toBe("sayfalar.zip");

    const tek = await runClientPdfTool(
      input({ toolId: "split", pagesText: "1,2", splitMode: "single" }),
    );
    expect(tek?.filename).toBe("sonuc.pdf");
  });

  it("sayfa sayısı bilinmiyorsa dosyadan sayar", async () => {
    const r = await runClientPdfTool(
      input({ toolId: "split", pagesText: "1", pageCountHint: null }),
    );
    expect(calls.getPdfPageCount).toHaveLength(1);
    expect(r).not.toBeNull();
  });

  it("seçim yoksa üretmez, işi sunucuya bırakır", async () => {
    expect(await runClientPdfTool(input({ toolId: "split", pagesText: "" }))).toBeNull();
    expect(
      await runClientPdfTool(input({ toolId: "organize-pdf", organizePageOrder: [] })),
    ).toBeNull();
    expect(await runClientPdfTool(input({ toolId: "merge", files: [] }))).not.toBeNull();
  });

  it("dosya yoksa sayfa araçları üretmez", async () => {
    expect(
      await runClientPdfTool(input({ toolId: "rotate-pdf", files: [] })),
    ).toBeNull();
  });
});
