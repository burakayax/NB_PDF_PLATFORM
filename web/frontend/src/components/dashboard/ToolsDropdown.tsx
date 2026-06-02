import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FeatureKey } from "../../api/subscription";
import type { Language } from "../../i18n/landing";
import type { ToolItem } from "./hooks/useToolsData";
import { SidebarToolGlyph } from "./sidebarToolLucide";

interface ToolsDropdownProps {
  tools: ToolItem[];
  selectedTool?: FeatureKey | null;
  language: Language;
  lockedFeatures?: Set<FeatureKey>;
  onSelectTool: (id: FeatureKey) => void;
}

export function ToolsDropdown({
  tools,
  selectedTool,
  language,
  lockedFeatures,
  onSelectTool,
}: ToolsDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIdx, setFocusIdx] = useState(-1);
  const tr = language === "tr";

  const selected = tools.find((t) => t.id === selectedTool);
  const placeholder = tr ? "PDF Aracı Seçin" : "Select a PDF Tool";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setFocusIdx(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, tools.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIdx >= 0) {
      e.preventDefault();
      const tool = tools[focusIdx];
      if (tool) {
        onSelectTool(tool.id);
        setOpen(false);
      }
    }
  };

  useEffect(() => {
    if (open && focusIdx >= 0 && listRef.current) {
      const item = listRef.current.children[focusIdx] as HTMLElement;
      item?.focus();
    }
  }, [focusIdx, open]);

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setFocusIdx(-1);
        }}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={tr ? "PDF aracı seçin" : "Select PDF tool"}
        className="nb-transition flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.1] bg-nb-panel/80 px-4 text-left text-sm font-medium text-nb-text shadow-sm hover:border-nb-primary/40 hover:bg-nb-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-primary/45"
      >
        <span className="flex min-w-0 items-center gap-3">
          {selected ? (
            <>
              <span className="shrink-0 text-nb-primary">
                <SidebarToolGlyph id={selected.id} className="h-4 w-4" active />
              </span>
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="text-nb-muted">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-nb-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={tr ? "PDF Araçları" : "PDF Tools"}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-2xl border border-white/[0.1] bg-nb-bg-elevated/98 py-1.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)_inset] backdrop-blur-md"
        >
          {tools.map((tool, idx) => {
            const isSelected = tool.id === selectedTool;
            const locked = lockedFeatures?.has(tool.id) ?? false;
            return (
              <li
                key={tool.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTool(tool.id);
                    setOpen(false);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setFocusIdx(Math.min(idx + 1, tools.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocusIdx(Math.max(idx - 1, 0));
                  }
                }}
                onClick={() => {
                  onSelectTool(tool.id);
                  setOpen(false);
                }}
                className={`nb-transition flex h-11 cursor-pointer items-center gap-3 px-4 text-sm focus:outline-none focus-visible:bg-nb-primary/10 ${
                  isSelected
                    ? "bg-nb-primary/15 text-nb-accent"
                    : "text-nb-text hover:bg-white/[0.06]"
                }`}
              >
                <span className={isSelected ? "text-nb-primary" : "text-nb-muted"}>
                  <SidebarToolGlyph id={tool.id} className="h-4 w-4" active={isSelected} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{tool.label}</span>
                {locked && (
                  <span className="shrink-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/95">
                    {tr ? "Kilit" : "Pro"}
                  </span>
                )}
                {!locked && tool.isPro && !isSelected && (
                  <span className="shrink-0 rounded-md border border-nb-primary/30 bg-nb-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nb-primary-mid">
                    Pro
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
