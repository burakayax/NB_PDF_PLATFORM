import { useMemo, useState } from "react";
import { Check, Copy, Download, Eye, Loader2, RefreshCw, X } from "lucide-react";
import type { QuizData, QuizKind, QuizLevel } from "../../api/ai";
import { answerLabel } from "../../lib/quizFormat";

const LETTERS = ["A", "B", "C", "D"];

/** Soru üretmeden önce: kaç soru, hangi tür, hangi zorluk. */
export function QuizOptions({
  tr,
  count,
  kind,
  level,
  cost,
  onCount,
  onKind,
  onLevel,
}: {
  tr: boolean;
  count: number;
  kind: QuizKind;
  level: QuizLevel;
  cost: number;
  onCount: (n: number) => void;
  onKind: (k: QuizKind) => void;
  onLevel: (l: QuizLevel) => void;
}) {
  const chip = (active: boolean) =>
    `rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition ${
      active ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
    }`;
  return (
    <div className="mb-4 space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">{tr ? "Soru sayısı" : "Number of questions"}</p>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15, 20].map((n) => (
            <button key={n} type="button" onClick={() => onCount(n)} className={chip(count === n)}>{n}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">{tr ? "Soru türü" : "Question type"}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onKind("mixed")} className={chip(kind === "mixed")}>{tr ? "Karışık" : "Mixed"}</button>
          <button type="button" onClick={() => onKind("mcq")} className={chip(kind === "mcq")}>{tr ? "Çoktan seçmeli" : "Multiple choice"}</button>
          <button type="button" onClick={() => onKind("tf")} className={chip(kind === "tf")}>{tr ? "Doğru / Yanlış" : "True / False"}</button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">{tr ? "Zorluk" : "Difficulty"}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onLevel("easy")} className={chip(level === "easy")}>{tr ? "Kolay" : "Easy"}</button>
          <button type="button" onClick={() => onLevel("medium")} className={chip(level === "medium")}>{tr ? "Orta" : "Medium"}</button>
          <button type="button" onClick={() => onLevel("hard")} className={chip(level === "hard")}>{tr ? "Zor" : "Hard"}</button>
        </div>
      </div>
      <p className="text-[12px] text-slate-400">
        {tr ? `Bu işlem ${cost} yapay zekâ hakkı harcar.` : `This uses ${cost} AI operation${cost > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}

/** Üretilen test: çözülebilir kartlar, anında doğru/yanlış, puan ve cevap anahtarı. */
export function QuizPanel({
  tr,
  quiz,
  busy,
  exporting,
  copied,
  onRegenerate,
  onPdf,
  onCopy,
}: {
  tr: boolean;
  quiz: QuizData;
  busy: boolean;
  exporting: boolean;
  copied: boolean;
  onRegenerate: () => void;
  onPdf: (withAnswers: boolean) => void;
  onCopy: () => void;
}) {
  // picks[i]: mcq → seçilen şık sırası, tf → true/false. Yoksa henüz cevaplanmadı.
  const [picks, setPicks] = useState<Record<number, number | boolean>>({});
  const [revealAll, setRevealAll] = useState(false);

  const stats = useMemo(() => {
    let answered = 0;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      const p = picks[i];
      if (p === undefined) return;
      answered++;
      if (p === q.answer) correct++;
    });
    return { answered, correct };
  }, [quiz, picks]);

  const total = quiz.questions.length;

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-6">
        <span className="text-[13px] font-semibold text-fuchsia-300">
          {tr ? `${total} soru` : `${total} questions`}
          <span className="ml-2 font-normal text-slate-400">
            {tr ? `Cevaplanan ${stats.answered}/${total} · Doğru ${stats.correct}` : `Answered ${stats.answered}/${total} · Correct ${stats.correct}`}
          </span>
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setRevealAll((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
            <Eye className="h-3.5 w-3.5" />
            <span>{revealAll ? (tr ? "Cevapları gizle" : "Hide answers") : tr ? "Cevapları göster" : "Show answers"}</span>
          </button>
          <button type="button" onClick={onCopy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? (tr ? "Kopyalandı" : "Copied") : tr ? "Kopyala" : "Copy"}</span>
          </button>
          <button type="button" onClick={() => onPdf(false)} disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span>{tr ? "Soru kâğıdı (PDF)" : "Question sheet (PDF)"}</span>
          </button>
          <button type="button" onClick={() => onPdf(true)} disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50">
            <Download className="h-3.5 w-3.5" />
            <span>{tr ? "Cevap anahtarlı (PDF)" : "With answer key (PDF)"}</span>
          </button>
          <button type="button" onClick={() => { setPicks({}); setRevealAll(false); onRegenerate(); }} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            <span>{tr ? "Yeniden" : "Regenerate"}</span>
          </button>
        </div>
      </div>

      <div className="max-h-[68vh] space-y-4 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
        {quiz.dropped > 0 && (
          <p className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-100/90">
            {tr
              ? `Belgede dayanağı bulunamayan ${quiz.dropped} soru güvenlik için elendi; kalanların hepsi belgeden alıntıyla doğrulandı.`
              : `${quiz.dropped} question(s) without support in the document were removed for safety; the rest are verified against quotes from the document.`}
          </p>
        )}
        {quiz.questions.map((q, i) => {
          const picked = picks[i];
          const done = picked !== undefined || revealAll;
          const optionList: { label: string; value: number | boolean }[] =
            q.type === "mcq"
              ? q.options.map((o, k) => ({ label: `${LETTERS[k]}) ${o}`, value: k }))
              : [
                  { label: tr ? "Doğru" : "True", value: true },
                  { label: tr ? "Yanlış" : "False", value: false },
                ];
          return (
            <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[14px] font-semibold leading-relaxed text-white">
                <span className="mr-1.5 text-fuchsia-300">{i + 1}.</span>
                {q.q}
              </p>
              <div className="mt-3 grid gap-2">
                {optionList.map((o) => {
                  const isAnswer = o.value === q.answer;
                  const isPicked = picked === o.value;
                  const tone = !done
                    ? "border-white/10 bg-white/[0.03] text-slate-200 hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
                    : isAnswer
                      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
                      : isPicked
                        ? "border-red-400/50 bg-red-500/10 text-red-100"
                        : "border-white/[0.06] bg-transparent text-slate-400";
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      disabled={picked !== undefined}
                      onClick={() => setPicks((p) => ({ ...p, [i]: o.value }))}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition ${tone}`}
                    >
                      <span className="min-w-0 flex-1 break-words">{o.label}</span>
                      {done && isAnswer ? <Check className="h-4 w-4 shrink-0 text-emerald-300" /> : null}
                      {done && isPicked && !isAnswer ? <X className="h-4 w-4 shrink-0 text-red-300" /> : null}
                    </button>
                  );
                })}
              </div>
              {done && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-[12.5px] leading-relaxed">
                  <p className="text-slate-200">
                    <span className="font-bold text-emerald-300">{tr ? "Doğru cevap: " : "Correct answer: "}</span>
                    {answerLabel(q, tr ? "tr" : "en")}
                  </p>
                  {q.explanation ? <p className="text-slate-300">{q.explanation}</p> : null}
                  <p className="text-slate-400">
                    <span className="font-semibold">{tr ? "Belgeden: " : "From the document: "}</span>
                    “{q.evidence}”
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
