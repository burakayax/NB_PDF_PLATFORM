/**
 * Executes iyzico Checkout Form initialization HTML (form auto-submit / script bootstrap).
 */

/** Tam ekran kaplama içinde PayTR ödeme sayfasını iframe olarak açar (kapatma düğmesiyle). */
export function openPaytrFrame(url: string): void {
  document.getElementById("paytr-frame-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "paytr-frame-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;flex-direction:column;";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 12px;background:#0f172a;";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Kapat / Close";
  close.style.cssText = "color:#fff;background:transparent;border:1px solid #475569;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;";
  close.addEventListener("click", () => overlay.remove());
  bar.appendChild(close);
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = "PayTR";
  frame.setAttribute("allow", "payment");
  frame.style.cssText = "flex:1;width:100%;border:0;background:#fff;";
  overlay.append(bar, frame);
  document.body.appendChild(overlay);
}

export function launchIyzicoCheckout(r: {
  checkoutFormContent: string;
  paymentPageUrl?: string | null;
}): void {
  if (r.paymentPageUrl) {
    // PayTR iFrame API'sinin standart kullanımı: ödeme sayfası bizim sayfamızda iframe içinde açılır.
    // Tam sayfa yönlendirmede tarayıcı otomatik kart doldurma sayfayı geçersiz kılabiliyordu.
    if (/^https:\/\/www\.paytr\.com\//.test(r.paymentPageUrl)) {
      openPaytrFrame(r.paymentPageUrl);
      return;
    }
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
