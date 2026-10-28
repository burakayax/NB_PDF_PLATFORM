/**
 * Kaydırmalı gönderinin İÇ SLAYTLARI — görselli tasarım (v2).
 *
 * NEDEN: Düz yazı slaytları kaydırmayı bıraktırıyor. Araştırma ortak sonucu: slayt başına tek fikir, büyük okunur
 * başlık, her slaytta bir görsel ipucu, açık/koyu ritim (yorgunluğu önler), net ilerleme göstergesi ve "kaydır" çağrısı.
 *
 * İÇERİK: Metin yazının kendi cümlesidir; görsel yalnız SÜSTÜR (konuyla ilgili simgeler). Simge, slayt metnindeki
 * anahtar köklerden seçilir — uydurma bilgi, rakam ya da özellik eklenmez.
 *
 * RİTİM: tek sıralı slaytlar açık, çift sıralılar koyu zeminde; kapanış her zaman koyu. Vurgu rengi yazının kendi rengidir.
 */

import { ICON, icon } from "./cover-designs.mjs";
import { palFor } from "./heroes.mjs";

export const W = 1080;
export const H = 1350;
const M = 84;
const NAVY = "#0B2A57";
const AMBER = "#ffc21a";

/** Slayt metninden simge seçimi: ilk eşleşen kural kazanır (Türkçe kökler, küçük harf). */
const ICON_RULES = [
  [/şifre|parola|kilit/, "lock"],
  [/gizli|güven|koru|kişisel|kvkk|hassas|sızdır|paylaşım/, "shield"],
  [/sıkıştır|küçült|boyut|\bmb\b|kalite/, "compress"],
  [/birleştir|tek pdf|toplu/, "merge"],
  [/bölerek|bölün|bölme|ayır|parçala/, "split"],
  [/metin|yazı|okunab|okunmaz|seçilebil/, "text"],
  [/tara|kamera|çek|ışık|gölge|kenar/, "scan"],
  [/fotoğraf|resim|görsel|jpg|png|logo|ekran görüntüsü/, "image"],
  [/ara(ma|nabilir|n)?\b|bul|anahtar|ocr|okuy/, "search"],
  [/e-posta|mail|gönder|ilet/, "mail"],
  [/sil|kaldır|temizle|çıkar/, "eraser"],
  [/tablo|excel|sütun|satır|hücre/, "table"],
  [/imza|onay|doldur|yaz|düzenle|değiştir/, "edit"],
  [/telefon|mobil|bilgisayar|ekran|cihaz|tarayıcı/, "monitor"],
  [/dil|çeviri|yabancı|ingilizce|uluslararası/, "globe"],
  [/dönüştür|word|biçim|format/, "word"],
  [/döndür|ters|yön/, "rotate"],
  [/liste|madde|sıra|numara|kontrol/, "list"],
  [/arşiv|klasör|dosya|sakla|yedek/, "archive"],
  [/ayar|araç|seçenek/, "tool"],
  [/katman|şablon|düzen|tasarım|yerleşim|başlık/, "layers"],
  [/doğru|hata|uyum|geçer|başarı|eksiksiz/, "check"],
  [/ipucu|öneri|fikir|dikkat|unutma/, "bulb"],
  [/cv|özgeçmiş|iş ilanı|başvuru/, "cv"],
];
// Kısa kökler kelimenin ORTASINDA eşleşmesin ("gerçekten" → "çek"): her kural kelime başına bağlanır.
for (const r of ICON_RULES) r[0] = new RegExp(`(?<![\p{L}])(?:${r[0].source})`, "u");
const FALLBACK = ["bulb", "check", "layers", "list", "shield", "search", "tool", "text"];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);

/** Slayt için ana + iki yan simge adı (hepsi farklı). */
export function iconsFor(slide, avoid = new Set()) {
  const hay = `${slide.title} ${slide.text}`.toLocaleLowerCase("tr");
  const found = [];
  // Başlıktaki kelimeler metindekilerden önce gelir: slaytın asıl konusu başlıktır.
  for (const src of [String(slide.title).toLocaleLowerCase("tr"), hay])
    for (const [re, name] of ICON_RULES) if (re.test(src) && !found.includes(name)) found.push(name);
  const all = [...found];
  let i = hash(hay) % FALLBACK.length;
  while (all.length < 3) {
    const n = FALLBACK[i++ % FALLBACK.length];
    if (!all.includes(n)) all.push(n);
  }
  // Önceki slaytlarda kullanılan ana simge tekrar seçilmez (aynı gönderide hepsi aynı görünmesin).
  const fresh = all.filter((n) => !avoid.has(n));
  const main = fresh[0] ?? all[0];
  const rest = all.filter((n) => n !== main);
  return { main, side: [rest[0], rest[1]] };
}

