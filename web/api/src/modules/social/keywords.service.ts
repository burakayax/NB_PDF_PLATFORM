/**
 * Gönderi terimlerinin ve etiketlerinin DAYANAĞI.
 *
 * TERİM ve ETİKET AYNI ŞEY DEĞİLDİR — bu ayrım bu dosyanın varlık sebebi:
 *   • TERİM, insanların arama kutusuna yazdığı şeydir ("pdf tablo görsel
 *     kaydetme"). Gönderi METNİNİN içinde doğal biçimde geçmesi işe yarar.
 *   • ETİKET, insanların etrafında zaten TOPLANDIĞI yerdir (#PDF). Cümle
 *     parçası bir etiketi kimse takip etmez, kimse aramaz.
 * Önceden arama terimleri doğrudan etikete çevriliyordu; "#PikselleşmeSorunu"
 * gibi sıfır erişimli etiketler bu yüzden oluşuyordu.
 *
 * KAYNAK SIRASI — güvenilirlikten tahmine doğru:
 *   0. Search Console — sitenin KENDİ ölçülmüş tıklamaları. En sağlamı.
 *   1. Google otomatik tamamlama — insanların gerçekten yazdığı ifadeler.
 *   2. SEO bankası — sitenin hedeflediği terimler.
 *   3. Yapay zekâ araştırması — yukarıdakileri ETİKETE çevirir ve boşluk doldurur.
 *
 * İlk üçü ücretsiz ve ölçüme dayalı. Yapay zekâ artık serbestçe terim uydurmuyor;
 * önüne konan gerçek veriden seçim yapıyor.
 *
 * SEO bankası (`/social-keywords.json`) build'de üretilir; her zaman vardır ve
 * diğer kaynaklar susarsa tek başına yeter.
 *
 * NEDEN ÖNBELLEK: Sonuç YAZI BAŞINA bir kez hesaplanır, gün başına değil.
 * Eski yazılar tekrar gündeme geldiğinde aynı araştırma yeniden ücretlendirilmez.
 */

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/file-log.js";
import { searchEvidence } from "./gsc.service.js";
import { suggestTerms } from "./suggest.service.js";
import type { QueryRow } from "./gsc.service.js";
import type { FeedItem } from "./social.types.js";

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const RESEARCH_TIMEOUT_MS = 120_000;

/** Aramanın maliyet tavanı: istek başına en fazla bu kadar arama. */
const MAX_SEARCHES = 2;
/** Önbellekteki terimler bu süreden eskiyse yeniden araştırılır. */
const CACHE_TTL_DAYS = 120;
/** Dil başına taşınacak en fazla terim. */
const MAX_TERMS = 10;
/** Dil başına taşınacak en fazla DAR etiket (geniş ve marka etiketi ayrı). */
const MAX_TAGS = 8;

export type KeywordSet = {
  /** Arama terimleri — gönderi metninin içinde geçmesi için. */
  tr: string[];
  en: string[];
  /** Doğrulanmış dar etiketler — "#" olmadan, tek/iki kelime. */
  tagsTr: string[];
  tagsEn: string[];
};

const EMPTY: KeywordSet = { tr: [], en: [], tagsTr: [], tagsEn: [] };

// ─── SEO bankası ──────────────────────────────────────────────────────────────

type Bank = Record<string, { tr?: string[]; en?: string[] }>;

let bankCache: { at: number; data: Bank } | null = null;
/** Banka build'de üretiliyor; saatte bir tazelemek fazlasıyla yeterli. */
const BANK_TTL_MS = 60 * 60 * 1000;

