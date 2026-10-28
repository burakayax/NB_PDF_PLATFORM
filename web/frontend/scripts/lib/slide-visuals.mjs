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
function heroSlide({ slide, index, count, total, accent, label, fonts, tools, icons }) {
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

/* ───────────────────────── ÇEŞİTLİ ŞABLONLAR (v3) ─────────────────────────
 * Aynı gönderide her slayt farklı görünsün diye beş şablon: simge (hero), büyük rakam (stat), kontrol listesi (list),
 * afiş (poster), alıntı kartı (quote). Seçim `planTemplates` ile slayt metninden yapılır; metin her zaman yazının kendi
 * cümlesidir, şablonlar yalnız sunum biçimidir. */

const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};
const sentences = (t) => String(t).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const STAT_RE = /(%\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:KB|MB|GB|%|sayfa|dakika|dk|saniye|sn|gün|kez|adım|kat|piksel|dpi))/i;

/** Slayt metninden büyük rakam: { num, unit } ya da null. */
export function statOf(slide) {
  const m = STAT_RE.exec(`${slide.title} ${slide.text}`);
  if (!m) return null;
  const raw = m[1].replace(/\s+/g, " ").trim();
  const pct = /^%\s?(\d+(?:[.,]\d+)?)$/.exec(raw);
  if (pct) return { num: pct[1], unit: "%" };
  const mm = /^(\d+(?:[.,]\d+)?)\s?(.*)$/.exec(raw);
  return mm ? { num: mm[1], unit: mm[2] } : null;
}

/** Slayt başına şablon planı: ardışık tekrar yok, büyük rakam varsa öne çıkar. */
export function planTemplates(slides) {
  const order = ["hero", "list", "poster", "quote"];
  const out = [];
  let rot = 0;
  slides.forEach((s, i) => {
    const prev = out[i - 1];
    let t;
    if (statOf(s) && prev !== "stat") t = "stat";
    else {
      for (let k = 0; k < order.length; k++) {
        const c = order[(rot + k) % order.length];
        const titleWords = String(s.title).trim().split(/\s+/).length;
        if (c === prev) continue;
        if (c === "list" && sentences(s.text).length < 2) continue;
        if (c === "poster" && titleWords > 6) continue;
        t = c;
        rot = (rot + k + 1) % order.length;
        break;
      }
      t ??= "hero";
    }
    out.push(t);
  });
  return out;
}

const GRAD = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

/** Sağ üst etiket hapı (ADIM 2/6 vb.). */
function head({ labelText, bold, spaced, fill, textFill, y = 150 }) {
  const lab = spaced(bold, labelText, 24, 0, 0, 4);
  const w = lab.width + 56;
  const x = W - M - w;
  return `<rect x="${x}" y="${y}" width="${w}" height="58" rx="29" fill="${fill}"/><path d="${spaced(bold, labelText, 24, x + 28, y + 38, 4).d}" fill="${textFill}"/>`;
}

/** Gövde metnini [bodyTop, maxBottom] aralığına sığdırır. */
function fitBody(wrap, font, text, maxW, bodyTop, maxBottom, from = 44, to = 34) {
  let body = { size: to, lines: wrap(font, text, to, maxW) };
  for (let size = from; size >= to; size -= 2) {
    const lines = wrap(font, text, size, maxW);
    if (bodyTop + size * 0.85 + (lines.length - 1) * size * 1.42 <= maxBottom) {
      body = { size, lines };
      break;
    }
  }
  return body;
}

