import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { operationWeight, OPERATION_WEIGHTS } from "../lib/quota.js";

describe("hak ağırlığı (havuz)", () => {
  it("bilinmeyen/hafif araç 1 hak sayılır", () => {
    expect(operationWeight("compress")).toBe(1);
    expect(operationWeight("word-to-pdf")).toBe(1);
    expect(operationWeight("tanimsiz-arac")).toBe(1);
  });
  it("uzun süren araçlar daha çok hak sayar", () => {
    expect(operationWeight("pdf-to-image")).toBe(2);
    expect(operationWeight("pdf-to-ppt")).toBe(3);
    expect(operationWeight("pdf-to-excel")).toBe(1);
  });

  it("ön yüzdeki kopya sunucuyla aynıdır", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "..", "..", "frontend", "src", "lib", "operationWeights.ts"), "utf8");
    const block = /OPERATION_WEIGHTS[^=]*=\s*\{([^}]*)\}/.exec(src)?.[1] ?? "";
    const pairs = [...block.matchAll(/"([a-z0-9-]+)"\s*:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])] as const);
    expect(Object.fromEntries(pairs)).toEqual({ ...OPERATION_WEIGHTS });
  });
  it("tüm ağırlıklar tam sayı ve >= 1", () => {
    for (const w of Object.values(OPERATION_WEIGHTS)) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(1);
    }
  });
});
