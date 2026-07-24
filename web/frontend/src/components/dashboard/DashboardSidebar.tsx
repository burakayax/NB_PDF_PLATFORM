import { useEffect, useMemo, useState } from "react";
import { Crop, ImageDown } from "lucide-react";
import type { FeatureKey } from "../../api/subscription";
import type { UserBalance } from "../../api/entitlement";
import type { Language } from "../../i18n/landing";
import {
  SIDEBAR_TOOL_ORDER,
  groupToolsByCategory,
  sidebarToolLabel,
  toolCategoryLabel,
  ws,
  type ToolCategoryId,
} from "../../i18n/workspace";
import { SidebarToolGlyph } from "./sidebarToolLucide";
import { useFavoriteTools } from "../../hooks/useFavoriteTools";

/** Araç satırının sağındaki favori (yıldız) düğmesi. Buton-içinde-buton olmaması için span. */
export function FavoriteStar({
  active,
  label,
  onToggle,
  alwaysVisible = false,
}: {
  active: boolean;
  label: string;
  onToggle: () => void;
  /** Mobilde hover olmadığı için yıldız her zaman görünür olmalı. */
  alwaysVisible?: boolean;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={active ? `${label} favorilerden çıkar` : `${label} favorilere ekle`}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
      className={`nb-transition flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
        active
          ? "text-amber-300 hover:text-amber-200"
          : alwaysVisible
            ? "text-slate-400/80 hover:text-amber-300"
            : "text-nb-muted/50 opacity-0 hover:text-amber-300 group-hover:opacity-100"
      }`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.06 4.18 4.61.67c.46.07.64.63.31.95l-3.34 3.25.79 4.59c.08.45-.4.8-.81.59L12 16.35l-4.13 2.17c-.41.21-.89-.14-.81-.59l.79-4.59-3.34-3.25c-.33-.32-.15-.88.31-.95l4.61-.67L11.48 3.5z" />
      </svg>
    </span>
  );
}

/** Kategori başına vurgu paleti — mobil araç gezgini bölüm başlıklarında kullanılır. */
const CATEGORY_ACCENT: Record<
  ToolCategoryId | "other" | "favorites" | "ai",
  { dot: string; text: string; ring: string; glow: string }
> = {
  ai: {
    dot: "bg-fuchsia-400",
    text: "text-fuchsia-300",
    ring: "ring-fuchsia-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(232,121,249,0.6)]",
  },
  favorites: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(251,191,36,0.55)]",
  },
  organize: {
    dot: "bg-sky-400",
    text: "text-sky-300",
    ring: "ring-sky-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(56,189,248,0.55)]",
  },
  convert: {
    dot: "bg-violet-400",
    text: "text-violet-300",
    ring: "ring-violet-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(167,139,250,0.55)]",
  },
  optimize: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    ring: "ring-emerald-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(52,211,153,0.55)]",
  },
  annotate: {
    dot: "bg-amber-400",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(251,191,36,0.55)]",
  },
  secure: {
    dot: "bg-rose-400",
    text: "text-rose-300",
    ring: "ring-rose-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(251,113,133,0.55)]",
  },
  other: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    ring: "ring-slate-400/30",
    glow: "shadow-[0_0_18px_-6px_rgba(148,163,184,0.5)]",
  },
};

/** AI araç modları — FeatureKey DEĞİL; kendi modal'ını açar (onOpenAi). */
export type AiToolMode = "summarize" | "chat" | "extract" | "translate" | "batch" | "compare" | "redact";
const AI_TOOLS: { mode: AiToolMode; tr: string; en: string }[] = [
  { mode: "summarize", tr: "PDF Özetle", en: "Summarize PDF" },
  { mode: "chat", tr: "PDF ile Sohbet", en: "Chat with PDF" },
  { mode: "extract", tr: "PDF Veri Çıkar", en: "Extract Data" },
  { mode: "translate", tr: "PDF Çevir", en: "Translate PDF" },
  { mode: "compare", tr: "PDF Karşılaştır", en: "Compare PDFs" },
  { mode: "redact", tr: "Hassas Veri Gizle", en: "Redact Data" },
  { mode: "batch", tr: "AI Toplu İşlem", en: "AI Batch" },
];