/** Büyük rakam: tam renkli zemin, dev rakam + birim, halka süsleri. */
function statSlide({ slide, index, total, accent, label, fonts, tools }) {
  const { bold, regular } = fonts;
  const { fitBlock, linesToPath, spaced, measure, textPath, wrap } = tools;
  const pal = palFor(accent);
  const st = statOf(slide);
  const top = pal.d;
  const bot = mix(pal.d, "#06122b", 0.55);
  let ns = 360;
  while (ns > 150 && measure(bold, st.num, ns) > 560) ns -= 10;
  const nW = measure(bold, st.num, ns);
  const us = Math.round(ns * 0.36);
  const baseY = 590;
  const t = fitBlock(bold, slide.title, W - M * 2, 3, 66, 46);
  const tlh = t.size * 1.16;
  const tFirst = 720 + t.size * 0.85;
  const bodyTop = tFirst + (t.lines.length - 1) * tlh + 40;
  const body = fitBody(wrap, regular, slide.text, W - M * 2, bodyTop, 1205, 42, 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GRAD("g", top, bot)}</defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="12" fill="${AMBER}"/>
  <circle cx="${W - 60}" cy="520" r="330" fill="none" stroke="#fff" stroke-opacity="0.10" stroke-width="3"/>
  <circle cx="${W - 60}" cy="520" r="240" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="3"/>
  <circle cx="${W - 60}" cy="520" r="150" fill="#fff" fill-opacity="0.07"/>
  ${plus(170, 330, 18, AMBER)}${dot(900, 280, 9, AMBER)}${dot(120, 430, 8, "#fff", 0.4)}
  ${head({ labelText: label.toUpperCase(), bold, spaced, fill: "#ffffff", textFill: pal.d })}
  <path d="${textPath(bold, st.num, ns, M, baseY)}" fill="#ffffff"/>
  ${st.unit ? `<path d="${textPath(bold, st.unit, us, M + nW + 24, baseY)}" fill="${AMBER}"/>` : ""}
  <rect x="${M}" y="${baseY + 36}" width="120" height="8" rx="4" fill="${AMBER}"/>
  <path d="${linesToPath(bold, t.lines, t.size, M, tFirst + 20, tlh)}" fill="#ffffff"/>
  <path d="${linesToPath(regular, body.lines, body.size, M, bodyTop + body.size * 0.85 + 20, body.size * 1.42)}" fill="#dbe7ff"/>
  ${footer({ total, index, pal, dark: true, swipe: tools.swipe, measure, bold, textPath, last: false })}
</svg>`;
}

/** Kontrol listesi: başlık + her cümle için onay işaretli kart. */
function listSlide({ slide, index, total, accent, label, fonts, tools }) {
  const { bold, regular } = fonts;
  const { fitBlock, linesToPath, spaced, measure, textPath, wrap } = tools;
  const pal = palFor(accent);
  const items = sentences(slide.text).slice(0, 4);
  const t = fitBlock(bold, slide.title, W - M * 2, 3, 74, 48);
  const tlh = t.size * 1.14;
  const tFirst = 250 + t.size * 0.85;
  const startY = tFirst + (t.lines.length - 1) * tlh + 60;
  const avail = 1195 - startY;
  const gap = 22;
  let size = 48;
  let cards = [];
  for (; size >= 28; size -= 2) {
    cards = items.map((it) => {
      const lines = wrap(regular, it, size, W - M * 2 - 150);
      return { lines, h: Math.max(110, lines.length * size * 1.36 + 50) };
    });
    if (cards.reduce((a, c) => a + c.h, 0) + gap * (cards.length - 1) <= avail) break;
  }
  // Az madde varsa grup, boş alanın üst üçte birine oturur (altta büyük boşluk kalmasın).
  const used = cards.reduce((a, c) => a + c.h, 0) + gap * (cards.length - 1);
  let y = startY + Math.max(0, (avail - used) * 0.35);
  const body = cards
    .map((c, i) => {
      const cy = y;
      y += c.h + gap;
      const lines = linesToPath(regular, c.lines, size, M + 128, cy + 25 + size * 0.88, size * 1.36);
      return `<rect x="${M}" y="${cy + 8}" width="${W - M * 2}" height="${c.h}" rx="26" fill="#0B2A57" fill-opacity="0.10"/>
    <rect x="${M}" y="${cy}" width="${W - M * 2}" height="${c.h}" rx="26" fill="#ffffff"/>
    <circle cx="${M + 62}" cy="${cy + c.h / 2}" r="34" fill="${i % 2 ? AMBER : pal.a}"/>
    ${icon("check", M + 62 - 19, cy + c.h / 2 - 19, 38, i % 2 ? NAVY : "#ffffff", 3.4)}
    <path d="${lines}" fill="${NAVY}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${mix(pal.t, "#ffffff", 0.35)}"/><rect width="${W}" height="12" fill="${pal.a}"/>
  <circle cx="${W}" cy="60" r="260" fill="${pal.t}"/>${plus(900, 330, 16, pal.m)}${dot(780, 120, 9, AMBER)}
  ${head({ labelText: label.toUpperCase(), bold, spaced, fill: pal.a, textFill: "#ffffff", y: 148 })}
  <path d="${linesToPath(bold, t.lines, t.size, M, tFirst, tlh)}" fill="${NAVY}"/>
  ${body}
  ${footer({ total, index, pal, dark: false, swipe: tools.swipe, measure, bold, textPath, last: false })}
</svg>`;
}

/** Afiş: dev başlık, sarı işaretleyici bantlar (kapakla aynı dil), altında kısa metin, köşede simge çıkartması. */
function posterSlide({ slide, index, total, accent, label, fonts, tools, icons }) {
  const { bold, regular } = fonts;
  const { fitBlock, spaced, measure, textPath, wrap } = tools;
  const pal = palFor(accent);
  const t = fitBlock(bold, slide.title.toLocaleUpperCase("tr"), W - M * 2 - 20, 4, 104, 60);
  const lh = t.size * 1.3;
  const first = 520;
  const bands = t.lines
    .map((ln, i) => {
      const w = measure(bold, ln, t.size) + 44;
      const y = first + i * lh - t.size * 0.98;
      const rot = `rotate(-1.4 ${M} ${y})`;
      return `<rect x="${M - 22}" y="${y}" width="${w}" height="${t.size * 1.18}" rx="14" fill="${i % 2 ? "#ffffff" : AMBER}" transform="${rot}"/>
    <path d="${textPath(bold, ln, t.size, M, first + i * lh)}" fill="${i % 2 ? pal.a : NAVY}" transform="${rot}"/>`;
    })
    .join("");
  const bodyTop = first + (t.lines.length - 1) * lh + 110;
  const body = fitBody(wrap, regular, slide.text, W - M * 2, bodyTop, 1200, 44, 34);
  const bodyPath = body.lines.map((l, i) => textPath(regular, l, body.size, M, bodyTop + body.size * 0.85 + i * body.size * 1.42)).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GRAD("g", "#12376f", "#081a3a")}</defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="12" fill="${AMBER}"/>
  <circle cx="${W - 40}" cy="${H - 140}" r="300" fill="${pal.a}" fill-opacity="0.22"/>
  <g transform="rotate(8 ${W - 190} 300)"><rect x="${W - 310}" y="190" width="220" height="220" rx="50" fill="${pal.m}"/>${icon(icons.main, W - 310 + 45, 190 + 45, 130, NAVY, 2.2)}</g>
  ${plus(150, 290, 18, AMBER)}${dot(520, 240, 8, "#fff", 0.35)}${dot(960, 620, 9, AMBER)}
  ${head({ labelText: label.toUpperCase(), bold, spaced, fill: AMBER, textFill: NAVY, y: 148 })}
  ${bands}
  <path d="${bodyPath}" fill="#cfdcf5"/>
  ${footer({ total, index, pal, dark: true, swipe: tools.swipe, measure, bold, textPath, last: false })}
</svg>`;
}

