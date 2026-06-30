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

/** PDF metnini yapılandırılmış biçimde özetler. */
export async function summarizeDocument(text: string, lang: Lang): Promise<string> {
  const doc = text.slice(0, MAX_DOC_CHARS);
  const system =
    lang === "tr"
      ? "Sen bir PDF özetleme asistanısın. Verilen belgeyi TÜRKÇE, öz ve yapılandırılmış biçimde özetle. Markdown kullan: kısa bir genel bakış, ardından '## Ana Noktalar' altında madde işaretleri, gerekiyorsa '## Sonuç'. Yalnızca belgedeki bilgiyi kullan, uydurma."
      : "You are a PDF summarization assistant. Summarize the document in ENGLISH, concise and structured. Use markdown: a short overview, then '## Key Points' as bullets, and '## Conclusion' if relevant. Use only information from the document; do not invent.";
  return callClaude(system, [{ role: "user", content: doc }], 1200);
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
