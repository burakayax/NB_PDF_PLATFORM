/**
 * AI FOTOĞRAF STÜDYOSU — hazır ölçüler ve arka planlar.
 *
 * `head` = baş boyunun (çeneden saç tepesine) fotoğraf yüksekliğine oranı aralığı.
 * Resmî ölçüler kurumların yayımladığı baş-boyu milimetrelerinden hesaplandı
 * (ör. AB 32–36 mm / 45 mm). Kurumlar kuralı değiştirebilir; her ön ayarda
 * kullanıcıya "başvuracağınız kurumun güncel şartını kontrol edin" notu gösterilir.
 */

export type PresetGroup = "official" | "career" | "social" | "custom";

export type PhotoPreset = {
  id: string;
  group: PresetGroup;
  tr: { name: string; desc: string };
  en: { name: string; desc: string };
  /** Çıktı ölçüsü (mm). Piksel hesabı 300 dpi üzerinden. mmW/mmH yoksa px kullanılır. */
  mmW?: number;
  mmH?: number;
  /** mm yoksa doğrudan piksel. */
  pxW?: number;
  pxH?: number;
  /** Baş boyu oranı [min, max]. */
  head: [number, number];
  /** Baş üstü boşluğun, toplam boş alandaki payı (0–1). Düşük = baş yukarıda. */
  topShare: number;
  /** Önerilen arka plan. */
  bg: BgId;
  /** Yuvarlak kırpma önerilir mi (avatar). */
  circle?: boolean;
  /** Resmî biyometrik kurallar uygulanır mı (nötr ifade, ağız kapalı vb. denetim). */
  strict?: boolean;
  /** Bu ön ayarda sıkça istenen dosya boyutu sınırı (KB) — yalnızca öneri. */
  maxKb?: number;
};

export const DPI = 300;
export const mmToPx = (mm: number, dpi = DPI): number => Math.round((mm / 25.4) * dpi);

export const PRESETS: PhotoPreset[] = [
  // ── Resmî belgeler ───────────────────────────────────────────────────────
  {
    id: "tr-biyometrik", group: "official", mmW: 50, mmH: 60, head: [0.7, 0.8], topShare: 0.3, bg: "white", strict: true,
    tr: { name: "Türkiye biyometrik (50×60)", desc: "Kimlik kartı, pasaport, ehliyet. Beyaz fon, baş %70–80." },
    en: { name: "Turkey biometric (50×60)", desc: "ID card, passport, driver's licence. White background, head 70–80%." },
  },
  {
    id: "schengen", group: "official", mmW: 35, mmH: 45, head: [0.71, 0.8], topShare: 0.3, bg: "lightgray", strict: true,
    tr: { name: "Schengen / AB vize (35×45)", desc: "Avrupa vizesi ve AB pasaportları. Açık gri/beyaz fon." },
    en: { name: "Schengen / EU visa (35×45)", desc: "European visas and EU passports. Light grey/white background." },
  },
  {
    id: "uk", group: "official", mmW: 35, mmH: 45, head: [0.64, 0.76], topShare: 0.3, bg: "lightgray", strict: true,
    tr: { name: "Birleşik Krallık (35×45)", desc: "UK pasaport ve vize. Açık, düz fon." },
    en: { name: "United Kingdom (35×45)", desc: "UK passport and visa. Plain light background." },
  },
  {
    id: "us", group: "official", mmW: 51, mmH: 51, head: [0.5, 0.69], topShare: 0.3, bg: "white", strict: true,
    tr: { name: "ABD vize/pasaport (2×2 inç)", desc: "51×51 mm kare. Beyaz fon, baş 25–35 mm." },
    en: { name: "US visa/passport (2×2 in)", desc: "51×51 mm square. White background, head 25–35 mm." },
  },
  {
    id: "ca", group: "official", mmW: 50, mmH: 70, head: [0.44, 0.51], topShare: 0.3, bg: "white", strict: true,
    tr: { name: "Kanada (50×70)", desc: "Kanada pasaport ve vize. Beyaz/açık fon." },
    en: { name: "Canada (50×70)", desc: "Canadian passport and visa. White/light background." },
  },
  {
    id: "cn", group: "official", mmW: 33, mmH: 48, head: [0.58, 0.69], topShare: 0.3, bg: "white", strict: true,
    tr: { name: "Çin vizesi (33×48)", desc: "Çin vize başvurusu. Beyaz fon." },
    en: { name: "China visa (33×48)", desc: "China visa application. White background." },
  },
  {
    id: "in-jp", group: "official", mmW: 35, mmH: 45, head: [0.71, 0.8], topShare: 0.3, bg: "white", strict: true,
    tr: { name: "Japonya / Hindistan vb. (35×45)", desc: "Birçok ülkede kullanılan 35×45 mm, beyaz fon." },
    en: { name: "Japan / India etc. (35×45)", desc: "35×45 mm used by many countries, white background." },
  },
  {
    id: "classic-45x60", group: "official", mmW: 45, mmH: 60, head: [0.6, 0.74], topShare: 0.32, bg: "white",
    tr: { name: "Klasik vesikalık (4,5×6)", desc: "Okul, kurum ve iş başvuru formları." },
    en: { name: "Classic ID photo (4.5×6)", desc: "School, institution and job application forms." },
  },
  // ── CV / kariyer ─────────────────────────────────────────────────────────
  {
    id: "cv-portrait", group: "career", pxW: 900, pxH: 1200, head: [0.42, 0.55], topShare: 0.36, bg: "lightblue", maxKb: 300,
    tr: { name: "CV portre (3:4)", desc: "Özgeçmişe eklemek için dikey, ferah profesyonel portre." },
    en: { name: "CV portrait (3:4)", desc: "Vertical, airy professional portrait for your résumé." },
  },
  {
    id: "cv-square", group: "career", pxW: 1000, pxH: 1000, head: [0.46, 0.6], topShare: 0.38, bg: "lightgray", maxKb: 300,
    tr: { name: "CV kare (1:1)", desc: "Kare fotoğraf alanı olan CV şablonları için." },
    en: { name: "CV square (1:1)", desc: "For résumé templates with a square photo slot." },
  },
  {
    id: "linkedin", group: "career", pxW: 800, pxH: 800, head: [0.5, 0.66], topShare: 0.4, bg: "lightblue", circle: false, maxKb: 8000,
    tr: { name: "LinkedIn profil (800×800)", desc: "Yüz kadrajın yaklaşık %60'ını kaplar." },
    en: { name: "LinkedIn profile (800×800)", desc: "Face fills about 60% of the frame." },
  },
  {
    id: "kurumsal", group: "career", pxW: 1080, pxH: 1350, head: [0.36, 0.5], topShare: 0.34, bg: "lightgray", maxKb: 1000,
    tr: { name: "Kurumsal / web sitesi (4:5)", desc: "Şirket sitesi, ekip sayfası ve e-posta imzası." },
    en: { name: "Corporate / website (4:5)", desc: "Company site, team page and email signature." },
  },
  // ── Sosyal ───────────────────────────────────────────────────────────────
  {
    id: "avatar", group: "social", pxW: 1000, pxH: 1000, head: [0.5, 0.68], topShare: 0.42, bg: "transparent", circle: true,
    tr: { name: "Yuvarlak profil (1:1)", desc: "Instagram, X, WhatsApp, Discord, Teams profil resmi." },
    en: { name: "Round avatar (1:1)", desc: "Instagram, X, WhatsApp, Discord, Teams profile picture." },
  },
  {
    id: "portrait-45", group: "social", pxW: 1080, pxH: 1350, head: [0.3, 0.46], topShare: 0.34, bg: "original",
    tr: { name: "Instagram portre (4:5)", desc: "Gönderi için dikey, yarım boy kadraj." },
    en: { name: "Instagram portrait (4:5)", desc: "Vertical half-body framing for posts." },
  },
];