/** Alıntı kartı: renkli degrade zemin, dev tırnak, büyük cümle, alt köşede simge. */
function quoteSlide({ slide, index, total, accent, label, fonts, tools, icons }) {
  const { bold } = fonts;
  const { fitBlock, linesToPath, spaced, measure, textPath, wrap } = tools;
  const pal = palFor(accent);
  const top = pal.a === "#f59e0b" ? pal.d : pal.a;
  const bot = mix(pal.d, "#06122b", 0.5);
  const t = fitBlock(bold, slide.title, W - M * 2 - 40, 2, 56, 40);
  const cardTop = 470;
  const cardBottom = 1130;
  const innerW = W - M * 2 - 90;
  let body = { size: 34, lines: wrap(bold, slide.text, 34, innerW) };
  for (let size = 52; size >= 34; size -= 2) {
    const lines = wrap(bold, slide.text, size, innerW);
    if (lines.length * size * 1.36 <= cardBottom - cardTop - 170) {
      body = { size, lines };
      break;
    }
  }
  const textH = body.lines.length * body.size * 1.36;
  const textTop = cardTop + 120 + Math.max(0, (cardBottom - cardTop - 170 - textH) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${GRAD("g", top, bot)}</defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="12" fill="${AMBER}"/>
  <circle cx="120" cy="${H - 120}" r="280" fill="#fff" fill-opacity="0.06"/>${plus(900, 330, 18, AMBER)}${dot(200, 330, 9, "#fff", 0.5)}
  ${head({ labelText: label.toUpperCase(), bold, spaced, fill: "#ffffff", textFill: pal.d, y: 148 })}
  <path d="${linesToPath(bold, t.lines, t.size, M, 290 + t.size * 0.2, t.size * 1.16)}" fill="#ffffff"/>
  <rect x="${M}" y="${cardTop + 12}" width="${W - M * 2}" height="${cardBottom - cardTop}" rx="40" fill="#000" fill-opacity="0.2"/>
  <rect x="${M}" y="${cardTop}" width="${W - M * 2}" height="${cardBottom - cardTop}" rx="40" fill="#ffffff"/>
  <path d="${textPath(bold, "“", 260, M + 40, cardTop + 230)}" fill="${pal.t}"/>
  <path d="${linesToPath(bold, body.lines, body.size, M + 45, textTop + body.size * 0.9, body.size * 1.36)}" fill="${NAVY}"/>
  <g transform="rotate(-8 ${W - M - 40} ${cardBottom})"><circle cx="${W - M - 40}" cy="${cardBottom}" r="66" fill="${AMBER}"/>${icon(icons.main, W - M - 40 - 34, cardBottom - 34, 68, NAVY, 2.4)}</g>
  ${footer({ total, index, pal, dark: true, swipe: tools.swipe, measure, bold, textPath, last: false })}
</svg>`;
}

/** Şablona göre slayt SVG'si. `template` verilmezse simge (hero) şablonu. */
export function visualStepSvg(args) {
  switch (args.template) {
    case "stat":
      return statSlide(args);
    case "list":
      return listSlide(args);
    case "poster":
      return posterSlide(args);
    case "quote":
      return quoteSlide(args);
    default:
      return heroSlide(args);
  }
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
