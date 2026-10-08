import { describe, expect, it } from "vitest";
import { EMPTY_CV, normalizeCv, sampleCv, type CvData } from "../components/tools/cv/cvModel";
import {
  atsXray,
  consistencyChecks,
  cvPlainText,
  matchJob,
  qualityChecks,
  scoreOf,
  startsOrEndsWithAction,
  stem,
  totalExperienceYears,
  type TextItem,
} from "../components/tools/cv/cvAnalysis";

const NOW = new Date("2026-10-08T12:00:00Z");
const base = (over: Partial<CvData> = {}): CvData => normalizeCv({ ...sampleCv("tr"), ...over });

describe("tutarlılık (kesin hesap)", () => {
  it("örnek CV'de kritik hata yok", () => {
    const c = consistencyChecks(base(), NOW);
    expect(c.filter((x) => x.level === "bad")).toEqual([]);
  });

  it("bitiş tarihi başlangıçtan önceyse hata verir", () => {
    const d = base();
    d.experience[1] = { ...d.experience[1], start: "2020-02", end: "2019-01", current: false };
    expect(consistencyChecks(d, NOW).some((x) => x.id.startsWith("exp-order") && x.level === "bad")).toBe(true);
  });

  it("6 ay ve üzeri boşluğu ay sayısıyla bildirir; örtüşmeyi boşluk saymaz", () => {
    const d = base();
    d.experience = [
      { ...d.experience[0], id: "a", start: "2018-01", end: "2018-12", current: false },
      { ...d.experience[0], id: "b", start: "2019-09", end: "2020-12", current: false }, // Oca-Ağu 2019 = 8 ay boşluk
      { ...d.experience[0], id: "c", start: "2020-06", end: "", current: true }, // b ile örtüşür
    ];
    const gaps = consistencyChecks(d, NOW).filter((x) => x.id.startsWith("gap"));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].tr).toContain("8 aylık boşluk");
  });

  it("5 aylık boşluk bildirilmez", () => {
    const d = base();
    d.experience = [
      { ...d.experience[0], id: "a", start: "2018-01", end: "2018-12", current: false },
      { ...d.experience[0], id: "b", start: "2019-06", end: "2020-12", current: false }, // 5 ay
    ];
    expect(consistencyChecks(d, NOW).some((x) => x.id.startsWith("gap"))).toBe(false);
  });

  it("toplam deneyim örtüşmeleri iki kez saymaz", () => {
    const d = base();
    d.experience = [
      { ...d.experience[0], id: "a", start: "2020-01", end: "2021-12", current: false }, // 24 ay
      { ...d.experience[0], id: "b", start: "2021-01", end: "2022-12", current: false }, // örtüşür → toplam 36 ay
    ];
    expect(totalExperienceYears(d, NOW)).toBe(3);
  });

  it("e-posta ve telefon biçimini doğrular", () => {
    const d = base({ email: "yanlis@", phone: "123" });
    const ids = consistencyChecks(d, NOW).map((x) => x.id);
    expect(ids).toContain("email-format");
    expect(ids).toContain("phone-format");
  });

  it("boş CV'de ad/e-posta/telefon eksikliğini kritik sayar", () => {
    const c = consistencyChecks(normalizeCv(EMPTY_CV), NOW).find((x) => x.id === "contact-missing");
    expect(c?.level).toBe("bad");
  });

  it("en yeniden eskiye sıralı değilse bilgi verir", () => {
    const d = base();
    d.experience = [
      { ...d.experience[0], id: "a", start: "2015-01", end: "2016-01", current: false },
      { ...d.experience[0], id: "b", start: "2019-01", end: "2020-01", current: false },
    ];
    expect(consistencyChecks(d, NOW).some((x) => x.id === "exp-sort")).toBe(true);
  });
});

