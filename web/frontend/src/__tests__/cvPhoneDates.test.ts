import { describe, expect, it } from "vitest";
import { COUNTRIES, composePhone, countryByIso, countryFromCity, formatNational, parsePhone, phoneLooksIncomplete } from "../components/tools/cv/cvPhone";
import { buildModel, fmtDuration, monthsSpan, normalizeCv, totalMonths, EMPTY_CV, type CvData } from "../components/tools/cv/cvModel";
import { trimForFit } from "../components/tools/cv/cvStyle";
import { phoneIssue } from "../components/tools/cv/cvValidate";

describe("telefon: şehirden ülke", () => {
  it("Türk şehirleri ve boş şehir → Türkiye", () => {
    expect(countryFromCity("İstanbul")).toBe("TR");
    expect(countryFromCity("Şanlıurfa")).toBe("TR");
    expect(countryFromCity("Kadıköy, İstanbul, Türkiye")).toBe("TR");
    expect(countryFromCity("")).toBeNull(); // arayüz varsayılan +90'a düşer
  });
  it("yurt dışı şehir ve ülke adları", () => {
    expect(countryFromCity("Berlin")).toBe("DE");
    expect(countryFromCity("London, UK")).toBe("GB");
    expect(countryFromCity("Amsterdam, Hollanda")).toBe("NL");
    expect(countryFromCity("Dubai")).toBe("AE");
    expect(countryFromCity("New York USA")).toBe("US");
  });
  it("bilinmeyen yer null döner", () => {
    expect(countryFromCity("Kadıköy")).toBeNull();
  });
  it("her ülkenin kalıbı geçerli ve kodu benzersiz çiftlerle ayırt edilir", () => {
    for (const c of COUNTRIES) {
      expect(c.mask.includes("#")).toBe(true);
      expect(/^\d{1,3}$/.test(c.dial)).toBe(true);
    }
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(COUNTRIES.length);
  });
});

describe("telefon: biçim", () => {
  const tr = countryByIso("TR");
  it("yazdıkça biçimlenir, baştaki 0 atılır", () => {
    expect(formatNational("5", tr)).toBe("5");
    expect(formatNational("05321234567", tr)).toBe("532 123 45 67");
    expect(formatNational("532 123 45 67 99", tr)).toBe("532 123 45 67");
  });
  it("saklanan değer uluslararası, boşsa boş", () => {
    expect(composePhone("05321234567", tr)).toBe("+90 532 123 45 67");
    expect(composePhone("", tr)).toBe("");
    expect(composePhone("2025550143", countryByIso("US"))).toBe("+1 (202) 555-0143");
  });
  it("saklı değer geri okunur; eski serbest metin Türkiye varsayılır", () => {
    expect(parsePhone("+49 151 2345678").country.iso).toBe("DE");
    expect(parsePhone("+44 7911 123456").national).toBe("7911123456");
    expect(parsePhone("0532 123 45 67").country.iso).toBe("TR");
  });
  it("eksik numara uyarısı ülkeye göre", () => {
    expect(phoneLooksIncomplete("+90 532 123")).toBe(true);
    expect(phoneLooksIncomplete("+90 532 123 45 67")).toBe(false);
    expect(phoneIssue("+90 532 123")).not.toBeNull();
    expect(phoneIssue("+90 532 123 45 67")).toBeNull();
    expect(phoneIssue("")).toBeNull();
  });
});

describe("süre hesabı", () => {
  it("aylar dahil sayılır", () => {
    expect(monthsSpan("2020-03", "2021-03", false)).toBe(13);
    expect(monthsSpan("2020-01", "2020-12", false)).toBe(12);
    expect(monthsSpan("2021-03", "2020-03", false)).toBeNull();
    expect(monthsSpan("", "2020-03", false)).toBeNull();
  });
  it("yazım", () => {
    expect(fmtDuration(67, "tr")).toBe("5 yıl 7 ay");
    expect(fmtDuration(12, "tr")).toBe("1 yıl");
    expect(fmtDuration(8, "tr")).toBe("8 ay");
    expect(fmtDuration(13, "en")).toBe("1 yr 1 mo");
    expect(fmtDuration(30, "en")).toBe("2 yrs 6 mos");
  });
  it("toplam deneyimde üst üste binen aylar iki kez sayılmaz", () => {
    expect(totalMonths([{ start: "2020-01", end: "2020-12", current: false }, { start: "2020-06", end: "2021-05", current: false }])).toBe(17);
    expect(totalMonths([{ start: "2018-01", end: "2018-12", current: false }, { start: "2020-01", end: "2020-12", current: false }])).toBe(24);
    expect(totalMonths([{ start: "", end: "", current: false }])).toBeNull();
  });
});

