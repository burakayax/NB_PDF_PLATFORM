import { getSaasApiBase } from "./saasBase";

export type AiQuota = {
  used: number;
  limit: number | null; // null = sınırsız (admin)
  remaining: number | null;
  unlimited: boolean;
  resetAt: string;
};
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
