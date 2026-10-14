import { describe, expect, it } from "vitest";
import { parseLinkedinText } from "../components/tools/cv/cvLinkedin";
import { decodeCvLink, encodeCvLink } from "../components/tools/cv/cvShare";
import { collectFieldIssues, emailIssue, phoneIssue } from "../components/tools/cv/cvValidate";
import { findPlaceholders, matchProfession, professionSample, PROFESSIONS } from "../components/tools/cv/cvPhrases";
import { sampleCv } from "../components/tools/cv/cvModel";

const LI = `Contact
ayse@ornek.com
www.linkedin.com/in/aysedemir (LinkedIn)
Top Skills
Project Management
Agile
Budgeting
Languages
English (Full Professional)
Türkçe (Native or Bilingual)
Ayşe Demir
Senior Project Manager
Istanbul, Turkey
Summary
Results-driven project manager with 10 years of experience.
Experience
Anadolu Teknoloji
Senior Project Manager
March 2020 - Present (5 years)
Istanbul
Led a 12-person team and cut delivery time.
Marmara Danışmanlık
Project Manager
June 2016 - February 2020 (3 years 9 months)
Ankara
Delivered 20 projects.
Education
Middle East Technical University
Bachelor's degree, Industrial Engineering · (2012 - 2016)
Page 1 of 2`;

describe("LinkedIn ayrıştırma", () => {
  const { parsed, found } = parseLinkedinText(LI);
  it("kimlik ve iletişim", () => {
    expect(parsed.name).toBe("Ayşe Demir");
    expect(parsed.title).toBe("Senior Project Manager");
    expect(parsed.city).toBe("Istanbul, Turkey");
    expect(parsed.email).toBe("ayse@ornek.com");
    expect(parsed.linkedin).toContain("linkedin.com/in/aysedemir");
  });
  it("beceri ve diller", () => {
    expect(parsed.skills).toEqual(["Project Management", "Agile", "Budgeting"]);
    expect(parsed.languages[0]).toEqual({ name: "English", level: "İleri (C1–C2)" });
    expect(parsed.languages[1].level).toBe("Ana dil");
  });
  it("deneyim ve eğitim", () => {
    expect(found.experience).toBe(2);
    expect(parsed.experience[0]).toMatchObject({ company: "Anadolu Teknoloji", role: "Senior Project Manager", start: "2020-03", current: true });
    expect(parsed.experience[1]).toMatchObject({ company: "Marmara Danışmanlık", start: "2016-06", end: "2020-02", current: false });
    expect(parsed.education[0]).toMatchObject({ school: "Middle East Technical University", start: "2012-09", end: "2016-06" });
  });
});

describe("bağlantıyla paylaşım", () => {
  it("gidiş-dönüş, fotoğraf düşer", async () => {
    const d = { ...sampleCv("tr"), photo: { src: "data:image/jpeg;base64,AAAA", zoom: 1, x: 0, y: 0 } };
    const { url } = await encodeCvLink(d, "https://x.test", "/tools/cv-olustur");
    const hash = url.slice(url.indexOf("#"));
    const back = await decodeCvLink(hash);
    expect(back?.name).toBe("Elif Yılmaz");
    expect(back?.photo).toBeNull();
    expect(back?.experience.length).toBe(2);
  });
  it("bozuk bağlantı null döner", async () => {
    expect(await decodeCvLink("#cv=z.@@@")).toBeNull();
    expect(await decodeCvLink("#baska")).toBeNull();
  });
});

describe("alan uyarıları", () => {
  it("e-posta ve telefon", () => {
    expect(emailIssue("a@b")).not.toBeNull();
    expect(emailIssue("a@b.com")).toBeNull();
    expect(phoneIssue("123")).not.toBeNull();
    expect(phoneIssue("+90 532 000 00 00")).toBeNull();
  });
  it("tarih sırası", () => {
    const d = sampleCv("tr");
    d.experience[1].end = "2010-01";
    expect(collectFieldIssues(d).some((x) => x.id === "exp-date-1")).toBe(true);
  });
});

describe("meslek kütüphanesi", () => {
  it("unvandan meslek bulur", () => {
    expect(matchProfession("Satış Danışmanı")?.id).toBe("sales");
    expect(matchProfession("Muhasebe Uzmanı")?.id).toBe("accounting");
    expect(matchProfession("xyz")).toBeNull();
  });
  it("yer tutucuları yakalar", () => {
    expect(findPlaceholders("hedefi %[X] aştı [Teknoloji]")).toEqual(["[X]", "[Teknoloji]"]);
  });
  it("her mesleğin örnek CV'si dolu", () => {
    for (const p of PROFESSIONS) for (const l of ["tr", "en"] as const) {
      const s = professionSample(p.id, l);
      expect(s.experience.length).toBe(2);
      expect(p.bullets[l].length).toBeGreaterThanOrEqual(6);
      expect(p.skills[l].length).toBeGreaterThanOrEqual(6);
    }
  });
});

import { cvStrength } from "../components/tools/cv/cvScore";
import { EMPTY_CV, normalizeCv } from "../components/tools/cv/cvModel";

describe("CV gücü", () => {
  it("yalnızca ad soyad yazılınca güçlü DEĞİL", () => {
    const d = normalizeCv({ ...EMPTY_CV, name: "Burak Ayaz" });
    const s = cvStrength(d);
    expect(s.value).toBeLessThan(20);
    expect(s.label.tr).toBe("Yeni başladı");
    expect(s.missing.length).toBeGreaterThan(5);
  });
  it("dolu örnek CV yüksek puan alır", () => {
    expect(cvStrength(sampleCv("tr")).value).toBeGreaterThanOrEqual(75);
  });
});

import { CV_TEMPLATES } from "../components/tools/cv/cvTemplates";
import { isSingleColumnLayout } from "../components/tools/cv/cvAnalysis";

describe("yeni Pro şablon serisi", () => {
  const yeni = CV_TEMPLATES.filter((t) => t.isNew);
  it("sekiz yeni Pro şablon, hepsi ücretli ve kimlikleri benzersiz", () => {
    expect(yeni.length).toBe(8);
    expect(yeni.every((t) => !t.free)).toBe(true);
    expect(new Set(CV_TEMPLATES.map((t) => t.id)).size).toBe(CV_TEMPLATES.length);
  });
  it("ücretsiz şablon sayısı değişmedi (4)", () => {
    expect(CV_TEMPLATES.filter((t) => t.free).length).toBe(4);
  });
  it("tek akışlı yeni düzenler ATS dostu sayılır, çok sütunlular sayılmaz", () => {
    expect(isSingleColumnLayout("editorial")).toBe(true);
    expect(isSingleColumnLayout("split")).toBe(true);
    expect(isSingleColumnLayout("grid")).toBe(false);
    expect(isSingleColumnLayout("studio")).toBe(false);
  });
});
