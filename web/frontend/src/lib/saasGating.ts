/**
 * Pure, framework-agnostic mapper that converts a backend entitlement
 * decision into UI instructions. The frontend never recomputes cost or
 * balance — it only interprets what the backend says.
 *
 * Input shape matches `web/api/src/modules/subscription/entitlement.engine.ts`
 * (CanExecuteResult / ConsumeResult) projected onto the wire. The engine is
 * the single source of truth; this file only translates.
 *
 * This file has no React, no CSS, no network calls, no Stripe, no Prisma.
 */

/** Backend-authored reasons. Keep in lockstep with the entitlement engine. */
export type SaaSGatingAllowReason =
  | "credit_available"
  | "active_subscription"
  | "admin_bypass";

export type SaaSGatingDenyReason =
  | "insufficient_credits"
  | "tool_not_registered"
  | "user_not_found"
  | "race_lost";

export type SaaSGatingReason = SaaSGatingAllowReason | SaaSGatingDenyReason;

/** Canonical gating payload returned alongside every tool response. */
export type SaaSGating = {
  allowed: boolean;
  reason: SaaSGatingReason;
  cost: number;
  creditsBefore: number;
  creditsAfter: number;
};

/**
 * Mode the UI should render in. Derived strictly from `allowed` — the reason
 * only modulates copy, not gating.
 */
export type SaaSGatingMode = "unlocked" | "locked";

/**
 * Button intent that the UI should render for the primary action.
 *   "download": allowed → trigger file download
 *   "upgrade":  denied (no subscription / no credits) → open upgrade flow
 *   "retry":    denied (transient race_lost) → re-run the tool
 *   "contact":  denied (tool_not_registered / user_not_found) → support path
 */
export type SaaSGatingActionKind = "download" | "upgrade" | "retry" | "contact";

/** Visual class for the lock overlay. */
export type SaaSGatingBlurLevel = "none" | "subtle" | "strong";

/**
 * The resolved, render-ready state. No React-specific types on purpose.
 * Components and tests both depend on this contract.
 */
export type SaaSGatingState = {
  /** Raw input, echoed back for convenience. `null` when the backend did not
   * attach an entitlement payload (older tool responses). */
  readonly source: SaaSGating | null;
  readonly mode: SaaSGatingMode;
  readonly blurLevel: SaaSGatingBlurLevel;
  /** `true` when the preview should be visually blurred / overlaid. */
  readonly isLocked: boolean;
  /** `true` when the primary action should be rendered as a disabled state
   * (we keep the element mounted for a11y/focus, then swap the label). */
  readonly isDownloadDisabled: boolean;
  readonly action: SaaSGatingActionKind;
  readonly reason: SaaSGatingReason | null;
  readonly cost: number;
  readonly creditsBefore: number;
  readonly creditsAfter: number;
};

/**
 * Derive the UI state from a backend gating payload. Accepts `null` /
 * `undefined` and falls back to an unlocked state so older endpoints that do
 * not yet attach gating metadata keep working.
 */
export function deriveSaaSGatingState(
  input: SaaSGating | null | undefined,
): SaaSGatingState {
  if (!input) {
    return {
      source: null,
      mode: "unlocked",
      blurLevel: "none",
      isLocked: false,
      isDownloadDisabled: false,
      action: "download",
      reason: null,
      cost: 0,
      creditsBefore: 0,
      creditsAfter: 0,
    };
  }

  const safeCost = Number.isFinite(input.cost) ? Math.max(0, Math.trunc(input.cost)) : 0;
  const before = Number.isFinite(input.creditsBefore) ? Math.max(0, Math.trunc(input.creditsBefore)) : 0;
  const after = Number.isFinite(input.creditsAfter) ? Math.max(0, Math.trunc(input.creditsAfter)) : 0;

  if (input.allowed) {
    return {
      source: input,
      mode: "unlocked",
      blurLevel: "none",
      isLocked: false,
      isDownloadDisabled: false,
      action: "download",
      reason: input.reason,
      cost: safeCost,
      creditsBefore: before,
      creditsAfter: after,
    };
  }

  const action: SaaSGatingActionKind =
    input.reason === "race_lost"
      ? "retry"
      : input.reason === "tool_not_registered" || input.reason === "user_not_found"
        ? "contact"
        : "upgrade";

  return {
    source: input,
    mode: "locked",
    blurLevel: "strong",
    isLocked: true,
    isDownloadDisabled: true,
    action,
    reason: input.reason,
    cost: safeCost,
    creditsBefore: before,
    creditsAfter: after,
  };
}

/**
 * Return the CSS `filter` value for a blur level. Kept as a helper so both
 * inline styles and styled-components style the same way.
 *
 * Range intentionally lives inside the 8–20px band specified by product.
 */
export function blurFilterForLevel(level: SaaSGatingBlurLevel): string | undefined {
  switch (level) {
    case "subtle":
      return "blur(8px)";
    case "strong":
      return "blur(18px)";
    case "none":
    default:
      return undefined;
  }
}
