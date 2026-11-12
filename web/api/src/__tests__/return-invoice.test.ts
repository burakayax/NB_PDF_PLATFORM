import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inv: { findMany: vi.fn(), update: vi.fn() },
  refund: vi.fn(),
  mail: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({ prisma: { invoice: h.inv, user: { findUnique: vi.fn() } } }));
vi.mock("../lib/mailer.js", () => ({ sendMail: h.mail }));
vi.mock("../config/env.js", () => ({ env: { ADMIN_EMAIL: "admin@example.com" } }));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../modules/payment/admin-refund.service.js", () => ({ executeAdminRefund: h.refund }));

import { matchIncomingToInvoice, processReturnInvoices, reminderDue, type IncomingReturnInvoice } from "../modules/payment/return-invoice.service.js";

const incoming = (o: Partial<IncomingReturnInvoice> = {}): IncomingReturnInvoice => ({
  invoice_uuid: "iade-uuid",
  invoice_no: "IAD2026000000001",
  issue_date: "2026-11-20",
  original_invoice_no: "",
  original_invoice_uuid: "",
  kdv_amount: "66.50",
  ...o,
});

describe("gelen iade faturası eşleştirme", () => {
  it("asıl fatura UUID'si veya numarasıyla eşleşir (büyük/küçük harf fark etmez)", () => {
    const inv = { externalId: "AAAA-1", invoiceNo: "XYZ2026000000001" };
    expect(matchIncomingToInvoice(inv, [incoming({ original_invoice_uuid: "aaaa-1" })])).not.toBeNull();
    expect(matchIncomingToInvoice(inv, [incoming({ original_invoice_no: "xyz2026000000001" })])).not.toBeNull();
    expect(matchIncomingToInvoice(inv, [incoming({ original_invoice_no: "BASKA" })])).toBeNull();
    expect(matchIncomingToInvoice({ externalId: null, invoiceNo: null }, [incoming()])).toBeNull();
  });
});

describe("hatırlatma günleri", () => {
  const t0 = new Date("2026-11-10T10:00:00Z");
  it("3. ve 7. günde, en fazla iki kez", () => {
    expect(reminderDue(t0, 0, new Date("2026-11-12T10:00:00Z"))).toBe(false);
    expect(reminderDue(t0, 0, new Date("2026-11-13T10:00:00Z"))).toBe(true);
    expect(reminderDue(t0, 1, new Date("2026-11-13T10:00:00Z"))).toBe(false);
    expect(reminderDue(t0, 1, new Date("2026-11-17T10:00:00Z"))).toBe(true);
    expect(reminderDue(t0, 2, new Date("2026-12-30T10:00:00Z"))).toBe(false);
  });
});

describe("saatlik tur", () => {
  const pendingInv = (o: object = {}) => ({
    id: "i1",
    externalId: "ext-1",
    invoiceNo: "XYZ2026000000001",
    customerEmail: "firma@example.com",
    customerName: "Firma AŞ",
    returnStatus: "requested",
    returnRequestedAt: new Date("2026-11-10T10:00:00Z"),
    returnReminderCount: 0,
    returnInvoiceUuid: null,
    returnInvoiceNo: null,
    checkout: { conversationId: "oid-1" },
    ...o,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    h.refund.mockResolvedValue({ userId: "u1", planBefore: "PRO", providerRefunded: true });
    h.inv.update.mockResolvedValue({});
  });

  it("iade faturası gelince parayı iade eder ve KDV'sini kaydeder", async () => {
    h.inv.findMany.mockResolvedValue([pendingInv()]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, items: [incoming({ original_invoice_uuid: "ext-1" })] }),
      }),
    );
    const tally = await processReturnInvoices(new Date("2026-11-21T10:00:00Z"));
    expect(tally).toEqual({ refunded: 1 });
    expect(h.refund).toHaveBeenCalledWith("oid-1", expect.stringContaining("IAD2026000000001"), true);
    const datas = h.inv.update.mock.calls.map((c) => c[0].data);
    expect(datas.some((d) => d.returnStatus === "received" && d.returnKdvAmount === "66.50")).toBe(true);
    expect(datas.some((d) => d.returnStatus === "refunded")).toBe(true);
  });

  it("fatura gelmediyse iade YAPILMAZ; gün gelince hatırlatma gider", async () => {
    h.inv.findMany.mockResolvedValue([pendingInv()]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ success: true, items: [], pdfUrl: undefined }) }),
    );
    const tally = await processReturnInvoices(new Date("2026-11-14T10:00:00Z"));
    expect(h.refund).not.toHaveBeenCalled();
    expect(tally).toEqual({ reminded: 1 });
    expect(h.mail).toHaveBeenCalledTimes(1);
  });

  it("para iadesi başarısız olursa durum 'received' kalır (sonraki tur dener)", async () => {
    h.inv.findMany.mockResolvedValue([pendingInv({ returnStatus: "received", returnInvoiceNo: "IAD1" })]);
    h.refund.mockRejectedValue(new Error("PayTR hata"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true, items: [] }) }));
    const tally = await processReturnInvoices(new Date("2026-11-21T10:00:00Z"));
    expect(tally).toEqual({ refund_failed: 1 });
    expect(h.inv.update.mock.calls.some((c) => c[0].data.returnStatus === "refunded")).toBe(false);
  });
});
