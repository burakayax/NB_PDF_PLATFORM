import { describe, expect, it } from "vitest";
import { estimateCostUsd, recordClaudeUsage, trackAiUsage } from "../modules/ai/ai-usage.js";

describe("yapay zekâ token kaydı", () => {
  it("bir istekteki birden çok model çağrısını toplar", async () => {
    let got: { model: string | null; inputTokens: number; outputTokens: number; calls: number } | null = null;
    await trackAiUsage(
      async () => {
        recordClaudeUsage({ model: "claude-haiku-5-5", usage: { input_tokens: 100, output_tokens: 20 } });
        recordClaudeUsage({ model: "claude-haiku-5-5", usage: { input_tokens: 50, output_tokens: 5 } });
      },
      (u) => {
        got = { ...u };
      },
    );
    expect(got).toEqual({ model: "claude-haiku-5-5", inputTokens: 150, outputTokens: 25, calls: 2 });
  });
  it("iş hata verse de o ana kadarki kullanım bildirilir", async () => {
    let calls = 0;
    await expect(
      trackAiUsage(
        async () => {
          recordClaudeUsage({ model: "m", usage: { input_tokens: 7, output_tokens: 1 } });
          throw new Error("x");
        },
        (u) => {
          calls = u.calls;
        },
      ),
    ).rejects.toThrow("x");
    expect(calls).toBe(1);
  });
  it("bağlam yokken ve bozuk veride hata fırlatmaz", () => {
    expect(() => recordClaudeUsage({ usage: { input_tokens: 1 } })).not.toThrow();
    expect(() => recordClaudeUsage(null)).not.toThrow();
  });
  it("maliyet yalnız fiyat tablosu verilmişse hesaplanır", () => {
    const table = JSON.stringify({ a: { in: 1, out: 5 } });
    expect(estimateCostUsd("a", 1_000_000, 200_000, table)).toBe(2);
    expect(estimateCostUsd("b", 10, 10, table)).toBeNull();
    expect(estimateCostUsd("a", 10, 10, undefined)).toBeNull();
    expect(estimateCostUsd("a", 10, 10, "bozuk")).toBeNull();
  });
});
