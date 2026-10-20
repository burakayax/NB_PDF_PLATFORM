/**
 * X için sıradaki gönderiyi seçer (saf işlev: veritabanı yok).
 *
 * HAFTALIK DÖNGÜ: gönderi türü `X_CYCLE` sırasıyla ilerler (ipucu, ürün, ipucu, ürün, anket, "biliyor muydunuz").
 * Her tür kendi içinde "önce hiç kullanılmamış, hepsi kullanıldıysa en eski kullanılan" sırasıyla seçer; aynı metin
 * yakın zamanda tekrar paylaşılmaz (spam'den kaçınma). Yayın saatine/zamanlamaya DOKUNMAZ.
 */

import {
  X_CYCLE,
  composeFactPost,
  composePoll,
  composeProductPost,
  composeTipPost,
  encodeXPlan,
} from "./x-compose.js";
import type { XContent, XKind, XPlan } from "./x-compose.js";

/** guid → en son kullanıldığı an (ms). */
export type XUsage = Map<string, number>;

export type XPick = {
  kind: XKind;
  guid: string;
  title: string;
  /** Panelde gösterilen bağlantı (gönderide kullanılmaz; link yanıtta). */
  linkUrl: string;
  plan: XPlan;
  body: string;
  imageUrl: string | null;
};

/** İlk kullanılmamış; yoksa en eski kullanılan (geri dönüşüm kapalıysa null). */
function leastUsed<T>(items: T[], guidOf: (t: T) => string, usage: XUsage, recycle: boolean): T | null {
  const fresh = items.find((i) => !usage.has(guidOf(i)));
  if (fresh) return fresh;
  if (!recycle || items.length === 0) return null;
  return items.slice().sort((a, b) => (usage.get(guidOf(a)) ?? 0) - (usage.get(guidOf(b)) ?? 0))[0] ?? null;
}

export const kindForCount = (count: number): XKind => X_CYCLE[count % X_CYCLE.length] as XKind;

export function pickXPost(input: {
  kind: XKind;
  content: XContent;
  usage: XUsage;
  /** Yazı adresleri, EN YENİ başta (RSS sırası). */
  postUrls: string[];
  recycle: boolean;
  siteOrigin: string;
}): XPick | null {
  const { kind, content, usage, postUrls, recycle } = input;

  if (kind === "blog" || kind === "blog2") {
    const urls = postUrls.filter((u) => content.posts[u]);
    const url = leastUsed(urls, (u) => u, usage, recycle);
    const post = url ? content.posts[url] : undefined;
    if (!url || !post) return null;
    const plan = composeTipPost({ post, link: url, seed: url });
    return { kind, guid: url, title: post.hook, linkUrl: url, plan, body: encodeXPlan(plan), imageUrl: post.card };
  }

  if (kind === "product" || kind === "product2") {
    const product = leastUsed(content.products, (p) => `x-product:${p.id}`, usage, recycle);
    if (!product) return null;
    const guid = `x-product:${product.id}`;
    const plan = composeProductPost({ product, seed: guid });
    return { kind, guid, title: product.text.slice(0, 80), linkUrl: product.link, plan, body: encodeXPlan(plan), imageUrl: product.card };
  }

  if (kind === "poll") {
    const poll = leastUsed(content.polls, (p) => `x-poll:${p.id}`, usage, recycle);
    if (!poll) return null;
    const guid = `x-poll:${poll.id}`;
    const plan = composePoll(poll);
    return { kind, guid, title: poll.question, linkUrl: input.siteOrigin, plan, body: encodeXPlan(plan), imageUrl: null };
  }

  // "Bunu biliyor muydunuz?": yazı × ipucu (ilk ipucu blog gönderisinde kullanılır, 2. ve 3. burada).
  const combos: { url: string; i: number; card: string }[] = [];
  for (const url of postUrls) {
    const post = content.posts[url];
    if (!post) continue;
    (post.factTips ?? []).forEach((i, k) => {
      const card = post.factCards[k];
      if (post.tips[i] && card) combos.push({ url, i, card });
    });
  }
  const combo = leastUsed(combos, (c) => `x-fact:${c.url}:${c.i}`, usage, recycle);
  const post = combo ? content.posts[combo.url] : undefined;
  if (!combo || !post) return null;
  const guid = `x-fact:${combo.url}:${combo.i}`;
  const plan = composeFactPost({ post, tipIndex: combo.i, seed: guid });
  return { kind, guid, title: `Bunu biliyor muydunuz? ${post.hook}`, linkUrl: combo.url, plan, body: encodeXPlan(plan), imageUrl: combo.card };
}
