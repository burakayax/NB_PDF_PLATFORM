/**
 * Açık adres "akıl kontrolü" (rastgele tuş basılmış adresleri yakalar) + Türkiye il/ilçe doğrulaması.
 * Adresin gerçekten var olduğunu DOĞRULAMAZ; yalnızca anlamsız girdileri (asdfsd, aaaaaa, 1111) eler.
 * Aynı dosya arayüzde (frontend/src/lib/addressCheck.ts) birebir kullanılır.
 */
import { canonicalCity, canonicalDistrict } from "../../lib/tr-locations.js";

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "qazwsxedc", "1234567890", "ğüşiçöı", "ertyuıop", "asdfghjklşi"];
const STREET_WORDS = [
  "mah", "mahalle", "mahallesi", "sok", "sokak", "sokağı", "cad", "cadde", "caddesi", "bulvar", "bulvarı", "blv",
  "no", "kat", "daire", "apt", "apartman", "apartmanı", "site", "sitesi", "köy", "köyü", "mevkii", "mevki", "yol", "yolu",
  "çarşı", "plaza", "han", "iş", "merkezi", "blok", "pk", "street", "st", "road", "rd", "avenue", "ave", "lane", "ln",
  "drive", "dr", "boulevard", "unit", "apt.", "floor", "suite", "straße", "strasse", "rue", "calle", "via", "platz",
];

function lower(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLocaleLowerCase("tr-TR");
}

/** Klavye sırasından 4+ ardışık harf içeren ya da 5+ harfli ünlüsüz sözcük var mı? */
function hasKeyboardMash(text: string): boolean {
  for (const word of lower(text).split(/[^a-zçğıöşü0-9]+/)) {
    if (word.length < 4) continue;
    for (const row of KEY_ROWS) {
      for (let i = 0; i + 4 <= word.length; i++) {
        const part = word.slice(i, i + 4);
        if (row.includes(part) || [...row].reverse().join("").includes(part)) {
          // "mahalle", "sokak" gibi gerçek sözcüklerde nadir; yine de gerçek sözcük listesinde olanı affet.
          if (!STREET_WORDS.includes(word)) return true;
        }
      }
    }
    if (word.length >= 5 && /^[^aeıioöuü0-9]+$/.test(word)) return true;
  }
  return false;
}

/** Açık adres anlamlı görünmüyorsa Türkçe hata metni, uygunsa null. */
export function addressLineProblem(line: string, countryCode: string): string | null {
  const t = line.trim().replace(/\s+/g, " ");
  const tr = countryCode.toUpperCase() === "TR";
  const minLen = tr ? 10 : 6;
  const msg = tr
    ? "Açık adres anlamlı görünmüyor. Mahalle, sokak/cadde ve bina-daire numarasını yazın (örn. Atatürk Mah. Gül Sok. No: 5 D: 3)."
    : "The address looks incomplete. Please enter street and number.";
  if (t.length < minLen) return msg;
  if (!/\p{L}/u.test(t)) return msg;
  const letters = lower(t).replace(/[^a-zçğıöşü]/g, "");
  if (new Set(letters).size < 4) return msg; // "aaaaaa", "abab"
  if (hasKeyboardMash(t)) return msg;
  const words = lower(t).split(/[\s,./:;()-]+/).filter(Boolean);
  const hasDigit = /\d/.test(t);
  const hasStreetWord = words.some((w) => STREET_WORDS.includes(w));
  if (words.length < 2) return msg;
  if (tr && !hasDigit && !hasStreetWord) return msg; // yurt içinde numara ya da mahalle/sokak ifadesi şart
  if (!tr && !hasDigit && words.length < 3) return msg;
  return null;
}

/** Türkiye için il/ilçe listeyle uyuşmalı. Hata yoksa null; düzeltilmiş resmi adlar için canonical* kullanın. */
export function trLocationProblem(city: string, district: string): { city?: string; district?: string } | null {
  const out: { city?: string; district?: string } = {};
  if (!canonicalCity(city)) out.city = "Listeden bir il seçin.";
  else if (!canonicalDistrict(city, district)) out.district = "Seçilen ile ait bir ilçe seçin.";
  return Object.keys(out).length ? out : null;
}

export { canonicalCity, canonicalDistrict };
