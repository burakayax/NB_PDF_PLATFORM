import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { parseMath, splitMath, plainText, hasMath, allChars } from "../lib/mathText";
import { compileExpr, cleanGraphSpec, plotData } from "../lib/graphPlot";
import { quizToPdf } from "../lib/quizPdf";
import type { QuizQuestion } from "../api/ai";

describe("mathText", () => {
  it("üs, indis, kesir, kök ve sembolleri düz metne çevirir", () => {
    expect(plainText("$x^2$ ve $10^{-3}$")).toBe("x² ve 10⁻³");
    expect(plainText("$a_1 + a_{12}$")).toBe("a₁ + a₁₂");
    expect(plainText("$frac{3}{4}$")).toBe("3/4");
    expect(plainText("$frac{x+1}{2}$")).toBe("(x+1)/2");
    expect(plainText("$sqrt{16} = 4$")).toBe("√16 = 4");
    expect(plainText("$A cap B$")).toBe("A ∩ B");
    expect(plainText("$x in mathbb{R}$")).toBe("x ∈ ℝ");
    expect(plainText("$\\pi r^2$")).toBe("π r²");
    expect(plainText("$x <= 3$")).toBe("x ≤ 3");
  });

  it("eşi olmayan $ düz metin kalır, formül yoksa metin aynıdır", () => {
    expect(plainText("Fiyat 5$ oldu")).toBe("Fiyat 5$ oldu");
    expect(hasMath("Fiyat 5$ oldu")).toBe(false);
    expect(hasMath("a $x^2$ b")).toBe(true);
    expect(splitMath("a $x^2$ b").length).toBe(3);
  });

  it("bozuk girdide çökmez", () => {
    expect(() => parseMath("frac{1")).not.toThrow();
    expect(() => parseMath("^^__{{}}")).not.toThrow();
    expect(() => parseMath("sqrt")).not.toThrow();
  });

  it("sin/cos gibi sözcükler formülde olduğu gibi kalır", () => {
    expect(plainText("$sin x$")).toBe("sin x");
  });

  it("karakter taraması yedek yazı tipi ihtiyacını gösterir", () => {
    expect(allChars("$A cap B$").has("∩")).toBe(true);
    expect(allChars("düz metin").has("∩")).toBe(false);
  });
});

describe("graphPlot", () => {
  it("ifadeleri güvenle hesaplar", () => {
    expect(compileExpr("x^2-4")?.(3)).toBe(5);
    expect(compileExpr("2x+1")?.(3)).toBe(7);
    expect(compileExpr("-x^2")?.(3)).toBe(-9);
    expect(compileExpr("y = 3*(x-1)")?.(2)).toBe(3);
    expect(compileExpr("sqrt(x)")?.(9)).toBe(3);
    expect(compileExpr("2^x")?.(3)).toBe(8);
    expect(compileExpr("abs(x)")?.(-4)).toBe(4);
    expect(compileExpr("pi")?.(0)).toBeCloseTo(Math.PI);
  });

  it("kod çalıştırmaya çalışan ya da bozuk ifadeyi reddeder", () => {
    expect(compileExpr("process.exit(1)")).toBeNull();
    expect(compileExpr("alert(1)")).toBeNull();
    expect(compileExpr("x;y")).toBeNull();
    expect(compileExpr("x+")).toBeNull();
    expect(compileExpr("foo(x)")).toBeNull();
    expect(compileExpr("")).toBeNull();
  });

  it("tarifi doğrular", () => {
    expect(cleanGraphSpec({ fns: ["x^2"], xmin: -3, xmax: 3, ymin: -1, ymax: 9 })).not.toBeNull();
    expect(cleanGraphSpec({ fns: [], xmin: -3, xmax: 3, ymin: -1, ymax: 9 })).toBeNull();
    expect(cleanGraphSpec({ fns: ["x"], xmin: 3, xmax: -3, ymin: -1, ymax: 9 })).toBeNull();
    expect(cleanGraphSpec({ fns: ["x"], xmin: -1e9, xmax: 3, ymin: -1, ymax: 9 })).toBeNull();
  });

  it("eğriyi kutuya kırpar ve asimptotta keser", () => {
    const d = plotData({ fns: ["x^2"], xmin: -3, xmax: 3, ymin: -1, ymax: 4 });
    expect(d.curves[0].segs.length).toBeGreaterThan(50);
    for (const [, y0, , y1] of d.curves[0].segs) {
      expect(y0).toBeLessThanOrEqual(4.0001);
      expect(y1).toBeLessThanOrEqual(4.0001);
    }
    const t = plotData({ fns: ["tan(x)"], xmin: -4, xmax: 4, ymin: -5, ymax: 5 });
    expect(t.curves[0].segs.length).toBeGreaterThan(10);
  });
});

