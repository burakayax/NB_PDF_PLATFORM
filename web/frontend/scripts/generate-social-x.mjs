/**
 * X (Twitter) içerik kaynağı (`/social-x.json`) ve X görselleri (`/x-cards/...`).
 *
 * NEDEN AYRI DOSYA: X gönderisi linke tıklanmadan da işe yarar bilgi vermeli. Bu bilgi uydurulmaz: yazının KENDİ bölüm
 * başlıkları (kaydırmalı gönderide kullandığımız aynı kaynak: `carouselCopy` + `extractCarousel`) ipucu olarak alınır.
 * Otomasyon (API) bu dosyayı siteden okur; ürün gönderileri ve anketler de burada durur, böylece içerik tek yerden düzenlenir.
 *
 * İÇERİK TÜRLERİ (haftalık döngü): blog ipucu ×2 · ürün ×2 · anket ×1 · "Bunu biliyor muydunuz?" ×1.
 *
 * GÖRSELLER: yazıya özel, başlıkla birlikte 1 somut ipucu/rakam kartı taşır; konuya göre renk değişir
 * (CV = mavi, sözleşme = mor, PDF araçları = turuncu, fotoğraf = yeşil, resmî evrak = gök mavisi).
 * Düzen motoru (cover-engine) sekiz düzeni dönüşümlü kullanır: iki görsel birbirinin kopyası olmaz.
 * Görseller gitignore'da, her yayında üretilir; imza değişmediyse yeniden çizilmez.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getBlogPostsSorted } from "../src/blog/blogContent.mjs";
import { curatedCarousel } from "../src/blog/carouselCopy.mjs";
import { extractCarousel } from "../src/blog/carouselSlides.mjs";
import { localizedPath } from "../src/seo/enSlugs.mjs";
import { assignLayouts, hash, renderCover } from "./lib/cover-engine.mjs";
import { heroFor } from "./lib/heroes.mjs";
import { splitTitle } from "./lib/blog-cover.mjs";

const DESIGN_VERSION = 3;
const W = 1200;
const H = 675;

/** Konu → { renk adı, etiket }. Etiketler X'te en fazla 1 tane kullanılır (konuya özel). */
const THEMES = {
  cv: { accent: "blue", tags: ["#CV", "#İşArama"] },
  mulakat: { accent: "blue", tags: ["#Mülakat"] },
  sozlesme: { accent: "violet", tags: ["#Sözleşme"] },
  foto: { accent: "emerald", tags: ["#Fotoğraf"] },
  evrak: { accent: "sky", tags: ["#eDevlet"] },
  ogrenci: { accent: "cyan", tags: ["#Öğrenci"] },
  pdf: { accent: "amber", tags: ["#PDF"] },
};

const fold = (s) =>
  String(s).toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");

export function topicOf(slug) {
  const s = fold(slug);
  if (/mulakat/.test(s)) return "mulakat";
  if (/sozlesme|kira-kontrati|ihale-sartname|gecikme-cezasi/.test(s)) return "sozlesme";
  if (/fotograf|biyometrik|vesikalik|osym/.test(s)) return "foto";
  if (/(^|-)cv(-|$)|ozgecmis|ats-uyumlu|linkedin/.test(s)) return "cv";
  if (/edevlet|vize|uyap|udf|evrak|dilekce|kayit|tc-kimlik|ihale-dosyasi/.test(s)) return "evrak";
  if (/akademik|makale|odev|tez|staj/.test(s)) return "ogrenci";
  return "pdf";
}

