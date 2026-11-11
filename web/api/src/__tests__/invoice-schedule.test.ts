import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  co: { updateMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  inv: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  sendMail: vi.fn(),
  open: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({ prisma: { paymentCheckout: h.co, invoice: h.inv, user: h.user } }));
vi.mock("../lib/mailer.js", () => ({ sendMail: h.sendMail }));
vi.mock("../config/env.js", () => ({ env: { ADMIN_EMAIL: "admin@x.com" } }));
vi.mock("../lib/file-log.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../lib/feature-switches.js", () => ({ exportExemptionOpen: h.open }));
vi.mock("../modules/payment/card-evidence.service.js", () => ({ captureCardEvidence: h.capture }));

const svc = await import("../modules/payment/invoice-schedule.service.js");

const HOUR = 3_600_000;
const base = {
  id: "c1",
  conversationId: "oid-1",
  status: "completed",
  refundedAt: null,
  invoiceStatus: "scheduled",
  invoiceAction: null,
  invoiceDueAt: new Date(Date.now() - HOUR),
  completedAt: new Date(Date.now() - 6 * 24 * HOUR),
  createdAt: new Date(Date.now() - 6 * 24 * HOUR),
  priceTry: "129.00",
  paymentCurrency: "TRY",
};

beforeEach(() => {
  Object.values(h.co).forEach((m) => m.mockReset());
  h.inv.findUnique.mockReset().mockResolvedValue(null);
  h.user.findUnique.mockReset();
  h.sendMail.mockReset().mockResolvedValue(undefined);
  h.open.mockReset().mockResolvedValue(true);
  h.capture.mockReset();
  h.co.updateMany.mockResolvedValue({ count: 1 });
  h.co.update.mockResolvedValue({});
  delete process.env.INVOICE_DELAY_HOURS;
});

describe("invoiceDelayHours", () => {
  it("varsayılan 156 saat; env ile değişir; yasal sınırdan en az 6 saat önce kırpılır; 0 = hemen", () => {
    expect(svc.invoiceDelayHours()).toBe(156);
    process.env.INVOICE_DELAY_HOURS = "48";
    expect(svc.invoiceDelayHours()).toBe(48);
    process.env.INVOICE_DELAY_HOURS = "500";
    expect(svc.invoiceDelayHours()).toBe(162);
    process.env.INVOICE_DELAY_HOURS = "0";
    expect(svc.invoiceDelayHours()).toBe(0);
    process.env.INVOICE_DELAY_HOURS = "abc";
    expect(svc.invoiceDelayHours()).toBe(156);
  });
});

describe("scheduleInvoiceRecord", () => {
  it("yalnız durumu boş olan ödemeyi planlar (tekrar çağrı ezmez)", async () => {
    const now = new Date("2026-11-11T10:00:00Z");
    await svc.scheduleInvoiceRecord("c1", 156, now);
    const arg = h.co.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "c1", invoiceStatus: null });
    expect(arg.data.invoiceStatus).toBe("scheduled");
    expect(arg.data.invoiceDueAt.getTime()).toBe(now.getTime() + 156 * HOUR);
  });
});

