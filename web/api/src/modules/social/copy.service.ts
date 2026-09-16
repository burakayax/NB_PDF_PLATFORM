/**
 * Gönderi metinlerini yapay zekâ ile üretir.
 *
 * TEK METİN, HER AĞDA AYNI: Model ağ başına ayrı metin yazmaz; dil başına iki
 * uzunluk üretir. Uzun metin Facebook, Instagram ve LinkedIn'de aynen kullanılır,
 * kısa metin X ve Pinterest'te. Ağ başına yazdırmak hem tutarsız metinler
 * üretiyordu (aynı yazı her ağda başka türlü anlatılıyordu) hem de gereksiz
 * maliyetti. Model yanıt veremezse şablon yedeğine düşülür — otomasyon asla
 * metinsiz kalmaz.
 *
 * BAĞLANTI VE ETİKET MODELDEN GELMEZ: ikisini de kod ekler. Yazımları böylece
 * her gönderide aynı, dil bloğuyla eşleşmesi kesin.
 *
 * ÇİFT DİL: Metin ÇEVİRİLMEZ. Blog yazısının Türkçesi de İngilizcesi de sitede
 * ayrı ayrı yazılmış özgün metinler; modele ikisini birden verip her dil için o
 * dilin kendi gönderi metnini yazdırıyoruz. Makine çevirisinin o "sıradan"
 * tonu bu yüzden oluşmuyor.
 */

import { callClaude } from "../ai/ai.service.js";
import { isAiConfigured } from "../ai/ai.service.js";
import { ALL_PLATFORMS, PLATFORM_SPECS } from "./social.types.js";
import type { FeedItem } from "./social.types.js";
import type { KeywordSet } from "./keywords.service.js";
import type { SocialPlatform } from "@prisma/client";

/** İki dilli gönderide blokları ayıran çizgi. */
const LANG_SEPARATOR = "\n\n— — —\n\n";

const SYSTEM = `Sen bir SaaS ürününün sosyal medya editörüsün. Ürün: çevrimiçi PDF araçları platformu.
Görevin, verilen blog yazısı için AYNI metnin iki uzunlukta ve iki dilde hâlini yazmak.

NEDEN TEK METİN: Aynı yazı için her ağa farklı metin yazmak tutarsızlık üretiyordu; insanlar
aynı markayı birden çok ağda takip ediyor. Uzun metin Facebook, Instagram ve LinkedIn'de
AYNEN kullanılır; kısa metin X ve Pinterest'te.

Kurallar:
- Tıklama isteği uyandır: yazının somut faydasını söyle, başlığı olduğu gibi kopyalama.
- Abartı ve tıklama tuzağı yok. Emoji en fazla bir tane, gerekliyse.
- TÜRKÇE, Türk bir metin yazarının elinden çıkmış gibi olmalı. En sık hata, İngilizce cümle
  yapısını Türkçe kelimelerle kurmaktır. Zorlama deyim ve kalıp arama.
  KÖTÜ: "PDF'deki tabloyu ekran görüntüsüyle almaya çalışıyorsanız hep bulanık çıkıyor mu?"
  KÖTÜ: "Ekran görüntüsüyle aldığınız tabloların bulanıklığından sıkılmış mısınız?"
  İYİ:  "Ekran görüntüsüyle aldığınız tablolar bulanık çıkıyor."
- Soru cümlesi kurma zorunluluğun yok. Düz bir tespit çoğu zaman daha güçlü.
- Kısa çizgi (—) ile cümle bölme: en fazla bir kez, o da gerçekten gerekliyse.
- İngilizce metin o dilde DOĞRUDAN yazılmış gibi olmalı; Türkçenin çevirisi olmasın.
  İki dil aynı şeyi anlatır ama cümle cümle birbirinin karşılığı olmak zorunda değil.
- ETİKET YAZMA, BAĞLANTI YAZMA. "#" ve adres koyma — ikisini de sistem ekleyecek.
- Karakter sınırlarını ASLA aşma.

Yanıtı YALNIZCA şu JSON biçiminde ver, başka hiçbir şey yazma:
{"LONG_EN":"...","LONG_TR":"...","SHORT_EN":"...","SHORT_TR":"..."}`;

