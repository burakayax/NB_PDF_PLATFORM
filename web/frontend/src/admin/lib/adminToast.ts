/**
 * Admin paneli geneli bildirim (toast) kanalı. `adminFetch` gibi React dışı
 * yerlerden tetiklenebilmesi için window CustomEvent kullanır; `AdminToaster`
 * bileşeni dinleyip ekranda gösterir.
 */
export const ADMIN_TOAST_EVENT = "admin:toast";

export type AdminToastType = "success" | "error";

export type AdminToastDetail = {
  type: AdminToastType;
  message: string;
};

export function emitAdminToast(detail: AdminToastDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<AdminToastDetail>(ADMIN_TOAST_EVENT, { detail }));
}

/** Sunucu hata gövdesini (JSON veya düz metin) okunabilir kısa bir mesaja indirger. */
export function readAdminErrorMessage(raw: string): string {
  const text = (raw ?? "").trim();
  if (!text) {
    return "";
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const candidate = obj.error ?? obj.message;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim().slice(0, 200);
      }
    }
  } catch {
    /* not JSON */
  }
  return text.slice(0, 200);
}
