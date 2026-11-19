import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs betik, tip bildirimi yok
import { findProblems } from "../../scripts/static-asset-hashes.mjs";

describe("uzun önbellekli statik dosyalar", () => {
  it("içerik değişikliği dosya adı sürümlenmeden yapılmamış olmalı", () => {
    expect(findProblems()).toEqual([]);
  });
});
