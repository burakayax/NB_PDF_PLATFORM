import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_LIMITS, UNLIMITED_MONTHLY_OPS } from "../lib/plan-catalogue.js";
import { planDefinitions } from "../modules/subscription/subscription.config.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "..", "..", "frontend", "src", "lib", "planConfig.ts"), "utf8").split("\r\n").join("\n");

function toolList(name: string): string[] {
  const m = src.match(new RegExp(String.raw`export const ${name}: FeatureKey\[\] = \[([\s\S]*?)\];`));
  if (!m) throw new Error(`${name} bulunamadı`);
  return [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
}

function planBlock(id: string): string {
  const start = src.indexOf(`id: "${id}",\n    nameTr`);
  if (start < 0) throw new Error(`${id} planı bulunamadı`);
  const next = src.indexOf('\n  {\n    id: "', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

const num = (block: string, key: string): number | null => {
  const m = block.match(new RegExp(String.raw`${key}: (null|\d+)`));
  if (!m) throw new Error(`${key} bulunamadı`);
  return m[1] === "null" ? null : Number(m[1]);
};

describe("sayısal limitler: sunucu ve ön yüz aynı sayıyı söyler", () => {
  for (const id of ["FREE", "STARTER", "PLUS", "PRO", "BUSINESS"] as const) {
    it(`${id}: günlük / aylık / dosya boyutu / toplu işlem`, () => {
      const fe = planBlock(id);
      const be = PLAN_LIMITS[id];
      expect(num(fe, "dailyOpsLimit")).toBe(be.dailyOperationLimit);
      const monthly = num(fe, "monthlyOpsLimit");
      expect(monthly === null ? UNLIMITED_MONTHLY_OPS : monthly).toBe(be.monthlyOperationLimit);
      const size = num(fe, "fileSizeMB");
      expect(size === null ? 999999 : size).toBe(be.fileSizeLimitMB);
      expect(num(fe, "batchLimit")).toBe(be.batchLimit);
    });

    it(`${id}: abonelik tanımındaki günlük limit katalogla aynı`, () => {
      expect(planDefinitions[id].dailyLimit).toBe(PLAN_LIMITS[id].dailyOperationLimit);
    });
  }
});

describe("kilitli araçlar: kart ve sunucu aynı listeden", () => {
  it("ücretsiz plan araçları", () => {
    expect([...toolList("FREE_PLAN_TOOL_IDS")].sort()).toEqual([...planDefinitions.FREE.allowedFeatures].sort());
  });
  it("starter plan araçları", () => {
    expect([...toolList("STARTER_TOOL_IDS")].sort()).toEqual([...planDefinitions.STARTER.allowedFeatures].sort());
  });
});
