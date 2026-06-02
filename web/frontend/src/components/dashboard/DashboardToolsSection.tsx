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
      {/* Mobile / Tablet — dropdown only, no heading */}
      <div className="block lg:hidden">
        <ToolsDropdown
          tools={tools}
          selectedTool={selectedTool}
          language={language}
          lockedFeatures={lockedFeatures}
          onSelectTool={onSelectTool}
        />
      </div>

      {/* Laptop / Desktop — grid */}
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
