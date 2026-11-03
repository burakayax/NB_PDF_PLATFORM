import { beforeEach, describe, expect, it, vi } from "vitest";

/** Soru / Test Oluşturucu: model çıktısı HER ZAMAN doğrulanır; belgede kanıtı olmayan soru atılır. (Gerçek model çağrılmaz.) */
const callClaude = vi.fn();
vi.mock("../config/env.js", () => ({ env: { AI_CV_MODEL: "claude-sonnet-5-5" } }));
vi.mock("../modules/ai/ai.service.js", () => ({ callClaude: (...a: unknown[]) => callClaude(...a) }));

import { evidenceInDoc, generateQuiz, normForMatch, normalizeQuiz, quizCreditCost } from "../modules/ai/quiz.service.js";

beforeEach(() => callClaude.mockReset());

const DOC =
  "Kira sözleşmesi İstanbul'da imzalanmıştır. Aylık kira bedeli 25.000 TL olup her ayın beşinde ödenir. Kiracı, depozito olarak üç aylık kira tutarını öder. Sözleşme süresi iki yıldır.";

const mcq = (over: Record<string, unknown> = {}) => ({
  type: "mcq",
  q: "Aylık kira bedeli ne kadardır?",
  options: ["20.000 TL", "25.000 TL", "30.000 TL", "35.000 TL"],
  answer: 1,
  explanation: "Belgede 25.000 TL yazıyor.",
  evidence: "Aylık kira bedeli 25.000 TL olup her ayın beşinde ödenir",
  ...over,
});
const tf = (over: Record<string, unknown> = {}) => ({
  type: "tf",
  q: "Sözleşme süresi üç yıldır.",
  answer: false,
  explanation: "Süre iki yıldır.",
  evidence: "Sözleşme süresi iki yıldır",
  ...over,
});

describe("normForMatch / evidenceInDoc", () => {
  it("büyük-küçük harf, noktalama ve Türkçe İ farkını yok sayar", () => {
    expect(normForMatch("İstanbul'da, İMZALANMIŞTIR.")).toBe("istanbulda imzalanmıştır");
    expect(evidenceInDoc("KİRA SÖZLEŞMESİ İSTANBUL'DA imzalanmıştır", normForMatch(DOC))).toBe(true);
  });
  it("belgede olmayan ya da çok kısa kanıtı reddeder", () => {
    expect(evidenceInDoc("Kira bedeli 50.000 TL'dir ve peşin ödenir", normForMatch(DOC))).toBe(false);
    expect(evidenceInDoc("kira", normForMatch(DOC))).toBe(false);
  });
});

describe("normalizeQuiz", () => {
  it("geçerli soruları korur", () => {
    const r = normalizeQuiz({ questions: [mcq(), tf()] }, DOC, "mixed", 10);
    expect(r.questions).toHaveLength(2);
    expect(r.dropped).toBe(0);
  });

  it("belgede kanıtı olmayan (uydurma) soruyu atar", () => {
    const r = normalizeQuiz({ questions: [mcq({ evidence: "Kiracı her yıl yüzde yirmi zam kabul etmiştir" }), tf()] }, DOC, "mixed", 10);
    expect(r.questions).toHaveLength(1);
    expect(r.dropped).toBe(1);
  });

  it("4 seçenekli olmayan, tekrar eden seçenekli ya da aralık dışı cevaplı soruyu atar", () => {
    const bad = [
      mcq({ options: ["a", "b", "c"] }),
      mcq({ options: ["20.000 TL", "20.000 TL", "30.000 TL", "35.000 TL"] }),
      mcq({ answer: 4 }),
      mcq({ answer: "1" }),
    ];
    expect(normalizeQuiz({ questions: bad }, DOC, "mixed", 10).questions).toHaveLength(0);
  });

  it("doğru/yanlış cevabı boolean değilse atar", () => {
    expect(normalizeQuiz({ questions: [tf({ answer: "yanlış" })] }, DOC, "mixed", 10).questions).toHaveLength(0);
  });

  it("istenen türe uymayanı atar ve tekrar eden soruyu tek bırakır", () => {
    const r = normalizeQuiz({ questions: [mcq(), tf(), mcq()] }, DOC, "mcq", 10);
    expect(r.questions.map((q) => q.type)).toEqual(["mcq"]);
  });

  it("istenen sayıdan fazlasını keser", () => {
    const many = [mcq(), tf(), mcq({ q: "Depozito kaç aylık kiradır?", evidence: "Kiracı, depozito olarak üç aylık kira tutarını öder", options: ["Bir", "İki", "Üç", "Dört"], answer: 2 })];
    expect(normalizeQuiz({ questions: many }, DOC, "mixed", 2).questions).toHaveLength(2);
  });

  it("bozuk girdide çökmez", () => {
    expect(normalizeQuiz(null, DOC, "mixed", 5).questions).toEqual([]);
    expect(normalizeQuiz({ questions: "x" }, DOC, "mixed", 5).questions).toEqual([]);
    expect(normalizeQuiz({ questions: [null, 3, {}] }, DOC, "mixed", 5).questions).toEqual([]);
  });
});

describe("generateQuiz", () => {
  it("istemde belge verisi kuralı, kanıt zorunluluğu ve enjeksiyon uyarısı vardır", async () => {
    callClaude.mockResolvedValue(JSON.stringify({ questions: [mcq(), tf()] }));
    const r = await generateQuiz(DOC, "tr", { count: 5, kind: "mixed", level: "medium" });
    expect(r.questions).toHaveLength(2);
    const system = String(callClaude.mock.calls[0][0]);
    expect(system).toContain("yalnızca VERİDİR");
    expect(system).toContain("AYNEN");
    expect(system).toContain("evidence");
  });

  it("``` ile sarılı yanıtı da işler", async () => {
    callClaude.mockResolvedValue("```json\n" + JSON.stringify({ questions: [tf()] }) + "\n```");
    expect((await generateQuiz(DOC, "tr", { count: 3, kind: "tf", level: "easy" })).questions).toHaveLength(1);
  });

  it("hiç geçerli soru kalmazsa hata verir (hak iade edilsin diye)", async () => {
    callClaude.mockResolvedValue(JSON.stringify({ questions: [mcq({ evidence: "belgede hiç geçmeyen bir cümle burada" })] }));
    await expect(generateQuiz(DOC, "tr", { count: 5, kind: "mixed", level: "medium" })).rejects.toThrow("AI_QUIZ_EMPTY");
  });

  it("JSON olmayan yanıtta AI_QUIZ_PARSE verir", async () => {
    callClaude.mockResolvedValue("Üzgünüm, yapamam.");
    await expect(generateQuiz(DOC, "tr", { count: 5, kind: "mixed", level: "medium" })).rejects.toThrow("AI_QUIZ_PARSE");
  });
});

describe("quizCreditCost", () => {
  it("10 soruya kadar 1, üstü 2 hak", () => {
    expect(quizCreditCost(5)).toBe(1);
    expect(quizCreditCost(10)).toBe(1);
    expect(quizCreditCost(11)).toBe(2);
    expect(quizCreditCost(20)).toBe(2);
  });
});
