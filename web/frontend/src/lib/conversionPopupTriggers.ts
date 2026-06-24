/**
 * Persistence for the lightweight conversion popup (first failure, first
 * upgrade moment). Separate from `conversionModalTriggers` which tracks the
 * larger upgrade modal's frequency caps.
 */

const KEY_FIRST_TOOL_FAILURE = "nb_conv_popup_v1_first_tool_failure_shown";
const KEY_FIRST_UPGRADE_OP = "nb_conv_popup_v1_first_upgrade_op_shown";

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
