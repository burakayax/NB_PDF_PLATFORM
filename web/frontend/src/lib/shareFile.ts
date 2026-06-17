/**
 * Web Share API helpers for handing a generated file to the OS share sheet
 * (WhatsApp, e-mail, AirDrop, …). File sharing (`navigator.share({ files })`)
 * works on Android/iOS and recent Chromium desktop; older browsers and Firefox
 * do not support it — callers must handle the "unsupported" outcome.
 *
 * We deliberately share ONLY the file (no `text`/`url`): WhatsApp & co. surface
 * Web Share text as a SEPARATE, deletable message — which looks like spam and
 * loses the branding the moment the user removes it. Branding instead lives
 * inside the PDF (metadata for everyone, a visible footer on free-plan output),
 * so it travels with the file permanently.
 */

/**
 * Coarse capability hint: the browser exposes the Web Share API at all. Used to
 * decide whether to even offer a "Paylaş" affordance (Firefox / old desktops
 * lack it entirely). Per-file feasibility is still re-checked via `canShareFile`.
 */
export function isShareApiAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    typeof navigator.share === "function"
  );
}

/** True when the current browser can share this specific file via the OS sheet. */
export function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      typeof navigator.share === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

export type ShareFileOutcome = "shared" | "cancelled" | "unsupported" | "error";

/**
 * Opens the OS share sheet with ONLY the file (no separate text message).
 * Returns:
 *   - `shared`      → user completed a share
 *   - `cancelled`   → user dismissed the sheet
 *   - `unsupported` → browser can't share files (caller should fall back)
 *   - `error`       → unexpected failure
 */
export async function shareFileWithPromo(
  file: File,
  title?: string,
): Promise<ShareFileOutcome> {
  if (!canShareFile(file)) {
    return "unsupported";
  }
  try {
    await navigator.share({
      files: [file],
      title: title?.trim() || file.name,
    });
    return "shared";
  } catch (e: unknown) {
    const name =
      e && typeof e === "object" && "name" in e
        ? String((e as { name: unknown }).name)
        : "";
    return name === "AbortError" ? "cancelled" : "error";
  }
}
