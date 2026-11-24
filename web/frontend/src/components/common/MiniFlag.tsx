// Üst menüdeki dil seçici için yalnız TR ve GB bayrağı (country-flag-icons, MIT).
// Neden satır içi: paketin 250 bayraklık dosyasını ana pakete çekmemek (~230 KB).
// Telefon girişi (NbPhoneInput) tüm seti tembel yükler; ikisi paylaşılınca bütün dosya ana pakete giriyordu.
// Bayrak ekleme: country-flag-icons/3x2/<KOD>.svg içeriğini aşağıya kopyalayın.
import type { ReactElement } from "react";

const SVG: Record<string, string> = {
  TR: "<path fill=\"#E30A17\" d=\"M0 0h513v342H0z\"/><path fill=\"#FFF\" d=\"M259.7 118.6c-13.1-9.5-29-14.6-45.3-14.5-40.8 0-73.8 30.8-73.8 68.9s33.1 68.9 73.8 68.9c17.1 0 32.9-5.4 45.3-14.5-30 38.6-85.7 45.6-124.3 15.5s-45.6-85.7-15.5-124.3 85.7-45.6 124.3-15.5c5.8 4.5 11 9.8 15.5 15.5zm39.9 65.8-18.1 21.9 1.2-28.4-26.4-10.4 27.3-7.6 1.8-28.3 15.6 23.7 27.5-7.1-17.5 22 15.3 23.9-26.7-9.7z\"/>",
  GB: "<g fill=\"#FFF\"><path d=\"M0 0h513v341.3H0V0z\"/><path d=\"M311.7 230 513 341.3v-31.5L369.3 230h-57.6zM200.3 111.3 0 0v31.5l143.7 79.8h56.6z\"/></g><g fill=\"#012169\"><path d=\"M393.8 230 513 295.7V230H393.8zm-82.1 0L513 341.3v-31.5L369.3 230h-57.6zm146.9 111.3-147-81.7v81.7h147zM90.3 230 0 280.2V230h90.3zm110 14.2v97.2H25.5l174.8-97.2zM118.2 111.3 0 45.6v65.7h118.2zm82.1 0L0 0v31.5l143.7 79.8h56.6zM53.4 0l147 81.7V0h-147zM421.7 111.3 513 61.1v50.2h-91.3zm-110-14.2V0h174.9L311.7 97.1z\"/></g><g fill=\"#c8102e\"><path d=\"M288 0h-64v138.7H0v64h224v138.7h64V202.7h224v-64H288V0z\"/><path d=\"M311.7 230 513 341.3v-31.5L369.3 230h-57.6zM143.7 230 0 309.9v31.5L200.3 230h-56.6zM200.3 111.3 0 0v31.5l143.7 79.8h56.6zM368.3 111.3 513 31.5V0L311.7 111.3h56.6z\"/></g>",
};

export function hasMiniFlag(country: string): boolean {
  return country in SVG;
}

/** 3:2 oranlı küçük bayrak; üst kutu boyutu verir. */
export function MiniFlag({ country, title }: { country: string; title?: string }): ReactElement | null {
  const svg = SVG[country];
  if (!svg) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 513 342" className="block h-full w-full" role="img" aria-label={title} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
