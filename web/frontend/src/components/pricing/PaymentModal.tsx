import type { ReactNode } from "react";

type PaymentModalProps = {
  open: boolean;
  /** iyzico Checkout Form HTML (`checkoutFormContent`). React does not run embedded &lt;script&gt; tags — use `launchIyzicoCheckout` to submit, or mount this for display-only review. */
  checkoutHtml: string;
  title?: ReactNode;
  onClose: () => void;
};

/**
 * Optional overlay showing raw PSP markup. Prefer `launchIyzicoCheckout` / `paymentPageUrl`
 * redirect for a working sandbox flow; this mirrors the prompt requirement for dangerouslySetInnerHTML.
 */
export function PaymentModal({ open, checkoutHtml, title, onClose }: PaymentModalProps) {
  if (!open) {
    return null;
  }
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="pointer-events-auto max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/15 bg-nb-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <div className="mb-3 text-sm font-semibold text-nb-text">{title}</div> : null}
        <div dangerouslySetInnerHTML={{ __html: checkoutHtml }} />
      </div>
    </div>
  );
}
