import { useSyncExternalStore } from "react";
import type { AppView } from "./appViews";

/**
 * AÇIK / KOYU TEMA.
 *
 * Tercih tarayıcıda saklanır. Varsayılan KOYU: site böyle yayında; açık işletim sistemi kullanan herkesin
 * sitesi habersiz değişmesin. Açık tema kademeli açılır: yalnız `isLightReady` olan ekranlarda uygulanır,
 * diğerleri tercih ne olursa olsun koyu kalır (bkz. styles/theme-light.css). Bir ekran açık temada
 * denetlenip (src/dev/contrastAudit.ts) hazır olunca LIGHT_VIEWS / LIGHT_PATHS'e eklenir.
 */

export type ThemePreference = "light" | "dark";
export type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = "nb-theme";
const CHANGE_EVENT = "nb-theme-change";

export function readThemePreference(): ThemePreference {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark"; // gizli pencere / engelli depolama
  }
}

export function writeThemePreference(pref: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* kalıcı olmasa da oturum boyunca çalışsın */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb); // başka sekmede değişirse
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const pref = useSyncExternalStore(subscribe, readThemePreference, () => "dark" as ThemePreference);
  return [pref, writeThemePreference];
}

/** Açık temada denetlenmiş üst düzey ekranlar. */
const LIGHT_VIEWS = new Set<AppView>(["landing", "login", "register", "forgot_password", "admin_login", "admin", "team_invite", "web", "about", "terms", "privacy", "kvkk", "on-bilgilendirme", "mesafeli-satis"]);

/**
 * "landing" görünümü araç sayfalarını (/tools/…) ve blogu da kapsar; bunlar henüz denetlenmedi.
 * Burada yalnız denetlenen adresler açık temaya izinli. Yol /en önekinden arındırılarak bakılır.
 */
const LIGHT_PATHS = new Set(["/", "/pricing", "/fiyatlandirma", "/about", "/hakkimizda"]);

/** Araç sayfaları (/tools/…), blog (/blog/…) ve geliştirici API sayfaları (/pdf-api/…): tümü taranıp temiz çıktı. */
const LIGHT_PREFIXES = ["/tools", "/blog", "/pdf-api"];

export function isLightReady(view: AppView, pathname: string): boolean {
  if (!LIGHT_VIEWS.has(view)) return false;
  if (view !== "landing") return true;
  const path = pathname.replace(/^\/en(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return LIGHT_PATHS.has(path) || LIGHT_PREFIXES.some((x) => path === x || path.startsWith(x + "/"));
}

export function applyTheme(effective: EffectiveTheme) {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== effective) root.setAttribute("data-theme", effective);
  // Tarayıcı çubuğu rengi (mobil) sayfayla uyumlu olsun
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effective === "light" ? "#f8fafc" : "#0f172a");
}

// ── "Bu ekran açık temaya hazır mı?" — düğme yalnız hazır ekranlarda görünsün ──────────────────────
let lightReady = false;
const READY_EVENT = "nb-theme-ready-change";

export function setLightReady(next: boolean) {
  if (lightReady === next) return;
  lightReady = next;
  window.dispatchEvent(new Event(READY_EVENT));
}

function subscribeReady(cb: () => void) {
  window.addEventListener(READY_EVENT, cb);
  return () => window.removeEventListener(READY_EVENT, cb);
}

export function useLightReady(): boolean {
  return useSyncExternalStore(subscribeReady, () => lightReady, () => false);
}
