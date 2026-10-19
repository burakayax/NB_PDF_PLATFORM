/** Dokunmatik (kaba işaretçi) cihaz mı? Orada sürükle-bırak yok; metin "seç" demeli. */
export function isCoarsePointer(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * "…buraya sürükle" / "Drag … here" yükleme metnini dokunmatik cihazda "…seç" / "Choose …" yapar.
 * Masaüstünde metni olduğu gibi bırakır.
 */
export function touchifyDropText(text: string): string {
  if (!isCoarsePointer()) return text;
  return text
    .replace(/ buraya sürükle( veya seç)?/i, " seç")
    .replace(/^Drag (your |the )?(.+?) here( or browse)?$/i, (_m, _a, what) => `Choose your ${what}`);
}
