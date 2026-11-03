import { describe, expect, it } from "vitest";
import { yeniCihazUyarisiGerekli } from "../modules/auth/new-device-alert.js";
import { newDeviceId, parseDeviceId } from "../modules/auth/device-context.js";

describe("yeni cihaz uyarısı kararı", () => {
  const bilinen = ["c_a", "c_b", "c_c"];

  it("ilk üç cihazda (bilgisayar, telefon, yedek) uyarı gitmez", () => {
    expect(yeniCihazUyarisiGerekli([], "c_a")).toBe(false);
    expect(yeniCihazUyarisiGerekli(["c_a"], "c_b")).toBe(false);
    expect(yeniCihazUyarisiGerekli(["c_a", "c_b"], "c_c")).toBe(false);
  });

  it("dördüncü yeni cihazda uyarı gider", () => {
    expect(yeniCihazUyarisiGerekli(bilinen, "c_d")).toBe(true);
  });

  it("bilinen bir cihazdan tekrar giriş uyarı üretmez (IP değişse de)", () => {
    expect(yeniCihazUyarisiGerekli(bilinen, "c_b")).toBe(false);
  });

  it("çerezsiz (eski UA+IP) anahtarlar ne sayılır ne uyarı tetikler", () => {
    expect(yeniCihazUyarisiGerekli(bilinen, "eskiAnahtar")).toBe(false);
    expect(yeniCihazUyarisiGerekli(["x1", "x2", "x3", "x4"], "c_yeni")).toBe(false);
    expect(yeniCihazUyarisiGerekli(bilinen, null)).toBe(false);
  });
});

describe("cihaz kimliği çerezi", () => {
  it("üretilen kimlik geçerli biçimde ve her seferinde farklı", () => {
    const a = newDeviceId();
    expect(parseDeviceId(a)).toBe(a);
    expect(newDeviceId()).not.toBe(a);
  });
  it("bozuk ya da zararlı değerler reddedilir", () => {
    expect(parseDeviceId("kisa")).toBeNull();
    expect(parseDeviceId("<script>alert(1)</script>aaaaaaaaaaaaaaaaa")).toBeNull();
    expect(parseDeviceId(undefined)).toBeNull();
    expect(parseDeviceId(123)).toBeNull();
  });
});
