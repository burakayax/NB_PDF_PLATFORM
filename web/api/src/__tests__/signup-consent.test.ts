import { describe, expect, it } from "vitest";

import { registerSchema } from "../modules/auth/auth.schema.js";
import { TERMS_VERSION, legalAcceptanceRows } from "../lib/legal-version.js";

/**
 * KAYIT ONAYLARI: Hizmet Şartları+Gizlilik ve KVKK aydınlatma (okundu) ZORUNLUDUR ve kanıtı yazılır. Yaş sınırı YOK.
 */

const base = {
  firstName: "Ayşe",
  lastName: "Yılmaz",
  email: "ayse@example.com",
  password: "Sup3rS3cret!x",
  preferredLanguage: "tr" as const,
};
const all = { termsAccepted: true, privacyNoticeRead: true };

describe("registerSchema zorunlu onaylar", () => {
  it("üç onay da true ise geçer", () => {
    expect(registerSchema.safeParse({ ...base, ...all }).success).toBe(true);
  });

  it.each(["termsAccepted", "privacyNoticeRead"] as const)("%s eksikse reddeder", (k) => {
    const body: Record<string, unknown> = { ...base, ...all };
    delete body[k];
    expect(registerSchema.safeParse(body).success).toBe(false);
  });

  it.each(["termsAccepted", "privacyNoticeRead"] as const)("%s false ise reddeder", (k) => {
    expect(registerSchema.safeParse({ ...base, ...all, [k]: false }).success).toBe(false);
  });

  it("yaş beyanı istenmez (yaş sınırı yok)", () => {
    expect(registerSchema.safeParse({ ...base, ...all }).success).toBe(true);
    expect(JSON.stringify(registerSchema.shape)).not.toContain("ageConfirmed");
  });

  it("pazarlama izni isteğe bağlı kalır", () => {
    expect(registerSchema.safeParse({ ...base, ...all, marketingConsent: false }).success).toBe(true);
  });
});

describe("legalAcceptanceRows", () => {
  it("iki tür kaydı sürüm, yol ve IP ile üretir", () => {
    const rows = legalAcceptanceRows("google", { ip: "1.2.3.4", userAgent: "UA" });
    expect(rows.map((r) => r.kind).sort()).toEqual(["privacy_notice_read", "terms_and_privacy"]);
    for (const r of rows) expect(r).toMatchObject({ version: TERMS_VERSION, via: "google", ip: "1.2.3.4", userAgent: "UA" });
  });

  it("bağlantı bilgisi yoksa null yazar", () => {
    expect(legalAcceptanceRows("email")[0]).toMatchObject({ ip: null, userAgent: null });
  });
});