/** Modelin bazen eklediği ```json çitlerini ve ön/arka gevezeliği ayıklar. */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const URL_PATTERN = /https?:\/\/\S+/;
/** Metin içindeki TÜM adresleri ayıklamak için (bağlantıyı sistem ekliyor). */
const URL_PATTERN_GLOBAL = /https?:\/\/\S+/gu;
/** Metnin sonunda yarım kalmış bir adres var mı? */
const TRAILING_URL_PATTERN = /\s*https?:\/\/\S*$/;

/** Sınırı aşan metni kelime sınırında keser; yarım kalan adresi tamamen atar. */
function truncateWords(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut)
    // Yarım adres hem tıklanmaz hem de yanlış bir sayfaya işaret edebilir.
    .replace(TRAILING_URL_PATTERN, "")
    .replace(/[\s.,;:]+$/, "");
  return `${base}…`;
}

/**
 * Gönderiyi karakter sınırına sığdırır.
 *
 * KURAL: Kısaltma SONDAN değil, GÖVDEDEN yapılır. Metnin sonundaki bağlantı ve
 * etiket blokları gönderinin işlevsel parçası — düz kısaltma bağlantıyı yarıda
 * kesip tıklanamaz hâle getirir, etiketleri de yok eder.
 */
export function clamp(text: string, max: number): string {
  const t = text.trim().replace(/\n{3,}/g, "\n\n");
  if (t.length <= max) return t;

  const blocks = t.split(/\n{2,}/);
  const tail: string[] = [];
  while (blocks.length > 1) {
    const last = blocks[blocks.length - 1] ?? "";
    const isTail = URL_PATTERN.test(last) || last.trimStart().startsWith("#");
    if (!isTail) break;
    tail.unshift(blocks.pop() as string);
  }

  const tailText = tail.length > 0 ? `\n\n${tail.join("\n\n")}` : "";
  // Kuyruk tek başına sınırı aşıyorsa koruyacak bir şey kalmadı: düz kes.
  if (tailText.length >= max) return truncateWords(t, max);

  return `${truncateWords(blocks.join("\n\n"), max - tailText.length)}${tailText}`;
}

/**
 * Terimi geçerli bir etikete çevirir.
 *
 * Türkçe harfler KORUNUR: Instagram, X, Facebook ve Pinterest Unicode etiketi
 * destekliyor ve Türk kullanıcı "#PDFKırpma" arıyor, "#PdfKirpma" değil.
 * Yalnızca etiket içinde geçersiz olan karakterler (boşluk, noktalama, emoji)
 * ayıklanır.
 */
const ACRONYMS = new Set(["pdf", "ocr", "jpg", "jpeg", "png", "api", "ai", "kvkk", "gdpr", "url", "qr"]);

export function toHashtag(term: string, lang: "tr" | "en" = "tr"): string {
  // Yerel ayar önemli: Türkçe kuralında "i" harfi "İ" olur. İngilizce bir
  // terime Türkçe kural uygulanırsa "#CropPDFİmage" gibi bozuk etiket çıkar.
  const upper = (w: string) => w.toLocaleUpperCase(lang === "tr" ? "tr" : "en");
  const cleaned = term.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!cleaned) return "";
  const joined = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      // "pdf" → "PDF": kısaltmanın küçük harfle yazılması etiketi amatör gösterir.
      ACRONYMS.has(w.toLocaleLowerCase("en"))
        ? upper(w)
        : `${upper(w.charAt(0))}${w.slice(1)}`,
    )
    .join("");
  // Rakamla başlayan etiket birçok ağda geçersiz sayılır.
  return /^\p{L}/u.test(joined) ? `#${joined}` : "";
}

/**
 * Modelin kendi yazdığı etiketleri de aynı kurala sokar.
 *
 * NEDEN: Model etiketi bazen boşluklu, noktalamalı ya da yarım bırakıyor;
 * bu hâliyle paylaşılan etiket platformda tıklanamaz bir metne dönüşüyor.
 * Metin içindeki her "#..." parçası burada yeniden kurulur.
 */
