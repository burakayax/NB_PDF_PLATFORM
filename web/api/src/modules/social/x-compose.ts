/**
 * X (Twitter) gönderi kurucusu (saf işlevler: veritabanı ve ağ yok → test ve dry-run kolay).
 *
 * KURALLAR (kullanıcı talimatı)
 * 1. Ana gönderiye LİNK konmaz. Gönderi yayınlanınca aynı gönderiye YANIT olarak link atılır ("Detaylı rehber 👇 <link>").
 * 2. Ana gönderi linke tıklamadan da işe yarar: yazının en faydalı 2–4 ipucu madde madde. 280'i aşarsa thread (1/3, 2/3…);
 *    link yine en son yanıtta. Sonda okuyucuya kısa bir soru.
 * 3. Gönderi başına en fazla 1 hashtag, konuya özel (#CV, #İşArama, #PDF, #Mülakat…). Genel etiket yok.
 * 4. Haftalık döngü: blog ipucu ×2 · ürün ×2 · anket ×1 · "Bunu biliyor muydunuz?" ×1.
 *
 * İPUÇLARI UYDURULMAZ: yazının kendi bölüm başlıklarıdır (`/social-x.json`, bkz. frontend/scripts/generate-social-x.mjs).
 *
 * GÖVDE BİÇİMİ (SocialPost.body, panelde okunur/düzenlenir):
 *   thread   → parçalar "\n\n---\n\n" ile ayrılır; link yanıtı "↳ " ile başlar
 *   anket    → "ANKET\n<soru>\n• seçenek\n• seçenek…"
 */

import { socialUtm, withUtm } from "../../lib/utm.js";

export const X_LIMIT = 280;
const PART_SEP = "\n\n---\n\n";
const REPLY_PREFIX = "↳ ";
const POLL_PREFIX = "ANKET\n";

export type XKind = "blog" | "product" | "blog2" | "product2" | "poll" | "fact";
/** Haftalık döngü (6 gönderi). Sıra: ipucu, ürün, ipucu, ürün, anket, "biliyor muydunuz". */
export const X_CYCLE: XKind[] = ["blog", "product", "blog2", "product2", "poll", "fact"];

export type XTip = { title: string; text: string };
export type XPostData = {
  slug: string;
  topic: string;
  tags: string[];
  hook: string;
  tips: XTip[];
  card: string;
  /** "Bunu biliyor muydunuz?" için kullanılan ipucu sıraları; `factCards` ile aynı sırada. */
  factTips: number[];
  factCards: string[];
};
export type XProduct = { id: string; text: string; link: string; card: string };
export type XPoll = { id: string; question: string; options: string[]; card?: string };
export type XContent = { posts: Record<string, XPostData>; products: XProduct[]; polls: XPoll[] };

/** Bir gönderinin yayın biçimi (publisher bunu gövdeden geri okur). */
export type XPlan =
  | { kind: "tweets"; parts: string[]; replyLink: string | null }
  | { kind: "poll"; question: string; options: string[] };

/**
 * X'in saydığı uzunluk: adres 23, Latin harfler 1, emoji/CJK 2.
 * (Aralıklar X'in resmî "weighted character" kuralından: 0–4351, 8192–8205, 8208–8223, 8242–8247 → 1.)
 */
export function xLength(text: string): number {
  const stripped = text.replace(/https?:\/\/\S+/g, "x".repeat(23));
  let n = 0;
  for (const ch of stripped) {
    const c = ch.codePointAt(0) ?? 0;
    const light = c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247);
    n += light ? 1 : 2;
  }
  return n;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Konuya özel kısa soru. */
const QUESTIONS: Record<string, string[]> = {
  cv: ["Siz CV'nizde en çok neye dikkat ediyorsunuz?", "CV'nizi hazırlarken en çok nerede zorlanıyorsunuz?"],
  mulakat: ["Mülakatta sizi en çok ne heyecanlandırıyor?"],
  sozlesme: ["Sözleşmeyi imzalamadan önce ilk neye bakıyorsunuz?", "Sözleşmede sizi en çok hangi madde zorluyor?"],
  foto: ["Başvuru fotoğrafında en çok neyi merak ediyorsunuz?"],
  evrak: ["Resmî evrak yüklerken en çok nerede takılıyorsunuz?"],
  ogrenci: ["Ödev ve tez dosyalarında sizi en çok ne yoruyor?"],
  pdf: ["PDF işlerinde sizi en çok ne yoruyor?", "PDF'lerle en çok hangi işte zorlanıyorsunuz?"],
};
export const questionFor = (topic: string, seed: string): string => {
  const list = QUESTIONS[topic] ?? (QUESTIONS.pdf as string[]);
  return list[hash(seed) % list.length] as string;
};

