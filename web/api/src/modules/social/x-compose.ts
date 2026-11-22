/**
 * X (Twitter) gönderi kurucusu (saf işlevler: veritabanı ve ağ yok → test ve dry-run kolay).
 *
 * KURALLAR (kullanıcı talimatı)
 * 1. Ana gönderiye LİNK konmaz. Gönderi yayınlanınca aynı gönderiye YANIT olarak link atılır ("Detaylı rehber 👇 <link>").
 * 2. Ana gönderi linke tıklamadan da işe yarar: yazının en faydalı 2–4 ipucu madde madde. 280'i aşarsa thread (1/3, 2/3…);
 *    link yine en son yanıtta. Sonda okuyucuya kısa bir soru.
 * 3. Gönderi başına 2 etiket (uygunsa 3), KONUYA ÖZEL: önce yazının kendi konusu (slug: #Word, #PDFSıkıştırma, #KVKK…),
 *    sonra ana konu (#CV, #Sözleşme…). Genel etiket yalnız konu bulunamazsa. (2026-11-22: eskiden 1 etiketti, hep #PDF çıkıyordu.)
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

export const MAX_TAGS = 3;

/** Yazının adresinden (slug) çıkan konuya özel etiketler. İlk eşleşenler önce gelir. */
const SLUG_TAGS: [RegExp, string][] = [
  [/word/, "#Word"],
  [/excel|ekstre|fatura/, "#Excel"],
  [/powerpoint/, "#PowerPoint"],
  [/ocr|taranmis/, "#OCR"],
  [/sikistir|kucult|boyut/, "#PDFSıkıştırma"],
  [/birlestir/, "#PDFBirleştirme"],
  [/bolme|ayirma/, "#PDFBölme"],
  [/imza/, "#eİmza"],
  [/sifre/, "#PDFŞifre"],
  [/kvkk|gizleme|hassas/, "#KVKK"],
  [/filigran/, "#Filigran"],
  [/qr|vcard/, "#QRKod"],
  [/udf|uyap/, "#UYAP"],
  [/(^|-)ats(-|$)/, "#ATS"],
  [/linkedin/, "#LinkedIn"],
  [/on-yazi/, "#ÖnYazı"],
  [/mulakat/, "#Mülakat"],
  [/vize/, "#Vize"],
  [/ihale/, "#İhale"],
  [/kira/, "#KiraSözleşmesi"],
  [/vesikalik/, "#VesikalıkFotoğraf"],
  [/biyometrik/, "#BiyometrikFotoğraf"],
  [/osym/, "#ÖSYM"],
  [/(^|-)ai(-|$)|yapay-zeka|ozetleme/, "#YapayZeka"],
  [/telefon|mobil/, "#Mobil"],
  [/alternatif/, "#PDFAraçları"],
  [/gizlilik/, "#Gizlilik"],
  [/jpg|gorsel|resim|tiff/, "#Görsel"],
  [/duzenle|duzenleme|metin-duzenleme/, "#PDFDüzenleme"],
  [/dondur|yatay|yon/, "#PDFDöndürme"],
  [/cevir|donustur/, "#PDFDönüştürme"],
  [/form-doldur/, "#PDFForm"],
  [/karsilastir/, "#PDFKarşılaştırma"],
  [/onar/, "#PDFOnarma"],
  [/sayfa-sil/, "#PDFSayfaSilme"],
  [/numara/, "#SayfaNumarası"],
  [/kirp|kesit/, "#PDFKırpma"],
  [/ceviri|dile-cevirme|dildeki/, "#Çeviri"],
  [/tara|belge-tarama|camscanner|lens/, "#BelgeTarama"],
  [/yer-imi|icindekiler/, "#PDFYerİmi"],
  [/ucretsiz/, "#ÜcretsizPDF"],
  [/yapay|ai-ile/, "#YapayZeka"],
];

/** Ürün kimliğinden etiketler (ürün gönderileri). */
const PRODUCT_TAGS: Record<string, string[]> = {
  compress: ["#PDFSıkıştırma", "#PDF"],
  merge: ["#PDFBirleştirme", "#PDF"],
  "pdf-to-word": ["#Word", "#PDF"],
  "cv-olustur": ["#CV", "#İşArama"],
  "image-to-pdf": ["#JPG", "#PDF"],
  "belge-tara": ["#BelgeTarama", "#PDF"],
  encrypt: ["#PDFŞifre", "#Güvenlik"],
  "grayscale-pdf": ["#PDF", "#Baskı"],
};

/**
 * Konuya özel 2 (bazen 3) etiket: önce `extra`, sonra yazının kendi konusu (slug), sonra ana konu etiketleri; tekrar yok.
 * 3. etiket yalnız yeterli aday varsa ve tohuma göre seçilir (akış hep aynı sayıda etiketle dolmasın).
 */
export function tagsFor(input: { slug?: string; tags: string[]; seed: string; extra?: string[] }): string[] {
  const fold = (t: string) => t.toLocaleLowerCase("tr");
  const seen = new Set<string>();
  const cands: string[] = [];
  const add = (t: string) => {
    if (!t || seen.has(fold(t))) return;
    seen.add(fold(t));
    cands.push(t);
  };
  for (const t of input.extra ?? []) add(t);
  const slug = (input.slug ?? "").toLocaleLowerCase("tr");
  let hits = 0;
  for (const [re, tag] of SLUG_TAGS) {
    if (hits >= 2) break;
    if (re.test(slug)) {
      add(tag);
      hits++;
    }
  }
  for (const t of input.tags) add(t);
  const want = cands.length >= 3 && hash(input.seed) % 2 === 0 ? 3 : 2;
  return cands.slice(0, Math.min(want, MAX_TAGS));
}

