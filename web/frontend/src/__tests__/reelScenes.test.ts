import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — tip tanımı olmayan üretim betiği
import { BANNED_PHRASES, LINK_LINES, SCENES, processingMismatch } from "../../scripts/tool-reels/scenes/index.mjs";
// @ts-expect-error — tip tanımı olmayan içerik modülü
import { TOOL_PROCESSING } from "../content/toolProcessing.mjs";

const root = resolve(__dirname, "../..");
const scenesDir = resolve(root, "scripts/tool-reels/scenes");
const ids = Object.keys(SCENES as Record<string, unknown>);

describe("araç tanıtım videosu sahneleri", () => {
  it("API'deki sahne listesi ile aynıdır", () => {
    const api = readFileSync(resolve(root, "../api/src/modules/social/tool-reel-scenes.ts"), "utf8");
    const list = api.match(/REEL_SCENE_TOOL_IDS[^=]*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort()).toEqual([...ids].sort());
  });

  it("gizlilik anlatımı aracın gerçek çalışma biçimiyle uyuşur", () => {
    for (const id of ids) expect(processingMismatch(id, TOOL_PROCESSING)).toBeNull();
  });

  it("koşullu cihaz aracında koşulsuz söz reddedilir", () => {
    expect(processingMismatch("udf-to-pdf", [{ id: "udf-to-pdf", where: "device", noteTr: "büyük dosyada sunucu" }])).toContain("koşullu");
    expect(processingMismatch("udf-to-pdf", [{ id: "udf-to-pdf", where: "server", noteTr: "" }])).toContain("server");
  });

  it.each(ids)("%s: yer tutucular, müzik, kapanış vitrini var ve yasak söz yok", (id) => {
    const html = readFileSync(resolve(scenesDir, `${id}.html`), "utf8");
    for (const part of ["/*FONTLAR*/", "__EMBLEM__", "window.META", "window.render", "window.ARAC_SAYISI", "window.BAGLANTI"]) {
      expect(html).toContain(part);
    }
    for (const banned of BANNED_PHRASES as RegExp[]) expect(html).not.toMatch(banned);
    expect(readFileSync(resolve(scenesDir, "sounds.mjs"), "utf8")).toContain(`"${id}"(sure)`);
    expect(existsSync(resolve(root, `public/reel-covers/${id}.jpg`))).toBe(true);
  });

  it("üç platform için ayrı yönlendirme satırı vardır", () => {
    expect(new Set(Object.values(LINK_LINES as Record<string, string>)).size).toBe(3);
  });
});