describe("kalite (rehber)", () => {
  it("Türkçede fiil sonda: 'yönettim' eylem sayılır, isim cümlesi sayılmaz", () => {
    expect(startsOrEndsWithAction("12 kişilik ekibi yönettim", "tr")).toBe(true);
    expect(startsOrEndsWithAction("Satışları %20 artırdı", "tr")).toBe(true);
    expect(startsOrEndsWithAction("Satış raporlama çalışmaları", "tr")).toBe(false);
  });
  it("İngilizcede fiil başta", () => {
    expect(startsOrEndsWithAction("Led a team of 12", "en")).toBe(true);
    expect(startsOrEndsWithAction("Managed budgets", "en")).toBe(true);
    expect(startsOrEndsWithAction("Responsible for budgets", "en")).toBe(false);
  });
  it("zayıf ifadeyi yakalar", () => {
    const d = base();
    d.experience[0] = { ...d.experience[0], desc: "Raporların hazırlanmasından sorumluydum\nEkibe yardımcı oldum" };
    expect(qualityChecks(d).some((x) => x.id === "q-weak" && x.level === "warn")).toBe(true);
  });
  it("rakam oranını yüzdeyle bildirir", () => {
    const d = base();
    d.experience = [{ ...d.experience[0], desc: "Satışları %20 artırdım\nMüşteri ilişkilerini yönettim\nRaporladım\nSunum yaptım" }];
    const q = qualityChecks(d).find((x) => x.id === "q-numbers");
    expect(q?.tr).toContain("%25");
    expect(q?.level).toBe("warn");
  });
  it("skor şeffaf: her bulgu sabit puan düşer", () => {
    const sc = scoreOf([
      { id: "a", level: "bad", kind: "exact", tr: "", en: "" },
      { id: "b", level: "warn", kind: "exact", tr: "", en: "" },
      { id: "c", level: "info", kind: "exact", tr: "", en: "" },
      { id: "d", level: "ok", kind: "exact", tr: "", en: "" },
    ]);
    expect(sc.value).toBe(100 - 12 - 6 - 1);
  });
});

describe("ilan eşleştirici", () => {
  const ad = `Proje Yöneticisi
Aranan Nitelikler:
- En az 5 yıl proje yönetimi deneyimi
- Scrum ve Agile metodolojilerine hakim
- Jira ve MS Project kullanabilen
- SAP bilgisi tercih sebebidir
- İyi derecede Excel kullanımı
Şirketimiz proje yönetimi alanında büyüyor.`;

  it("gövde kırpma ekleri aşar (yönetim/yönetici/yönetimi)", () => {
    expect(stem("yönetimi", "tr")).toBe(stem("yönetim", "tr"));
    expect(stem("yönetici", "tr")).toBe(stem("yönetim", "tr"));
    expect(stem("managing", "en")).toBe(stem("managed", "en"));
  });

  it("CV'de olan ve olmayan anahtar kelimeleri ayırır", () => {
    const r = matchJob(base(), ad, NOW);
    const present = r.matched.map((k) => k.term);
    const missing = r.missing.map((k) => k.term);
    expect(present).toEqual(expect.arrayContaining(["proje yönetimi"]));
    expect(present).toEqual(expect.arrayContaining(["agile"]));
    expect(missing).toEqual(expect.arrayContaining(["sap", "excel"]));
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
  });

  it("eksik beceri CV'ye eklenince skor yükselir", () => {
    const d = base();
    const before = matchJob(d, ad, NOW).score;
    d.skills = [...d.skills, { id: "x1", name: "SAP", level: 0 }, { id: "x2", name: "Excel", level: 0 }];
    const after = matchJob(d, ad, NOW);
    expect(after.score).toBeGreaterThan(before);
    expect(after.missing.map((k) => k.term)).not.toContain("sap");
  });

  it("istenen yıl ve toplam deneyimi karşılaştırır", () => {
    const r = matchJob(base(), ad, NOW);
    expect(r.yearsAsked).toBe(5);
    expect(r.yearsHave).toBeGreaterThan(5);
  });

  it("unvan eşleşmesini ilk satırdan bulur", () => {
    expect(matchJob(base(), ad, NOW).titleHit).toBe(true);
    const designer = base({ title: "Grafik Tasarımcı" });
    designer.experience = [{ ...designer.experience[0], role: "Tasarımcı" }];
    expect(matchJob(designer, ad, NOW).titleHit).toBe(false);
    // son iş unvanı eşleşiyorsa (başlık farklı olsa da) eşleşir
    expect(matchJob(base({ title: "Grafik Tasarımcı" }), ad, NOW).titleHit).toBe(true);
  });

  it("boş ilanda çökmez", () => {
    const r = matchJob(base(), "", NOW);
    expect(r.keywords).toEqual([]);
    expect(r.score).toBe(0);
  });
});

