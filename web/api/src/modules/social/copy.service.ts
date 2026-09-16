/**
 * Gönderi metinlerini yapay zekâ ile üretir.
 *
 * Tek istekte TÜM platformların metni birlikte üretilir: hem ucuz (yazı bir kez
 * okunur) hem de metinler birbirini tekrar etmez. Model yanıt veremezse veya
 * biçimi bozarsa şablon yedeğine düşülür — otomasyon asla metinsiz kalmaz.
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
Görevin, verilen blog yazısı için her sosyal ağa AYRI, o ağın diline uygun bir gönderi metni yazmak.

Kurallar:
- Tıklama isteği uyandır: yazının somut faydasını söyle, başlığı olduğu gibi kopyalama.
- Abartı ve tıklama tuzağı yok. Emoji en fazla bir tane, gerekliyse.
- TÜRKÇE, Türk bir metin yazarının elinden çıkmış gibi olmalı. En sık hata, İngilizce cümle
  yapısını Türkçe kelimelerle kurmaktır. Şart cümlesiyle soruyu birleştirme, sıfatı fiilden
  ayırma, gereksiz "hep/hâlâ/artık" ekleme.
  KÖTÜ: "PDF'deki tabloyu ekran görüntüsüyle almaya çalışıyorsanız hep bulanık çıkıyor mu?"
  İYİ:  "Ekran görüntüsüyle aldığınız tablolar bulanık mı çıkıyor?"
  KÖTÜ: "Kesit alma bambaşka bir yöntem — ve gerçekten işe yarıyor."
  İYİ:  "PDF'ten kesit almak ekran görüntüsünden farklı çalışır: görüntü kalitesi bozulmaz."
- Soru cümlesi kurma zorunluluğun yok. Düz bir tespit çoğu zaman daha güçlü.
- Kısa çizgi (—) ile cümleyi ikiye bölmeyi alışkanlık hâline getirme; en fazla bir gönderide kullan.
- İngilizce yazarken de metin o dilde DOĞRUDAN yazılmış gibi olmalı; Türkçeden çeviri gibi durmasın.
- Aynı yazı için her ağa AYRI açılış cümlesi yaz. İki ağın metni aynı kalıpla başlıyorsa
  (aynı soru, aynı kurulum) biri değiştirilmeli — akışta yan yana görülüyorlar.
- ETİKET YAZMA. Hiçbir yere "#" koyma. Etiketleri sistem, doğrulanmış terim listesinden
  kendisi ekleyecek — böylece yazımları her gönderide aynı olur.
- Bağlantıyı yalnızca senden istendiği platformda, metnin sonunda (etiketlerden önce) ver.
- Karakter sınırını ASLA aşma. Sınır, iki dilli gönderilerde İKİ BLOĞUN TOPLAMI için geçerlidir.

Yanıtı YALNIZCA şu JSON biçiminde ver, başka hiçbir şey yazma:
{"X":"...","LINKEDIN":"...","FACEBOOK":"...","INSTAGRAM":"...","PINTEREST":"..."}`;

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

export function toHashtag(term: string): string {
  const cleaned = term.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!cleaned) return "";
  const joined = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      // "pdf" → "PDF": kısaltmanın küçük harfle yazılması etiketi amatör gösterir.
      ACRONYMS.has(w.toLocaleLowerCase("tr"))
        ? w.toLocaleUpperCase("tr")
        : `${w.charAt(0).toLocaleUpperCase("tr")}${w.slice(1)}`,
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
export function sanitizeHashtags(text: string): string {
  return text.replace(/#[^\s#]+/gu, (token) => toHashtag(token.slice(1)) || "");
}

/** Bir blok için etiket dizesi (doğrulanmış terimlerden, sabit yazımla). */
function tagsFor(side: LangSide, count: number): string {
  return side.terms.slice(0, count).map(toHashtag).filter(Boolean).join(" ");
}

/**
 * Etiketlerin kaplayacağı yer. Modele verilen karakter bütçesinden düşülür ki
 * etiketler eklenince sınır aşılmasın ve gövde sondan kırpılmasın.
 */
function hashtagRoom(req: CopyRequest, platform: SocialPlatform): number {
  const spec = PLATFORM_SPECS[platform];
  return sidesFor(req, platform).reduce(
    (sum, side) => sum + tagsFor(side, spec.hashtagCount).length + 2,
    0,
  );
}

/**
 * Modelin yazdığı gövdeye etiketleri ekler.
 *
 * NEDEN KODDA: Etiketleri model yazdığında yazımları her gönderide değişiyordu
 * ("#Extracttablefrompdf", "#PDFkesitAlma"). Terim listesi zaten elimizde;
 * buradan üretilince yazım her seferinde aynı ve dil bloğuyla eşleşiyor.
 */
