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

  it("aylık hak ve kredinin ayrı ayrı '?' açıklaması var; her biri yalnız kendi konusunu anlatır", () => {
    render(<AiCreditBadge quota={base} language="tr" onTopUp={vi.fn()} />);
    // Aylık hak açıklaması: yenilenme + devretmez; kredi anlatımı yok.
    fireEvent.click(screen.getByRole("button", { name: /Aylık hak nedir/ }));
    expect(screen.getByText(/Her ay başında yenilenir/)).toBeInTheDocument();
    expect(screen.getByText(/devretmez/)).toBeInTheDocument();
    expect(screen.queryByText(/Süresi dolmaz/)).not.toBeInTheDocument();
    // Kredi açıklaması: süresi dolmaz + yalnız krediyle çalışan araç + iade; araç bedelleri.
    fireEvent.click(screen.getByRole("button", { name: /Kredi nedir/ }));
    expect(screen.getByText(/Süresi dolmaz/)).toBeInTheDocument();
    expect(screen.getByText(/aylık hakka dokunmaz, yalnızca krediden düşer/)).toBeInTheDocument();
    expect(screen.getAllByText(/iade edilir/).length).toBeGreaterThan(0);
    for (const t of AI_TOOL_COSTS) expect(screen.getAllByText(t.tr, { exact: false }).length).toBeGreaterThan(0);
  });

  it("açıklama kutusu uzun olduğunda kaydırılabilir", () => {
    render(<AiCreditBadge quota={base} language="tr" />);
    fireEvent.click(screen.getByRole("button", { name: /Kredi nedir/ }));
    expect(screen.getByRole("dialog").className).toMatch(/overflow-y-auto/);
  });

  it("aylık hakkı olmayan (limit 0) kullanıcıda yalnız kredi gösterilir: Kredi: 0", () => {
    render(<AiCreditBadge quota={{ ...base, limit: 0, used: 0, remaining: 0, monthlyRemaining: 0, bonus: 0 }} language="tr" />);
    expect(screen.queryByText(/Aylık:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Kredi: 0/)).toBeInTheDocument();
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
