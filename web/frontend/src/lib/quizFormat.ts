/**
 * Soru / test çıktısını düz markdown'a çevirir (PDF'e ve panoya kopyalamak için).
 * Saf fonksiyonlar — arayüzden bağımsız, test edilebilir.
 */
import type { QuizQuestion } from "../api/ai";

const LETTERS = ["A", "B", "C", "D"];

/** Bir sorunun doğru cevabının okunur hâli: "B) …" ya da "Doğru"/"Yanlış". */
export function answerLabel(q: QuizQuestion, lang: "tr" | "en"): string {
  if (q.type === "tf") return q.answer ? (lang === "tr" ? "Doğru" : "True") : lang === "tr" ? "Yanlış" : "False";
  return `${LETTERS[q.answer] ?? "?"}) ${q.options[q.answer] ?? ""}`;
}

export function quizToMarkdown(
  questions: QuizQuestion[],
  lang: "tr" | "en",
  opts: { title: string; withAnswers: boolean },
): string {
  const tr = lang === "tr";
  const out: string[] = [`# ${opts.title}`, ""];
  questions.forEach((q, i) => {
    out.push(`**${i + 1}. ${q.q}**`);
    if (q.type === "mcq") q.options.forEach((o, k) => out.push(`- ${LETTERS[k]}) ${o}`));
    else out.push(tr ? "- Doğru   - Yanlış" : "- True   - False");
    out.push("");
  });
  if (opts.withAnswers) {
    out.push("---", "", `## ${tr ? "Cevap Anahtarı" : "Answer Key"}`, "");
    questions.forEach((q, i) => {
      out.push(`**${i + 1}.** ${answerLabel(q, lang)}`);
      if (q.explanation) out.push(`- ${q.explanation}`);
    });
  }
  return out.join("\n");
}
