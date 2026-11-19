import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getPaymentClientIp } from "../middleware/api-security.middleware.js";

const req = (headers: Record<string, string>, ip = "172.69.1.1") => ({ headers, ip, socket: { remoteAddress: ip } }) as unknown as Request;

describe("PayTR'ye bildirilen ziyaretçi IP'si", () => {
  it("Cloudflare başlığı varsa gerçek ziyaretçi IP'si kullanılır", () => {
    expect(getPaymentClientIp(req({ "cf-connecting-ip": "88.230.10.5" }))).toBe("88.230.10.5");
    expect(getPaymentClientIp(req({ "cf-connecting-ip": "2a01:db8::1" }))).toBe("2a01:db8::1");
  });
  it("başlık yoksa ya da geçersizse request.ip kullanılır", () => {
    expect(getPaymentClientIp(req({}))).toBe("172.69.1.1");
    expect(getPaymentClientIp(req({ "cf-connecting-ip": "bozuk deger" }))).toBe("172.69.1.1");
  });
});
