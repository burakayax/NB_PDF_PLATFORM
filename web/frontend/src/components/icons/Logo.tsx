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
    {/* Document Base Geometry with 12px Theme Corner Radius */}
    <path
      d="M14 6H38L50 18V54C50 56.2091 48.2091 58 46 58H14C11.7909 58 10 56.2091 10 54V10C10 7.79086 11.7909 6 14 6Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Folded Corner Page Accent */}
    <path d="M38 6V18H50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* 'N' Shape Dynamic Stroke */}
    <path d="M20 44V26L28 36V22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* 'B' Shape Dynamic Transformer Line */}
    <path
      d="M28 22H36C39.5 22 41 24 41 26.5C41 29 39.5 30.5 36 30.5H28H36C40 30.5 42 32.5 42 35.5C42 38.5 40 40 36 40H20"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Tech-forward Data/Transformation Node */}
    <circle cx="28" cy="22" r="2" fill="currentColor" />
    <circle cx="20" cy="44" r="2" fill="currentColor" />
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
