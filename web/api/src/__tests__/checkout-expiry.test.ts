import { describe, expect, it, vi } from "vitest";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn().mockResolvedValue({ count: 2 }) }));
vi.mock("../lib/prisma.js", () => ({ prisma: { paymentCheckout: { updateMany } } }));

import { expireStalePendingCheckouts } from "../jobs/checkoutExpiryJobs.js";

describe("bekleyen ödemeyi süresi doldu yapma", () => {
  it("yalnız 24 saati geçen, tamamlanmamış bekleyen kayıtları günceller; silmez", async () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const n = await expireStalePendingCheckouts(now);
    expect(n).toBe(2);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where.status).toBe("pending");
    expect(arg.where.completedAt).toBeNull();
    expect(arg.where.createdAt.lt.toISOString()).toBe("2026-11-19T12:00:00.000Z");
    expect(arg.data).toEqual({ status: "expired" });
  });
});
