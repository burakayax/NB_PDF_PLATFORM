/**
 * İşlem hatası bildirimi — kullanıcı sebebi öğrenmeli.
 *
 * Eskiden hata ne olursa olsun "İşlem başarısız. Lütfen dosyanızı kontrol
 * edin." deniyordu; sunucu "parola hatalı" dediğinde bile. Kullanıcı dosyayı
 * suçlayıp aynı yanlış parolayla tekrar deniyordu.
 */
import { describe, it, expect } from "vitest";
import { toolFailureNotice } from "../lib/userFacingErrors";

describe("toolFailureNotice", () => {
  it("parola hatasında sebebi ve uygun başlığı gösterir", () => {
    const n = toolFailureNotice(
      new Error("Parola hatalı. Belgeyi açan parolayı kontrol edip yeniden deneyin."),
      "tr",
    );
    expect(n.title).toBe("Parola sorunu");
    expect(n.detail).toContain("Parola hatalı");
  });

  it("sunucunun diğer anlamlı mesajlarını da aktarır", () => {
    const n = toolFailureNotice(new Error("PPT veya PPTX yükleyin."), "tr");
    expect(n.title).toBe("İşlem başarısız");
    expect(n.detail).toBe("PPT veya PPTX yükleyin.");
  });

  it("teknik metni kullanıcıya göstermez", () => {
    for (const teknik of [
      "Traceback (most recent call last): ...",
      "C:\\Users\\x\\Temp\\a.pdf okunamadı",
      "<!doctype html><html>...",
      "/tmp/nbpdf/a.pdf bozuk",
    ]) {
      const n = toolFailureNotice(new Error(teknik), "tr");
      expect(n.detail).toBe(
        "İşlem başarısız. Lütfen dosyanızı kontrol edip tekrar deneyin.",
      );
    }
  });

  it("aşırı uzun metni göstermez", () => {
    const n = toolFailureNotice(new Error("a".repeat(400)), "tr");
    expect(n.detail).toContain("Lütfen dosyanızı kontrol");
  });

  it("hata nesnesi değilse genel mesaja düşer", () => {
    expect(toolFailureNotice("bir şey", "tr").detail).toContain(
      "Lütfen dosyanızı kontrol",
    );
    expect(toolFailureNotice(null, "en").detail).toContain("Operation failed");
  });

  it("İngilizce başlıkları da doğru verir", () => {
    expect(toolFailureNotice(new Error("Wrong password."), "en").title).toBe(
      "Password problem",
    );
  });
});
