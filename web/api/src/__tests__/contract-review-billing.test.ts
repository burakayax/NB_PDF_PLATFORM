import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SÖZLEŞME DENETÇİSİ — PARA KURALLARI ve KANIT.
 *
 *  1. Açık onay olmadan hiçbir işlem başlamaz, hak/kredi düşülmez.
 *  2. Ekranda gösterilen bedel sunucununkiyle aynı değilse işlem başlamaz, hiçbir şey düşülmez.
 *  3. Hak/kredi işlem BAŞLAMADAN düşülür ve deftere (onay + bedel) yazılır.
 *  4. Hata olursa YALNIZCA BİR KEZ iade edilir; yönetici için düşüm de iade de yoktur.
 *  5. Sunucu yeniden başlarsa ortada kalan işler iade edilir.
 *  6. Rapor imzası içerik değişirse tutmaz.
 */

const m = vi.hoisted(() => ({
  logCreate: vi.fn(),
  logUpdateMany: vi.fn(),
  logFindUnique: vi.fn(),
  logFindMany: vi.fn(),
  logCount: vi.fn(),
  logFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  dlCount: vi.fn(),
  dlCreate: vi.fn(),
  reservePurchased: vi.fn(),
  refundPurchased: vi.fn(),
  reserveQuota: vi.fn(),
  refundQuota: vi.fn(),
  getQuota: vi.fn(),
  runFull: vi.fn(),
  runQuick: vi.fn(),
}));

vi.mock("../config/env.js", () => ({
  env: { JWT_ACCESS_SECRET: "x".repeat(40), ANTHROPIC_API_KEY: "k", CONTRACT_REVIEW_MODEL: "m" },
}));
vi.mock("../lib/site-config.service.js", () => ({ getSetting: vi.fn(async () => ({ aiToolStates: { "sozlesme-denetci": "open" } })) }));
vi.mock("../lib/app-logger.js", () => ({ logApiFailure: vi.fn() }));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contractReviewLog: {
      create: m.logCreate,
      updateMany: m.logUpdateMany,
      findUnique: m.logFindUnique,
      findMany: m.logFindMany,
      count: m.logCount,
      findFirst: m.logFindFirst,
    },
    user: { findUnique: m.userFindUnique },
    downloadLog: { count: m.dlCount, create: m.dlCreate },
  },
}));
vi.mock("../modules/ai/ai.quota.js", () => ({
  getAiQuota: m.getQuota,
  reserveAiQuota: m.reserveQuota,
  refundAiQuota: m.refundQuota,
  reservePurchasedCredits: m.reservePurchased,
  refundPurchasedCredits: m.refundPurchased,
}));
vi.mock("../modules/ai/contract-review.service.js", () => ({
  STAGES: ["a", "b", "c", "d"],
  QUICK_STAGES: ["a", "b"],
  prescanContract: vi.fn(),
  runContractReview: m.runFull,
  runQuickScan: m.runQuick,
}));

const ctl = await import("../modules/ai/contract-review.controller.js");
const ledger = await import("../modules/ai/contract-review.ledger.js");

const TEXT = "Bu sözleşme metni test için yeterince uzun olsun diye tekrarlanır. ".repeat(20);
const FULL_UNITS = ctl.contractReviewCost(TEXT.length);
const QUICK_UNITS = ctl.quickScanCost(TEXT.length);
const REPORT = { headline: "1 bulgu", findings: [{ title: "x" }] };

function mkReq(over: Record<string, unknown> = {}, user: Record<string, unknown> = {}) {
  return {
    authUser: { id: "u1", plan: "PRO", role: "USER", ...user },
    body: {
      text: TEXT,
      mode: "full",
      role: "satici",
      consent: { accepted: true, version: "2026-10-02", units: FULL_UNITS },
      ...over,
    },
    headers: { "user-agent": "TestBrowser/1.0", "x-forwarded-for": "203.0.113.7" },
    ip: "127.0.0.1",
    socket: {},
    params: {},
  } as never;
}

