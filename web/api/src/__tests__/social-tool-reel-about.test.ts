import { describe, expect, it } from "vitest";
import { TOOL_REEL_CATALOG } from "../modules/social/tool-reel-catalog.js";
import { TOOL_REEL_ABOUT } from "../modules/social/tool-reel-about.js";
import { toolReelBody } from "../modules/social/tool-reels.service.js";

describe("araç videosu: ne işe yarar açıklaması", () => {
  it("her katalog satırının TR ve EN açıklaması var, fazlalık yok", () => {
    for (const e of TOOL_REEL_CATALOG) {
      expect(TOOL_REEL_ABOUT[e.id]?.tr.length, e.id).toBeGreaterThan(80);
      expect(TOOL_REEL_ABOUT[e.id]?.en.length, e.id).toBeGreaterThan(80);
    }
    expect(Object.keys(TOOL_REEL_ABOUT).sort()).toEqual(TOOL_REEL_CATALOG.map((e) => e.id).sort());
  });

  it("gönderi metni açıklamayı içerir; başlıkta zaten yazan özet cümlesi tekrarlanmaz, gizlilik cümlesi korunur", () => {
    const ocr = TOOL_REEL_CATALOG.find((e) => e.id === "taranmis-pdf-ocr")!;
    const body = toolReelBody(ocr, "tr");
    expect(body).toContain("OCR");
    expect(body).toContain("Ctrl+F");
    expect(body).toContain("Dosyaların cihazında işlenir");
    expect(body).not.toContain("Taranmış sayfadaki yazıyı okunabilir metne çevirir");
  });
});
