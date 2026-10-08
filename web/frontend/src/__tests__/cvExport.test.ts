import { describe, expect, it } from "vitest";
import { normalizeCv, sampleCv } from "../components/tools/cv/cvModel";
import { cvLines, cvToText } from "../components/tools/cv/cvExport";

describe("CV düz metin / Word içeriği", () => {
  const d = normalizeCv(sampleCv("tr"));

  it("ad ile başlar, başlıklar BÜYÜK HARF ve tarihler satırda", () => {
    const t = cvToText(d);
    expect(t.split("\n")[0]).toBe("ELİF YILMAZ");
    expect(t).toContain("İŞ DENEYİMİ");
    expect(t).toContain("Mar 2020 – Devam ediyor");
    expect(t).toContain("- 12 kişilik ürün ekibini yönetti");
  });

  it("boş bölüm ve boş alan üretilmez (yer tutucu yok)", () => {
    const e = normalizeCv({ ...d, projects: [], references: [], summary: "" });
    const t = cvToText(e);
    expect(t).not.toContain("PROJELER");
    expect(t).not.toContain("REFERANSLAR");
    expect(t).not.toContain("PROFİL");
    expect(t).not.toMatch(/Adınız|Şirket adı|Başlangıç – Bitiş/);
  });

  it("gizlenen bölüm çıkmaz; sıra kullanıcının sırasını izler", () => {
    const e = normalizeCv({ ...d, settings: { ...d.settings, hidden: ["interests"], order: ["education", "experience"] } });
    const t = cvToText(e);
    expect(t).not.toContain("İLGİ ALANLARI");
    expect(t.indexOf("EĞİTİM")).toBeLessThan(t.indexOf("İŞ DENEYİMİ"));
  });

  it("özel bölüm başlığı ve maddesi yer alır", () => {
    const e = normalizeCv({ ...d, customSections: [{ id: "c1", title: "Gönüllülük", items: [{ id: "i1", title: "Kızılay", subtitle: "Gönüllü", date: "2019-05", desc: "Afet eğitimi verdi" }] }] });
    const t = cvToText(e);
    expect(t).toContain("GÖNÜLLÜLÜK");
    expect(t).toContain("Kızılay");
    expect(t).toContain("May 2019");
    expect(cvLines(e).lines.some((l) => l.kind === "h" && l.text === "Gönüllülük")).toBe(true);
  });

  it("tarih biçimi ayarına uyar", () => {
    const e = normalizeCv({ ...d, settings: { ...d.settings, dateFormat: "num" } });
    expect(cvToText(e)).toContain("03.2020");
    const y = normalizeCv({ ...d, settings: { ...d.settings, dateFormat: "year" } });
    expect(cvToText(y)).toContain("2020 – Devam ediyor");
  });
});
