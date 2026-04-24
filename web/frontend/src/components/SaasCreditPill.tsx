import type { SaaSGatingCopy } from "../i18n/saasGating";

/**
 * Small non-interactive pill that mirrors the credit balance change reported
 * by the backend. Intentionally dumb — it only reflects `copy` as produced by
 * `saasGatingCopy`, which in turn only echoes the backend payload.
 */
export function SaasCreditPill({ copy }: { copy: SaaSGatingCopy }) {
  return (
    <span
      className="saas-credit-pill"
      role="status"
      aria-live="polite"
      aria-label={`${copy.creditPillHeader}: ${copy.creditDeltaLabel}`}
    >
      <span className="saas-credit-pill__label">{copy.creditPillHeader}</span>
      <span className="saas-credit-pill__delta">{copy.creditDeltaLabel}</span>
    </span>
  );
}
