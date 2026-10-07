import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MALİ KAYIT ARŞİVİ: hesap silinince ödeme/fatura kaybolmamalı.
 *  1. Ödeme/fatura yoksa arşiv satırı açılmaz.
 *  2. Varsa kullanıcıya bağlı olmayan arşive kopyalanır; iç alan (iyzico belirteç özeti) taşınmaz; 10 yıl saklama.
 *  3. Arşiv yazılamazsa hata atar (çağıran silmeyi durdurur).
 *  4. Muhasebe dökümü canlı + silinmiş hesap arşivini birleştirir; CSV Excel için BOM'lu ve ; ayraçlı.
 */

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  checkoutFindMany: vi.fn(),
  invoiceFindMany: vi.fn(),
  archiveCreate: vi.fn(),
  archiveFindMany: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: m.userFindUnique },
    paymentCheckout: { findMany: m.checkoutFindMany },
    invoice: { findMany: m.invoiceFindMany },
    financialRecordArchive: { create: m.archiveCreate, findMany: m.archiveFindMany },
  },
}));
vi.mock("../modules/admin/admin-audit.service.js", () => ({ logAdminAudit: m.audit }));

import { archiveFinancialRecordsBeforeDelete } from "../lib/financial-archive.js";
import { adminFinancialExportController, toCsv } from "../modules/admin/financial-export.admin.js";

const checkout = {
  id: "c1", userId: "u1", plan: "PRO", billingCycle: "YEARLY", status: "completed", priceTry: "2990",
  iyzicoTokenHash: "SECRET-HASH", iyzicoPaymentId: "p1", createdAt: new Date("2026-03-10T10:00:00Z"), completedAt: new Date("2026-03-10T10:01:00Z"),
  refundedAt: null, refundReason: null, netAmount: "2491.67", kdvRate: 20, kdvAmount: "498.33",
};
const invoice = { checkoutId: "c1", userId: "u1", invoiceNo: "NB2026000001", status: "sent", grossAmount: "2990", customerName: "Ayşe Yılmaz", customerCountry: "TR" };

function res() {
  const r: Record<string, unknown> = {};
  r["setHeader"] = vi.fn(() => r);
  r["send"] = vi.fn(() => r);
  r["json"] = vi.fn(() => r);
  return r as never as import("express").Response & { send: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.userFindUnique.mockResolvedValue({ email: "a@x.com", firstName: "Ayşe", lastName: "Yılmaz" });
});

describe("archiveFinancialRecordsBeforeDelete", () => {
  it("ödeme/fatura yoksa arşiv açmaz", async () => {
    m.checkoutFindMany.mockResolvedValue([]);
    m.invoiceFindMany.mockResolvedValue([]);
    expect(await archiveFinancialRecordsBeforeDelete("u1", "account_deleted")).toBe(false);
    expect(m.archiveCreate).not.toHaveBeenCalled();
  });

  it("kayıtları kopyalar, iç alanı taşımaz, 10 yıl saklar", async () => {
    m.checkoutFindMany.mockResolvedValue([checkout]);
    m.invoiceFindMany.mockResolvedValue([invoice]);
    expect(await archiveFinancialRecordsBeforeDelete("u1", "account_deleted")).toBe(true);
    const d = m.archiveCreate.mock.calls[0]?.[0].data;
    expect(d).toMatchObject({ originalUserId: "u1", emailSnapshot: "a@x.com", reason: "account_deleted" });
    expect(JSON.stringify(d.payload)).not.toContain("SECRET-HASH");
    expect(d.payload.paymentCheckouts[0].id).toBe("c1");
    expect(d.payload.invoices[0].invoiceNo).toBe("NB2026000001");
    const years = (d.retainUntil.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
    expect(years).toBeGreaterThan(9.9);
  });

  it("arşiv yazılamazsa hata atar (silme durmalı)", async () => {
    m.checkoutFindMany.mockResolvedValue([checkout]);
    m.invoiceFindMany.mockResolvedValue([]);
    m.archiveCreate.mockRejectedValue(new Error("db"));
    await expect(archiveFinancialRecordsBeforeDelete("u1", "account_deleted")).rejects.toThrow("db");
  });
});

describe("muhasebe dökümü", () => {
  it("canlı kayıt + silinmiş hesap arşivini birleştirir", async () => {
    m.checkoutFindMany.mockResolvedValue([{ ...checkout, user: { id: "u1", email: "a@x.com" } }]);
    m.invoiceFindMany.mockResolvedValue([invoice]);
    m.archiveFindMany.mockResolvedValue([
      {
        originalUserId: "u2", emailSnapshot: "silinen@x.com",
        payload: { paymentCheckouts: [{ ...checkout, id: "c2", createdAt: "2026-05-01T00:00:00.000Z" }], invoices: [{ ...invoice, checkoutId: "c2", invoiceNo: "NB2026000002" }] },
      },
    ]);
    const r = res();
    await adminFinancialExportController({ query: { year: "2026" }, authUser: { id: "adm", email: "adm@x.com" } } as never, r);
    const csv = String(r.send.mock.calls[0]?.[0]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("NB2026000001");
    expect(csv).toContain("NB2026000002");
    expect(csv).toContain("silinmiş hesap arşivi");
    expect(csv).toContain("silinen@x.com");
    expect(csv).not.toContain("SECRET-HASH");
    expect(m.audit).toHaveBeenCalled();
  });

  it("geçersiz yılı reddeder", async () => {
    await expect(adminFinancialExportController({ query: { year: "abc" }, authUser: { id: "a", email: "a@x.com" } } as never, res())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("toCsv: ayraç ve tırnak içeren hücreyi kaçırır", () => {
    const csv = toCsv([{ a: "x;y", b: 'say "merhaba"' }]);
    expect(csv).toContain('"x;y"');
    expect(csv).toContain('"say ""merhaba"""');
  });
});
