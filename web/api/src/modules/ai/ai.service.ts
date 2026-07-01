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
      ? `Sen üst düzey bir belge analisti ve özetleme uzmanısın. Verilen PDF belgesini TÜRKÇE, PROFESYONEL ve zengin biçimde özetle. Çıktıyı tam olarak şu markdown yapısında ver:

# (Belgenin kısa ve açıklayıcı bir başlığı)

**Özet:** (Belgeyi 2-3 cümlede net biçimde özetleyen giriş.)

## Ana Konular
(Belgenin ele aldığı ana başlıklar/temalar — her biri madde ve tek satır açıklama.)

## Önemli Noktalar
(En kritik bilgiler, bulgular, argümanlar madde madde. Varsa önemli sayı, tarih, isim ve verileri **kalın** yaz.)

## Sonuç ve Çıkarımlar
(Belgenin vardığı sonuç, öneriler veya okuyucunun alması gereken dersler.)

KURALLAR: Yalnızca belgedeki bilgiyi kullan, ASLA uydurma. Belge kısaysa bölümleri kısalt ama yapıyı koru. Akıcı, profesyonel ve nesnel bir dil kullan. Gereksiz tekrar yapma.`
      : `You are a senior document analyst and summarization expert. Summarize the given PDF in ENGLISH, PROFESSIONALLY and richly. Output exactly this markdown structure:

# (A short, descriptive title of the document)

**Summary:** (A clear 2-3 sentence overview.)

## Key Topics
(The main themes/sections — each a bullet with a one-line note.)

## Key Points
(The most critical facts, findings, arguments as bullets. **Bold** important numbers, dates, names, and data.)

## Conclusions & Takeaways
(The document's conclusions, recommendations, or lessons for the reader.)

RULES: Use only info from the document, NEVER invent. If the document is short, shorten sections but keep the structure. Use fluent, professional, objective language. Avoid redundancy.`;
  return callClaude(system, [{ role: "user", content: doc }], 2000);
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
