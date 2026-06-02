/**
 * E-posta normalizasyon unit testleri.
 */

import { describe, it, expect } from "vitest";
import { normalizeEmailForStorage } from "../lib/email-identity-normalize.js";

describe("normalizeEmailForStorage", () => {
  it("küçük harfe çevirir", () => {
    expect(normalizeEmailForStorage("TEST@EXAMPLE.COM")).toBe("test@example.com");
  });

  it("baştaki ve sondaki boşlukları kırpar", () => {
    expect(normalizeEmailForStorage("  user@example.com  ")).toBe("user@example.com");
  });

  it("Gmail + alias (nokta) normalize eder", () => {
    const result = normalizeEmailForStorage("first.last@gmail.com");
    expect(result).toBe("firstlast@gmail.com");
  });

  it("Gmail + tag normalize eder", () => {
    const result = normalizeEmailForStorage("user+tag@gmail.com");
    expect(result).toBe("user@gmail.com");
  });

  it("Gmail olmayan alan adında alias kaldırmaz", () => {
    const result = normalizeEmailForStorage("user+tag@company.com");
    expect(result).toBe("user+tag@company.com");
  });

  it("zaten normalize edilmiş adresi değiştirmez", () => {
    const email = "simple@example.com";
    expect(normalizeEmailForStorage(email)).toBe(email);
  });
});
