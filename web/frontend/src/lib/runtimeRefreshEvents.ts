/** Dispatched after admin saves CMS / site / packages / TOOLS so the app refetches public runtime without reload. */
export const RUNTIME_REFRESH_EVENT = "nb-runtime-refresh";

/** Same-origin tabs: refetch runtime when another tab calls `notifyRuntimeRefresh`. */
export const RUNTIME_REFRESH_BROADCAST = "nb-runtime-refresh-bc";

export function notifyRuntimeRefresh() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(RUNTIME_REFRESH_EVENT));
  try {
    const bc = new BroadcastChannel(RUNTIME_REFRESH_BROADCAST);
    bc.postMessage({ v: 1 });
    bc.close();
  } catch {
    /* BroadcastChannel unsupported */
  }
}
