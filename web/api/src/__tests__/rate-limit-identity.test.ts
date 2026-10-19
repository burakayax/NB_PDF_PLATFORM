import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";

vi.mock("../config/env.js", () => ({
  env: { JWT_ACCESS_SECRET: "s".repeat(40), JWT_REFRESH_SECRET: "r".repeat(40), ACCESS_TOKEN_TTL_MINUTES: 15, REFRESH_TOKEN_TTL_DAYS: 7, API_RATE_LIMIT_PER_MINUTE: 300, API_ABUSE_THRESHOLD: 5, API_ABUSE_BLOCK_MINUTES: 60 },
}));
vi.mock("../lib/site-config.service.js", () => ({ getSetting: async () => null }));

import { rateLimitIdentity } from "../middleware/api-security.middleware.js";
import { signAccessToken } from "../lib/jwt.js";

const istek = (ip: string, auth?: string) =>
  ({ ip, headers: auth ? { authorization: auth } : {}, socket: {} }) as unknown as Request;

describe("hız sınırı kimliği", () => {
  const tok = (sub: string) =>
    signAccessToken({ sub, email: `${sub}@x.com`, plan: "FREE", role: "USER", orgRole: "OWNER", organizationId: null } as never);

  it("giriş yapmış kullanıcı kimliğe göre sayılır; aynı IP'deki iki kullanıcı ayrıdır", () => {
    const a = rateLimitIdentity(istek("1.1.1.1", `Bearer ${tok("A")}`));
    const b = rateLimitIdentity(istek("1.1.1.1", `Bearer ${tok("B")}`));
    expect(a).toEqual({ id: "u:A", authed: true });
    expect(b.id).toBe("u:B");
  });

  it("aynı kullanıcı farklı IP'den gelse de aynı kimliktir", () => {
    expect(rateLimitIdentity(istek("1.1.1.1", `Bearer ${tok("A")}`)).id).toBe(
      rateLimitIdentity(istek("9.9.9.9", `Bearer ${tok("A")}`)).id,
    );
  });

  it("misafir ve geçersiz anahtar IP ile sayılır", () => {
    expect(rateLimitIdentity(istek("2.2.2.2"))).toEqual({ id: "2.2.2.2", authed: false });
    expect(rateLimitIdentity(istek("2.2.2.2", "Bearer bozuk.anahtar"))).toEqual({ id: "2.2.2.2", authed: false });
  });
});
