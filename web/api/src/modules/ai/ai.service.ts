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
