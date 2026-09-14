/**
 * Ekip etkinlik kaydı — yöneticinin listesinde görünen satır.
 *
 * Test edilen davranışlar:
 *   1. Araç adı arayüzdeki adla aynı ve kullanıcının diline göre geliyor.
 *   2. Listede olmayan yeni bir araç kimliği çökmeye yol açmıyor.
 *   3. Gönderilen kayıt doğru alanları taşıyor.
 *   4. Kayıt başarısız olursa kullanıcıya hata sızmıyor (işi zaten bitti).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportTeamActivity, toolDisplayName } from "../lib/teamActivity";

const original = globalThis.fetch;
let calls: Array<{ url: string; init: RequestInit }>;

beforeEach(() => {
  calls = [];
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response("{}"));
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = original;
});

describe("toolDisplayName", () => {
  it("araç adını kullanıcının dilinde verir", () => {
    const tr = toolDisplayName("merge", "tr");
    const en = toolDisplayName("merge", "en");
    expect(tr).toBeTruthy();
    expect(en).toBeTruthy();
    expect(tr).not.toBe(en);
  });

  it("bilinmeyen araçta çökmez, kimliğe düşer", () => {
    expect(toolDisplayName("henuz-yok", "tr")).toBe("henuz-yok");
  });
});

describe("reportTeamActivity", () => {
  it("doğru alanlarla kayıt gönderir", async () => {
    reportTeamActivity({
      accessToken: "bilet",
      toolId: "compress",
      language: "tr",
      pageCount: 12,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/api/team/activity");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.toolId).toBe("compress");
    expect(body.status).toBe("SUCCESS");
    expect(body.pageCount).toBe(12);
    expect(body.toolName).toBe(toolDisplayName("compress", "tr"));
    expect(
      (calls[0]!.init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer bilet");
  });

  it("sayfa sayısı verilmezse boş gider", () => {
    reportTeamActivity({ accessToken: "b", toolId: "merge", language: "tr" });
    expect(JSON.parse(String(calls[0]!.init.body)).pageCount).toBeNull();
  });

  it("istek başarısız olursa hata dışarı sızmaz", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("ağ yok"))) as typeof fetch;
    expect(() =>
      reportTeamActivity({ accessToken: "b", toolId: "merge", language: "tr" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
