import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const fetchSettings = vi.fn();
const putPatches = vi.fn();
const binStatus = vi.fn();
vi.mock("../api/admin", () => ({
  fetchAdminSettings: (...a: unknown[]) => fetchSettings(...a),
  putAdminSettingsPatches: (...a: unknown[]) => putPatches(...a),
  fetchAdminCardListStatus: (...a: unknown[]) => binStatus(...a),
}));
vi.mock("../lib/runtimeRefreshEvents", () => ({ notifyRuntimeRefresh: vi.fn() }));

import { PaymentSwitches } from "../admin/payments/PaymentSwitches";

describe("PaymentSwitches (Ödemeler ve iade üst düğmeleri)", () => {
  beforeEach(() => {
    fetchSettings.mockReset();
    putPatches.mockReset();
    putPatches.mockResolvedValue(undefined);
    binStatus.mockReset().mockResolvedValue({ entries: 0, generatedAt: null, ageDays: null, stale: true, total30d: 4, unknown30d: 3, exemptionOpen: false });
  });

  it("kayıt yokken üçü de DURDURULMUŞ görünür (güvenli varsayılan)", async () => {
    fetchSettings.mockResolvedValue({});
    render(<PaymentSwitches accessToken="t" />);
    await waitFor(() => expect(screen.getByText("Ödemeleri aç")).toBeTruthy());
    expect(screen.getByText("Fatura kesmeyi aç")).toBeTruthy();
    expect(screen.getByText("İstisnayı aç")).toBeTruthy();
  });

  it("Ödemeleri aç: yalnız paymentsDisabled=false yazar, diğer bayrakları ezmez", async () => {
    fetchSettings.mockResolvedValue({
      "global.flags": { featureFlags: { contactForm: true, invoicingPaused: true }, aiToolStates: { a: "open" } },
    });
    render(<PaymentSwitches accessToken="t" />);
    await waitFor(() => expect(screen.getByText("Ödemeleri aç")).toBeTruthy());
    fireEvent.click(screen.getByText("Ödemeleri aç"));
    // ikinci onay: ortada açılan pencere; onaylanmadan hiçbir şey yazılmaz
    expect(putPatches).not.toHaveBeenCalled();
    expect(screen.getByText("Ödemeler açılsın mı?")).toBeTruthy();
    fireEvent.click(screen.getByTestId("confirm-ok"));
    await waitFor(() => expect(putPatches).toHaveBeenCalled());
    const body = putPatches.mock.calls[0][1]["global.flags"];
    expect(body.featureFlags).toEqual({ contactForm: true, invoicingPaused: true, paymentsDisabled: false });
    expect(body.aiToolStates).toEqual({ a: "open" });
    await waitFor(() => expect(screen.getByText("Ödemeleri kapat")).toBeTruthy());
  });

  it("açık fatura anahtarı tekrar basılınca true yazar (durdurur)", async () => {
    fetchSettings.mockResolvedValue({ "global.flags": { featureFlags: { invoicingPaused: false } } });
    render(<PaymentSwitches accessToken="t" />);
    await waitFor(() => expect(screen.getByText("Fatura kesmeyi durdur")).toBeTruthy());
    fireEvent.click(screen.getByText("Fatura kesmeyi durdur"));
    await waitFor(() => expect(putPatches).toHaveBeenCalled());
    expect(putPatches.mock.calls[0][1]["global.flags"].featureFlags.invoicingPaused).toBe(true);
  });

  it("açma sırasında Vazgeç denirse hiçbir şey kaydedilmez", async () => {
    fetchSettings.mockResolvedValue({});
    render(<PaymentSwitches accessToken="t" />);
    await waitFor(() => expect(screen.getByText("İstisnayı aç")).toBeTruthy());
    fireEvent.click(screen.getByText("İstisnayı aç"));
    expect(screen.getByText("Yurt dışı KDV istisnası açılsın mı?")).toBeTruthy();
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    expect(putPatches).not.toHaveBeenCalled();
  });

  it("BIN listesi boş/eskiyse uyarır ve belirlenemedi sayısını gösterir", async () => {
    fetchSettings.mockResolvedValue({});
    render(<PaymentSwitches accessToken="t" />);
    const el = await screen.findByTestId("bin-status");
    expect(el.textContent).toMatch(/hiç güncellenmedi/);
    expect(el.textContent).toMatch(/4 ödemenin 3/);
    expect(el.textContent).toMatch(/LİSTE BOŞ YA DA ESKİ/);
  });
});
