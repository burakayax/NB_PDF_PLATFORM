import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuotaMeter } from "../components/workspace/QuotaMeter";

const trackGAEvent = vi.fn();
vi.mock("../lib/analytics", () => ({ trackGAEvent: (...a: unknown[]) => trackGAEvent(...a) }));

/**
 * GÜNLÜK HAK GÖSTERGESİ.
 *
 * Kullanıcı hakkının bittiğini işi yarıda kesildiğinde öğreniyordu ve duvara
 * çarpma anı hiç ölçülmüyordu. Bu testler iki şeyi korur: sayaç duvardan ÖNCE
 * uyarır ve o an ölçüme bildirilir.
 */
describe("günlük hak göstergesi", () => {
  beforeEach(() => trackGAEvent.mockReset());

  it("hak bolken sessiz kalır (yükseltme çağrısı yok)", () => {
    render(<QuotaMeter language="tr" used={0} limit={10} />);
    expect(screen.getByText(/0\/10 işlem/)).toBeTruthy();
    expect(screen.queryByText(/Sınırsıza geç/)).toBeNull();
    expect(trackGAEvent).not.toHaveBeenCalled();
  });

  it("hak azalınca duvara ÇARPMADAN uyarır", () => {
    render(<QuotaMeter language="tr" used={2} limit={3} />);
    expect(screen.getByText(/Son 1 hakkın kaldı/)).toBeTruthy();
    expect(screen.getByText(/Sınırsıza geç/)).toBeTruthy();
    expect(trackGAEvent).toHaveBeenCalledWith("quota_warning_shown", expect.any(Object));
  });

  it("hak bitince ne zaman yenileneceğini söyler", () => {
    render(
      <QuotaMeter
        language="tr"
        used={3}
        limit={3}
        resetAt={new Date(Date.now() + 3 * 3600_000).toISOString()}
      />,
    );
    expect(screen.getByText(/Bugünkü hakkın doldu/)).toBeTruthy();
    expect(screen.getByText(/3 saat içinde yenilenir/)).toBeTruthy();
    expect(trackGAEvent).toHaveBeenCalledWith("quota_wall_hit", expect.any(Object));
  });

  it("sınırsız planda sayaç çubuğu gösterilmez", () => {
    const { container } = render(<QuotaMeter language="tr" used={99} limit={null} />);
    expect(screen.getByText(/Sınırsız işlem hakkın var/)).toBeTruthy();
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("misafire kayıt, üyeye yükseltme çağrısı yapar", () => {
    const onRegister = vi.fn();
    const onUpgrade = vi.fn();
    const { rerender } = render(
      <QuotaMeter language="tr" used={3} limit={3} isGuest onRegister={onRegister} />,
    );
    fireEvent.click(screen.getByText(/Ücretsiz üye ol/));
    expect(onRegister).toHaveBeenCalled();

    rerender(<QuotaMeter language="tr" used={3} limit={3} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByText(/Sınırsıza geç/));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("aynı durumu tekrar tekrar ölçüme bildirmez", () => {
    const { rerender } = render(<QuotaMeter language="tr" used={3} limit={3} />);
    rerender(<QuotaMeter language="tr" used={3} limit={3} />);
    rerender(<QuotaMeter language="tr" used={3} limit={3} />);
    const duvar = trackGAEvent.mock.calls.filter((c) => c[0] === "quota_wall_hit");
    expect(duvar).toHaveLength(1);
  });
});
