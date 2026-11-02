/**
 * Pinterest panosunu konuya göre SEÇEN mantık. Veriler `pinterest-boards.config.ts` dosyasındadır.
 *
 * Sıra: 1) elle seçim  2) araç eşleştirmesi  3) blog kategorisi/etiketi  4) başlık+açıklama anahtar kelimesi
 *       5) varsayılan. Sonuçla birlikte NEDEN seçildiği de döner (gönderi kaydına yazılır, panelde görünür).
 */

import {
  CATEGORY_RULES,
  DEFAULT_PIN_BOARD,
  KEYWORD_RULES,
  PIN_BOARD_KEYS,
  TOOL_BOARD,
  isPinBoardKey,
  type PinBoardKey,
} from "./pinterest-boards.config.js";
import { TOOL_REEL_CATALOG } from "./tool-reel-catalog.js";
import { toolIdFromGuid } from "./platforms/reel-cover.js";

export type BoardChoice = { key: PinBoardKey; reason: string };

export type BoardSubject = {
  guid?: string;
  title: string;
  summary?: string;
  link?: string;
  categories?: string[];
};

/** Küçük harf, Türkçe karaktersiz, noktalama boşluk: "CV'ni Öğren!" → "cv ni ogren". */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Terim metinde var mı? Kısa terimler (≤3 harf) tam sözcük, uzunlar sözcük başı olarak aranır. */
export function hasTerm(foldedText: string, term: string): boolean {
  const t = foldText(term);
  if (!t) return false;
  const padded = ` ${foldedText} `;
  return t.length <= 3 ? padded.includes(` ${t} `) : padded.includes(` ${t}`);
}

function firstRuleHit(
  rules: { board: PinBoardKey; terms: string[] }[],
  foldedText: string,
): { board: PinBoardKey; term: string } | null {
  for (const rule of rules) {
    const term = rule.terms.find((t) => hasTerm(foldedText, t));
    if (term) return { board: rule.board, term };
  }
  return null;
}

/** Aracın sayfa adı: `/tools/<ad>` (dil önekiyle ya da öneksiz). */
export function toolSlugFromLink(link: string | undefined): string | null {
  if (!link) return null;
  const match = link.match(/\/tools\/([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Gönderiden aracın sayfa adı: araç videosunda katalogdan, diğerlerinde bağlantıdan. */
function toolSlugOf(subject: BoardSubject): string | null {
  const toolId = subject.guid ? toolIdFromGuid(subject.guid) : null;
  if (toolId) {
    const entry = TOOL_REEL_CATALOG.find((e) => e.id === toolId);
    return toolSlugFromLink(entry?.tr.link) ?? toolSlugFromLink(subject.link) ?? toolId;
  }
  return toolSlugFromLink(subject.link);
}

/** Bir içeriğin gideceği pano ve nedeni. `manual` verilmişse (geçerli bir anahtarsa) o kazanır. */
export function chooseBoard(subject: BoardSubject, manual?: string | null): BoardChoice {
  if (isPinBoardKey(manual)) return { key: manual, reason: "elle seçim" };

  const slug = toolSlugOf(subject);
  if (slug && TOOL_BOARD[slug]) return { key: TOOL_BOARD[slug], reason: `araç eşleştirmesi: ${slug}` };

  const isTool = Boolean(subject.guid && toolIdFromGuid(subject.guid)) || Boolean(slug);
  if (!isTool) {
    const cats = foldText([...(subject.categories ?? []), subject.link ?? ""].join(" "));
    const byCategory = firstRuleHit(CATEGORY_RULES, cats);
    if (byCategory) return { key: byCategory.board, reason: `blog kategorisi/etiketi: ${byCategory.term}` };
  }

  const text = foldText(`${subject.title} ${subject.summary ?? ""}`);
  const byKeyword = firstRuleHit(KEYWORD_RULES, text);
  if (byKeyword) return { key: byKeyword.board, reason: `anahtar kelime: ${byKeyword.term}` };

  return { key: DEFAULT_PIN_BOARD, reason: "varsayılan pano" };
}

/**
 * Pano anahtarının Pinterest pano kimliği. Eşleme yoksa ya da eşleme başka ortamda (kum havuzu ↔ gerçek)
 * yapılmışsa `null` döner; çağıran seçili tek panoya düşer.
 */
export function boardIdFor(
  key: string | null | undefined,
  boards: Partial<Record<PinBoardKey, string>>,
  mappedEnv: "sandbox" | "production" | null,
  currentEnv: "sandbox" | "production",
): string | null {
  if (!isPinBoardKey(key)) return null;
  if (mappedEnv && mappedEnv !== currentEnv) return null;
  return boards[key]?.trim() || null;
}

export { PIN_BOARD_KEYS };
