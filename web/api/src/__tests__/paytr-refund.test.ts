import { describe, expect, it, vi } from "vitest";
import {
  parsePaytrMoneyToKurus,
  queryPaytrStatus,
  requestPaytrRefund,
  summarizePaytrReturns,
} from "../modules/payment/paytr/paytr.client.js";

const CREDS = { merchantId: "123456", merchantKey: "key", merchantSalt: "salt" };

describe("parsePaytrMoneyToKurus", () => {
  it("virgül/nokta/binlik biçimlerini kuruşa çevirir", () => {
    expect(parsePaytrMoneyToKurus("10,8")).toBe(1080);
    expect(parsePaytrMoneyToKurus("399.00")).toBe(39900);
    expect(parsePaytrMoneyToKurus("1.234,50")).toBe(123450);
    expect(parsePaytrMoneyToKurus(399)).toBe(39900);
  });
  it("okunamayanı null yapar (tahmin yok)", () => {
    expect(parsePaytrMoneyToKurus("abc")).toBeNull();
    expect(parsePaytrMoneyToKurus("")).toBeNull();
    expect(parsePaytrMoneyToKurus(undefined)).toBeNull();
  });
});

describe("summarizePaytrReturns", () => {
  it("returns yok/boş → none (iade yapılmamış)", () => {
    expect(summarizePaytrReturns({ status: "success" })).toEqual({ state: "none" });
    expect(summarizePaytrReturns({ returns: [] })).toEqual({ state: "none" });
    expect(summarizePaytrReturns({ returns: "" })).toEqual({ state: "none" });
  });
  it("tutar okunabilirse toplar", () => {
    expect(summarizePaytrReturns({ returns: [{ return_amount: "399.00" }] })).toEqual({ state: "known", totalKurus: 39900 });
    expect(summarizePaytrReturns({ returns: [{ Amount: "100,50" }, { amount: "299.50" }] })).toEqual({ state: "known", totalKurus: 40000 });
  });
  it("tutar okunamazsa unknown — iade yapıldı SAYILMAZ", () => {
    expect(summarizePaytrReturns({ returns: [{ foo: "bar" }] })).toEqual({ state: "unknown" });
    expect(summarizePaytrReturns({ returns: "var" })).toEqual({ state: "unknown" });
    expect(summarizePaytrReturns({ returns: { a: 1 } })).toEqual({ state: "unknown" });
  });
});

describe("requestPaytrRefund / queryPaytrStatus", () => {
  const fakeFetch = (body: unknown) =>
    vi.fn(async () => ({ status: 200, json: async () => body }) as unknown as Response) as unknown as typeof fetch;

  it("success → ok", async () => {
    const r = await requestPaytrRefund("oid1", "399.00", CREDS, "ref1", fakeFetch({ status: "success", is_test: "1" }));
    expect(r).toEqual({ ok: true, isTest: true });
  });
  it("failed / error → ok:false (iade yapıldı SAYILMAZ)", async () => {
    const a = await requestPaytrRefund("oid1", "399.00", CREDS, undefined, fakeFetch({ status: "failed" }));
    expect(a.ok).toBe(false);
    const b = await requestPaytrRefund("oid1", "399.00", CREDS, undefined, fakeFetch({ status: "error", err_no: "009", err_msg: "x" }));
    expect(b).toEqual({ ok: false, errNo: "009", errMsg: "x" });
  });
  it("durum sorgu iade listesini ham olarak döner", async () => {
    const r = await queryPaytrStatus("oid1", CREDS, fakeFetch({ status: "success", payment_amount: "399,00", returns: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(summarizePaytrReturns(r.raw)).toEqual({ state: "none" });
  });
});
