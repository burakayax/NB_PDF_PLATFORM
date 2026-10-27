import { Moon, Sun } from "lucide-react";
import { useLightReady, useThemePreference } from "../../lib/theme";

/**
 * Açık / koyu tema düğmesi. Yalnız açık temanın hazır olduğu ekranlara konur (bkz. lib/theme.ts isLightReady).
 * Düğme MEVCUT durumu değil, tıklayınca GEÇİLECEK durumu simgeyle gösterir (güneş = açığa geç).
 */
export function ThemeToggle({ tr, className = "" }: { tr: boolean; className?: string }) {
  const [pref, setPref] = useThemePreference();
  const ready = useLightReady();
  if (!ready) return null; // açık tema bu ekranda henüz hazır değil
  const toLight = pref === "dark";
  const label = toLight ? (tr ? "Açık temaya geç" : "Switch to light theme") : tr ? "Koyu temaya geç" : "Switch to dark theme";
  return (
    <button
      type="button"
      onClick={() => setPref(toLight ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10 ${className}`}
    >
      {toLight ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
