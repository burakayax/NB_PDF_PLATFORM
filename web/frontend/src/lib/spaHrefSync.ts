/**
 * `window.history.pushState` / `replaceState` ve `popstate` ile değişen SPA URL'ini
 * React Router dışı navigasyonlarda da dinlemek için `useSyncExternalStore` aboneliği.
 */

const subscribers = new Set<() => void>();

let patched = false;

function currentHrefKey(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.pathname}${window.location.search}`;
}

function notifyAll(): void {
  for (const cb of subscribers) {
    cb();
  }
}

function ensureHistoryPatch(): void {
  if (typeof window === "undefined" || patched) {
    return;
  }
  patched = true;

  const pt = History.prototype;
  const origPush = pt.pushState;
  const origReplace = pt.replaceState;

  pt.pushState = function pushStatePatched(
    this: History,
    ...args: Parameters<History["pushState"]>
  ) {
    const r = origPush.apply(this, args);
    queueMicrotask(notifyAll);
    return r;
  };

  pt.replaceState = function replaceStatePatched(
    this: History,
    ...args: Parameters<History["replaceState"]>
  ) {
    const r = origReplace.apply(this, args);
    queueMicrotask(notifyAll);
    return r;
  };

  window.addEventListener("popstate", notifyAll);
}

export function subscribeSpaHref(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  ensureHistoryPatch();
  subscribers.add(onStoreChange);
  return () => {
    subscribers.delete(onStoreChange);
  };
}

export function getSpaHrefSnapshot(): string {
  return currentHrefKey();
}

export function getSpaHrefServerSnapshot(): string {
  return "/";
}