async function loadKeywordBank(): Promise<Bank> {
  if (bankCache && Date.now() - bankCache.at < BANK_TTL_MS) return bankCache.data;

  const url = `${env.FRONTEND_ORIGIN.replace(/\/$/, "")}/social-keywords.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Bank;
    bankCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    // Banka okunamazsa yazının kendi etiketlerine düşülür; otomasyon durmaz.
    logger.warn("social", `anahtar kelime bankası okunamadı: ${String(err)}`);
    bankCache = { at: Date.now(), data: {} };
    return {};
  }
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function dedupe(values: unknown[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    const key = value.toLocaleLowerCase("tr");
    if (!value || value.length > 60 || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Etiket olmaya uygun mu? Etiket kısa olmak zorunda: iki kelimeyi aşan bir
 * etiket birleştirildiğinde kimsenin aramadığı bir yığına dönüşür.
 */
function isTagLike(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 2 && value.length <= 28;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? dedupe(parsed, MAX_TERMS) : [];
  } catch {
    return [];
  }
}

// ─── Ölçülmüş kanıt (ücretsiz kaynaklar) ─────────────────────────────────────

/**
 * Rakip ürün adları.
 *
 * NEDEN ELENİYOR: Otomatik tamamlama ham gerçeği verir ve o gerçeğin içinde
 * rakiplerin adı da vardır ("pdf birleştirme ilove", "merge pdf adobe").
 * Bu ifadeler gerçekten aranıyor olabilir ama kendi gönderimizde rakibin
 * adını anmak ona bedava tanıtım yapmaktır. Etiket olarak kullanmaksa
 * doğrudan onun kitlesine hizmet eder.
 */
const COMPETITOR_WORDS = [
  "ilove",
  // Türkçe otomatik tamamlama "i love pdf" yerine "ı love" (noktasız ı)
  // yazabiliyor; karşılaştırma öncesi noktasız ı'ler i'ye çevriliyor.
  "i love",
  "smallpdf",
  "small pdf",
  "adobe",
  "acrobat",
  "pdf24",
  "sejda",
  "foxit",
  "nitro",
  "soda pdf",
  "canva",
  "pdfescape",
  "docfly",
  "lightpdf",
];

/** Terim kendi gönderimizde kullanılabilir mi? */
function isOwnTerm(value: string): boolean {
  const lower = value.toLowerCase().replace(/ı/g, "i");
  return !COMPETITOR_WORDS.some((brand) => lower.includes(brand));
}

/** Bir dil için toplanan gerçek veri. */
export type Evidence = { gsc: QueryRow[]; suggest: string[] };
export type EvidenceSet = { tr: Evidence; en: Evidence };

const NO_EVIDENCE: EvidenceSet = {
  tr: { gsc: [], suggest: [] },
  en: { gsc: [], suggest: [] },
};

/** Otomatik tamamlamaya verilecek tohumlar: başlık + bankadaki ilk terimler. */
function seedsFor(title: string, terms: string[]): string[] {
  return dedupe([title, ...terms], 6);
}

/**
 * Yazı için ölçülmüş veriyi toplar. İkisi de ücretsiz ve ikisi de hatayı
 * kendi içinde yutuyor — buradan hata çıkmaz, yalnızca eksik veri çıkar.
 */
async function gatherEvidence(item: FeedItem, seo: KeywordSet): Promise<EvidenceSet> {
  const trTitle = item.lang === "tr" ? item.title : (item.alt?.title ?? item.title);
  const enTitle = item.lang === "en" ? item.title : (item.alt?.title ?? item.title);
  const trLink = item.lang === "tr" ? item.link : (item.alt?.link ?? item.link);
  const enLink = item.lang === "en" ? item.link : (item.alt?.link ?? item.link);

  const [trGsc, enGsc, trSuggest, enSuggest] = await Promise.all([
    // Başlık önce: sayfanın kendi geçmişi yoksa site genelinde en ayırt edici
    // arama parçası odur ("PDF Araçları" gibi kategori adı değil).
    searchEvidence(trLink, [trTitle, ...seo.tr]),
    searchEvidence(enLink, [enTitle, ...seo.en]),
    suggestTerms(seedsFor(trTitle, seo.tr), "tr"),
    suggestTerms(seedsFor(enTitle, seo.en), "en"),
  ]);

  // Rakip adı geçen satırlar burada, tek yerde eleniyor: hem modele giden
  // özete hem de doğrudan terim listesine aynı süzgeç uygulanmış olsun.
  return {
    tr: { gsc: trGsc.filter((r) => isOwnTerm(r.query)), suggest: trSuggest.filter(isOwnTerm) },
    en: { gsc: enGsc.filter((r) => isOwnTerm(r.query)), suggest: enSuggest.filter(isOwnTerm) },
  };
}

/** Kanıtı modelin okuyabileceği kısa bir özete çevirir. */
function describeEvidence(ev: Evidence): string {
  const lines: string[] = [];
  if (ev.gsc.length > 0) {
    lines.push(
      "Search Console (sitenin KENDİ ölçülmüş verisi — tıklama/gösterim):",
      ...ev.gsc
        .slice(0, 15)
        .map((r) => `- "${r.query}" — ${r.clicks} tıklama, ${r.impressions} gösterim`),
    );
  }
  if (ev.suggest.length > 0) {
    lines.push(
      "Google otomatik tamamlama (popülerlik sırasında):",
      ...ev.suggest.slice(0, 20).map((q) => `- ${q}`),
    );
  }
  return lines.join("\n") || "(ölçülmüş veri yok)";
}

/**
 * Kanıttan doğrudan terim çıkarır (yapay zekâ olmadan).
 *
 * Sıralama kasıtlı: önce tıklama ALAN aramalar, sonra tıklama almadan çok
 * GÖSTERİLEN aramalar. İkincisi pazarlama açısından altın değerinde — insanlar
 * o aramada sizi görüyor ama tıklamıyor demektir; sosyal medyada vurgulanacak
 * yer tam olarak orası.
 */
function termsFromEvidence(ev: Evidence): string[] {
  const byClicks = [...ev.gsc].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  return dedupe([...byClicks.map((r) => r.query), ...ev.suggest], MAX_TERMS);
}

// ─── Canlı araştırma ──────────────────────────────────────────────────────────

const RESEARCH_SYSTEM = `Sen bir SEO ve sosyal medya araştırmacısısın.
Verilen konu için İKİ AYRI liste üret ve ikisini de web aramasıyla doğrula.

1) TERİMLER ("tr" / "en"): insanların arama kutusuna yazdığı ifadeler.
   - Uzun olabilir, cümleye benzeyebilir; bunlar gönderi METNİNDE geçecek.
   - En fazla 4 kelime.

