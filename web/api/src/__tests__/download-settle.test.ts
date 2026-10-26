import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  quota: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { downloadLog: { findFirst: m.findFirst, create: m.create, updateMany: m.updateMany } },
}));
vi.mock("../lib/quota.js", () => ({ checkAndIncrementQuota: m.quota }));

import { downloadSettleController } from "../modules/entitlement/download-settle.controller.js";

function run(body: unknown) {
  const json = vi.fn();
  const response = { status: vi.fn(() => ({ json })) };
  const request = { authUser: { id: "u1" }, body };
  return downloadSettleController(request as never, response as never).then(() => json.mock.calls[0]?.[0]);
}

describe("download-settle: kota teslimde sunucuda düşer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.quota.mockResolvedValue({ allowed: true });
  });

  it("tarayıcı kaydı hiç açılmadıysa kaydı açar ve kotayı düşer", async () => {
    m.findFirst.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: "l1", toolId: "compress" });
    m.updateMany.mockResolvedValue({ count: 1 });
    const out = await run({ resultId: "r1", toolId: "compress" });
    expect(m.create).toHaveBeenCalledOnce();
    expect(m.quota).toHaveBeenCalledWith("u1", "compress", 1, 0);
    expect(out).toEqual({ ok: true, quotaCounted: true });
  });

  it("tarayıcı onayı zaten geldiyse tekrar düşmez", async () => {
    m.findFirst.mockResolvedValue({ id: "l1", toolId: "compress", status: "SUCCESS" });
    m.updateMany.mockResolvedValue({ count: 0 });
    const out = await run({ resultId: "r1", toolId: "compress" });
    expect(m.quota).not.toHaveBeenCalled();
    expect(out).toEqual({ ok: true, already: true });
  });

  it("bekleyen kayıt varsa onu kullanır, yeni kayıt açmaz", async () => {
    m.findFirst.mockResolvedValue({ id: "l1", toolId: "compress", status: "PENDING" });
    m.updateMany.mockResolvedValue({ count: 1 });
    await run({ resultId: "r1", toolId: "compress" });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.quota).toHaveBeenCalledOnce();
  });
});