/** Ürün gönderileri: gerçek özellik + (varsa) ÖRNEK rakam. Rakamlar örnektir, vaat değildir. */
export const X_PRODUCTS = [
  {
    id: "compress",
    title: "BÜYÜK PDF'İ",
    tag: "küçült",
    fact: "Örnek: 12 MB'tan 1,8 MB'a",
    text: "PDF e-postaya sığmıyor mu? Boyutu küçült: hedef boyut seç, sonucu indir. Örnek: 12 MB → 1,8 MB. Üyelik gerekmeden dene.",
    tool: "/tools/compress",
  },
  {
    id: "merge",
    title: "ÇOK PDF",
    tag: "tek dosya yap",
    fact: "3 PDF, tek dosya",
    text: "Dağınık PDF'leri tek dosyada topla: sırala ve birleştir. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
    tool: "/tools/merge-pdf",
  },
  {
    id: "pdf-to-word",
    title: "PDF'İ",
    tag: "Word'e çevir",
    fact: "PDF'ten düzenlenebilir Word'e",
    text: "PDF'i düzenlenebilir Word belgesine çevir. Kurulum gerekmez.",
    tool: "/tools/pdf-to-word",
  },
  {
    id: "cv-olustur",
    title: "CV'NİN",
    tag: "dakikalar içinde hazır",
    fact: "30 hazır şablon + ATS röntgeni",
    text: "CV'ni hazır şablonla dakikalar içinde hazırla, ATS röntgeniyle kontrol et. Bilgilerin yalnızca tarayıcında kalır.",
    tool: "/tools/cv-olustur",
  },
  {
    id: "image-to-pdf",
    title: "FOTOĞRAFLAR",
    tag: "tek PDF olsun",
    fact: "Fotoğraflar tek PDF'te",
    text: "Fotoğrafları tek PDF'te topla. Dosyalar cihazında işlenir.",
    tool: "/tools/image-to-pdf",
  },
  {
    id: "belge-tara",
    title: "TELEFONUNLA",
    tag: "belge tara",
    fact: "Kenarlar bulunur, PDF kaydedilir",
    text: "Telefon kamerasıyla belge tara: kenarlar otomatik bulunur, eğri çekim düzelir, PDF olarak kaydedersin. Cihazında işlenir.",
    tool: "/tools/belge-tara",
  },
  {
    id: "encrypt",
    title: "GİZLİ BELGE",
    tag: "parolayla koru",
    fact: "PDF'ine parola koy",
    text: "Gizli belgeni parolayla koru: PDF'e şifre koymak birkaç adım.",
    tool: "/tools/encrypt",
  },
  {
    id: "grayscale-pdf",
    title: "RENKLİDEN",
    tag: "siyah-beyaza",
    fact: "Metin seçilebilir kalır",
    text: "Renkli PDF'i siyah-beyaza çevir; metin seçilebilir kalır.",
    tool: "/tools/grayscale-pdf",
  },
];

/** Anketler (X: 2–4 seçenek, her biri en fazla 25 karakter). */
export const X_POLLS = [
  { id: "kullanim", question: "PDF'i en çok ne için kullanıyorsunuz?", options: ["Birleştirme", "Sıkıştırma", "Word'e çevirme", "İmzalama"] },
  { id: "eposta", question: "PDF e-postaya sığmayınca ne yapıyorsunuz?", options: ["Sıkıştırıyorum", "Parçalara bölüyorum", "Link gönderiyorum", "Vazgeçiyorum"] },
  { id: "cvbicim", question: "CV'nizi hangi biçimde gönderiyorsunuz?", options: ["PDF", "Word", "Başvuru formu", "Karışık"] },
  { id: "tarama", question: "Belge taramak için ne kullanıyorsunuz?", options: ["Telefon kamerası", "Tarayıcı cihaz", "Tarama uygulaması", "Fotokopi"] },
];

const cleanTip = (t) => String(t ?? "").replace(/\s+/g, " ").replace(/[.:;]+$/, "").trim();

/** Bir yazının ipuçları: elle yazılmış kaydırmalı gönderi varsa o, yoksa yazıdan çıkarılan bölümler. */
function tipsOf(post) {
  const curated = curatedCarousel(post.slug);
  const slides = curated ? curated.slides : extractCarousel(post.tr.blocks).slides;
  return slides.map((s) => ({ title: cleanTip(s.title), text: cleanTip(s.text) })).filter((s) => s.title);
}

/** Şablon yer tutucu içeren ("X yerine…", "Örnek madde") açıklamalar karta konmaz. */
const usableText = (t) => Boolean(t) && !/\bX\b|Örnek madde/i.test(t);

/** Açıklamanın ilk anlamlı parçası (":" ya da cümle sonuna kadar); sığmıyorsa boş. Kesik cümle üretmez. */
function clauseOf(text, max = 70) {
  if (!usableText(text)) return "";
  const c = (/^[^:.;]+/.exec(String(text).trim())?.[0] ?? "").trim();
  return c && c.length <= max ? c : "";
}

