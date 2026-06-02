import type { SaaSGatingCopy } from "../i18n/saasGating";

export function SaasCreditPill({ copy }: { copy: SaaSGatingCopy }) {
  return (
    <span
      className="saas-credit-pill"
      role="status"
      aria-live="polite"
      aria-label={copy.remainingOpsLabel}
    >
      <span className="saas-credit-pill__delta">{copy.remainingOpsLabel}</span>
    </span>
  );
}
