import { useSyncExternalStore } from "react";

/**
 * OTURUMDAKİ KULLANICININ PLANI — uygulama genelinde tek kaynak.
 *
 * Neden ayrı bir modül? Sonuç ekranındaki üyelik daveti (ValueMomentNudge) hem
 * misafir araç sayfalarında hem panel içindeki araçlarda görünüyor; bu araçların
 * çoğu kimlik bilgisini prop olarak almıyor. Plan burada tutulunca her render
 * yerinde tek satırla doğru karar verilir — ücretli aboneye "ücretsiz yaptın"
 * daveti ASLA çıkmaz.
 */

type PlanState = { plan: string | null; teamMember: boolean };

let state: PlanState = { plan: null, teamMember: false };
const listeners = new Set<() => void>();

export function setCurrentPlan(plan: string | null | undefined, teamMember = false): void {
  const next: PlanState = { plan: plan ?? null, teamMember };
  if (next.plan === state.plan && next.teamMember === state.teamMember) return;
  state = next;
  for (const l of listeners) l();
}

export function getCurrentPlan(): PlanState {
  return state;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const SERVER_STATE: PlanState = { plan: null, teamMember: false };

export function useCurrentPlan(): PlanState {
  return useSyncExternalStore(subscribe, getCurrentPlan, () => SERVER_STATE);
}

/** Ücretli erişimi olan kullanıcı mı? (FREE ve misafir → false) */
export function isPaidPlan(s: PlanState = state): boolean {
  if (s.teamMember) return true;
  const p = (s.plan ?? "").toUpperCase();
  return p !== "" && p !== "FREE";
}
