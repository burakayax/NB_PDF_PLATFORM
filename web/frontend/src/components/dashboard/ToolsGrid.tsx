import type { FeatureKey } from "../../api/subscription";
import type { Language } from "../../i18n/landing";
import type { ToolItem } from "./hooks/useToolsData";
import { SidebarToolGlyph } from "./sidebarToolLucide";

interface ToolsGridProps {
  tools: ToolItem[];
  language: Language;
  lockedFeatures?: Set<FeatureKey>;
  selectedTool?: FeatureKey | null;
  onSelectTool: (id: FeatureKey) => void;
}

export function ToolsGrid({
  tools,
  language,
  lockedFeatures,
  selectedTool,
  onSelectTool,
}: ToolsGridProps) {
  const tr = language === "tr";

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-nb-heading sm:text-xl lg:text-2xl">
        {tr ? "Mevcut Araçlar" : "Available Tools"}
      </h2>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-4 2xl:grid-cols-6 2xl:gap-5">
        {tools.map((tool) => {
          const isActive = tool.id === selectedTool;
          const locked = lockedFeatures?.has(tool.id) ?? false;

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              aria-pressed={isActive}
              aria-label={tool.label}
              className={`nb-transition group flex flex-col items-center gap-2 rounded-2xl border p-3 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/45 lg:gap-3 lg:p-4 2xl:p-5 ${
                isActive
                  ? "border-nb-primary/50 bg-nb-primary/12 shadow-[0_0_28px_-8px_rgba(34,211,238,0.4)]"
                  : "border-white/[0.08] bg-nb-panel/60 hover:scale-[1.03] hover:border-nb-primary/35 hover:bg-nb-panel hover:shadow-lg"
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-xl p-2 transition-transform duration-200 group-hover:scale-110 lg:rounded-2xl lg:p-2.5 2xl:p-3 ${
                  isActive
                    ? "bg-nb-primary/20 text-nb-primary"
                    : locked
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-nb-bg-elevated/80 text-nb-muted group-hover:text-nb-primary"
                }`}
              >
                {locked ? (
                  <svg
                    className="h-5 w-5 lg:h-6 lg:w-6 2xl:h-7 2xl:w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                ) : (
                  <SidebarToolGlyph
                    id={tool.id}
                    className="h-5 w-5 lg:h-6 lg:w-6 2xl:h-7 2xl:w-7"
                    active={isActive}
                  />
                )}
              </span>

              <span className="flex min-w-0 w-full flex-col items-center gap-0.5">
                <span className="w-full truncate text-xs font-semibold leading-tight text-nb-text group-hover:text-nb-heading lg:text-[13px] 2xl:text-sm">
                  {tool.label}
                </span>
                {tool.description && (
                  <span className="hidden w-full truncate text-[10px] leading-tight text-nb-muted md:block lg:text-[11px]">
                    {tool.description}
                  </span>
                )}
              </span>

              {locked && (
                <span className="shrink-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300/95 lg:text-[10px]">
                  {tr ? "Kilit" : "Locked"}
                </span>
              )}
              {!locked && tool.isPro && (
                <span className="shrink-0 rounded-md border border-nb-primary/30 bg-nb-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-nb-primary-mid lg:text-[10px]">
                  Pro
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
