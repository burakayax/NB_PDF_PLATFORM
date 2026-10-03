import { describe, it, expect } from "vitest";
import { findingCodes, FINDING_CODE_LEGEND } from "../lib/findingCode";

/**
 * Bulgu kodları: rapor, boyalı PDF kenar işaretleri ve açıklama sayfaları aynı kodu kullanır.
 * Eski sıra numaraları (10, 5, 2…) belgede karışık göründüğü için harf+sıra koduna geçildi.
 */
describe("findingCodes", () => {
  it("harf önem düzeyini, sayı o düzeydeki sırayı gösterir", () => {
    const f = ["kritik", "kritik", "yuksek", "yuksek", "yuksek", "orta", "dusuk"].map((severity) => ({ severity })) as { severity: "kritik" | "yuksek" | "orta" | "dusuk" }[];
    expect(findingCodes(f)).toEqual(["K1", "K2", "Y1", "Y2", "Y3", "O1", "D1"]);
  });

  it("sıralama karışık gelse bile her düzeyde 1'den başlayıp artar", () => {
    const f = ["orta", "kritik", "orta", "kritik"].map((severity) => ({ severity })) as { severity: "kritik" | "yuksek" | "orta" | "dusuk" }[];
    expect(findingCodes(f)).toEqual(["O1", "K1", "O2", "K2"]);
  });

  it("boş listede boş döner; açıklama dört harfi de anlatır", () => {
    expect(findingCodes([])).toEqual([]);
    for (const l of ["K", "Y", "O", "D"]) expect(FINDING_CODE_LEGEND).toContain(`${l} =`);
  });
});