/** PDF Düzenle (cihazda editör) favorilerde bu sabit id ile tutulur — FeatureKey değil. */
const EDITOR_FAV_ID = "edit-pdf";
/** PDF İmzala (cihazda imza) favorilerde bu sabit id ile tutulur — FeatureKey değil. */
const SIGN_FAV_ID = "sign-pdf";
/** PDF Yorumla (cihazda işaretleme) favorilerde bu sabit id ile tutulur — FeatureKey değil. */
const ANNOTATE_FAV_ID = "annotate-pdf";

export type SidebarToolId = FeatureKey | "subscription";

type DashboardSidebarProps = {
  active: SidebarToolId;
  onSelect: (id: SidebarToolId) => void;
  language: Language;
  lockedFeatures: Set<FeatureKey>;
  /** Credit balance from `/api/entitlement/balance`. */
  userBalance?: UserBalance | null;
  userRole?: string;
  enabledToolIds?: FeatureKey[];
  resolveToolLabel?: (id: FeatureKey) => string;
  /** Limitsiz Pro — bottom badge only; no purchase chrome in sidebar. */
  limitsizProActive?: boolean;
  onAdminClick?: () => void;
  accessToken?: string | null;
  onUpgrade?: () => void;
  currentPlan?: string;
  isTeamMember?: boolean;
  isManagerMember?: boolean;
  onTeamClick?: () => void;
  /** AI aracı aç (Özetle / Sohbet / Veri Çıkar / Çeviri / Toplu İşlem). */
  onOpenAi?: (mode: AiToolMode) => void;
  /** PDF Düzenle aracını aç (cihazda editör). */
  onOpenEditor?: () => void;
  /** PDF İmzala aracını aç (cihazda imza). */
  onOpenSign?: () => void;
  /** PDF Yorumla aracını aç (cihazda işaretleme). */
  onOpenAnnotate?: () => void;
  onOpenCrop?: () => void;
  onOpenCompressImage?: () => void;
  /** Belge Tara aracını aç (kamerayla tarama — cihazda). */
  onOpenScan?: () => void;
  /** Aktif içerik paneli — mobil launcher başlığı FeatureKey olmayan araçları da
   * (Düzenle/İmzala/İşaretle/AI) doğru göstersin diye. */
  contentPanel?: string;
  /** Aktif AI aracı modu (contentPanel === "ai" iken). */
  aiMode?: AiToolMode | null;
};

/**
 * Desktop workspace rail: PDF tools only (+ optional VIP strip). Nav, language, and account live in `DashboardTopNav`.
 */
