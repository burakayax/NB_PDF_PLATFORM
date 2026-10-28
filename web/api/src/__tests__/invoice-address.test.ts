import { describe, expect, it } from "vitest";
import { missingInvoiceAddressFields } from "../modules/billing/invoice-address.js";

describe("fatura adresi denetimi (VUK md. 230)", () => {
  const full = { addressLine: "Atatürk Cd. No:5 D:3", district: "Çankaya", city: "Ankara" };

  it("yurt içi: eksiksiz adres geçer", () => {
    expect(missingInvoiceAddressFields(full, "TR")).toEqual([]);
  });

  it("yurt içi: ilçe zorunlu", () => {
    expect(missingInvoiceAddressFields({ ...full, district: "  " }, "TR")).toEqual(["billingDistrict"]);
    expect(missingInvoiceAddressFields({ ...full, district: null }, "tr")).toEqual(["billingDistrict"]);
  });

  it("açık adres ve şehir her zaman zorunlu", () => {
    expect(missingInvoiceAddressFields({ addressLine: "", district: "x", city: "" }, "TR")).toEqual([
      "billingAddressLine",
      "city",
    ]);
    expect(missingInvoiceAddressFields({ addressLine: null, district: null, city: null }, "DE")).toEqual([
      "billingAddressLine",
      "city",
    ]);
  });

  it("yurt dışı: ilçe istenmez", () => {
    expect(missingInvoiceAddressFields({ addressLine: "Hauptstr. 1", district: null, city: "Berlin" }, "DE")).toEqual([]);
  });
});
