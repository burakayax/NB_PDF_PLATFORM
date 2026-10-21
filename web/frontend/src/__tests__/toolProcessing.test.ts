import { describe, it, expect } from "vitest";
// @ts-expect-error .mjs içerik dosyası tip bildirimi taşımaz
import { TOOL_PROCESSING, toolProcessingTableLines } from "../content/toolProcessing.mjs";
import { ON_DEVICE_TOOLS } from "../lib/onDeviceTools";
import { FREE_PLAN_TOOL_IDS, PLANS } from "../lib/planConfig";

type Row = { id: string; where: "device" | "server" | "ai" };

describe("gizlilik tablosu (araç bazında dosya işleme)", () => {
  const rows = TOOL_PROCESSING as Row[];

  it("cihazda işlenen araçlar onDeviceTools listesiyle birebir aynıdır", () => {
    const device = new Set(rows.filter((r) => r.where === "device").map((r) => r.id));
    expect([...device].sort()).toEqual([...ON_DEVICE_TOOLS].sort());
  });

  it("aynı araç iki kez yazılmamıştır", () => {
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ücretsiz plandaki sunucu araçları tabloda vardır", () => {
    const ids = new Set(rows.map((r) => r.id));
    for (const id of FREE_PLAN_TOOL_IDS) expect(ids.has(id)).toBe(true);
  });

  it("her satırın sütun sayısı başlıkla aynıdır", () => {
    for (const lang of ["tr", "en"]) {
      const lines = toolProcessingTableLines(lang) as string[];
      const cols = lines[0].split("|").length;
      for (const l of lines) expect(l.split("|").length).toBe(cols);
    }
  });
});

describe("ücretsiz limitler tek kaynaktan", () => {
  it("ücretsiz plan kartı metni katalogdaki günlük/aylık sayıyı söyler", () => {
    const free = PLANS.find((p) => p.id === "FREE")!;
    expect(free.featuresTr.join(" ")).toContain(`günde ${free.dailyOpsLimit} işlem`);
    expect(free.featuresTr.join(" ")).toContain(`ayda ${free.monthlyOpsLimit}`);
  });
});
