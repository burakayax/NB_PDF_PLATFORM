import { describe, expect, it } from "vitest";
import { allPass, evaluate, isA4, type PdfFacts } from "../lib/pdfCompliance";

const A4 = { w: 595, h: 842 };
const facts = (o: Partial<PdfFacts> = {}): PdfFacts => ({
  bytes: 500 * 1024, pages: 3, encrypted: false, pageSizes: [A4, A4, A4], hasText: true, ...o,
});

describe("uyumluluk değerlendirmesi", () => {
  it("A4 (dik/yatay) tanınır, Letter tanınmaz", () => {
    expect(isA4(595, 842)).toBe(true);
    expect(isA4(842, 595)).toBe(true);
    expect(isA4(612, 792)).toBe(false);
  });

  it("sınırlar kullanıcıdan gelir: aynı dosya 1 MB'a uyar, 200 KB'a uymaz", () => {
    const l = { a4Only: false, requireText: false };
    expect(allPass(evaluate(facts(), { ...l, maxBytes: 1024 * 1024 }))).toBe(true);
    const bad = evaluate(facts(), { ...l, maxBytes: 200 * 1024 });
    expect(bad[0]).toMatchObject({ id: "size", status: "fail", fixable: true });
  });

  it("denetlenmeyen sınır sonuç üretmez", () => {
    expect(evaluate(facts(), { a4Only: false, requireText: false })).toEqual([]);
  });

  it("sayfa fazlası ve metinsizlik düzeltilemez olarak işaretlenir", () => {
    const r = evaluate(facts({ pages: 50, hasText: false }), { maxPages: 10, a4Only: false, requireText: true });
    expect(r.find((c) => c.id === "pages")).toMatchObject({ status: "fail", fixable: false });
    expect(r.find((c) => c.id === "text")).toMatchObject({ status: "fail", fixable: false });
  });

  it("A4 olmayan sayfa düzeltilebilir olarak bildirilir", () => {
    const r = evaluate(facts({ pageSizes: [A4, { w: 612, h: 792 }] }), { a4Only: true, requireText: false });
    expect(r[0]).toMatchObject({ id: "a4", status: "fail", fixable: true });
    expect(r[0]!.tr).toContain("sayfa 2");
  });

  it("şifreli dosyada yalnız şifre uyarısı verir", () => {
    const r = evaluate(facts({ encrypted: true }), { maxBytes: 1, a4Only: true, requireText: true });
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe("encrypted");
  });
});
