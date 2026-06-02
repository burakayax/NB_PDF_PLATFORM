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
    <div className="flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-nb-heading sm:text-lg md:text-xl lg:text-2xl 2xl:text-3xl">
            {greeting}
          </p>
          <p className="mt-0.5 truncate text-xs text-nb-muted sm:text-sm md:text-base">
            {date}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label={tr ? "Bildirimler" : "Notifications"}
          className="nb-transition flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text sm:h-10 sm:w-10"
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
        </button>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={tr ? "Ayarlar" : "Settings"}
            className="nb-transition flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-nb-panel/60 text-nb-muted hover:border-nb-primary/30 hover:text-nb-text sm:h-10 sm:w-10"
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
