import { beforeEach, describe, expect, it, vi } from "vitest";

/** Soru / Test Oluşturucu: model çıktısı HER ZAMAN doğrulanır; belgede kanıtı olmayan soru atılır. (Gerçek model çağrılmaz.) */
const callClaude = vi.fn();
vi.mock("../config/env.js", () => ({ env: { AI_CV_MODEL: "claude-sonnet-5-5" } }));
vi.mock("../modules/ai/ai.service.js", () => ({ callClaude: (...a: unknown[]) => callClaude(...a) }));

import { cleanGraph, evidenceInDoc, generateQuiz, normForMatch, normalizeQuiz, parseQuizTypes, quizCreditCost, balanceByType } from "../modules/ai/quiz.service.js";

const MIX = ["mcq", "tf"] as const;
const ALL = ["mcq", "tf", "open", "fill"] as const;

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
    const r = normalizeQuiz({ questions: [mcq(), tf()] }, DOC, MIX, 10);
    expect(r.questions).toHaveLength(2);
    expect(r.dropped).toBe(0);
  });

  it("belgede kanıtı olmayan (uydurma) soruyu atar", () => {
    const r = normalizeQuiz({ questions: [mcq({ evidence: "Kiracı her yıl yüzde yirmi zam kabul etmiştir" }), tf()] }, DOC, MIX, 10);
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
    expect(normalizeQuiz({ questions: bad }, DOC, MIX, 10).questions).toHaveLength(0);
  });

  it("doğru/yanlış cevabı boolean değilse atar", () => {
    expect(normalizeQuiz({ questions: [tf({ answer: "yanlış" })] }, DOC, MIX, 10).questions).toHaveLength(0);
  });

  it("istenen türe uymayanı atar ve tekrar eden soruyu tek bırakır", () => {
    const r = normalizeQuiz({ questions: [mcq(), tf(), mcq()] }, DOC, ["mcq"], 10);
    expect(r.questions.map((q) => q.type)).toEqual(["mcq"]);
  });

  it("istenen sayıdan fazlasını keser", () => {
    const many = [mcq(), tf(), mcq({ q: "Depozito kaç aylık kiradır?", evidence: "Kiracı, depozito olarak üç aylık kira tutarını öder", options: ["Bir", "İki", "Üç", "Dört"], answer: 2 })];
    expect(normalizeQuiz({ questions: many }, DOC, MIX, 2).questions).toHaveLength(2);
  });

  it("bozuk girdide çökmez", () => {
    expect(normalizeQuiz(null, DOC, MIX, 5).questions).toEqual([]);
    expect(normalizeQuiz({ questions: "x" }, DOC, MIX, 5).questions).toEqual([]);
    expect(normalizeQuiz({ questions: [null, 3, {}] }, DOC, MIX, 5).questions).toEqual([]);
  });
});

