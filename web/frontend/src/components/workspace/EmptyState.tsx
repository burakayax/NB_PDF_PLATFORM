/**
 * BOŞ DURUM — henüz dosya seçilmemişken çalışma alanında gösterilen kart.
 */
export function EmptyStateIllustration() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  hint,
  compact = false,
}: {
  title: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`nb-empty-state${compact ? " nb-empty-state--compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="nb-empty-state__icon">
        <EmptyStateIllustration />
      </div>
      <p className="nb-empty-state__title">{title}</p>
      <p className="nb-empty-state__hint">{hint}</p>
    </div>
  );
}
