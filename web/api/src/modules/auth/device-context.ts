import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

/**
 * "GÜVENİLİR CİHAZ" KİMLİĞİ — tarayıcıda saklanan rastgele, HttpOnly bir çerez.
 *
 * NEDEN IP DEĞİL: IP, mobil veride dakikalar içinde, Wi-Fi ↔ mobil geçişte anında değişir; cihazı
 * IP'ye bağlamak dürüst kullanıcıyı sürekli "yeni cihaz" yapar. Çerez, IP değişse de aynı tarayıcıyı
 * aynı cihaz olarak tutar. Çerez silinirse ya da gizli sekme kullanılırsa yeni cihaz sayılır (kabul).
 *
 * Kimlik, istek boyunca AsyncLocalStorage ile taşınır: giriş akışındaki çağrılara parametre
 * eklemeden `cihazAnahtari` bunu okuyabilir.
 */

export const DEVICE_COOKIE_NAME = "nbpdf_device";
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{22,64}$/;

type DeviceCtx = { deviceId: string | null };
export const deviceCtx = new AsyncLocalStorage<DeviceCtx>();

/** İstekte çerezle GELEN geçerli kimlik; yoksa (ya da bu istekte yeni üretildiyse) null. */
export function currentDeviceId(): string | null {
  return deviceCtx.getStore()?.deviceId ?? null;
}

export function parseDeviceId(raw: unknown): string | null {
  return typeof raw === "string" && DEVICE_ID_RE.test(raw) ? raw : null;
}

export function newDeviceId(): string {
  return randomBytes(18).toString("base64url");
}