/** En fazla 1 etiket, konuya özel; yoksa hiç. */
export const tagFor = (tags: string[], seed: string): string => (tags.length ? (tags[hash(seed) % tags.length] as string) : "");

/** Açıklama cümlesi tek başına anlamlı mı? Şablon yer tutucular ("X yerine…", "Örnek madde") ayıklanır. */
const usableText = (text: string): boolean => Boolean(text) && !/\bX\b|Örnek madde/i.test(text);

/**
 * Açıklamanın ilk anlamlı parçası (":" ya da cümle sonuna kadar), en fazla `max` karakter. Kesik cümle ÜRETMEZ:
 * parça sığmıyorsa boş döner ve madde yalnız başlıkla yazılır.
 */
function clauseOf(text: string, max = 95): string {
  if (!usableText(text)) return "";
  const m = /^[^:.;]+/.exec(text.trim());
  const c = (m?.[0] ?? "").trim();
  return c && c.length <= max ? c : "";
}

const tipLine = (t: XTip): string => {
  const c = clauseOf(t.text);
  const sep = /[?!]$/.test(t.title) ? " " : ": ";
  return c && !t.title.toLocaleLowerCase("tr").includes(c.toLocaleLowerCase("tr")) ? `${t.title}${sep}${c}` : t.title;
};

const clip = (t: string, max: number): string => {
  const s = t.trim();
  if (xLength(s) <= max) return s;
  let out = s;
  while (out.length > 1 && xLength(`${out}…`) > max) out = out.slice(0, -1);
  return `${out.replace(/[\s,.;:]+$/, "")}…`;
};

/** Parçalara "1/3" eki ekler; her parça sınırda kalır. */
function numbered(parts: string[]): string[] {
  if (parts.length === 1) return parts;
  return parts.map((p, i) => `${clip(p, X_LIMIT - 8)}\n\n${i + 1}/${parts.length}`);
}

/**
 * Blog ipucu gönderisi: kanca + 2–4 madde + soru (+1 etiket). Sığmazsa thread.
 * @returns tweets (ana gönderi + varsa thread devamları) ve link yanıtı
 */
export function composeTipPost(input: { post: XPostData; link: string; seed: string }): XPlan {
  const { post, link, seed } = input;
  // Madde = başlık + yazının kendi açıklama cümlesi: linke tıklamadan da işe yarar. Sığmazsa thread olur.
  // Açıklaması olan ipuçları öne alınır (yalnız başlık zayıf kalır); seçilenler yazıdaki sırasıyla dizilir.
  const chosen = post.tips
    .map((t, i) => ({ t, i, good: clauseOf(t.text) !== "" }))
    .sort((a, b) => Number(b.good) - Number(a.good) || a.i - b.i)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i);
  const bullets = chosen.map(({ t }) => `• ${clip(tipLine(t), 150)}`);
  const question = questionFor(post.topic, seed);
  const tag = tagFor(post.tags, seed);
  const tail = `${question}${tag ? ` ${tag}` : ""}`;
  const hook = clip(post.hook, 110);

  const single = `${hook}\n\n${bullets.join("\n")}\n\n${tail}`;
  const RESERVE = 8; // "\n\n1/3"
  let parts: string[];
  if (xLength(single) <= X_LIMIT) {
    parts = [single];
  } else {
    parts = [];
    let cur = hook;
    for (const b of bullets) {
      const next = `${cur}\n${cur === hook ? "\n" : ""}${b}`;
      if (xLength(next) + RESERVE > X_LIMIT && cur !== hook) {
        parts.push(cur);
        cur = b;
      } else cur = next;
    }
    // soru + etiket son parçaya; sığmazsa kendi parçasına.
    if (xLength(`${cur}\n\n${tail}`) + RESERVE <= X_LIMIT) cur = `${cur}\n\n${tail}`;
    else {
      parts.push(cur);
      cur = tail;
    }
    parts.push(cur);
  }
  const replyLink = withUtm(link, socialUtm("X", "blog"));
  return { kind: "tweets", parts: numbered(parts), replyLink: `Detaylı rehber 👇 ${replyLink}` };
}

