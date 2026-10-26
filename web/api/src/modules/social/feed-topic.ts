/**
 * Blog yazılarını konu kümelerine ayırır; paylaşım sırası art arda aynı konuya düşmesin.
 *
 * Küme tanınmazsa yazı kendi kümesidir (guid): bilinmeyen konu asla engellenmez.
 */

import type { FeedItem } from "./social.types.js";

const TOPIC_PATTERNS: { topic: string; re: RegExp }[] = [
  { topic: "cv", re: /\bcv\b|ozgecmis|on yazi|cover letter|\bats\b|vesikalik|biyometrik|linkedin|europass|resume/ },
  { topic: "sozlesme", re: /sozlesme|ihale|sartname|kira kontrat|contract|tender/ },
  { topic: "alternatif", re: /alternatif|alternative/ },
  { topic: "donusturme", re: /word|excel|powerpoint|jpg|donustur|convert/ },
];

function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function topicOf(item: Pick<FeedItem, "guid" | "title" | "link" | "categories">): string {
  const haystack = fold(`${item.title} ${item.link} ${item.categories.join(" ")}`.replace(/-/g, " "));
  for (const { topic, re } of TOPIC_PATTERNS) if (re.test(haystack)) return topic;
  return `own:${item.guid}`;
}

/** Aynı konu bu kadar son gönderide yeniden seçilmez (en fazla ~3 günde 1). */
export const TOPIC_COOLDOWN = 2;
