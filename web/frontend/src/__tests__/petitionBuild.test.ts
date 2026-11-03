// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { COMMON_FIELDS, PETITION_TEMPLATES } from "../content/petitionTemplates";
import { buildPetition, fillLine, missingRequired, todayTr } from "../lib/petitionBuild";
import { parseUdf, udfPlainText } from "../lib/udf";
import { writeUdf } from "../lib/udfWrite";

const base = { adSoyad: "Çağrı Şükrü Öğüt", adres: "Gül Sk. No:3 Kadıköy/İstanbul", tarih: "03.11.2026" };

describe("dilekçe şablonları", () => {
  it("her şablonun yer tutucuları tanımlı bir alana karşılık gelir", () => {
    for (const t of PETITION_TEMPLATES) {
      const keys = new Set([...COMMON_FIELDS, ...t.fields].map((f) => f.key));
      const used = [t.recipient, t.subject, ...t.body].join(" ").match(/\{\{(\w+)\}\}/g) ?? [];
      for (const u of used) expect(keys.has(u.slice(2, -2)), `${t.id}: ${u}`).toBe(true);
    }
  });

  it("boş alanlı satır atılır, dolu olan doldurulur", () => {
    expect(fillLine("Merhaba {{ad}}", { ad: "Ali" })).toBe("Merhaba Ali");
    expect(fillLine("Merhaba {{ad}}", { ad: " " })).toBeNull();
  });

  it("zorunlu alan eksikse bildirir, isteğe bağlılar sayılmaz", () => {
    const t = PETITION_TEMPLATES.find((x) => x.id === "genel-dilekce")!;
    const m = missingRequired(t, { adSoyad: "A" });
    expect(m).toContain("kurum");
    expect(m).not.toContain("tcKimlik");
  });

  it("Türkçe karakterler UDF'ye yazılıp geri okununca bozulmaz", () => {
    const t = PETITION_TEMPLATES.find((x) => x.id === "iade-talebi")!;
    const doc = buildPetition(t, { ...base, satici: "Işık Mağazacılık", urun: "Şemsiye", siparisTarihi: "01.11.2026", siparisNo: "ÇŞ-1", neden: "Kırık geldi\nİkinci satır" });
    const text = udfPlainText(parseUdf(writeUdf(doc)));
    expect(text).toContain("IŞIK MAĞAZACILIK'NE");
    expect(text).toContain("\"Şemsiye\"");
    expect(text).toContain("İkinci satır");
    expect(text).toContain("Çağrı Şükrü Öğüt");
  });

  it("isteğe bağlı boş alanın satırı belgede yer almaz", () => {
    const t = PETITION_TEMPLATES.find((x) => x.id === "genel-dilekce")!;
    const text = udfPlainText(buildPetition(t, { ...base, kurum: "X", konu: "Y", aciklama: "A", talep: "B" }));
    expect(text).not.toContain("T.C. Kimlik No");
    expect(text).not.toContain("Telefon");
  });

  it("tarih gg.aa.yyyy biçimindedir", () => {
    expect(todayTr(new Date(2026, 10, 3))).toBe("03.11.2026");
  });
});
