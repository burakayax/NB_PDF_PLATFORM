import type { CSSProperties } from "react";

import type { Language } from "../i18n/landing";
import { useSaaSGating } from "../hooks/useSaaSGating";
import { blurFilterForLevel, type SaaSGating } from "../lib/saasGating";
import { SaasCreditPill } from "./SaasCreditPill";

/**
 * Rendered inside the existing tool success bar. Responsible for:
 *
 *   - showing the thumbnail (or PDF placeholder)
 *   - applying the blur layer + semi-transparent overlay when locked
 *   - rendering the primary action (Download / Upgrade / Retry / Contact)
 *   - surfacing the reason-based body copy
 *   - echoing the credit delta in a header pill
 *
 * The component is a pure view over `useSaaSGating`. It does not know about
 * HTTP, Stripe, Prisma, or business rules — callers pass in handlers that do
 * the side-effectful work.
 */
export type SaasGatedPreviewProps = {
  /** Raw payload from the tool response. `null` = legacy response → fallback UI. */
  gating: SaaSGating | null | undefined;
  language: Language;
  filename: string;
  thumbnailUrl: string | null;
  /** Fired when the state resolves to `action === "download"`. */
  onDownload: () => void;
  /** Fired when `action === "upgrade"`. */
  onUpgrade: () => void;
  /**
   * When the gate denies with `reason === "insufficient_credits"`, the primary
   * button opens this (e.g. conversion modal) instead of jumping straight to
   * the upgrade flow.
   */
  onInsufficientCredits?: () => void;
  /** Fired when `action === "retry"` — optional; hidden when not supplied. */
  onRetry?: () => void;
  /** Fired when `action === "contact"` — optional. */
  onContactSupport?: () => void;
  /** Optional secondary "Dismiss" button. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Copy shown below the thumbnail when no gating payload is attached. */
  legacyPreviewHint?: string;
};

const THUMB_STYLE: CSSProperties = {
  width: 72,
  height: 96,
  objectFit: "cover",
  borderRadius: 6,
  border: "1px solid rgba(148,163,184,0.25)",
  flexShrink: 0,
  display: "block",
};

const PLACEHOLDER_STYLE: CSSProperties = {
  width: 72,
  height: 96,
  borderRadius: 6,
  border: "1px solid rgba(148,163,184,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  color: "rgba(148,163,184,0.85)",
  flexShrink: 0,
};

export function SaasGatedPreview(props: SaasGatedPreviewProps) {
  const {
    gating,
    language,
    filename,
    thumbnailUrl,
    onDownload,
    onUpgrade,
    onInsufficientCredits,
    onRetry,
    onContactSupport,
    onDismiss,
    dismissLabel,
    legacyPreviewHint,
  } = props;

  const { state, copy } = useSaaSGating(gating, language);
  const { isLocked, isDownloadDisabled, action, blurLevel, source, reason } = state;

  const handlePrimary = () => {
    if (action === "upgrade" && reason === "insufficient_credits" && onInsufficientCredits) {
      onInsufficientCredits();
      return;
    }
    switch (action) {
      case "download":
        return onDownload();
      case "upgrade":
        return onUpgrade();
      case "retry":
        return onRetry ? onRetry() : onDownload();
      case "contact":
        return onContactSupport ? onContactSupport() : onUpgrade();
    }
  };

  const buttonClass = isDownloadDisabled
    ? "merge-progress-fixed__download merge-progress-fixed__download--locked"
    : "merge-progress-fixed__download";

  const thumbFilter = blurFilterForLevel(blurLevel);
  const thumbStyle: CSSProperties = thumbFilter
    ? { ...THUMB_STYLE, filter: thumbFilter, transform: "scale(1.05)" }
    : THUMB_STYLE;
  const placeholderStyle: CSSProperties = thumbFilter
    ? { ...PLACEHOLDER_STYLE, filter: thumbFilter }
    : PLACEHOLDER_STYLE;

  return (
    <div className="saas-gated-preview">
      {source ? (
        <header className="saas-gated-preview__header">
          <SaasCreditPill copy={copy} />
          <span
            className={`saas-gated-preview__status saas-gated-preview__status--${
              isLocked ? "locked" : "unlocked"
            }`}
          >
            {copy.title}
          </span>
        </header>
      ) : null}

      <div
        className="merge-progress-fixed__preview saas-gated-preview__body"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          margin: source ? "6px 0 2px" : "10px 0 2px",
        }}
      >
        <div
          className={`saas-gated-preview__thumb-wrap${
            isLocked ? " saas-gated-preview__thumb-wrap--locked" : ""
          }`}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              aria-hidden="true"
              style={thumbStyle}
              className="saas-gated-preview__thumb"
            />
          ) : (
            <div
              aria-hidden="true"
              style={placeholderStyle}
              className="saas-gated-preview__thumb saas-gated-preview__thumb--placeholder"
            >
              PDF
            </div>
          )}
          {isLocked ? (
            <div
              className="saas-gated-preview__lock-overlay"
              role="presentation"
              aria-hidden="true"
            >
              <span className="saas-gated-preview__lock-icon" aria-hidden="true">
                {/* Simple inline SVG — no icon library coupling. */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <span className="saas-gated-preview__lock-label">
                {copy.lockedOverlayLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div className="saas-gated-preview__text">
          {source ? (
            <>
              <p className="saas-gated-preview__body-copy" style={{ margin: 0 }}>
                {copy.body}
              </p>
              <p className="saas-gated-preview__meta" aria-label={filename}>
                <span className="saas-gated-preview__filename">{filename}</span>
                <span className="saas-gated-preview__dot" aria-hidden="true">·</span>
                <span className="saas-gated-preview__cost">{copy.creditsLeftLabel}</span>
              </p>
            </>
          ) : (
            <p
              style={{ fontSize: 12, color: "rgba(203,213,225,0.85)", margin: 0 }}
            >
              {legacyPreviewHint}
            </p>
          )}
        </div>
      </div>

      <div className="merge-progress-fixed__success-actions">
        {/*
         * The button stays clickable even when downloads are locked — its
         * action simply changes (upgrade / retry / contact). We therefore do
         * NOT set `disabled` / `aria-disabled`; that would block the very
         * interaction we want. The locked visual comes from the class
         * modifier and the swapped label.
         */}
        <button
          type="button"
          className={buttonClass}
          onClick={handlePrimary}
          data-saas-action={action}
          data-saas-locked={isDownloadDisabled ? "true" : undefined}
        >
          {copy.primaryActionLabel}
        </button>
        {onDismiss ? (
          <button
            type="button"
            className="merge-progress-fixed__dismiss"
            onClick={onDismiss}
          >
            {dismissLabel ?? (language === "tr" ? "Kapat" : "Dismiss")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
