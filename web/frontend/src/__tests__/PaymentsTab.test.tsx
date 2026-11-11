import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { AdminPaymentRow, AdminPaymentsPage } from "../api/admin";

const fetchPayments = vi.fn();
const refund = vi.fn();
const paytrStatus = vi.fn();
vi.mock("../api/admin", () => ({
  fetchAdminPayments: (...a: unknown[]) => fetchPayments(...a),
  refundAdminPayment: (...a: unknown[]) => refund(...a),
  fetchAdminPaytrStatus: (...a: unknown[]) => paytrStatus(...a),
}));

vi.mock("../admin/payments/PaymentSwitches", () => ({ PaymentSwitches: () => null }));

import { PaymentsTab } from "../admin/payments/PaymentsTab";

function row(over: Partial<AdminPaymentRow> = {}): AdminPaymentRow {
  return {
    conversationId: "oid-1",
    createdAt: "2026-11-09T16:00:00.000Z",
    completedAt: "2026-11-09T16:01:00.000Z",
    refundedAt: null,
    refundReason: null,
    status: "completed",
    kind: "plan",
    plan: "STARTER",
    billingCycle: "MONTHLY",
    amount: 129,
    currency: "TRY",
    netAmount: "107.50",
    kdvAmount: "21.50",
    kdvRate: 20,
    discountPercent: null,
    provider: "paytr",
    invoiceStatus: null,
    invoiceNo: null,
    user: { id: "u1", email: "ayse@ornek.com", name: "Ayşe Yılmaz" },
    refundable: true,
    withinRefundWindow: true,
    ...over,
  };
}
function page(rows: AdminPaymentRow[]): AdminPaymentsPage {
  return {
    rows,
    total: rows.length,
    offset: 0,
    limit: 25,
    truncated: false,
    refundWindowDays: 7,
    totals: { completedCount: rows.length, completedAmount: 129, refundedCount: 0, refundedAmount: 0 },
  };
}

