import { describe, expect, it } from "vitest";
import { addressLineProblem, trLocationProblem, canonicalCity, canonicalDistrict } from "../modules/billing/address-check.js";

describe("açık adres akıl kontrolü", () => {
  it("anlamsız girdiler reddedilir", () => {
    for (const bad of ["asdfsd", "aaaaaaaaaaaa", "qwerty qwerty", "asdf asdf asdf", "123456 7890", "xxxxxxxx 1", "abc", "sdfghjkl 5"]) {
      expect(addressLineProblem(bad, "TR"), bad).not.toBeNull();
    }
  });
  it("gerçek adresler geçer", () => {
    for (const good of [
      "Toklu Mahallesi, Gürpınar Sk. No: 2 A İç Kapı No: 26",
      "Atatürk Mah. Gül Sok. No:5 D:3",
      "Çankaya Cad. 14/6",
      "Kızılay Meydanı Apt 4",
    ]) {
      expect(addressLineProblem(good, "TR"), good).toBeNull();
    }
    expect(addressLineProblem("221B Baker Street", "GB")).toBeNull();
    expect(addressLineProblem("12 Main St", "US")).toBeNull();
  });
});

describe("il / ilçe", () => {
  it("yazılış farkları (İ/ı, büyük harf) resmi ada çevrilir", () => {
    expect(canonicalCity("ISPARTA")).toBe("Isparta");
    expect(canonicalCity("istanbul")).toBe("İstanbul");
    expect(canonicalDistrict("Trabzon", "ortahisar")).toBe("Ortahisar");
  });
  it("il listede yoksa ya da ilçe o ile ait değilse hata verir", () => {
    expect(trLocationProblem("asdfsd", "x")?.city).toBeTruthy();
    expect(trLocationProblem("Trabzon", "Çankaya")?.district).toBeTruthy();
    expect(trLocationProblem("Trabzon", "Ortahisar")).toBeNull();
    expect(trLocationProblem("Ankara", "Çankaya")).toBeNull();
  });
});
