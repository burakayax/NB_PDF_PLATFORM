/**
 * Giriş yapmış kullanıcının hesap ekranlarının (profil, taramalar, API, abonelik) adresleri.
 * Her ekranın KENDİ adresi vardır: yenileme ve bağlantı paylaşımı doğru ekrana götürür,
 * sekme başlığı ekranın adını taşır. Tek kaynak: App (adres eşitleme) + routeSeoConfig (başlık).
 */
export type AccountPanelId = "profile" | "scans" | "api" | "subscription";

export const ACCOUNT_PANEL_PATHS: Record<AccountPanelId, string> = {
  profile: "/hesap/profil",
  scans: "/taramalarim",
  api: "/hesap/api",
  subscription: "/hesap/abonelik",
};

export const ACCOUNT_PANEL_TITLES: Record<AccountPanelId, { tr: string; en: string }> = {
  profile: { tr: "Profilim", en: "My profile" },
  scans: { tr: "Taramalarım", en: "My scans" },
  api: { tr: "API Erişimi", en: "API access" },
  subscription: { tr: "Abonelik ve krediler", en: "Subscription & credits" },
};

/** Dil önekini (/en) soyup hesap ekranı kimliğini döndürür; hesap ekranı değilse null. */
export function accountPanelFromPath(pathname: string): AccountPanelId | null {
  const p = (pathname.replace(/^\/en(?=\/|$)/, "").replace(/\/+$/, "") || "/") as string;
  for (const id of Object.keys(ACCOUNT_PANEL_PATHS) as AccountPanelId[]) {
    if (ACCOUNT_PANEL_PATHS[id] === p) return id;
  }
  return null;
}
