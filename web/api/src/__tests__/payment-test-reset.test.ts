import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let paymentsOpen = false;
const tx = {
  couponUse: { deleteMany: vi.fn(async () => void calls.push("couponUse.deleteMany")) },
  paymentCheckout: { deleteMany: vi.fn(async (a: unknown) => void calls.push("paymentCheckout.deleteMany:" + JSON.stringify(a))) },
  user: { updateMany: vi.fn(async () => void calls.push("user.updateMany")) },
  team: { updateMany: vi.fn(async () => void calls.push("team.updateMany")) },
};
const prisma = {
  user: { findMany: vi.fn(async () => [{ id: "a1" }]), count: vi.fn(async () => 1), ...{} },
  paymentCheckout: { findMany: vi.fn(async () => [{ id: "c1" }, { id: "c2" }]), count: vi.fn(async () => 0) },
  invoice: { count: vi.fn(async () => 2) },
  couponUse: { count: vi.fn(async () => 1) },
  team: { count: vi.fn(async () => 0) },
  $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
};
vi.mock("../lib/prisma.js", () => ({ prisma }));
vi.mock("../modules/payment/payments-gate.middleware.js", () => ({ arePaymentsEnabled: vi.fn(async () => paymentsOpen) }));
vi.mock("../modules/admin/admin-audit.service.js", () => ({ logAdminAudit: vi.fn(async () => void calls.push("audit")) }));

const { adminResetTestPaymentsController } = await import("../modules/admin/payment-test-reset.admin.js");

function req(body: unknown) {
  return { body, authUser: { id: "a1", email: "a@x.com" } } as never;
}
function res() {
  const r = { body: undefined as unknown, json(b: unknown) { r.body = b; } };
  return r;
}

beforeEach(() => {
  calls.length = 0;
  paymentsOpen = false;
});

describe("test ödemelerini temizleme", () => {
  it("ödemeler açıkken reddeder, hiçbir şey silmez", async () => {
    paymentsOpen = true;
    await expect(adminResetTestPaymentsController(req({ confirm: "SIL" }), res() as never)).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it("onay yoksa yalnız sayar (önizleme)", async () => {
    const r = res();
    await adminResetTestPaymentsController(req({}), r as never);
    expect(r.body).toMatchObject({ deleted: false, counts: { payments: 2, invoices: 2 } });
    expect(calls).toEqual([]);
  });

  it("yanlış onay metni silmez", async () => {
    const r = res();
    await adminResetTestPaymentsController(req({ confirm: "sil?" }), r as never);
    expect((r.body as { deleted: boolean }).deleted).toBe(false);
    expect(calls).toEqual([]);
  });

  it("'SIL' ile yalnız yönetici ödemelerini siler ve denetim kaydı yazar", async () => {
    const r = res();
    await adminResetTestPaymentsController(req({ confirm: "SIL" }), r as never);
    expect((r.body as { deleted: boolean }).deleted).toBe(true);
    expect(calls.some((c) => c.startsWith("paymentCheckout.deleteMany") && c.includes("c1") && c.includes("c2"))).toBe(true);
    expect(calls).toContain("audit");
  });
});
