import { describe, expect, it } from "vitest";
import { addressLineProblem, trLocationProblem } from "../lib/addressCheck";
import { TR_LOCATIONS } from "../lib/trLocations";

describe("adres kontrolü (arayüz)", () => {
  it("il/ilçe sayıları resmi sayıyla uyuşur", () => {
    expect(Object.keys(TR_LOCATIONS)).toHaveLength(81);
    expect(Object.values(TR_LOCATIONS).reduce((a, d) => a + d.length, 0)).toBe(973);
  });
  it("anlamsız adres reddedilir, gerçek adres geçer", () => {
    expect(addressLineProblem("asdfsd", "TR")).not.toBeNull();
    expect(addressLineProblem("aaaaaaaaaaaa", "TR")).not.toBeNull();
    expect(addressLineProblem("Atatürk Mah. Gül Sok. No:5 D:3", "TR")).toBeNull();
  });
  it("ilçe o ile ait olmalı", () => {
    expect(trLocationProblem("Trabzon", "Çankaya")?.district).toBeTruthy();
    expect(trLocationProblem("Ankara", "Çankaya")).toBeNull();
  });
});
