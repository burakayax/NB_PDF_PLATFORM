import { useMemo, useState } from "react";
import { Check, Copy, Download, Eye, Loader2, RefreshCw, X } from "lucide-react";
import type { QuizData, QuizLevel, QuizType } from "../../api/ai";
import { answerLabel, distributePoints, fillIsCorrect } from "../../lib/quizFormat";

const LETTERS = ["A", "B", "C", "D"];

/** Soru üretmeden önce: kaç soru, hangi türler (birden çok seçilebilir), hangi zorluk. */
export function QuizOptions({
  tr,
  count,
  types,
  level,
  cost,
  examTitle,
  label,
  showPoints,
  onCount,
  onTypes,
  onLevel,
  onExamTitle,
  onLabel,
  onShowPoints,
}: {
  tr: boolean;
  count: number;
  types: QuizType[];
  level: QuizLevel;
  cost: number;
  examTitle?: string;
  label?: string;
  showPoints?: boolean;
  onCount: (n: number) => void;
  onTypes: (t: QuizType[]) => void;
  onLevel: (l: QuizLevel) => void;
  onExamTitle?: (s: string) => void;
  onLabel?: (s: string) => void;
  onShowPoints?: (v: boolean) => void;
}) {
  const chip = (active: boolean) =>
    `rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition ${
      active ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
    }`;
  const TYPE_LABELS: { id: QuizType; tr: string; en: string }[] = [
    { id: "mcq", tr: "Çoktan seçmeli", en: "Multiple choice" },
    { id: "tf", tr: "Doğru / Yanlış", en: "True / False" },
    { id: "fill", tr: "Boşluk doldurma", en: "Fill in the blank" },
    { id: "open", tr: "Açık uçlu", en: "Open-ended" },
  ];
  // En az bir tür her zaman seçili kalır.
  const toggle = (id: QuizType) => {
    if (types.includes(id)) {
      if (types.length > 1) onTypes(types.filter((t) => t !== id));
    } else {
      onTypes([...types, id]);
    }
  };
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
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">
          {tr ? "Soru türleri (birden çok seçebilirsiniz)" : "Question types (pick one or more)"}
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPE_LABELS.map((t) => (
            <button key={t.id} type="button" aria-pressed={types.includes(t.id)} onClick={() => toggle(t.id)} className={chip(types.includes(t.id))}>
              {types.includes(t.id) ? "✓ " : ""}{tr ? t.tr : t.en}
            </button>
          ))}
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
      {onExamTitle && onLabel && onShowPoints ? (
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">{tr ? "Sınav kâğıdı (PDF) görünümü" : "Exam sheet (PDF) look"}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={examTitle ?? ""}
              onChange={(e) => onExamTitle(e.target.value)}
              maxLength={80}
              placeholder={tr ? "Sınav başlığı (boşsa dosya adı)" : "Exam title (file name if empty)"}
              aria-label={tr ? "Sınav başlığı" : "Exam title"}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none"
            />
            <input
              value={label ?? ""}
              onChange={(e) => onLabel(e.target.value)}
              maxLength={40}
              placeholder={tr ? "Etiket, ör. MATEMATİK · 9. SINIF" : "Tag, e.g. MATHEMATICS · GRADE 9"}
              aria-label={tr ? "Ders ve sınıf etiketi" : "Subject and grade tag"}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none"
            />
          </div>
          <button type="button" aria-pressed={!!showPoints} onClick={() => onShowPoints(!showPoints)} className={`mt-2 ${chip(!!showPoints)}`}>
            {showPoints ? "✓ " : ""}{tr ? "Puan değerleri (100 puan üzerinden) + puanlama tablosu" : "Point values (out of 100) + scoring table"}
          </button>
        </div>
      ) : null}
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
  showPoints,
  onRegenerate,
  onPdf,
  onCopy,
}: {
  tr: boolean;
  quiz: QuizData;
  busy: boolean;
  exporting: boolean;
  copied: boolean;
  showPoints?: boolean;
  onRegenerate: () => void;
  onPdf: (withAnswers: boolean) => void;
  onCopy: () => void;
}) {
  // picks[i]: mcq → seçilen şık sırası, tf → true/false. Yoksa henüz cevaplanmadı.
  const [picks, setPicks] = useState<Record<number, number | boolean>>({});
  // typed[i]: boşluk doldurma / açık uçlu için yazılan metin; checked[i]: "Kontrol et" / "Cevabı göster" basıldı.
  const [typed, setTyped] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [revealAll, setRevealAll] = useState(false);

  const stats = useMemo(() => {
    let answered = 0;
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (q.type === "mcq" || q.type === "tf") {
        const p = picks[i];
        if (p === undefined) return;
        answered++;
        if (p === q.answer) correct++;
      } else if (checked[i]) {
        answered++;
        // Boşluk doldurma otomatik puanlanır; açık uçlu sorular puanlanmaz (kullanıcı kendi cevabını örnekle karşılaştırır).
        if (q.type === "fill" && fillIsCorrect(typed[i] ?? "", q.answer)) correct++;
      }
    });
    return { answered, correct };
  }, [quiz, picks, typed, checked]);

  const total = quiz.questions.length;
  const pts = showPoints ? distributePoints(total) : [];
  const TYPE_NAME: Record<string, { tr: string; en: string }> = {
    mcq: { tr: "Çoktan seçmeli", en: "Multiple choice" },
    tf: { tr: "Doğru / Yanlış", en: "True / False" },
    fill: { tr: "Boşluk doldurma", en: "Fill in the blank" },
    open: { tr: "Açık uçlu", en: "Open-ended" },
  };
  const hasOpen = quiz.questions.some((q) => q.type === "open");

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/15 disabled:opacity-70";
  const checkBtn =
    "mt-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-2 text-[13px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-40";

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
          <button type="button" onClick={onRegenerate} disabled={busy}
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
        {hasOpen && (
          <p className="text-[12px] text-slate-400">
            {tr ? "Açık uçlu sorular puanlanmaz: cevabınızı yazın, sonra örnek cevapla karşılaştırın." : "Open-ended questions are not scored: write your answer, then compare it with the model answer."}
          </p>
        )}
        {quiz.questions.map((q, i) => {
          const isChoice = q.type === "mcq" || q.type === "tf";
          const picked = picks[i];
          const done = isChoice ? picked !== undefined || revealAll : !!checked[i] || revealAll;
          const optionList: { label: string; value: number | boolean }[] =
            q.type === "mcq"
              ? q.options.map((o, k) => ({ label: `${LETTERS[k]}) ${o}`, value: k }))
              : [
                  { label: tr ? "Doğru" : "True", value: true },
                  { label: tr ? "Yanlış" : "False", value: false },
                ];
          const fillOk = q.type === "fill" && !!checked[i] && fillIsCorrect(typed[i] ?? "", q.answer);
          const fillBad = q.type === "fill" && !!checked[i] && !fillOk;
          return (
            <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-600 to-violet-600 text-[13px] font-bold text-white">{i + 1}</span>
                <p className="min-w-0 flex-1 pt-0.5 text-[14px] font-semibold leading-relaxed text-white">{q.q}</p>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-slate-300">{tr ? TYPE_NAME[q.type].tr : TYPE_NAME[q.type].en}</span>
                  {showPoints ? <span className="text-[11px] font-bold text-fuchsia-300">{pts[i]} {tr ? "puan" : "pts"}</span> : null}
                </span>
              </div>

              {isChoice && (
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
              )}

              {q.type === "fill" && (
                <div className="mt-3">
                  <input
                    value={typed[i] ?? ""}
                    onChange={(e) => setTyped((t) => ({ ...t, [i]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter" && (typed[i] ?? "").trim()) setChecked((c) => ({ ...c, [i]: true })); }}
                    disabled={!!checked[i]}
                    placeholder={tr ? "Boşluğa gelecek ifadeyi yazın" : "Type the missing word(s)"}
                    aria-label={tr ? `Soru ${i + 1} cevabı` : `Question ${i + 1} answer`}
                    className={`${inputCls} ${fillOk ? "!border-emerald-400/50" : fillBad ? "!border-red-400/50" : ""}`}
                  />
                  {!checked[i] && (
                    <button type="button" className={checkBtn} disabled={!(typed[i] ?? "").trim()} onClick={() => setChecked((c) => ({ ...c, [i]: true }))}>
                      {tr ? "Kontrol et" : "Check"}
                    </button>
                  )}
                  {checked[i] && (
                    <p className={`mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold ${fillOk ? "text-emerald-300" : "text-red-300"}`}>
                      {fillOk ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {fillOk ? (tr ? "Doğru" : "Correct") : tr ? "Yanlış" : "Incorrect"}
                    </p>
                  )}
                </div>
              )}

              {q.type === "open" && (
                <div className="mt-3">
                  <textarea
                    value={typed[i] ?? ""}
                    onChange={(e) => setTyped((t) => ({ ...t, [i]: e.target.value }))}
                    rows={3}
                    placeholder={tr ? "Cevabınızı buraya yazın" : "Write your answer here"}
                    aria-label={tr ? `Soru ${i + 1} cevabı` : `Question ${i + 1} answer`}
                    className={inputCls}
                  />
                  {!checked[i] && (
                    <button type="button" className={checkBtn} onClick={() => setChecked((c) => ({ ...c, [i]: true }))}>
                      {tr ? "Örnek cevabı göster" : "Show model answer"}
                    </button>
                  )}
                </div>
              )}

              {done && (
                <div className="mt-3 space-y-1.5 rounded-xl bg-white/[0.03] px-3.5 py-3 text-[12.5px] leading-relaxed">
                  <p className="text-slate-200">
                    <span className="font-bold text-emerald-300">{q.type === "open" ? (tr ? "Örnek cevap: " : "Model answer: ") : tr ? "Doğru cevap: " : "Correct answer: "}</span>
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
