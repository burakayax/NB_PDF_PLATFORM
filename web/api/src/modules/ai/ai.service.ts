import { env } from "../../config/env.js";
import { getSetting } from "../../lib/site-config.service.js";
import { SITE_SETTING_KEYS } from "../../lib/site-setting-keys.js";

const API_URL = "https://api.anthropic.com/v1/messages";
/** Maliyet sınırı: belge bu karakter sayısının üstündeyse kırpılır (~15K token). */
const MAX_DOC_CHARS = 60_000;

export type ChatTurn = { role: "user" | "assistant"; content: string };
type Lang = "tr" | "en";

/** API anahtarı tanımlı mı? Boşsa AI tamamen kapalı. */
export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

/**
 * Global AI kill-switch — `featureFlags.aiDisabled === true` ise AI KAPALI.
 * Varsayılan (bayrak yok / okuma hatası) → AÇIK (anahtar varsa). Admin acil
 * durumda "Sistem Kontrol"den kapatabilir.
 */
export async function isAiEnabledByFlag(): Promise<boolean> {
  try {
    const raw = await getSetting(SITE_SETTING_KEYS.GLOBAL_FLAGS);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const ff = (raw as Record<string, unknown>).featureFlags;
      if (ff && typeof ff === "object" && !Array.isArray(ff)) {
        return (ff as Record<string, unknown>).aiDisabled !== true;
      }
    }
  } catch {
    /* okuma hatası → açık varsay (anahtar zaten gate'liyor) */
  }
  return true;
}

async function callClaude(
  system: string,
  messages: ChatTurn[],
  maxTokens: number,
): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("AI not configured");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

/** PDF metnini profesyonel, zengin ve yapılandırılmış biçimde özetler. */
export async function summarizeDocument(text: string, lang: Lang): Promise<string> {
  const doc = text.slice(0, MAX_DOC_CHARS);
  const system =
    lang === "tr"
      ? `Sen üst düzey bir belge analisti ve özetleme uzmanısın. Verilen PDF belgesini TÜRKÇE, PROFESYONEL ve KAPSAMLI biçimde özetle.

ÖNCE belgenin TÜRÜNÜ ve kimi ilgilendirdiğini belirle (ör. ihale şartnamesi, sözleşme, mahkeme kararı/dilekçe, akademik makale/tez, mali/finansal rapor, sunum, kullanım kılavuzu, CV, tıbbi rapor, resmi yazı...). SONRA o türe ve okuyucuya EN ÇOK LAZIM OLAN bilgileri öne çıkar. Boş/ilgisiz bölüm YAZMA.

Çıktıyı şu markdown iskeletiyle ver (bölümleri belgeye göre uyarla; veri yoksa o bölümü atla):

# (Belgenin kısa, açıklayıcı başlığı)

**Belge türü:** (tek satır) · **İlgili:** (kimi ilgilendirir)

**Özet:** (Belgeyi 2-4 cümlede net anlatan giriş.)

## Taraflar / İlgili Kişi ve Kurumlar
(Adı geçen kişiler, kurumlar, taraflar — rolleriyle birlikte. İsim yoksa bu bölümü atla.)

## Ana Noktalar
(Belgenin en önemli bilgileri, şartları, argümanları veya bulguları — madde madde.)

## Kritik Tarih, Tutar ve Yükümlülükler
(Son başvuru/teslim tarihi, süreler, teminat, cayma bedeli, ceza, ücret, bütçe gibi
sayısal ve BAĞLAYICI bilgiler — hepsini **kalın** yaz. Belgede yoksa bu bölümü atla.)

## Dikkat / Sonuç ve Çıkarımlar
(Atlanmaması gereken riskler, koşullar, öneriler veya belgenin vardığı sonuç.)

BELGE TÜRÜNE GÖRE ODAK ÖRNEKLERİ:
- İhale/şartname → taraflar (idare/istekli), iş kapsamı, istenen belge ve nitelikler, teminat, cayma bedeli, son teklif tarihi, değerlendirme kriteri.
- Sözleşme → taraflar, konu, süre, bedel, yükümlülükler, fesih/ceza şartları, yürürlük.
- Hukuki (dilekçe/karar) → taraflar, dava/talep konusu, gerekçe, hüküm, süre/itiraz hakkı.
- Akademik (makale/tez) → araştırma sorusu, yöntem, bulgular, sonuç, katkı.
- Mali rapor → dönem, gelir/gider, kâr/zarar, dikkat çeken kalemler, öngörüler.

KURALLAR: YALNIZCA belgedeki bilgiyi kullan, ASLA uydurma. Emin olmadığın veriyi yazma. Bir başlığın altına yazacak SOMUT bilgi yoksa o başlığı HİÇ yazma — ASLA boş başlık bırakma. Akıcı, profesyonel ve nesnel dil. Gereksiz tekrar yok.`
      : `You are a senior document analyst and summarization expert. Summarize the given PDF in ENGLISH, PROFESSIONALLY and COMPREHENSIVELY.

FIRST determine the document TYPE and who it concerns (e.g. tender/RFP, contract, court filing/decision, academic paper/thesis, financial report, presentation, manual, CV, medical report, official letter...). THEN surface the information MOST USEFUL to that type and reader. Do NOT write empty/irrelevant sections.

Output using this markdown skeleton (adapt to the document; skip a section if no data):

# (A short, descriptive title)

**Document type:** (one line) · **Relevant to:** (who it concerns)

**Summary:** (A clear 2-4 sentence overview.)

## Parties / People & Organizations
(Named people, organizations, parties — with their roles. Skip if none.)

## Key Points
(The most important facts, terms, arguments or findings — as bullets.)

## Critical Dates, Amounts & Obligations
(Deadlines, durations, deposits, penalties, fees, budgets — all binding/numeric info, in **bold**. Skip if none.)

## Watch-outs / Conclusions & Takeaways
(Risks or conditions not to miss, recommendations, or the document's conclusion.)

FOCUS EXAMPLES BY TYPE:
- Tender/RFP → parties, scope, required documents/qualifications, deposit, withdrawal penalty, submission deadline, evaluation criteria.
- Contract → parties, subject, term, price, obligations, termination/penalty clauses, effective date.
- Legal → parties, claims, reasoning, ruling, deadlines/appeal rights.
- Academic → research question, method, findings, conclusion, contribution.
- Financial → period, income/expense, profit/loss, notable items, projections.

RULES: Use ONLY info from the document, NEVER invent. Don't state data you're unsure about. If a section has no concrete information, OMIT that heading entirely — NEVER leave an empty heading. Fluent, professional, objective tone. No redundancy.`;
  return callClaude(system, [{ role: "user", content: doc }], 2500);
}