const mq: QuizQuestion[] = [
  { type: "mcq", q: "$f(x) = x^2 - 4$ fonksiyonunun kökleri aşağıdakilerden hangisidir?", options: ["$x = pm 2$", "$x = 4$", "$x = -4$", "$x = frac{1}{2}$"], answer: 0, explanation: "$x^2 = 4$ olduğundan $x = pm 2$ bulunur.", evidence: "f(x) = x^2 - 4 fonksiyonunun kökleri x = 2 ve x = -2", graph: { fns: ["x^2-4"], xmin: -4, xmax: 4, ymin: -5, ymax: 12 } },
  { type: "mcq", q: "$A cap B$ kümesi için $x in A$ ve $x in B$ ise $x$ hangi kümededir? ($x in mathbb{R}$)", options: ["$A cup B$", "$A cap B$", "$A subset B$", "$emptyset$"], answer: 1, explanation: "Kesişim.", evidence: "A kesişim B kümesi ortak elemanlardan oluşur" },
  { type: "fill", q: "$sqrt{49} + 3^2 =$ ____", answer: "16", explanation: "$7 + 9 = 16$", evidence: "karekök 49 artı 3 üssü 2 eşittir 16" },
  { type: "tf", q: "$frac{x+1}{2} + frac{x-1}{3}$ ifadesi $frac{5x+1}{6}$ ye eşittir.", answer: true, explanation: "Paydalar eşitlenir.", evidence: "paydalar eşitlenerek toplanır ve sonuç elde edilir" },
  { type: "open", q: "$2^{n+1} = 32$ denkleminde $n$ kaçtır? İşlemleri gösteriniz.", answer: "$2^{n+1} = 2^5$ olduğundan $n + 1 = 5$, yani $n = 4$.", explanation: "", evidence: "üslü denklemlerde tabanlar eşitlenerek üsler karşılaştırılır" },
];

describe("matematikli sınav PDF", () => {
  it("formül, grafik ve yedek yazı tipiyle PDF üretir", async () => {
    vi.stubGlobal("fetch", async (u: string) => ({ ok: true, arrayBuffer: async () => Uint8Array.from(readFileSync("public" + u)).buffer }));
    const base = { title: "Matematik Yazılı", subtitle: "5 soru", label: "MATEMATİK · 9. SINIF", showPoints: true, points: [30, 20, 15, 15, 20] };
    const sheet = await quizToPdf(mq, "tr", { ...base, withAnswers: false, studentInfo: true });
    const key = await quizToPdf(mq, "tr", { ...base, withAnswers: true });
    expect((await PDFDocument.load(sheet)).getPageCount()).toBeGreaterThanOrEqual(1);
    expect((await PDFDocument.load(key)).getPageCount()).toBeGreaterThan(1);
    const out = process.env.QUIZ_PDF_OUT;
    if (out) {
      writeFileSync(out + "mat-kagidi.pdf", sheet);
      writeFileSync(out + "mat-cevapli.pdf", key);
    }
  });
});
