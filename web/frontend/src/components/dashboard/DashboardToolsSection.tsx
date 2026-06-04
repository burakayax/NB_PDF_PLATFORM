import type { FeatureKey } from "../../api/subscription";
import type { Language } from "../../i18n/landing";
import { useToolsData } from "./hooks/useToolsData";
import { ToolsDropdown } from "./ToolsDropdown";
import { ToolsGrid } from "./ToolsGrid";

interface DashboardToolsSectionProps {
  language: Language;
  lockedFeatures?: Set<FeatureKey>;
  enabledToolIds?: FeatureKey[];
  selectedTool?: FeatureKey | null;
  onSelectTool: (id: FeatureKey) => void;
}

/**
 * Mobile/tablet (< lg): dropdown selector only
 * Laptop/desktop (>= lg): card grid
 */
export function DashboardToolsSection({
  language,
  lockedFeatures,
  enabledToolIds,
  selectedTool,
  onSelectTool,
}: DashboardToolsSectionProps) {
  const allTools = useToolsData(language);
  const tools = enabledToolIds?.length
    ? allTools.filter((t) => enabledToolIds.includes(t.id))
    : allTools;
  const tr = language === "tr";

  return (
    <section aria-label={tr ? "PDF Araçları" : "PDF Tools"}>
      {/* Mobile (≤640px) — Dropdown only */}
      <div className="block sm:hidden">
        <ToolsDropdown
          tools={tools}
          selectedTool={selectedTool}
          language={language}
          lockedFeatures={lockedFeatures}
          onSelectTool={onSelectTool}
        />
      </div>

      {/* Tablet (641-1024px) — Dropdown with heading */}
      <div className="hidden sm:block lg:hidden">
        <h2 className="mb-3 text-sm font-semibold text-nb-heading">
          {tr ? "Araç Seç" : "Choose Tool"}
        </h2>
        <ToolsDropdown
          tools={tools}
          selectedTool={selectedTool}
          language={language}
          lockedFeatures={lockedFeatures}
          onSelectTool={onSelectTool}
        />
      </div>

      {/* Desktop (>1024px) — Full grid */}
      <div className="hidden lg:block">
        <ToolsGrid
          tools={tools}
          language={language}
          lockedFeatures={lockedFeatures}
          selectedTool={selectedTool}
          onSelectTool={onSelectTool}
        />
      </div>
    </section>
  );
}