/** Ürün gönderisi: özellik metni + (en fazla 1 etiket). Link yanıtta. */
export function composeProductPost(input: { product: XProduct; seed: string }): XPlan {
  const { product, seed } = input;
  const tag = tagFor(["#PDF"], seed);
  const text = `${clip(product.text, X_LIMIT - 8)}`;
  const withTag = xLength(`${text} ${tag}`) <= X_LIMIT ? `${text} ${tag}` : text;
  const link = withUtm(product.link, socialUtm("X", "urun"));
  return { kind: "tweets", parts: [withTag], replyLink: `Hemen dene 👇 ${link}` };
}

/** "Bunu biliyor muydunuz?" ipucu: LİNKSİZ, görselli. */
export function composeFactPost(input: { post: XPostData; tipIndex: number; seed: string }): XPlan {
  const { post, tipIndex, seed } = input;
  const tip = post.tips[tipIndex] ?? post.tips[0];
  const body = tip ? tipLine(tip) : post.hook;
  const tag = tagFor(post.tags, seed);
  const question = questionFor(post.topic, seed);
  let text = `Bunu biliyor muydunuz?\n\n${clip(body, 170)}\n\n${question}${tag ? ` ${tag}` : ""}`;
  if (xLength(text) > X_LIMIT) text = `Bunu biliyor muydunuz?\n\n${clip(body, 170)}${tag ? `\n\n${tag}` : ""}`;
  return { kind: "tweets", parts: [text], replyLink: null };
}

/** Anket: 2–4 seçenek, her biri en fazla 25 karakter. Link yok. */
export function composePoll(poll: XPoll): XPlan {
  const options = poll.options.slice(0, 4).map((o) => clip(o, 25));
  return { kind: "poll", question: clip(poll.question, 250), options };
}

/** Planı panelde okunur gövde metnine çevirir. */
export function encodeXPlan(plan: XPlan): string {
  if (plan.kind === "poll") return `${POLL_PREFIX}${plan.question}\n${plan.options.map((o) => `• ${o}`).join("\n")}`;
  const parts = plan.replyLink ? [...plan.parts, `${REPLY_PREFIX}${plan.replyLink}`] : plan.parts;
  return parts.join(PART_SEP);
}

/** Gövdeyi (admin düzenlemiş olabilir) yayın planına geri çevirir. Eski tek metinli gönderiler de çalışır. */
export function decodeXBody(body: string): XPlan {
  const text = body.trim();
  if (text.startsWith(POLL_PREFIX)) {
    const [question = "", ...rest] = text.slice(POLL_PREFIX.length).split("\n");
    const options = rest.map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);
    return { kind: "poll", question: question.trim(), options };
  }
  const raw = text.split(PART_SEP).map((p) => p.trim()).filter(Boolean);
  const last = raw[raw.length - 1];
  if (raw.length > 1 && last?.startsWith(REPLY_PREFIX)) {
    return { kind: "tweets", parts: raw.slice(0, -1), replyLink: last.slice(REPLY_PREFIX.length).trim() };
  }
  if (raw.length === 1 && raw[0]?.startsWith(REPLY_PREFIX)) return { kind: "tweets", parts: [], replyLink: raw[0].slice(REPLY_PREFIX.length) };
  return { kind: "tweets", parts: raw, replyLink: null };
}

/** Bir planın kurallara uyup uymadığını söyler (test ve dry-run için). */
export function checkXPlan(plan: XPlan): string[] {
  const problems: string[] = [];
  if (plan.kind === "poll") {
    if (plan.options.length < 2 || plan.options.length > 4) problems.push("anket 2–4 seçenek olmalı");
    for (const o of plan.options) if (o.length > 25) problems.push(`seçenek 25 karakteri aşıyor: ${o}`);
    if (xLength(plan.question) > X_LIMIT) problems.push("anket sorusu 280'i aşıyor");
    return problems;
  }
  const all = plan.replyLink ? [...plan.parts, plan.replyLink] : plan.parts;
  for (const p of all) if (xLength(p) > X_LIMIT) problems.push(`parça ${xLength(p)} karakter`);
  for (const p of plan.parts) if (/https?:\/\//.test(p)) problems.push("ana gönderide/thread'de link var");
  const tags = plan.parts.join(" ").match(/#[^\s#]+/gu) ?? [];
  if (tags.length > 1) problems.push(`birden fazla etiket: ${tags.join(" ")}`);
  return problems;
}