export const GROUP_LABEL: Record<PresetGroup, { tr: string; en: string }> = {
  official: { tr: "Resmî belge", en: "Official ID" },
  career: { tr: "CV ve kariyer", en: "CV & career" },
  social: { tr: "Sosyal medya", en: "Social" },
  custom: { tr: "Özel ölçü", en: "Custom" },
};

export const CUSTOM_PRESET_ID = "custom";

// ── Arka planlar ───────────────────────────────────────────────────────────

export type BgId =
  | "original"
  | "transparent"
  | "white"
  | "lightgray"
  | "lightblue"
  | "beige"
  | "studio"
  | "navy"
  | "blur"
  | "custom";

export type BgOption = {
  id: BgId;
  tr: string;
  en: string;
  /** Önizleme rengi (düz renkler); özel durumlar için CSS arka plan dizesi. */
  swatch: string;
};

export const BACKGROUNDS: BgOption[] = [
  { id: "original", tr: "Orijinal", en: "Original", swatch: "linear-gradient(135deg,#94a3b8,#475569)" },
  { id: "transparent", tr: "Şeffaf (PNG)", en: "Transparent (PNG)", swatch: "repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 50% / 12px 12px" },
  { id: "white", tr: "Beyaz", en: "White", swatch: "#ffffff" },
  { id: "lightgray", tr: "Açık gri", en: "Light grey", swatch: "#e9ebee" },
  { id: "lightblue", tr: "Açık mavi", en: "Light blue", swatch: "#d9e8f6" },
  { id: "beige", tr: "Krem", en: "Cream", swatch: "#f3ece1" },
  { id: "studio", tr: "Stüdyo gri", en: "Studio grey", swatch: "radial-gradient(circle at 50% 35%,#f1f2f4,#b9bec6)" },
  { id: "navy", tr: "Lacivert", en: "Navy", swatch: "#1d2b4a" },
  { id: "blur", tr: "Bulanık arka plan", en: "Blurred background", swatch: "linear-gradient(135deg,#cbd5e1,#64748b)" },
  { id: "custom", tr: "Özel renk", en: "Custom colour", swatch: "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" },
];

export const SOLID_BG: Partial<Record<BgId, string>> = {
  white: "#ffffff",
  lightgray: "#e9ebee",
  lightblue: "#d9e8f6",
  beige: "#f3ece1",
  navy: "#1d2b4a",
};

// ── Baskı sayfası ──────────────────────────────────────────────────────────

export type SheetId = "none" | "10x15" | "a4";

export const SHEETS: { id: SheetId; tr: string; en: string; mmW: number; mmH: number }[] = [
  { id: "10x15", tr: "10×15 cm (fotoğrafçı kâğıdı)", en: "10×15 cm (photo paper)", mmW: 100, mmH: 150 },
  { id: "a4", tr: "A4", en: "A4", mmW: 210, mmH: 297 },
];

/** Çıktı piksel ölçüsü. */
export function presetPixels(p: Pick<PhotoPreset, "mmW" | "mmH" | "pxW" | "pxH">): { w: number; h: number } {
  if (p.mmW && p.mmH) return { w: mmToPx(p.mmW), h: mmToPx(p.mmH) };
  return { w: p.pxW ?? 1000, h: p.pxH ?? 1000 };
}
