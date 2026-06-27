import type { SyntheticEvent } from "react";
import type { Language } from "../i18n/landing";

/**
 * Dile göre görsel yolu. Dil EN ise dosya adına uzantıdan ÖNCE "-en" ekler
 * (ör. `/demo/step1.png` → `/demo/step1-en.png`). Türkçede yol değişmez.
 *
 * İngilizce görsel henüz yoksa, <img> üzerinde `langAssetFallback(trSrc)` ile
 * otomatik olarak Türkçesine düşülür — yani EN sürüm eklenene dek hiçbir şey
 * bozulmaz, Türkçe görsel gösterilir.
 */
export function langAsset(src: string, language: Language): string {
  if (language !== "en") return src;
  return src.replace(/(\.[a-z0-9]+)$/i, "-en$1");
}

/**
 * <img onError> handler'ı: EN görsel 404 verirse bir kez Türkçesine (`trSrc`)
 * düşer. Türkçe de yoksa (nadiren) görsel kırık kalır ama döngüye girmez.
 */
export function langAssetFallback(trSrc: string) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.langFallback === "1") return; // zaten denendi → sonsuz döngü yok
    img.dataset.langFallback = "1";
    img.src = trSrc;
  };
}
