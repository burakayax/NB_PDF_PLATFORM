import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DailyPoolChip } from "../components/dashboard/DailyPoolChip";

describe("DailyPoolChip", () => {
  it("günlük sınır yoksa (null) hiç çizilmez", () => {
    const { container } = render(<DailyPoolChip language="tr" daily={{ used: 4, limit: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("veri yoksa çizilmez", () => {
    const { container } = render(<DailyPoolChip language="tr" daily={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("kalan/limit gösterir (4 hakkın 1'i harcandı → 3/4)", () => {
    render(<DailyPoolChip language="tr" daily={{ used: 1, limit: 4 }} />);
    expect(screen.getByRole("button", { name: /3 \/ 4 kaldı/ })).toBeTruthy();
  });

  it("ağır işlem limiti aştıysa kalan 0'ın altına düşmez", () => {
    render(<DailyPoolChip language="tr" daily={{ used: 5, limit: 4 }} />);
    expect(screen.getByRole("button", { name: /0 \/ 4 kaldı/ })).toBeTruthy();
  });

  it("tıklayınca açıklama açılır: cihazdaki araçlar hakkı düşürmez + Pro reklamı + yükselt düğmesi", () => {
    const onUpgrade = vi.fn();
    render(<DailyPoolChip language="tr" daily={{ used: 2, limit: 4 }} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByRole("button", { name: /kaldı/ }));
    expect(screen.getByText(/hakkından düşmez/)).toBeTruthy();
    expect(screen.getByText(/ayda 40 yapay zekâ işlemi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pro'ya geç" }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("yükselt işlevi yoksa Pro'ya geç düğmesi çıkmaz (reklam metni kalır)", () => {
    render(<DailyPoolChip language="tr" daily={{ used: 0, limit: 3 }} />);
    fireEvent.click(screen.getByRole("button", { name: /kaldı/ }));
    expect(screen.queryByRole("button", { name: "Pro'ya geç" })).toBeNull();
    expect(screen.getByText(/Pro'ya geçersen/)).toBeTruthy();
  });
});