describe("PaymentsTab — ödemeler ve iade", () => {
  beforeEach(() => {
    fetchPayments.mockReset();
    refund.mockReset();
    paytrStatus.mockReset();
  });

  it("kullanıcı adı, e-posta, tutar ve durumu listeler", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    render(<PaymentsTab accessToken="t" />);
    expect(await screen.findByText("Ayşe Yılmaz")).toBeTruthy();
    expect(screen.getByText("ayse@ornek.com")).toBeTruthy();
    expect(screen.getAllByText("Tamamlandı").some((el) => el.tagName === "SPAN")).toBe(true);
    expect(screen.getAllByText(/129,00/).length).toBeGreaterThan(0);
  });

  it("arama kutusu filtreyi sunucuya gönderir", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    render(<PaymentsTab accessToken="t" />);
    await screen.findByText("Ayşe Yılmaz");
    fireEvent.change(screen.getByPlaceholderText(/ornek@mail.com/), { target: { value: "ayse" } });
    fireEvent.click(screen.getByText("Filtrele"));
    await waitFor(() => expect(fetchPayments).toHaveBeenLastCalledWith("t", expect.objectContaining({ q: "ayse", offset: "0" })));
  });

  it("iade: neden yazılmadan düğme kapalı; yazınca iade isteği gider", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    refund.mockResolvedValue({ ok: true, conversationId: "oid-1", planAfter: "FREE", refundedAt: "x", providerRefunded: true });
    render(<PaymentsTab accessToken="t" />);
    fireEvent.click(await screen.findByText("İade et"));
    const go = screen.getByText("İadeyi yap").closest("button") as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/İade nedeni/), { target: { value: "müşteri talebi" } });
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    await waitFor(() => expect(refund).toHaveBeenCalledWith("t", "oid-1", "müşteri talebi", false));
    expect(await screen.findByText(/PayTR üzerinden yapıldı/)).toBeTruthy();
  });

  it("süresi geçmiş ödemede açık onay kutusu olmadan iade edilemez", async () => {
    fetchPayments.mockResolvedValue(page([row({ withinRefundWindow: false })]));
    refund.mockResolvedValue({ ok: true, conversationId: "oid-1", planAfter: "FREE", refundedAt: "x", providerRefunded: true });
    render(<PaymentsTab accessToken="t" />);
    fireEvent.click(await screen.findByText("İade et"));
    fireEvent.change(screen.getByLabelText(/İade nedeni/), { target: { value: "istisna" } });
    const go = screen.getByText("İadeyi yap").closest("button") as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    await waitFor(() => expect(refund).toHaveBeenCalledWith("t", "oid-1", "istisna", true));
  });

  it("PayTR dışı ödemede parayı elle iade etme uyarısı gösterir; iade edilmişlerde düğme yok", async () => {
    fetchPayments.mockResolvedValue(
      page([row({ provider: "diger" }), row({ conversationId: "oid-2", status: "refunded", refundable: false })]),
    );
    refund.mockResolvedValue({ ok: true, conversationId: "oid-1", planAfter: "FREE", refundedAt: "x", providerRefunded: false });
    render(<PaymentsTab accessToken="t" />);
    expect(await screen.findAllByText("İade et")).toHaveLength(1);
    fireEvent.click(screen.getByText("İade et"));
    fireEvent.change(screen.getByLabelText(/İade nedeni/), { target: { value: "x" } });
    fireEvent.click(screen.getByText("İadeyi yap"));
    expect(await screen.findByText(/elle iade edin/)).toBeTruthy();
  });

  it("PayTR durumunu sorgular: bulunan siparişi ve test bilgisini gösterir", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    paytrStatus.mockResolvedValue({
      ok: true,
      merchantOid: "abc",
      testMode: true,
      fields: { payment_amount: "129.00", currency: "TL", returns: [] },
    });
    render(<PaymentsTab accessToken="t" />);
    fireEvent.click(await screen.findByText("PayTR durumunu sorgula"));
    expect(await screen.findByText("PayTR bu siparişi buluyor.")).toBeTruthy();
    expect(paytrStatus).toHaveBeenCalledWith("t", "oid-1");
    expect(screen.getByText("Evet (test)")).toBeTruthy();
    expect(screen.getByText("Yok")).toBeTruthy();
  });

  it("kayıtlı kart kanıtı varsa çözülmüş ilk 6 haneyi ve kararı gösterir", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    paytrStatus.mockResolvedValue({
      ok: true,
      merchantOid: "abc",
      testMode: false,
      fields: { currency: "USD" },
      savedEvidence: { bin: "411111", country: "US", verdict: "FOREIGN" },
    });
    render(<PaymentsTab accessToken="t" />);
    fireEvent.click(await screen.findByText("PayTR durumunu sorgula"));
    expect(await screen.findByText("411111")).toBeTruthy();
    expect(screen.getByText("Yurt dışı kart")).toBeTruthy();
  });

  it("PayTR siparişi bulamazsa hata kodunu olduğu gibi gösterir; PayTR dışı ödemede düğme yok", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    paytrStatus.mockResolvedValue({ ok: false, merchantOid: "abc", errNo: "004", errMsg: "merchant_oid ile islem bulunamadi" });
    const { unmount } = render(<PaymentsTab accessToken="t" />);
    fireEvent.click(await screen.findByText("PayTR durumunu sorgula"));
    expect(await screen.findByText(/merchant_oid ile islem bulunamadi/)).toBeTruthy();
    unmount();

    fetchPayments.mockResolvedValue(page([row({ provider: "diger" })]));
    render(<PaymentsTab accessToken="t" />);
    await screen.findByText("İade et");
    expect(screen.queryByText("PayTR durumunu sorgula")).toBeNull();
    fireEvent.click(screen.getByText("İade et"));
    expect(screen.queryByText("PayTR durumunu sorgula")).toBeNull();
  });

  it("iade hatasını gösterir ve pencereyi açık tutar", async () => {
    fetchPayments.mockResolvedValue(page([row()]));
    refund.mockRejectedValue(new Error("PayTR iadesi başarısız, kayıt değiştirilmedi: 009"));
    render(<PaymentsTab accessToken="t" />);
    fireEvent.click(await screen.findByText("İade et"));
    fireEvent.change(screen.getByLabelText(/İade nedeni/), { target: { value: "x" } });
    fireEvent.click(screen.getByText("İadeyi yap"));
    expect(await screen.findByText(/kayıt değiştirilmedi/)).toBeTruthy();
    expect(screen.getByText("İadeyi onayla")).toBeTruthy();
  });
});
