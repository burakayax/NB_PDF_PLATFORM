import { describe, expect, it } from "vitest";
import { validateCorporateTaxId } from "../lib/taxId";

describe("vergi numarası (arayüz)", () => {
  it("geçerli VKN, T.C. Kimlik No ve BirFatura test numarası kabul edilir", () => {
    expect(validateCorporateTaxId("5300847203")).toBeNull();
    expect(validateCorporateTaxId("10000000146")).toBeNull();
    expect(validateCorporateTaxId("1234567801")).toBeNull();
  });
  it("yanlış sağlama hanesi ve hane sayısı reddedilir", () => {
    expect(validateCorporateTaxId("1234567890")).toMatch(/geçersiz/i);
    expect(validateCorporateTaxId("12345")).toMatch(/10 haneli/);
  });
});
