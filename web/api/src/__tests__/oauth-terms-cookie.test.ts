import { describe, expect, it } from "vitest";

import { parseOAuthStateCookieValue } from "../modules/auth/auth.controller.js";

/** Google OAuth çerezi: kayıt ekranında zorunlu onaylar işaretlendiyse "|terms|1" taşır. */
describe("parseOAuthStateCookieValue terms işareti", () => {
  it("işaret yoksa false", () => {
    expect(parseOAuthStateCookieValue("abc|tr").termsAccepted).toBe(false);
  });
  it("işaret varsa true (diğer parçalarla birlikte)", () => {
    const p = parseOAuthStateCookieValue(`abc|tr|desktop|5555|fe|${encodeURIComponent("https://www.pdfplatform.app")}|terms|1`);
    expect(p.termsAccepted).toBe(true);
    expect(p.desktopLocalPort).toBe(5555);
    expect(p.frontendOriginRaw).toBe("https://www.pdfplatform.app");
  });
  it("terms|0 kabul sayılmaz", () => {
    expect(parseOAuthStateCookieValue("abc|en|terms|0").termsAccepted).toBe(false);
  });
});
