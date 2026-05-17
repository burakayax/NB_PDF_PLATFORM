import { legalDocuments } from "../../content/legal";
import type { Language } from "../../i18n/landing";

type LegalDocKey = "terms" | "privacy" | "kvkk" | "on-bilgilendirme" | "mesafeli-satis";

export type { LegalDocKey };

export type LegalDocumentBodyProps = {
  language: Language;
  documentKey: LegalDocKey;
};

/** Shared body for full-page legal and in-payment nested modal. */
export function LegalDocumentBody({
  language,
  documentKey,
}: LegalDocumentBodyProps) {
  const document = legalDocuments[language][documentKey];

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-nb-accent sm:text-sm">
        PDF PLATFORM
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-nb-text sm:text-3xl">
        {document.title}
      </h2>
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
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
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
    <div className="min-h-screen overflow-hidden bg-nb-bg font-sans text-nb-text antialiased">
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
          <LegalDocumentBody language={language} documentKey={documentKey} />
        </section>
      </main>
    </div>
  );
}
