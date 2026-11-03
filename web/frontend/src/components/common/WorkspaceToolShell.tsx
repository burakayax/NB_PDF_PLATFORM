import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
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
  full = false,
  deviceBadge = false,
  children,
}: {
  /** TOOLS kataloğundaki araç id'si (ör. "pdf-imzala") — başlık/açıklama buradan okunur. */
  id: string;
  language: Language;
  /** PDF Kesit Al gibi geniş çalışma alanı gereken araçlar için. */
  wide?: boolean;
  /** Genişlik sınırı yok — PDF Birleştir gibi jenerik araç kartıyla aynı genişlik. */
  full?: boolean;
  /** Başlığın yanında «Cihazında çalışır» rozeti (araç içindeki ayrı üst şerit yerine). */
  deviceBadge?: boolean;
  children: ReactNode;
}) {
  const found = TOOLS.find((t) => t.id === id);
  const copy = found ? (language === "tr" ? found.tr : found.en) : null;

  return (
    <section className={`mx-auto w-full ${full ? "" : wide ? "max-w-6xl" : "max-w-4xl"} py-2`}>
      <div className="workspace-card relative overflow-x-hidden">
        <div className="workspace-card__header">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-xl font-bold tracking-tight text-nb-text md:text-2xl">
                {copy?.name ?? ""}
              </h1>
              {deviceBadge ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-bold text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {language === "tr" ? "Cihazında çalışır" : "Runs on your device"}
                </span>
              ) : null}
            </div>
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
