import { describe, expect, it } from "vitest";
import { CV_TEMPLATES } from "../components/tools/cv/cvTemplates";

describe("CV şablon listesi", () => {
  it("kimlikler benzersiz, ücretsiz şablonlar sade, net, klasik-serif, modern-mavi", () => {
    expect(new Set(CV_TEMPLATES.map((t) => t.id)).size).toBe(CV_TEMPLATES.length);
    expect(CV_TEMPLATES.filter((t) => t.free).map((t) => t.id).sort()).toEqual(["klasik-serif", "modern-mavi", "net", "sade"]);
  });
  it("Europass tarzı tarih sütunlu yerleşim var", () => {
    expect(CV_TEMPLATES.find((t) => t.id === "europass")?.layout).toBe("ledger");
    expect(CV_TEMPLATES.length).toBeGreaterThanOrEqual(22);
  });
  it("kenar çubuğu/bant şablonlarında tema alanları tanımlı", () => {
    for (const t of CV_TEMPLATES) {
      if (t.layout === "sidebar") expect(t.theme.side).toBeTruthy();
      if (t.layout === "banner") expect(t.theme.band && t.theme.side).toBeTruthy();
    }
  });
});
