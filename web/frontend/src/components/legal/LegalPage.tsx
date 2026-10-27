import { legalDocuments } from "../../content/legal";
import type { Language } from "../../i18n/landing";

type LegalDocKey = "terms" | "privacy" | "kvkk" | "on-bilgilendirme" | "mesafeli-satis";

export type { LegalDocKey };

export type LegalDocumentBodyProps = {
  language: Language;
  documentKey: LegalDocKey;
  /** Tam sayfada başlık H1 olmalı (aranabilir sayfa); ödeme içindeki modalda H2 kalır. */
  titleAs?: "h1" | "h2";
};

type Block = { type: "p"; text: string } | { type: "table"; rows: string[][] };

/** "| a | b |" ile başlayan ardışık satırları tek bir tabloda toplar; diğerleri paragraf kalır. */
function toBlocks(paragraphs: string[]): Block[] {
  const blocks: Block[] = [];
  for (const p of paragraphs) {
    if (p.startsWith("|") && p.endsWith("|")) {
      const row = p
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last && last.type === "table") last.rows.push(row);
      else blocks.push({ type: "table", rows: [row] });
    } else {
      blocks.push({ type: "p", text: p });
    }
  }
  return blocks;
}

/** "Nerede işlenir" hücresine göre rozet rengi: cihaz = yeşil, sunucu = amber, yapay zekâ = mor. */
function whereBadgeClass(cell: string): string {
  const c = cell.toLowerCase();
  if (c.startsWith("tarayıcında") || c.startsWith("in your browser")) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }
  if (c.startsWith("metin") || c.startsWith("text")) {
    return "border-violet-400/30 bg-violet-500/10 text-violet-300";
  }
  return "border-amber-400/30 bg-amber-500/10 text-amber-300";
}

function LegalTable({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  if (!head) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-[13px]">
        <thead>
          <tr className="bg-white/[0.06]">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-nb-text">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={row[0]} className={`border-t border-white/[0.06] align-top ${i % 2 ? "bg-white/[0.02]" : ""}`}>
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2.5 ${j === 0 ? "font-semibold text-nb-text" : ""}`}>
                  {j === 1 ? (
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-snug ${whereBadgeClass(cell)}`}>
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shared body for full-page legal and in-payment nested modal. */
export function LegalDocumentBody({
  language,
  documentKey,
  titleAs = "h2",
}: LegalDocumentBodyProps) {
  const document = legalDocuments[language][documentKey];
  const Title = titleAs;

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-nb-accent sm:text-sm">
        PDF Platform
      </p>
      <Title className="mt-3 text-2xl font-semibold tracking-tight text-nb-text sm:text-3xl">
        {document.title}
      </Title>
      <p className="mt-3 text-sm leading-relaxed text-nb-muted sm:text-base">
        {document.summary}
      </p>

      <div className="mt-4 inline-flex rounded-xl border border-white/10 bg-nb-bg-soft/50 px-3 py-2 text-xs text-nb-muted sm:px-4 sm:py-3 sm:text-sm">
        <span className="font-semibold text-nb-text">
          {document.effectiveDateLabel}:
        </span>
        <span className="ml-2">{document.effectiveDate}</span>
      </div>

      <div className="mt-6 space-y-5 sm:mt-8 sm:space-y-6">
        {document.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-white/8 bg-nb-bg-soft/40 p-4 sm:rounded-[28px] sm:p-6"
          >
            <h3 className="text-lg font-semibold text-nb-text sm:text-xl">
              {section.title}
            </h3>
            <div className="mt-3 space-y-3 text-xs leading-relaxed text-nb-muted sm:text-sm sm:leading-7">
              {toBlocks(section.paragraphs).map((block, i) =>
                block.type === "table" ? (
                  <LegalTable key={`t${i}`} rows={block.rows} />
                ) : (
                  <p key={block.text}>{block.text}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

type LegalPageProps = {
  language: Language;
  documentKey: LegalDocKey;
  onBack: () => void;
};

export function LegalPage({ language, documentKey, onBack }: LegalPageProps) {
  return (
    <div className="min-h-dvh overflow-hidden bg-nb-bg font-sans text-nb-text antialiased">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(34,211,238,0.18),transparent_55%)]" />

      <main className="relative mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-nb-text shadow-sm transition duration-200 ease-out hover:border-nb-primary/30 hover:bg-white/[0.08]"
        >
          ← {language === "tr" ? "Geri dön" : "Back"}
        </button>

        <section className="mt-10 rounded-[28px] border border-white/[0.08] bg-nb-panel/50 p-8 shadow-[0_40px_90px_-24px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl sm:p-11">
          <LegalDocumentBody language={language} documentKey={documentKey} titleAs="h1" />
        </section>

        {/* Uzun metnin sonunda: kullanıcı yukarı kaydırmak zorunda kalmadan dönebilsin. */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-sm font-semibold text-nb-text shadow-sm transition duration-200 ease-out hover:border-nb-primary/30 hover:bg-white/[0.08]"
          >
            ← {language === "tr" ? "Geri dön" : "Back"}
          </button>
        </div>
      </main>
    </div>
  );
}