function mkRes() {
  const r = { statusCode: 200, payload: undefined as unknown, status(c: number) { r.statusCode = c; return r; }, json(p: unknown) { r.payload = p; return r; } };
  return r;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.logCreate.mockResolvedValue({});
  m.logCount.mockResolvedValue(0);
  m.logUpdateMany.mockResolvedValue({ count: 1 });
  m.logFindMany.mockResolvedValue([]);
  m.userFindUnique.mockResolvedValue({ plan: "PRO", role: "USER" });
  m.getQuota.mockResolvedValue({ remaining: 1 });
  m.reservePurchased.mockResolvedValue(true);
  m.reserveQuota.mockResolvedValue(true);
  m.runFull.mockResolvedValue(REPORT);
  m.runQuick.mockResolvedValue(REPORT);
});

describe("başlatma: onay ve bedel", () => {
  it("onay yoksa işlem başlamaz, hak/kredi düşülmez", async () => {
    await expect(ctl.startContractReviewController(mkReq({ consent: undefined }), mkRes() as never)).rejects.toMatchObject({ statusCode: 400 });
    await expect(ctl.startContractReviewController(mkReq({ consent: { accepted: false, version: "v", units: FULL_UNITS } }), mkRes() as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(m.reservePurchased).not.toHaveBeenCalled();
    expect(m.reserveQuota).not.toHaveBeenCalled();
    expect(m.logCreate).not.toHaveBeenCalled();
  });

  it("ekrandaki bedel sunucununkinden farklıysa 409 döner ve hiçbir şey düşülmez", async () => {
    const res = mkRes();
    await ctl.startContractReviewController(mkReq({ consent: { accepted: true, version: "v", units: FULL_UNITS - 1 } }), res as never);
    expect(res.statusCode).toBe(409);
    expect((res.payload as { error: string; units: number }).error).toBe("price_changed");
    expect((res.payload as { units: number }).units).toBe(FULL_UNITS);
    expect(m.reservePurchased).not.toHaveBeenCalled();
    expect(m.logCreate).not.toHaveBeenCalled();
  });

  it("art arda başarısız analizi olan kullanıcı otomatik durdurulur (kötüye kullanım koruması)", async () => {
    m.logCount.mockResolvedValue(ledger.REFUND_ABUSE_LIMIT_24H);
    await expect(ctl.startContractReviewController(mkReq(), mkRes() as never)).rejects.toMatchObject({ statusCode: 429 });
    expect(m.reservePurchased).not.toHaveBeenCalled();
  });
});

describe("ödeme ve defter", () => {
  it("detaylı denetim: yalnız satın alınan kredi düşer ve onay deftere yazılır", async () => {
    const res = mkRes();
    await ctl.startContractReviewController(mkReq(), res as never);
    expect(res.statusCode).toBe(202);
    expect(m.reservePurchased).toHaveBeenCalledWith("u1", "USER", "contract-review", FULL_UNITS);
    expect(m.reserveQuota).not.toHaveBeenCalled();
    const log = m.logCreate.mock.calls[0]![0].data;
    expect(log).toMatchObject({
      userId: "u1", mode: "full", units: FULL_UNITS, chargeSource: "credit",
      consentVersion: "2026-10-02", clientIp: "203.0.113.7", userAgent: "TestBrowser/1.0",
    });
    expect(log.docSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(log.consentAt).toBeInstanceOf(Date);
    // Belge METNİ deftere yazılmaz
    expect(JSON.stringify(log)).not.toContain("sözleşme metni test");
  });

  it("hızlı tarama: önce aylık hak, sonra kredi (reserveAiQuota)", async () => {
    await ctl.startContractReviewController(mkReq({ mode: "quick", consent: { accepted: true, version: "v", units: QUICK_UNITS } }), mkRes() as never);
    expect(m.reserveQuota).toHaveBeenCalledWith("u1", "PRO", "USER", "contract-quick", QUICK_UNITS);
    expect(m.reservePurchased).not.toHaveBeenCalled();
    expect(m.logCreate.mock.calls[0]![0].data.chargeSource).toBe("monthly_then_credit");
  });

  it("kredi yetmiyorsa 429 döner, defter yazılmaz", async () => {
    m.reservePurchased.mockResolvedValue(false);
    const res = mkRes();
    await ctl.startContractReviewController(mkReq(), res as never);
    expect(res.statusCode).toBe(429);
    expect(m.logCreate).not.toHaveBeenCalled();
  });

  it("defter yazılamazsa kredi hemen geri verilir ve işlem başlamaz", async () => {
    m.logCreate.mockRejectedValue(new Error("db down"));
    await expect(ctl.startContractReviewController(mkReq(), mkRes() as never)).rejects.toMatchObject({ statusCode: 503 });
    expect(m.refundPurchased).toHaveBeenCalledWith("u1", "USER", FULL_UNITS);
    expect(m.runFull).not.toHaveBeenCalled();
  });

  it("YÖNETİCİ: düşüm yok, iade yok; defterde 'admin_exempt'", async () => {
    m.runFull.mockRejectedValue(new Error("boom"));
    m.logFindUnique.mockResolvedValue({ id: "j", userId: "admin1", mode: "full", units: FULL_UNITS, chargeSource: "admin_exempt" });
    await ctl.startContractReviewController(mkReq({}, { id: "admin1", role: "ADMIN" }), mkRes() as never);
    expect(m.logCreate.mock.calls[0]![0].data.chargeSource).toBe("admin_exempt");
    await vi.waitFor(() => expect(m.logUpdateMany).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(m.refundPurchased).not.toHaveBeenCalled(); // muaf: geri verilecek bir şey yok
  });
});

describe("sonuç: imza ve iade", () => {
  it("başarılı iş: rapor imzalanır, deftere 'DONE' + özet yazılır, durum uç noktası imzayı döner", async () => {
    const res = mkRes();
    await ctl.startContractReviewController(mkReq(), res as never);
    const jobId = (res.payload as { jobId: string }).jobId;
    await vi.waitFor(() => expect(m.logUpdateMany).toHaveBeenCalled());
    const done = m.logUpdateMany.mock.calls.find((c) => c[0].data.status === "DONE")![0];
    expect(done.data.reportSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(done.data.reportSignature).toMatch(/^[0-9a-f]{64}$/);

    const sres = mkRes();
    const sreq = mkReq();
    (sreq as unknown as { params: Record<string, string> }).params = { id: jobId };
    await ctl.contractReviewStatusController(sreq, sres as never);
    const view = sres.payload as { status: string; proof: { reportId: string; signature: string; reportSha256: string; issuedAt: string } };
    expect(view.status).toBe("done");
    expect(view.proof.reportId).toBe(jobId);
    expect(ledger.verifySignature(view.proof)).toBe(true);
  });

  it("hata olursa kredi BİR KEZ iade edilir ve kullanıcıya iade edildiği söylenir", async () => {
    m.runFull.mockRejectedValue(new Error("Claude API 500"));
    m.logFindUnique.mockResolvedValue({ id: "j", userId: "u1", mode: "full", units: FULL_UNITS, chargeSource: "credit" });
    const res = mkRes();
    await ctl.startContractReviewController(mkReq(), res as never);
    await vi.waitFor(() => expect(m.refundPurchased).toHaveBeenCalledTimes(1));
    expect(m.refundPurchased).toHaveBeenCalledWith("u1", "USER", FULL_UNITS);

    const jobId = (res.payload as { jobId: string }).jobId;
    const sreq = mkReq();
    (sreq as unknown as { params: Record<string, string> }).params = { id: jobId };
    const sres = mkRes();
    await ctl.contractReviewStatusController(sreq, sres as never);
    expect((sres.payload as { status: string; error: string }).status).toBe("error");
    expect((sres.payload as { error: string }).error).toMatch(/iade edildi/);
  });

  it("aynı iş ikinci kez iade edilemez (atomik)", async () => {
    m.logFindUnique.mockResolvedValue({ id: "j", userId: "u1", mode: "full", units: 90, chargeSource: "credit" });
    m.logUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await ledger.claimRefund("j", "x")).not.toBeNull();
    expect(await ledger.claimRefund("j", "x")).toBeNull();
  });

  it("sunucu yeniden başlayınca ortada kalan (RUNNING) işler iade edilir", async () => {
    m.logFindMany.mockResolvedValue([{ id: "orphan1" }, { id: "orphan2" }]);
    m.logFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id, userId: "u1", mode: where.id === "orphan1" ? "full" : "quick", units: 10, chargeSource: where.id === "orphan1" ? "credit" : "monthly_then_credit",
    }));
    const n = await ctl.recoverContractReviewJobs();
    expect(n).toBe(2);
    expect(m.refundPurchased).toHaveBeenCalledTimes(1); // detaylı
    expect(m.refundQuota).toHaveBeenCalledTimes(1); // hızlı
  });
});

describe("rapor imzası ve doğrulama", () => {
  const report = { headline: "h", findings: [{ title: "a", severity: "kritik" }], summary: "s" };

  it("aynı içerik, anahtar sırası farklı olsa da aynı özeti verir", () => {
    const a = ledger.canonicalJson({ b: 1, a: [{ y: 2, x: 1 }], u: undefined });
    const b = ledger.canonicalJson({ a: [{ x: 1, y: 2 }], b: 1 });
    expect(a).toBe(b);
  });

  it("geçerli imza doğrulanır; içerik ya da kimlik değişirse tutmaz", () => {
    const p = ledger.signReport("job-1", report, new Date("2026-10-02T10:00:00Z"));
    expect(ledger.verifySignature(p)).toBe(true);
    expect(ledger.verifySignature({ ...p, reportId: "job-2" })).toBe(false);
    expect(ledger.verifySignature({ ...p, issuedAt: "2026-10-03T10:00:00Z" })).toBe(false);
    expect(ledger.verifySignature({ ...p, signature: "0".repeat(64) })).toBe(false);
    // İçerik değişirse özet değişir → gömülü rapor imzalanan özetle uyuşmaz
    const tampered = { ...report, findings: [{ title: "a", severity: "dusuk" }] };
    expect(ledger.sha256Hex(ledger.canonicalJson(tampered))).not.toBe(p.reportSha256);
  });
});

describe("indirme bildirimi", () => {
  it("indirme, kullanıcının KENDİ analizi için ve dosya özetiyle deftere/indirme kayıtlarına işlenir", async () => {
    m.logFindFirst.mockResolvedValue({ id: "job-1" });
    m.dlCount.mockResolvedValue(0);
    const req = mkReq({ kind: "report", sha256: "a".repeat(64) });
    (req as unknown as { params: Record<string, string> }).params = { id: "job-1" };
    const res = mkRes();
    await ctl.contractReviewDownloadController(req, res as never);
    expect(m.dlCreate).toHaveBeenCalledTimes(1);
    const data = m.dlCreate.mock.calls[0]![0].data;
    expect(data).toMatchObject({ userId: "u1", toolId: "sozlesme-denetci", status: "SUCCESS", clientIp: "203.0.113.7" });
    expect(data.resultId).toBe(`job-1:report:${"a".repeat(64)}`);
    expect(data.ackedAt).toBeInstanceOf(Date);
  });

  it("başkasının analizi ya da geçersiz özet reddedilir", async () => {
    m.logFindFirst.mockResolvedValue(null);
    const req = mkReq({ kind: "report", sha256: "a".repeat(64) });
    (req as unknown as { params: Record<string, string> }).params = { id: "baskasi" };
    await expect(ctl.contractReviewDownloadController(req, mkRes() as never)).rejects.toMatchObject({ statusCode: 404 });
    const bad = mkReq({ kind: "x", sha256: "zz" });
    (bad as unknown as { params: Record<string, string> }).params = { id: "job-1" };
    await expect(ctl.contractReviewDownloadController(bad, mkRes() as never)).rejects.toMatchObject({ statusCode: 400 });
  });
});
