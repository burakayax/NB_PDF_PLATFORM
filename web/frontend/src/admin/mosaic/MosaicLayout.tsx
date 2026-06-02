import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PanelLeft,
  Radio,
  Settings2,
  Tag,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type MosaicNavItem = { id: string; label: string; icon: LucideIcon };
export type MosaicNavGroup = { title: string; items: MosaicNavItem[] };

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  "cmd-tools": Wrench,
  "cmd-site": Building2,
  "cmd-mkt": Radio,
  "cmd-coupons": Ticket,
  "tool-registry": Wrench,
  "cc-site": PanelLeft,
  marketing: Mail,
  coupons: Ticket,
  packages: Package,
  TOOLS: Settings2,
  content: FileText,
  media: ImageIcon,
  settings: Settings2,
  analytics: BarChart3,
};

function iconFor(id: string): LucideIcon {
  return iconMap[id] ?? Activity;
}

type Props = {
  children: ReactNode;
  navGroups: MosaicNavGroup[];
  activeId: string;
  onNavigate: (id: string) => void;
  pageTitle: string;
  pageSubtitle?: string;
  userEmail: string;
  onExit: () => void;
  onLogout: () => void;
  simpleMode: boolean;
  onSimpleMode: (v: boolean) => void;
};

export function MosaicLayout({
  children,
  navGroups,
  activeId,
  onNavigate,
  pageTitle,
  pageSubtitle,
  userEmail,
  onExit,
  onLogout,
  simpleMode,
  onSimpleMode,
}: Props) {
  const [hover, setHover] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const closeUser = useCallback(() => setUserOpen(false), []);
  useEffect(() => {
    if (!userOpen) {
      return;
    }
    function handle(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [userOpen]);

  const sidebarW = hover ? "w-60" : "w-[72px]";
  const initials = userEmail
    .split("@")[0]
    ?.slice(0, 2)
    .toUpperCase() ?? "AD";

  return (
    <div className="fixed inset-0 z-[60] flex bg-slate-950 font-sans text-slate-100 antialiased">
      <aside
        className={`relative z-20 flex shrink-0 flex-col border-r border-slate-800/80 bg-slate-900 transition-[width] duration-200 ease-out ${sidebarW}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-800/80 px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-sm font-bold text-cyan-300 ring-1 ring-cyan-500/30">
            NB
          </div>
          <div className={`min-w-0 flex-1 overflow-hidden transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}>
            <p className="truncate text-xs font-semibold text-white">Admin</p>
            <p className="truncate text-[10px] text-slate-500">Mosaic</p>
          </div>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto py-3">
          {navGroups.map((g) => (
            <div key={g.title}>
              <p
                className={`px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}
              >
                {g.title}
              </p>
              <ul className="mt-1 space-y-0.5 px-2">
                {g.items.map((item) => {
                  const Ic = item.icon;
                  const act = activeId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        title={item.label}
                        className={`group flex w-full items-center gap-3 rounded-lg py-2.5 pl-2.5 pr-2 text-left transition ${
                          act
                            ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/25"
                            : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                        }`}
                      >
                        <Ic className={`h-[18px] w-[18px] shrink-0 ${act ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                        <span
                          className={`truncate text-sm font-medium transition-opacity ${hover ? "opacity-100" : "w-0 opacity-0"}`}
                        >
                          {item.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-900/50 px-4 backdrop-blur md:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-white md:text-xl">{pageTitle}</h1>
            {pageSubtitle ? <p className="mt-0.5 truncate text-sm text-slate-500">{pageSubtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              className="hidden rounded-lg border border-slate-600/50 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 sm:inline"
            >
              Uygulama
            </button>
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 py-1.5 pl-1.5 pr-2.5 text-left transition hover:border-slate-600"
                aria-expanded={userOpen}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-xs font-semibold text-cyan-200">
                  {initials}
                </span>
                <span className="hidden max-w-[140px] truncate text-sm text-slate-300 md:block">{userEmail}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
              {userOpen ? (
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-700/60 bg-slate-900 py-1 shadow-xl ring-1 ring-black/20">
                  <p className="px-3 py-2 text-xs text-slate-500">Oturum</p>
                  <button
                    type="button"
                    onClick={() => {
                      closeUser();
                      onLogout();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-300 hover:bg-slate-800"
                  >
                    <LogOut className="h-4 w-4" />
                    Çıkış
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-950/50">{children}</main>
      </div>
    </div>
  );
}

export function withNavIcon(groups: { title: string; items: { id: string; label: string }[] }[]): MosaicNavGroup[] {
  return groups.map((g) => ({
    title: g.title,
    items: g.items.map((i) => ({ ...i, icon: iconFor(i.id) })),
  }));
}
