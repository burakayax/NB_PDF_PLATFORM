import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const p = new URL("../../../../cloudflare/ajan-tetik-worker.mjs", import.meta.url).href;
const mod = (await import(/* @vite-ignore */ p)) as {
  tetikle: (c: string, t: string, f?: unknown) => Promise<{ ok: boolean; ajan: string | null; durum: unknown }>;
};

describe("ajan tetik Worker", () => {
  it("durum ve ozet icin yalniz tek POST atar, anahtar govdede yok", async () => {
    const calls: Array<{ url: string; init: { method: string; body: string } }> = [];
    const f = async (url: string, init: { method: string; body: string }) => {
      calls.push({ url, init });
      return { status: 204 };
    };
    expect((await mod.tetikle("45 4 * * *", "T0KEN", f)).ajan).toBe("durum");
    const r = await mod.tetikle("25 5 * * *", "T0KEN", f);
    expect(r).toMatchObject({ ok: true, ajan: "ozet" });
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.init.method === "POST" && c.url.endsWith("/workflows/ajanlar.yml/dispatches"))).toBe(true);
    expect(calls.every((c) => !c.init.body.includes("T0KEN"))).toBe(true);
  });
  it("bilinmeyen cron ya da anahtarsiz cagri istek atmaz", async () => {
    const f = async () => { throw new Error("istek atilmamali"); };
    expect((await mod.tetikle("1 1 * * *", "x", f)).ok).toBe(false);
    expect((await mod.tetikle("45 4 * * *", "", f)).durum).toBe("anahtar-yok");
  });
  it("Worker'in tetikledigi ajanlarin GitHub zamanlamasi yok (cift calisma olmasin)", () => {
    const yml = readFileSync(fileURLToPath(new URL("../../../../.github/workflows/ajanlar.yml", import.meta.url)), "utf8");
    expect(yml).not.toContain('cron: "37 4 * * *"');
    expect(yml).not.toContain('cron: "19 5 * * *"');
    expect(yml).toMatch(/options: \[[^\]]*\bdurum\b[^\]]*\bozet\b/);
  });
});
