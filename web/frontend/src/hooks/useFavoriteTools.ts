import { useCallback, useEffect, useState } from "react";

/**
 * Kullanıcının favori/sık-kullanılan araçlarını localStorage'da tutar.
 * Birden çok sidebar varyantı (masaüstü panel, mobil drawer) aynı listeyi
 * paylaşır; değişiklik özel bir event ile tüm bileşenlere yayılır.
 */
const STORAGE_KEY = "nbpdf-favorite-tools";
const CHANGED_EVENT = "nbpdf-favorites-changed";

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useFavoriteTools() {
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGED_EVENT, sync);
    };
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota / private mode — yine de UI güncellensin */
      }
      window.dispatchEvent(new Event(CHANGED_EVENT));
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
