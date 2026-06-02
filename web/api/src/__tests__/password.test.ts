/**
 * Şifre hash ve doğrulama unit testleri.
 */

import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("hashPassword", () => {
  it("bcrypt hash üretir ($2b$ prefix)", async () => {
    const hash = await hashPassword("StrongP@ss1!");
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("aynı şifreden farklı hash üretir (salt nedeniyle)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyPassword", () => {
  it("doğru şifre için true döner", async () => {
    const hash = await hashPassword("CorrectHorse99!");
    expect(await verifyPassword("CorrectHorse99!", hash)).toBe(true);
  });

  it("yanlış şifre için false döner", async () => {
    const hash = await hashPassword("CorrectHorse99!");
    expect(await verifyPassword("WrongPassword!", hash)).toBe(false);
  });

  it("boş şifre için false döner", async () => {
    const hash = await hashPassword("SomePassword1!");
    expect(await verifyPassword("", hash)).toBe(false);
  });
});
