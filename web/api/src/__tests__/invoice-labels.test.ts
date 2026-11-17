import { describe, expect, it } from "vitest";
import { subscriptionInvoiceName } from "../modules/payment/invoice-labels.js";

describe("fatura kalem adı", () => {
  it("plan + dönem", () => {
    expect(subscriptionInvoiceName({ plan: "PLUS", subscriptionDays: 30 })).toBe("Plus Abonelik (1 Aylık)");
    expect(subscriptionInvoiceName({ plan: "PRO", subscriptionDays: 365 })).toBe("Pro Abonelik (1 Yıllık)");
  });
  it("Business + ek koltuk: tutar koltukları da kapsadığı için adda yazılır", () => {
    expect(subscriptionInvoiceName({ plan: "BUSINESS", subscriptionDays: 365, extraSeats: 3 })).toBe("Business Abonelik + 3 Ek Koltuk (1 Yıllık)");
  });
  it("yalnız koltuk alımı", () => {
    expect(subscriptionInvoiceName({ plan: "BUSINESS", subscriptionDays: 30, extraSeats: 2, seatsOnly: true })).toBe("2 Ek Koltuk (1 Aylık)");
  });
});