/** Karta sığacak somut ipucu satırı: "Başlık: ilk anlamlı parça" (ya da yalnız başlık). */
const factLine = (tip, max = 100) => {
  const c = clauseOf(tip.text);
  const sep = /[?!]$/.test(tip.title) ? " " : ": ";
  const line = c && !tip.title.toLocaleLowerCase("tr").includes(c.toLocaleLowerCase("tr")) ? `${tip.title}${sep}${c}` : tip.title;
  return line.length <= max ? line : `${line.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

export async function writeSocialX({ publicDir, baseUrl }) {
  const root = join(publicDir, "x-cards");
  const manifestPath = join(root, "manifest.json");
  let previous = {};
  try {
    previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    /* ilk üretim */
  }
  const next = {};
  let written = 0;
  let skipped = 0;

  async function card(kind, id, spec, signatureParts) {
    const rel = `x-cards/${kind}/${id}.png`;
    const file = join(publicDir, rel);
    const signature = createHash("sha1").update(JSON.stringify([DESIGN_VERSION, spec, signatureParts])).digest("hex");
    next[rel] = signature;
    if (previous[rel] === signature && existsSync(file)) {
      skipped++;
      return `/${rel}`;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await renderCover({ ...spec, w: W, h: H, key: "wide", publicDir }));
    written++;
    return `/${rel}`;
  }

  const posts = getBlogPostsSorted();
  const oldestFirst = posts.slice().reverse();
  const tipLayouts = assignLayouts(oldestFirst.map((p) => p.slug));
  const factLayouts = assignLayouts(oldestFirst.map((p) => `f:${p.slug}`), { prefer: (k) => hash(k) + 3 });

  const out = { posts: {}, products: [], polls: X_POLLS };
  for (const post of oldestFirst) {
    const tips = tipsOf(post);
    if (tips.length < 2) continue;
    const topic = topicOf(post.slug);
    const theme = THEMES[topic];
    const url = `${baseUrl}${localizedPath(`/blog/${post.slug}`, "tr")}`;
    const { head, tag } = splitTitle(post.tr.title);
    const hero = heroFor(post.slug, post.tool);

    const tipCard = await card(
      "tip",
      post.slug,
      { layout: tipLayouts.get(post.slug), title: head, tag, hero, accent: theme.accent, fact: factLine(tips[0]) },
      null,
    );
    const factCards = [];
    // "Bunu biliyor muydunuz?" için açıklaması olan ipuçları önce (yalnız başlık zayıf kalır); ilk ipucu blog gönderisinde kullanılır.
    const factTips = tips
      .map((t, i) => ({ t, i }))
      .filter(({ i }) => i >= 1)
      .sort((a, b) => Number(!clauseOf(a.t.text)) - Number(!clauseOf(b.t.text)))
      .slice(0, 2)
      .map(({ i }) => i);
    for (const i of factTips) {
      factCards.push(
        await card(
          "fact",
          `${post.slug}-${i}`,
          { layout: factLayouts.get(`f:${post.slug}`), title: "Bunu biliyor muydunuz?", tag: head.length > 40 ? "" : head, hero, accent: theme.accent, fact: factLine(tips[i], 100) },
          null,
        ),
      );
    }
    out.posts[url] = { slug: post.slug, topic, tags: theme.tags, hook: head, tips: tips.slice(0, 6), card: tipCard, factTips, factCards };
  }

  const productLayouts = assignLayouts(X_PRODUCTS.map((p) => p.id), { prefer: (k) => hash(k) + 5 });
  for (const p of X_PRODUCTS) {
    const cardPath = await card(
      "product",
      p.id,
      { layout: productLayouts.get(p.id), title: p.title, tag: p.tag, hero: heroFor(p.id), accent: THEMES.pdf.accent, forceCaps: true, fact: p.fact },
      null,
    );
    out.products.push({ id: p.id, text: p.text, link: `${baseUrl}${p.tool}`, card: cardPath });
  }

  mkdirSync(root, { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  writeFileSync(join(publicDir, "social-x.json"), `${JSON.stringify(out, null, 2)}\n`, "utf8");
  return { posts: Object.keys(out.posts).length, products: out.products.length, written, skipped, path: "/social-x.json" };
}