function cv(over: Partial<CvData>): CvData {
  return normalizeCv({ ...EMPTY_CV, name: "Test", ...over });
}

describe("CV modeli: süre, toplam, eğitim", () => {
  const exp = [
    { id: "a", company: "A", role: "R", location: "", start: "2020-03", end: "2021-02", current: false, desc: "Bir\nİki" },
    { id: "b", company: "B", role: "R", location: "", start: "2018-01", end: "2019-12", current: false, desc: "" },
  ];
  it("tarihin yanında süre ve toplam deneyim", () => {
    const m = buildModel(cv({ experience: exp }), "export");
    expect(m.experience[0].dates?.t).toBe("Mar 2020 – Şub 2021 (1 yıl)");
    expect(m.totalExp).toBe("3 yıl");
  });
  it("ayarlardan kapatılır", () => {
    const d = cv({ experience: exp });
    d.settings = { ...d.settings, showDuration: false, showTotalExp: false };
    const m = buildModel(d, "export");
    expect(m.experience[0].dates?.t).toBe("Mar 2020 – Şub 2021");
    expect(m.totalExp).toBeNull();
  });
  it("eğitim: düzey + bölüm, diploma notu, başarılar", () => {
    const m = buildModel(cv({ education: [{ id: "e", school: "ODTÜ", degree: "Endüstri Mühendisliği", location: "", start: "2012-09", end: "2016-06", current: false, desc: "", level: "bachelor", gpa: "3,45", gpaScale: "4", honors: "Bölüm birincisi olarak mezun oldu" }] }), "export");
    expect(m.education[0].degree?.t).toBe("Endüstri Mühendisliği, Lisans");
    expect(m.education[0].bullets.map((b) => b.t)).toEqual(["Diploma notu: 3,45 / 4,00", "Bölüm birincisi olarak mezun oldu"]);
  });
  it("devam eden eğitimde 'Not ortalaması' yazılır; sosyal hesaplar modele girer", () => {
    const m = buildModel(cv({ education: [{ id: "e", school: "X", degree: "", location: "", start: "2023-09", end: "", current: true, desc: "", level: "highschool", gpa: "85", gpaScale: "100" }], socials: [{ id: "s", kind: "GitHub", value: "github.com/ali" }] }), "export");
    expect(m.education[0].degree?.t).toBe("Lise");
    expect(m.education[0].bullets[0].t).toBe("Not ortalaması: 85 / 100");
    expect(m.socials).toHaveLength(1);
    expect(m.has.contact).toBe(true);
  });
});

describe("tek sayfaya sığdır: son çare kısaltma", () => {
  const mk = (n: number) => ({ id: String(n), company: "", role: "", location: "", start: "", end: "", current: false, desc: Array.from({ length: 6 }, (_, i) => `satır ${i}`).join("\n") });
  it("yeni işler korunur, eski işler kısalır; metin kaynakta silinmez", () => {
    const d = cv({ experience: [mk(1), mk(2), mk(3)] });
    const { data, hidden } = trimForFit(d, 2);
    expect(data.experience[0].desc.split("\n")).toHaveLength(5);
    expect(data.experience[2].desc.split("\n")).toHaveLength(3);
    expect(hidden).toBe(1 + 1 + 3);
    expect(d.experience[2].desc.split("\n")).toHaveLength(6);
  });
  it("kısaltılacak bir şey yoksa aynı veri döner", () => {
    const d = cv({ experience: [{ ...mk(1), desc: "tek" }] });
    expect(trimForFit(d, 4).hidden).toBe(0);
  });
});
