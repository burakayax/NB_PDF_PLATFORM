/**
 * AES-256-GCM şifreleme/çözme unit testleri (TC Kimlik ve hassas alan şifrelemesi).
 */

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  // encryption.ts BILLING_ENCRYPTION_KEY okur (min 32 karakter). 64 karakter hex.
  process.env.BILLING_ENCRYPTION_KEY = "a".repeat(64);
});

async function loadEncryption() {
  return import("../lib/encryption.js");
}

describe("encryptField / decryptField", () => {
  it("şifreler ve çözer — orijinal değer korunur", async () => {
    const { encryptField, decryptField } = await loadEncryption();
    const plain = "12345678901";
    const encrypted = encryptField(plain);
    expect(encrypted).not.toBe(plain);
    expect(decryptField(encrypted)).toBe(plain);
  });

  it("aynı değer için farklı ciphertext üretir (IV randomness)", async () => {
    const { encryptField } = await loadEncryption();
    const c1 = encryptField("sensitive-data");
    const c2 = encryptField("sensitive-data");
    expect(c1).not.toBe(c2);
  });

  it("format: ivHex:tagHex:ciphertextHex — 3 parça", async () => {
    const { encryptField } = await loadEncryption();
    const parts = encryptField("test").split(":");
    expect(parts).toHaveLength(3);
    // Her parça hex olmalı
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/i);
    }
  });

  it("tampered ciphertext çözmeye çalışmak hata fırlatır", async () => {
    const { encryptField, decryptField } = await loadEncryption();
    const encrypted = encryptField("value");
    const parts = encrypted.split(":");
    // Son parçayı boz
    parts[2] = "deadbeef" + parts[2].slice(8);
    expect(() => decryptField(parts.join(":"))).toThrow();
  });

  it("geçersiz format hata fırlatır", async () => {
    const { decryptField } = await loadEncryption();
    expect(() => decryptField("not-valid-format")).toThrow();
    expect(() => decryptField("only:two")).toThrow();
  });
});
