/**
 * Dosya ön kontrolü — yüklenen her PDF sunucuya sorulur.
 *
 * Test edilen davranışlar:
 *   1. Normal dosyada sayfa sayısı ve görüntü oranı kaydedilir.
 *   2. Şifreli dosya şifreli olarak işaretlenir.
 *   3. Sıfır sayfalı (şifresiz) yanıt bozuk dosya sayılır.
 *   4. Sunucu hata verirse dosya listeden düşmez, uyarı gösterilir.
 *   5. Zaman aşımında ayrı bir uyarı gösterilir.
 *   6. Hangi durumda olursa olsun "inceleniyor" işareti temizlenir —
 *      aksi halde işlem düğmesi kalıcı olarak kapalı kalır.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const inspectPdf = vi.fn();
vi.mock("../api", () => ({ inspectPdf: (...a: unknown[]) => inspectPdf(...a) }));

import { inspectUploadItems } from "../lib/uploadInspection";

function item(id: string) {
  return {
    id,
    file: new File(["x"], `${id}.pdf`, { type: "application/pdf" }),
    encrypted: false,
    inspecting: true,
    pageCount: null,
    imageRatio: null,
    mergePasswordVerified: false,
    corrupt: false,
  };
}

let toasts: Array<[string, string, string]>;
const opts = () => ({
  accessToken: "t",
  language: "tr" as const,
  showToast: (k: "error", t: string, d: string) => {
    toasts.push([k, t, d]);
  },
});

beforeEach(() => {
  toasts = [];
  inspectPdf.mockReset();
});

describe("inspectUploadItems", () => {
  it("sayfa sayısını ve görüntü oranını kaydeder", async () => {
    inspectPdf.mockResolvedValue({
      page_count: 45,
      encrypted: false,
      image_ratio: 0.077,
    });
    const [r] = await inspectUploadItems([item("a")], opts());
    expect(r.pageCount).toBe(45);
    expect(r.imageRatio).toBeCloseTo(0.077);
    expect(r.corrupt).toBe(false);
    expect(r.inspecting).toBe(false);
  });

  it("şifreli dosyayı işaretler", async () => {
    inspectPdf.mockResolvedValue({ page_count: null, encrypted: true });
    const [r] = await inspectUploadItems([item("a")], opts());
    expect(r.encrypted).toBe(true);
    expect(r.inspecting).toBe(false);
  });

  it("sıfır sayfalı şifresiz yanıtı bozuk sayar", async () => {
    inspectPdf.mockResolvedValue({ page_count: 0, encrypted: false });
    const [r] = await inspectUploadItems([item("a")], opts());
    expect(r.corrupt).toBe(true);
    expect(r.inspecting).toBe(false);
  });

  it("sunucu hatasında dosyayı düşürmez, uyarı gösterir", async () => {
    inspectPdf.mockRejectedValue(new Error("PDF çok fazla sayfa içeriyor"));
    const [r] = await inspectUploadItems([item("a")], opts());
    expect(r.id).toBe("a");
    expect(r.inspecting).toBe(false);
    expect(r.pageCount).toBeNull();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]![2]).toContain("çok fazla sayfa");
  });

  it("zaman aşımında ayrı uyarı verir", async () => {
    inspectPdf.mockRejectedValue(new Error("pdf_inspect_timeout"));
    await inspectUploadItems([item("a")], opts());
    expect(toasts).toHaveLength(1);
    expect(toasts[0]![1]).toContain("zaman aşımı");
  });

  it("birden çok dosyayı birlikte işler", async () => {
    inspectPdf
      .mockResolvedValueOnce({ page_count: 3, encrypted: false })
      .mockRejectedValueOnce(new Error("bozuk"));
    const res = await inspectUploadItems([item("a"), item("b")], opts());
    expect(res.map((r) => r.id)).toEqual(["a", "b"]);
    expect(res.every((r) => r.inspecting === false)).toBe(true);
  });
});
