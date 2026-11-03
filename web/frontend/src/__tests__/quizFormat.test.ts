import { describe, expect, it } from "vitest";
import { answerLabel, quizToMarkdown } from "../lib/quizFormat";
import type { QuizQuestion } from "../api/ai";

const qs: QuizQuestion[] = [
  { type: "mcq", q: "Kira bedeli nedir?", options: ["20", "25", "30", "35"], answer: 1, explanation: "Belgede 25 yazıyor.", evidence: "x y z w" },
  { type: "tf", q: "Süre iki yıldır.", answer: true, explanation: "", evidence: "x y z w" },
];

describe("quizFormat", () => {
  it("doğru cevap etiketini üretir", () => {
    expect(answerLabel(qs[0], "tr")).toBe("B) 25");
    expect(answerLabel(qs[1], "tr")).toBe("Doğru");
    expect(answerLabel({ ...qs[1], answer: false } as QuizQuestion, "en")).toBe("False");
  });
  it("cevap anahtarı yalnızca istenince eklenir", () => {
    const withKey = quizToMarkdown(qs, "tr", { title: "Test", withAnswers: true });
    const noKey = quizToMarkdown(qs, "tr", { title: "Test", withAnswers: false });
    expect(withKey).toContain("Cevap Anahtarı");
    expect(withKey).toContain("**1.** B) 25");
    expect(noKey).not.toContain("Cevap Anahtarı");
    expect(noKey).toContain("- B) 25");
  });
});