function appendHashtags(body: string, req: CopyRequest, platform: SocialPlatform): string {
  const spec = PLATFORM_SPECS[platform];
  const sides = sidesFor(req, platform);
  // Modelin yine de yazdığı etiket varsa ayıklanır; tek kaynak biz olalım.
  const blocks = body.split(LANG_SEPARATOR).map((b) => b.replace(/#[^\s#]+/gu, "").trimEnd());

  // Bloğun dili SIRAYA GÖRE DEĞİL, içindeki bağlantıdan bulunur: model istenen
  // sırayı bazen bozuyor (bir gönderide İngilizce, diğerinde Türkçe öne
  // geçiyordu) ve sıraya güvenilirse etiketler yanlış dile ekleniyor.
  const identify = (block: string): LangSide | undefined =>
    sides.find((side) => side.link && block.includes(side.link));

  const ordered = sides
    .map((side) => {
      const match = blocks.find((b) => b.includes(side.link));
      return { side, block: match };
    })
    .filter((x): x is { side: LangSide; block: string } => typeof x.block === "string");

  // Her blok tanınabildiyse istenen sıraya (önce İngilizce) dizilir.
  const pairs =
    ordered.length === blocks.length && blocks.length === sides.length
      ? ordered
      : blocks.map((block, i) => ({ side: identify(block) ?? sides[i] ?? sides[0], block }));

  return pairs
    .map(({ side, block }) => {
      if (!side) return block;
      const tags = tagsFor(side, spec.hashtagCount);
      return tags ? `${block}
${tags}` : block;
    })
    .join(LANG_SEPARATOR);
}

/** Bir dilin metin parçaları — çift dilli gönderinin yarısı. */
type LangSide = { lang: "tr" | "en"; title: string; summary: string; link: string; terms: string[] };

/** Bir dil için şablon bloğu (model kullanılamadığında). */
function fallbackBlock(side: LangSide, room: number, withLink: boolean, tagCount: number): string {
  const tags = side.terms.slice(0, tagCount).map(toHashtag).filter(Boolean).join(" ");
  const link = withLink ? `\n\n${side.link}` : "";
  const tail = `${link}${tags ? `\n\n${tags}` : ""}`;
  const lead = side.summary ? `${side.title}\n\n${side.summary}` : side.title;
  return `${truncateWords(lead, Math.max(40, room - tail.length))}${tail}`;
}

/** Model kullanılamadığında devreye giren sade şablon. */
function fallbackBody(sides: LangSide[], platform: SocialPlatform): string {
  const spec = PLATFORM_SPECS[platform];
  const per = Math.floor(spec.maxChars / sides.length);
  return sides
    .map((side) => fallbackBlock(side, per, spec.inlineLink, spec.hashtagCount))
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
export async function writePostBodies(req: CopyRequest): Promise<Record<SocialPlatform, string>> {
  const result = {} as Record<SocialPlatform, string>;
  for (const p of ALL_PLATFORMS) result[p] = fallbackBody(sidesFor(req, p), p);

  if (!isAiConfigured() || req.platforms.length === 0) return result;

  const brief = req.platforms
    .map((p) => {
      const spec = PLATFORM_SPECS[p];
      const sides = sidesFor(req, p);
      const langs =
        sides.length > 1
          ? `İKİ DİLLİ — önce İngilizce bloğu, sonra "${LANG_SEPARATOR.trim()}" ayıracı, sonra Türkçe bloğu. Her blok kendi dilinde özgün yazılsın, çeviri olmasın.`
          : `TEK DİLLİ — ${sides[0]?.lang === "en" ? "İngilizce" : "Türkçe"}.`;
      // Etiketler sonradan eklendiği için modele bırakılan yer payı düşülür.
      const room = spec.maxChars - hashtagRoom(req, p);
      return `- ${p}: en fazla ${room} karakter (toplam), bağlantı ${
        spec.inlineLink ? "her blokta KENDİ dilinin adresi olacak" : "EKLENMESİN (ayrı alanda gidiyor)"
      }. ${langs}`;
    })
    .join("\n");

  const { item, keywords } = req;
  const prompt = `Blog yazısı — Türkçe hâli:
Başlık: ${item.lang === "tr" ? item.title : (item.alt?.title ?? "(yok)")}
Özet: ${item.lang === "tr" ? item.summary : (item.alt?.summary ?? "(yok)")}
Adres: ${item.lang === "tr" ? item.link : (item.alt?.link ?? "(yok)")}

Blog yazısı — İngilizce hâli:
Başlık: ${item.lang === "en" ? item.title : (item.alt?.title ?? "(yok)")}
Özet: ${item.lang === "en" ? item.summary : (item.alt?.summary ?? "(yok)")}
Adres: ${item.lang === "en" ? item.link : (item.alt?.link ?? "(yok)")}

DOĞRULANMIŞ TERİMLER — etiketler yalnızca bunlardan türetilecek:
Türkçe: ${keywords.tr.join(", ") || "(yok)"}
İngilizce: ${keywords.en.join(", ") || "(yok)"}

İstenen platformlar ve kuralları:
${brief}`;

  let raw: string;
  try {
    raw = await callClaude(SYSTEM, [{ role: "user", content: prompt }], 3000);
  } catch {
    // Model erişilemedi → şablon metinler kalır, otomasyon durmaz.
    return result;
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) return result;

  for (const p of req.platforms) {
    const value = parsed[p];
    if (typeof value === "string" && value.trim().length > 0) {
      const withTags = appendHashtags(value.trim(), req, p);
      result[p] = clamp(sanitizeHashtags(withTags), PLATFORM_SPECS[p].maxChars);
    }
  }
  return result;
}
