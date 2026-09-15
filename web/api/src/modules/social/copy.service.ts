/**
 * Gönderi metinlerini yapay zekâ ile üretir.
 *
 * Tek istekte TÜM platformların metni birlikte üretilir: hem ucuz (yazı bir kez
 * okunur) hem de metinler birbirini tekrar etmez. Model yanıt veremezse veya
 * biçimi bozarsa şablon yedeğine düşülür — otomasyon asla metinsiz kalmaz.
 */

import { callClaude } from "../ai/ai.service.js";
import { isAiConfigured } from "../ai/ai.service.js";
import { ALL_PLATFORMS, PLATFORM_SPECS } from "./social.types.js";
import type { FeedItem } from "./social.types.js";
import type { SocialPlatform } from "@prisma/client";

const SYSTEM = `Sen bir SaaS ürününün sosyal medya editörüsün. Ürün: çevrimiçi PDF araçları platformu.
Görevin, verilen blog yazısı için her sosyal ağa AYRI, o ağın diline uygun bir gönderi metni yazmak.

Kurallar:
- Dil: yazının dili neyse o (Türkçe yazıya Türkçe, İngilizce yazıya İngilizce).
- Türkçe yazarken dilbilgisi kusursuz olmalı: yabancı kelime kullanma, çeviri kokan ifade kurma.
- Tıklama isteği uyandır: yazının somut faydasını söyle, başlığı olduğu gibi kopyalama.
- Abartı ve tıklama tuzağı yok. Emoji en fazla bir tane, gerekliyse.
- Etiketler (hashtag) arama amaçlı seçilir: aranan, gerçek terimler olsun; uydurma marka etiketi yazma.
- Etiketleri metnin SONUNA koy.
- Bağlantıyı yalnızca senden istendiği platformda, metnin sonunda (etiketlerden önce) ver.
- Karakter sınırını ASLA aşma.

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

/** Etiket adayını geçerli bir hashtag'e çevirir (Türkçe harfler sadeleştirilir). */
export function toHashtag(term: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  const ascii = term
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!ascii) return "";
  const pascal = ascii
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
    .join("");
  // Rakamla başlayan etiket birçok ağda geçersiz sayılır.
  return /^[a-zA-Z]/.test(pascal) ? `#${pascal}` : "";
}

/** Model kullanılamadığında devreye giren sade şablon. */
function fallbackBody(item: FeedItem, platform: SocialPlatform): string {
  const spec = PLATFORM_SPECS[platform];
  const tags = item.categories
    .slice(0, spec.hashtagCount)
    .map(toHashtag)
    .filter(Boolean)
    .join(" ");
  const link = spec.inlineLink ? `\n\n${item.link}` : "";
  const tail = `${link}${tags ? `\n\n${tags}` : ""}`;
  const room = Math.max(40, spec.maxChars - tail.length);
  const lead = item.summary ? `${item.title}\n\n${item.summary}` : item.title;
  return `${clamp(lead, room)}${tail}`;
}

/**
 * Yazı için her platformun gönderi metnini üretir.
 * Dönen kayıtta HER platform için bir metin bulunur (model başarısızsa şablon).
 */
export async function writePostBodies(
  item: FeedItem,
  platforms: SocialPlatform[],
): Promise<Record<SocialPlatform, string>> {
  const result = {} as Record<SocialPlatform, string>;
  for (const p of ALL_PLATFORMS) result[p] = fallbackBody(item, p);

  if (!isAiConfigured() || platforms.length === 0) return result;

  const brief = platforms
    .map((p) => {
      const spec = PLATFORM_SPECS[p];
      return `- ${p}: en fazla ${spec.maxChars} karakter, ${spec.hashtagCount} etiket, bağlantı ${
        spec.inlineLink ? "metne eklensin" : "EKLENMESİN (ayrı alanda gidiyor)"
      }.`;
    })
    .join("\n");

  const prompt = `Blog yazısı:
Başlık: ${item.title}
Özet: ${item.summary || "(özet yok)"}
Bağlantı: ${item.link}
Konu etiketleri: ${item.categories.join(", ") || "(yok)"}

İstenen platformlar ve sınırları:
${brief}`;

  let raw: string;
  try {
    raw = await callClaude(SYSTEM, [{ role: "user", content: prompt }], 1600);
  } catch {
    // Model erişilemedi → şablon metinler kalır, otomasyon durmaz.
    return result;
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) return result;

  for (const p of platforms) {
    const value = parsed[p];
    if (typeof value === "string" && value.trim().length > 0) {
      result[p] = clamp(value, PLATFORM_SPECS[p].maxChars);
    }
  }
  return result;
}
