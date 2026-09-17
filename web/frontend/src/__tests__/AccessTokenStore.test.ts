import { describe, it, expect, beforeEach } from "vitest";
import {
  readAccessToken,
  writeAccessToken,
  clearAccessToken,
  subscribeAccessToken,
} from "../lib/accessTokenStore";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY } from "../api/auth";

/**
 * Erişim anahtarı tarayıcı deposunda tutulurken sayfada çalışan herhangi bir
 * betik onu okuyabiliyordu; anahtarı ele geçiren kişi süresi dolana kadar hesabı
 * kullanabilir. Bu testler anahtarın depoya SIZMADIĞINI garanti eder.
 */
describe("erişim anahtarı deposu", () => {
  beforeEach(() => {
    clearAccessToken();
    localStorage.clear();
  });

  it("anahtarı tarayıcı deposuna YAZMAZ", () => {
    writeAccessToken("gizli-anahtar");
    expect(localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    // Depoda hiçbir anahtarın değeri anahtarı içermemeli.
    const tumDegerler = Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? "");
    expect(tumDegerler.some((v) => v.includes("gizli-anahtar"))).toBe(false);
  });

  it("yazılan anahtarı bellekten okur", () => {
    writeAccessToken("abc123");
    expect(readAccessToken()).toBe("abc123");
  });

  it("boş değeri null sayar (boş metin anahtar değildir)", () => {
    writeAccessToken("   ");
    expect(readAccessToken()).toBeNull();
  });

  it("temizleyince anahtar kalmaz", () => {
    writeAccessToken("abc123");
    clearAccessToken();
    expect(readAccessToken()).toBeNull();
  });

  it("değişiklikte dinleyicileri haberdar eder", () => {
    const gorulen: (string | null)[] = [];
    const birak = subscribeAccessToken((t) => gorulen.push(t));
    writeAccessToken("bir");
    clearAccessToken();
    birak();
    writeAccessToken("iki"); // abonelik bırakıldı, kaydedilmemeli
    expect(gorulen).toEqual(["bir", null]);
  });

  it("bir dinleyicinin hatası diğerlerini durdurmaz", () => {
    const gorulen: string[] = [];
    const b1 = subscribeAccessToken(() => {
      throw new Error("patlayan dinleyici");
    });
    const b2 = subscribeAccessToken(() => gorulen.push("calisti"));
    writeAccessToken("x");
    b1();
    b2();
    expect(gorulen).toEqual(["calisti"]);
  });
});
