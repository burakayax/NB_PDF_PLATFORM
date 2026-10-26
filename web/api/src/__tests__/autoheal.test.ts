import { describe, expect, it } from "vitest";
import { AUTOHEAL_DEFAULTS, normalizeAutoHealConfig } from "../modules/autoheal/autoheal.config.js";
import { noiseReason, severityOf, signatureOf, triage, type RawErrorRow } from "../modules/autoheal/error-triage.js";

const row = (o: Partial<RawErrorRow> = {}): RawErrorRow => ({
  message: "x is not a function",
  source: "https://www.pdfplatform.app/assets/index-AbC123xyz.js",
  stack: "TypeError: x\n    at https://www.pdfplatform.app/assets/index-AbC123xyz.js:1:5",
  url: "https://www.pdfplatform.app/tools/split",
  userAgent: "Mozilla/5.0 Chrome",
  userId: null,
  createdAt: new Date("2026-10-20T10:00:00Z"),
  ...o,
});

describe("gürültü eleme", () => {
  it("dosyasız <anonymous> çerçeveleri enjekte betik sayar (Sentry'deki b.text hatası)", () => {
    const r = row({ message: "b.text is not a function", source: "unhandledrejection", stack: "TypeError: b.text is not a function\n    at <anonymous>:1:82" });
    expect(noiseReason(r)).toBe("injected-script");
  });
  it("eklenti, bot ve bilinen tarayıcı gürültüsünü eler", () => {
    expect(noiseReason(row({ stack: "at chrome-extension://abc/x.js:1:1" }))).toBe("extension");
    expect(noiseReason(row({ userAgent: "Googlebot/2.1" }))).toBe("bot");
    expect(noiseReason(row({ message: "ResizeObserver loop completed with undelivered notifications." }))).toBe("browser-noise");
  });
  it("başka alan adından gelen betik hatasını eler, kendi paketimizi eler", () => {
    expect(noiseReason(row({ source: "https://ads.example.com/t.js", stack: null }))).toBe("cross-origin-script");
    expect(noiseReason(row())).toBeNull();
  });
});

describe("imza", () => {
  it("paket dosyasındaki karma ve mesajdaki sayıları yok sayar", () => {
    const a = signatureOf({ message: "Item 12 failed", source: "https://www.pdfplatform.app/assets/index-AbC123xyz.js" });
    const b = signatureOf({ message: "Item 99 failed", source: "https://www.pdfplatform.app/assets/index-ZZZ999qqq.js" });
    expect(a).toBe(b);
  });
  it("sunucu yolundaki kimlikleri yok sayar", () => {
    const a = signatureOf({ message: "boom", source: "server:GET /api/pdf/result/2a790bc6745f4e4f8f35e7225ed11367/download" });
    const b = signatureOf({ message: "boom", source: "server:GET /api/pdf/result/ffffffffffffffffffffffffffffffff/download" });
    expect(a).toBe(b);
  });
});

describe("önem derecesi", () => {
  it("tek ziyaretçi seyrek hata düşük", () => {
    expect(severityOf({ count: 1, visitors: 1, server: false, criticalPath: false })).toBe("low");
  });
  it("kritik akışta tekrarlayan sunucu hatası kritik", () => {
    expect(severityOf({ count: 5, visitors: 2, server: true, criticalPath: true })).toBe("critical");
  });
  it("çok ziyaretçide aynı hata kritik, birkaç ziyaretçide orta", () => {
    expect(severityOf({ count: 12, visitors: 10, server: false, criticalPath: false })).toBe("critical");
    expect(severityOf({ count: 3, visitors: 3, server: false, criticalPath: false })).toBe("medium");
  });
});

describe("triage", () => {
  const cursor = new Date("2026-10-20T09:00:00Z");
  const now = new Date("2026-10-20T10:05:00Z");
  it("aynı hatayı tek olayda toplar, gürültüyü olay yapmaz", () => {
    const rows = [row({ userId: "u1" }), row({ userId: "u2", createdAt: new Date("2026-10-20T10:01:00Z") }), row({ userAgent: "Googlebot" })];
    const r = triage(rows, [], cursor, now);
    expect(r.incidents).toHaveLength(1);
    expect(r.incidents[0]!.count).toBe(2);
    expect(r.noise.bot).toBe(1);
  });
  it("önceki olayın sayacını yalnızca yeni satırlarla artırır", () => {
    const first = triage([row({ userId: "u1" })], [], cursor, now);
    const again = triage([row({ userId: "u1" })], first.incidents, new Date("2026-10-20T10:02:00Z"), now);
    expect(again.incidents[0]!.count).toBe(1); // yeni satır yok → artmaz
  });
});

describe("ayarlar", () => {
  it("eksik ya da bozuk kayıt varsayılana döner", () => {
    expect(normalizeAutoHealConfig({})).toEqual(AUTOHEAL_DEFAULTS);
    expect(normalizeAutoHealConfig({ emailMinSeverity: "bilinmeyen" }).emailMinSeverity).toBe(AUTOHEAL_DEFAULTS.emailMinSeverity);
  });
  it("yalnızca açıkça false olan kapatır", () => {
    expect(normalizeAutoHealConfig({ enabled: false }).enabled).toBe(false);
    expect(normalizeAutoHealConfig({ enabled: "x" }).enabled).toBe(true);
  });
});
