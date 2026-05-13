import { useEffect, useRef } from "react";

type Props = {
  originalSizeMB: number;
  compressedSizeMB: number;
};

type CompressionState = "excellent" | "good" | "normal";

export function CompressionResultBanner({ originalSizeMB, compressedSizeMB }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const savedMB = Math.max(0, originalSizeMB - compressedSizeMB);
  const savedPercent =
    originalSizeMB > 0 ? Math.round((savedMB / originalSizeMB) * 100) : 0;

  const state: CompressionState =
    savedPercent >= 50 ? "excellent" : savedPercent >= 30 ? "good" : "normal";

  const icon = state === "excellent" ? "🎉" : state === "good" ? "✅" : "📉";

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.classList.add("compression-banner--visible");
    }
  }, []);

  return (
    <>
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .compression-banner {
          opacity: 0;
          border-radius: 14px;
          padding: 16px 20px;
          margin: 16px 0;
          display: flex;
          align-items: center;
          gap: 14px;
          border: 1px solid transparent;
        }
        .compression-banner--visible {
          animation: slideInUp 0.35s ease forwards;
        }
        .compression-banner--excellent {
          background: rgba(34,197,94,0.10);
          border-color: rgba(34,197,94,0.30);
        }
        .compression-banner--good {
          background: rgba(103,232,249,0.08);
          border-color: rgba(103,232,249,0.25);
        }
        .compression-banner--normal {
          background: rgba(148,163,184,0.07);
          border-color: rgba(148,163,184,0.18);
        }
        .compression-banner__icon {
          font-size: 28px;
          flex-shrink: 0;
        }
        .compression-banner__headline {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 4px;
        }
        .compression-banner__headline--excellent span { color: #4ade80; }
        .compression-banner__headline--good span     { color: #67e8f9; }
        .compression-banner__headline--normal span   { color: #94a3b8; }
        .compression-banner__detail {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }
      `}</style>
      <div
        ref={ref}
        className={`compression-banner compression-banner--${state}`}
        role="status"
        aria-live="polite"
      >
        <span className="compression-banner__icon">{icon}</span>
        <div>
          <p className={`compression-banner__headline compression-banner__headline--${state}`}>
            Dosyanız <span>%{savedPercent}</span> küçüldü
          </p>
          <p className="compression-banner__detail">
            {originalSizeMB.toFixed(2)} MB → {compressedSizeMB.toFixed(2)} MB ({savedMB.toFixed(2)} MB tasarruf)
          </p>
        </div>
      </div>
    </>
  );
}
