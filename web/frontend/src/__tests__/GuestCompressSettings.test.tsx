import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { GuestCompressAdminState } from "../api/admin";

const fetchSettings = vi.fn();
const saveSettings = vi.fn();
vi.mock("../api/admin", () => ({
  fetchGuestCompressSettings: (...a: unknown[]) => fetchSettings(...a),
  saveGuestCompressSettings: (...a: unknown[]) => saveSettings(...a),
}));

import { GuestCompressSettings } from "../admin/GuestCompressSettings";

function state(over: Partial<GuestCompressAdminState> = {}): GuestCompressAdminState {
  return {
    config: { enabled: true, dailyLimit: 1, globalDailyLimit: 400, maxMB: 20 },
    defaults: { enabled: true, dailyLimit: 1, globalDailyLimit: 400, maxMB: 20 },
    bounds: { dailyLimit: { min: 0, max: 20 }, globalDailyLimit: { min: 0, max: 100000 }, maxMB: { min: 1, max: 100 } },
    closed: false,
    today: { operations: 40, visitors: 31 },
    memberDailyLimit: 3,
    bridge: { secretConfigured: true, lastContactAt: "2026-10-08T10:00:00.000Z" },
    ...over,
  };
}

describe("GuestCompressSettings — yönetim paneli", () => {
  beforeEach(() => {
    fetchSettings.mockReset();
    saveSettings.mockReset();
  });

  it("durumu, bugünkü kullanımı ve kalıcı sayaç bilgisini gösterir", async () => {
    fetchSettings.mockResolvedValue(state());
    render(<GuestCompressSettings accessToken="t" />);
    expect(await screen.findByText("AÇIK")).toBeTruthy();
    expect(screen.getByText(/misafir işlemi/)).toBeTruthy();
    expect(screen.getByText(/Sayaç veritabanında tutuluyor \(kalıcı\)/)).toBeTruthy();
  });

  it("acil kapat tek tıkla yalnız ana anahtarı kapatır ve durumu KAPALI yapar", async () => {
    fetchSettings.mockResolvedValue(state());
    saveSettings.mockResolvedValue(state({ config: { enabled: false, dailyLimit: 1, globalDailyLimit: 400, maxMB: 20 }, closed: true }));
    render(<GuestCompressSettings accessToken="t" />);
    fireEvent.click(await screen.findByRole("button", { name: "Acil kapat" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith("t", { enabled: false }));
    expect(await screen.findByText("KAPALI")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yeniden aç" })).toBeTruthy();
    expect(screen.getByText(/Misafir kullanımı KAPATILDI/)).toBeTruthy();
  });

  it("kapalıyken 'Yeniden aç' ana anahtarı açar", async () => {
    fetchSettings.mockResolvedValue(state({ config: { enabled: false, dailyLimit: 1, globalDailyLimit: 400, maxMB: 20 }, closed: true }));
    saveSettings.mockResolvedValue(state());
    render(<GuestCompressSettings accessToken="t" />);
    fireEvent.click(await screen.findByRole("button", { name: "Yeniden aç" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith("t", { enabled: true }));
  });

  it("değişiklik yoksa Kaydet pasif; değişince yalnız üç sayıyı yollar", async () => {
    fetchSettings.mockResolvedValue(state());
    saveSettings.mockResolvedValue(state({ config: { enabled: true, dailyLimit: 2, globalDailyLimit: 400, maxMB: 20 } }));
    render(<GuestCompressSettings accessToken="t" />);
    const save = (await screen.findByRole("button", { name: "Kaydet" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const daily = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
    fireEvent.change(daily, { target: { value: "2" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith("t", { dailyLimit: 2, globalDailyLimit: 400, maxMB: 20 }),
    );
  });

  it("misafir hakkı üye hakkına eşit/büyükse üyelik avantajı uyarısı verir", async () => {
    fetchSettings.mockResolvedValue(state());
    render(<GuestCompressSettings accessToken="t" />);
    const daily = (await screen.findAllByRole("spinbutton"))[0] as HTMLInputElement;
    expect(screen.queryByText(/Üyelik avantajı kalmaz/)).toBeNull();
    fireEvent.change(daily, { target: { value: "3" } });
    expect(screen.getByText(/Üyelik avantajı kalmaz/)).toBeTruthy();
  });

  it("ortak anahtar yoksa sayacın geçici diskte olduğunu ve nasıl düzeltileceğini söyler", async () => {
    fetchSettings.mockResolvedValue(state({ bridge: { secretConfigured: false, lastContactAt: null } }));
    render(<GuestCompressSettings accessToken="t" />);
    expect(await screen.findByText(/Sayaç geçici diskte tutuluyor/)).toBeTruthy();
    expect(screen.getAllByText(/INTERNAL_SERVICE_SECRET/).length).toBeGreaterThan(0);
  });

  it("anahtar var ama PDF servisi henüz ulaşmadıysa nötr bir uyarı gösterir", async () => {
    fetchSettings.mockResolvedValue(state({ bridge: { secretConfigured: true, lastContactAt: null } }));
    render(<GuestCompressSettings accessToken="t" />);
    expect(await screen.findByText(/henüz ulaşmadı/)).toBeTruthy();
  });

  it("sunucu hata verirse anlaşılır mesaj gösterir", async () => {
    fetchSettings.mockResolvedValue(state());
    saveSettings.mockRejectedValue(new Error("boom"));
    render(<GuestCompressSettings accessToken="t" />);
    fireEvent.click(await screen.findByRole("button", { name: "Acil kapat" }));
    expect(await screen.findByText(/Kaydedilemedi/)).toBeTruthy();
  });
});