/** Bir gönderinin tüm içerik slaytları için simge planı (ardışık tekrar yok). */
export function planIcons(slides) {
  const used = new Set();
  return slides.map((s) => {
    const ic = iconsFor(s, used);
    used.add(ic.main);
    return ic;
  });
}

const plus = (x, y, s, color, op = 1) =>
  `<path d="M${x - s} ${y}h${2 * s}M${x} ${y - s}v${2 * s}" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-opacity="${op}"/>`;
const dot = (x, y, r, color, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="${op}"/>`;

/** Üst görsel alanı: büyük hayalet numara, daire, eğik kart içinde ana simge, yan rozetler, süs şekilleri. */
function scene({ pal, dark, number, ic, index, bold, measure, textPath }) {
  const cx = 540, cy = 410;
  const ink = dark ? "#fff" : NAVY;
  const ghost = dark ? "#ffffff" : pal.a;
  const rot = index % 2 === 0 ? -6 : 6;
  const [s1, s2] = ic.side;
  return `
  <path d="${textPath(bold, number, 400, W - M + 10 - measure(bold, number, 400), 470)}" fill="${ghost}" fill-opacity="${dark ? 0.07 : 0.09}"/>
  <circle cx="${cx}" cy="${cy}" r="236" fill="${dark ? pal.a : pal.t}" fill-opacity="${dark ? 0.35 : 1}"/>
  <circle cx="${cx}" cy="${cy}" r="236" fill="none" stroke="${pal.m}" stroke-width="3" stroke-dasharray="4 16" stroke-linecap="round" stroke-opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="168" fill="${dark ? pal.d : "#ffffff"}" fill-opacity="${dark ? 0.9 : 0.85}"/>
  <g transform="rotate(${rot} ${cx} ${cy})">
    <rect x="${cx - 124}" y="${cy - 124}" width="248" height="248" rx="56" fill="#000" fill-opacity="0.16" transform="translate(0 14)"/>
    <rect x="${cx - 124}" y="${cy - 124}" width="248" height="248" rx="56" fill="${dark ? "#ffffff" : pal.a}"/>
    ${icon(ic.main, cx - 80, cy - 80, 160, dark ? pal.d : "#ffffff", 2)}
  </g>
  <g>
    <circle cx="${cx - 214}" cy="${cy + 140}" r="58" fill="${AMBER}"/>
    ${icon(s1, cx - 214 - 30, cy + 140 - 30, 60, NAVY, 2.2)}
    <circle cx="${cx + 214}" cy="${cy - 150}" r="52" fill="${dark ? pal.m : pal.d}"/>
    ${icon(s2, cx + 214 - 27, cy - 150 - 27, 54, "#ffffff", 2.2)}
  </g>
  ${plus(150, 210, 20, pal.m, dark ? 0.9 : 1)}${plus(930, 640, 18, AMBER)}${plus(210, 640, 14, pal.m, 0.8)}
  ${dot(120, 330, 10, AMBER)}${dot(960, 250, 9, pal.m)}${dot(880, 560, 7, ink, 0.25)}${dot(300, 160, 7, ink, 0.18)}`;
}

/** İlerleme noktaları (geçerli olan uzun hap) + isteğe bağlı "Kaydır" düğmesi. */
function footer({ total, index, pal, dark, swipe, measure, bold, textPath, last }) {
  const y = 1268;
  const on = dark ? AMBER : pal.a;
  const off = dark ? "#ffffff" : NAVY;
  let x = M;
  const dots = [];
  for (let i = 0; i < total; i++) {
    const cur = i === index;
    const w = cur ? 44 : 14;
    dots.push(`<rect x="${x}" y="${y}" width="${w}" height="14" rx="7" fill="${cur ? on : off}" fill-opacity="${cur ? 1 : 0.22}"/>`);
    x += w + 10;
  }
  if (last || !swipe) return dots.join("");
  const sw = measure(bold, swipe, 30);
  const bw = sw + 44 + 62;
  const bx = W - M - bw;
  return `${dots.join("")}
  <g><rect x="${bx}" y="${y - 28}" width="${bw}" height="70" rx="35" fill="${AMBER}"/></g>
  <path d="${textPath(bold, swipe, 30, bx + 30, y + 17)}" fill="${NAVY}"/>
  <path d="M${bx + 30 + sw + 16} ${y + 7} h28 m-10 -10 l10 10 l-10 10" fill="none" stroke="${NAVY}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/**
 * Bir içerik slaydı. `fit` ve `lines` yardımcıları çağıran dosyadan gelir (yazı ölçümü orada).
 * Dönüş: SVG metni (1080×1350). Logo çağıran tarafından sol üste bindirilir.
 */
export function visualStepSvg({ slide, index, count, total, accent, label, fonts, tools, icons }) {
  const { bold, regular } = fonts;
  const { fitBlock, linesToPath, spaced, measure, textPath, wrap } = tools;
  const pal = palFor(accent);
  const dark = index % 2 === 0; // index: 1 tabanlı içerik sırası → 1 açık, 2 koyu, 3 açık…
  const bg = dark ? `url(#bgDark)` : "#ffffff";
  const ink = dark ? "#ffffff" : NAVY;
  const sub = dark ? "#cbd5e1" : "#475569";
  const ic = icons ?? iconsFor(slide);
  const number = String(index).padStart(2, "0");

  const t = fitBlock(bold, slide.title, W - M * 2, 3, 80, 50);
  const tlh = t.size * 1.16;
  const blh0 = 1.42;

  const labelText = label.toUpperCase();
  const lab = spaced(bold, labelText, 24, 0, 0, 4);
  const pillW = lab.width + 56;
  const labY = 728;
  const titleFirst = labY + 70 + 62 + t.size * 0.85 - 30;
  // Metin, altbilgiye (y≈1215) değmeden sığana kadar küçülür.
  const bodyTop = titleFirst + 30 + (t.lines.length - 1) * tlh + 46;
  let body = { size: 34, lines: wrap(regular, slide.text, 34, W - M * 2) };
  for (let size = 46; size >= 34; size -= 2) {
    const lines = wrap(regular, slide.text, size, W - M * 2);
    if (bodyTop + size * 0.85 + (lines.length - 1) * size * blh0 + size * 0.3 <= 1210) {
      body = { size, lines };
      break;
    }
  }
  const blh = body.size * blh0;
  const bodyFirst = bodyTop - 30 + body.size * 0.85;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bgDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12376f"/><stop offset="1" stop-color="#081a3a"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect width="${W}" height="12" fill="${dark ? AMBER : pal.a}"/>
  ${scene({ pal, dark, number, ic, index, bold, measure, textPath })}
  <rect x="${M}" y="${labY}" width="${pillW}" height="58" rx="29" fill="${dark ? AMBER : pal.a}"/>
  <path d="${spaced(bold, labelText, 24, M + 28, labY + 38, 4).d}" fill="${dark ? NAVY : "#ffffff"}"/>
  <path d="${linesToPath(bold, t.lines, t.size, M, titleFirst + 30, tlh)}" fill="${ink}"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyFirst + 30, blh)}" fill="${sub}"/>
  ${footer({ total, index, pal, dark, swipe: tools.swipe, measure, bold, textPath, last: false })}
