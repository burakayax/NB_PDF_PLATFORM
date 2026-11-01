import { describe, expect, it } from "vitest";
import { isPublicApiPath } from "../middleware/api-security.middleware.js";

/**
 * TikTok izin ekranından dönen tarayıcı yönetici anahtarı taşımaz. Adres "açık" listesinde yoksa
 * genel güvenlik katmanı 401 verir ve anahtarlar hiç kaydedilmez (canlıda yaşanan hata).
 */
describe("TikTok geri dönüş adresi girişsiz açık", () => {
  it("GET /auth/tiktok/callback açık", () => {
    expect(isPublicApiPath("GET", "/auth/tiktok/callback")).toBe(true);
  });
  it("başka yöntem ve komşu adresler kapalı kalır", () => {
    expect(isPublicApiPath("POST", "/auth/tiktok/callback")).toBe(false);
    expect(isPublicApiPath("GET", "/auth/tiktok/ping")).toBe(false);
    expect(isPublicApiPath("GET", "/auth/tiktok/callback/x")).toBe(false);
  });
  it("yönetici uçları (TikTok bağlan / adres) hâlâ giriş ister", () => {
    expect(isPublicApiPath("GET", "/admin/social/tiktok/connect")).toBe(false);
    expect(isPublicApiPath("GET", "/admin/social/tiktok/redirect-uri")).toBe(false);
  });
});