describe("ATS röntgeni", () => {
  const it_ = (str: string, x: number, y: number, page = 1): TextItem => ({ str, x, y, w: str.length * 5, h: 10, page });

  it("tek sütunlu sağlıklı çıktıda ad ilk satır, e-posta/telefon/başlık tanınır", () => {
    const d = base();
    const items: TextItem[] = [
      it_("Elif Yılmaz", 40, 800), it_("elif.yilmaz@ornek.com", 40, 780), it_("+90 532 000 00 00", 200, 780),
      it_("PROFİL", 40, 740), it_("Sonuç odaklı proje yöneticisi", 40, 720),
      it_("İŞ DENEYİMİ", 40, 690), it_("Kıdemli Proje Yöneticisi", 40, 670), it_("Mar 2020 – Devam ediyor", 300, 670),
      it_("Proje Yöneticisi", 40, 640), it_("Haz 2016 – Şub 2020", 300, 640),
      it_("EĞİTİM", 40, 610), it_("BECERİLER", 40, 580), it_("YABANCI DİLLER", 40, 550),
    ];
    const r = atsXray(items, d, 1);
    const by = Object.fromEntries(r.checks.map((c) => [c.id, c.level]));
    expect(by["x-name"]).toBe("ok");
    expect(by["x-email"]).toBe("ok");
    expect(by["x-phone"]).toBe("ok");
    expect(by["x-heads"]).toBe("ok");
    expect(by["x-dates"]).toBe("ok");
    expect(by["x-cols"]).toBe("ok");
    expect(r.columns).toBe(1);
  });

  it("ad ilk satırda değilse kritik uyarı verir", () => {
    const d = base();
    const items: TextItem[] = [it_("İLETİŞİM", 40, 800), it_("elif.yilmaz@ornek.com", 40, 780), it_("Elif Yılmaz", 300, 760), ...Array.from({ length: 6 }, (_, i) => it_(`satır ${i} metin yeterince uzun`, 40, 700 - i * 20))];
    const r = atsXray(items, d, 1);
    expect(r.checks.find((c) => c.id === "x-name")?.level).toBe("bad");
  });

  it("iki sütunlu sayfayı algılar ve satır satır okumada sütunların karıştığını gösterir", () => {
    const d = base();
    const items: TextItem[] = [];
    for (let i = 0; i < 12; i++) items.push(it_(`SOL${i} metin`, 40, 800 - i * 20)); // ana sütun (akışta önce)
    for (let i = 0; i < 12; i++) items.push(it_(`SAĞ${i} metin`, 400, 800 - i * 20)); // yan sütun
    const r = atsXray(items, d, 1);
    expect(r.columns).toBe(2);
    expect(r.checks.find((c) => c.id === "x-cols")?.level).toBe("warn");
    expect(r.streamLines[0]).toBe("SOL0 metin");
    expect(r.rowLines[0]).toContain("SOL0");
    expect(r.rowLines[0]).toContain("SAĞ0"); // satır satır okuyan sistem iki sütunu birleştirir
  });

  it("metin çıkmazsa (resim PDF) kritik", () => {
    const r = atsXray([], base(), 1);
    expect(r.checks[0].level).toBe("bad");
  });

  it("bozuk karakteri yakalar", () => {
    const items: TextItem[] = [it_("Elif Yılmaz", 40, 800), it_("elif.yilmaz@ornek.com", 40, 780), it_("+90 532 000 00 00", 40, 760), it_("Ürün Y�neticisi", 40, 740), ...Array.from({ length: 4 }, (_, i) => it_(`satır ${i} yeterince uzun metin`, 40, 700 - i * 20))];
    expect(atsXray(items, base(), 1).checks.find((c) => c.id === "x-chars")?.level).toBe("bad");
  });
});

describe("düz metin", () => {
  it("CV metni ad ile başlar ve gizli bölümü içermez", () => {
    const d = base();
    d.settings = { ...d.settings, hidden: ["interests"] };
    const t = cvPlainText(d);
    expect(t.startsWith("Elif Yılmaz")).toBe(true);
    expect(t).not.toContain("Fotoğrafçılık");
  });
});

describe("şablon kaynağı: ATS dostu metin", () => {
  it("harf aralığı 0.06em'i aşmaz (aşarsa PDF'te 'P R O F İ L' diye okunur)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/tools/cv/cvTemplates.tsx", "utf8");
    const vals = [...src.matchAll(/letterSpacing:\s*"(-?[\d.]+)em"/g)].map((m) => Number(m[1]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals) expect(v).toBeLessThanOrEqual(0.06);
  });
});
