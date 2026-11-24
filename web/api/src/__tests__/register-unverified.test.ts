import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * KAYIT: doğrulama e-postası gönderilemezse kullanıcı SİLİNMEZ (panelde "E-posta onayı bekliyor" görünür) ve
 * onaysız hesap aynı adresle tekrar kayıtta yeni bağlantı alır; onaylı hesapta eski davranış (409) sürer.
 */

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(async () => ({})),
  del: vi.fn(async () => ({})),
  tokenCreate: vi.fn(async () => ({})),
  tokenFindFirst: vi.fn(async () => null as { createdAt: Date } | null),
  tokenCount: vi.fn(async () => 0),
  sendMail: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: m.findUnique, create: m.create, update: m.update, delete: m.del, count: vi.fn(async () => 1) },
    emailVerificationToken: { create: m.tokenCreate, findFirst: m.tokenFindFirst, count: m.tokenCount },
  },
}));
vi.mock("../lib/mailer.js", () => ({ sendMail: m.sendMail }));
vi.mock("../lib/blocked-email.js", () => ({ isEmailBlocked: vi.fn(async () => false) }));
vi.mock("../lib/password.js", () => ({ hashPassword: vi.fn(async () => "hash"), verifyPassword: vi.fn() }));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../lib/auth-log.js", () => ({ authLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { registerUser, resendVerificationEmail } from "../modules/auth/auth.service.js";

const input = {
  email: "kisi@example.com",
  password: "Sifre-12345!",
  firstName: "Ada",
  lastName: "Test",
  preferredLanguage: "tr" as const,
};
const baseUser = {
  id: "u1",
  email: "kisi@example.com",
  firstName: "Ada",
  lastName: "Test",
  name: "Ada Test",
  role: "USER",
  plan: "FREE",
  isVerified: false,
  authProvider: "local",
  preferredLanguage: "tr",
  createdAt: new Date("2026-11-24T20:00:00Z"),
  updatedAt: new Date("2026-11-24T20:00:00Z"),
  termsAcceptedAt: new Date("2026-11-24T20:00:00Z"),
  lastLoginAt: null,
};

describe("registerUser — onaysız hesap", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.update.mockResolvedValue({});
    m.del.mockResolvedValue({});
    m.tokenCreate.mockResolvedValue({});
    m.tokenFindFirst.mockResolvedValue(null);
    m.tokenCount.mockResolvedValue(0);
  });

  it("e-posta gönderilemezse kullanıcı silinmez, 503 döner", async () => {
    m.findUnique.mockResolvedValue(null);
    m.create.mockResolvedValue({ ...baseUser, legalAcceptances: [] });
    m.sendMail.mockRejectedValue(new Error("smtp down"));
    await expect(registerUser(input as never)).rejects.toMatchObject({ statusCode: 503 });
    expect(m.del).not.toHaveBeenCalled();
  });

  it("onaysız mevcut hesapla tekrar kayıt: 409 değil, yeni bağlantı gönderilir; hesap oluşturulmaz/silinmez", async () => {
    m.findUnique.mockResolvedValue(baseUser);
    m.sendMail.mockResolvedValue(undefined);
    const r = await registerUser(input as never);
    expect(r.verificationRequired).toBe(true);
    expect(m.sendMail).toHaveBeenCalledTimes(1);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
  });

  it("onaylı mevcut hesapla kayıt hâlâ 409", async () => {
    m.findUnique.mockResolvedValue({ ...baseUser, isVerified: true });
    await expect(registerUser(input as never)).rejects.toMatchObject({ statusCode: 409 });
    expect(m.sendMail).not.toHaveBeenCalled();
  });
});

describe("resendVerificationEmail — spam korumaları", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.update.mockResolvedValue({});
    m.tokenCreate.mockResolvedValue({});
    m.tokenFindFirst.mockResolvedValue(null);
    m.tokenCount.mockResolvedValue(0);
    m.sendMail.mockResolvedValue(undefined);
  });

  it("onaysız hesaba gönderir", async () => {
    m.findUnique.mockResolvedValue(baseUser);
    await resendVerificationEmail("kisi@example.com");
    expect(m.sendMail).toHaveBeenCalledTimes(1);
  });

  it("olmayan, onaylı ve Google hesabına hiçbir şey göndermez (sessiz)", async () => {
    m.findUnique.mockResolvedValueOnce(null);
    await resendVerificationEmail("yok@example.com");
    m.findUnique.mockResolvedValueOnce({ ...baseUser, isVerified: true });
    await resendVerificationEmail("kisi@example.com");
    m.findUnique.mockResolvedValueOnce({ ...baseUser, authProvider: "google" });
    await resendVerificationEmail("kisi@example.com");
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("son gönderimden 60 sn geçmediyse göndermez", async () => {
    m.findUnique.mockResolvedValue(baseUser);
    m.tokenFindFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 10_000) });
    await resendVerificationEmail("kisi@example.com");
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("günde 5 gönderimden sonra göndermez", async () => {
    m.findUnique.mockResolvedValue(baseUser);
    m.tokenCount.mockResolvedValue(5);
    await resendVerificationEmail("kisi@example.com");
    expect(m.sendMail).not.toHaveBeenCalled();
  });

  it("tekrar kayıt yolu da aynı sınırlara tabidir", async () => {
    m.findUnique.mockResolvedValue(baseUser);
    m.tokenFindFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 5_000) });
    const r = await registerUser(input as never);
    expect(r.verificationRequired).toBe(true);
    expect(m.sendMail).not.toHaveBeenCalled();
  });
});