</svg>`;
}

/** Kapanış slaytı: koyu zemin, büyük çağrı, araç adresi kutusu. */
export function visualCtaSvg({ accent, total, fonts, tools, copy, target }) {
  const { bold, regular } = fonts;
  const { fitBlock, linesToPath, measure, textPath } = tools;
  const pal = palFor(accent);
  const t = fitBlock(bold, copy.ctaTitle, W - M * 2, 3, 84, 56);
  const tlh = t.size * 1.14;
  const titleFirst = 470 + t.size * 0.85;
  const body = fitBlock(regular, copy.ctaBody, W - M * 2 - 20, 4, 38, 30);
  const blh = body.size * 1.42;
  const bodyFirst = titleFirst + (t.lines.length - 1) * tlh + 58 + body.size * 0.85;
  const boxY = Math.round(bodyFirst + (body.lines.length - 1) * blh + 64);
  let linkSize = 64;
  while (linkSize > 32 && measure(bold, target, linkSize) > W - M * 2 - 120) linkSize -= 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bgDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12376f"/><stop offset="1" stop-color="#081a3a"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bgDark)"/>
  <rect width="${W}" height="12" fill="${AMBER}"/>
  <circle cx="${W - 80}" cy="300" r="250" fill="${pal.a}" fill-opacity="0.28"/>
  <circle cx="${W - 80}" cy="300" r="170" fill="${pal.m}" fill-opacity="0.22"/>
  ${plus(210, 250, 20, AMBER)}${plus(880, 640, 16, pal.m)}${dot(150, 380, 10, pal.m)}${dot(960, 150, 9, AMBER)}
  <g transform="rotate(6 ${W - 190} 300)"><rect x="${W - 310}" y="180" width="240" height="240" rx="54" fill="${AMBER}"/>${icon("check", W - 310 + 50, 180 + 50, 140, NAVY, 2.6)}</g>
  <path d="${linesToPath(bold, t.lines, t.size, M, titleFirst, tlh)}" fill="#ffffff"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyFirst, blh)}" fill="#cbd5e1"/>
  <rect x="${M}" y="${boxY}" width="${W - M * 2}" height="190" rx="28" fill="#ffffff"/>
  <path d="${textPath(regular, copy.ctaTry, 30, M + 46, boxY + 66)}" fill="#64748b"/>
  <path d="${textPath(bold, target, linkSize, M + 46, boxY + 148)}" fill="${NAVY}"/>
  ${footer({ total, index: total - 1, pal, dark: true, swipe: "", measure, bold, textPath, last: true })}
</svg>`;
}
