import { describe, expect, it } from "vitest";

// Ajan e-postası saf fonksiyonları (scripts/agents/mail.mjs): HTML + düz metin, tablolar veriden.
const p = new URL("../../../../scripts/agents/mail.mjs", import.meta.url).href;
const mod = (await import(/* @vite-ignore */ p)) as {
  buildMail: (x: Record<string, unknown>) => { html: string; text: string };
  parseLlmJson: (s: string) => Record<string, unknown>;
  delta: (a: number | null, b: number | null, d?: number) => string;
  dailyRows: (a: unknown, b: unknown) => string[][];
};

const now = {
  traffic: { pageViews: 120 }, users: { new: 3, total: 50 },
  subscriptions: { paidSubscribers: 1, manualPlans: 5 },
  changes: { paidOrders: { value: 1 } }, sales: { paidTotalTRY: "129.00" },
  health: { clientErrors: 2, serverFailures: 1 }, ai: { estimatedCost: 0.0123 },
};
const prev = { traffic: { pageViews: 100 }, users: { new: 5, total: 47 }, subscriptions: { activeSubscribers: 6 }, health: { clientErrors: 0, serverFailures: null }, ai: { estimatedCost: null } };

describe("ajan e-postası", () => {
  it("değişim metni yön ve yokluğu gösterir", () => {
    expect(mod.delta(120, 100)).toBe("+20 ↑");
    expect(mod.delta(1, 3)).toBe("−2 ↓");
    expect(mod.delta(2, 2)).toBe("0 =");
    expect(mod.delta(null, 3)).toBe("—");
  });

  it("günlük tabloda ücretli abonelik ve elle verilen plan AYRI satırdır; eski özet için —", () => {
    const rows = mod.dailyRows(now, prev);
    const byLabel = Object.fromEntries(rows.map((r) => [r[0], r]));
    expect(byLabel["Ücretli abonelik"][1]).toBe("1");
    expect(byLabel["Elle verilen plan"][1]).toBe("5");
    expect(byLabel["Ücretli abonelik"][2]).toBe("—");
    expect(byLabel["Hata sayısı"][1]).toBe("3");
    expect(rows.map((r) => r[0]).join()).not.toMatch(/Aktif abone/);
  });

  it("HTML: dikkat kutusu, tablolar, mobil tek sütun; düz metin sürümü de var", () => {
    const m = mod.buildMail({
      date: "2026-11-20", attention: ["Bir sorun <b>var</b>"], now, prev,
      gsc: { current: { available: true, clicks: 10, impressions: 100, avgPosition: 8.2 }, previous: { available: true, clicks: 8, impressions: 90, avgPosition: 9 } },
      seoTips: ["a", "b", "c", "d"], social: [{ tarih: "Pzt", platform: "Instagram", konu: "PDF birleştir", durum: "Planlandı" }],
      financeNote: null, financeTable: null, footer: "Token: 1",
    });
    expect(m.html).toContain("Dikkat edilecekler");
    expect(m.html).toContain("&lt;b&gt;var&lt;/b&gt;"); // kaçırılmış
    expect(m.html).toContain("max-width:640px");
    expect(m.html).toContain("Gecelik raporlar Kasım 2026'da başladı");
    expect((m.html.match(/<li style="margin:3px 0">/g) ?? []).length).toBe(3); // en çok 3 öneri
    expect(m.text).toContain("GÜNLÜK SİTE DURUMU");
    expect(m.text).toContain("Ücretli abonelik");
  });

  it("dikkat yoksa yeşil bilgi kutusu", () => {
    const m = mod.buildMail({ date: "d", attention: [], now: null, prev: null, gsc: null, seoTips: [], social: [], financeNote: null, financeTable: null, footer: "" });
    expect(m.html).toContain("Bugün dikkat gerektiren bir şey yok");
  });

  it("yapay zekâ JSON'u kod çiti içinde de ayıklanır; geçersizse fırlatır", () => {
    const j = mod.parseLlmJson("```json\n{\"dikkat\":[\"x\"],\"seoOneriler\":[],\"sosyal\":[],\"finansNotu\":null,\"finansTablo\":null}\n```") as { attention: string[] };
    expect(j.attention).toEqual(["x"]);
    expect(() => mod.parseLlmJson("düz metin")).toThrow();
  });
});
