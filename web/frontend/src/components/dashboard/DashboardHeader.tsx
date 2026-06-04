import { Bell, Settings } from "lucide-react";
import type { AuthUser } from "../../api/auth";
import type { Language } from "../../i18n/landing";
import { userGreetingLine } from "./userDisplayName";

interface DashboardHeaderProps {
  user: AuthUser;
  language: Language;
  onOpenSettings?: () => void;
}

function useFormattedDate(language: Language): string {
  const locale = language === "tr" ? "tr-TR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function UserAvatar({ user }: { user: AuthUser }) {
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nb-primary/30 to-nb-secondary/20 text-sm font-bold text-nb-accent shadow-[0_0_20px_-6px_rgba(34,211,238,0.4)] w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 lg:rounded-2xl lg:text-base 2xl:w-16 2xl:h-16 2xl:text-lg"
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

export function DashboardHeader({
  user,
  language,
  onOpenSettings,
}: DashboardHeaderProps) {
  const greeting = userGreetingLine(user, language);
  const date = useFormattedDate(language);
  const tr = language === "tr";

  return (
    <>
      {/* Mobile: Minimal header (avatar only, max 56px) */}
      <div className="flex md:hidden items-center justify-between gap-2 min-h-14 max-h-14">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar user={user} />
          <div className="min-w-0 hidden sm:block">
            <p className="truncate text-xs font-bold text-nb-heading">
              {user.name?.split(" ")[0] || "User"}
            </p>
            <p className="text-[9px] text-nb-muted">{new Date().toLocaleDateString(tr ? "tr-TR" : "en-US", { month: "short", day: "numeric" })}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={tr ? "Bildirimler" : "Notifications"}
            className="nb-transition flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text"
          >
            <Bell className="h-5 w-5" aria-hidden />
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={tr ? "Ayarlar" : "Settings"}
              className="nb-transition flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text"
            >
              <Settings className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Tablet & Desktop: Full header */}
      <div className="hidden md:flex flex-col items-start justify-between gap-3 sm:gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-nb-heading sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">
              {greeting}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-nb-muted sm:text-xs md:text-sm lg:text-base">
              {date}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
          <button
            type="button"
            aria-label={tr ? "Bildirimler" : "Notifications"}
            className="nb-transition flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text sm:h-9 sm:w-9 md:h-10 md:w-10 md:rounded-xl"
          >
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" aria-hidden />
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={tr ? "Ayarlar" : "Settings"}
              className="nb-transition flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text sm:h-9 sm:w-9 md:h-10 md:w-10 md:rounded-xl"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
