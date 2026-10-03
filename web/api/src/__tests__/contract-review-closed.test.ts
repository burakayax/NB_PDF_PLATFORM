import { describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: { JWT_ACCESS_SECRET: "x".repeat(40), ANTHROPIC_API_KEY: "k", CONTRACT_REVIEW_MODEL: "m", CONTRACT_REVIEW_ENABLED: false },
}));
vi.mock("../lib/app-logger.js", () => ({ logApiFailure: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../modules/ai/ai.quota.js", () => ({}));
vi.mock("../modules/ai/contract-review.service.js", () => ({}));
vi.mock("../modules/ai/contract-review.ledger.js", () => ({}));

import { isContractReviewOpen, startContractReviewController, prescanContractController } from "../modules/ai/contract-review.controller.js";

describe("Sözleşme Denetçisi kapalıyken (CONTRACT_REVIEW_ENABLED=false)", () => {
  it("sıradan kullanıcıya kapalı, admin'e açık", () => {
    expect(isContractReviewOpen("USER")).toBe(false);
    expect(isContractReviewOpen(undefined)).toBe(false);
    expect(isContractReviewOpen("ADMIN")).toBe(true);
  });

  it("analiz ve ön tarama 503 döner, kredi/iş açılmaz", async () => {
    const req = { authUser: { id: "u1", role: "USER", plan: "PRO" }, body: { text: "x".repeat(500) } } as never;
    const res = {} as never;
    await expect(startContractReviewController(req, res)).rejects.toMatchObject({ statusCode: 503 });
    await expect(prescanContractController(req, res)).rejects.toMatchObject({ statusCode: 503 });
  });
});
