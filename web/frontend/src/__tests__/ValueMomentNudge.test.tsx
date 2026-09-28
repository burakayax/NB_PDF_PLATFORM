import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ValueMomentNudge } from "../components/tools/ValueMomentNudge";

const trackFunnelEvent = vi.fn();
vi.mock("../lib/analytics", () => ({
  trackFunnelEvent: (...a: unknown[]) => trackFunnelEvent(...a),
}));

/**
 * ÜCRETSİZ HESAP DAVETİ — modal, dosyadan SONRA gelmeli.
 *
 * Sonuç ekranı açılır açılmaz önüne çıkan bir davet "dosyamı vermeden önce
 * beni kaydolmaya zorluyor" hissi verir; bu yüzden kart artık `ToolResultPanel`
 * indirmeyi tamamlayınca yaydığı `nb:file-downloaded` olayını bekliyor. Bu
 * testler o zamanlamayı korur.
 */
describe("ValueMomentNudge — indirme sonrası modal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackFunnelEvent.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mount anında görünmez", () => {
    render(<ValueMomentNudge language="tr" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("indirme olayından kısa süre sonra modal olarak belirir", () => {
    render(<ValueMomentNudge language="tr" source="merge_success" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("nb:file-downloaded"));
    });
    // Olaydan hemen sonra değil, kısa bir nefes payından sonra gelmeli.
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(trackFunnelEvent).toHaveBeenCalledWith("sign_up_cta_shown", { source: "merge_success" });
  });

  it("indirme hiç olmazsa yedek süre sonunda yine de belirir", () => {
    render(<ValueMomentNudge language="tr" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("kapatınca 24 saat snooze'a girer ve dismiss event'i gönderir", () => {
    render(<ValueMomentNudge language="tr" source="split_success" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();

    act(() => {
      screen.getByLabelText("Kapat").click();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trackFunnelEvent).toHaveBeenCalledWith("sign_up_cta_dismissed", { source: "split_success" });
    expect(localStorage.getItem("nb_value_nudge_snooze_until")).not.toBeNull();
  });

  it("üye ol'a tıklayınca click event'i gönderir", () => {
    render(<ValueMomentNudge language="tr" source="udf_to_pdf_success" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    screen.getByText("Ücretsiz hesap aç").click();
    expect(trackFunnelEvent).toHaveBeenCalledWith("sign_up_cta_click", { source: "udf_to_pdf_success" });
  });
});
