import { useMemo } from "react";

import type { Language } from "../i18n/landing";
import { saasGatingCopy, type SaaSGatingCopy } from "../i18n/saasGating";
import {
  deriveSaaSGatingState,
  type SaaSGating,
  type SaaSGatingState,
} from "../lib/saasGating";

/**
 * React binding over the pure `deriveSaaSGatingState` mapper. Memoises the
 * resolved UI state + localised copy so re-renders don't churn.
 *
 * Framework contract:
 *   - No network calls, no side effects.
 *   - Accepts an optional payload so callers can pass it through without a
 *     guard — the hook handles the "no gating info yet" fallback.
 */
export type UseSaaSGating = {
  state: SaaSGatingState;
  copy: SaaSGatingCopy;
};

export function useSaaSGating(
  gating: SaaSGating | null | undefined,
  language: Language,
): UseSaaSGating {
  const state = useMemo(() => deriveSaaSGatingState(gating), [gating]);
  const copy = useMemo(() => saasGatingCopy(state, language), [state, language]);
  return { state, copy };
}
