import type { Request } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requestHasInternalServiceSecret } from "../middleware/api-security.middleware.js";

/**
 * Sunucular arası çağrılar IP tabanlı rate limit / kötüye kullanım bloğundan
 * muaftır. Bu muafiyetin YANLIŞLIKLA açılması tüm limitleri devre dışı
 * bırakacağı için davranışı testle sabitliyoruz — özellikle sır tanımlı
 * değilken muafiyetin KAPALI kalması (fail-closed).
 */

const SECRET = "s3rvis-s1rri-uzun-ve-rastgele";

function req(headers: Record<string, string | string[] | undefined>): Request {
  return { headers } as unknown as Request;
}

describe("requestHasInternalServiceSecret", () => {
  const original = process.env.INTERNAL_SERVICE_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_SERVICE_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.INTERNAL_SERVICE_SECRET;
    } else {
      process.env.INTERNAL_SERVICE_SECRET = original;
    }
  });

  it("doğru sır ile eşleşir", () => {
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": SECRET }))).toBe(true);
  });

  it("baştaki/sondaki boşlukları yok sayar", () => {
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": `  ${SECRET}  ` }))).toBe(true);
  });

  it("yanlış sırrı reddeder", () => {
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": "yanlis" }))).toBe(false);
  });

  it("aynı uzunlukta ama farklı sırrı reddeder", () => {
    const sameLength = "x".repeat(SECRET.length);
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": sameLength }))).toBe(false);
  });

  it("başlık yoksa reddeder", () => {
    expect(requestHasInternalServiceSecret(req({}))).toBe(false);
  });

  it("boş başlığı reddeder", () => {
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": "   " }))).toBe(false);
  });

  it("FAIL-CLOSED: sunucuda sır tanımlı değilse muafiyet vermez", () => {
    delete process.env.INTERNAL_SERVICE_SECRET;
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": SECRET }))).toBe(false);
    // Boş başlıkla boş env eşleşip herkesi muaf tutmamalı.
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": "" }))).toBe(false);
  });

  it("FAIL-CLOSED: sır yalnızca boşluktan ibaretse muafiyet vermez", () => {
    process.env.INTERNAL_SERVICE_SECRET = "   ";
    expect(requestHasInternalServiceSecret(req({ "x-internal-secret": "   " }))).toBe(false);
  });

  it("tekrarlanan başlıkta ilk değeri kullanır", () => {
    expect(
      requestHasInternalServiceSecret(req({ "x-internal-secret": [SECRET, "yanlis"] })),
    ).toBe(true);
  });
});
