import type { ReactNode } from "react";

type CrawlableLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  target?: "_self" | "_blank" | "_parent" | "_top";
  rel?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

/**
 * Semantic anchor wrapper for crawlable internal/external linking.
 * Keeps plain <a> output so bots can discover route paths.
 */
export function CrawlableLink({
  href,
  children,
  className,
  target,
  rel,
  ariaLabel,
  onClick,
}: CrawlableLinkProps) {
  return (
    <a
      href={href}
      className={className}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
