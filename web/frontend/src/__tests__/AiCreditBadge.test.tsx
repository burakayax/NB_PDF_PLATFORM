import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiCreditBadge, creditBalance, monthlyLeft } from "../components/tools/AiCreditBadge";
import { AI_TOOL_COSTS, CONTRACT_AUDIT_CREDITS, estimateContractCredits } from "../lib/aiCredits";
import type { AiQuota } from "../api/ai";

const base: AiQuota = {
  used: 13,
  limit: 40,
  remaining: 27 + 60, // sunucu: aylık kalan + kredi
  monthlyRemaining: 27,
  bonus: 60,
  unlimited: false,
  resetAt: "2026-11-01T00:00:00Z",
};

describe("AiCreditBadge — iki cüzdan", () => {
  it("aylık hak ile krediyi AYRI gösterir (toplam değil)", () => {
    render(<AiCreditBadge quota={base} language="tr" onTopUp={vi.fn()} />);
    expect(screen.getByText("Aylık: 27/40")).toBeInTheDocument();
    expect(screen.getByText("Kredi: 60")).toBeInTheDocument();
  });

  it("eski sunucu yanıtında (monthlyRemaining yok) aylık kalanı limit-used'dan türetir", () => {
    const old = { ...base, monthlyRemaining: undefined };
    expect(monthlyLeft(old)).toBe(27);
    expect(creditBalance(old)).toBe(60);
  });

  it("YÖNETİCİ (sınırsız) hesapta yalnızca 'Sınırsız' gösterir; kredi/aylık/satın al yok", () => {
    const admin: AiQuota = { ...base, unlimited: true, limit: null, remaining: null, monthlyRemaining: null, bonus: 0 };
    render(<AiCreditBadge quota={admin} language="tr" onTopUp={vi.fn()} />);
    expect(screen.getByText("Sınırsız")).toBeInTheDocument();
    expect(screen.queryByText(/Aylık:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kredi:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+ Kredi/)).not.toBeInTheDocument();
  });

  it("'?' açıklaması: sıfırlanma tarihi, düşme kuralı ve araç bedelleri", () => {
    render(<AiCreditBadge quota={base} language="tr" onTopUp={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Aylık hak ve kredi nedir/ }));
    expect(screen.getByText(/Her ay başında yenilenir/)).toBeInTheDocument();
    expect(screen.getByText(/devretmez/)).toBeInTheDocument();
    expect(screen.getByText(/Süresi dolmaz/)).toBeInTheDocument();
    expect(screen.getByText(/aylık hakka dokunmaz, yalnızca krediden düşer/)).toBeInTheDocument();
    expect(screen.getByText(/iade edilir/)).toBeInTheDocument();
    // Her araç ve bedeli listelenir.
    for (const t of AI_TOOL_COSTS) expect(screen.getAllByText(t.tr, { exact: false }).length).toBeGreaterThan(0);
  });

  it("yönetici için açıklama 'sınır yoktur' der", () => {
    const admin: AiQuota = { ...base, unlimited: true, limit: null, remaining: null, monthlyRemaining: null };
    render(<AiCreditBadge quota={admin} language="tr" />);
    fireEvent.click(screen.getByRole("button", { name: /Aylık hak ve kredi nedir/ }));
    expect(screen.getByText(/Yönetici hesabında sınır yoktur/)).toBeInTheDocument();
  });
});

describe("sözleşme denetimi kredi tahmini", () => {
  it("belge uzadıkça artar, sınırlar içinde kalır", () => {
    expect(estimateContractCredits(0)).toBe(CONTRACT_AUDIT_CREDITS.minCredits);
    expect(estimateContractCredits(125_000)).toBeGreaterThan(estimateContractCredits(3_700));
    expect(estimateContractCredits(99_999_999)).toBe(CONTRACT_AUDIT_CREDITS.maxCredits);
  });
});
