import { describe, expect, it } from "vitest";
import { PRICES_HIDDEN, applyPricesHiddenFlag } from "../lib/priceVisibility";
import { legalDocuments } from "../content/legalContent.mjs";

describe("fiyat gösterme anahtarı", () => {
  it("anahtar yoksa fiyatlar gizli; yalnız açıkça false olunca görünür; geri gizlenebilir", () => {
    applyPricesHiddenFlag({});
    expect(PRICES_HIDDEN).toBe(true);
    applyPricesHiddenFlag(undefined);
    expect(PRICES_HIDDEN).toBe(true);
    applyPricesHiddenFlag({ pricesHidden: false });
    expect(PRICES_HIDDEN).toBe(false);
    applyPricesHiddenFlag({ pricesHidden: true });
    expect(PRICES_HIDDEN).toBe(true);
  });
});

describe("İptal ve İade sayfasında teslimat bölümü", () => {
  it("TR ve EN'de dijital teslimat / kargo yok bölümü var", () => {
    const tr = JSON.stringify((legalDocuments as any).tr["iptal-iade"]);
    const en = JSON.stringify((legalDocuments as any).en["iptal-iade"]);
    expect(tr).toContain("Teslimat ve kargo koşulları");
    expect(tr).toContain("kargo");
    expect(en).toContain("Delivery and shipping");
  });
});
