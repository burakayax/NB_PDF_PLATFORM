import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HİZMET UYARISI: sorun olunca yöneticiye e-posta; düzelince "normale döndü"; gürültü sınırlı.
 */

vi.mock("../lib/prisma.js", () => ({ prisma: { serviceHealthEvent: { create: vi.fn(async () => ({})) } } }));

import { __resetServiceAlertState, evaluateAlerts } from "../lib/service-alerts.js";
import { __resetServiceHealthState, recordHealth, recordHttpFailure } from "../lib/service-health.js";

const T0 = Date.UTC(2026, 9, 7, 10, 0, 0);
const min = (n: number) => n * 60_000;

beforeEach(() => {
  __resetServiceHealthState();
  __resetServiceAlertState();
  process.env["SERVICE_ALERTS"] = "on";
});

describe("evaluateAlerts", () => {
  it("veritabanı 2 dakikadır kapalıysa tek uyarı gönderir, tekrarlamaz", async () => {
    const send = vi.fn(async () => {});
    await recordHealth("db", true, undefined, T0);
    await recordHealth("db", false, undefined, T0 + min(1));
    await evaluateAlerts(send, T0 + min(2)); // 1 dk → henüz erken
    expect(send).not.toHaveBeenCalled();
    await evaluateAlerts(send, T0 + min(3)); // 2 dk
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toContain("Veritabanı KAPALI");
    await evaluateAlerts(send, T0 + min(10));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("düzelince 'normale döndü' gönderir", async () => {
    const send = vi.fn(async () => {});
    await recordHealth("db", false, undefined, T0);
    await evaluateAlerts(send, T0 + min(3));
    await recordHealth("db", true, undefined, T0 + min(8));
    await evaluateAlerts(send, T0 + min(8));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toContain("normale döndü");
  });

  it("kısa kesinti (uyarı eşiğinden önce düzelen) hiç e-posta üretmez", async () => {
    const send = vi.fn(async () => {});
    await recordHealth("db", false, undefined, T0);
    await recordHealth("db", true, undefined, T0 + min(1));
    await evaluateAlerts(send, T0 + min(1));
    await evaluateAlerts(send, T0 + min(5));
    expect(send).not.toHaveBeenCalled();
  });

  it("5xx patlaması: 10 dakikada 5 hata → bir uyarı, 60 dk bekleme", async () => {
    const send = vi.fn(async () => {});
    for (let i = 0; i < 5; i++) await recordHttpFailure("pdf", `/api/tool${i}`, 500, T0 + i * 1000);
    await evaluateAlerts(send, T0 + min(1));
    expect(send).toHaveBeenCalledTimes(1);
    await evaluateAlerts(send, T0 + min(2));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("saatte en çok 6 e-posta", async () => {
    const send = vi.fn(async () => {});
    for (let i = 0; i < 8; i++) {
      // her turda durum değişimiyle yeni uyarı/dönüş üret
      await recordHealth("db", false, undefined, T0 + min(i * 4));
      await evaluateAlerts(send, T0 + min(i * 4) + min(3));
      await recordHealth("db", true, undefined, T0 + min(i * 4) + min(3) + 1);
      await evaluateAlerts(send, T0 + min(i * 4) + min(3) + 2);
    }
    expect(send.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("gönderim hatası uyarı sistemini bozmaz", async () => {
    const send = vi.fn(async () => {
      throw new Error("smtp down");
    });
    await recordHealth("db", false, undefined, T0);
    await expect(evaluateAlerts(send, T0 + min(3))).resolves.toBeUndefined();
  });

  it("geliştirme ortamında (production değil, SERVICE_ALERTS=on değil) e-posta göndermez", async () => {
    delete process.env["SERVICE_ALERTS"];
    const send = vi.fn(async () => {});
    await recordHealth("db", false, undefined, T0);
    await evaluateAlerts(send, T0 + min(10));
    expect(send).not.toHaveBeenCalled();
  });

  it("SERVICE_ALERTS=off iken hiçbir şey göndermez", async () => {
    process.env["SERVICE_ALERTS"] = "off";
    const send = vi.fn(async () => {});
    await recordHealth("db", false, undefined, T0);
    await evaluateAlerts(send, T0 + min(10));
    expect(send).not.toHaveBeenCalled();
  });
});
