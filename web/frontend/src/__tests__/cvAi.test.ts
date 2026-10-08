import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { applyTailor, cvTextForAi, docxToText, replaceBullet, type TailorResult } from "../components/tools/cv/cvAi";
import { sampleCv } from "../components/tools/cv/cvModel";

describe("cvAi", () => {
  it("yapay zekâya giden metinde kişisel iletişim bilgisi yok", () => {
    const d = sampleCv("tr");
    const t = cvTextForAi(d);
    expect(t).toContain("Deneyim:");
    for (const v of [d.name, d.email, d.phone, d.city].filter(Boolean)) expect(t).not.toContain(v);
  });
  it("replaceBullet madde işaretini yok sayıp özgün satırı değiştirir", () => {
    expect(replaceBullet("• Rapor hazırladım\n• Toplantı yaptım", "Rapor hazırladım", "Haftalık raporu hazırladım")).toBe("Haftalık raporu hazırladım\n• Toplantı yaptım");
  });
  it("applyTailor özgün CV'ye dokunmaz, kopyayı değiştirir", () => {
    const d = sampleCv("tr");
    const orig = d.experience[0].desc.split("\n")[0].replace(/^[\s•\-–*]+/, "").trim();
    const r: TailorResult = { summary: "Yeni özet", summaryAdded: [], bullets: [{ where: "", original: orig, improved: "YENİ MADDE", why: "", added: [] }], emphasize: [], askUser: [] };
    const c = applyTailor(d, r, { summary: true, bullets: [true] });
    expect(c.summary).toBe("Yeni özet");
    expect(c.experience[0].desc).toContain("YENİ MADDE");
    expect(d.experience[0].desc).not.toContain("YENİ MADDE");
  });
  it("docxToText paragrafları satıra çevirir", async () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>AYŞE &amp; KAYA</w:t></w:r></w:p><w:p><w:r><w:t>İç Mimar</w:t></w:r></w:p></w:body></w:document>';
    const bytes = zipSync({ "word/document.xml": strToU8(xml) });
    const f = new File([bytes], "a.docx");
    expect(await docxToText(f)).toBe("AYŞE & KAYA\nİç Mimar");
  });
});
