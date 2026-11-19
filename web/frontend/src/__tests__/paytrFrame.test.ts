import { describe, expect, it, beforeEach } from "vitest";
import { launchIyzicoCheckout } from "../lib/iyzicoLaunch";

describe("PayTR ödeme sayfası", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  it("PayTR adresi tam sayfa yönlendirme yerine iframe içinde açılır ve kapatılabilir", () => {
    launchIyzicoCheckout({ checkoutFormContent: "", paymentPageUrl: "https://www.paytr.com/odeme/guvenli/abc123" });
    const frame = document.querySelector("#paytr-frame-overlay iframe") as HTMLIFrameElement | null;
    expect(frame?.src).toBe("https://www.paytr.com/odeme/guvenli/abc123");
    (document.querySelector("#paytr-frame-overlay button") as HTMLButtonElement).click();
    expect(document.getElementById("paytr-frame-overlay")).toBeNull();
  });
  it("her açılışta tek bir kaplama bulunur", () => {
    launchIyzicoCheckout({ checkoutFormContent: "", paymentPageUrl: "https://www.paytr.com/odeme/guvenli/a" });
    launchIyzicoCheckout({ checkoutFormContent: "", paymentPageUrl: "https://www.paytr.com/odeme/guvenli/b" });
    expect(document.querySelectorAll("#paytr-frame-overlay").length).toBe(1);
  });
});
