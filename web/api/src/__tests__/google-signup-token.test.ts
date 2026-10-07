import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({ env: { JWT_ACCESS_SECRET: "x".repeat(40) } }));

import jwt from "jsonwebtoken";
import { signGoogleSignupToken, verifyGoogleSignupToken } from "../lib/google-signup-token.js";

/**
 * Google ile YENİ hesap: onay ekranı jetonu. Başka amaçlı bir jeton (erişim/parola sıfırlama) bu işte KABUL EDİLMEZ.
 */
const profile = { email: "a@x.com", googleId: "g1", name: "Ayşe", givenName: "Ayşe", familyName: "Y", avatar: null, preferredLanguage: "tr" as const };

describe("google signup token", () => {
  it("imzalanıp doğrulanır", () => {
    expect(verifyGoogleSignupToken(signGoogleSignupToken(profile))).toEqual(profile);
  });

  it("erişim jetonu bu iş için geçersizdir", () => {
    const access = jwt.sign({ sub: "u1", email: "a@x.com", type: "access" }, "x".repeat(40));
    expect(() => verifyGoogleSignupToken(access)).toThrow();
  });

  it("parola sıfırlama jetonu geçersizdir", () => {
    const pwd = jwt.sign({ sub: "u1", typ: "pwd_reset" }, "x".repeat(40));
    expect(() => verifyGoogleSignupToken(pwd)).toThrow();
  });

  it("farklı anahtarla imzalı jeton geçersizdir", () => {
    const forged = jwt.sign({ ...profile, typ: "google_signup" }, "y".repeat(40));
    expect(() => verifyGoogleSignupToken(forged)).toThrow();
  });

  it("süresi dolmuş jeton geçersizdir", () => {
    const expired = jwt.sign({ ...profile, typ: "google_signup" }, "x".repeat(40), { expiresIn: -10 });
    expect(() => verifyGoogleSignupToken(expired)).toThrow();
  });
});
