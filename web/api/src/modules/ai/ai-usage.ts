import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Yapay zekâ isteğinin model ve token kullanımını toplar.
 * `runWithQuota` işi bu bağlamda çalıştırır; `callClaude` her yanıtta kullanımı ekler (bir istek birden çok
 * model çağrısı yapabilir, ör. çeviri). Bağlam yoksa (ör. başka çağıranlar) hiçbir şey yapılmaz.
 */
export type AiUsage = { model: string | null; inputTokens: number; outputTokens: number; calls: number };

const store = new AsyncLocalStorage<AiUsage>();

/** İş hata verse bile o ana kadar harcanan token'ları kaybetmemek için kullanım nesnesini ayrıca döndürür. */
export function trackAiUsage<T>(work: () => Promise<T>, onDone: (u: AiUsage) => void): Promise<T> {
  const usage: AiUsage = { model: null, inputTokens: 0, outputTokens: 0, calls: 0 };
  return store.run(usage, async () => {
    try {
      return await work();
    } finally {
      onDone(usage);
    }
  });
}

/** Claude yanıtındaki `model` ve `usage` alanlarını (varsa) güncel isteğin toplamına ekler. ASLA hata fırlatmaz. */
export function recordClaudeUsage(data: unknown): void {
  try {
    const u = store.getStore();
    if (!u || !data || typeof data !== "object") return;
    const d = data as { model?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } };
    const inT = Number(d.usage?.input_tokens);
    const outT = Number(d.usage?.output_tokens);
    if (Number.isFinite(inT)) u.inputTokens += Math.max(0, Math.round(inT));
    if (Number.isFinite(outT)) u.outputTokens += Math.max(0, Math.round(outT));
    if (typeof d.model === "string" && d.model) u.model = u.model && u.model !== d.model ? "mixed" : d.model;
    u.calls += 1;
  } catch {
    /* ölçüm işi bozmaz */
  }
}

/**
 * Tahmini maliyet (USD). Fiyatlar kodda SABİT değildir: AI_PRICE_USD_PER_MTOK ortam değişkeninde
 * {"model-adı":{"in":1,"out":5}} biçiminde (1 milyon token başına USD) verilir. Fiyatı bilinmeyen model → null.
 */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number, raw = process.env.AI_PRICE_USD_PER_MTOK): number | null {
  if (!raw) return null;
  try {
    const table = JSON.parse(raw) as Record<string, { in?: number; out?: number }>;
    const p = table[model];
    if (!p || typeof p.in !== "number" || typeof p.out !== "number") return null;
    return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  } catch {
    return null;
  }
}
