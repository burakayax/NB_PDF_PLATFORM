/**
 * Ödeme başarılı e-postası: plan adı müşteri diliyle, çalışma alanı bağlantısı ve fatura bilgisi.
 */
import { describe, expect, it } from "vitest";
import { createPaymentSuccessEmailTemplate } from "../modules/subscription/subscription.email.js";

describe("createPaymentSuccessEmailTemplate", () => {
  it("Türkçede plan kodunu değil müşteri adını gösterir ve düğme içerir", () => {
    const t = createPaymentSuccessEmailTemplate({
      planName: "STARTER",
      amount: "129.00",
      currency: "TRY",
      periodEnd: "10 Aralık 2026",
      lang: "tr",
    });
    expect(t.subject).toContain("Başlangıç");
    expect(t.subject).not.toContain("STARTER");
    expect(t.html).toContain("Başlangıç planınız aktif");
    expect(t.html).toContain("/workspace");
    expect(t.html).toContain("129.00 TRY");
    expect(t.html).toContain("10 Aralık 2026");
    expect(t.html).toContain("en geç 7 gün içinde ayrı bir e-posta");
    expect(t.text).toContain("Plan: Başlangıç");
  });

  it("İngilizce şablonu üretir", () => {
    const t = createPaymentSuccessEmailTemplate({ planName: "PRO", amount: "20.00", currency: "USD", lang: "en" });
    expect(t.subject).toContain("Pro plan is active");
    expect(t.html).toContain("Go to workspace");
    expect(t.html).not.toContain("Erişim bitişi");
  });
});