/** Açıklama cümlesi tek başına anlamlı mı? Şablon yer tutucular ("X yerine…", "Örnek madde") ayıklanır. */
const usableText = (text: string): boolean => Boolean(text) && !/\bX\b|Örnek madde/i.test(text);

/**
 * Açıklamanın ilk TAM cümlesi, en fazla `max` karakter. ".docx" gibi sözcük içi noktada kesmez (cümle sonu = nokta + boşluk
 * + büyük harf). Sığmıyorsa son virgül/noktalı virgülde biter; hiçbiri yoksa boş döner (madde yalnız başlıkla yazılır).
 * Yarım cümle ÜRETMEZ.
 */
function clauseOf(text: string, max = 140): string {
  if (!usableText(text)) return "";
  const t = text.trim().replace(/\s+/g, " ");
  const m = /^.+?(?:[.!?](?=\s+[A-ZÇĞİÖÜŞ0-9])|$)/.exec(t);
  const sentence = (m?.[0] ?? "").replace(/[.\s]+$/, "").trim();
  if (sentence && sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const at = Math.max(cut.lastIndexOf(";"), cut.lastIndexOf(", "));
  return at >= 40 ? cut.slice(0, at).trim() : "";
}

const tipLine = (t: XTip, max = 140): string => {
  const c = clauseOf(t.text, max);
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
    .slice(0, 4)
    .sort((a, b) => a.i - b.i);
  const lineOf = (t: XTip, max: number) => `• ${clip(tipLine(t, max), 200)}`;
  const allBullets = chosen.map(({ t }) => lineOf(t, 140));
  const question = questionFor(post.topic, seed);
  const tags = tagsFor({ slug: post.slug, tags: post.tags, seed });
  const hook = clip(post.hook, 110);
  const tailWith = (list: string[]) => `${question}${list.length ? ` ${list.join(" ")}` : ""}`;
  const tail = tailWith(tags);

  // Önce en dolu TEK gönderi (thread erişimi düşürür): madde sayısı ve cümle uzunluğu kademeli kısılır, cümle yine tam kalır.
  // Etiketler sığdığı kadar (en az 1) kalır.
  let single: string | null = null;
  const attempts: [number, number][] = [[3, 130], [3, 110], [4, 70], [3, 90], [3, 70], [2, 140], [2, 100]];
  // Önce en az 2 etiketle dene (konuya özel etiket istenen şey); olmazsa 1 etikete razı ol.
  for (const minTags of [Math.min(2, tags.length), 1]) {
    for (const [n, max] of attempts) {
      const picked = chosen.slice(0, n);
      // Açıklaması olan madde bu kısaltmada açıklamasız (yalnız başlık) kalıyorsa deneme geçersiz: bilgi vermez.
      if (picked.some(({ t }) => clauseOf(t.text, max) === "" && clauseOf(t.text, 140) !== "")) continue;
      const b = picked.map(({ t }) => lineOf(t, max));
      for (let k = tags.length; k >= minTags && !single; k--) {
        const text = `${hook}\n\n${b.join("\n")}\n\n${tailWith(tags.slice(0, k))}`;
        if (xLength(text) <= X_LIMIT) single = text;
      }
      if (single) break;
    }
    if (single) break;
  }
  const bullets = allBullets.slice(0, 3);
  const RESERVE = 8; // "\n\n1/3"
  let parts: string[];
  if (single) {
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
  const tags = tagsFor({ tags: ["#PDF"], seed, extra: PRODUCT_TAGS[product.id] });
  const text = `${clip(product.text, X_LIMIT - 8)}`;
  // Metin kendi etiketini taşıyorsa (ör. "#PDF") yenisi eklenmez; sığdığı kadar etiket konur.
  const own = (text.match(/#[^\s#]+/gu) ?? []).map((t) => t.toLocaleLowerCase("tr"));
  let withTag = text;
  for (let k = tags.length; k >= 1; k--) {
    const add = tags.slice(0, k).filter((t) => !own.includes(t.toLocaleLowerCase("tr")));
    const cand = add.length ? `${text} ${add.join(" ")}` : text;
    if (xLength(cand) <= X_LIMIT) {
      withTag = cand;
      break;
    }
  }
  const link = withUtm(product.link, socialUtm("X", "urun"));
  return { kind: "tweets", parts: [withTag], replyLink: `Hemen dene 👇 ${link}` };
}

/** "Bunu biliyor muydunuz?" ipucu: LİNKSİZ, görselli. */
export function composeFactPost(input: { post: XPostData; tipIndex: number; seed: string }): XPlan {
  const { post, tipIndex, seed } = input;
  const tip = post.tips[tipIndex] ?? post.tips[0];
  const body = tip ? tipLine(tip) : post.hook;
  const tags = tagsFor({ slug: post.slug, tags: post.tags, seed });
  const question = questionFor(post.topic, seed);
  const head = `Bunu biliyor muydunuz?\n\n${clip(body, 200)}`;
  let text = head;
  for (let k = tags.length; k >= 0; k--) {
    const tagStr = tags.slice(0, k).join(" ");
    const cand = `${head}\n\n${question}${tagStr ? ` ${tagStr}` : ""}`;
    if (xLength(cand) <= X_LIMIT) {
      text = cand;
      break;
    }
  }
  if (xLength(text) > X_LIMIT) text = clip(head, X_LIMIT);
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
  if (tags.length > MAX_TAGS) problems.push(`en fazla ${MAX_TAGS} etiket: ${tags.join(" ")}`);
  return problems;
}
