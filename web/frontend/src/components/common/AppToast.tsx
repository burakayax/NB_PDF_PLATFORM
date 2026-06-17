/**
 * Sonner / Vercel-style toast: leading type icon, title + detail, a subtle
 * close button, and an auto-dismiss progress line for non-loading toasts.
 *
 * Presentational only — the parent owns the single `toast` state, the
 * auto-dismiss timer, and `onClose`. Keep the progress duration in sync with
 * the parent's dismiss timeout (see `AUTO_DISMISS_MS`).
 */

import type { ReactElement } from "react";

export type AppToastType = "success" | "error" | "loading" | "info";

export type AppToastData = {
  /** Bumped on every showToast call so React remounts → progress line restarts. */
  id: number;
  type: AppToastType;
  title: string;
  detail: string;
};

/** Must match the parent's setTimeout in `showToast`. */
export const AUTO_DISMISS_MS = 9000;

type AppToastProps = {
  toast: AppToastData;
  onClose: () => void;
  /** Localized aria-label for the close button. */
  closeLabel?: string;
};

const ICONS: Record<Exclude<AppToastType, "loading">, ReactElement> = {
  success: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  ),
  info: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6h.01" />
    </svg>
  ),
};

export function AppToast({ toast, onClose, closeLabel = "Kapat" }: AppToastProps) {
  const { type } = toast;
  return (
    <div className={`toast toast--${type}`}>
      <span className="toast__icon" aria-hidden="true">
        {type === "loading" ? (
          <span className="toast__spinner" />
        ) : (
          ICONS[type]
        )}
      </span>
      <div className="toast__body">
        <div className="toast__title">{toast.title}</div>
        {toast.detail ? (
          <div className="toast__detail">{toast.detail}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="toast__close"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      {type !== "loading" ? (
        <span className="toast__progress" aria-hidden="true" />
      ) : null}
    </div>
  );
}
