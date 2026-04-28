const STORAGE_KEY = "nb-maintenance-mode-hint";
const TTL_MS = 5 * 60 * 1000;

/** `true` / `false`: cached within TTL; `null`: unknown or expired. */
export type MaintenanceHint = boolean | null;

export function readMaintenanceHint(): MaintenanceHint {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { active?: unknown; ts?: unknown };
    if (typeof parsed.ts !== "number" || typeof parsed.active !== "boolean") {
      return null;
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      return null;
    }
    return parsed.active;
  } catch {
    return null;
  }
}

export function persistMaintenanceHint(active: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ active, ts: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}
