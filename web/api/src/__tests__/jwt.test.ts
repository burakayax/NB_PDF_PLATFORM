/**
 * JWT yardımcı fonksiyonları unit testleri.
 * DB veya ağ bağımlılığı yoktur — yalnızca jsonwebtoken + env.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Test ortamı için minimal env — gerçek .env dosyası olmadan çalışır.
beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret-must-be-32chars!!";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-must-be-32chars!";
  process.env.ACCESS_TOKEN_TTL_MINUTES = "15";
  process.env.REFRESH_TOKEN_TTL_DAYS = "7";
  process.env.DESKTOP_ACCESS_TOKEN_TTL_DAYS = "4";
  process.env.DATABASE_URL = "file:./test.db";
  process.env.NODE_ENV = "test";
});

// Dinamik import — env set edilmeden önce import edilirse env validator hata verir.
async function loadJwt() {
  const mod = await import("../lib/jwt.js");
  return mod;
}

const TEST_PAYLOAD = {
  sub: "user-cuid-123",
  email: "test@example.com",
  plan: "FREE" as const,
  role: "USER" as const,
  orgRole: "OWNER" as const,
};

describe("signAccessToken / verifyAccessToken", () => {
  it("geçerli bir access token üretir ve doğrular", async () => {
    const { signAccessToken, verifyAccessToken } = await loadJwt();
    const token = signAccessToken(TEST_PAYLOAD);
    expect(typeof token).toBe("string");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(TEST_PAYLOAD.sub);
    expect(payload.email).toBe(TEST_PAYLOAD.email);
    expect(payload.type).toBe("access");
  });

  it("refresh token'ı access doğrulayıcıda reddeder", async () => {
    const { signRefreshToken, verifyAccessToken } = await loadJwt();
    const refreshToken = signRefreshToken(TEST_PAYLOAD);
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });

  it("tampered token'ı reddeder", async () => {
    const { signAccessToken, verifyAccessToken } = await loadJwt();
    const token = signAccessToken(TEST_PAYLOAD);
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("boş string'i reddeder", async () => {
    const { verifyAccessToken } = await loadJwt();
    expect(() => verifyAccessToken("")).toThrow();
  });
});

describe("signRefreshToken / verifyRefreshToken", () => {
  it("geçerli bir refresh token üretir ve doğrular", async () => {
    const { signRefreshToken, verifyRefreshToken } = await loadJwt();
    const token = signRefreshToken(TEST_PAYLOAD);
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(TEST_PAYLOAD.sub);
    expect(payload.type).toBe("refresh");
  });

  it("access token'ı refresh doğrulayıcıda reddeder", async () => {
    const { signAccessToken, verifyRefreshToken } = await loadJwt();
    const accessToken = signAccessToken(TEST_PAYLOAD);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

describe("signPasswordResetJwt / verifyPasswordResetJwt", () => {
  it("şifre sıfırlama token'ı üretir ve userId döndürür", async () => {
    const { signPasswordResetJwt, verifyPasswordResetJwt } = await loadJwt();
    const token = signPasswordResetJwt("user-cuid-xyz");
    const userId = verifyPasswordResetJwt(token);
    expect(userId).toBe("user-cuid-xyz");
  });

  it("access token'ı pwd_reset doğrulayıcıda reddeder", async () => {
    const { signAccessToken, verifyPasswordResetJwt } = await loadJwt();
    const token = signAccessToken(TEST_PAYLOAD);
    expect(() => verifyPasswordResetJwt(token)).toThrow();
  });
});
