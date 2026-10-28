/**
 * PayTR resmî logosu (PayTR'nin verdiği 2025 logo seti; public/payments/*.svg).
 * Oran bozulmaz: yalnız yükseklik verilir, genişlik logonun kendi oranından (623,44 × 105,63) hesaplanır.
 * Koyu temada beyaz, açık temada renkli sürüm gösterilir.
 */
const RATIO = 623.44 / 105.63;

export function PaytrBadge({ height = 20, className = "", tr = true }: { height?: number; className?: string; tr?: boolean }) {
  const width = Math.round(height * RATIO);
  const alt = tr ? "PayTR ile güvenli ödeme" : "Secure payment with PayTR";
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <img
        src="/payments/paytr-logo-white.svg"
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="block [[data-theme=light]_&]:hidden"
        style={{ height, width }}
      />
      <img
        src="/payments/paytr-logo-color.svg"
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="hidden [[data-theme=light]_&]:block"
        style={{ height, width }}
      />
    </span>
  );
}
