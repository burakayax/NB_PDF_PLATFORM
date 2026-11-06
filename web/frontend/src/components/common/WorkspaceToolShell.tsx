import type { ReactNode } from "react";
import { RunsWhereBadge } from "./RunsWhereBadge";
import { isOnDeviceTool } from "../../lib/onDeviceTools";
import { toolVisual } from "./ToolUploadPanel";
import type { Language } from "../../i18n/landing";
import { TOOLS } from "../../lib/toolCatalog";
import { ToolHowTo } from "./ToolHowTo";
import { ToolScore } from "./ToolScore";

/**
 * Çalışma alanındaki TÜM araçların ortak başlığı: araç amblemi + ad + «nerede çalışır» rozeti.
 * (Eskiden rozet, yükleme alanının kendi üst şeridindeydi; adı ve açıklamayı ikinci kez söylüyordu.)
 */
export function ToolHeadline({ id, title, language }: { id: string; title: string; language: Language }) {
  const tr = language === "tr";
  const { Icon, tile, icon } = toolVisual(id);
  const onDevice = isOnDeviceTool(id);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tile} ${icon}`}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <h1 className="text-xl font-bold tracking-tight text-nb-text md:text-2xl">{title}</h1>
      <RunsWhereBadge onDevice={onDevice} language={language} />
    </div>
  );
}

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
  children,
}: {
  /** TOOLS kataloğundaki araç id'si (ör. "pdf-imzala") — başlık/açıklama buradan okunur. */
  id: string;
  language: Language;
  /** PDF Kesit Al gibi geniş çalışma alanı gereken araçlar için. */
  wide?: boolean;
  /** Genişlik sınırı yok — PDF Birleştir gibi jenerik araç kartıyla aynı genişlik. */
  full?: boolean;
  children: ReactNode;
}) {
  const found = TOOLS.find((t) => t.id === id);
  const copy = found ? (language === "tr" ? found.tr : found.en) : null;

  return (
    <section className={`mx-auto w-full ${wide && !full ? "max-w-6xl" : ""} py-2`}>
      <div className="workspace-card relative overflow-x-hidden">
        <div className="workspace-card__header">
          <div>
            <ToolHeadline id={id} title={copy?.name ?? ""} language={language} />
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
