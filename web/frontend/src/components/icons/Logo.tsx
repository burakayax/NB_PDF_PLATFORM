/** NB PDF Platform Logo — Modern, Electric Cyan design */

export const LogoIcon = ({ className, size = 32 }: { className?: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Geometric PDF symbol with cyan accent */}
    <rect x="12" y="10" width="40" height="44" rx="4" stroke="currentColor" strokeWidth="2.5" />

    {/* Dynamic transform lines (suggesting movement/processing) */}
    <path d="M24 28h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M24 38h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />

    {/* Accent glow element */}
    <circle cx="48" cy="20" r="3" fill="currentColor" opacity="0.7" />

    {/* Decorative corner element */}
    <path d="M42 52l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
  </svg>
);

export const LogoWithText = ({ className }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className || ''}`}>
    <div className="logo-container">
      <LogoIcon size={40} />
    </div>
    <div className="flex flex-col">
      <span className="text-lg font-bold text-nb-heading">PDF Platform</span>
      <span className="text-xs text-nb-muted">Smart Tools</span>
    </div>
  </div>
);

export const LogoMinimal = ({ className }: { className?: string }) => (
  <div className={`logo-container inline-block ${className || ''}`}>
    <LogoIcon size={32} />
  </div>
);
