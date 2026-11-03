import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuizPanel, QuizOptions } from "../components/tools/QuizPanel";
import type { QuizData } from "../api/ai";

const quiz: QuizData = {
  requested: 2,
  dropped: 0,
  questions: [
    { type: "mcq", q: "$x^2 = 9$ denkleminin pozitif kökü nedir?", options: ["$1$", "$2$", "$3$", "$sqrt{2}$"], answer: 2, explanation: "$x = 3$", evidence: "x kare eşittir dokuz denkleminin pozitif kökü üçtür", graph: { fns: ["x^2-9"], xmin: -4, xmax: 4, ymin: -10, ymax: 8 } },
    { type: "tf", q: "Kesir: $frac{1}{2} + frac{1}{3} = frac{5}{6}$", answer: true, explanation: "", evidence: "bir bölü iki artı bir bölü üç eşittir beş bölü altı" },
  ],
};

const base = { tr: true, quiz, busy: false, exporting: false, copied: false, onRegenerate: vi.fn(), onPdf: vi.fn(), onCopy: vi.fn() };

describe("QuizPanel matematik + puan", () => {
  it("formülü üslü gösterir, grafiği çizer, kontrol uyarısını verir", () => {
    const { container } = render(<QuizPanel {...base} />);
    expect(container.querySelectorAll("sup").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Fonksiyon grafiği" })).toBeTruthy();
    expect(screen.getByText(/kullanmadan önce mutlaka kontrol edin/)).toBeTruthy();
    expect(container.textContent).not.toContain("$");
  });

  it("puanlar elle değiştirilebilir, toplam güncellenir, eşit dağıt 100'e döner", () => {
    const onPointsChange = vi.fn();
    render(<QuizPanel {...base} showPoints points={[60, 40]} onPointsChange={onPointsChange} />);
    const input = screen.getByLabelText("Soru 1 puanı") as HTMLInputElement;
    expect(input.value).toBe("60");
    fireEvent.change(input, { target: { value: "70" } });
    expect(onPointsChange).toHaveBeenCalledWith([70, 40]);
    fireEvent.click(screen.getByRole("button", { name: /Eşit dağıt/ }));
    expect(onPointsChange).toHaveBeenLastCalledWith([50, 50]);
  });

  it("puan açık değilken puan kutusu görünmez", () => {
    render(<QuizPanel {...base} />);
    expect(screen.queryByLabelText("Soru 1 puanı")).toBeNull();
  });
});

describe("QuizOptions tarih/başlık/etiket", () => {
  it("üç alanı da düzenlenebilir", () => {
    const onExamTitle = vi.fn();
    const onLabel = vi.fn();
    const onExamDate = vi.fn();
    render(
      <QuizOptions tr count={10} types={["mcq"]} level="medium" cost={1} onCount={vi.fn()} onTypes={vi.fn()} onLevel={vi.fn()}
        examTitle="" label="" examDate="" showPoints={false} onExamTitle={onExamTitle} onLabel={onLabel} onExamDate={onExamDate} onShowPoints={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Sınav başlığı"), { target: { value: "1. Yazılı" } });
    fireEvent.change(screen.getByLabelText("Ders ve sınıf etiketi"), { target: { value: "MATEMATİK · 9. SINIF" } });
    fireEvent.change(screen.getByLabelText("Sınav tarihi"), { target: { value: "2026-11-20" } });
    expect(onExamTitle).toHaveBeenCalledWith("1. Yazılı");
    expect(onLabel).toHaveBeenCalledWith("MATEMATİK · 9. SINIF");
    expect(onExamDate).toHaveBeenCalledWith("2026-11-20");
  });
});
