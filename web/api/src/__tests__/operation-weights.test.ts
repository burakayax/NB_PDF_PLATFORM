import { describe, it, expect } from "vitest";
import { operationWeight, OPERATION_WEIGHTS } from "../lib/quota.js";

describe("hak ağırlığı (havuz)", () => {
  it("bilinmeyen/hafif araç 1 hak sayılır", () => {
    expect(operationWeight("compress")).toBe(1);
    expect(operationWeight("word-to-pdf")).toBe(1);
    expect(operationWeight("tanimsiz-arac")).toBe(1);
  });
  it("ağır araçlar 2 hak sayılır", () => {
    expect(operationWeight("pdf-to-ppt")).toBe(2);
    expect(operationWeight("pdf-to-excel")).toBe(2);
  });
  it("tüm ağırlıklar tam sayı ve >= 1", () => {
    for (const w of Object.values(OPERATION_WEIGHTS)) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(1);
    }
  });
});
