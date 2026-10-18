import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "../lib/toolSearch";

describe("araç arama", () => {
  it("büyük/küçük harf ve Türkçe aksan farkını yok sayar", () => {
    expect(matchesSearch("donu", "PDF Dönüştür")).toBe(true);
    expect(matchesSearch("dön", "PDF Dönüştür")).toBe(true);
    expect(matchesSearch("DÖN", "PDF Döndür")).toBe(true);
    expect(matchesSearch("sikistir", "PDF Sıkıştır")).toBe(true);
    expect(matchesSearch("ISARETLE", "PDF İşaretle")).toBe(true);
    expect(matchesSearch("imza", "PDF İmzala")).toBe(true);
    expect(matchesSearch("word", "Sıkıştır", "PDF → Word")).toBe(true);
  });
  it("eşleşmeyeni ve boş sorguyu doğru yönetir", () => {
    expect(matchesSearch("xyz", "PDF Böl")).toBe(false);
    expect(matchesSearch("  ", "PDF Böl")).toBe(true);
    expect(normalizeSearch("İĞNE")).toBe("igne");
  });
});
