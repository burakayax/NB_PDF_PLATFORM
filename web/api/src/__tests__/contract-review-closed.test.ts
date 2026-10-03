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
import { AI_TOOL_CATALOG, AI_TOOL_CLOSED_MESSAGE, aiToolClosedMessage, closedAiToolNotes, closedAiTools, isAiToolOpen, requireAiTool } from "../modules/ai/ai-tool-switch.js";

// Açma/kapama: admin paneli → Sistem Kontrol → "Yapay zekâ araçları" bölümü (global.flags.aiToolStates).
describe("AI araçlarını tek tek açma/kapama", () => {
  beforeEach(() => { reg.get.mockClear(); });

  it("kayıt yokken: Sözleşme Denetçisi kapalı, diğer araçlar açık", async () => {
    reg.get.mockResolvedValue({});
    expect(await isAiToolOpen("sozlesme-denetci", "USER")).toBe(false);
    expect(await isAiToolOpen("pdf-ozetle", "USER")).toBe(true);
    expect(await closedAiTools("USER")).toEqual(["sozlesme-denetci"]);
  });

  it("admin'in kaydettiği durum varsayılanı ezer", async () => {
    reg.get.mockResolvedValue({ aiToolStates: { "sozlesme-denetci": "open", "pdf-sohbet": "closed" } });
    expect(await isAiToolOpen("sozlesme-denetci", "USER")).toBe(true);
    expect(await isAiToolOpen("pdf-sohbet", "USER")).toBe(false);
    expect(await isAiToolOpen("pdf-ozetle", "USER")).toBe(true);
  });

  it("ADMIN kapalı aracı da kullanabilir", async () => {
    reg.get.mockResolvedValue({ aiToolStates: { "pdf-sohbet": "closed" } });
    expect(await isAiToolOpen("pdf-sohbet", "ADMIN")).toBe(true);
    expect(await isContractReviewOpen("ADMIN")).toBe(true);
  });

  it("ayar okunamazsa kapalı (güvenli taraf)", async () => {
    reg.get.mockImplementation(async () => { throw new Error("db down"); });
    expect(await isAiToolOpen("pdf-ozetle", "USER")).toBe(false);
  });

  it("geçersiz değerler yok sayılır", async () => {
    reg.get.mockResolvedValue({ aiToolStates: { "pdf-ozetle": "belki", "pdf-sohbet": 5 } });
    expect(await isAiToolOpen("pdf-ozetle", "USER")).toBe(true);
  });

  it("rota koruması kapalı araçta 503 döner, açıkta devam eder", async () => {
    reg.get.mockResolvedValue({ aiToolStates: { "pdf-ceviri": "closed" } });
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })) } as never;
    const next = vi.fn();
    await requireAiTool("pdf-ceviri")({ authUser: { role: "USER" } } as never, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "ai_unavailable" }));
    await requireAiTool("pdf-ozetle")({ authUser: { role: "USER" } } as never, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("admin'in yazdığı not kapalı araçta kullanıcıya gösterilir; yoksa varsayılan mesaj", async () => {
    reg.get.mockResolvedValue({
      aiToolStates: { "pdf-ceviri": "closed" },
      aiToolNotes: { "pdf-ceviri": "  Bakımdayız, yarın açılacak.  ", "pdf-ozetle": "açık araçta not görünmez" },
    });
    expect(await aiToolClosedMessage("pdf-ceviri")).toBe("Bakımdayız, yarın açılacak.");
    expect(await aiToolClosedMessage("pdf-sohbet")).toBe(AI_TOOL_CLOSED_MESSAGE);
    expect(await closedAiToolNotes(undefined)).toEqual({ "pdf-ceviri": "Bakımdayız, yarın açılacak." });
    const json = vi.fn();
    await requireAiTool("pdf-ceviri")({ authUser: { role: "USER" } } as never, { status: vi.fn(() => ({ json })) } as never, vi.fn());
    expect(json).toHaveBeenCalledWith({ error: "ai_unavailable", message: "Bakımdayız, yarın açılacak." });
  });

  it("çok uzun not 200 karakterde kesilir", async () => {
    reg.get.mockResolvedValue({ aiToolStates: { "pdf-ceviri": "closed" }, aiToolNotes: { "pdf-ceviri": "a".repeat(500) } });
    expect((await aiToolClosedMessage("pdf-ceviri")).length).toBe(200);
  });

  it("katalogdaki her araç benzersiz", () => {
    const ids = AI_TOOL_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Sözleşme Denetçisi kapalıyken analiz ve ön tarama 503 döner", async () => {
    reg.get.mockResolvedValue({});
    const req = { authUser: { id: "u1", role: "USER", plan: "PRO" }, body: { text: "x".repeat(500) } } as never;
    await expect(startContractReviewController(req, {} as never)).rejects.toMatchObject({ statusCode: 503 });
    await expect(prescanContractController(req, {} as never)).rejects.toMatchObject({ statusCode: 503 });
  });
});