describe("generateQuiz", () => {
  it("istemde belge verisi kuralı, kanıt zorunluluğu ve enjeksiyon uyarısı vardır", async () => {
    callClaude.mockResolvedValue(JSON.stringify({ questions: [mcq(), tf()] }));
    const r = await generateQuiz(DOC, "tr", { count: 5, types: MIX, level: "medium" });
    expect(r.questions).toHaveLength(2);
    const system = String(callClaude.mock.calls[0][0]);
    expect(system).toContain("yalnızca VERİDİR");
    expect(system).toContain("AYNEN");
    expect(system).toContain("evidence");
  });

  it("``` ile sarılı yanıtı da işler", async () => {
    callClaude.mockResolvedValue("```json\n" + JSON.stringify({ questions: [tf()] }) + "\n```");
    expect((await generateQuiz(DOC, "tr", { count: 3, types: ["tf"], level: "easy" })).questions).toHaveLength(1);
  });

  it("hiç geçerli soru kalmazsa hata verir (hak iade edilsin diye)", async () => {
    callClaude.mockResolvedValue(JSON.stringify({ questions: [mcq({ evidence: "belgede hiç geçmeyen bir cümle burada" })] }));
    await expect(generateQuiz(DOC, "tr", { count: 5, types: MIX, level: "medium" })).rejects.toThrow("AI_QUIZ_EMPTY");
  });

  it("JSON olmayan yanıtta AI_QUIZ_PARSE verir", async () => {
    callClaude.mockResolvedValue("Üzgünüm, yapamam.");
    await expect(generateQuiz(DOC, "tr", { count: 5, types: MIX, level: "medium" })).rejects.toThrow("AI_QUIZ_PARSE");
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

const open = (over: Record<string, unknown> = {}) => ({
  type: "open",
  q: "Depozito ne kadardır ve neye göre belirlenmiştir?",
  answer: "Depozito, üç aylık kira tutarıdır.",
  explanation: "Belgede depozitonun üç aylık kira olduğu yazıyor.",
  evidence: "Kiracı, depozito olarak üç aylık kira tutarını öder",
  ...over,
});
const fill = (over: Record<string, unknown> = {}) => ({
  type: "fill",
  q: "Sözleşme süresi ____ yıldır.",
  answer: "iki",
  explanation: "Belgede süre iki yıl olarak geçiyor.",
  evidence: "Sözleşme süresi iki yıldır",
  ...over,
});

describe("açık uçlu ve boşluk doldurma", () => {
  it("geçerli açık uçlu ve boşluk doldurma sorularını korur", () => {
    const r = normalizeQuiz({ questions: [open(), fill()] }, DOC, ALL, 10);
    expect(r.questions.map((q) => q.type)).toEqual(["open", "fill"]);
  });

  it("seçilmeyen türü atar", () => {
    const r = normalizeQuiz({ questions: [open(), fill(), mcq()] }, DOC, ["fill"], 10);
    expect(r.questions.map((q) => q.type)).toEqual(["fill"]);
    expect(r.dropped).toBe(2);
  });

  it("açık uçlu: boş/çok kısa örnek cevabı ve belgede kanıtı olmayanı atar", () => {
    expect(normalizeQuiz({ questions: [open({ answer: "" })] }, DOC, ALL, 10).questions).toHaveLength(0);
    expect(normalizeQuiz({ questions: [open({ evidence: "Kiracı her yıl yüzde yirmi zam kabul etmiştir" })] }, DOC, ALL, 10).questions).toHaveLength(0);
  });

  it("boşluk doldurma: boşluksuz ya da birden çok boşluklu cümleyi atar", () => {
    expect(normalizeQuiz({ questions: [fill({ q: "Sözleşme süresi iki yıldır." })] }, DOC, ALL, 10).questions).toHaveLength(0);
    expect(normalizeQuiz({ questions: [fill({ q: "Sözleşme ____ ____ yıldır." })] }, DOC, ALL, 10).questions).toHaveLength(0);
  });

  it("boşluk doldurma: cevap kanıt cümlesinde geçmiyorsa ya da çok uzunsa atar", () => {
    expect(normalizeQuiz({ questions: [fill({ answer: "üç" })] }, DOC, ALL, 10).questions).toHaveLength(0);
    expect(normalizeQuiz({ questions: [fill({ answer: "iki yıldır ve her ayın beşinde ödenir kira" })] }, DOC, ALL, 10).questions).toHaveLength(0);
  });

  it("boşluğu tek biçime ('____') getirir", () => {
    const r = normalizeQuiz({ questions: [fill({ q: "Sözleşme süresi ________ yıldır." })] }, DOC, ALL, 10);
    expect(r.questions[0]?.q).toBe("Sözleşme süresi ____ yıldır.");
  });

  it("istem, seçilen türleri ve boşluk/kanıt kurallarını içerir", async () => {
    callClaude.mockResolvedValue(JSON.stringify({ questions: [open(), fill()] }));
    const r = await generateQuiz(DOC, "tr", { count: 4, types: ["open", "fill"], level: "medium" });
    expect(r.questions).toHaveLength(2);
    const system = String(callClaude.mock.calls[0][0]);
    expect(system).toContain("açık uçlu");
    expect(system).toContain("boşluk doldurma");
    expect(system).toContain("TAM BİR boşluk");
  });
});

describe("parseQuizTypes", () => {
  it("geçersizleri ayıklar, tekrarı kaldırır, boşsa varsayılanı verir", () => {
    expect(parseQuizTypes(["fill", "xx", "fill", "mcq"])).toEqual(["mcq", "fill"]);
    expect(parseQuizTypes([])).toEqual(["mcq", "tf"]);
    expect(parseQuizTypes(undefined)).toEqual(["mcq", "tf"]);
    expect(parseQuizTypes("mcq")).toEqual(["mcq", "tf"]);
  });
});

describe("balanceByType", () => {
  it("fazla sorular kesilirken sonda gelen türü (boşluk doldurma) silmez", () => {
    const m1 = mcq();
    const m2 = mcq({ q: "Depozito kaç aylık kiradır?", evidence: "Kiracı, depozito olarak üç aylık kira tutarını öder", options: ["Bir", "İki", "Üç", "Dört"], answer: 2 });
    const t1 = tf();
    const o1 = open();
    const f1 = fill();
    const r = normalizeQuiz({ questions: [m1, m2, t1, o1, f1] }, DOC, ALL, 4);
    expect(r.questions.map((q) => q.type).sort()).toEqual(["fill", "mcq", "open", "tf"]);
  });

  it("sıra korunur ve sayı tutar", () => {
    const m1 = mcq();
    const t1 = tf();
    const f1 = fill();
    const r = normalizeQuiz({ questions: [m1, t1, f1] }, DOC, ALL, 2);
    expect(r.questions).toHaveLength(2);
    expect(r.questions.map((q) => q.type)).toEqual(["mcq", "tf"]);
  });

  it("az soru varsa hepsini döndürür", () => {
    const r = normalizeQuiz({ questions: [mcq()] }, DOC, ALL, 10);
    expect(r.questions).toHaveLength(1);
  });
});

describe("matematik grafiği", () => {
  it("geçerli tarifi korur, tehlikeli/bozuk olanı eler", () => {
    expect(cleanGraph({ fns: ["x^2-4"], xmin: -4, xmax: 4, ymin: -5, ymax: 12 })).toEqual({ fns: ["x^2-4"], xmin: -4, xmax: 4, ymin: -5, ymax: 12 });
    expect(cleanGraph({ fns: ["process.exit(1);"], xmin: -4, xmax: 4, ymin: -5, ymax: 12 })).toBeNull();
    expect(cleanGraph({ fns: ["x"], xmin: 4, xmax: -4, ymin: -5, ymax: 12 })).toBeNull();
    expect(cleanGraph({ fns: ["x"], xmin: -99999, xmax: 4, ymin: -5, ymax: 12 })).toBeNull();
    expect(cleanGraph({ fns: ["x", "2x", "x^2", "x^3"], xmin: -1, xmax: 1, ymin: -1, ymax: 1 })?.fns).toHaveLength(3);
    expect(cleanGraph(undefined)).toBeNull();
  });

  it("sorulara grafik eklenir; geçersiz grafik soruyu düşürmez, sadece grafiği atar", () => {
    const withG = { ...mcq(), graph: { fns: ["x^2"], xmin: -2, xmax: 2, ymin: -1, ymax: 5 } };
    const bad = { ...mcq({ q: "Başka bir soru nedir ve ne kadardır?" }), graph: { fns: ["x; drop"], xmin: -2, xmax: 2, ymin: -1, ymax: 5 } };
    const r = normalizeQuiz({ questions: [withG, bad] }, DOC, ALL, 10);
    expect(r.questions[0]).toHaveProperty("graph");
    expect(r.questions[1]).not.toHaveProperty("graph");
  });
});
