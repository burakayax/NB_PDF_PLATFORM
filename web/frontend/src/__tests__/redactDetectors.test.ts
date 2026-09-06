import { describe, expect, it } from "vitest";
import {
  detectSensitiveByRegex,
  isLuhnValid,
  isValidTcNo,
} from "../components/tools/AiRedactTool";

/**
 * Hassas Veri Gizle — cihazdaki tespit motoru.
 *
 * Bu bir GİZLİLİK özelliği: kaçırılan bir veri kullanıcı için gerçek zarar demek.
 * Yanlış pozitif ise zararsız — kullanıcı listeden tek tek seçiyor. Testler bu
 * dengeyi koruyor: kapsam geniş, ama alan ETİKETLERİ asla gizlenmemeli ve
 * sayfa numarası/tutar gibi sıradan sayılar TC/kart diye işaretlenmemeli.
 */

const tr = true;
const values = (text: string) => detectSensitiveByRegex(text, tr).map((i) => i.value);
const typeOf = (text: string, value: string) =>
  detectSensitiveByRegex(text, tr).find((i) => i.value === value)?.type;

describe("isValidTcNo", () => {
  it("geçerli TC kimlik numarasını kabul eder", () => {
    expect(isValidTcNo("10000000146")).toBe(true);
  });
  it("sağlaması tutmayan 11 haneli sayıyı reddeder", () => {
    expect(isValidTcNo("12345678901")).toBe(false);
  });
  it("0 ile başlayanı ve yanlış uzunluğu reddeder", () => {
    expect(isValidTcNo("01234567890")).toBe(false);
    expect(isValidTcNo("1234567890")).toBe(false);
  });
});

describe("isLuhnValid", () => {
  it("geçerli kart numarasını kabul eder (boşluklu/tireli dahil)", () => {
    expect(isLuhnValid("4111111111111111")).toBe(true);
    expect(isLuhnValid("4111 1111 1111 1111")).toBe(true);
    expect(isLuhnValid("4111-1111-1111-1111")).toBe(true);
  });
  it("sağlaması tutmayan numarayı reddeder", () => {
    expect(isLuhnValid("4111111111111112")).toBe(false);
  });
});

describe("detectSensitiveByRegex", () => {
  it("etiketli alanlarda ETİKETİ değil DEĞERİ yakalar", () => {
    // Etiket gizlenirse belge okunamaz hâle gelir — kritik davranış.
    expect(values("Fatura No: FTR-2026/00184")).toContain("FTR-2026/00184");
    expect(values("Fatura No: FTR-2026/00184")).not.toContain("Fatura No");
    expect(values("Sipariş No: SP-99213")).toContain("SP-99213");
    expect(values("Müşteri No: MST-4471")).toContain("MST-4471");
    expect(values("Vergi No: 1234567890")).toContain("1234567890");
    expect(values("Posta Kodu: 34710")).toContain("34710");
    expect(values("Pasaport No: U1234567")).toContain("U1234567");
  });

  it("temel PII türlerini bulur", () => {
    const text =
      "E-posta: ahmet@ornek.com IBAN: TR33 0006 1005 9786 4578 4132 96 " +
      "Telefon: 0532 111 22 33 Sabit: 0216 444 55 66 Plaka: 34 ABC 123 Tarih: 12.03.2026";
    const v = values(text);
    expect(v).toContain("ahmet@ornek.com");
    expect(v).toContain("TR33 0006 1005 9786 4578 4132 96");
    expect(v).toContain("0532 111 22 33");
    expect(v).toContain("0216 444 55 66"); // sabit hat da kişisel veri
    expect(v).toContain("34 ABC 123");
    expect(v).toContain("12.03.2026");
  });

  it("geçerli TC'yi TC olarak, geçersizini 'diğer numara' olarak sınıflar", () => {
    const text = "TC: 10000000146 ve referans 12345678901";
    expect(typeOf(text, "10000000146")).toBe("tc");
    // Sağlaması tutmuyor → TC denmiyor ama kullanıcı görebilsin diye yine listeleniyor.
    expect(typeOf(text, "12345678901")).toBe("numara");
  });

  it("kart numarasını Luhn ile doğrular", () => {
    expect(typeOf("Kart: 4111 1111 1111 1111", "4111 1111 1111 1111")).toBe("kart");
  });

  it("sıradan sayıları hassas veri saymaz", () => {
    const v = values("Sayfa 2 / 3 — Toplam: 12.500,00 TL — KDV %20");
    expect(v).toHaveLength(0);
  });

  it("aynı değeri iki kez döndürmez", () => {
    const v = values("ahmet@ornek.com ve tekrar ahmet@ornek.com");
    expect(v.filter((x) => x === "ahmet@ornek.com")).toHaveLength(1);
  });

  it("İngilizce etiketleri de tanır", () => {
    expect(values("Invoice No: INV-2026-77")).toContain("INV-2026-77");
    expect(values("Order Number: ORD-5512")).toContain("ORD-5512");
  });

  it("dil seçimine göre etiket döndürür", () => {
    expect(detectSensitiveByRegex("Fatura No: A-123", true)[0]?.label).toBe("Fatura / Belge No");
    expect(detectSensitiveByRegex("Fatura No: A-123", false)[0]?.label).toBe(
      "Invoice / Document no.",
    );
  });
});
