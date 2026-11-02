import { describe, expect, it } from "vitest";
import { wizardSteps } from "../components/tools/cv/CvWizard";
import { BASE_SECTIONS } from "../components/tools/cv/cvModel";
import { GRADUATE_ORDER } from "../components/tools/cv/CvForm";

describe("Sihirbaz adımları şablondaki bölüm sırasını izler", () => {
  it("varsayılan sıra: özet, deneyim, eğitim, beceri, sertifika, proje, ek bilgi, referans", () => {
    expect(wizardSteps(BASE_SECTIONS)).toEqual(["you", "start", "summary", "work", "edu", "skills", "certs", "projects", "more", "refs", "done"]);
  });
  it("yeni mezun sırası: eğitim deneyimden önce gelir", () => {
    const s = wizardSteps(GRADUATE_ORDER);
    expect(s.indexOf("edu")).toBeLessThan(s.indexOf("work"));
    expect(s.indexOf("projects")).toBeLessThan(s.indexOf("work"));
  });
  it("hiçbir adım eksik kalmaz ve tekrar etmez", () => {
    const s = wizardSteps(["references", "skills"]);
    expect(new Set(s).size).toBe(s.length);
    expect(s.length).toBe(11);
    expect(s[0]).toBe("you"); expect(s[s.length - 1]).toBe("done");
  });
});
