import { getSaasApiBase } from "./saasBase";

export type AiError = Error & { status?: number; code?: string };
export type ChatTurn = { role: "user" | "assistant"; content: string };

async function postAi<T>(
  path: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  const res = await fetch(`${getSaasApiBase()}/api/ai/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(
      (data?.message as string) || "Yapay zekâ isteği başarısız.",
    ) as AiError;
    err.status = res.status;
    err.code = data?.error as string | undefined;
    throw err;
  }
  return data as T;
}

/** PDF metnini özetler (Pro/Business/Admin). */
export async function aiSummarize(
  text: string,
  lang: "tr" | "en",
  token: string | null,
): Promise<string> {
  const d = await postAi<{ summary?: string }>("summarize", { text, lang }, token);
  return d.summary ?? "";
}

/** Belge bağlamında soru yanıtlar. */
export async function aiChat(
  text: string,
  question: string,
  history: ChatTurn[],
  lang: "tr" | "en",
  token: string | null,
): Promise<string> {
  const d = await postAi<{ answer?: string }>(
    "chat",
    { text, question, history, lang },
    token,
  );
  return d.answer ?? "";
}
