import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const fetchSummary = vi.fn();
vi.mock("../api/admin", () => ({ fetchAdminPaymentsSummary: (...a: unknown[]) => fetchSummary(...a) }));

import { PaymentsSummary } from "../admin/payments/PaymentsSummary";

const row = (over = {}) => ({
  period: "2026-11",
  paidCount: 2,
  paidTotal: 519,
  refundedCount: 1,
  refundedTotal: 399,
  netTotal: 120,
  kdvIssued: 66.5,
  kdvCredited: 20,
  kdvNet: 46.5,
  pendingKdvEstimate: 20,
  foreignCount: 1,
  ...over,
});

describe("PaymentsSummary (ödeme / iade / KDV özeti)", () => {
  beforeEach(() => {
    fetchSummary.mockReset().mockResolvedValue({
      group: "month",
      from: "2026-01-01",
      to: "2026-11-12",
      rows: [row()],
      totals: row({ period: "Toplam" }),
      currentMonth: { period: "2026-11", kdvNet: 46.5 },
      truncated: false,
    });
  });

  it("bu ay ödenecek KDV ve dönem satırını gösterir", async () => {
    render(<PaymentsSummary accessToken="t" />);
    await waitFor(() => expect(screen.getByTestId("kdv-month").textContent).toMatch(/46,50/));
    expect(screen.getByText("Kasım 2026")).toBeTruthy();
    expect(screen.getByText(/döviz \(USD\/EUR\) ödeme var/)).toBeTruthy();
  });

  it("Gün düğmesi gruplamayı değiştirip yeniden sorgular", async () => {
    render(<PaymentsSummary accessToken="t" />);
    await waitFor(() => expect(fetchSummary).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("group-day"));
    await waitFor(() => expect(fetchSummary.mock.calls.at(-1)?.[1]).toMatchObject({ group: "day" }));
  });
});