export function DashboardSidebar({
  active,
  onSelect,
  language,
  lockedFeatures,
  userBalance,
  userRole,
  enabledToolIds,
  resolveToolLabel,
  limitsizProActive,
  onAdminClick,
  accessToken,
  onUpgrade,
  currentPlan,
  isTeamMember,
  isManagerMember,
  onTeamClick,
  onOpenAi,
  onOpenEditor,
  onOpenSign,
  onOpenAnnotate,
  onOpenScan,
  onOpenCrop,
  onOpenCompressImage,
}: DashboardSidebarProps) {
  const L = ws(language);
  const toolOrder = enabledToolIds?.length
    ? enabledToolIds
    : SIDEBAR_TOOL_ORDER;
  const labelForTool =
    resolveToolLabel ?? ((id: FeatureKey) => sidebarToolLabel(id, language));
  const { favorites, isFavorite, toggleFavorite } = useFavoriteTools();
  const tr = language === "tr";
  // Masaüstü sidebar: araçlar kategori bölümlerine ayrılır (Düzenle / Dönüştür /
  // İyileştir / İşaretle / Güvenlik) — mobil launcher ile aynı gruplama.
  // PDF Düzenle de favori olabilir (FeatureKey olmadığı için ayrı bayrak).
  const editorFavorited = !!onOpenEditor && isFavorite(EDITOR_FAV_ID);
  const signFavorited = !!onOpenSign && isFavorite(SIGN_FAV_ID);
  const annotateFavorited = !!onOpenAnnotate && isFavorite(ANNOTATE_FAV_ID);
  const sidebarGroups = useMemo(() => {
    const base = groupToolsByCategory(toolOrder) as Array<{
      id: ToolCategoryId | "other" | "favorites";
      tools: FeatureKey[];
    }>;
    const fav = toolOrder.filter((id) => isFavorite(id));
    // Favoriler bölümü: en az bir araç VEYA editör/imza/yorum favorilenmişse görünür.
    return fav.length > 0 || editorFavorited || signFavorited || annotateFavorited
      ? [{ id: "favorites" as const, tools: fav }, ...base]
      : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolOrder, favorites, editorFavorited, signFavorited, annotateFavorited]);
  // Accordion: varsayılan olarak TÜM kategoriler kapalı; yalnızca kullanıcının
  // favorisi varsa "Favoriler" açık gelir. Diğerleri başlığa tıklayınca açılır.
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set(favorites.length > 0 ? ["favorites"] : []),
  );
  const toggleCat = (id: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const showVipStrip =
    userRole !== "ADMIN" && Boolean(limitsizProActive && userBalance);

  const renderTool = (id: FeatureKey, keyPrefix = "") => {
    const isActive = active === id;
    const locked = lockedFeatures.has(id);
    const label = labelForTool(id);
    return (
      <button
        key={`${keyPrefix}${id}`}
        type="button"
        onClick={() => onSelect(id)}
        title={locked ? L.lockedFeatureTooltip : undefined}
        aria-label={locked ? `${label}. ${L.lockedFeatureTooltip}` : undefined}
        className={`group nb-transition flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium ${
          isActive
            ? "border border-nb-primary/45 bg-nb-primary/14 text-nb-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_-8px_rgba(59,130,246,0.45)]"
            : "border border-transparent text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
        } ${
          locked
            ? "ring-1 ring-amber-400/35 shadow-[0_0_28px_-10px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] hover:ring-amber-400/50 hover:shadow-[0_0_36px_-8px_rgba(245,158,11,0.6)]"
            : ""
        }`}
      >
        <span className={isActive ? "text-nb-primary-mid" : "text-nb-muted"}>
          {locked ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : (
            <SidebarToolGlyph id={id} className="h-5 w-5" active={isActive} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {locked ? (
              <span
                className="shrink-0 rounded-md border border-amber-400/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300/95 shadow-[0_0_12px_-4px_rgba(251,191,36,0.45)]"
                aria-hidden
              >
                {L.featureLockedBadge}
              </span>
            ) : null}
            <FavoriteStar alwaysVisible active={isFavorite(id)} label={label} onToggle={() => toggleFavorite(id)} />
          </span>
        </span>
      </button>
    );
  };

  // PDF Düzenle satırı — favori yıldızlı, hem Favoriler hem Düzenle grubunda kullanılır.
  const renderEditorRow = (keyPrefix = "") => {
    if (!onOpenEditor) return null;
    const label = tr ? "PDF Düzenle" : "Edit PDF";
    return (
      <button
        key={`${keyPrefix}editor`}
        type="button"
        onClick={onOpenEditor}
        className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
      >
        <span className="text-base text-cyan-400" aria-hidden>✏️</span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          <FavoriteStar
            alwaysVisible
            active={isFavorite(EDITOR_FAV_ID)}
            label={label}
            onToggle={() => toggleFavorite(EDITOR_FAV_ID)}
          />
        </span>
      </button>
    );
  };

  // PDF İmzala satırı — favori yıldızlı, hem Favoriler hem İşaretle grubunda kullanılır.
  const renderSignRow = (keyPrefix = "") => {
    if (!onOpenSign) return null;
    const label = tr ? "PDF İmzala" : "Sign PDF";
    return (
      <button
        key={`${keyPrefix}sign`}
        type="button"
        onClick={onOpenSign}
        className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
      >
        <span className="text-base text-amber-300" aria-hidden>✍️</span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          <FavoriteStar
            alwaysVisible
            active={isFavorite(SIGN_FAV_ID)}
            label={label}
            onToggle={() => toggleFavorite(SIGN_FAV_ID)}
          />
        </span>
      </button>
    );
  };

  // Belge Tara satırı — kamerayla tarama (cihazda). "Düzenle" grubunda gösterilir.
  const renderScanRow = (keyPrefix = "") => {
    if (!onOpenScan) return null;
    return (
      <button
        key={`${keyPrefix}scan`}
        type="button"
        onClick={onOpenScan}
        className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] px-3 py-2.5 text-left text-sm font-medium text-cyan-100 hover:scale-[1.02] hover:border-cyan-400/45 hover:bg-cyan-500/[0.12]"
      >
        <span className="text-base" aria-hidden>📸</span>
        <span className="truncate">{tr ? "Belge Tara" : "Scan document"}</span>
      </button>
    );
  };

  // PDF Yorumla satırı — favori yıldızlı, hem Favoriler hem İşaretle grubunda kullanılır.
  const renderAnnotateRow = (keyPrefix = "") => {
    if (!onOpenAnnotate) return null;
    const label = tr ? "PDF İşaretle" : "Markup PDF";
    return (
      <button
        key={`${keyPrefix}annotate`}
        type="button"
        onClick={onOpenAnnotate}
        className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
      >
        <span className="text-base text-orange-300" aria-hidden>🖍️</span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          <FavoriteStar
            alwaysVisible
            active={isFavorite(ANNOTATE_FAV_ID)}
            label={label}
            onToggle={() => toggleFavorite(ANNOTATE_FAV_ID)}
          />
        </span>
      </button>
    );
  };

  // PDF Kırp satırı — cihazda görsel kırpma; yapısal grup (Düzenle/Organize) içinde.
  const renderCropRow = (keyPrefix = "") => {
    if (!onOpenCrop) return null;
    const label = tr ? "PDF Kırp" : "Crop PDF";
    return (
      <button
        key={`${keyPrefix}crop`}
        type="button"
        onClick={onOpenCrop}
        className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
      >
        <Crop className="h-5 w-5 text-cyan-300" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const renderCompressImageRow = (keyPrefix = "") => {
    if (!onOpenCompressImage) return null;
    const label = tr ? "Görsel Sıkıştır" : "Compress Image";
    return (
      <button
        key={`${keyPrefix}compress-image`}
        type="button"
        onClick={onOpenCompressImage}
        className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-nb-muted hover:scale-[1.02] hover:bg-white/[0.06] hover:text-nb-text hover:shadow-md"
      >
        <ImageDown className="h-5 w-5 text-cyan-300" aria-hidden />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <aside data-tour="tools" className="fixed bottom-0 left-0 top-14 z-40 hidden w-60 flex-col border-r border-white/[0.08] bg-gradient-to-b from-nb-bg-elevated/92 via-[#0c1424]/95 to-nb-bg-elevated/92 shadow-[4px_0_32px_-6px_rgba(0,0,0,0.55)] backdrop-blur-xl backdrop-saturate-150 lg:flex">
      <nav
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
        aria-label="TOOLS"
      >
        {/* ── Ayrı AI kategorisi (Özetle + Sohbet) — kendi modal'ını açar ── */}
        {onOpenAi ? (
          <section>
            <button
              type="button"
              onClick={() => toggleCat("ai")}
              aria-expanded={openCats.has("ai")}
              className="mb-1.5 flex w-full items-center gap-2 px-2"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_ACCENT.ai.dot} ${CATEGORY_ACCENT.ai.glow}`}
                aria-hidden
              />
              <h3 className={`text-[10px] font-bold uppercase tracking-wider ${CATEGORY_ACCENT.ai.text}`}>
                {tr ? "✨ Yapay Zekâ" : "✨ AI"}
              </h3>
              <span className="ml-1 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
              <svg
                className={`h-3.5 w-3.5 shrink-0 text-nb-muted/70 transition-transform ${openCats.has("ai") ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openCats.has("ai") ? (
              <div className="flex flex-col gap-1">
                {AI_TOOLS.map((t) => (
                  <button
                    key={t.mode}
                    type="button"
                    onClick={() => onOpenAi(t.mode)}
                    className="group nb-transition flex w-full items-center gap-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.05] px-3 py-2.5 text-left text-sm font-medium text-nb-muted hover:scale-[1.02] hover:border-fuchsia-400/40 hover:bg-fuchsia-500/[0.12] hover:text-nb-text hover:shadow-[0_0_22px_-8px_rgba(232,121,249,0.6)]"
                  >
                    <span className="text-base text-fuchsia-300" aria-hidden>✨</span>
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{tr ? t.tr : t.en}</span>
                      <span className="shrink-0 rounded-md border border-fuchsia-400/35 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-300">
                        Pro
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {sidebarGroups.map((group) => {
          const accent = CATEGORY_ACCENT[group.id];
          const open = openCats.has(group.id);
          const heading =
            group.id === "favorites"
              ? tr ? "★ Favoriler" : "★ Favorites"
              : group.id === "other"
                ? tr ? "Diğer" : "Other"
                : toolCategoryLabel(group.id as ToolCategoryId, language);
          return (
            <section key={group.id}>
              {/* Kategori başlığı — tıklayınca açılır/kapanır (accordion) */}
              <button
                type="button"
                onClick={() => toggleCat(group.id)}
                aria-expanded={open}
                className="mb-1.5 flex w-full items-center gap-2 px-2"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot} ${accent.glow}`}
                  aria-hidden
                />
                <h3 className={`text-[10px] font-bold uppercase tracking-wider ${accent.text}`}>
                  {heading}
                </h3>
                <span className="ml-1 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                <svg
                  className={`h-3.5 w-3.5 shrink-0 text-nb-muted/70 transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {open ? (
                <div className="flex flex-col gap-1">
                  {/* Belge Tara — kamerayla tarama, Düzenle grubunun başında */}
                  {group.id === "organize" ? renderScanRow("organize-") : null}
                  {/* PDF Düzenle — Düzenle grubunda her zaman ilk; Favoriler'de favoriyse */}
                  {group.id === "organize" ? renderEditorRow("organize-") : null}
                  {group.id === "organize" ? renderCropRow("organize-") : null}
                  {group.id === "organize" ? renderCompressImageRow("organize-") : null}
                  {group.id === "favorites" && editorFavorited ? renderEditorRow("fav-") : null}
                  {/* PDF İmzala + Yorumla — İşaretle grubunda önde; Favoriler'de favoriyse */}
                  {group.id === "annotate" ? renderSignRow("annotate-") : null}
                  {group.id === "annotate" ? renderAnnotateRow("annotate-") : null}
                  {group.id === "favorites" && signFavorited ? renderSignRow("fav-") : null}
                  {group.id === "favorites" && annotateFavorited ? renderAnnotateRow("fav-") : null}
                  {group.tools.map((id) => renderTool(id, `${group.id}-`))}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>

      {showVipStrip ? (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/14 via-emerald-600/12 to-nb-panel/55 px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-lg font-black tracking-tight text-amber-200">
              {L.unlimitedSidebarBadge}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-snug text-emerald-100/90">
              {L.unlimitedAccessActive}
            </p>
          </div>
        </div>
      ) : null}

      {currentPlan === "BUSINESS" && (!isTeamMember || isManagerMember) && onTeamClick ? (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <button
            type="button"
            onClick={onTeamClick}
            className="nb-transition flex w-full items-center gap-2.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/8 px-3 py-2.5 text-left text-sm font-semibold text-cyan-200 hover:bg-cyan-500/16 hover:text-cyan-100 hover:shadow-[0_0_20px_-6px_rgba(6,182,212,0.4)]"
          >
            <span className="text-lg">👥</span>
            <span>Ekip Yönetimi</span>
          </button>
        </div>
      ) : null}

      {userRole === "ADMIN" && onAdminClick ? (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <button
            type="button"
            onClick={onAdminClick}
            className="nb-transition flex w-full items-center gap-2.5 rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3 py-2.5 text-left text-sm font-semibold text-violet-200 hover:bg-violet-500/20 hover:text-violet-100 hover:shadow-[0_0_20px_-6px_rgba(139,92,246,0.5)]"
          >
            <svg
              className="h-5 w-5 shrink-0 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 11.943c0 6.001 4.448 10.956 10.22 11.944C19.122 22.899 23.57 17.944 23.57 11.943a11.955 11.955 0 00-.598-5.943A11.959 11.959 0 0112 2.714z"
              />
            </svg>
            <span>Admin Paneli</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Telefon + tablet (lg altı) araç gezgini: araçlar kategori bölümlerine ayrılmış
 * bir Launchpad ızgarasında sunulur. Hamburger'a basılınca açılır; üstte hızlı
 * arama, altında "Düzenle / Dönüştür / İyileştir / İşaretle / Güvenlik" başlıklı
 * bölümler bulunur. Bir araç seçilince kapanır.
 */
export function DashboardSidebarMobileLauncher({
  active,
  onSelect,
  language,
  lockedFeatures,
  enabledToolIds,
  resolveToolLabel,
  onOpenAi,
  onOpenEditor,
  onOpenSign,
  onOpenAnnotate,
  onOpenScan,
  contentPanel,
  aiMode,
}: DashboardSidebarProps) {
  const L = ws(language);
  const tr = language === "tr";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const toolOrder = enabledToolIds?.length
    ? enabledToolIds
    : SIDEBAR_TOOL_ORDER;
  const labelForTool =
    resolveToolLabel ?? ((id: FeatureKey) => sidebarToolLabel(id, language));

  // FeatureKey OLMAYAN aktif panelleri de başlıkta göster (activeSidebar bunlarda
  // güncellenmiyor). Öncelik: aktif özel/AI panel → normal araç → "Menü".
  const panelLabel =
    contentPanel === "editor"
      ? tr ? "PDF Düzenle" : "Edit PDF"
      : contentPanel === "sign"
        ? tr ? "PDF İmzala" : "Sign PDF"
        : contentPanel === "annotate"
          ? tr ? "PDF İşaretle" : "Markup PDF"
          : contentPanel === "ai" && aiMode
            ? (() => {
                const t = AI_TOOLS.find((x) => x.mode === aiMode);
                return t ? (tr ? t.tr : t.en) : tr ? "Yapay Zekâ" : "AI";
              })()
            : null;
  const activeIsTool = toolOrder.includes(active as FeatureKey);
  const activeLabel =
    panelLabel ??
    (activeIsTool ? labelForTool(active as FeatureKey) : tr ? "Menü" : "Menu");

  const { favorites, isFavorite, toggleFavorite } = useFavoriteTools();
  const editorFavorited = !!onOpenEditor && isFavorite(EDITOR_FAV_ID);
  const signFavorited = !!onOpenSign && isFavorite(SIGN_FAV_ID);
  const annotateFavorited = !!onOpenAnnotate && isFavorite(ANNOTATE_FAV_ID);
  const groups = useMemo(() => {
    const base = groupToolsByCategory(toolOrder) as Array<{
      id: ToolCategoryId | "other" | "favorites";
      tools: FeatureKey[];
    }>;
    const fav = toolOrder.filter((id) => isFavorite(id));
    return fav.length > 0 || editorFavorited || signFavorited || annotateFavorited
      ? [{ id: "favorites" as const, tools: fav }, ...base]
      : base;
    // favorites listesi değişince yeniden grupla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolOrder, favorites, editorFavorited, signFavorited, annotateFavorited]);

  // Arama: araç adına göre filtrele; eşleşme olmayan kategoriler gizlenir.
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(tr ? "tr" : "en");
    if (!q) {
      return groups;
    }
    return groups
      .map((g) => ({
        ...g,
        tools: g.tools.filter((id) =>
          labelForTool(id).toLocaleLowerCase(tr ? "tr" : "en").includes(q),
        ),
      }))
      .filter((g) => g.tools.length > 0);
    // labelForTool kararlı (prop/dil); query + groups değiştiğinde yeniden hesapla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, query, tr]);

  const hasResults = filteredGroups.length > 0;

  // ESC ile kapat
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Launchpad açıkken arka plan (çalışma sayfası) scroll'unu KİLİTLE.
  // iOS Safari `overflow:hidden`'ı yok sayar → body position:fixle sabitlenir;
  // mevcut scroll konumu korunup kapanınca geri yüklenir. Aksi halde launchpad
  // listesinin sonuna gelince kaydırma arka plana zincirleniyordu.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Menü kapanınca aramayı sıfırla
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const handlePick = (id: SidebarToolId) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div data-tour="tools-mobile" className="sticky top-14 z-30 border-b border-white/[0.06] bg-nb-bg/95 backdrop-blur-md lg:hidden">
      {/* Tetikleyici: hamburger + aktif araç adı */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="nb-transition flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-nb-text transition-colors ${
            open
              ? "border-nb-primary/45 bg-nb-primary/14 text-nb-accent"
              : "border-white/[0.1] bg-nb-panel/70"
          }`}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {open ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-nb-muted">
            {tr ? "Araçlar" : "Tools"}
          </span>
          <span className="truncate text-sm font-bold text-nb-text">
            {activeLabel}
          </span>
        </span>
        <svg
          className={`ml-auto h-4 w-4 shrink-0 text-nb-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Açılır, kategorili Launchpad */}
      {open ? (
        <div className="absolute inset-x-0 top-full">
          <button
            type="button"
            aria-label={tr ? "Kapat" : "Close"}
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 top-14 -z-10 cursor-default bg-black/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label={tr ? "Araçlar" : "Tools"}
            className="max-h-[78vh] overflow-y-auto overscroll-contain border-b border-white/[0.08] bg-nb-bg-elevated/98 shadow-[0_28px_56px_-12px_rgba(0,0,0,0.65)] backdrop-blur-md"
          >
            {/* Yapışkan arama çubuğu */}
            <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-nb-bg-elevated/95 px-3 py-3 backdrop-blur-md sm:px-4">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nb-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                  />
                </svg>
                <input
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr ? "Araç ara…" : "Search tools…"}
                  aria-label={tr ? "Araç ara" : "Search tools"}
                  className="nb-transition w-full rounded-xl border border-white/[0.1] bg-nb-panel/60 py-2.5 pl-9 pr-9 text-sm text-nb-text placeholder:text-nb-muted/70 focus:border-nb-primary/45 focus:outline-none focus:ring-2 focus:ring-nb-primary/20"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={tr ? "Temizle" : "Clear"}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-nb-muted hover:bg-white/[0.08] hover:text-nb-text"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="px-3 py-3 sm:px-4">
              {hasResults ? (
                <div className="flex flex-col gap-5">
                  {/* AI kategorisi (arama boşken) */}
                  {onOpenAi && !query.trim() ? (
                    <section>
                      <div className="mb-2.5 flex items-center gap-2 px-0.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_ACCENT.ai.dot} ${CATEGORY_ACCENT.ai.glow}`}
                          aria-hidden
                        />
                        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${CATEGORY_ACCENT.ai.text}`}>
                          {tr ? "✨ Yapay Zekâ" : "✨ AI"}
                        </h3>
                        <span className="ml-1 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] sm:gap-3">
                        {AI_TOOLS.map((t) => (
                          <button
                            key={t.mode}
                            type="button"
                            onClick={() => {
                              onOpenAi(t.mode);
                              setOpen(false);
                            }}
                            className="nb-transition group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-2 text-center hover:border-fuchsia-400/45 hover:bg-fuchsia-500/[0.12] active:scale-[0.97]"
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-lg" aria-hidden>
                              ✨
                            </span>
                            <span className="line-clamp-2 text-[10px] font-bold leading-tight text-fuchsia-100">
                              {tr ? t.tr : t.en}
                            </span>
                            <span className="absolute right-1 top-1 rounded-md border border-fuchsia-400/35 bg-fuchsia-500/10 px-1 py-0.5 text-[8px] font-bold uppercase text-fuchsia-300">
                              Pro
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {filteredGroups.map((group) => {
                    const accent = CATEGORY_ACCENT[group.id];
                    const heading =
                      group.id === "favorites"
                        ? tr
                          ? "★ Favoriler"
                          : "★ Favorites"
                        : group.id === "other"
                          ? tr
                            ? "Diğer"
                            : "Other"
                          : toolCategoryLabel(group.id as ToolCategoryId, language);
                    return (
                      <section key={group.id}>
                        {/* Kategori başlığı */}
                        <div className="mb-2.5 flex items-center gap-2 px-0.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${accent.dot} ${accent.glow}`}
                            aria-hidden
                          />
                          <h3
                            className={`text-[11px] font-bold uppercase tracking-wider ${accent.text}`}
                          >
                            {heading}
                          </h3>
                          <span className="text-[10px] font-semibold text-nb-muted/70">
                            {group.tools.length}
                          </span>
                          <span className="ml-1 h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                        </div>

                        {/* Araç kartları — telefona otomatik uyum (auto-fill) */}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] sm:gap-3">
                          {/* Belge Tara kartı — kamerayla tarama (Düzenle grubunda) */}
                          {onOpenScan && !query.trim() && group.id === "organize" ? (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenScan();
                                setOpen(false);
                              }}
                              className="nb-transition group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-2 text-center hover:border-cyan-400/45 hover:bg-cyan-500/[0.12] active:scale-[0.97]"
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-lg" aria-hidden>📸</span>
                              <span className="line-clamp-2 text-[10px] font-bold leading-tight text-cyan-100">
                                {tr ? "Belge Tara" : "Scan document"}
                              </span>
                            </button>
                          ) : null}
                          {/* PDF Düzenle kartı — Düzenle grubunda her zaman, Favoriler'de favoriyse */}
                          {onOpenEditor && !query.trim() &&
                          (group.id === "organize" || (group.id === "favorites" && editorFavorited)) ? (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenEditor();
                                setOpen(false);
                              }}
                              className="nb-transition group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-nb-panel/55 p-2 text-center hover:border-cyan-400/25 hover:bg-white/[0.06] active:scale-[0.97]"
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-lg" aria-hidden>✏️</span>
                              <span className="line-clamp-2 text-[10px] font-bold leading-tight text-nb-text/90">
                                {tr ? "PDF Düzenle" : "Edit PDF"}
                              </span>
                              <span className="absolute left-1 top-1">
                                <FavoriteStar
                                  alwaysVisible
                                  active={isFavorite(EDITOR_FAV_ID)}
                                  label={tr ? "PDF Düzenle" : "Edit PDF"}
                                  onToggle={() => toggleFavorite(EDITOR_FAV_ID)}
                                />
                              </span>
                            </button>
                          ) : null}
                          {/* PDF İmzala kartı — İşaretle grubunda her zaman, Favoriler'de favoriyse */}
                          {onOpenSign && !query.trim() &&
                          (group.id === "annotate" || (group.id === "favorites" && signFavorited)) ? (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenSign();
                                setOpen(false);
                              }}
                              className="nb-transition group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-nb-panel/55 p-2 text-center hover:border-amber-400/25 hover:bg-white/[0.06] active:scale-[0.97]"
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-lg" aria-hidden>✍️</span>
                              <span className="line-clamp-2 text-[10px] font-bold leading-tight text-nb-text/90">
                                {tr ? "PDF İmzala" : "Sign PDF"}
                              </span>
                              <span className="absolute left-1 top-1">
                                <FavoriteStar
                                  alwaysVisible
                                  active={isFavorite(SIGN_FAV_ID)}
                                  label={tr ? "PDF İmzala" : "Sign PDF"}
                                  onToggle={() => toggleFavorite(SIGN_FAV_ID)}
                                />
                              </span>
                            </button>
                          ) : null}
                          {/* PDF Yorumla kartı — İşaretle grubunda her zaman, Favoriler'de favoriyse */}
                          {onOpenAnnotate && !query.trim() &&
                          (group.id === "annotate" || (group.id === "favorites" && annotateFavorited)) ? (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenAnnotate();
                                setOpen(false);
                              }}
                              className="nb-transition group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-nb-panel/55 p-2 text-center hover:border-orange-400/25 hover:bg-white/[0.06] active:scale-[0.97]"
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-lg" aria-hidden>🖍️</span>
                              <span className="line-clamp-2 text-[10px] font-bold leading-tight text-nb-text/90">
                                {tr ? "PDF İşaretle" : "Markup PDF"}
                              </span>
                              <span className="absolute left-1 top-1">
                                <FavoriteStar
                                  alwaysVisible
                                  active={isFavorite(ANNOTATE_FAV_ID)}
                                  label={tr ? "PDF İşaretle" : "Markup PDF"}
                                  onToggle={() => toggleFavorite(ANNOTATE_FAV_ID)}
                                />
                              </span>
                            </button>
                          ) : null}
                          {group.tools.map((id) => {
                            const isActive = active === id;
                            const locked = lockedFeatures.has(id);
                            const label = labelForTool(id);
                            return (
                              <button
                                key={`${group.id}-${id}`}
                                type="button"
                                role="menuitem"
                                onClick={() => handlePick(id)}
                                title={
                                  locked ? L.lockedFeatureTooltip : undefined
                                }
                                aria-label={
                                  locked
                                    ? `${label}. ${L.lockedFeatureTooltip}`
                                    : label
                                }
                                className={`nb-transition group relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center active:scale-[0.97] ${
                                  isActive
                                    ? "border-nb-primary/45 bg-nb-primary/14 shadow-[0_0_24px_-8px_rgba(59,130,246,0.45)]"
                                    : "border-white/[0.08] bg-nb-panel/55 hover:border-nb-primary/25 hover:bg-white/[0.06]"
                                } ${locked ? `ring-1 ${accent.ring}` : ""}`}
                              >
                                <span
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                    isActive
                                      ? "bg-nb-primary/15"
                                      : "bg-white/[0.04] group-hover:bg-white/[0.07]"
                                  }`}
                                >
                                  {locked ? (
                                    <svg
                                      className="h-5 w-5 text-amber-300/90"
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
                                      id={id}
                                      className="h-5 w-5"
                                      active={isActive}
                                    />
                                  )}
                                </span>
                                <span
                                  className={`line-clamp-2 text-[10px] font-bold leading-tight ${
                                    isActive ? "text-nb-accent" : "text-nb-text/90"
                                  }`}
                                >
                                  {label}
                                </span>
                                {locked ? (
                                  <span
                                    className="absolute right-1 top-1 rounded-md border border-amber-400/35 bg-amber-500/10 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-300/95"
                                    aria-hidden
                                  >
                                    {L.featureLockedBadge}
                                  </span>
                                ) : null}
                                <span className="absolute left-1 top-1">
                                  <FavoriteStar
                                    alwaysVisible
                                    active={isFavorite(id)}
                                    label={label}
                                    onToggle={() => toggleFavorite(id)}
                                  />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <svg
                    className="h-8 w-8 text-nb-muted/60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-nb-muted">
                    {tr
                      ? `"${query}" için araç bulunamadı`
                      : `No tools found for "${query}"`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
