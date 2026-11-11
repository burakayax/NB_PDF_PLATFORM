import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Kartın ilk 6 hanesinden (BIN) kartı çıkaran bankanın ülkesini bulur.
 *
 * Arama YEREL bir dosyada yapılır: BIN hiçbir dış servise gönderilmez.
 * Dosya biçimi (CSV, satır başına bir kayıt): `BIN,ÜLKE` — örn. `454360,TR`  ya da `411111,US`.
 * BIN 6–8 hane olabilir; en uzun eşleşen önek kazanır. `#` ile başlayan satırlar yorumdur.
 * Dosya yolu: BIN_COUNTRY_LIST_PATH (yoksa `data/bin-country.csv`). Dosya yoksa/boşsa ya da BIN
 * listede yoksa sonuç `null` (= BİLİNMİYOR) döner; çağıran taraf bilinmeyeni KDV'li sayar.
 */

let cache: { path: string; map: Map<string, string> } | null = null;

export function binListPath(): string {
  return process.env.BIN_COUNTRY_LIST_PATH?.trim() || path.resolve(process.cwd(), "data", "bin-country.csv");
}

function loadMap(): Map<string, string> {
  const p = binListPath();
  if (cache && cache.path === p) return cache.map;
  const map = new Map<string, string>();
  try {
    if (existsSync(p)) {
      for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const [bin, country] = line.split(",").map((x) => x.trim());
        if (bin && country && /^\d{6,8}$/.test(bin) && /^[A-Za-z]{2}$/.test(country)) {
          map.set(bin, country.toUpperCase());
        }
      }
    }
  } catch {
    /* okunamazsa boş liste: her şey "bilinmiyor" */
  }
  cache = { path: p, map };
  return map;
}

/** Testler ve liste güncellemesi sonrası önbelleği boşaltır. */
export function resetBinCountryCache(): void {
  cache = null;
}

/** "TR" gibi 2 harfli ülke kodu ya da bilinmiyorsa null. */
export function lookupBinCountry(bin: string | null | undefined): string | null {
  const digits = (bin ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  const map = loadMap();
  for (let len = Math.min(8, digits.length); len >= 6; len--) {
    const hit = map.get(digits.slice(0, len));
    if (hit) return hit;
  }
  return null;
}
