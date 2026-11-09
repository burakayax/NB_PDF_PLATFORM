/**
 * Ödeme kapısı: ödemeler kullanıcılara KAPALIYKEN yalnız doğrulanmış ADMIN oturumu geçer.
 * (Kullanıcılara açmadan canlı PayTR denemesi için.)
 */
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ getSetting: vi.fn(), verify: vi.fn() }));

vi.mock("../lib/site-config.service.js", () => ({ getSetting: h.getSetting }));
vi.mock("../lib/jwt.js", () => ({ verifyAccessToken: h.verify }));
vi.mock("../lib/role-policy.js", () => ({
  resolveRoleFromEmail: (e: string) => (e === "admin@x.test" ? "ADMIN" : "USER"),
}));

import { requirePaymentsEnabled } from "../modules/payment/payments-gate.middleware.js";

function run(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  const next = vi.fn();
  return requirePaymentsEnabled(req, res, next).then(() => ({ next, status, json }));
}

describe("requirePaymentsEnabled — admin istisnası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getSetting.mockResolvedValue({ featureFlags: { paymentsDisabled: true } }); // ödemeler KAPALI
  });

  it("kapalıyken oturumsuz istek → 503", async () => {
    const r = await run();
    expect(r.next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(503);
  });

  it("kapalıyken sıradan kullanıcı → 503", async () => {
    h.verify.mockReturnValue({ email: "kullanici@x.test" });
    const r = await run("Bearer abc");
    expect(r.next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(503);
  });

  it("kapalıyken sahte/süresi dolmuş jeton → 503", async () => {
    h.verify.mockImplementation(() => {
      throw new Error("invalid");
    });
    const r = await run("Bearer sahte");
    expect(r.next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(503);
  });

  it("kapalıyken ADMIN → geçer", async () => {
    h.verify.mockReturnValue({ email: "admin@x.test" });
    const r = await run("Bearer ok");
    expect(r.next).toHaveBeenCalledTimes(1);
    expect(r.status).not.toHaveBeenCalled();
  });

  it("ödemeler açıkken herkes geçer", async () => {
    h.getSetting.mockResolvedValue({ featureFlags: { paymentsDisabled: false } });
    const r = await run();
    expect(r.next).toHaveBeenCalledTimes(1);
  });
});
