import { describe, expect, it } from "vitest";
import { answerLabel, distributePoints, fillIsCorrect, normAnswer, quizToMarkdown } from "../lib/quizFormat";
import type { QuizQuestion } from "../api/ai";

const qs: QuizQuestion[] = [
  { type: "mcq", q: "Kira bedeli nedir?", options: ["20", "25", "30", "35"], answer: 1, explanation: "Belgede 25 yazıyor.", evidence: "x y z w" },
  { type: "tf", q: "Süre iki yıldır.", answer: true, explanation: "", evidence: "x y z w" },
  { type: "fill", q: "Süre ____ yıldır.", answer: "iki", explanation: "", evidence: "x y z w" },
  { type: "open", q: "Depozito nedir?", answer: "Üç aylık kira tutarıdır.", explanation: "", evidence: "x y z w" },
];

describe("quizFormat", () => {
  it("doğru cevap etiketini üretir", () => {
    expect(answerLabel(qs[0], "tr")).toBe("B) 25");
    expect(answerLabel(qs[1], "tr")).toBe("Doğru");
    expect(answerLabel({ ...qs[1], answer: false } as QuizQuestion, "en")).toBe("False");
    expect(answerLabel(qs[2], "tr")).toBe("iki");
    expect(answerLabel(qs[3], "tr")).toBe("Üç aylık kira tutarıdır.");
  });

  it("cevap anahtarı yalnızca istenince eklenir; soru kâğıdında cevap sızmaz", () => {
    const withKey = quizToMarkdown(qs, "tr", { title: "Test", withAnswers: true });
    const noKey = quizToMarkdown(qs, "tr", { title: "Test", withAnswers: false });
    expect(withKey).toContain("Cevap Anahtarı");
    expect(withKey).toContain("**1.** B) 25");
    expect(withKey).toContain("**3.** iki");
    expect(noKey).not.toContain("Cevap Anahtarı");
    expect(noKey).not.toContain("Üç aylık kira tutarıdır.");
  });

  it("sınav kâğıdı düzeni: şıklar madde işaretsiz, açık uçluya cevap çizgisi, doğru/yanlışa kutucuk", () => {
    const md = quizToMarkdown(qs, "tr", { title: "Test", withAnswers: false });
    expect(md).toContain("\nB) 25\n");
    expect(md).not.toMatch(/^- /m);
    expect(md).toContain("(   ) Doğru");
    expect(md).toContain("Cevap: ____");
    expect(md).toContain("Süre ____ yıldır.");
  });

  it("boşluk doldurma cevabı büyük/küçük harf ve noktalama farkını yok sayar", () => {
    expect(normAnswer("  İKİ. ")).toBe("iki");
    expect(fillIsCorrect("İki", "iki")).toBe(true);
    expect(fillIsCorrect("IŞIK", "ışık")).toBe(true);
    expect(fillIsCorrect("üç", "iki")).toBe(false);
    expect(fillIsCorrect("", "iki")).toBe(false);
  });

  it("puanı eşit paylaştırır, artanı ilk sorulara verir, toplam hep 100", () => {
    expect(distributePoints(10)).toEqual(Array(10).fill(10));
    const d = distributePoints(9);
    expect(d[0]).toBe(12);
    expect(d.slice(1).every((x) => x === 11)).toBe(true);
    for (const n of [1, 3, 7, 13, 20]) expect(distributePoints(n).reduce((a, b) => a + b, 0)).toBe(100);
    expect(distributePoints(0)).toEqual([]);
  });
});
