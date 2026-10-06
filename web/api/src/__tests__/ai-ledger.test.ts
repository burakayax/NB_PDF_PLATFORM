import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

/**
 * YAPAY ZEKÂ İSTEK DEFTERİ.
 *  1. Başarılı istek: DONE + çıktı özeti; belge metni/sonuç içeriği deftere GİRMEZ (yalnızca SHA-256).
 *  2. Hata: FAILED + iade işareti; hak iade edilir.
 *  3. Defter yazımı bozulursa iş yine çalışır (defter işi asla engellemez).
 */

const m = vi.hoisted(() => ({
  logCreate: vi.fn(),
  logUpdate: vi.fn(),
  reserve: vi.fn(),
  refund: vi.fn(),
  summarize: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({ prisma: { aiRequestLog: { create: m.logCreate, update: m.logUpdate } } }));
vi.mock("../modules/ai/ai.quota.js", () => ({
  getAiQuota: vi.fn(async () => ({ used: 1 })),
  reserveAiQuota: m.reserve,
  refundAiQuota: m.refund,
  grantAiCredits: vi.fn(),
  TOPUP_PACKS: [],
  topupPackById: vi.fn(),
}));
vi.mock("../modules/ai/ai.service.js", () => ({
  summarizeDocument: m.summarize,
  chatWithDocument: vi.fn(),
  extractData: vi.fn(),
  translateDocument: vi.fn(),
  translateSegments: vi.fn(),
  compareDocuments: vi.fn(),
  detectSensitive: vi.fn(),
  translationCreditCost: vi.fn(() => 1),
  totalSegmentChars: vi.fn(() => 0),
  MAX_TRANSLATE_CHARS: 1,
}));
vi.mock("../modules/ai/contract-review.controller.js", () => ({ isContractReviewOpen: vi.fn() }));
vi.mock("../modules/ai/ai-tool-switch.js", () => ({ closedAiTools: vi.fn(), closedAiToolNotes: vi.fn() }));

import { summarizeController } from "../modules/ai/ai.controller.js";

const DOC = "Çok gizli sözleşme metni";
function mk() {
  const res: Record<string, unknown> = {};
  res["status"] = vi.fn(() => res);
  res["json"] = vi.fn(() => res);
  const req = { body: { text: DOC, lang: "tr" }, authUser: { id: "u1", plan: "PRO", role: "USER" }, headers: {}, ip: "1.2.3.4" };
  return { req: req as never, res: res as never };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.reserve.mockResolvedValue(true);
  m.logCreate.mockResolvedValue({ id: "L1" });
});

describe("AI istek defteri", () => {
  it("başarılı istek: DONE + özetler, içerik yok", async () => {
    m.summarize.mockResolvedValue("sonuç metni");
    const { req, res } = mk();
    await summarizeController(req, res);
    const created = m.logCreate.mock.calls[0]?.[0].data;
    expect(created).toMatchObject({ userId: "u1", op: "summarize", units: 1, planAtTime: "PRO", clientIp: "1.2.3.4" });
    expect(JSON.stringify(created)).not.toContain("gizli");
    const upd = m.logUpdate.mock.calls[0]?.[0];
    expect(upd.where).toEqual({ id: "L1" });
    expect(upd.data).toMatchObject({ status: "DONE", refunded: false, outputSha256: createHash("sha256").update("sonuç metni").digest("hex") });
    expect(JSON.stringify(upd)).not.toContain("sonuç metni");
  });

  it("hata: FAILED + iade", async () => {
    m.summarize.mockRejectedValue(new Error("model hatası"));
    const { req, res } = mk();
    await expect(summarizeController(req, res)).rejects.toThrow("model hatası");
    expect(m.refund).toHaveBeenCalledTimes(1);
    expect(m.logUpdate.mock.calls[0]?.[0].data).toMatchObject({ status: "FAILED", refunded: true });
  });

  it("defter bozulsa bile iş çalışır", async () => {
    m.logCreate.mockRejectedValue(new Error("db yok"));
    m.logUpdate.mockRejectedValue(new Error("db yok"));
    m.summarize.mockResolvedValue("ok");
    const { req, res } = mk();
    await expect(summarizeController(req, res)).resolves.toBeUndefined();
    expect((res as unknown as { json: ReturnType<typeof vi.fn> }).json).toHaveBeenCalled();
  });

  it("hak yoksa deftere satır açılmaz", async () => {
    m.reserve.mockResolvedValue(false);
    const { req, res } = mk();
    await summarizeController(req, res);
    expect(m.logCreate).not.toHaveBeenCalled();
  });
});
