import { beforeEach, describe, expect, it, vi } from "vitest";

const reg = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../config/env.js", () => ({
  env: { JWT_ACCESS_SECRET: "x".repeat(40), ANTHROPIC_API_KEY: "k", CONTRACT_REVIEW_MODEL: "m" },
}));
vi.mock("../lib/app-logger.js", () => ({ logApiFailure: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../lib/site-config.service.js", () => ({ getSetting: reg.get }));
vi.mock("../modules/ai/ai.quota.js", () => ({}));
vi.mock("../modules/ai/contract-review.service.js", () => ({}));
vi.mock("../modules/ai/contract-review.ledger.js", () => ({}));

import { isContractReviewOpen, startContractReviewController, prescanContractController } from "../modules/ai/contract-review.controller.js";

// Açma/kapama: admin paneli → Sistem Kontrol → "Sözleşme Denetçisi'ni kapat" anahtarı.
describe("Sözleşme Denetçisi admin panelinden açma/kapama", () => {
  beforeEach(() => { reg.get.mockClear(); });

  it("anahtar AÇIKKEN (kapalı) sıradan kullanıcıya kapalı, admin'e açık", async () => {
    reg.get.mockResolvedValue({ featureFlags: { contractReviewDisabled: true } });
    expect(await isContractReviewOpen("USER")).toBe(false);
    expect(await isContractReviewOpen("ADMIN")).toBe(true);
  });

  it("anahtar KAPATILINCA herkese açık", async () => {
    reg.get.mockResolvedValue({ featureFlags: { contractReviewDisabled: false } });
    expect(await isContractReviewOpen("USER")).toBe(true);
  });

  it("anahtar hiç kaydedilmemişse ya da ayar yoksa kapalı (güvenli taraf)", async () => {
    reg.get.mockResolvedValue({ featureFlags: {} });
    expect(await isContractReviewOpen("USER")).toBe(false);
    reg.get.mockResolvedValue(null);
    expect(await isContractReviewOpen("USER")).toBe(false);
  });

  it("kayıt okunamazsa kapalı (güvenli taraf)", async () => {
    reg.get.mockImplementation(async () => { throw new Error("db down"); });
    expect(await isContractReviewOpen("USER")).toBe(false);
  });

  it("kapalıyken analiz ve ön tarama 503 döner", async () => {
    reg.get.mockResolvedValue({ featureFlags: { contractReviewDisabled: true } });
    const req = { authUser: { id: "u1", role: "USER", plan: "PRO" }, body: { text: "x".repeat(500) } } as never;
    await expect(startContractReviewController(req, {} as never)).rejects.toMatchObject({ statusCode: 503 });
    await expect(prescanContractController(req, {} as never)).rejects.toMatchObject({ statusCode: 503 });
  });
});