describe("processInvoiceNow", () => {
  it("iade edilmişse fatura kesmez (kontör korunur)", async () => {
    h.co.findUnique.mockResolvedValue({ ...base, status: "refunded", refundedAt: new Date() });
    const trigger = vi.fn();
    expect(await svc.processInvoiceNow("c1", trigger)).toBe("skipped_refunded");
    expect(trigger).not.toHaveBeenCalled();
    expect(h.co.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { invoiceStatus: "skipped_refunded" } });
  });
  it("yönetici 'kesme' dediyse kesmez", async () => {
    h.co.findUnique.mockResolvedValue({ ...base, invoiceAction: "CANCEL" });
    const trigger = vi.fn();
    expect(await svc.processInvoiceNow("c1", trigger)).toBe("cancelled");
    expect(trigger).not.toHaveBeenCalled();
  });
  it("fatura zaten varsa ikinci kez kesmez", async () => {
    h.co.findUnique.mockResolvedValue(base);
    h.inv.findUnique.mockResolvedValue({ id: "i1" });
    const trigger = vi.fn();
    expect(await svc.processInvoiceNow("c1", trigger)).toBe("issued");
    expect(trigger).not.toHaveBeenCalled();
  });
  it("fatura kesilirken iade yapıldıysa yöneticiye iade faturası uyarısı gider", async () => {
    h.co.findUnique.mockResolvedValueOnce(base).mockResolvedValueOnce({ status: "refunded", refundedAt: new Date() });
    expect(await svc.processInvoiceNow("c1", vi.fn().mockResolvedValue("ok"))).toBe("issued");
    expect(h.sendMail).toHaveBeenCalledTimes(1);
    expect(h.sendMail.mock.calls[0][0].subject).toMatch(/iade faturası/);
  });
  it("başarılıysa issued; otomatik kuralda forceDomestic=false", async () => {
    h.co.findUnique.mockResolvedValue(base);
    const trigger = vi.fn().mockResolvedValue("ok");
    expect(await svc.processInvoiceNow("c1", trigger)).toBe("issued");
    expect(trigger.mock.calls[0][2]).toEqual({ forceDomestic: false });
    expect(h.co.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { invoiceStatus: "issued" } });
  });
  it("yönetici 'KDV'li kes' dediyse forceDomestic=true gönderir", async () => {
    h.co.findUnique.mockResolvedValue({ ...base, invoiceAction: "VAT" });
    const trigger = vi.fn().mockResolvedValue("ok");
    await svc.processInvoiceNow("c1", trigger);
    expect(trigger.mock.calls[0][2]).toEqual({ forceDomestic: true });
  });
  it("durdurulmuşsa ya da hata olursa 'scheduled'a geri döner (sonraki turda tekrar denenir)", async () => {
    h.co.findUnique.mockResolvedValue(base);
    expect(await svc.processInvoiceNow("c1", vi.fn().mockResolvedValue("paused"))).toBe("paused");
    expect(h.co.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { invoiceStatus: "scheduled" } });
    expect(await svc.processInvoiceNow("c1", vi.fn().mockResolvedValue("failed"))).toBe("failed");
    expect(h.co.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { invoiceStatus: "scheduled" } });
  });
  it("başka tur ya da işlem tutuyorsa (claim=0) dokunmaz", async () => {
    h.co.updateMany.mockResolvedValue({ count: 0 });
    const trigger = vi.fn();
    expect(await svc.processInvoiceNow("c1", trigger)).toBe("busy");
    expect(trigger).not.toHaveBeenCalled();
  });
  it("yasal sürenin sonuna yakın başarısızlıkta yöneticiye ACİL e-posta atar", async () => {
    h.co.findUnique.mockResolvedValue({ ...base, id: "late", completedAt: new Date(Date.now() - 6.8 * 24 * HOUR) });
    await svc.processInvoiceNow("late", vi.fn().mockResolvedValue("failed"));
    expect(h.sendMail).toHaveBeenCalledTimes(1);
    expect(h.sendMail.mock.calls[0][0].subject).toMatch(/ACİL/);
  });
});

describe("processDueInvoices", () => {
  it("vadesi gelenleri işler ve sonuçları sayar", async () => {
    h.co.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    h.co.findUnique.mockResolvedValue({ ...base, status: "refunded", refundedAt: new Date() });
    const tally = await svc.processDueInvoices(vi.fn());
    expect(tally).toEqual({ skipped_refunded: 2 });
    expect(h.co.findMany.mock.calls[0][0].where.invoiceStatus).toBe("scheduled");
  });
});

