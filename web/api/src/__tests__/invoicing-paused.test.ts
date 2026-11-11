import { describe, it, expect, afterEach } from "vitest";
import { invoicingPaused } from "../modules/payment/payment.service.js";

describe("invoicingPaused (fatura acil durdurma)", () => {
  const old = process.env.INVOICE_GENERATION_PAUSED;
  afterEach(() => {
    if (old === undefined) delete process.env.INVOICE_GENERATION_PAUSED;
    else process.env.INVOICE_GENERATION_PAUSED = old;
  });

  it("ayar yokken fatura kesilir", () => {
    delete process.env.INVOICE_GENERATION_PAUSED;
    expect(invoicingPaused()).toBe(false);
  });
  it("0/boş değerde fatura kesilir", () => {
    process.env.INVOICE_GENERATION_PAUSED = "0";
    expect(invoicingPaused()).toBe(false);
  });
  it("1 veya true ise durur", () => {
    process.env.INVOICE_GENERATION_PAUSED = "1";
    expect(invoicingPaused()).toBe(true);
    process.env.INVOICE_GENERATION_PAUSED = "TRUE";
    expect(invoicingPaused()).toBe(true);
  });
});