2) ETİKETLER ("tags_tr" / "tags_en"): sosyal medyada O ETİKETİN ALTINDA
   GERÇEKTEN GÖNDERİ OLAN etiketler. Bunlar tıklanıp gezilen etiketlerdir.
   - "#" YAZMA, yalnızca kelimeyi yaz. Örnek: "PDF", "ofis ipuçları".
   - EN FAZLA 2 KELİME. Üç kelimelik etiket yazma.
   - Cümle parçası, sorun ifadesi ya da karşılaştırma yazma.
     KÖTÜ: "pikselleşme sorunu", "Instagram görsel kırpılması", "PNG vs JPEG"
     İYİ:  "PDF", "görsel düzenleme", "sosyal medya", "infografik"
   - Etiketin gerçekten kullanıldığını doğrulayamıyorsan LİSTEYE ALMA. Az ama
     doğru etiket, çok ama ölü etiketten iyidir.

ÖNCELİK — ÖLÇÜLMÜŞ VERİ: Sana "Ölçülmüş veri" başlığı altında gerçek rakamlar
verilecek. Search Console satırları sitenin KENDİ ölçülmüş tıklamalarıdır; otomatik
tamamlama satırları insanların gerçekten yazdığı ifadelerdir. Terimleri ÖNCE bu
listelerden seç. Kendi bildiğin terimi ancak listeler yetersiz kaldığında ekle ve
eklediğini web aramasıyla doğrula.

Ortak kurallar:
- Uydurma. Doğrulayamadığını listeleme. Marka adı uydurma.
- Türkçe liste Türkçe, İngilizce liste İngilizce olsun (çeviri değil, o dilde
  gerçekten kullanılan hâli).

Yanıtı YALNIZCA şu JSON biçiminde ver, başka hiçbir şey yazma:
{"tr":["..."],"en":["..."],"tags_tr":["..."],"tags_en":["..."]}`;

/** Yanıttaki tüm metin bloklarını birleştirir (arama blokları atlanır). */
function collectText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type: string; text: string } => {
      const block = b as { type?: unknown; text?: unknown };
      return block.type === "text" && typeof block.text === "string";
    })
    .map((b) => b.text)
    .join("\n");
}

function parseResearchJson(raw: string): KeywordSet {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return EMPTY;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const list = (key: string, max: number): string[] =>
      dedupe(Array.isArray(parsed[key]) ? (parsed[key] as unknown[]) : [], max);
    return {
      tr: list("tr", MAX_TERMS),
      en: list("en", MAX_TERMS),
      // Üç kelimeden uzun "etiketler" burada elenir: model kurala uymasa bile
      // gönderiye cümle parçası etiket çıkmasın.
      tagsTr: list("tags_tr", MAX_TAGS).filter(isTagLike),
      tagsEn: list("tags_en", MAX_TAGS).filter(isTagLike),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Konuyu internette araştırır.
 *
 * Sunucu tarafı arama aracı uzun sürdüğünde API `pause_turn` ile durur; bu
 * durumda yanıtı olduğu gibi geri göndererek devam ettiriyoruz. Aksi hâlde
 * araştırma yarıda kalır ve sonuç boş döner.
 */
async function researchOnline(item: FeedItem, evidence: EvidenceSet): Promise<KeywordSet> {
  if (!env.ANTHROPIC_API_KEY) return EMPTY;

  const topic = [item.title, item.alt?.title].filter(Boolean).join(" / ");
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    {
      role: "user",
      content: `Konu: ${topic}
