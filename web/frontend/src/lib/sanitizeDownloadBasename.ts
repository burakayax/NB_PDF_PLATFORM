/**
 * Normalizes a suggested download filename for use with the `download` attribute.
 * If the user removed the extension, it is restored from the fallback filename.
 */
export function sanitizeDownloadBasename(name: string, fallback: string): string {
  const raw = name.trim() || fallback.trim() || "download";
  const cleaned = raw.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ").trim() || "download";

  // Extract the expected extension from the fallback (e.g. ".pdf", ".pptx")
  const extMatch = fallback.trim().match(/(\.[a-zA-Z0-9]+)$/);
  const expectedExt = extMatch ? extMatch[1].toLowerCase() : "";

  if (expectedExt && !cleaned.toLowerCase().endsWith(expectedExt)) {
    // Strip any other extension the user may have typed, then append the correct one
    const withoutAnyExt = cleaned.replace(/\.[a-zA-Z0-9]+$/, "");
    return (withoutAnyExt || "download") + expectedExt;
  }

  return cleaned;
}