/** Çıkarılan yapılandırılmış veri şeması (frontend ile paylaşılır). */
export type ExtractedData = {
  docType: string;
  fields: Array<{ label: string; value: string }>;
  tables: Array<{ title?: string; columns: string[]; rows: string[][] }>;
  note?: string;
};

/** PDF'ten yapılandırılmış veri çıkarır (fatura/ihale/tablo → alanlar + kalemler). */
export async function extractData(text: string, lang: Lang): Promise<ExtractedData> {
  const doc = text.slice(0, MAX_DOC_CHARS);
  const system =
    lang === "tr"
      ? `Sen bir belge veri-çıkarma uzmanısın. Verilen PDF metninden yapılandırılmış veriyi çıkar.
ÖNCE belge türünü belirle (fatura, irsaliye, ihale şartnamesi, sözleşme, banka ekstresi, form, tablo, makbuz...).
SONRA o türe göre EN ÖNEMLİ alanları (anahtar-değer) ve varsa satır kalemlerini/tabloyu çıkar.
Örnek alanlar: fatura no, tarih, satıcı, alıcı, vergi no, ara toplam, KDV, genel toplam, son ödeme tarihi, taraflar, teminat, sözleşme bedeli...
Satır kalemleri varsa (ürün/hizmet listesi, tablolar) tablo olarak çıkar.

YALNIZCA aşağıdaki JSON şemasında, başka HİÇBİR metin olmadan (markdown/backtick YOK) yanıt ver:
{"docType":"...","fields":[{"label":"...","value":"..."}],"tables":[{"title":"...","columns":["..."],"rows":[["..."]]}],"note":"..."}

KURALLAR: Yalnızca belgedeki bilgiyi kullan, ASLA uydurma. Bulunmayan alanı yazma. Para/tarih değerlerini belgedeki gibi bırak. tables boşsa []. note kısa (bir cümle) veya boş.`
      : `You are a document data-extraction expert. Extract structured data from the given PDF text.
FIRST determine the document type (invoice, delivery note, tender/RFP, contract, bank statement, form, table, receipt...).
THEN extract the MOST IMPORTANT fields (key-value) and any line items/tables for that type.
Example fields: invoice no, date, seller, buyer, tax id, subtotal, VAT, total, due date, parties, deposit, contract value...
If there are line items (product/service lists, tables), extract them as a table.

Respond ONLY with the following JSON schema, with NO other text (NO markdown/backticks):
{"docType":"...","fields":[{"label":"...","value":"..."}],"tables":[{"title":"...","columns":["..."],"rows":[["..."]]}],"note":"..."}

RULES: Use only info from the document, NEVER invent. Skip fields not present. Keep money/date values as in the document. tables = [] if none. note is short (one sentence) or empty.`;
  const raw = await callClaude(system, [{ role: "user", content: doc }], 2500);
  // Model bazen ``` ile sarar — temizle, sonra ilk { ... } bloğunu ayıkla.
  let jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = jsonText.indexOf("{");
  const last = jsonText.lastIndexOf("}");
  if (first >= 0 && last > first) jsonText = jsonText.slice(first, last + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI_EXTRACT_PARSE");
  }
  const p = parsed as Partial<ExtractedData>;
  return {
    docType: typeof p.docType === "string" ? p.docType : "",
    fields: Array.isArray(p.fields)
      ? p.fields.filter((f) => f && typeof f.label === "string").map((f) => ({ label: String(f.label), value: String(f.value ?? "") }))
      : [],
    tables: Array.isArray(p.tables)
      ? p.tables
          .filter((t) => t && Array.isArray(t.columns) && Array.isArray(t.rows))
          .map((t) => ({
            title: typeof t.title === "string" ? t.title : undefined,
            columns: t.columns.map((c) => String(c)),
            rows: t.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c)) : [])),
          }))
      : [],
    note: typeof p.note === "string" && p.note.trim() ? p.note.trim() : undefined,
  };
}

