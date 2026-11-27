import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error tip bildirimi olmayan .mjs
import { RESULT_TITLE } from "../../scripts/tool-reels/lib/result-title.mjs";

describe("araç videosu sonuç başlığı", () => {
  const panel = readFileSync(resolve(process.cwd(), "src/components/common/ToolResultPanel.tsx"), "utf8");

  it.each(["ready", "readyGeneric"])("sonuç panelinin Türkçe '%s' başlığını tanır", (key) => {
    // İlk eşleşme Türkçe sözlüktedir (L.tr, L.en'den önce gelir).
    const title = panel.match(new RegExp(` ${key}: "([^"]+)"`))?.[1];
    expect(title).toBeTruthy();
    expect(title).toMatch(RESULT_TITLE);
  });
});
