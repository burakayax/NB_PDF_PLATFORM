import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, sendMail } = vi.hoisted(() => ({ findMany: vi.fn(), sendMail: vi.fn() }));

vi.mock("../lib/prisma.js", () => ({ prisma: { socialPost: { findMany } } }));
vi.mock("../lib/mailer.js", () => ({ sendMail }));
vi.mock("../config/env.js", () => ({ env: { ADMIN_EMAIL: "yonetici@example.com" } }));
vi.mock("../lib/file-log.js", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("../modules/social/gsc.service.js", () => ({
  periodReport: vi.fn(async (from: string, to: string) => ({ available: true, from, to, clicks: 1, impressions: 2, avgPosition: 3, pages: [], queries: [] })),
}));

import { agentGscController, agentMailController, agentSocialPostsController, agentTokenOk } from "../modules/agent-data/agent-data.js";

const TOKEN = "t".repeat(40);

function req(auth?: string, extra: Record<string, unknown> = {}) {
  return { headers: auth ? { authorization: auth } : {}, query: {}, body: {}, ...extra } as never;
}
function res() {
  const r = { code: 0, body: undefined as unknown, status(c: number) { this.code = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  return r;
}

describe("agent-data uçları", () => {
  beforeEach(() => {
    process.env.AGENT_DATA_TOKEN = TOKEN;
    findMany.mockReset();
    sendMail.mockReset();
  });
  afterEach(() => {
    delete process.env.AGENT_DATA_TOKEN;
  });

  it("token yoksa ya da kısaysa kapalı", () => {
    delete process.env.AGENT_DATA_TOKEN;
    expect(agentTokenOk(req(`Bearer ${TOKEN}`))).toBe(false);
    process.env.AGENT_DATA_TOKEN = "kisa";
    expect(agentTokenOk(req("Bearer kisa"))).toBe(false);
  });

  it("yanlış token 404 döner ve veri okunmaz", async () => {
    const r = res();
    await agentSocialPostsController(req("Bearer yanlis"), r as never);
    expect(r.code).toBe(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("doğru token ile Search Console iki dönem döner", async () => {
    const r = res();
    await agentGscController(req(`Bearer ${TOKEN}`), r as never);
    expect(r.code).toBe(200);
    expect(Object.keys(r.body as object)).toEqual(["current", "previous"]);
  });

  it("sosyal uç yalnız okur ve gizli alan döndürmez", async () => {
    findMany.mockResolvedValue([
      { platform: "INSTAGRAM", lang: "tr", title: "T", linkUrl: "https://x", body: "metin", status: "PUBLISHED", scheduledAt: new Date(), publishedAt: null },
    ]);
    const r = res();
    await agentSocialPostsController(req(`Bearer ${TOKEN}`), r as never);
    expect(r.code).toBe(200);
    const sel = findMany.mock.calls[0][0].select as Record<string, boolean>;
    expect(Object.keys(sel)).not.toContain("secretsJson");
    expect(JSON.stringify(r.body)).not.toMatch(/secret|token/i);
  });

  it("e-posta yalnız yöneticiye gider; alıcı gövdeden alınmaz", async () => {
    const r = res();
    await agentMailController(req(`Bearer ${TOKEN}`, { body: { subject: "S", text: "M", to: "baska@x.com" } }), r as never);
    expect(r.code).toBe(200);
    const arg = sendMail.mock.calls[0][0] as { to: string };
    expect(arg.to).toBe("yonetici@example.com");
  });

  it("e-posta boş içerikte 400", async () => {
    const r = res();
    await agentMailController(req(`Bearer ${TOKEN}`, { body: {} }), r as never);
    expect(r.code).toBe(400);
  });
});