/** Hassas veri tespiti sonucu. */
export type SensitiveItem = { type: string; value: string };

/** Belgedeki hassas/kişisel verileri bulur (isim, adres, kimlik, hesap no vb.).
 * Regex'in kaçırdığı bağlamsal PII için. Döndürülen value'lar belgede GEÇTİĞİ gibi olmalı. */
export async function detectSensitive(text: string, lang: Lang): Promise<SensitiveItem[]> {
  const doc = text.slice(0, MAX_DOC_CHARS);
  const system =
    lang === "tr"
      ? `Bir belgedeki KİŞİSEL/HASSAS verileri tespit eden bir uzmansın. Verilen metinden kişi adları, adresler, kimlik/pasaport numaraları, hesap/IBAN, telefon, e-posta, doğum tarihi, plaka gibi hassas bilgileri bul.
YALNIZCA şu JSON şemasında, başka HİÇBİR metin olmadan (markdown/backtick YOK) yanıt ver:
{"items":[{"type":"isim|adres|kimlik|hesap|telefon|eposta|tarih|diger","value":"..."}]}
ÇOK ÖNEMLİ: value, metinde GEÇTİĞİ GİBİ birebir olmalı (kırpma/biçim değiştirme yok) — aksi halde gizlenemez. Hassas olmayan genel kelimeleri EKLEME. Yoksa items: [].`
      : `You detect PERSONAL/SENSITIVE data in a document. From the given text, find sensitive information like person names, addresses, ID/passport numbers, account/IBAN, phone, email, date of birth, license plates.
Respond ONLY with this JSON schema, with NO other text (NO markdown/backticks):
{"items":[{"type":"name|address|id|account|phone|email|date|other","value":"..."}]}
VERY IMPORTANT: value must be EXACTLY as it appears in the text (no trimming/reformatting) — otherwise it can't be redacted. Do NOT include generic non-sensitive words. If none, items: [].`;
  const raw = await callClaude(system, [{ role: "user", content: doc }], 1500);
  let jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = jsonText.indexOf("{");
  const last = jsonText.lastIndexOf("}");
  if (first >= 0 && last > first) jsonText = jsonText.slice(first, last + 1);
  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const rawItems: Array<{ type?: unknown; value?: unknown }> = Array.isArray(parsed.items) ? parsed.items : [];
  return rawItems
    .filter((i) => i && typeof i.value === "string" && i.value.trim().length > 1)
    .map((i) => ({ type: typeof i.type === "string" ? i.type : "diger", value: String(i.value) }));
}

/** İki belge karşılaştırma sonucu (frontend ile paylaşılır). */
export type CompareResult = {
  summary: string;
  changes: Array<{ type: "added" | "removed" | "changed"; title: string; detail: string }>;
};

