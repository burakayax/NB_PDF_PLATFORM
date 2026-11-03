import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuizPanel } from "../components/tools/QuizPanel";
import type { QuizData } from "../api/ai";

const quiz: QuizData = {
  requested: 2,
  dropped: 1,
  questions: [
    { type: "mcq", q: "Aylık kira bedeli ne kadardır?", options: ["20.000 TL", "25.000 TL", "30.000 TL", "35.000 TL"], answer: 1, explanation: "Belgede 25.000 TL yazıyor.", evidence: "Aylık kira bedeli 25.000 TL olup" },
    { type: "tf", q: "Sözleşme süresi üç yıldır.", answer: false, explanation: "Süre iki yıldır.", evidence: "Sözleşme süresi iki yıldır" },
  ],
};

const baseProps = { tr: true, quiz, busy: false, exporting: false, copied: false, onRegenerate: vi.fn(), onPdf: vi.fn(), onCopy: vi.fn() };

describe("QuizPanel", () => {
  it("cevaplamadan önce doğru cevabı göstermez", () => {
    render(<QuizPanel {...baseProps} />);
    expect(screen.queryByText(/Doğru cevap:/)).toBeNull();
    expect(screen.getByText(/Cevaplanan 0\/2/)).toBeTruthy();
  });

  it("doğru şıkkı seçince puan artar, açıklama ve belge alıntısı görünür", () => {
    render(<QuizPanel {...baseProps} />);
    fireEvent.click(screen.getByText("B) 25.000 TL"));
    expect(screen.getByText(/Cevaplanan 1\/2 · Doğru 1/)).toBeTruthy();
    expect(screen.getByText("Belgede 25.000 TL yazıyor.")).toBeTruthy();
    expect(screen.getByText(/Aylık kira bedeli 25.000 TL olup/)).toBeTruthy();
  });

  it("yanlış cevapta puan artmaz; doğru cevap yine gösterilir", () => {
    render(<QuizPanel {...baseProps} />);
    fireEvent.click(screen.getByText("Doğru")); // doğru cevap "Yanlış"
    expect(screen.getByText(/Cevaplanan 1\/2 · Doğru 0/)).toBeTruthy();
    expect(screen.getByText(/Doğru cevap:/).parentElement?.textContent).toContain("Yanlış");
  });

  it("bir soruya ikinci kez cevap verilemez", () => {
    render(<QuizPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /A\) 20\.000 TL/ }));
    fireEvent.click(screen.getByRole("button", { name: /B\) 25\.000 TL/ }));
    expect(screen.getByText(/Cevaplanan 1\/2 · Doğru 0/)).toBeTruthy();
  });

  it("«Cevapları göster» tüm cevapları açar, elenen soru uyarısı görünür", () => {
    render(<QuizPanel {...baseProps} />);
    expect(screen.getByText(/1 soru güvenlik için elendi/)).toBeTruthy();
    fireEvent.click(screen.getByText("Cevapları göster"));
    expect(screen.getAllByText(/Doğru cevap:/)).toHaveLength(2);
  });

  it("PDF düğmeleri doğru bayrakla çağrılır", () => {
    const onPdf = vi.fn();
    render(<QuizPanel {...baseProps} onPdf={onPdf} />);
    fireEvent.click(screen.getByText("Soru kâğıdı (PDF)"));
    fireEvent.click(screen.getByText("Cevap anahtarlı (PDF)"));
    expect(onPdf.mock.calls).toEqual([[false], [true]]);
  });
});
