import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSecurityAlertState, noteSecurityEvent, setSecurityAlertSender } from "../lib/security-alerts.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("güvenlik uyarıları", () => {
  const send = vi.fn(async () => {});
  beforeEach(() => {
    __resetSecurityAlertState();
    send.mockClear();
    process.env["SECURITY_ALERTS"] = "on";
    setSecurityAlertSender(send);
  });

  it("sahte ödeme bildirimi hemen e-posta üretir, 30 dk içinde tekrarlamaz", async () => {
    noteSecurityEvent("paytr_bad_hash", { detail: "abc" }, 1_000);
    noteSecurityEvent("paytr_bad_hash", { detail: "abc" }, 2_000);
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("eşik altında sessiz, eşikte tek e-posta", async () => {
    for (let i = 0; i < 39; i++) noteSecurityEvent("login_failure", { ip: "1.1.1.1" }, 1_000 + i);
    await flush();
    expect(send).not.toHaveBeenCalled();
    noteSecurityEvent("login_failure", { ip: "1.1.1.1" }, 2_000);
    noteSecurityEvent("login_failure", { ip: "1.1.1.1" }, 2_001);
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("10 dakikadan eski olaylar sayılmaz", async () => {
    for (let i = 0; i < 39; i++) noteSecurityEvent("login_failure", {}, 1_000);
    noteSecurityEvent("login_failure", {}, 1_000 + 11 * 60_000);
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("SECURITY_ALERTS=off iken hiçbir şey göndermez", async () => {
    process.env["SECURITY_ALERTS"] = "off";
    noteSecurityEvent("paytr_bad_hash", {}, 1_000);
    await flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("gönderim hata verse de fırlatmaz", async () => {
    setSecurityAlertSender(async () => {
      throw new Error("smtp down");
    });
    expect(() => noteSecurityEvent("paytr_bad_hash", {}, 1_000)).not.toThrow();
    await flush();
  });
});
