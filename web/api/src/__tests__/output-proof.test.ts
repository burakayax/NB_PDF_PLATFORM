import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

/**
 * ÇIKTI PARMAK İZİ + İTİRAZ DOSYASI.
 *  1. Dahili uç yalnızca sırla çalışır; misafir/bilinmeyen kullanıcı için kayıt tutulmaz.
 *  2. Aynı (kullanıcı, sonuç) tekrar gelirse ilk kayıt korunur (kanıt değiştirilemez).
 *  3. Dosya doğrulama: aynı dosya → eşleşir; değiştirilmiş dosya → eşleşmez.
 *  4. İtiraz dosyasında TC kimlik no / telefon / kart bilgisi YOKTUR; dosya içeriği YOKTUR.
 */

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  outCreate: vi.fn(),
  outFindMany: vi.fn(),
  hasSecret: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: m.userFindUnique },
    outputRecord: { create: m.outCreate, findMany: m.outFindMany },
    paymentCheckout: { findMany: vi.fn(async () => []) },
    invoice: { findMany: vi.fn(async () => []) },
    operationLog: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    downloadLog: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    aiUsage: { findMany: vi.fn(async () => []) },
    contractReviewLog: { findMany: vi.fn(async () => []) },
    aiRequestLog: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("../middleware/api-security.middleware.js", () => ({ requestHasInternalServiceSecret: m.hasSecret }));
vi.mock("../modules/admin/admin-audit.service.js", () => ({ logAdminAudit: m.audit }));
// entitlement.controller'ın diğer bağımlılıkları (bu testte kullanılmaz)
vi.mock("../lib/quota.js", () => ({ checkQuota: vi.fn(), incrementQuota: vi.fn(), checkAndIncrementQuota: vi.fn(), getQuotaSummary: vi.fn() }));
vi.mock("../modules/entitlement/entitlement.engine.js", () => ({ canExecute: vi.fn() }));
vi.mock("../modules/entitlement/editor-download.service.js", () => ({ consumeEditorDownload: vi.fn() }));

import { outputRecordController } from "../modules/entitlement/entitlement.controller.js";
import { adminUserDisputeFileController, adminVerifyOutputFileController } from "../modules/admin/dispute.admin.js";

function res() {
  const r: Record<string, unknown> = {};
  r["status"] = vi.fn(() => r);
  r["json"] = vi.fn(() => r);
  r["send"] = vi.fn(() => r);
  r["setHeader"] = vi.fn(() => r);
  return r as unknown as import("express").Response & { json: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
}
const SHA = "a".repeat(64);
const body = { userId: "u1", toolId: "merge", resultId: "job:1", sha256: SHA, sizeBytes: 10, producedAt: 1_790_000_000 };

beforeEach(() => {
  vi.clearAllMocks();
  process.env["INTERNAL_SERVICE_SECRET"] = "s";
  m.hasSecret.mockReturnValue(true);
});

describe("outputRecordController", () => {
  it("sır yoksa 403", async () => {
    m.hasSecret.mockReturnValue(false);
    await expect(outputRecordController({ body } as never, res())).rejects.toMatchObject({ statusCode: 403 });
    expect(m.outCreate).not.toHaveBeenCalled();
  });

  it("bilinmeyen/misafir kullanıcı için kayıt tutmaz", async () => {
    m.userFindUnique.mockResolvedValue(null);
    const r = res();
    await outputRecordController({ body } as never, r);
    expect(m.outCreate).not.toHaveBeenCalled();
    expect(r.json).toHaveBeenCalledWith({ ok: true, recorded: false });
  });

  it("kaydı o günkü planla yazar", async () => {
    m.userFindUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
    const r = res();
    await outputRecordController({ body } as never, r);
    expect(m.outCreate.mock.calls[0]?.[0].data).toMatchObject({ userId: "u1", fileSha256: SHA, planAtTime: "PRO", fileSizeBytes: 10 });
    expect(r.status).toHaveBeenCalledWith(201);
  });

  it("tekrar gelen kayıtta ilk kaydı korur (hata atmaz)", async () => {
    m.userFindUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
    m.outCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = res();
    await outputRecordController({ body } as never, r);
    expect(r.json).toHaveBeenCalledWith({ ok: true, recorded: false, already: true });
  });

  it("geçersiz parmak izini reddeder", async () => {
    await expect(outputRecordController({ body: { ...body, sha256: "xyz" } } as never, res())).rejects.toBeDefined();
  });
});

describe("adminVerifyOutputFileController", () => {
  const actor = { id: "admin1", email: "a@x.com" };
  it("aynı dosya eşleşir, değiştirilmiş dosya eşleşmez", async () => {
    const file = Buffer.from("%PDF-1.4 orijinal");
    const sha = createHash("sha256").update(file).digest("hex");
    m.outFindMany.mockImplementation(async (a: { where: { fileSha256: string } }) =>
      a.where.fileSha256 === sha ? [{ userId: "u1", user: { email: "u@x.com" }, toolId: "merge", resultId: "r", producedAt: null, createdAt: new Date(), planAtTime: "PRO" }] : [],
    );
    const ok = res();
    await adminVerifyOutputFileController({ body: file, authUser: actor } as never, ok);
    expect(ok.json.mock.calls[0]?.[0]).toMatchObject({ matched: true, sha256: sha });

    const bad = res();
    await adminVerifyOutputFileController({ body: Buffer.from("%PDF-1.4 orijinal DEGISTI"), authUser: actor } as never, bad);
    expect(bad.json.mock.calls[0]?.[0]).toMatchObject({ matched: false });
  });

  it("boş gövdeyi reddeder", async () => {
    await expect(adminVerifyOutputFileController({ body: Buffer.alloc(0), authUser: actor } as never, res())).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("adminUserDisputeFileController", () => {
  it("hassas alanları içermez ve erişimi denetim kaydına yazar", async () => {
    m.userFindUnique.mockResolvedValue({
      id: "u1", email: "u@x.com", createdAt: new Date(), lastLoginAt: null, plan: "PRO", country: "TR",
      tcKimlikNo: "11111111110", phone: "+905551112233", passwordHash: "HASH",
      kvkkConsentedAt: null, distanceSalesConsentedAt: null, withdrawalWaivedAt: null,
      totalRefunds: 0, firstRefundedAt: null, lastRefundedAt: null, totalOperationsCount: 3, organization: null,
    });
    const r = res();
    await adminUserDisputeFileController({ params: { id: "u1" }, query: {}, authUser: { id: "admin1", email: "a@x.com" } } as never, r);
    const text = String(r.send.mock.calls[0]?.[0]);
    expect(text).toContain("Hizmet Şartları/Gizlilik kabulü");
    expect(text).toContain("İşlem kaydı sayısı");
    expect(text).toContain("u@x.com");
    expect(text).not.toContain("11111111110");
    expect(text).not.toContain("+905551112233");
    expect(text).not.toContain("HASH");
    expect(m.audit).toHaveBeenCalledWith({ userId: "admin1", email: "a@x.com" }, "dispute_file_export", "u1", expect.any(String));
  });

  it("kullanıcı yoksa 404", async () => {
    m.userFindUnique.mockResolvedValue(null);
    await expect(adminUserDisputeFileController({ params: { id: "x" }, query: {}, authUser: { id: "a", email: "a@x.com" } } as never, res())).rejects.toMatchObject({ statusCode: 404 });
  });
});
