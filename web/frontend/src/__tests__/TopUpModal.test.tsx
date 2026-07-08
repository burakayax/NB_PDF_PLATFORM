import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TopUpModal } from "../components/tools/TopUpModal";

// ── Bağımlılıklar mock'lanır (ödeme + kota + iyzico) ─────────────────────────
vi.mock("../hooks/useSettings", () => ({
  useSettings: vi.fn(() => ({ flags: { featureFlags: { paymentsDisabled: false } } })),
}));

vi.mock("../api/ai", () => ({
  fetchTopupPacks: vi.fn(async () => [
    { id: "ai-50", credits: 50, priceUSD: 4.99, priceTRY: 149 },
    { id: "ai-150", credits: 150, priceUSD: 11.99, priceTRY: 349, popular: true },
  ]),
  topupGrant: vi.fn(async () => ({
    quota: { used: 0, limit: 100, remaining: 100, unlimited: false, resetAt: "" },
  })),
}));

vi.mock("../api/payment", () => ({
  createTopupCheckout: vi.fn(async () => ({
    token: "tok",
    checkoutFormContent: "<html></html>",
    conversationId: "conv",
  })),
}));

vi.mock("../lib/iyzicoLaunch", () => ({
  launchIyzicoCheckout: vi.fn(),
}));

import { useSettings } from "../hooks/useSettings";
import { topupGrant } from "../api/ai";
import { createTopupCheckout } from "../api/payment";
import { launchIyzicoCheckout } from "../lib/iyzicoLaunch";

function paymentsEnabled() {
  vi.mocked(useSettings).mockReturnValue({
    flags: { featureFlags: { paymentsDisabled: false } },
  } as unknown as ReturnType<typeof useSettings>);
}

function paymentsDisabled() {
  vi.mocked(useSettings).mockReturnValue({
    flags: { featureFlags: { paymentsDisabled: true } },
  } as unknown as ReturnType<typeof useSettings>);
}

describe("TopUpModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentsEnabled();
  });

  it("lists top-up packs with prices", async () => {
    render(<TopUpModal language="tr" accessToken="jwt" onClose={vi.fn()} />);
    // Paketler yüklendi — iki kalem
    expect((await screen.findAllByText(/AI kredisi/)).length).toBe(2);
    // Fiyatlar (biçimden bağımsız — ICU'ya göre değişebilir)
    expect(screen.getByText(/149/)).toBeInTheDocument();
    expect(screen.getByText(/349/)).toBeInTheDocument();
    // Popüler rozeti
    expect(screen.getByText(/Popüler/)).toBeInTheDocument();
  });

  it("starts iyzico checkout when a pack is purchased (payments enabled)", async () => {
    render(<TopUpModal language="tr" accessToken="jwt" onClose={vi.fn()} />);
    const buyButtons = await screen.findAllByRole("button", { name: /Satın Al/ });
    fireEvent.click(buyButtons[0]!);
    await waitFor(() => expect(createTopupCheckout).toHaveBeenCalledWith("jwt", "ai-50"));
    await waitFor(() => expect(launchIyzicoCheckout).toHaveBeenCalledTimes(1));
  });

  it("shows an error message if starting checkout fails", async () => {
    vi.mocked(createTopupCheckout).mockRejectedValueOnce(new Error("Ödeme hatası XY"));
    render(<TopUpModal language="tr" accessToken="jwt" onClose={vi.fn()} />);
    const buyButtons = await screen.findAllByRole("button", { name: /Satın Al/ });
    fireEvent.click(buyButtons[0]!);
    expect(await screen.findByText(/Ödeme hatası XY/)).toBeInTheDocument();
    expect(launchIyzicoCheckout).not.toHaveBeenCalled();
  });

  it("calls onClose from the close button", async () => {
    const onClose = vi.fn();
    render(<TopUpModal language="tr" accessToken="jwt" onClose={onClose} />);
    await screen.findAllByText(/AI kredisi/);
    fireEvent.click(screen.getByRole("button", { name: /Kapat/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the current bonus when provided", async () => {
    render(<TopUpModal language="tr" accessToken="jwt" bonus={7} onClose={vi.fn()} />);
    expect(await screen.findByText(/Mevcut bonus: 7/)).toBeInTheDocument();
  });

  it("lets an admin grant credits for testing when payments are disabled", async () => {
    paymentsDisabled();
    const onGranted = vi.fn();
    render(
      <TopUpModal language="tr" accessToken="jwt" isAdmin onGranted={onGranted} onClose={vi.fn()} />,
    );
    const addButtons = await screen.findAllByRole("button", { name: /Test için ekle/ });
    fireEvent.click(addButtons[0]!);
    await waitFor(() => expect(topupGrant).toHaveBeenCalledWith("ai-50", "jwt"));
    await waitFor(() => expect(onGranted).toHaveBeenCalled());
  });

  it("shows 'coming soon' to non-admins when payments are disabled", async () => {
    paymentsDisabled();
    render(<TopUpModal language="tr" accessToken="jwt" onClose={vi.fn()} />);
    await screen.findAllByText(/AI kredisi/);
    expect(screen.getAllByText(/Yakında/).length).toBeGreaterThan(0);
    expect(createTopupCheckout).not.toHaveBeenCalled();
  });
});
