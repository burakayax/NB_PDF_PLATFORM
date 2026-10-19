/**
 * Giriş ekranı bot doğrulaması (Cloudflare Turnstile) durumu.
 * Sunucu, aynı e-postaya art arda yanlış denemeden sonra 428 + `captcha_required` döner;
 * o zaman kutu gösterilir, alınan tek kullanımlık jeton bir sonraki giriş isteğine eklenir.
 */
import { useSyncExternalStore } from "react";

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

let needed = false;
let token: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setCaptchaNeeded(value: boolean): void {
  if (needed === value) return;
  needed = value;
  if (!value) token = null;
  emit();
}

export function setCaptchaToken(value: string | null): void {
  token = value;
}

/** Jeton tek kullanımlıktır: okunduğunda silinir. */
export function takeCaptchaToken(): string | null {
  const t = token;
  token = null;
  return t;
}

export function useCaptchaNeeded(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => needed,
    () => false,
  );
}