export function sanitizeHashtags(text: string, lang: "tr" | "en" = "tr"): string {
  return text.replace(/#[^\s#]+/gu, (token) => toHashtag(token.slice(1), lang) || "");
}

/** Bir blok için etiket dizesi (doğrulanmış terimlerden, sabit yazımla). */
function tagsFor(side: LangSide, count: number): string {
  return side.terms.slice(0, count).map((t) => toHashtag(t, side.lang)).filter(Boolean).join(" ");
}

/** Bir dilin metin parçaları — çift dilli gönderinin yarısı. */
type LangSide = { lang: "tr" | "en"; title: string; summary: string; link: string; terms: string[] };

/** Bir dil için şablon bloğu (model kullanılamadığında). */
function fallbackBlock(
  side: LangSide,
  room: number,
  style: "url" | "bio" | "none",
  tagCount: number,
): string {
  const tags = side.terms.slice(0, tagCount).map((t) => toHashtag(t, side.lang)).filter(Boolean).join(" ");
  const linkText = linkLine(side, style);
  const link = linkText ? `\n\n${linkText}` : "";
  const tail = `${link}${tags ? `\n\n${tags}` : ""}`;
  const lead = side.summary ? `${side.title}\n\n${side.summary}` : side.title;
  return `${truncateWords(lead, Math.max(40, room - tail.length))}${tail}`;
}

/** Model kullanılamadığında devreye giren sade şablon. */
function fallbackBody(sides: LangSide[], platform: SocialPlatform): string {
  const spec = PLATFORM_SPECS[platform];
  const per = Math.floor(spec.maxChars / sides.length);
  return sides
    .map((side) => fallbackBlock(side, per, spec.linkStyle, spec.hashtagCount))
    .join(LANG_SEPARATOR);
}

export type CopyRequest = {
  item: FeedItem;
  platforms: SocialPlatform[];
  keywords: KeywordSet;
  /** Çift dilli yazılsın mı? (Yazının diğer dildeki hâli yoksa yok sayılır.) */
  bilingual: boolean;
  /** Tek dilli platformların (X) dili. */
  singleLang: "tr" | "en";
};

/** Bir gönderide hangi dil(ler) yer alacak? */
function sidesFor(req: CopyRequest, platform: SocialPlatform): LangSide[] {
  const { item, keywords } = req;
  const sideOf = (lang: "tr" | "en"): LangSide => {
    const isPrimary = lang === item.lang;
    return {
      lang,
      title: isPrimary ? item.title : (item.alt?.title ?? item.title),
      summary: isPrimary ? item.summary : (item.alt?.summary ?? item.summary),
      link: isPrimary ? item.link : (item.alt?.link ?? item.link),
      terms: lang === "tr" ? keywords.tr : keywords.en,
    };
  };

  const bilingualPossible = req.bilingual && Boolean(item.alt) && PLATFORM_SPECS[platform].bilingual;
  // Çift dilde İngilizce üstte: uluslararası kitle önce okur, Türkçe altta tam
  // karşılığıyla durur (Make.com'daki düzenin aynısı).
  if (bilingualPossible) return [sideOf("en"), sideOf("tr")];
  return [sideOf(req.singleLang)];
}

/**
 * Yazı için her platformun gönderi metnini üretir.
 * Dönen kayıtta HER platform için bir metin bulunur (model başarısızsa şablon).
 */
/** Uzun metni kullanan ağlar — üçünde de AYNI metin görünür. */
const LONG_FORM: SocialPlatform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN"];

/** Bir platformda tek bir dil bloğuna kalan gövde payı (etiket ve bağlantı düşülmüş). */
function bodyRoom(req: CopyRequest, platform: SocialPlatform): number {
  const spec = PLATFORM_SPECS[platform];
  const sides = sidesFor(req, platform);
  const perBlock = Math.floor(spec.maxChars / Math.max(1, sides.length));
  const side = sides[0];
  const tagLen = side ? tagsFor(side, spec.hashtagCount).length : 0;
  const linkLen = side ? linkLine(side, spec.linkStyle).length : 0;
  // +4: bloğu ayıran satır sonları.
  return Math.max(60, perBlock - tagLen - linkLen - 4);
}

/**
 * Bağlantının bu ağdaki yazılışı.
 *
 * Instagram'da caption içindeki adres TIKLANMIYOR (2026 itibarıyla tıklanabilir
 * bağlantı yalnızca Meta Verified aboneliği olan küçük bir test grubunda).
 * Tam adres yazmak 55 karakter harcayıp kullanıcıdan kopyalamasını beklemek
 * demek; onun yerine Instagram'ın kendi geleneği kullanılıyor: bağlantı
 * profilde, metinde yalnızca alan adı anılıyor.
 */
function linkLine(side: LangSide, style: "url" | "bio" | "none"): string {
  if (style === "none") return "";
  if (style === "url") return side.link;
  let host = "";
  try {
    host = new URL(side.link).host.replace(/^www\./, "");
  } catch {
    return "";
  }
  return side.lang === "tr" ? `Bağlantı profilde: ${host}` : `Link in bio: ${host}`;
}

/** Bir dil bloğunu kurar: gövde + (varsa) bağlantı + etiketler. */
function buildBlock(body: string, side: LangSide, platform: SocialPlatform): string {
  const spec = PLATFORM_SPECS[platform];
  const clean = sanitizeHashtags(body, side.lang)
    .replace(URL_PATTERN_GLOBAL, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  const tags = tagsFor(side, spec.hashtagCount);
  const parts = [clean];
  const link = linkLine(side, spec.linkStyle);
  if (link) parts.push(link);
  if (tags) parts.push(tags);
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Yazı için her platformun gönderi metnini üretir.
 *
 * TASARIM: Model ağ başına ayrı metin YAZMAZ. Dil başına iki uzunluk üretir
 * (uzun ve kısa); uzun metin Facebook, Instagram ve LinkedIn'de aynen kullanılır.
 * Ağ başına yazdırmak hem tutarsız metinler üretiyordu hem de gereksiz maliyetti.
 */
export async function writePostBodies(req: CopyRequest): Promise<Record<SocialPlatform, string>> {
  const result = {} as Record<SocialPlatform, string>;
  for (const p of ALL_PLATFORMS) result[p] = fallbackBody(sidesFor(req, p), p);

  if (!isAiConfigured() || req.platforms.length === 0) return result;

  const wanted = req.platforms;
  const longRoom = Math.min(
    ...wanted.filter((p) => LONG_FORM.includes(p)).map((p) => bodyRoom(req, p)),
    900,
  );
  const shortRoom = Math.min(
    ...wanted.filter((p) => !LONG_FORM.includes(p)).map((p) => bodyRoom(req, p)),
    220,
  );

  const { item, keywords } = req;
  const prompt = `Blog yazısı — Türkçe hâli:
Başlık: ${item.lang === "tr" ? item.title : (item.alt?.title ?? "(yok)")}
Özet: ${item.lang === "tr" ? item.summary : (item.alt?.summary ?? "(yok)")}

Blog yazısı — İngilizce hâli:
Başlık: ${item.lang === "en" ? item.title : (item.alt?.title ?? "(yok)")}
Özet: ${item.lang === "en" ? item.summary : (item.alt?.summary ?? "(yok)")}

Konu terimleri (metinde doğal biçimde geçebilir, zorlama yok):
Türkçe: ${keywords.tr.join(", ") || "(yok)"}
İngilizce: ${keywords.en.join(", ") || "(yok)"}

Uzunluklar:
- LONG_EN ve LONG_TR: en fazla ${Number.isFinite(longRoom) ? longRoom : 900} karakter.
- SHORT_EN ve SHORT_TR: en fazla ${Number.isFinite(shortRoom) ? shortRoom : 220} karakter.`;

  let raw: string;
  try {
    raw = await callClaude(SYSTEM, [{ role: "user", content: prompt }], 2000);
  } catch {
    // Model erişilemedi → şablon metinler kalır, otomasyon durmaz.
    return result;
  }
  const parsed = parseJsonObject(raw);
  if (!parsed) return result;

  const pick = (key: string): string =>
    typeof parsed[key] === "string" ? (parsed[key] as string).trim() : "";
  const bodies = {
    long: { en: pick("LONG_EN"), tr: pick("LONG_TR") },
    short: { en: pick("SHORT_EN"), tr: pick("SHORT_TR") },
  };

  for (const p of req.platforms) {
    const sides = sidesFor(req, p);
    const kind = LONG_FORM.includes(p) ? "long" : "short";
    const blocks = sides.map((side) => {
      const body = bodies[kind][side.lang];
      return body ? buildBlock(body, side, p) : "";
    });
    // Bir dil için metin gelmediyse o platformda şablon korunur.
    if (blocks.some((b) => !b)) continue;
    result[p] = clamp(blocks.join(LANG_SEPARATOR), PLATFORM_SPECS[p].maxChars);
  }
  return result;
}
