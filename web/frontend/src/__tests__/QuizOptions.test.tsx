import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuizOptions } from "../components/tools/QuizPanel";
import type { QuizType } from "../api/ai";

function Harness() {
  const [types, setTypes] = useState<QuizType[]>(["mcq", "tf"]);
  return (
    <>
      <QuizOptions tr count={10} types={types} level="medium" cost={1} onCount={() => {}} onTypes={setTypes} onLevel={() => {}} />
      <output data-testid="t">{types.join(",")}</output>
    </>
  );
}

describe("QuizOptions", () => {
  it("türler birden çok seçilebilir", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Boşluk doldurma/ }));
    fireEvent.click(screen.getByRole("button", { name: /Açık uçlu/ }));
    expect(screen.getByTestId("t").textContent).toBe("mcq,tf,fill,open");
  });

  it("seçili türe tekrar basınca kapanır ama en az bir tür hep seçili kalır", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Doğru \/ Yanlış/ }));
    expect(screen.getByTestId("t").textContent).toBe("mcq");
    fireEvent.click(screen.getByRole("button", { name: /Çoktan seçmeli/ }));
    expect(screen.getByTestId("t").textContent).toBe("mcq");
  });
});
