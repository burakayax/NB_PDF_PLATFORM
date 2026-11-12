import { describe, expect, it } from "vitest";

import {
  makeUnsubscribeToken,
  unsubscribeUrlFor,
  verifyUnsubscribeToken,
} from "../modules/email/email-unsubscribe.service.js";
import { renderCorporateEmail } from "../lib/email-layout.js";

describe("abonelikten çıkış bağlantısı", () => {
  it("imzalı token kullanıcıyı geri verir", () => {
    const t = makeUnsubscribeToken("user-123");
    expect(verifyUnsubscribeToken(t)).toBe("user-123");
  });

  it("değiştirilmiş veya bozuk token reddedilir", () => {
    const t = makeUnsubscribeToken("user-123");
    const [payload] = t.split(".");
    expect(verifyUnsubscribeToken(`${payload}.xxxx`)).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("tek-parca")).toBeNull();
    const other = makeUnsubscribeToken("user-999").split(".")[0];
    expect(verifyUnsubscribeToken(`${other}.${t.split(".")[1]}`)).toBeNull();
  });

  it("bağlantı çıkış ucunu gösterir", () => {
    expect(unsubscribeUrlFor("u1")).toMatch(/\/api\/email\/unsubscribe\?token=/);
  });
});

describe("e-posta şablonu", () => {
  it("çıkış bağlantısı verilince alt bilgide görünür", () => {
    const html = renderCorporateEmail({
      title: "t",
      bodyHtml: "<p>merhaba</p>",
      footerText: "f",
      productName: "PDF Platform",
      unsubscribeUrl: "https://ornek.test/api/email/unsubscribe?token=abc",
    });
    expect(html).toContain("E-posta aboneliğinden çık");
    expect(html).toContain("https://ornek.test/api/email/unsubscribe?token=abc");
  });
});