describe("applyAdminInvoiceAction", () => {
  const row = { id: "c1", status: "completed", invoiceStatus: "scheduled", invoiceAction: null, completedAt: new Date() };

  it("CANCEL: anında 'cancelled' yapar", async () => {
    h.co.findUnique.mockResolvedValue(row);
    const r = await svc.applyAdminInvoiceAction("oid-1", "CANCEL", vi.fn());
    expect(r).toEqual({ invoiceStatus: "cancelled", invoiceAction: "CANCEL" });
  });
  it("VAT: vade gününde KDV'li kesmek üzere işaretler, vadeyi öne çekmez", async () => {
    h.co.findUnique.mockResolvedValue(row);
    const r = await svc.applyAdminInvoiceAction("oid-1", "VAT", vi.fn());
    expect(r).toEqual({ invoiceStatus: "scheduled", invoiceAction: "VAT" });
    expect(h.co.update.mock.calls[0][0].data).toEqual({ invoiceAction: "VAT", invoiceStatus: "scheduled" });
  });
  it("NOW_VAT: hemen KDV'li keser", async () => {
    h.co.findUnique.mockResolvedValueOnce(row).mockResolvedValue({ ...base, invoiceAction: "VAT" });
    const trigger = vi.fn().mockResolvedValue("ok");
    const r = await svc.applyAdminInvoiceAction("oid-1", "NOW_VAT", trigger);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger.mock.calls[0][2]).toEqual({ forceDomestic: true });
    expect(r.outcome).toBe("issued");
  });
  it("planı olmayan (eski/durdurulmuş) ödemede NOW de çalışır", async () => {
    h.co.findUnique.mockResolvedValueOnce({ ...row, invoiceStatus: null }).mockResolvedValue(base);
    const trigger = vi.fn().mockResolvedValue("ok");
    const r = await svc.applyAdminInvoiceAction("oid-1", "NOW", trigger);
    expect(r.outcome).toBe("issued");
    expect(h.co.update.mock.calls[0][0].data.invoiceStatus).toBe("scheduled");
  });
  it("iade edilmiş, faturası kesilmiş ya da işlenen ödemeye dokunulmaz (409)", async () => {
    h.co.findUnique.mockResolvedValue({ ...row, status: "refunded" });
    await expect(svc.applyAdminInvoiceAction("oid-1", "NOW", vi.fn())).rejects.toMatchObject({ statusCode: 409 });
    h.co.findUnique.mockResolvedValue({ ...row, invoiceStatus: "issued" });
    await expect(svc.applyAdminInvoiceAction("oid-1", "CANCEL", vi.fn())).rejects.toMatchObject({ statusCode: 409 });
    h.co.findUnique.mockResolvedValue(row);
    h.inv.findUnique.mockResolvedValue({ id: "i1" });
    await expect(svc.applyAdminInvoiceAction("oid-1", "NOW", vi.fn())).rejects.toMatchObject({ statusCode: 409 });
    h.co.findUnique.mockResolvedValue(null);
    await expect(svc.applyAdminInvoiceAction("yok", "NOW", vi.fn())).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("reviewCardAtPayment (belirlenemedi e-postası)", () => {
  const co = { id: "c1", userId: "u1", conversationId: "oid-1", paymentCurrency: "USD", priceTry: "11.99", invoiceDueAt: new Date() };

  it("yurt dışı adres + kart belirlenemedi → yöneticiye bir kez e-posta", async () => {
    h.capture.mockResolvedValue("UNKNOWN");
    h.user.findUnique.mockResolvedValue({ email: "john@x.com", billingCountryCode: "DE" });
    expect(await svc.reviewCardAtPayment(co)).toBe("UNKNOWN");
    expect(h.sendMail).toHaveBeenCalledTimes(1);
    const mail = h.sendMail.mock.calls[0][0];
    expect(mail.to).toBe("admin@x.com");
    expect(mail.subject).toMatch(/belirlenemedi/);
    expect(mail.text).toMatch(/KDV'Lİ kesilecek/);
    expect(mail.text).toMatch(/john@x.com/);
    // ikinci çağrıda (claim=0) tekrar atmaz
    h.co.updateMany.mockResolvedValue({ count: 0 });
    await svc.reviewCardAtPayment(co);
    expect(h.sendMail).toHaveBeenCalledTimes(1);
  });
  it("yurt dışı adres + Türk kartı → e-posta (konu farklı)", async () => {
    h.capture.mockResolvedValue("TR");
    h.user.findUnique.mockResolvedValue({ email: "a@x.com", billingCountryCode: "US" });
    await svc.reviewCardAtPayment(co);
    expect(h.sendMail.mock.calls[0][0].subject).toMatch(/Türk kartıyla/);
  });
  it("kart yabancı, adres yurt içi ya da istisna kapalı → e-posta yok", async () => {
    h.capture.mockResolvedValue("FOREIGN");
    await svc.reviewCardAtPayment(co);
    h.capture.mockResolvedValue("UNKNOWN");
    h.user.findUnique.mockResolvedValue({ email: "a@x.com", billingCountryCode: "TR" });
    await svc.reviewCardAtPayment(co);
    h.user.findUnique.mockResolvedValue({ email: "a@x.com", billingCountryCode: "DE" });
    h.open.mockResolvedValue(false);
    await svc.reviewCardAtPayment(co);
    expect(h.sendMail).not.toHaveBeenCalled();
  });
  it("hata olursa fırlatmaz", async () => {
    h.capture.mockRejectedValue(new Error("x"));
    expect(await svc.reviewCardAtPayment(co)).toBeNull();
  });
});
