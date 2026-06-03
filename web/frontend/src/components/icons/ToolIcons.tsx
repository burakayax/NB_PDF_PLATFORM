/** Tool Icons — Geometric, Electric Cyan theme */

export const MergeIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <rect x="2" y="4" width="12" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
    <rect x="10" y="8" width="12" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M10 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const SplitIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <path d="M12 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 8l8-5 8 5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M4 16l8 5 8-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const CompressIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M7 10h3m7 0h-3M7 14h3m7 0h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ConvertIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <rect x="2" y="4" width="9" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="13" y="4" width="9" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M11 11h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const WatermarkIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <path d="M3 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8-8-3.6-8-8z" stroke="currentColor" strokeWidth="2" />
    <path d="M11 9v6m-2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const EncryptIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M7 10V7a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="15" r="1.5" fill="currentColor" />
  </svg>
);

export const RotateIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DeleteIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <path d="M3 6h18m-2 0v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6m4-6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ExtractIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M12 2v4m0 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 6l4-4 4 4m0 12l-4 4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SettingsIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6m-17.78 7.78l4.24-4.24m4.24-4.24l4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const PDFIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`tool-icon ${className || ''}`}>
    <path d="M4 4v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M14 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <text x="9" y="16" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">PDF</text>
  </svg>
);
