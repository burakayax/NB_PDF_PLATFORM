import { getSaasApiBase } from "./saasBase";

export type AiQuota = {
  used: number;
  limit: number | null; // null = sınırsız (admin)
  remaining: number | null;
  bonus?: number; // top-up ile alınan ek kredi (kalıcı)
  unlimited: boolean;
  resetAt: string;
};

export type TopupPack = { id: string; credits: number; priceUSD: number; priceTRY: number; popular?: boolean };

/** Ek AI kredisi paketleri. */
export async function fetchTopupPacks(token: string | null): Promise<TopupPack[]> {
  try {
    const res = await fetch(`${getSaasApiBase()}/api/ai/topup/packs`, { headers: authHeaders(token), credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { packs?: TopupPack[] };
    return data.packs ?? [];
  } catch { return []; }
}

/** ADMIN: paket kadar kredi ver (manuel/test). Ödeme açılınca callback grantAiCredits çağıracak. */
export async function topupGrant(packId: string, token: string | null): Promise<{ quota?: AiQuota }> {
  return postAi<{ quota?: AiQuota }>("topup/grant", { packId }, token);
}
export type AiError = Error & { status?: number; code?: string; quota?: AiQuota };
export type ChatTurn = { role: "user" | "assistant"; content: string };

function authHeaders(token: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      (data?.message as string) || "Yapay zekâ isteği başarısız.",
    ) as AiError;
    err.status = res.status;
    err.code = data?.error as string | undefined;
    if (data?.quota) err.quota = data.quota as AiQuota;
    throw err;
  }
  return data as T;
}

async function postAi<T>(path: string, body: unknown, token: string | null): Promise<T> {
  const res = await fetch(`${getSaasApiBase()}/api/ai/${path}`, {
    method: "POST",
    headers: authHeaders(token),
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

/** Bu ayki AI kotası (kalan hak göstergesi). */
export async function fetchAiQuota(token: string | null): Promise<AiQuota | null> {
  try {
    const res = await fetch(`${getSaasApiBase()}/api/ai/quota`, {
      headers: authHeaders(token),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { quota?: AiQuota };
    return data.quota ?? null;
  } catch {
    return null;
  }
}

/** PDF metnini özetler (Pro/Business/Admin). */
export async function aiSummarize(
  text: string,
  lang: "tr" | "en",
  token: string | null,
): Promise<{ summary: string; quota?: AiQuota }> {
  const d = await postAi<{ summary?: string; quota?: AiQuota }>("summarize", { text, lang }, token);
  return { summary: d.summary ?? "", quota: d.quota };
}

/** Yapılandırılmış veri çıkarma sonucu (backend ExtractedData ile aynı). */
export type ExtractedData = {
  docType: string;
  fields: Array<{ label: string; value: string }>;
  tables: Array<{ title?: string; columns: string[]; rows: string[][] }>;
  note?: string;
};

/** PDF'ten yapılandırılmış veri çıkarır (fatura/ihale/tablo → alanlar + kalemler). */
export async function aiExtract(
  text: string,
  lang: "tr" | "en",
  token: string | null,
): Promise<{ data: ExtractedData; quota?: AiQuota }> {
  const d = await postAi<{ data?: ExtractedData; quota?: AiQuota }>("extract", { text, lang }, token);
  return {
    data: d.data ?? { docType: "", fields: [], tables: [] },
    quota: d.quota,
  };
}

/** Desteklenen çeviri hedef dilleri (kod → TR/EN görünen ad). */
export const TRANSLATE_TARGETS: Array<{ code: string; tr: string; en: string }> = [
  { code: "en", tr: "İngilizce", en: "English" },
  { code: "tr", tr: "Türkçe", en: "Turkish" },
  { code: "de", tr: "Almanca", en: "German" },
  { code: "fr", tr: "Fransızca", en: "French" },
  { code: "es", tr: "İspanyolca", en: "Spanish" },
  { code: "it", tr: "İtalyanca", en: "Italian" },
  { code: "pt", tr: "Portekizce", en: "Portuguese" },
  { code: "ru", tr: "Rusça", en: "Russian" },
  { code: "ar", tr: "Arapça", en: "Arabic" },
  { code: "zh", tr: "Çince", en: "Chinese" },
  { code: "ja", tr: "Japonca", en: "Japanese" },
  { code: "nl", tr: "Felemenkçe", en: "Dutch" },
];

/** PDF metnini hedef dile çevirir (yapı korunur). */
export async function aiTranslate(
  text: string,
  target: string,
  token: string | null,
): Promise<{ translation: string; quota?: AiQuota }> {
  const d = await postAi<{ translation?: string; quota?: AiQuota }>("translate", { text, target }, token);
  return { translation: d.translation ?? "", quota: d.quota };
}

/** Hassas veri tespiti öğesi. */
export type SensitiveItem = { type: string; value: string };

/** Belgedeki hassas verileri (isim/adres vb.) yapay zekâ ile tespit eder. */
export async function aiDetectSensitive(
  text: string,
  lang: "tr" | "en",
  token: string | null,
): Promise<{ items: SensitiveItem[]; quota?: AiQuota }> {
  const d = await postAi<{ items?: SensitiveItem[]; quota?: AiQuota }>("detect-sensitive", { text, lang }, token);
  return { items: Array.isArray(d.items) ? d.items : [], quota: d.quota };
}

/** İki belge karşılaştırma sonucu. */
export type CompareResult = {
  summary: string;
  changes: Array<{ type: "added" | "removed" | "changed"; title: string; detail: string }>;
};

/** İki PDF'i karşılaştırır (farkları çıkarır). */
export async function aiCompare(
  textA: string,
  textB: string,
  lang: "tr" | "en",
  token: string | null,
): Promise<{ result: CompareResult; quota?: AiQuota }> {
  const d = await postAi<{ result?: CompareResult; quota?: AiQuota }>("compare", { textA, textB, lang }, token);
  return { result: d.result ?? { summary: "", changes: [] }, quota: d.quota };
}

/** Belge bağlamında soru yanıtlar. */
export async function aiChat(
  text: string,
  question: string,
  history: ChatTurn[],
  lang: "tr" | "en",
  token: string | null,
): Promise<{ answer: string; quota?: AiQuota }> {
  const d = await postAi<{ answer?: string; quota?: AiQuota }>(
    "chat",
    { text, question, history, lang },
    token,
  );
  return { answer: d.answer ?? "", quota: d.quota };
}
