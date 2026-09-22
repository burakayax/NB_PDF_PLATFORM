import type { SocialPlatformId } from "../../api/admin";

/**
 * Platform kimlikleri — rozet, renk ve önizleme oranı tek yerde.
 *
 * Rozetler marka logosu değil, markanın kendi renginde sade harf/şekil
 * işaretleri. Üçüncü taraf logo dosyası taşımadan platformlar bir bakışta
 * ayırt edilebiliyor; marka varlıklarını kopyalama sorunu da doğmuyor.
 */

export type BrandInfo = {
  /** Rozet zemini (CSS gradient ya da düz renk). */
  background: string;
  /** Rozet üzerindeki işaretin rengi. */
  foreground: string;
  /** Kart kenarlığı ve vurgu için yumuşak ton. */
  accent: string;
  /** Önizlemede görselin en-boy oranı. */
  ratio: string;
  /** Kullanıcının göreceği kısa ad. */
  label: string;
  /** Hesabın nereden alınacağını anlatan tek satır. */
  where: string;
};

export const BRANDS: Record<SocialPlatformId, BrandInfo> = {
  X: {
    background: "linear-gradient(145deg,#1d1d1f,#000000)",
    foreground: "#ffffff",
    accent: "rgba(148,163,184,0.35)",
    ratio: "16 / 9",
    label: "X",
    where: "developer.x.com",
  },
  LINKEDIN: {
    background: "linear-gradient(145deg,#0a66c2,#004182)",
    foreground: "#ffffff",
    accent: "rgba(10,102,194,0.45)",
    ratio: "1.91 / 1",
    label: "LinkedIn",
    where: "linkedin.com/developers",
  },
  FACEBOOK: {
    background: "linear-gradient(145deg,#1877f2,#0b5fce)",
    foreground: "#ffffff",
    accent: "rgba(24,119,242,0.45)",
    ratio: "1.91 / 1",
    label: "Facebook",
    where: "developers.facebook.com",
  },
  INSTAGRAM: {
    background: "linear-gradient(140deg,#f9ce34,#ee2a7b 55%,#6228d7)",
    foreground: "#ffffff",
    accent: "rgba(238,42,123,0.45)",
    ratio: "1 / 1",
    label: "Instagram",
    where: "developers.facebook.com → Instagram",
  },
  PINTEREST: {
    background: "linear-gradient(145deg,#e60023,#ad081b)",
    foreground: "#ffffff",
    accent: "rgba(230,0,35,0.45)",
    ratio: "2 / 3",
    label: "Pinterest",
    where: "developers.pinterest.com",
  },
};

function Glyph({ platform, color }: { platform: SocialPlatformId; color: string }) {
  const common = { fill: color };
  switch (platform) {
    case "X":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[55%] w-[55%]">
          <path
            {...common}
            d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.6L4.74 21H1.53l7.48-8.55L2 3h6.6l4.56 6.03L17.53 3Zm-1.12 16.06h1.77L7.68 4.84H5.78l10.63 14.22Z"
          />
        </svg>
      );
    case "LINKEDIN":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[58%] w-[58%]">
          <path
            {...common}
            d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.83v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76v5.69h-4v-5.04c0-1.2-.02-2.75-1.75-2.75-1.76 0-2.03 1.3-2.03 2.66v5.13h-4v-11Z"
          />
        </svg>
      );
    case "FACEBOOK":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[62%] w-[62%]">
          <path
            {...common}
            d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46A21 21 0 0 0 14.27 4C11.9 4 10.3 5.44 10.3 8.1v2.4H7.7v3h2.6V21h3.2Z"
          />
        </svg>
      );
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[58%] w-[58%]">
          <path
            fill="none"
            stroke={color}
            strokeWidth="2"
            d="M7.6 3.8h8.8a3.8 3.8 0 0 1 3.8 3.8v8.8a3.8 3.8 0 0 1-3.8 3.8H7.6a3.8 3.8 0 0 1-3.8-3.8V7.6a3.8 3.8 0 0 1 3.8-3.8Z"
          />
          <circle cx="12" cy="12" r="3.6" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="17" cy="7" r="1.2" {...common} />
        </svg>
      );
    case "PINTEREST":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="h-[60%] w-[60%]">
          <path
            {...common}
            d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.04-2.83.19-.77 1.2-4.9 1.2-4.9s-.3-.62-.3-1.53c0-1.43.83-2.5 1.87-2.5.88 0 1.3.66 1.3 1.45 0 .89-.56 2.21-.85 3.44-.24 1.03.52 1.87 1.53 1.87 1.84 0 3.25-1.94 3.25-4.73 0-2.47-1.78-4.2-4.31-4.2-2.94 0-4.66 2.2-4.66 4.47 0 .89.34 1.84.77 2.35.08.1.1.19.07.3l-.28 1.16c-.05.19-.15.23-.35.14-1.29-.6-2.1-2.48-2.1-4 0-3.25 2.36-6.24 6.81-6.24 3.57 0 6.35 2.55 6.35 5.95 0 3.55-2.24 6.41-5.34 6.41-1.05 0-2.03-.55-2.37-1.19l-.64 2.45c-.23.9-.86 2.02-1.28 2.7A10 10 0 1 0 12 2Z"
          />
        </svg>
      );
    default:
      return null;
  }
}

/** Platform rozeti. `size` piksel cinsinden kenar uzunluğu. */
export function PlatformBadge({
  platform,
  size = 40,
  muted = false,
}: {
  platform: SocialPlatformId;
  size?: number;
  muted?: boolean;
}) {
  const brand = BRANDS[platform];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-xl transition"
      style={{
        width: size,
        height: size,
        background: muted ? "rgba(30,41,59,0.85)" : brand.background,
        boxShadow: muted ? "none" : `0 6px 18px -8px ${brand.accent}`,
        filter: muted ? "grayscale(1)" : undefined,
        opacity: muted ? 0.55 : 1,
      }}
    >
      <Glyph platform={platform} color={muted ? "#94a3b8" : brand.foreground} />
    </span>
  );
}