/** İki belgeyi karşılaştırır; anlamlı farkları (eklenen/çıkarılan/değişen) çıkarır. */
export async function compareDocuments(textA: string, textB: string, lang: Lang): Promise<CompareResult> {
  const a = textA.slice(0, 30_000);
  const b = textB.slice(0, 30_000);
  const system =
    lang === "tr"
      ? `İki belgeyi (A = eski/ilk sürüm, B = yeni/ikinci sürüm) karşılaştıran bir analiz uzmanısın.
ANLAMLI farkları bul: eklenen maddeler/bölümler, çıkarılanlar ve değiştirilenler (özellikle tutar, tarih, süre, taraf, yükümlülük, ceza gibi bağlayıcı değişiklikler). Biçimsel/önemsiz farkları (boşluk, sayfa no) YOK say.
YALNIZCA şu JSON şemasında, başka HİÇBİR metin olmadan (markdown/backtick YOK) yanıt ver:
{"summary":"...","changes":[{"type":"added|removed|changed","title":"...","detail":"..."}]}
type: "added" (B'de var, A'da yok), "removed" (A'da var, B'de yok), "changed" (ikisinde de var ama farklı). title kısa başlık; detail A→B değişimini net anlatır. summary bir-iki cümle genel değerlendirme. Fark yoksa changes: [].`
      : `You are an analyst comparing two documents (A = old/first version, B = new/second version).
Find MEANINGFUL differences: added clauses/sections, removed ones, and changed ones (especially binding changes to amounts, dates, terms, parties, obligations, penalties). Ignore trivial/formatting differences (whitespace, page numbers).
Respond ONLY with this JSON schema, with NO other text (NO markdown/backticks):
{"summary":"...","changes":[{"type":"added|removed|changed","title":"...","detail":"..."}]}
type: "added" (in B, not in A), "removed" (in A, not in B), "changed" (in both but different). title is a short heading; detail clearly describes the A→B change. summary is a one-two sentence overall assessment. If no differences, changes: [].`;
  const raw = await callClaude(system, [{ role: "user", content: `--- BELGE A ---\n${a}\n\n--- BELGE B ---\n${b}` }], 3000);
  let jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = jsonText.indexOf("{");
  const last = jsonText.lastIndexOf("}");
  if (first >= 0 && last > first) jsonText = jsonText.slice(first, last + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI_COMPARE_PARSE");
  }
  const p = parsed as { summary?: unknown; changes?: unknown };
  const rawChanges: Array<{ type?: unknown; title?: unknown; detail?: unknown }> = Array.isArray(p.changes) ? p.changes : [];
  return {
    summary: typeof p.summary === "string" ? p.summary : "",
    changes: rawChanges
      .filter((c) => c && (c.type === "added" || c.type === "removed" || c.type === "changed"))
      .map((c) => ({ type: c.type as "added" | "removed" | "changed", title: String(c.title ?? ""), detail: String(c.detail ?? "") })),
  };
}

/** Desteklenen hedef diller (kod → İngilizce ad; prompt netliği için). */
const TRANSLATE_LANGS: Record<string, string> = {
  en: "English", tr: "Turkish", de: "German", fr: "French", es: "Spanish",
  it: "Italian", pt: "Portuguese", ru: "Russian", ar: "Arabic",
  zh: "Chinese (Simplified)", ja: "Japanese", nl: "Dutch",
};

/** PDF metnini hedef dile çevirir; yapı/format korunur. */
export async function translateDocument(text: string, targetCode: string): Promise<string> {
  const doc = text.slice(0, MAX_DOC_CHARS);
  const target = TRANSLATE_LANGS[targetCode] ?? "English";
  const system = `You are a professional translator. Translate the document below into ${target}.
Preserve the meaning, tone, structure and layout: keep headings, paragraphs, lists and tables (use markdown for structure). Translate names/terms naturally; keep numbers, dates, codes and proper nouns intact. Do NOT add any commentary, notes or explanations. Output ONLY the translated document.`;
  return callClaude(system, [{ role: "user", content: doc }], 8000);
}

