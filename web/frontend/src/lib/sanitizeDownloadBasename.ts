/**
 * Normalizes a suggested download filename for use with the `download` attribute.
 * Keeps behavior aligned with the former filename confirmation modal.
 */
export function sanitizeDownloadBasename(name: string, fallback: string): string {
  const raw = name.trim() || fallback.trim() || "download";
  const noPath = raw.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ");
  return noPath || "download";
}
