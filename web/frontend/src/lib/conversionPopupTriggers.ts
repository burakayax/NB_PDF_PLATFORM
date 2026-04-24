/**
 * Persistence for the lightweight conversion popup (low credits, first
 * failure, first upgrade moment). Separate from `conversionModalTriggers`
 * which tracks the larger upgrade modal's frequency caps.
 */

const KEY_FIRST_TOOL_FAILURE = "nb_conv_popup_v1_first_tool_failure_shown";
const KEY_FIRST_UPGRADE_OP = "nb_conv_popup_v1_first_upgrade_op_shown";
const KEY_LOW_CREDIT_SNOOZE_UNTIL = "nb_conv_popup_v1_low_credit_snooze_until";

export function hasShownFirstToolFailurePopup(): boolean {
  try {
    return window.localStorage.getItem(KEY_FIRST_TOOL_FAILURE) === "1";
  } catch {
    return false;
  }
}

export function markFirstToolFailurePopupShown() {
  try {
    window.localStorage.setItem(KEY_FIRST_TOOL_FAILURE, "1");
  } catch {
    /* private mode */
  }
}

export function hasShownFirstUpgradeOpPopup(): boolean {
  try {
    return window.localStorage.getItem(KEY_FIRST_UPGRADE_OP) === "1";
  } catch {
    return false;
  }
}

export function markFirstUpgradeOpPopupShown() {
  try {
    window.localStorage.setItem(KEY_FIRST_UPGRADE_OP, "1");
  } catch {
    /* private mode */
  }
}

export function getLowCreditPopupSnoozeUntil(): number {
  try {
    const raw = window.localStorage.getItem(KEY_LOW_CREDIT_SNOOZE_UNTIL);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Default: 24h snooze after the user dismisses the low-credit popup. */
export function snoozeLowCreditPopup(untilMs: number = Date.now() + 24 * 60 * 60 * 1000) {
  try {
    window.localStorage.setItem(KEY_LOW_CREDIT_SNOOZE_UNTIL, String(untilMs));
  } catch {
    /* private mode */
  }
}

/** When balance recovers to a comfortable level, clear snooze for the next dip. */
export function clearLowCreditSnoozeIfRecovered(creditBalance: number) {
  if (creditBalance < 3) {
    return;
  }
  try {
    window.localStorage.removeItem(KEY_LOW_CREDIT_SNOOZE_UNTIL);
  } catch {
    /* ignore */
  }
}