function extractJsonArray(s: string): string {
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

function extractJsonObject(s: string): string {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

/** Konum-koruyan çeviri: PDF'ten çıkarılan metin SATIRLARINI (okuma sırasında) hedef dile çevirir.
 *
 * NEDEN İNDEKSLİ NESNE (dizi değil): analyze metni span bazında çıkarır; çağıran taraf aynı
 * satırdaki span'ları birleştirse bile, düz DİZİ protokolünde model parça-cümleleri anlamlı hale
 * getirmek için BİRLEŞTİRİYOR/BÖLÜYOR → dönen sayı tutmuyor → tüm chunk orijinale düşüyordu
 * ("bazı yerleri çevirdi bazı yerleri bıraktı"). İNDEKSLİ NESNE ({ "0": "...", ... }) her satırı
 * kendi anahtarına sabitler: sayı/sıra kaybolmaz, eksik anahtar TAM olarak tespit edilip yeniden
 * denenir. (Gerçek ihale belgesinde ölçüldü: dizi %50 orijinal kalıyordu → nesne %100 çeviri.)
 *
 * API/yapılandırma hatası (eksik anahtar, geçersiz model, 401/402/429) callClaude'dan FIRLAR ve
 * burada YUTULMAZ → controller gerçek hata döndürür (kota harcanmaz), sessiz no-op olmaz. */
export async function translateSegments(texts: string[], targetCode: string): Promise<string[]> {
  if (texts.length === 0) return [];
  const target = TRANSLATE_LANGS[targetCode] ?? "English";
  const system = `You are a professional translator. The user sends a JSON object mapping index keys to lines of text extracted from a PDF, in reading order. Translate EACH line into ${target}.
Rules:
- Return ONLY a JSON object with the EXACT SAME keys as the input — every key present, none added or removed.
- Each value = the ${target} translation of that line's text. Translate labels and single words too (e.g. "E-Dönüştür").
- Keep numbers, dates, codes, currency symbols and proper nouns intact.
- If a line has no translatable word (pure number/symbol/code), copy it unchanged.
- No commentary. Output ONLY the JSON object.`;

  const out = new Array<string>(texts.length);
  const done = new Array<boolean>(texts.length).fill(false);

  // Verilen indeks kümesini indeksli-nesne protokolüyle çevirir; dönen anahtarları out'a yazar.
  // Parse hatası → sessizce döner (eksikler dışarıda toplanıp yeniden denenir). API hatası → FIRLAR.
  async function translateKeys(indices: number[]): Promise<void> {
    if (indices.length === 0) return;
    const obj: Record<string, string> = {};
    for (const i of indices) obj[String(i)] = texts[i];
    const raw = await callClaude(system, [{ role: "user", content: JSON.stringify(obj) }], 8000);
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(raw));
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    const rec = parsed as Record<string, unknown>;
    for (const i of indices) {
      const v = rec[String(i)];
      if (typeof v === "string" && v.length > 0) {
        out[i] = v;
        done[i] = true;
      }
    }
  }

  const CHUNK = 40;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const indices: number[] = [];
    for (let j = i; j < Math.min(i + CHUNK, texts.length); j++) indices.push(j);
    await translateKeys(indices);
  }

  // Eksik kalan indeksler (model anahtar düşürdü / parse hatası): önce küçük partiler, sonra
  // TEK TEK (tek anahtarda birleştirme imkânsız → kesin çözülür) yeniden dene.
  let missing = texts.map((_, i) => i).filter((i) => !done[i]);
  for (let pass = 0; pass < 2 && missing.length > 0; pass++) {
    const size = pass === 0 ? 10 : 1;
    for (let k = 0; k < missing.length; k += size) {
      await translateKeys(missing.slice(k, k + size));
    }
    missing = texts.map((_, i) => i).filter((i) => !done[i]);
  }

  // Hâlâ çözülmeyen (ör. gerçekten çevrilemez içerik) → orijinali koru.
  for (let i = 0; i < texts.length; i++) if (!done[i]) out[i] = texts[i];
  return out;
}

/** Belge bağlamında kullanıcı sorusunu yanıtlar (geçmişle birlikte). */
export async function chatWithDocument(
  text: string,
  history: ChatTurn[],
  question: string,
  lang: Lang,
): Promise<string> {
  const doc = text.slice(0, MAX_DOC_CHARS);
  const system =
    lang === "tr"
      ? `Aşağıdaki PDF belgesine dayanarak kullanıcının sorularını TÜRKÇE yanıtla. YALNIZCA belgedeki bilgiyi kullan; belgede yoksa "Bu bilgi belgede yok." de. Kısa ve net ol.\n\n--- BELGE ---\n${doc}`
      : `Answer the user's questions based ONLY on the following PDF document. If the answer isn't in the document, say "This isn't in the document." Be concise and clear.\n\n--- DOCUMENT ---\n${doc}`;
  // Son 8 turu bağlama al (maliyet sınırı), ardından yeni soru.
  const messages: ChatTurn[] = [...history.slice(-8), { role: "user", content: question }];
  return callClaude(system, messages, 800);
}
