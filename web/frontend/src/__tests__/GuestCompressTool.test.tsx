import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const trackFunnelEvent = vi.fn();
const trackGAEvent = vi.fn();
vi.mock("../lib/analytics", () => ({
  trackFunnelEvent: (...a: unknown[]) => trackFunnelEvent(...a),
  trackGAEvent: (...a: unknown[]) => trackGAEvent(...a),
}));

const getAllowance = vi.fn();
const startCompress = vi.fn();
vi.mock("../api", async (orig) => {
  const real = await orig<typeof import("../api")>();
  return {
    ...real,
    getGuestCompressAllowance: (...a: unknown[]) => getAllowance(...a),
    startGuestCompress: (...a: unknown[]) => startCompress(...a),
  };
});

import { GuestCompressTool } from "../components/tools/GuestCompressTool";
import { GuestCompressLimitError } from "../api";

const FULL = { used: 0, limit: 1, remaining: 1, resetAt: "2026-10-09T00:00:00+03:00", maxMB: 20 };
const EMPTY = { ...FULL, used: 1, remaining: 0 };

function renderTool() {
  const onRegister = vi.fn();
  const onLogin = vi.fn();
  render(<GuestCompressTool language="tr" onRegister={onRegister} onLogin={onLogin} />);
  return { onRegister, onLogin };
}

function pickPdf(size = 1024) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([new Uint8Array(size)], "rapor.pdf", { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("GuestCompressTool — misafir hakkı ve dönüşüm", () => {
  beforeEach(() => {
    trackFunnelEvent.mockReset();
    trackGAEvent.mockReset();
    getAllowance.mockReset();
    startCompress.mockReset();
  });

  it("hak varken yüklemeden ÖNCE hakkı ve üyelik avantajını açıkça yazar", async () => {
    getAllowance.mockResolvedValue(FULL);
    renderTool();
    expect(await screen.findByText(/günde 1 ücretsiz PDF sıkıştırma hakkın var/)).toBeTruthy();
    expect(screen.getByText(/Ücretsiz üyelikle günde 3 işlem/)).toBeTruthy();
    expect(screen.getByText(/sunucuda işlenir ve işlem sonrası silinir/)).toBeTruthy();
  });

  it("hak bitmişse yükleme yerine üyelik kapısı gösterir ve tıklamayı ölçer", async () => {
    getAllowance.mockResolvedValue(EMPTY);
    const { onRegister } = renderTool();
    expect(await screen.findByText("Bugünkü ücretsiz hakkını kullandın")).toBeTruthy();
    expect(screen.queryByText("PDF'i sıkıştır")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ücretsiz üye ol/ }));
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(trackFunnelEvent).toHaveBeenCalledWith("sign_up_cta_click", { source: "compress_gate" });
  });

  it("sunucu 'hak doldu' derse kapıya geçer ve yönetici yolculuğuna yazar", async () => {
    getAllowance.mockResolvedValue(FULL);
    startCompress.mockRejectedValue(new GuestCompressLimitError("daily_limit", EMPTY, "doldu"));
    renderTool();
    await screen.findByText(/günde 1 ücretsiz/);
    pickPdf();
    fireEvent.click(await screen.findByRole("button", { name: "PDF'i sıkıştır" }));
    expect(await screen.findByText("Bugünkü ücretsiz hakkını kullandın")).toBeTruthy();
    expect(trackFunnelEvent).toHaveBeenCalledWith("quota_wall_hit", { source: "compress_guest", reason: "daily_limit" });
  });

  it("kapasite dolduğunda farklı, dürüst bir mesaj gösterir", async () => {
    getAllowance.mockResolvedValue(FULL);
    startCompress.mockRejectedValue(new GuestCompressLimitError("capacity", null, "kapasite"));
    renderTool();
    await screen.findByText(/günde 1 ücretsiz/);
    pickPdf();
    fireEvent.click(await screen.findByRole("button", { name: "PDF'i sıkıştır" }));
    expect(await screen.findByText("Bugünkü misafir kapasitesi doldu")).toBeTruthy();
  });

  it("limitten büyük dosyayı sunucuya göndermeden reddeder", async () => {
    getAllowance.mockResolvedValue(FULL);
    renderTool();
    await screen.findByText(/günde 1 ücretsiz/);
    pickPdf(21 * 1024 * 1024);
    expect(await screen.findByText(/20 MB sınırını aşıyor/)).toBeTruthy();
    expect(startCompress).not.toHaveBeenCalled();
  });

  it("PDF olmayan dosyayı reddeder", async () => {
    getAllowance.mockResolvedValue(FULL);
    renderTool();
    await screen.findByText(/günde 1 ücretsiz/);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "resim.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByText("Lütfen bir PDF dosyası seç.")).toBeTruthy());
  });

  it("kalite ile hedef boyut birlikte seçilemez: ya kaliteye göre ya hedef boyuta göre", async () => {
    getAllowance.mockResolvedValue(FULL);
    renderTool();
    await screen.findByText(/günde 1 ücretsiz/);
    pickPdf();
    await screen.findByRole("button", { name: "PDF'i sıkıştır" });
    // Varsayılan: kalite menüsü var, hedef boyut menüsü yok.
    expect(screen.queryByText("Hedef boyut")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hedef boyuta göre" }));
    expect(screen.getByText("Hedef boyut")).toBeTruthy();
    expect(screen.queryByText("Kalite")).toBeNull();
  });
});
