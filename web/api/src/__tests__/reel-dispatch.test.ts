import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { dispatchReelProduction } from "../modules/social/reel-dispatch.js";

afterEach(() => {
  delete process.env.GITHUB_DISPATCH_TOKEN;
  delete process.env.GITHUB_REPO;
});

describe("panelden video üretimi başlatma", () => {
  it("anahtar yoksa istek atmaz", async () => {
    const f = vi.fn();
    expect(await dispatchReelProduction("compress", f as never)).toEqual({ ok: false, reason: "not-configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("doğru adrese araç kimliğiyle istek atar", async () => {
    process.env.GITHUB_DISPATCH_TOKEN = "tok";
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await dispatchReelProduction("merge", f as never)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/burakayax/NB_PDF_PLATFORM/actions/workflows/tool-reels.yml/dispatches");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main", inputs: { tool: "merge" } });
  });

  it("GitHub reddederse hata döner, fırlatmaz", async () => {
    process.env.GITHUB_DISPATCH_TOKEN = "tok";
    const f = vi.fn(async () => new Response("no", { status: 403 }));
    expect(await dispatchReelProduction("merge", f as never)).toMatchObject({ ok: false, reason: "failed" });
  });
});
