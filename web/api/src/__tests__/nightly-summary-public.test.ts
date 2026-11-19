import { describe, expect, it } from "vitest";
import { isPublicApiPath } from "../middleware/api-security.middleware.js";

describe("Gecelik özet adresi JWT kapısından geçer (kendi token kontrolü controller'da)", () => {
  it("GET açık", () => {
    expect(isPublicApiPath("GET", "/internal/nightly-summary")).toBe(true);
  });
  it("başka yöntem ve benzer adresler kapalı kalır", () => {
    expect(isPublicApiPath("POST", "/internal/nightly-summary")).toBe(false);
    expect(isPublicApiPath("GET", "/internal/nightly-summary/x")).toBe(false);
    expect(isPublicApiPath("GET", "/internal/other")).toBe(false);
  });
});
