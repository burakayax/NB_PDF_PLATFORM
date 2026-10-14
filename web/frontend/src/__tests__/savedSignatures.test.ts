import { describe, it, expect, beforeEach } from "vitest";
import {
  MAX_SAVED_SIGNATURES,
  deleteSavedSignature,
  loadSavedSignatures,
  saveSignature,
  userKeyFromToken,
} from "../lib/savedSignatures";

function jwt(payload: object): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.imza`;
}

describe("kayıtlı imzalar (üyeye özel)", () => {
  beforeEach(() => localStorage.clear());

  it("misafirde (anahtar yok) hiçbir şey kaydedilmez/okunmaz", () => {
    expect(saveSignature(null, { dataUrl: "data:a", aspect: 2 })).toEqual([]);
    expect(loadSavedSignatures(null)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it("JWT'den kullanıcı kimliği çıkar; bozuk/boş belirteç null döner", () => {
    expect(userKeyFromToken(jwt({ sub: "user-1" }))).toBe("user-1");
    expect(userKeyFromToken(null)).toBeNull();
    expect(userKeyFromToken("bozuk")).toBeNull();
    expect(userKeyFromToken(jwt({ yok: 1 }))).toBeNull();
  });

  it("kaydeder, okur ve aynı görseli ikinci kez eklemez", () => {
    saveSignature("u1", { dataUrl: "data:img1", aspect: 2.5 });
    const list = saveSignature("u1", { dataUrl: "data:img1", aspect: 2.5 });
    expect(list).toHaveLength(1);
    expect(loadSavedSignatures("u1")[0].dataUrl).toBe("data:img1");
  });

  it("en fazla 3 imza tutar; en eskisi düşer", () => {
    for (let i = 1; i <= MAX_SAVED_SIGNATURES + 2; i++) saveSignature("u1", { dataUrl: `data:img${i}`, aspect: 2 });
    const list = loadSavedSignatures("u1");
    expect(list).toHaveLength(MAX_SAVED_SIGNATURES);
    expect(list[0].dataUrl).toBe(`data:img${MAX_SAVED_SIGNATURES + 2}`); // en yeni başta
    expect(list.some((s) => s.dataUrl === "data:img1")).toBe(false);
  });

  it("hesaplar birbirinin imzasını görmez (aynı cihaz)", () => {
    saveSignature("u1", { dataUrl: "data:benim", aspect: 2 });
    expect(loadSavedSignatures("u2")).toEqual([]);
  });

  it("silince listeden çıkar", () => {
    const [sig] = saveSignature("u1", { dataUrl: "data:x", aspect: 2 });
    expect(deleteSavedSignature("u1", sig.id)).toEqual([]);
    expect(loadSavedSignatures("u1")).toEqual([]);
  });

  it("bozuk depolama verisi araçı bozmaz", () => {
    localStorage.setItem("nb_saved_signatures_v1:u1", "{bozuk");
    expect(loadSavedSignatures("u1")).toEqual([]);
  });
});
