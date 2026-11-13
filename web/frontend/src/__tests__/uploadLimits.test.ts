import { describe, it, expect } from "vitest";
import { uploadLimitMessage } from "../lib/uploadLimits";

const limits = { "pdf-to-word": 150, "pdf-to-ppt": 150 };

describe("uploadLimitMessage (yükleme sırasında sayfa sınırı uyarısı)", () => {
  it("sınırı aşan belge için Word aracında sade bir mesaj verir", () => {
    const m = uploadLimitMessage({ pageCount: 200, pageLimits: limits }, "pdf-to-word", "tr");
    expect(m).toContain("200 sayfa");
    expect(m).toContain("150 sayfalık");
    expect(m).toContain("PDF Böl");
    expect(m).not.toMatch(/sunucu/i);
  });
  it("sınır içindeki belge için mesaj yok", () => {
    expect(uploadLimitMessage({ pageCount: 150, pageLimits: limits }, "pdf-to-word", "tr")).toBeNull();
  });
  it("sınırı olmayan araçta (ör. sıkıştırma) mesaj yok", () => {
    expect(uploadLimitMessage({ pageCount: 3000, pageLimits: limits }, "compress", "tr")).toBeNull();
  });
  it("sayfa sayısı ya da sınır bilgisi yoksa susar", () => {
    expect(uploadLimitMessage({ pageCount: null, pageLimits: limits }, "pdf-to-word", "tr")).toBeNull();
    expect(uploadLimitMessage({ pageCount: 500, pageLimits: null }, "pdf-to-word", "tr")).toBeNull();
  });
  it("PowerPoint ve İngilizce metin", () => {
    const m = uploadLimitMessage({ pageCount: 151, pageLimits: limits }, "pdf-to-ppt", "en");
    expect(m).toContain("PowerPoint");
    expect(m).toContain("151 pages");
  });
});