Özet: ${item.summary.slice(0, 400) || "(yok)"}
Sitenin bu konudaki hedef terimleri: ${[...(item.keywords?.tr ?? []), ...(item.keywords?.en ?? [])]
        .slice(0, 12)
        .join(", ") || "(yok)"}

Ölçülmüş veri — TÜRKÇE:
${describeEvidence(evidence.tr)}

Ölçülmüş veri — İNGİLİZCE:
${describeEvidence(evidence.en)}

Yukarıdaki ölçülmüş veriyi temel alarak terimleri ve etiketleri üret.
Türkçe için en fazla ${MAX_TERMS}, İngilizce için en fazla ${MAX_TERMS} terim döndür.`,
    },
  ];

  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch(CLAUDE_URL, {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: 900,
        system: RESEARCH_SYSTEM,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
      }),
      signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Araştırma reddedildi (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    }

    const json = (await res.json()) as { content?: unknown; stop_reason?: string };
    if (json.stop_reason === "pause_turn") {
      // Duraklatılan yanıt AYNEN geri gönderilir; başka türlü devam etmiyor.
      messages.push({ role: "assistant", content: json.content });
      continue;
    }
    return parseResearchJson(collectText(json.content));
  }

  return EMPTY;
}

/**
 * Sonucu yazı başına saklar.
 *
 * `source` neyin elde edildiğini söyler: "research" yapay zekâ araştırması,
 * "evidence" yalnızca ücretsiz ölçülmüş kaynaklar. İkisi de taze sayılır;
 * yalnızca eski "seo" kayıtları yeniden denenir.
 */
async function saveCache(guid: string, set: KeywordSet, source: "research" | "evidence"): Promise<void> {
  const data = {
    trJson: JSON.stringify(set.tr),
    enJson: JSON.stringify(set.en),
    trTagsJson: JSON.stringify(set.tagsTr),
    enTagsJson: JSON.stringify(set.tagsEn),
    source,
  };
  await prisma.socialKeywordCache.upsert({
    where: { guid },
    create: { guid, ...data },
    update: data,
  });
}

// ─── Dışa açık ────────────────────────────────────────────────────────────────

/** Yazının SEO bankasındaki terimleri (araştırma yok, ücretsiz). */
export async function seoKeywordsFor(item: FeedItem): Promise<KeywordSet> {
  const bank = await loadKeywordBank();
  // Banka hem TR hem EN adresle anahtarlanmış; hangisi elimizdeyse o.
  const entry = bank[item.guid] ?? bank[item.link] ?? (item.alt ? bank[item.alt.link] : undefined);
  return {
    tr: dedupe([...(entry?.tr ?? []), ...item.categories], MAX_TERMS),
    en: dedupe([...(entry?.en ?? []), ...item.categories], MAX_TERMS),
    // Bankada etiket yok: banka arama terimlerinden oluşuyor. Etiket olmaya
    // uygun KISA olanları etiket adayı sayıyoruz; gerisini metin kurarken
    // geniş etiket havuzu tamamlıyor.
    tagsTr: dedupe([...(entry?.tr ?? []), ...item.categories], MAX_TERMS).filter(isTagLike),
    tagsEn: dedupe([...(entry?.en ?? []), ...item.categories], MAX_TERMS).filter(isTagLike),
  };
}

/**
 * Yazı için nihai terim kümesi.
 *
 * AKIŞ: önbellek → ölçülmüş kanıt (ücretsiz) → yapay zekâ araştırması (isteğe
 * bağlı, ücretli) → SEO bankası tamamlayıcı olarak.
 *
 * Araştırma KAPALI olsa bile ölçülmüş kanıt toplanır: Search Console ve
 * otomatik tamamlama ücretsiz, dolayısıyla kapatmak için sebep yok. Araştırma
 * yalnızca kanıtı etikete çevirme ve boşluk doldurma işini üstlenir.
 */
export async function keywordsFor(item: FeedItem, research: boolean): Promise<KeywordSet> {
  const seo = await seoKeywordsFor(item);

  const cached = await prisma.socialKeywordCache.findUnique({ where: { guid: item.guid } });
  const fresh =
    cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

  // "seo" kaydı, hiçbir dış kaynağın çalışmadığı bir denemeden kalmıştır;
  // onu taze saymak yazıyı kalıcı olarak zayıf etiketlere mahkûm ederdi.
  if (cached && fresh && cached.source !== "seo") {
    const tagsTr = parseJsonArray(cached.trTagsJson ?? "[]").filter(isTagLike);
    const tagsEn = parseJsonArray(cached.enTagsJson ?? "[]").filter(isTagLike);
    // Etiket sütunları BOŞSA kayıt eski sürümden kalmadır (o sürümde etiket
    // diye bir şey yoktu). Yeniden araştırmak yerine bankadan tamamlıyoruz —
    // aynı yazı için ikinci kez ücret ödenmesin.
    return {
      tr: dedupe([...parseJsonArray(cached.trJson), ...seo.tr], MAX_TERMS),
      en: dedupe([...parseJsonArray(cached.enJson), ...seo.en], MAX_TERMS),
      tagsTr: dedupe([...tagsTr, ...seo.tagsTr], MAX_TAGS),
      tagsEn: dedupe([...tagsEn, ...seo.tagsEn], MAX_TAGS),
    };
  }

  // Ücretsiz kaynaklar: araştırma açık olsun olmasın toplanır.
  let evidence = NO_EVIDENCE;
  try {
    evidence = await gatherEvidence(item, seo);
  } catch (err) {
    logger.warn("social", `ölçülmüş veri toplanamadı: ${String(err)}`);
  }

  /** Yapay zekâ devre dışıyken kanıtın kendisi terim listesi olur. */
  const evidenceOnly = (): KeywordSet => ({
    tr: dedupe([...termsFromEvidence(evidence.tr), ...seo.tr], MAX_TERMS),
    en: dedupe([...termsFromEvidence(evidence.en), ...seo.en], MAX_TERMS),
    // Kanıt ifadeleri arama sorgusudur, etiket değil; etiket olmaya uygun
    // kısa olanlar alınır, gerisini metin kurarken geniş havuz tamamlar.
    tagsTr: dedupe([...termsFromEvidence(evidence.tr).filter(isTagLike), ...seo.tagsTr], MAX_TAGS),
    tagsEn: dedupe([...termsFromEvidence(evidence.en).filter(isTagLike), ...seo.tagsEn], MAX_TAGS),
  });

  if (!research || !env.ANTHROPIC_API_KEY) {
    const plain = evidenceOnly();
    await saveCache(item.guid, plain, "evidence");
    return plain;
  }

  let found = EMPTY;
  try {
    found = await researchOnline({ ...item, keywords: seo }, evidence);
  } catch (err) {
    // Araştırma başarısızsa ölçülmüş kanıtla devam — gönderi yine de üretilir.
    logger.warn("social", `anahtar kelime araştırması başarısız: ${String(err)}`);
    return evidenceOnly();
  }

  if (found.tr.length === 0 && found.en.length === 0) return evidenceOnly();

  await saveCache(item.guid, found, "research");
  logger.info("social", `anahtar kelime araştırıldı: ${item.title}`);

  // Araştırılan terimler önce gelir; SEO bankası tamamlayıcı olarak eklenir.
  return {
    tr: dedupe([...found.tr, ...seo.tr], MAX_TERMS),
    en: dedupe([...found.en, ...seo.en], MAX_TERMS),
    tagsTr: dedupe([...found.tagsTr, ...seo.tagsTr], MAX_TAGS),
    tagsEn: dedupe([...found.tagsEn, ...seo.tagsEn], MAX_TAGS),
  };
}
