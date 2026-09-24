import type { ReactNode } from "react";
import type { Language } from "../../i18n/landing";
import { TOOLS } from "../../lib/toolCatalog";
import { ToolHowTo } from "./ToolHowTo";
import { ToolScore } from "./ToolScore";

/**
 * Kendi kabuğu olan araçların (imzala/işaretle/kırp/UDF/görsel sıkıştır-boyutlandır)
 * panel içi dış kabuğu — PDF Birleştir ve diğer jenerik araçların kullandığı
 * `workspace-card` kartı, başlık + puan + açıklama + "Nasıl çalışır?" ile BİREBİR
 * aynı. Bu araçlar eskiden çıplak bir `<section>` içinde açılıyordu; dashboardda
 * diğerlerinden görsel olarak kopuk duruyordu.
 */
export function WorkspaceToolShell({
  id,
  language,
  wide = false,
  children,
}: {
  /** TOOLS kataloğundaki araç id'si (ör. "pdf-imzala") — başlık/açıklama buradan okunur. */
  id: string;
  language: Language;
  /** PDF Kesit Al gibi geniş çalışma alanı gereken araçlar için. */
  wide?: boolean;
  children: ReactNode;
}) {
  const found = TOOLS.find((t) => t.id === id);
  const copy = found ? (language === "tr" ? found.tr : found.en) : null;

  return (
    <section className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-4xl"} py-2`}>
      <div className="workspace-card relative overflow-x-hidden">
        <div className="workspace-card__header">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-nb-text md:text-2xl">
              {copy?.name ?? ""}
            </h1>
            <ToolScore slug={id} language={language} className="mt-2.5" />
            {copy?.desc ? (
              <h2 className="mt-2 text-base font-normal leading-relaxed text-nb-muted md:text-lg">
                {copy.desc}
              </h2>
            ) : null}
          </div>
        </div>

        <ToolHowTo slug={id} language={language} className="mb-5" />

        {children}
      </div>
    </section>
  );
}
