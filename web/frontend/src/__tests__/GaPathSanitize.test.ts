import { describe, it, expect } from "vitest";
import { gizliParametreleriAyikla } from "../hooks/useGAPageTracking";

/**
 * Canlı testte görüldü: Google ile giriş sonrası kullanıcı
 * `/login-success?token=<erişim anahtarı>` adresine düşüyor ve sayfa görüntüleme
 * olayı adresi sorgu kısmıyla birlikte Google Analytics'e gönderiyordu — yani
 * geçerli bir oturum anahtarı üçüncü tarafa gidiyordu.
 */
describe("ölçüm adresinden gizli parametreleri ayıklama", () => {
  it("giriş anahtarını ölçüme göndermez", () => {
    const yol = gizliParametreleriAyikla("/login-success?token=eyJhbGciOiJIUzI1NiJ9.abc.def");
    expect(yol).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(yol).toContain("/login-success");
    expect(yol).toContain("token=gizlendi");
  });

  it("oturum ve doğrulama kodlarını da gizler", () => {
    const yol = gizliParametreleriAyikla("/fake-payment/success?sessionId=abc123&code=xyz789");
    expect(yol).not.toContain("abc123");
    expect(yol).not.toContain("xyz789");
  });

  it("zararsız parametrelere dokunmaz (ölçüm değeri kaybolmasın)", () => {
    const yol = gizliParametreleriAyikla("/tools/merge-pdf?utm_source=google&tour=1");
    expect(yol).toBe("/tools/merge-pdf?utm_source=google&tour=1");
  });

  it("sorgusuz adresi olduğu gibi bırakır", () => {
    expect(gizliParametreleriAyikla("/tools/split-pdf")).toBe("/tools/split-pdf");
  });
});
