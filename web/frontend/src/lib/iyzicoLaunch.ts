/**
 * Executes iyzico Checkout Form initialization HTML (form auto-submit / script bootstrap).
 */

export function launchIyzicoCheckout(r: {
  checkoutFormContent: string;
  paymentPageUrl?: string | null;
}): void {
  if (r.paymentPageUrl) {
    window.location.href = r.paymentPageUrl;
    return;
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = r.checkoutFormContent;
  document.body.appendChild(wrap);
  const form = wrap.querySelector("form");
  if (form instanceof HTMLFormElement) {
    form.submit();
    return;
  }
  wrap.querySelectorAll("script").forEach((s) => {
    const clone = document.createElement("script");
    clone.textContent = s.textContent;
    document.body.appendChild(clone);
  });
}
