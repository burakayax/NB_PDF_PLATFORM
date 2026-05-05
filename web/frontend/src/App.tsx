// Web uygulamasının kök bileşeni: karşılama, kimlik, yasal sayfalar ve PDF araçları görünümlerini tek state ile yönetir.
// Oturum, abonelik ve dosya yükleme durumunun modüller arasında paylaşılması için tek React ağacında toplanır.
// Bu bileşen parçalanırsa üst düzey hook ve görünüm geçişleri yeniden kablolanmak zorunda kalır.
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createMergeJob,
  downloadFromApi,
  downloadMergeJob,
  downloadResult,
  EntitlementPaymentRequiredError,
  fetchMergeJob,
  fetchMergeJobHeroPreviewBlobUrl,
  fetchResultThumbnailBlobUrl,
  inspectPdf,
  MergeJobNotFoundError,
  postToolToResult,
  requestMergeJobCancel,
  type MergeJobStatus,
} from "./api";
import { AUTH_ACCESS_TOKEN_STORAGE_KEY, type AuthUser } from "./api/auth";
import { submitContactForm } from "./api/contact";
import { CookieNotice } from "./components/common/CookieNotice";
import {
  MaintenancePage,
  MaintenanceTabTitle,
} from "./components/common/MaintenancePage";
import { RuntimeBootstrapSplash } from "./components/common/RuntimeBootstrapSplash";
import { PdfApiOfflineBanner } from "./components/common/PdfApiOfflineBanner";
import type { PdfPageVisualMode } from "./components/split/PdfPageVisualGrid";
import { SplitPagePickerModal } from "./components/split/SplitPagePickerModal";
import { GatedResultPreviewModal } from "./components/GatedResultPreviewModal";
import { SaasGatedPreview } from "./components/SaasGatedPreview";
import { SystemNotificationBanner } from "./components/common/SystemNotificationBanner";
import type { SaaSGating } from "./lib/saasGating";
import {
  DashboardSidebar,
  DashboardSidebarMobileRail,
  type SidebarToolId,
} from "./components/dashboard/DashboardSidebar";
import { DashboardTopNav } from "./components/dashboard/DashboardTopNav";
import { QuotaWidget } from "./components/dashboard/QuotaWidget";
import { ChangePasswordModal } from "./components/dashboard/ChangePasswordModal";
import { CheckoutCurrencyProvider } from "./contexts/CheckoutCurrencyContext";
import { UserProfilePanel } from "./components/dashboard/UserProfilePanel";
import { userGreetingLine } from "./components/dashboard/userDisplayName";
import { SeoRouteManager } from "./components/seo/SeoRouteManager";
import {
  fetchSubscriptionStatus,
  fetchSubscriptionSummary,
  type FeatureKey,
  type SubscriptionSummary,
} from "./api/subscription";
import {
  ackDownloadLog,
  createDownloadLog,
  fetchUserBalance,
  type UserBalance,
} from "./api/entitlement";
import {
  confirmFakeCheckout,
  PAYMENT_CHECKOUT_NOT_FOUND,
  resolveFakePaymentRedirect,
} from "./api/fakePayment";
import {
  buildResumeDownloadUrl,
  canResumeAfterPayment,
  clearNbResumeProcess,
  isNbResumeStale,
  readNbResumeProcess,
  saveNbResumeProcess,
  type NbResumeProcessV1,
} from "./lib/nbResumeProcess";
import { translateAuthApiMessage } from "./i18n/auth";
import {
  featureCopy,
  sidebarToolLabel,
  validatePagesFormat,
  validatePagesMax,
  ws,
  expandPagesString,
  PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG,
} from "./i18n/workspace";
import { getCmsWorkspaceBanner } from "./lib/landingCmsMerge";
import {
  buildWorkspaceFeaturesFromCms,
  isResultStoreTool,
  type WorkspaceFeatureUi,
} from "./lib/workspaceFeatures";
import { useAnalyticsTracking } from "./hooks/useAnalyticsTracking";
import { useGAPageTracking } from "./hooks/useGAPageTracking";
import { useAuthSession } from "./hooks/useAuthSession";
import { useSettings } from "./hooks/useSettings";
import { friendlyOperationFailedMessage } from "./lib/userFacingErrors";
import { useCookieConsent } from "./hooks/useCookieConsent";
import { useErrorLogging } from "./hooks/useErrorLogging";
import { usePreferredLanguage } from "./hooks/usePreferredLanguage";
import { sanitizeDownloadBasename } from "./lib/sanitizeDownloadBasename";
import { isLimitsizProUnlimited } from "./lib/workspaceEntitlements";
import {
  SESSION_POST_OAUTH_ADMIN_VALUE,
  SESSION_POST_OAUTH_REDIRECT_KEY,
} from "./lib/oauthRedirect";
import { readMaintenanceHint } from "./lib/maintenanceHint";
import { parseWorkspaceToolPath, toolSlugForFeature } from "./lib/toolRoutes";
import {
  persistWorkspaceTool,
  readInitialWorkspaceToolSelection,
  clearPersistedWorkspaceTool,
  clearPdfWorkspaceSplitDraftsFromLocalStorage,
  clearWorkspaceSessionStoragePrefixes,
} from "./lib/workspaceToolSelection";

/** Geçici GA testi: çerez bildirimi ve consent beklemeden gtag/sunucu analitiği çalışır (bakım sayfası dahil). Doğrulama sonrası false yapın. */
const GA_TEST_BYPASS_COOKIE_CONSENT = false;

type NonLegalView =
  | "landing"
  | "login"
  | "register"
  | "forgot_password"
  | "web"
  | "admin"
  | "admin_login";
type LegalView = "terms" | "privacy" | "kvkk";
type AppView = NonLegalView | LegalView;
type ToastType = "success" | "error" | "loading" | "info";

const AdminPanel = lazy(() =>
  import("./admin/AdminPanel").then((module) => ({
    default: module.AdminPanel,
  })),
);
const AuthPage = lazy(() =>
  import("./components/auth/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("./components/auth/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const LoginSuccessPage = lazy(() =>
  import("./components/auth/LoginSuccessPage").then((module) => ({
    default: module.LoginSuccessPage,
  })),
);
const LandingPage = lazy(() =>
  import("./components/landing/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const LegalPage = lazy(() =>
  import("./components/legal/LegalPage").then((module) => ({
    default: module.LegalPage,
  })),
);
const PlanUpgradeModal = lazy(() =>
  import("./components/dashboard/PlanUpgradeModal").then((module) => ({
    default: module.PlanUpgradeModal,
  })),
);

type ContentPanel = "tool" | "subscription" | "profile" | "pricing";

type ToastState = {
  type: ToastType;
  title: string;
  detail: string;
};

type UploadItem = {
  id: string;
  file: File;
  encrypted: boolean;
  inspecting: boolean;
  password: string;
  pageCount: number | null;
  /** Birleştirme: şifreli dosyada parola sunucuda doğrulandı mı */
  mergePasswordVerified: boolean;
};

type Feature = WorkspaceFeatureUi;
type FeatureId = FeatureKey;

// PDF ön incelemesi (şifreli mi) gerektiren modül kimlikleri; inspect isteği bu listeye göre tetiklenir.
// Parola alanlarının görünürlüğü modül bazında olduğundan hangi işlemlerin inceleme istediği açıkça seçilmelidir.
// Liste backend veya UI ile senkron bozulursa şifreli dosyada parola alanı çıkmaz veya gereksiz istek atılır.
function isPathAllowedDuringMaintenance(pathname: string): boolean {
  if (pathname === "/login-success" || pathname === "/login-error") {
    return true;
  }
  if (pathname === "/admin-login") {
    return true;
  }
  if (pathname.startsWith("/fake-payment")) {
    return true;
  }
  return false;
}

const pdfInspectionFeatures: FeatureId[] = [
  "split",
  "merge",
  "pdf-to-word",
  "pdf-to-excel",
  "compress",
  "encrypt",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "pdf-to-ppt",
  "pdf-to-image",
];

function EmptyStateIllustration() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function EmptyState({
  title,
  hint,
  compact = false,
}: {
  title: string;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`nb-empty-state${compact ? " nb-empty-state--compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="nb-empty-state__icon">
        <EmptyStateIllustration />
      </div>
      <p className="nb-empty-state__title">{title}</p>
      <p className="nb-empty-state__hint">{hint}</p>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/** UI-only heuristic for typical PDF recompression bands (not a server guarantee). */
function compressEstimatePercentRange(bytes: number): {
  min: number;
  max: number;
} {
  if (bytes < 80 * 1024) return { min: 5, max: 18 };
  if (bytes < 512 * 1024) return { min: 10, max: 28 };
  if (bytes < 5 * 1024 * 1024) return { min: 15, max: 38 };
  return { min: 18, max: 45 };
}

function genericToolPhaseLabel(
  featureId: FeatureId,
  percent: number,
  indeterminate: boolean,
  W: ReturnType<typeof ws>,
  standardLanePhase: boolean,
): string {
  if (standardLanePhase) {
    if (indeterminate) {
      return W.toolProgressPhaseQueueFree;
    }
    if (percent < 22) {
      return W.toolProgressPhaseHandoff;
    }
  }
  if (indeterminate) {
    return W.toolProgressPhaseAnalyzing;
  }
  if (percent < 30) {
    return W.toolProgressPhaseAnalyzing;
  }
  if (percent < 82) {
    if (featureId === "compress") {
      return W.toolProgressPhaseCompressing;
    }
    return W.toolProgressPhaseProcessing;
  }
  return W.toolProgressPhaseFinishing;
}

function UpgradeNudgeInline({
  tier,
  W,
  onContinueFree,
  onUpgrade,
}: {
  tier: 1 | 2 | 3;
  W: ReturnType<typeof ws>;
  onContinueFree: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/45 to-nb-bg-elevated/35 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      role="region"
      aria-label={W.upgradeNudgeAria}
    >
      <p className="text-[12px] font-medium leading-relaxed text-cyan-100/90">
        {W.upgradeNudgeTierBody(tier)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="nb-transition rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-nb-muted hover:border-cyan-500/35 hover:bg-cyan-500/10 hover:text-cyan-100"
          onClick={onContinueFree}
        >
          {W.upgradeNudgeContinueFree}
        </button>
        <button
          type="button"
          className="nb-transition rounded-lg border border-cyan-400/40 bg-cyan-500/12 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-50 hover:bg-cyan-500/22"
          onClick={onUpgrade}
        >
          {W.upgradeNudgeUpgradeInstant}
        </button>
      </div>
    </div>
  );
}

function mergeToolPhaseLabel(
  job: MergeJobStatus,
  indeterminate: boolean,
  W: ReturnType<typeof ws>,
): string {
  if (job.status === "failed" || job.status === "cancelled") {
    return "";
  }
  if (indeterminate) {
    return W.toolProgressPhaseAnalyzing;
  }
  const p = job.percent;
  if (p < 32) {
    return W.toolProgressPhaseAnalyzing;
  }
  if (p < 78) {
    return W.toolProgressPhaseMerging;
  }
  return W.toolProgressPhaseFinishing;
}

function createUploadItems(fileList: File[]) {
  // Tarayıcı File listesini arayüz state modeline çevirir; her öğeye kararlı id ve şifre alanı ekler.
  // Birleştirme sırası ve liste render'ı bu yapı üzerinden yürüdüğünden tutarlı şema gereklidir.
  // Id üretimi zayıflarsa React anahtarları çakışır; sürükle-bırak ve güncelleme davranışı bozulabilir.
  return fileList.map((file) => ({
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    encrypted: false,
    inspecting: false,
    password: "",
    pageCount: null,
    mergePasswordVerified: false,
  }));
}

function formatElapsed(seconds: number) {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function isUserAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") {
    return true;
  }
  if (e instanceof Error && e.name === "AbortError") {
    return true;
  }
  return false;
}

/** Birleştirme listesinde imleç Y konumuna göre hedef satır indeksi (yer değiştirme önizlemesi için). */
function mergePointerYToIndex(
  clientY: number,
  container: HTMLElement | null,
): number {
  if (!container) {
    return 0;
  }
  const cards = [
    ...container.querySelectorAll("[data-merge-row-index]"),
  ] as HTMLElement[];
  if (cards.length === 0) {
    return 0;
  }
  for (let i = 0; i < cards.length; i++) {
    const br = cards[i].getBoundingClientRect();
    if (clientY >= br.top && clientY <= br.bottom) {
      return i;
    }
  }
  const first = cards[0].getBoundingClientRect();
  if (clientY < first.top) {
    return 0;
  }
  const last = cards[cards.length - 1].getBoundingClientRect();
  if (clientY > last.bottom) {
    return cards.length - 1;
  }
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < cards.length; i++) {
    const br = cards[i].getBoundingClientRect();
    const mid = br.top + br.height / 2;
    const d = Math.abs(clientY - mid);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Sürüklerken diğer satırların kayarak ara açılmasını sağlar (kaynak ve hedef indeks arası). */
function getReorderPreviewOffset(
  index: number,
  from: number,
  to: number,
  slot: number,
): number {
  if (from < 0 || from === to || slot <= 0) {
    return 0;
  }
  if (from < to) {
    if (index > from && index <= to) {
      return -slot;
    }
  } else if (from > to) {
    if (index >= to && index < from) {
      return slot;
    }
  }
  return 0;
}

function workspacePathForFeature(featureId: FeatureKey): string {
  return `/tools/${toolSlugForFeature(featureId)}`;
}

/** createMergeJob yanıtı gelene kadar UI'da anında gösterilen yer tutucu iş kimliği. */
const MERGE_JOB_PENDING_ID = "__merge_pending__";
/** Büyük birleştirmeler (10k+ sayfa) dakikalar sürebilir; 30 sn ile iptal etmeyin. */
const MERGE_WATCHDOG_MS = 6 * 60 * 60 * 1000;
/** Büyük PDF'lerde /api/inspect-pdf uzun sürebilir; 30 sn ile yükleme iptali yapmayın. */
const PDF_INSPECT_TIMEOUT_MS = 15 * 60 * 1000;
/** Result-store (Sayfa Sil, Split, …) sunucu işi uzun sürebilir; merge watchdog ile uyumlu üst sınır. */
const TOOL_PIPELINE_WATCHDOG_MS = 6 * 60 * 60 * 1000;

function withPdfInspectTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) {
    return promise;
  }
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error("pdf_inspect_timeout"));
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function getTrackedViewName(view: AppView) {
  switch (view) {
    case "landing":
      return "landing";
    case "login":
      return "auth-login";
    case "register":
      return "auth-register";
    case "admin_login":
      return "admin-login";
    case "forgot_password":
      return "auth-forgot-password";
    case "terms":
      return "legal-terms";
    case "privacy":
      return "legal-privacy";
    case "kvkk":
      return "legal-kvkk";
    case "web":
      return "workspace";
    case "admin":
      return "admin-panel";
    default:
      return "landing";
  }
}

function getTrackedPath(view: AppView) {
  switch (view) {
    case "landing":
      return "/";
    case "login":
      return "/login";
    case "register":
      return "/register";
    case "forgot_password":
      return "/forgot-password";
    case "terms":
      return "/terms";
    case "privacy":
      return "/privacy";
    case "kvkk":
      return "/kvkk";
    case "web":
      return "/workspace";
    case "admin_login":
      return "/admin-login";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

function getInitialViewFromLocation(): AppView {
  if (typeof window === "undefined") {
    return "landing";
  }
  const rawPath = window.location.pathname.replace(/\/$/, "") || "/";
  if (parseWorkspaceToolPath(rawPath)) {
    return "web";
  }
  if (rawPath === "/login-success" || rawPath === "/login-error") {
    return "landing";
  }
  switch (rawPath) {
    case "/login":
      return "login";
    case "/register":
      return "register";
    case "/forgot-password":
      return "forgot_password";
    case "/terms":
      return "terms";
    case "/privacy":
      return "privacy";
    case "/kvkk":
      return "kvkk";
    case "/workspace":
      return "web";
    case "/admin-login":
      return "admin_login";
    case "/fake-payment/success":
      return "web";
    case "/admin":
    case "/admin/dashboard":
      return "admin";
    default:
      break;
  }
  const requestedView = new URLSearchParams(window.location.search).get("view");
  if (
    requestedView === "login" ||
    requestedView === "register" ||
    requestedView === "forgot_password" ||
    requestedView === "web" ||
    requestedView === "admin" ||
    requestedView === "admin_login" ||
    requestedView === "terms" ||
    requestedView === "privacy" ||
    requestedView === "kvkk"
  ) {
    return requestedView;
  }
  return "landing";
}

function App() {
  const { language, setLanguage, detectInitialLanguage } =
    usePreferredLanguage();
  const {
    user,
    accessToken,
    isAuthenticated,
    isRestoring,
    logout,
    login,
    register,
    updatePreferredLanguage,
    updateProfile,
    changePassword,
    setInitialPassword,
    completeOAuthLogin,
    clearSession,
    refreshSession,
  } = useAuthSession();
  const {
    hasConsent,
    isReady: isCookieConsentReady,
    acceptConsent,
  } = useCookieConsent();
  const { cms, site, TOOLSPublic, flags, runtimeHydrated } = useSettings();
  const [view, setView] = useState<AppView>(getInitialViewFromLocation);
  const [legalBackView, setLegalBackView] = useState<NonLegalView>("landing");
  const [selectedFeatureId, setSelectedFeatureId] = useState<FeatureId>(() =>
    typeof window !== "undefined"
      ? readInitialWorkspaceToolSelection(window.location.pathname)
      : "split",
  );
  const [contentPanel, setContentPanel] = useState<ContentPanel>("tool");
  const [activeSidebar, setActiveSidebar] = useState<SidebarToolId>("split");
  const [submitting, setSubmitting] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [registrationSuccessBanner, setRegistrationSuccessBanner] = useState<
    string | null
  >(null);
  const [subscriptionSummary, setSubscriptionSummary] =
    useState<SubscriptionSummary | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [workspaceSlateNonce, setWorkspaceSlateNonce] = useState(0);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [password, setPassword] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [pagesText, setPagesText] = useState("");
  const [pagesError, setPagesError] = useState("");
  const [splitMode, setSplitMode] = useState("single");
  const splitDraftStorageKey = useMemo(() => {
    const f = uploads[0]?.file;
    if (!f) {
      return null;
    }
    return `nb_pdf_workspace_split::${f.name}::${f.size}`;
  }, [uploads[0]?.file.name, uploads[0]?.file.size]);

  useEffect(() => {
    if (selectedFeatureId !== "split" || !splitDraftStorageKey) {
      return;
    }
    try {
      const raw = localStorage.getItem(splitDraftStorageKey);
      if (!raw) {
        return;
      }
      const p = JSON.parse(raw) as { pagesText?: string; splitMode?: string };
      if (typeof p.pagesText === "string") {
        setPagesText(p.pagesText);
      }
      if (p.splitMode === "single" || p.splitMode === "separate") {
        setSplitMode(p.splitMode);
      }
    } catch {
      /* ignore */
    }
  }, [selectedFeatureId, splitDraftStorageKey]);

  useEffect(() => {
    if (selectedFeatureId !== "split" || !splitDraftStorageKey) {
      return;
    }
    try {
      localStorage.setItem(
        splitDraftStorageKey,
        JSON.stringify({ pagesText, splitMode, v: 1 }),
      );
    } catch {
      /* ignore */
    }
  }, [pagesText, splitMode, selectedFeatureId, splitDraftStorageKey]);

  const [outputPassword, setOutputPassword] = useState("");
  const [deletePagesText, setDeletePagesText] = useState("");
  const [deletePagesError, setDeletePagesError] = useState("");
  const [rotateDeg, setRotateDeg] = useState("90");
  const [rotatePagesOnly, setRotatePagesOnly] = useState("");
  const [unlockOpenPassword, setUnlockOpenPassword] = useState("");
  const [watermarkPhrase, setWatermarkPhrase] = useState("TASLAK");
  const [watermarkColor, setWatermarkColor] = useState("#8C8C8C");
  const [watermarkFont, setWatermarkFont] = useState("helv");
  const [watermarkOpacity, setWatermarkOpacity] = useState("0.15");
  const [pageNumStart, setPageNumStart] = useState("1");
  const [pageNumPos, setPageNumPos] = useState<"footer" | "header">("footer");
  const [pageNumFmt, setPageNumFmt] = useState<"plain" | "page" | "of">(
    "plain",
  );
  const [compressQuality, setCompressQuality] = useState<
    "auto" | "low" | "medium" | "high"
  >("auto");
  const [pdfToImgFmt, setPdfToImgFmt] = useState("jpg");
  const [htmlToPdfMode, setHtmlToPdfMode] = useState<"url" | "html">("url");
  const [htmlToPdfUrl, setHtmlToPdfUrl] = useState("");
  const [htmlToPdfRaw, setHtmlToPdfRaw] = useState(
    "<html><body><p>Merhaba</p></body></html>",
  );
  const [mergeJob, setMergeJob] = useState<MergeJobStatus | null>(null);
  /** Birleştirme dışı araçlarda ETA / süre göstergesi için başlangıç zamanı ve dosya boyutu. */
  const [toolRunStartedAt, setToolRunStartedAt] = useState<number | null>(null);
  const [toolRunFileBytes, setToolRunFileBytes] = useState(0);
  const [toolRunClock, setToolRunClock] = useState(0);
  const [toolProgressSuccess, setToolProgressSuccess] = useState<{
    filename: string;
    featureTitle: string;
    replay?: () => void;
    /**
     * Access-gated preview (compress pilot). When present, the success
     * banner renders a preview card (thumbnail if available) and the
     * action button performs the gated download via
     * `downloadResult` instead of re-triggering a blob replay.
     */
    gatedDownload?: {
      /** Tool that produced this output — used for `/download-log` & balance refresh; avoids wrong id if user switched sidebar. */
      toolId: FeatureKey;
      /** GET `/api/pdf/result/{id}/download`. */
      resultId?: string;
      /** GET `/api/jobs/{id}/download` — merge workflow. */
      mergeJobId?: string;
      fallbackName: string;
      thumbnailBlobUrl: string | null;
      /**
       * Entitlement decision from the Node entitlement engine. When present,
       * `SaasGatedPreview` renders the blur/lock/upgrade UX; when absent, the
       * card falls back to the legacy 402-driven flow.
       */
      saasGating?: SaaSGating | null;
    };
  } | null>(null);
  const toolProgressSuccessRef = useRef(toolProgressSuccess);
  /** When true, the next `selectedFeatureId` change skips `disposeToolProgressSuccess` (payment resume navigation). */
  const suppressDisposeSuccessOnFeatureChangeRef = useRef(false);
  const lastRestoredResumeTsRef = useRef(0);
  const toolProgressDisposeRef = useRef<(() => void) | null>(null);
  const toolRunAbortRef = useRef<AbortController | null>(null);
  /** Watchdog: POST/GET fetch zaman aşımı — `AbortError` ile kullanıcı iptalini ayırt etmek için. */
  const genericToolStalemateTriggeredRef = useRef(false);
  const mergeFlowAbortRef = useRef<AbortController | null>(null);
  const [mergePointerDraggingId, setMergePointerDraggingId] = useState<
    string | null
  >(null);
  const [mergeDragOverIndex, setMergeDragOverIndex] = useState<number | null>(
    null,
  );
  const [mergeDragSlotPx, setMergeDragSlotPx] = useState(140);
  const mergePointerActiveRef = useRef<{
    sourceIndex: number;
    itemId: string;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    ghost: HTMLElement;
    cardEl: HTMLDivElement;
  } | null>(null);
  const mergeDragHoverIndexRef = useRef<number | null>(null);
  const mergePollHandledRef = useRef(false);
  /** Poll effect yeniden işlendiğinde (dil vb.) `handled` sıfırı tekrarlama — aynı `job_id` ise koru (çift başarı bildirimi). */
  const mergePollingActiveJobIdRef = useRef<string | null>(null);
  /** Bu oturuma göre yükleme zaman aşımı (yüklenmezse çıkış). */
  const mergePollingStartedMsRef = useRef(0);
  const mergeJobLatestRef = useRef<MergeJobStatus | null>(null);
  const mergePollInFlightRef = useRef(false);
  const mergeListScrollRef = useRef<HTMLDivElement | null>(null);
  /** `createMergeJob` SaaS preview payload — shown on gated merge download bar. */
  const mergeSaasGatingRef = useRef<SaaSGating | null>(null);
  const [mergeVerifyingId, setMergeVerifyingId] = useState<string | null>(null);
  const [mergeSnapId, setMergeSnapId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeNudgeLoadingHidden, setUpgradeNudgeLoadingHidden] =
    useState(false);
  const [upgradeNudgePostSuccessHidden, setUpgradeNudgePostSuccessHidden] =
    useState(false);
  const subscriptionSummaryRef = useRef<SubscriptionSummary | null>(null);
  const userRef = useRef(user);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inspectRunRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const contactSubmitInFlightRef = useRef(false);
  /** Ensures `/fake-payment/success` confirm runs once per navigation to that path. */
  const fakePaymentSuccessHandledRef = useRef(false);
  /** Skips one `persistWorkspaceTool` effect run so a post-download atomic reset isn't overwritten by stale tool id. */
  const persistWorkspaceSkipRef = useRef(false);
  /** One-shot: user acknowledged PDF→Excel table-structure warning. */
  const excelConfirmRef = useRef(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [pageVisualModalOpen, setPageVisualModalOpen] = useState(false);
  const [pageVisualMode, setPageVisualMode] =
    useState<PdfPageVisualMode>("split");
  const [rotatePageRotations, setRotatePageRotations] = useState<
    Record<number, number>
  >({});
  const [organizePageOrder, setOrganizePageOrder] = useState<number[]>([]);
  const splitVisualAutoOpenedForUploadId = useRef<string | null>(null);
  const deleteVisualAutoOpenedForUploadId = useRef<string | null>(null);
  const rotateVisualAutoOpenedForUploadId = useRef<string | null>(null);
  const organizeVisualAutoOpenedForUploadId = useRef<string | null>(null);
  /** Blocks duplicate `/download` akışları (aynı iş için paralel GET). */
  const gatedDownloadInFlightKeysRef = useRef<Set<string>>(new Set());
  const selectedFeatureIdEffectDidMountRef = useRef(false);
  const [gatedHeroModalOpen, setGatedHeroModalOpen] = useState(false);
  const [gatedHeroResultId, setGatedHeroResultId] = useState<string | null>(
    null,
  );
  const [gatedHeroMergeJobId, setGatedHeroMergeJobId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const id = uploads[0]?.id;
    const n = uploads[0]?.pageCount;
    if (selectedFeatureId !== "split" || !id || !n) {
      return;
    }
    if (splitVisualAutoOpenedForUploadId.current === id) {
      return;
    }
    splitVisualAutoOpenedForUploadId.current = id;
    setPageVisualMode("split");
    setPageVisualModalOpen(true);
  }, [selectedFeatureId, uploads[0]?.id, uploads[0]?.pageCount]);

  useEffect(() => {
    const id = uploads[0]?.id;
    const n = uploads[0]?.pageCount;
    if (selectedFeatureId !== "delete-pages" || !id || !n) {
      return;
    }
    if (deleteVisualAutoOpenedForUploadId.current === id) {
      return;
    }
    deleteVisualAutoOpenedForUploadId.current = id;
    setPageVisualMode("delete");
    setPageVisualModalOpen(true);
  }, [selectedFeatureId, uploads[0]?.id, uploads[0]?.pageCount]);

  useEffect(() => {
    setRotatePageRotations({});
    rotateVisualAutoOpenedForUploadId.current = null;
    organizeVisualAutoOpenedForUploadId.current = null;
  }, [uploads[0]?.id]);

  useEffect(() => {
    const id = uploads[0]?.id;
    const n = uploads[0]?.pageCount;
    if (selectedFeatureId !== "rotate-pdf" || !id || !n) return;
    if (rotateVisualAutoOpenedForUploadId.current === id) return;
    rotateVisualAutoOpenedForUploadId.current = id;
    setPageVisualMode("rotate");
    setPageVisualModalOpen(true);
  }, [selectedFeatureId, uploads[0]?.id, uploads[0]?.pageCount]);

  useEffect(() => {
    const id = uploads[0]?.id;
    const n = uploads[0]?.pageCount;
    if (selectedFeatureId !== "organize-pdf" || !id || !n) return;
    if (organizeVisualAutoOpenedForUploadId.current === id) return;
    organizeVisualAutoOpenedForUploadId.current = id;
    setOrganizePageOrder((prev) => {
      if (prev.length === n && new Set(prev).size === n) return prev;
      return Array.from({ length: n }, (_, i) => i + 1);
    });
    setPageVisualMode("organize");
    setPageVisualModalOpen(true);
  }, [selectedFeatureId, uploads[0]?.id, uploads[0]?.pageCount]);

  useEffect(() => {
    if (!selectedFeatureIdEffectDidMountRef.current) {
      selectedFeatureIdEffectDidMountRef.current = true;
      return;
    }
    setPageVisualModalOpen(false);
    if (selectedFeatureId !== "split") {
      splitVisualAutoOpenedForUploadId.current = null;
    }
    if (selectedFeatureId !== "delete-pages") {
      deleteVisualAutoOpenedForUploadId.current = null;
    }
    if (selectedFeatureId === "split") {
      setPageVisualMode("split");
    } else if (selectedFeatureId === "delete-pages") {
      setPageVisualMode("delete");
    } else if (selectedFeatureId === "rotate-pdf") {
      setPageVisualMode("rotate");
    } else if (selectedFeatureId === "organize-pdf") {
      setPageVisualMode("organize");
    } else {
      setPageVisualMode("split");
    }
  }, [selectedFeatureId]);

  const resetVisualPagePicker = useCallback(() => {
    const n = uploads[0]?.pageCount ?? 0;
    switch (pageVisualMode) {
      case "split":
        setPagesText("");
        setPagesError("");
        break;
      case "delete":
        setDeletePagesText("");
        setDeletePagesError("");
        break;
      case "rotate":
        setRotatePageRotations({});
        break;
      case "organize":
        if (n > 0) {
          const order = Array.from({ length: n }, (_, i) => i + 1);
          setOrganizePageOrder(order);
        }
        break;
      default:
        break;
    }
  }, [pageVisualMode, uploads[0]?.pageCount]);

  const workspaceFeatures = useMemo(
    () =>
      buildWorkspaceFeaturesFromCms(
        language,
        cms,
        TOOLSPublic.disabledFeatures,
      ),
    [language, cms, TOOLSPublic.disabledFeatures],
  );

  const selectedFeature = useMemo((): Feature => {
    const hit =
      workspaceFeatures.find((feature) => feature.id === selectedFeatureId) ??
      workspaceFeatures[0];
    if (hit) {
      return hit;
    }
    const fb = featureCopy(selectedFeatureId, language);
    return {
      id: selectedFeatureId,
      title: fb.title,
      icon: "📄",
      description: fb.description,
      endpoint: selectedFeatureId,
      buttonText: fb.button,
      accept: ".pdf,application/pdf",
      requiresUpload: true,
      fallbackFilename: "çıktı.pdf",
    };
  }, [workspaceFeatures, selectedFeatureId, language]);

  const lockedFeatures = useMemo(() => {
    const next = new Set<FeatureKey>();
    if (!isAuthenticated || !subscriptionSummary || subscriptionLoading) {
      return next;
    }
    if (subscriptionSummary.currentPlan.name === "FREE") {
      return next;
    }
    for (const f of workspaceFeatures) {
      if (!subscriptionSummary.allowedFeatures.includes(f.id)) {
        next.add(f.id);
      }
    }
    return next;
  }, [
    isAuthenticated,
    subscriptionSummary,
    subscriptionLoading,
    workspaceFeatures,
  ]);

  const enabledToolIds = useMemo(
    () => workspaceFeatures.map((f) => f.id),
    [workspaceFeatures],
  );
  const resolveToolLabel = useCallback(
    (id: FeatureKey) =>
      workspaceFeatures.find((f) => f.id === id)?.title ??
      sidebarToolLabel(id, language),
    [workspaceFeatures, language],
  );

  const primaryUpload = uploads[0] ?? null;
  const currentPdfIsEncrypted = Boolean(primaryUpload?.encrypted);
  const shouldInspectCurrentFeature =
    pdfInspectionFeatures.includes(selectedFeatureId);
  const selectedFeatureAllowed = useMemo(() => {
    if (!isAuthenticated) {
      return true;
    }
    if (subscriptionLoading || !subscriptionSummary) {
      return true;
    }
    if (subscriptionSummary.currentPlan.name === "FREE") {
      return true;
    }
    return subscriptionSummary.allowedFeatures.includes(selectedFeatureId);
  }, [
    isAuthenticated,
    subscriptionLoading,
    subscriptionSummary,
    selectedFeatureId,
  ]);
  const shouldShowCookieNotice =
    !GA_TEST_BYPASS_COOKIE_CONSENT && isCookieConsentReady && !hasConsent;
  const trackedView = getTrackedViewName(view);
  const trackedPath =
    view === "web"
      ? workspacePathForFeature(selectedFeatureId)
      : getTrackedPath(view);
  const workspaceBanner = useMemo(() => getCmsWorkspaceBanner(cms), [cms]);
  const serverAnalyticsEnabled = site.analyticsEnabled !== false;

  useGAPageTracking({
    enabled:
      GA_TEST_BYPASS_COOKIE_CONSENT || (hasConsent && isCookieConsentReady),
  });

  useEffect(() => {
    if (workspaceFeatures.length === 0) {
      return;
    }
    if (!workspaceFeatures.some((f) => f.id === selectedFeatureId)) {
      const first = workspaceFeatures[0]!.id;
      setSelectedFeatureId(first);
      setActiveSidebar(first);
    }
  }, [workspaceFeatures, selectedFeatureId]);

  useEffect(() => {
    if (persistWorkspaceSkipRef.current) {
      persistWorkspaceSkipRef.current = false;
      return;
    }
    if (view !== "web" || contentPanel !== "tool") {
      return;
    }
    persistWorkspaceTool(selectedFeatureId);
  }, [view, contentPanel, selectedFeatureId]);

  useAnalyticsTracking({
    enabled: GA_TEST_BYPASS_COOKIE_CONSENT || hasConsent,
    serverAnalyticsEnabled,
    view: trackedView,
    path: trackedPath,
    language,
    accessToken,
  });

  useErrorLogging({
    language,
    accessToken,
  });

  function showToast(type: ToastType, title: string, detail: string) {
    // Global toast ile mesajı viewport'ta sabit katmanda gösterir; scroll konumundan bağımsızdır.
    // Uzun işlemlerde yükleme, başarı ve hata geri bildiriminin tek giriş noktasıdır.
    // Otomatik kapanma süresi veya temizleme eksik kalırsa kullanıcı eski uyarıda takılı kalabilir.
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ type, title, detail });
    if (type !== "loading") {
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 9000);
    }
  }

  function clearToast() {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const navigateToDashboardAfterOAuth = useCallback(
    async (loggedInUser: AuthUser) => {
      const raw =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(SESSION_POST_OAUTH_REDIRECT_KEY)
          : null;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(SESSION_POST_OAUTH_REDIRECT_KEY);
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      const qs = url.searchParams.toString();

      if (
        raw === SESSION_POST_OAUTH_ADMIN_VALUE &&
        loggedInUser.role === "ADMIN"
      ) {
        url.pathname = "/admin";
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
        );
        setView("admin");
        return;
      }

      if (
        raw === SESSION_POST_OAUTH_ADMIN_VALUE &&
        loggedInUser.role !== "ADMIN"
      ) {
        await logout();
        url.pathname = "/";
        window.history.replaceState(
          {},
          "",
          `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
        );
        setSelectedFeatureId("split");
        setActiveSidebar("split");
        setContentPanel("tool");
        setView("landing");
        return;
      }

      url.pathname = workspacePathForFeature("split");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`,
      );
      setSelectedFeatureId("split");
      setActiveSidebar("split");
      setContentPanel("tool");
      setView("web");
    },
    [logout],
  );

  useEffect(() => {
    if (view !== "web" || !isAuthenticated) {
      return;
    }
    const IDLE_MS = 30 * 60 * 1000;
    let timeoutId = 0;
    const arm = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        clearNbResumeProcess();
        clearSession();
        setView("landing");
        window.history.replaceState({}, "", "/");
        showToastRef.current(
          "info",
          language === "tr" ? "Oturum sonlandı" : "Session ended",
          language === "tr"
            ? "Uzun süre işlem yapılmadığı için güvenlik nedeniyle çıkış yapıldı."
            : "You were signed out after a period of inactivity.",
        );
      }, IDLE_MS);
    };
    arm();
    const events = [
      "pointerdown",
      "keydown",
      "scroll",
      "click",
      "touchstart",
    ] as const;
    const opts: AddEventListenerOptions = { passive: true };
    for (const e of events) {
      window.addEventListener(e, arm, opts);
    }
    return () => {
      window.clearTimeout(timeoutId);
      for (const e of events) {
        window.removeEventListener(e, arm);
      }
    };
  }, [view, isAuthenticated, clearSession, language]);

  const disposeToolProgressSuccess = useCallback(() => {
    toolProgressDisposeRef.current?.();
    toolProgressDisposeRef.current = null;
    setToolProgressSuccess(null);
  }, []);

  const dismissToolSuccessBar = useCallback(() => {
    clearNbResumeProcess();
    disposeToolProgressSuccess();
  }, [disposeToolProgressSuccess]);

  useEffect(() => {
    toolProgressSuccessRef.current = toolProgressSuccess;
  }, [toolProgressSuccess]);

  const persistNbResumeSnapshot = useCallback(() => {
    if (!user?.id) {
      return;
    }
    const s = toolProgressSuccessRef.current;
    const gd = s?.gatedDownload;
    if (!gd || (!gd.resultId && !gd.mergeJobId)) {
      return;
    }
    const requiredCredits = 1;
    const payload: NbResumeProcessV1 = {
      v: 1,
      userId: user.id,
      toolId: gd.toolId,
      fileName: s.filename,
      featureTitle: s.featureTitle,
      fallbackName: gd.fallbackName,
      resultId: gd.resultId,
      mergeJobId: gd.mergeJobId,
      requiredCredits,
      downloadUrl: buildResumeDownloadUrl(
        gd.toolId,
        gd.resultId,
        gd.mergeJobId,
      ),
      timestamp: Date.now(),
    };
    saveNbResumeProcess(payload);
  }, [user?.id]);

  const resetForm = useCallback((clearInputValue: boolean) => {
    // Modül değişimi veya işlem sonrası dosya listesi, parola ve sayfa metnini tek yerden sıfırlar.
    // Önceki seçimlerin yeni modüle sızmasını önlemek için merkezi sıfırlama gerekir.
    // Alanlar eksik temizlenirse kullanıcı yanlış modülde eski dosya ile gönderim deneyebilir.
    setUploads([]);
    setPassword("");
    setInputPassword("");
    setPagesText("");
    setPagesError("");
    setDeletePagesText("");
    setDeletePagesError("");
    setRotateDeg("90");
    setRotatePagesOnly("");
    setOrganizePageOrder([]);
    setRotatePageRotations({});
    setPageVisualModalOpen(false);
    splitVisualAutoOpenedForUploadId.current = null;
    setUnlockOpenPassword("");
    setWatermarkPhrase("TASLAK");
    setWatermarkOpacity("0.15");
    setPageNumStart("1");
    setPageNumPos("footer");
    setPageNumFmt("plain");
    setCompressQuality("auto");
    setPdfToImgFmt("jpg");
    setHtmlToPdfMode("url");
    setHtmlToPdfUrl("https://");
    setHtmlToPdfRaw("<html><body><p>Merhaba</p></body></html>");
    setSplitMode("single");
    setOutputPassword("");
    setMergePointerDraggingId(null);
    setMergeDragOverIndex(null);
    mergeDragHoverIndexRef.current = null;
    const pst = mergePointerActiveRef.current;
    if (pst?.ghost.parentNode) {
      pst.ghost.parentNode.removeChild(pst.ghost);
    }
    mergePointerActiveRef.current = null;
    if (clearInputValue && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  function setUploadPassword(targetId: string, value: string) {
    setUploads((current) =>
      current.map((item) =>
        item.id === targetId
          ? { ...item, password: value, mergePasswordVerified: false }
          : item,
      ),
    );
  }

  async function verifyMergeFilePassword(itemId: string) {
    const item = uploads.find((u) => u.id === itemId);
    if (!item?.encrypted) {
      return;
    }
    const pwd = item.password.trim();
    const L = ws(language);
    if (!pwd) {
      showToast(
        "error",
        language === "tr" ? "Parola gerekli" : "Password required",
        language === "tr"
          ? "Önce bu dosya için parolayı girin."
          : "Enter the password for this file first.",
      );
      return;
    }
    setMergeVerifyingId(itemId);
    try {
      const result = await withPdfInspectTimeout(
        inspectPdf(item.file, pwd, accessToken),
        PDF_INSPECT_TIMEOUT_MS,
      );
      const errRaw = (result.inspect_error ?? "").trim();
      const looksLikePasswordIssue =
        item.encrypted &&
        errRaw.length > 0 &&
        /password|parola|şifre|incorrect|wrong|authenticate|decrypt|aes|crypt/i.test(
          errRaw,
        );
      const ok =
        typeof result.page_count === "number" &&
        result.page_count > 0 &&
        !errRaw;

      setUploads((cur) =>
        cur.map((u) =>
          u.id === itemId ? { ...u, mergePasswordVerified: ok } : u,
        ),
      );

      if (ok) {
        return;
      }

      const serverUnreachableDetail =
        language === "tr"
          ? "Sunucudan geçerli yanıt alınamadı. Bağlantıyı kontrol edip yeniden deneyin."
          : "No valid response from the server. Check your connection and try again.";
      const detail = looksLikePasswordIssue
        ? errRaw.length > 280
          ? `${errRaw.slice(0, 280)}…`
          : errRaw
        : errRaw || serverUnreachableDetail;

      showToast(
        "error",
        looksLikePasswordIssue
          ? language === "tr"
            ? "Parola doğrulanamadı"
            : "Invalid password"
          : language === "tr"
            ? "PDF denetimi başarısız"
            : "PDF check failed",
        looksLikePasswordIssue ? L.mergePasswordWrong : detail,
      );
    } catch (err) {
      setUploads((cur) =>
        cur.map((u) =>
          u.id === itemId ? { ...u, mergePasswordVerified: false } : u,
        ),
      );
      if (err instanceof Error && err.message === "pdf_inspect_timeout") {
        showToast(
          "error",
          language === "tr"
            ? "PDF denetimi zaman aşımı"
            : "PDF check timed out",
          language === "tr"
            ? "PDF denetimi uzun sürdü veya yanıt kesildi. Bağlantıyı kontrol edin veya dosyayı yeniden deneyin."
            : "PDF check took too long or stalled. Check your connection or try the file again.",
        );
      } else {
        showToast(
          "error",
          language === "tr" ? "PDF denetimi başarısız" : "PDF check failed",
          friendlyOperationFailedMessage(language),
        );
      }
    } finally {
      setMergeVerifyingId(null);
    }
  }

  function removeUpload(targetId: string) {
    setUploads((current) => current.filter((item) => item.id !== targetId));
    setPagesError("");
  }

  function clearAllUploads() {
    setUploads([]);
    setPagesError("");
    setMergePointerDraggingId(null);
    setMergeDragOverIndex(null);
    mergeDragHoverIndexRef.current = null;
    const st = mergePointerActiveRef.current;
    if (st?.ghost.parentNode) {
      st.ghost.parentNode.removeChild(st.ghost);
    }
    mergePointerActiveRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function moveUploadUp(index: number) {
    if (index <= 0) {
      return;
    }
    const id = uploads[index]?.id;
    moveUpload(index, index - 1);
    if (id) {
      setMergeSnapId(id);
      window.setTimeout(() => setMergeSnapId(null), 420);
    }
  }

  function moveUploadDown(index: number) {
    if (index < 0 || index >= uploads.length - 1) {
      return;
    }
    const id = uploads[index]?.id;
    moveUpload(index, index + 1);
    if (id) {
      setMergeSnapId(id);
      window.setTimeout(() => setMergeSnapId(null), 420);
    }
  }

  function moveUpload(fromIndex: number, toIndex: number) {
    // Birleştirme modunda dosya sırasını yeniden düzenler; API'ye giden sıra bu diziyle aynıdır.
    // Yanlış sıra yanlış PDF birleşimine yol açtığından mutasyon tek yardımcıda toplanır.
    // İndeks kontrolleri kaldırılırsa boş dizide splice hatası veya öğe kaybı oluşabilir.
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }
    setUploads((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleMergeRowPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    index: number,
    itemId: string,
  ) {
    if (selectedFeature.id !== "merge") {
      return;
    }
    const el = event.target as HTMLElement;
    if (el.closest("button, input, textarea, a, select")) {
      return;
    }
    event.preventDefault();
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    setMergeDragSlotPx(Math.round(rect.height + 12));
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.style.boxSizing = "border-box";
    ghost.style.position = "fixed";
    ghost.style.left = `${event.clientX - offsetX}px`;
    ghost.style.top = `${event.clientY - offsetY}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.zIndex = "10000";
    ghost.style.pointerEvents = "none";
    ghost.style.opacity = "0.96";
    ghost.style.boxShadow = "0 22px 56px rgba(0, 0, 0, 0.52)";
    ghost.querySelectorAll("button, input").forEach((node) => {
      (node as HTMLElement).style.visibility = "hidden";
    });
    document.body.appendChild(ghost);
    mergePointerActiveRef.current = {
      sourceIndex: index,
      itemId,
      pointerId: event.pointerId,
      offsetX,
      offsetY,
      ghost,
      cardEl: card as HTMLDivElement,
    };
    mergeDragHoverIndexRef.current = index;
    setMergeDragOverIndex(index);
    setMergePointerDraggingId(itemId);
    try {
      (card as HTMLDivElement).setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    const onMove = (ev: PointerEvent) => {
      const st = mergePointerActiveRef.current;
      if (!st || ev.pointerId !== st.pointerId) {
        return;
      }
      ev.preventDefault();
      st.ghost.style.left = `${ev.clientX - st.offsetX}px`;
      st.ghost.style.top = `${ev.clientY - st.offsetY}px`;
      const listEl = mergeListScrollRef.current;
      if (listEl) {
        const r = listEl.getBoundingClientRect();
        const margin = 56;
        if (ev.clientY < r.top + margin) {
          listEl.scrollTop = Math.max(0, listEl.scrollTop - 16);
        } else if (ev.clientY > r.bottom - margin) {
          listEl.scrollTop = Math.min(
            listEl.scrollHeight - listEl.clientHeight,
            listEl.scrollTop + 16,
          );
        }
      }
      const hover = mergePointerYToIndex(
        ev.clientY,
        mergeListScrollRef.current,
      );
      mergeDragHoverIndexRef.current = hover;
      setMergeDragOverIndex(hover);
    };

    const onUp = (ev: PointerEvent) => {
      const st = mergePointerActiveRef.current;
      if (!st || ev.pointerId !== st.pointerId) {
        return;
      }
      try {
        st.cardEl.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (st.ghost.parentNode) {
        st.ghost.parentNode.removeChild(st.ghost);
      }
      mergePointerActiveRef.current = null;
      const to = mergeDragHoverIndexRef.current ?? st.sourceIndex;
      mergeDragHoverIndexRef.current = null;
      setMergeDragOverIndex(null);
      setMergePointerDraggingId(null);
      if (to !== st.sourceIndex && to >= 0) {
        moveUpload(st.sourceIndex, to);
        setMergeSnapId(st.itemId);
        window.setTimeout(() => setMergeSnapId(null), 420);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  async function onFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    await handleNewFiles(selectedFiles);
    event.currentTarget.value = "";
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  const refreshSubscriptionState = useCallback(async () => {
    if (!accessToken || !isAuthenticated) {
      return;
    }

    const summary = await fetchSubscriptionSummary(accessToken);
    setSubscriptionSummary(summary);
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user) {
      setUserBalance(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    fetchUserBalance(accessToken, {
      userId: user.id,
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
    })
      .then((b) => { if (!cancelled) setUserBalance(b); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBalanceLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, accessToken, user?.id, user?.role]);

  /** After blob download + audited server ACK — clear drafts/uploads; keep user on the active tool (no jump to Split/home). */
  const applyWorkspaceCleanSlateAfterDownload = useCallback(
    (keepToolId: FeatureKey) => {
      clearNbResumeProcess();
      disposeToolProgressSuccess();
      persistWorkspaceSkipRef.current = true;
      clearPersistedWorkspaceTool();
      clearPdfWorkspaceSplitDraftsFromLocalStorage();
      clearWorkspaceSessionStoragePrefixes();
      setSelectedFeatureId(keepToolId);
      setActiveSidebar(keepToolId);
      setContentPanel("tool");
      try {
        const u = new URL(window.location.href);
        u.pathname =
          workspacePathForFeature(keepToolId).replace(/\/$/, "") || "/";
        window.history.replaceState(
          {},
          "",
          `${u.pathname}${u.search ? `?${u.searchParams.toString()}` : ""}${u.hash}`,
        );
      } catch {
        /* ignore */
      }
      resetForm(true);
      setMergeJob(null);
      setSubmitting(false);
      persistWorkspaceTool(keepToolId);
      setWorkspaceSlateNonce((n) => n + 1);
    },
    [disposeToolProgressSuccess, resetForm],
  );

  /**
   * Gated indirme: ``GET /api/pdf/result/{id}/download`` sunucuda ``entitlement_consume`` sonrası blob akışı.
   * ``download_logs`` satırı gövde okunmadan hemen önce PENDING; teslimattan sonra ACK.
   */
  const runGatedDownloadWithFilename = useCallback(
    async (
      resultId: string,
      serverFallbackName: string,
      clientFileName: string,
      toolId: FeatureKey,
    ) => {
      const flightKey = `r:${resultId}`;
      if (gatedDownloadInFlightKeysRef.current.has(flightKey)) {
        return;
      }
      gatedDownloadInFlightKeysRef.current.add(flightKey);
      try {
        let pendingLogId: string | null = null;
        const outcome = await downloadResult(
          resultId,
          serverFallbackName,
          accessToken,
          {
            clientDownloadName: clientFileName,
            onBeforeReadBody: accessToken
              ? async () => {
                  try {
                    const row = await createDownloadLog(accessToken, {
                      resultId,
                      toolId,
                    });
                    pendingLogId = row.id;
                  } catch {
                    /* attribution optional */
                  }
                }
              : undefined,
          },
        );
        if (outcome.status === "payment_required") {
          setUpgradeModalOpen(true);
          return;
        }
        if (outcome.status === "forbidden") {
          window.alert(
            language === "tr"
              ? "Bu dosyaya erişim yetkiniz yok."
              : "You don't have access to this file.",
          );
          return;
        }
        if (accessToken && pendingLogId) {
          try {
            await ackDownloadLog(accessToken, pendingLogId);
          } catch {
            /* optional */
          }
        }
        applyWorkspaceCleanSlateAfterDownload(toolId);
        showToast(
          "success",
          language === "tr" ? "İndirme tamamlandı" : "Download complete",
          clientFileName,
        );
        void refreshSubscriptionState();
      } catch (e: unknown) {
        if (isUserAbortError(e)) {
          return;
        }
        showToast(
          "error",
          language === "tr" ? "İndirme başarısız" : "Download failed",
          friendlyOperationFailedMessage(language),
        );
      } finally {
        gatedDownloadInFlightKeysRef.current.delete(flightKey);
      }
    },
    [
      accessToken,
      applyWorkspaceCleanSlateAfterDownload,
      language,
      refreshSubscriptionState,
      showToast,
    ],
  );

  const queueGatedDownload = useCallback(
    (resultId: string, fallbackName: string, toolId: FeatureKey) => {
      const name = sanitizeDownloadBasename(fallbackName, "download.pdf");
      void runGatedDownloadWithFilename(resultId, fallbackName, name, toolId);
    },
    [runGatedDownloadWithFilename],
  );

  /** Merge indirmesi: GET başında sunucu ``entitlement_consume`` (merge maliyeti). */
  const runMergeJobGatedDownloadWithFilename = useCallback(
    async (
      jobId: string,
      serverFallbackName: string,
      clientFileName: string,
    ) => {
      const flightKey = `m:${jobId}`;
      if (gatedDownloadInFlightKeysRef.current.has(flightKey)) {
        return;
      }
      gatedDownloadInFlightKeysRef.current.add(flightKey);
      try {
        let pendingLogId: string | null = null;
        const dl = await downloadMergeJob(
          jobId,
          serverFallbackName,
          accessToken,
          {
            onBeforeReadBody: accessToken
              ? async () => {
                  try {
                    const row = await createDownloadLog(accessToken, {
                      resultId: jobId,
                      toolId: "merge",
                    });
                    pendingLogId = row.id;
                  } catch {
                    /* noop */
                  }
                }
              : undefined,
          },
        );
        if (accessToken && pendingLogId) {
          try {
            await ackDownloadLog(accessToken, pendingLogId);
          } catch {
            /* noop */
          }
        }
        applyWorkspaceCleanSlateAfterDownload("merge");
        showToast(
          "success",
          language === "tr" ? "İndirme tamamlandı" : "Download complete",
          clientFileName,
        );
        void refreshSubscriptionState();
        if (accessToken && user) {
          const balanceCtx = {
            userId: user.id,
            role:
              user.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
          };
        }
        dl.dispose?.();
        toolProgressDisposeRef.current = null;
      } catch (e: unknown) {
        if (isUserAbortError(e)) {
          return;
        }
        if (e instanceof EntitlementPaymentRequiredError) {
          setUpgradeModalOpen(true);
          return;
        }
        showToast(
          "error",
          language === "tr" ? "İndirme başarısız" : "Download failed",
          friendlyOperationFailedMessage(language),
        );
      } finally {
        gatedDownloadInFlightKeysRef.current.delete(flightKey);
      }
    },
    [
      accessToken,
      applyWorkspaceCleanSlateAfterDownload,
      language,
      refreshSubscriptionState,
      showToast,
    ],
  );

  const queueMergeGatedDownload = useCallback(
    (jobId: string, fallbackName: string) => {
      const name = sanitizeDownloadBasename(fallbackName, "download.pdf");
      void runMergeJobGatedDownloadWithFilename(jobId, fallbackName, name);
    },
    [runMergeJobGatedDownloadWithFilename],
  );

  const openConversionUpgradeModalManual = useCallback(() => {
    setUpgradeModalOpen(true);
  }, []);

  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    if (path === "/login-error") {
      return;
    }
    /** Fake PSP return URL: confirm flow runs in a dedicated effect; do not strip `sessionId` early. */
    if (path === "/fake-payment/success") {
      return;
    }
    if (path === "/login-success") {
      return;
    }
    if (view === "web" && (!isAuthenticated || isRestoring)) {
      return;
    }
    if (
      view === "admin" &&
      (!isAuthenticated || isRestoring || user?.role !== "ADMIN")
    ) {
      return;
    }
    if (view === "admin_login" && isAuthenticated && !isRestoring) {
      return;
    }
    let next: string;
    if (view === "admin") {
      next = "/admin";
    } else if (view === "web") {
      next = workspacePathForFeature(selectedFeatureId);
    } else if (view === "admin_login") {
      next = "/admin-login";
    } else {
      next = getTrackedPath(view);
    }
    const current = path;
    const normalizedNext = next.replace(/\/$/, "") || "/";
    if (current !== normalizedNext) {
      const sp = new URLSearchParams(window.location.search);
      const keep = new URLSearchParams();
      for (const key of [
        "payment",
        "oauth_error",
        "email_verified",
        "lang",
      ] as const) {
        const v = sp.get(key);
        if (v !== null) {
          keep.set(key, v);
        }
      }
      const qs = keep.toString();
      window.history.replaceState(
        {},
        "",
        `${next}${qs ? `?${qs}` : ""}${window.location.hash}`,
      );
    }
  }, [view, isAuthenticated, isRestoring, user?.role, selectedFeatureId]);

  useEffect(() => {
    if (view !== "admin" || isRestoring || !isAuthenticated) {
      return;
    }
    if (user?.role !== "ADMIN") {
      setView("web");
      window.history.replaceState(
        {},
        "",
        workspacePathForFeature(selectedFeatureId),
      );
    }
  }, [view, isRestoring, isAuthenticated, user?.role, selectedFeatureId]);

  useEffect(() => {
    if (!isAuthenticated || isRestoring || !accessToken) {
      return;
    }
    const url = new URL(window.location.href);
    const payment = url.searchParams.get("payment");
    if (!payment) {
      return;
    }
    url.searchParams.delete("payment");
    window.history.replaceState(
      {},
      "",
      url.pathname +
        (url.search ? `?${url.searchParams.toString()}` : "") +
        url.hash,
    );

    if (payment === "success") {
      void (async () => {
        await refreshSession();
        await refreshSubscriptionState();
        showToast(
          "success",
          language === "tr" ? "Ödeme tamamlandı" : "Payment complete",
          language === "tr"
            ? "Hesabınız güncellendi."
            : "Your account has been updated.",
        );
      })();
      return;
    }

    if (payment === "failed") {
      showToast(
        "error",
        language === "tr" ? "Ödeme başarısız" : "Payment failed",
        language === "tr"
          ? "İşlem tamamlanamadı veya iptal edildi."
          : "The transaction could not be completed or was cancelled.",
      );
    }
  }, [
    isAuthenticated,
    isRestoring,
    accessToken,
    refreshSession,
    refreshSubscriptionState,
    language,
    user,
  ]);

  useEffect(() => {
    if (view === "register") {
      setRegistrationSuccessBanner(null);
    }
  }, [view]);

  useEffect(() => {
    toolRunAbortRef.current?.abort();
    toolRunAbortRef.current = null;
    mergeFlowAbortRef.current?.abort();
    mergeFlowAbortRef.current = null;
    resetForm(true);
    setMergeJob(null);
    setSubmitting(false);
    setToolRunStartedAt(null);
    setToolRunFileBytes(0);
    clearToast();
    if (suppressDisposeSuccessOnFeatureChangeRef.current) {
      suppressDisposeSuccessOnFeatureChangeRef.current = false;
    } else {
      disposeToolProgressSuccess();
    }
  }, [selectedFeatureId, disposeToolProgressSuccess]);

  useEffect(() => {
    subscriptionSummaryRef.current = subscriptionSummary;
  }, [subscriptionSummary]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /** PSP / pricing redirect sonrası: kredi yeterliyse kayıtlı çıktıyı geri yükle ve ilgili araca yönlendir. */
  useEffect(() => {
    if (
      view !== "web" ||
      !isAuthenticated ||
      !user?.id ||
      !accessToken?.trim()
    ) {
      return;
    }

    const payload = readNbResumeProcess();
    if (!payload) {
      return;
    }
    if (payload.userId !== user.id) {
      clearNbResumeProcess();
      return;
    }
    if (isNbResumeStale(payload)) {
      clearNbResumeProcess();
      return;
    }
    if (!canResumeAfterPayment(payload, null)) {
      return;
    }
    if (lastRestoredResumeTsRef.current === payload.timestamp) {
      return;
    }

    let cancelled = false;

    void (async () => {
      disposeToolProgressSuccess();

      let thumbnailBlobUrl: string | null = null;
      try {
        if (payload.mergeJobId) {
          thumbnailBlobUrl = await fetchMergeJobHeroPreviewBlobUrl(
            payload.mergeJobId,
            accessToken,
          );
        } else if (payload.resultId) {
          thumbnailBlobUrl = await fetchResultThumbnailBlobUrl(
            payload.resultId,
            accessToken,
          );
        }
      } catch {
        thumbnailBlobUrl = null;
      }

      if (cancelled) {
        if (thumbnailBlobUrl) {
          URL.revokeObjectURL(thumbnailBlobUrl);
        }
        return;
      }

      if (selectedFeatureId !== payload.toolId) {
        suppressDisposeSuccessOnFeatureChangeRef.current = true;
        setSelectedFeatureId(payload.toolId);
      }
      setActiveSidebar(payload.toolId);
      setContentPanel("tool");

      try {
        const u = new URL(window.location.href);
        u.pathname =
          workspacePathForFeature(payload.toolId).replace(/\/$/, "") || "/";
        window.history.replaceState(
          {},
          "",
          `${u.pathname}${u.search ? `?${u.searchParams.toString()}` : ""}${u.hash}`,
        );
      } catch {
        /* ignore */
      }

      toolProgressDisposeRef.current?.();
      toolProgressDisposeRef.current = thumbnailBlobUrl
        ? () => URL.revokeObjectURL(thumbnailBlobUrl as string)
        : null;

      setToolProgressSuccess({
        filename: payload.fileName,
        featureTitle: payload.featureTitle,
        gatedDownload: {
          toolId: payload.toolId,
          resultId: payload.resultId,
          mergeJobId: payload.mergeJobId,
          fallbackName: payload.fallbackName,
          thumbnailBlobUrl,
          saasGating: null,
        },
      });

      lastRestoredResumeTsRef.current = payload.timestamp;

      showToastRef.current(
        "success",
        language === "tr"
          ? "Ödemeniz sonrası indirmeye devam edebilirsiniz"
          : "Your download is ready — continue below",
        language === "tr"
          ? "Dosyanız hazır; aşağıdan indirebilirsiniz."
          : "Your file is ready to download.",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    view,
    isAuthenticated,
    user?.id,
    accessToken,
    language,
    disposeToolProgressSuccess,
    selectedFeatureId,
  ]);

  const offerPostRunMonetizationHintAfterSuccess = useCallback(
    (_gating?: SaaSGating | null) => {
      // No-op: credit popup removed
    },
    [],
  );

  useEffect(() => {
    mergeJobLatestRef.current = mergeJob;
  }, [mergeJob]);

  useEffect(() => {
    if (
      selectedFeatureId !== "merge" ||
      !mergeJob?.id ||
      mergeJob.id === MERGE_JOB_PENDING_ID
    ) {
      return;
    }

    const jobId = mergeJob.id;

    if (mergePollingActiveJobIdRef.current !== jobId) {
      mergePollingActiveJobIdRef.current = jobId;
      mergePollHandledRef.current = false;
      mergePollingStartedMsRef.current = Date.now();
    }

    let active = true;
    const fallbackName = selectedFeature.fallbackFilename;

    const tick = async () => {
      if (
        !active ||
        mergePollHandledRef.current ||
        mergePollInFlightRef.current
      ) {
        return;
      }

      const M = ws(language);
      const pollSignal = mergeFlowAbortRef.current?.signal;
      mergePollInFlightRef.current = true;
      try {
        const mjSnap = mergeJobLatestRef.current;
        if (
          mjSnap &&
          mjSnap.id === jobId &&
          !mergePollHandledRef.current &&
          (mjSnap.status === "queued" || mjSnap.status === "running") &&
          Date.now() - mergePollingStartedMsRef.current > MERGE_WATCHDOG_MS
        ) {
          mergePollHandledRef.current = true;
          showToast(
            "error",
            language === "tr" ? "İşlem zaman aşımı" : "Operation timed out",
            language === "tr"
              ? "Birleştirme çok uzun sürdü veya yanıt kesildi. Bağlantıyı kontrol edin veya daha sonra yeniden deneyin."
              : "The merge took too long or the connection stalled. Check your connection or try again.",
          );
          setSubmitting(false);
          setMergeJob(null);
          mergePollInFlightRef.current = false;
          return;
        }
        const nextStatus = await fetchMergeJob(jobId, accessToken, {
          signal: pollSignal,
        });
        if (!active || mergePollHandledRef.current) {
          return;
        }

        setMergeJob(nextStatus);

        if (nextStatus.status === "failed") {
          const serverDetail =
            typeof nextStatus.error === "string" ? nextStatus.error.trim() : "";
          showToast(
            "error",
            M.mergeToastFailedTitle,
            serverDetail ||
              (language === "tr"
                ? "Birleştirme tamamlanamadı."
                : "The merge could not be completed."),
          );
          setSubmitting(false);
          mergePollHandledRef.current = true;
          return;
        }

        if (nextStatus.status === "cancelled") {
          mergePollHandledRef.current = true;
          setMergeJob(null);
          setSubmitting(false);
          showToast("info", M.toolRunCancel, M.toolRunCancelledInfo);
          return;
        }

        if (nextStatus.status === "completed") {
          mergePollHandledRef.current = true;
          if (!active) {
            return;
          }
          disposeToolProgressSuccess();
          toolProgressDisposeRef.current = null;
          resetForm(true);
          setMergeJob(null);
          setSubmitting(false);

          let thumbnailBlobUrl: string | null = null;
          if (accessToken?.trim()) {
            try {
              thumbnailBlobUrl = await fetchMergeJobHeroPreviewBlobUrl(
                jobId,
                accessToken,
                { signal: pollSignal },
              );
            } catch {
              thumbnailBlobUrl = null;
            }
          }
          if (thumbnailBlobUrl) {
            toolProgressDisposeRef.current = () => {
              URL.revokeObjectURL(thumbnailBlobUrl as string);
            };
          }

          setToolProgressSuccess({
            filename: fallbackName,
            featureTitle: selectedFeature.title,
            gatedDownload: {
              toolId: "merge",
              mergeJobId: jobId,
              fallbackName,
              thumbnailBlobUrl,
              saasGating: mergeSaasGatingRef.current,
            },
          });
          showToast(
            "success",
            language === "tr" ? "İşlem tamamlandı" : "Process complete",
            language === "tr"
              ? "İndirmek için aşağıdaki düğmeyi kullanın."
              : "Use the button below to download.",
          );
          offerPostRunMonetizationHintAfterSuccess(
            mergeSaasGatingRef.current ?? null,
          );
          void refreshSubscriptionState();
        }
      } catch (error) {
        if (!active) {
          return;
        }
        if (isUserAbortError(error)) {
          setSubmitting(false);
          mergePollHandledRef.current = true;
          setMergeJob(null);
          return;
        }
        if (error instanceof MergeJobNotFoundError) {
          setSubmitting(false);
          mergePollHandledRef.current = true;
          setMergeJob(null);
          showToast(
            "info",
            M.mergeJobSessionLostTitle,
            M.mergeJobSessionLostDetail,
          );
          return;
        }
        const pollFailDetail =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : M.mergeToastPollErrorDetail;
        showToast("error", M.mergeToastPollErrorTitle, pollFailDetail);
        setSubmitting(false);
        mergePollHandledRef.current = true;
      } finally {
        mergePollInFlightRef.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 700);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    mergeJob?.id,
    selectedFeatureId,
    selectedFeature.fallbackFilename,
    selectedFeature.title,
    language,
    disposeToolProgressSuccess,
    resetForm,
    showToast,
    offerPostRunMonetizationHintAfterSuccess,
    refreshSubscriptionState,
    accessToken,
  ]);

  useEffect(() => {
    if (selectedFeatureId !== "split") {
      return;
    }
    const primary = uploads[0];
    if (!primary?.file || !primary.encrypted) {
      return;
    }
    const pwd = password.trim();
    if (!pwd) {
      setUploads((cur) => {
        if (!cur[0]) {
          return cur;
        }
        if (cur[0].pageCount === null) {
          return cur;
        }
        return cur.map((u, i) => (i === 0 ? { ...u, pageCount: null } : u));
      });
      return;
    }
    const timer = window.setTimeout(() => {
      void withPdfInspectTimeout(
        inspectPdf(primary.file, pwd, accessToken),
        PDF_INSPECT_TIMEOUT_MS,
      )
        .then((result) => {
          setUploads((cur) =>
            cur.map((u, i) =>
              i === 0 ? { ...u, pageCount: result.page_count ?? null } : u,
            ),
          );
        })
        .catch(() => {
          /* Parola denemesi / zaman aşımı; sessiz kal — kullanıcı yeni şifre girsin */
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    password,
    selectedFeatureId,
    uploads[0]?.id,
    uploads[0]?.encrypted,
    language,
    accessToken,
  ]);

  useEffect(() => {
    return () => {
      clearToast();
    };
  }, []);

  useEffect(() => {
    if (!isRestoring && view === "web" && !isAuthenticated) {
      setView("login");
    }
  }, [isAuthenticated, isRestoring, view]);


  /**
   * Completes redirect-based fake checkout: user lands on
   * `/fake-payment/success?sessionId=...`, we confirm server-side, refresh
   * balance, then normalize the URL to `/tools/…`.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    if (path !== "/fake-payment/success") {
      fakePaymentSuccessHandledRef.current = false;
      return;
    }
    if (!isAuthenticated || !accessToken || isRestoring || !user) {
      return;
    }
    if (fakePaymentSuccessHandledRef.current) {
      return;
    }
    const sessionId = new URLSearchParams(window.location.search).get(
      "sessionId",
    );
    if (!sessionId) {
      fakePaymentSuccessHandledRef.current = true;
      showToast(
        "error",
        language === "tr" ? "Oturum bilgisi eksik" : "Missing session",
        language === "tr"
          ? "Geçersiz ödeme dönüş adresi."
          : "Invalid payment return URL.",
      );
      window.history.replaceState({}, "", workspacePathForFeature("split"));
      return;
    }
    fakePaymentSuccessHandledRef.current = true;
    void (async () => {
      try {
        const result = await confirmFakeCheckout(accessToken, sessionId);
        if (
          "creditsGranted" in result &&
          (result.product === "PRO" || result.product === "BUSINESS")
        ) {
          await refreshSession().catch(() => null);
          await refreshSubscriptionState();
        }
        if ("alreadyConfirmed" in result && result.alreadyConfirmed) {
          showToast(
            "success",
            language === "tr" ? "Zaten onaylandı" : "Already confirmed",
            language === "tr"
              ? "Bu ödeme daha önce tamamlandı."
              : "This payment was already completed.",
          );
        } else {
          showToast(
            "success",
            language === "tr" ? "Ödeme tamamlandı" : "Payment complete",
            language === "tr"
              ? "Hesabınız güncellendi."
              : "Your account has been updated.",
          );
        }
      } catch (error) {
        showToast(
          "error",
          language === "tr" ? "Onay başarısız" : "Confirm failed",
          error instanceof Error ? error.message : "",
        );
      } finally {
        window.history.replaceState({}, "", workspacePathForFeature("split"));
      }
    })();
  }, [
    isAuthenticated,
    accessToken,
    isRestoring,
    language,
    refreshSession,
    refreshSubscriptionState,
    user,
  ]);

  useEffect(() => {
    if (view !== "web") {
      return;
    }
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("lang") !== language) {
        u.searchParams.set("lang", language);
        window.history.replaceState(
          {},
          "",
          `${u.pathname}${u.search ? `?${u.searchParams.toString()}` : ""}${u.hash}`,
        );
      }
    } catch {
      /* ignore */
    }
  }, [view, language, selectedFeatureId]);

  useEffect(() => {
    if (view !== "admin_login" || isRestoring || !isAuthenticated || !user) {
      return;
    }
    if (user.role === "ADMIN") {
      setView("admin");
      window.history.replaceState({}, "", "/admin");
      return;
    }
    let cancelled = false;
    void (async () => {
      await logout();
      if (cancelled) {
        return;
      }
      setView("landing");
      window.history.replaceState({}, "", "/");
    })();
    return () => {
      cancelled = true;
    };
  }, [view, isRestoring, isAuthenticated, user, logout]);

  useEffect(() => {
    const onPopState = () => {
      if (typeof window === "undefined") {
        return;
      }
      const next = parseWorkspaceToolPath(window.location.pathname);
      if (next) {
        setSelectedFeatureId(next);
        setActiveSidebar(next);
        setContentPanel("tool");
        setView("web");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || !accessToken) {
      setSubscriptionSummary(null);
      return;
    }

    const authToken = accessToken;
    const authUser = user;

    let cancelled = false;
    let intervalId: number | undefined;

    async function loadSubscriptionBlock() {
      setSubscriptionLoading(true);
      try {
        const [summary, status] = await Promise.all([
          fetchSubscriptionSummary(authToken),
          fetchSubscriptionStatus(authToken),
        ]);
        if (cancelled) {
          return;
        }
        setSubscriptionSummary(summary);

        const adminProNavbar =
          authUser.role === "ADMIN" && status.plan === "PRO";
        const needsJwtRefresh =
          Boolean(status.plan_downgraded) ||
          (!adminProNavbar && status.plan !== authUser.plan);
        if (needsJwtRefresh) {
          const refreshed = await refreshSession();
          if (cancelled || !refreshed) {
            return;
          }
          const [nextSummary] = await Promise.all([
            fetchSubscriptionSummary(refreshed.accessToken),
          ]);
          if (!cancelled) {
            setSubscriptionSummary(nextSummary);
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.warn(
              "[subscription] load failed (will retry on next poll)",
              error,
            );
          }
        }
      } finally {
        if (!cancelled) {
          setSubscriptionLoading(false);
        }
      }
    }

    void loadSubscriptionBlock();
    intervalId = window.setInterval(() => {
      void loadSubscriptionBlock();
    }, 60_000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [accessToken, isAuthenticated, refreshSession, user?.id]);

  /*
   * The usage-warning toast (`usageWarningCode` / `strongUsageWarning` /
   * `softUsageWarning`) was driven by a retired quota system.
   * Credit state is surfaced via the balance chip instead; denial is
   * surfaced by the entitlement engine's 402 response on the next run.
   */

  const W = ws(language);
  const splitModeDescription =
    splitMode === "single"
      ? language === "tr"
        ? "Seçtiğiniz sayfalar tek bir PDF dosyası içinde birleştirilerek indirilecektir."
        : "Selected pages are merged into one downloadable PDF."
      : language === "tr"
        ? "Seçtiğiniz sayfalar ayrı PDF dosyaları olarak hazırlanıp ZIP ile indirilir."
        : "Selected pages are saved as separate PDFs inside a ZIP download.";

  const showSplitPasswordField =
    [
      "split",
      "pdf-to-word",
      "pdf-to-excel",
      "compress",
      "delete-pages",
      "rotate-pdf",
      "organize-pdf",
      "watermark",
      "page-numbers",
      "repair-pdf",
      "pdf-to-ppt",
      "pdf-to-image",
      "pdf-to-text",
      "flatten-pdf",
    ].includes(selectedFeature.id) &&
    uploads.length > 0 &&
    currentPdfIsEncrypted;
  const showUnlockPasswordField =
    selectedFeature.id === "unlock-pdf" && uploads.length > 0;
  const showEncryptSourcePasswordField =
    selectedFeature.id === "encrypt" &&
    uploads.length > 0 &&
    currentPdfIsEncrypted;
  const mergeHasMissingPasswords =
    selectedFeature.id === "merge" &&
    uploads.some(
      (item) =>
        item.encrypted &&
        (!item.password.trim() || !item.mergePasswordVerified),
    );
  const toolFilesStillInspecting =
    uploads.length > 0 &&
    uploads.some((u) => u.inspecting) &&
    pdfInspectionFeatures.includes(selectedFeatureId);
  const limitsizProActive = useMemo(
    () => isLimitsizProUnlimited(userBalance),
    [userBalance],
  );
  const premiumProcessingLane = Boolean(
    user?.role === "ADMIN" ||
    (subscriptionSummary &&
      (subscriptionSummary.currentPlan.name === "PRO" ||
        subscriptionSummary.currentPlan.name === "BUSINESS")),
  );

  const mergeProgressActive = Boolean(
    mergeJob &&
    selectedFeatureId === "merge" &&
    mergeJob.status !== "completed" &&
    mergeJob.status !== "cancelled",
  );
  const genericToolProgressActive =
    submitting &&
    selectedFeatureId !== "merge" &&
    view === "web" &&
    contentPanel === "tool";
  const showToolCancelButton = Boolean(
    view === "web" &&
    contentPanel === "tool" &&
    ((mergeProgressActive && mergeJob && mergeJob.status !== "failed") ||
      genericToolProgressActive),
  );
  const TOOLSuccessBarActive = Boolean(
    toolProgressSuccess && view === "web" && contentPanel === "tool",
  );
  const bottomToolProgressActive =
    mergeProgressActive || genericToolProgressActive || TOOLSuccessBarActive;
  const mergeProgressIndeterminate = Boolean(
    mergeJob &&
    (mergeJob.id === MERGE_JOB_PENDING_ID ||
      mergeJob.status === "queued" ||
      (mergeJob.status === "running" && mergeJob.percent < 1)),
  );
  const mergeEtaSeconds =
    mergeJob &&
    mergeJob.status === "running" &&
    mergeJob.percent >= 3 &&
    mergeJob.elapsed_seconds >= 2
      ? Math.round(
          (mergeJob.elapsed_seconds / mergeJob.percent) *
            (100 - mergeJob.percent),
        )
      : null;

  useEffect(() => {
    if (!genericToolProgressActive || toolRunStartedAt == null) {
      return;
    }
    const id = window.setInterval(() => setToolRunClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, [genericToolProgressActive, toolRunStartedAt]);

  const genericToolElapsedSec = useMemo(() => {
    if (toolRunStartedAt == null) {
      return 0;
    }
    return Math.floor((Date.now() - toolRunStartedAt) / 1000);
  }, [toolRunStartedAt, toolRunClock]);

  const genericToolEstimateSec = useMemo(() => {
    if (toolRunFileBytes <= 0) {
      return 90;
    }
    const mb = toolRunFileBytes / (1024 * 1024);
    const k =
      selectedFeatureId === "compress"
        ? 5.2
        : selectedFeatureId === "pdf-to-word" ||
            selectedFeatureId === "pdf-to-excel"
          ? 4.0
          : selectedFeatureId === "split"
            ? 2.4
            : selectedFeatureId === "encrypt"
              ? 3.2
              : 3.0;
    const estimateBase = Math.max(40, Math.min(1800, Math.round(mb * k + 22)));
    if (premiumProcessingLane) {
      return Math.max(35, Math.round(estimateBase * 0.85));
    }
    return estimateBase;
  }, [toolRunFileBytes, selectedFeatureId, premiumProcessingLane]);

  const genericToolFileMb = toolRunFileBytes / (1024 * 1024);
  const genericToolRemainingSec = Math.max(
    0,
    genericToolEstimateSec - genericToolElapsedSec,
  );
  const genericToolPercent = Math.min(
    99,
    Math.max(
      2,
      Math.round(
        (genericToolElapsedSec / Math.max(genericToolEstimateSec, 1)) * 100,
      ),
    ),
  );
  const genericProgressIndeterminate =
    genericToolProgressActive &&
    (premiumProcessingLane
      ? genericToolElapsedSec < 4 || genericToolPercent < 5
      : genericToolElapsedSec < 5 || genericToolPercent < 6);


  useEffect(() => {
    if (submitting) {
      setUpgradeNudgeLoadingHidden(false);
    }
  }, [submitting]);

  useEffect(() => {
    if (toolProgressSuccess) {
      setUpgradeNudgePostSuccessHidden(false);
    }
  }, [toolProgressSuccess]);


  const deleteWouldRemoveEveryPage = useMemo(() => {
    if (selectedFeature.id !== "delete-pages") {
      return false;
    }
    const maxP = uploads[0]?.pageCount ?? null;
    const raw = deletePagesText.trim();
    if (!maxP || !raw) {
      return false;
    }
    if (validatePagesFormat(deletePagesText, language)) {
      return false;
    }
    if (validatePagesMax(deletePagesText, maxP, language)) {
      return false;
    }
    const exp = expandPagesString(deletePagesText, maxP, language);
    return exp !== null && exp.length >= maxP;
  }, [selectedFeature.id, deletePagesText, uploads, language]);

  const splitInputDisabled = uploads.length === 0;
  const toolNeedsUpload = selectedFeature.requiresUpload !== false;
  const submitDisabled =
    submitting ||
    (toolNeedsUpload && uploads.length === 0) ||
    !selectedFeatureAllowed ||
    (selectedFeature.id === "split" && (!!pagesError || !pagesText.trim())) ||
    (selectedFeature.id === "delete-pages" &&
      (!!deletePagesError || !deletePagesText.trim())) ||
    (selectedFeature.id === "organize-pdf" && organizePageOrder.length === 0) ||
    (showUnlockPasswordField && !unlockOpenPassword.trim()) ||
    (selectedFeature.id === "watermark" && !watermarkPhrase.trim()) ||
    (selectedFeature.id === "html-to-pdf" &&
      htmlToPdfMode === "url" &&
      !htmlToPdfUrl.trim()) ||
    (selectedFeature.id === "html-to-pdf" &&
      htmlToPdfMode === "html" &&
      !htmlToPdfRaw.trim()) ||
    (showSplitPasswordField && !password.trim()) ||
    (showEncryptSourcePasswordField && !inputPassword.trim()) ||
    (selectedFeature.id === "encrypt" &&
      (!outputPassword.trim() || uploads.length === 0)) ||
    mergeHasMissingPasswords ||
    (selectedFeature.id === "merge" && uploads.length < 2) ||
    (selectedFeature.id === "merge" &&
      uploads.some((u) => u.pageCount === 0)) ||
    toolFilesStillInspecting ||
    deleteWouldRemoveEveryPage;
  const pickerButtonText =
    selectedFeature.multiple && uploads.length > 0 ? W.fileAdd : W.filePick;

  function openLegalPage(target: LegalView) {
    if (
      view === "landing" ||
      view === "login" ||
      view === "register" ||
      view === "admin_login" ||
      view === "forgot_password" ||
      view === "web"
    ) {
      setLegalBackView(view);
    }
    setView(target);
  }

  function openContactModal() {
    setContactError("");
    setContactModalOpen(true);
  }

  function closeContactModal() {
    setContactModalOpen(false);
  }

  function openCreditsWorkspaceFromNav() {
    setActiveSidebar("subscription");
    setContentPanel("subscription");
  }

  async function handleContactModalSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (contactSubmitInFlightRef.current) {
      return;
    }

    setContactError("");

    const tr = language === "tr";
    if (!contactName.trim()) {
      setContactError(tr ? "Ad soyad gerekli." : "Name is required.");
      return;
    }
    if (contactName.trim().length < 2) {
      setContactError(
        tr
          ? "Ad soyad en az 2 karakter olmalı."
          : "Name must be at least 2 characters.",
      );
      return;
    }
    if (!contactEmail.trim()) {
      setContactError(tr ? "E-posta gerekli." : "Email is required.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contactEmail.trim())) {
      setContactError(
        tr ? "Geçerli bir e-posta girin." : "Enter a valid email address.",
      );
      return;
    }
    if (!contactMessage.trim()) {
      setContactError(tr ? "Mesaj gerekli." : "Message is required.");
      return;
    }
    if (contactMessage.trim().length < 10) {
      setContactError(
        tr
          ? "Mesaj en az 10 karakter olmalı."
          : "Message must be at least 10 characters.",
      );
      return;
    }

    contactSubmitInFlightRef.current = true;
    setContactSubmitting(true);
    try {
      await submitContactForm({
        name: contactName.trim(),
        email: contactEmail.trim(),
        message: contactMessage.trim(),
        website: contactWebsite.trim(),
      });
      setContactName("");
      setContactEmail("");
      setContactMessage("");
      setContactWebsite("");
      setContactError("");
      closeContactModal();
      showToast(
        "success",
        tr ? "İletişim" : "Contact",
        tr
          ? "Mesajınız başarıyla gönderildi"
          : "Your message has been sent successfully",
      );
    } catch (error) {
      setContactError(
        error instanceof Error
          ? error.message
          : tr
            ? "Gönderilemedi."
            : "Could not send.",
      );
    } finally {
      contactSubmitInFlightRef.current = false;
      setContactSubmitting(false);
    }
  }

  function closeLegalPage() {
    setView(legalBackView);
  }

  function openWorkspace() {
    setSelectedFeatureId("split");
    setActiveSidebar("split");
    setContentPanel("tool");
    setAuthError("");
    if (isAuthenticated && user?.preferredLanguage) {
      setLanguage(user.preferredLanguage);
    }
    setView(isAuthenticated ? "web" : "login");
  }

  function handleSidebarSelect(id: SidebarToolId) {
    if (id !== "subscription" && lockedFeatures.has(id)) {
      setUpgradeModalOpen(true);
      return;
    }
    setActiveSidebar(id);
    if (id === "subscription") {
      setContentPanel("subscription");
      return;
    }
    setContentPanel("tool");
    setSelectedFeatureId(id);
  }

  function handleDashboardLogoClick() {
    if (view === "admin") {
      setView("web");
      window.history.replaceState({}, "", workspacePathForFeature("split"));
      return;
    }
    setView("landing");
    window.history.replaceState({}, "", "/");
  }

  function handleNavProfile() {
    setContentPanel("profile");
  }

  function handleNavPassword() {
    setChangePasswordModalOpen(true);
  }

  async function handleAuthSubmit(payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
  }) {
    try {
      setAuthSubmitting(true);
      setAuthError("");

      if (view === "register") {
        const firstName = payload.firstName?.trim() ?? "";
        const lastName = payload.lastName?.trim() ?? "";
        if (!firstName || !lastName) {
          const msg =
            language === "tr"
              ? "Ad ve soyad gereklidir."
              : "First and last name are required.";
          setAuthError(msg);
          throw new Error(msg);
        }
        const registerResult = await register({
          firstName,
          lastName,
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
          preferredLanguage: language,
          phone: payload.phone?.trim() || undefined,
          city: payload.city?.trim() || undefined,
        });
        setRegistrationSuccessBanner(
          language === "tr"
            ? "Güvenliğiniz için bir doğrulama e-postası gönderdik. Hesabınızı kullanmaya başlamak için lütfen e-posta adresinizi onaylayın."
            : registerResult.message,
        );
        setView("login");
        return;
      }

      const loggedInUser = await login(payload.email, payload.password);
      if (
        loggedInUser.preferredLanguage &&
        loggedInUser.preferredLanguage !== language
      ) {
        setLanguage(loggedInUser.preferredLanguage);
      }

      if (view === "admin_login") {
        if (loggedInUser.role === "ADMIN") {
          setSelectedFeatureId("split");
          setActiveSidebar("split");
          setContentPanel("tool");
          setView("admin");
          window.history.replaceState({}, "", "/admin");
          return;
        }
        await logout();
        setView("landing");
        window.history.replaceState({}, "", "/");
        return;
      }

      setSelectedFeatureId("split");
      setActiveSidebar("split");
      setContentPanel("tool");
      setView("web");
      window.history.replaceState({}, "", workspacePathForFeature("split"));

      const pendingPlan = sessionStorage.getItem("nb_pending_plan");
      if (pendingPlan) {
        sessionStorage.removeItem("nb_pending_plan");
        setUpgradeModalOpen(true);
      }
    } catch (error) {
      const fallback =
        language === "tr"
          ? "Kimlik doğrulama işlemi başarısız oldu."
          : "Authentication failed.";
      const raw = error instanceof Error ? error.message : fallback;
      setAuthError(translateAuthApiMessage(raw, language));
      throw error;
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleGoToAdmin() {
    setView("admin");
    window.history.pushState({}, "", "/admin");
  }

  async function handleLogout() {
    clearNbResumeProcess();
    await logout();
    setAuthError("");
    setLanguage(detectInitialLanguage());
    setView("landing");
    showToast(
      "success",
      "Oturum kapatıldı",
      "Hesabınızdan güvenli şekilde çıkış yapıldı.",
    );
  }

  async function handleLanguageChange(nextLanguage: "tr" | "en") {
    if (!isAuthenticated) {
      setLanguage(nextLanguage);
      return;
    }

    const previous = language;
    setLanguage(nextLanguage);
    try {
      await updatePreferredLanguage(nextLanguage);
    } catch (error) {
      setLanguage(previous);
      const title =
        previous === "tr"
          ? "Dil tercihi kaydedilemedi"
          : "Could not save language";
      const detail =
        error instanceof Error
          ? error.message
          : previous === "tr"
            ? "Sunucuya bağlanılamadı veya oturum süresi doldu."
            : "Network error or session expired.";
      showToast("error", title, detail);
    }
  }

  function goToLandingFromDashboard() {
    setView("landing");
    window.history.replaceState({}, "", "/");
  }

  function goSubscriptionFromTool() {
    setContentPanel("subscription");
    setActiveSidebar("subscription");
  }

  function handleCancelCurrentOperation() {
    const M = ws(language);
    if (selectedFeatureId === "merge" && mergeJob) {
      const id = mergeJob.id;
      if (id && id !== MERGE_JOB_PENDING_ID) {
        void requestMergeJobCancel(id, accessToken, {}).catch(() => {});
      }
      mergeFlowAbortRef.current?.abort();
      setMergeJob(null);
      setSubmitting(false);
      showToast("info", M.toolRunCancel, M.toolRunCancelledInfo);
      return;
    }
    if (selectedFeatureId !== "merge" && submitting) {
      toolRunAbortRef.current?.abort();
      showToast("info", M.toolRunCancel, M.toolRunCancelledInfo);
    }
  }

  async function submitCurrentFeature(event: React.FormEvent<HTMLFormElement>) {
    // Seçili PDF özelliği için gönderimi işler; istemci doğrulaması, kota ve doğru API çağrısını birleştirir.
    // Tüm modüllerin tek submit boru hattı olması bakım ve hata ayıklamayı sadeleştirir.
    // Bu akış bölünürse kota veya dosya kontrolü atlanırsa sunucu hataları veya tutarsız UX oluşur.
    event.preventDefault();

    if (selectedFeature.id === "html-to-pdf") {
      // dosya yok
    } else if (selectedFeature.id === "image-to-pdf" && uploads.length === 0) {
      showToast("error", "Dosya seçilmedi", "Lütfen en az bir görüntü seçin.");
      return;
    } else if (selectedFeature.id !== "merge" && uploads.length === 0) {
      showToast(
        "error",
        "Dosya seçilmedi",
        "Lütfen önce işlenecek dosyayı seçin.",
      );
      return;
    }

    if (selectedFeature.id === "split") {
      const fmt = validatePagesFormat(pagesText, language);
      const maxP = uploads[0]?.pageCount ?? null;
      let over = validatePagesMax(pagesText, maxP, language);
      if (
        !fmt &&
        !over &&
        Boolean(uploads[0]?.encrypted) &&
        maxP === null &&
        pagesText.trim()
      ) {
        over = W.validationPagesNeedPassword;
      }
      const pageValidation =
        fmt || over || (!pagesText.trim() ? W.validationPagesRequired : "");
      setPagesError(pageValidation);
      if (pageValidation) {
        showToast(
          "error",
          language === "tr"
            ? "Sayfa numaraları geçersiz"
            : "Invalid page numbers",
          pageValidation,
        );
        return;
      }
    }

    if (selectedFeature.id === "delete-pages") {
      const fmt = validatePagesFormat(deletePagesText, language);
      const maxP = uploads[0]?.pageCount ?? null;
      let over = validatePagesMax(deletePagesText, maxP, language);
      if (
        !fmt &&
        !over &&
        Boolean(uploads[0]?.encrypted) &&
        maxP === null &&
        deletePagesText.trim()
      ) {
        over = W.validationPagesNeedPassword;
      }
      const pageValidation =
        fmt ||
        over ||
        (!deletePagesText.trim() ? W.validationPagesRequired : "");

      let finalPageValidation = pageValidation;
      if (!finalPageValidation && maxP && deletePagesText.trim()) {
        const expSafe = expandPagesString(deletePagesText, maxP, language);
        if (expSafe !== null && expSafe.length >= maxP) {
          finalPageValidation = PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG;
        }
      }

      setDeletePagesError(finalPageValidation);
      if (finalPageValidation) {
        const isDeleteAllViolation =
          finalPageValidation === PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG;
        showToast(
          "error",
          isDeleteAllViolation
            ? language === "tr"
              ? "Uyarı"
              : "Warning"
            : language === "tr"
              ? "Sayfa listesi geçersiz"
              : "Invalid page list",
          finalPageValidation,
        );
        return;
      }
    }

    if (showSplitPasswordField && !password.trim()) {
      showToast(
        "error",
        language === "tr"
          ? "Kaynak PDF şifresi gerekli"
          : "Source PDF password required",
        language === "tr"
          ? "Seçilen PDF şifreli olduğu için şifre alanını doldurmanız gerekiyor."
          : "Enter the PDF password below to unlock the file.",
      );
      return;
    }

    if (showEncryptSourcePasswordField && !inputPassword.trim()) {
      showToast(
        "error",
        "Kaynak PDF şifresi gerekli",
        "Seçilen PDF şifreli olduğu için kaynak PDF şifresini girin.",
      );
      return;
    }

    if (showUnlockPasswordField && !unlockOpenPassword.trim()) {
      showToast(
        "error",
        "Parola gerekli",
        "PDF'yi açmak için mevcut parolayı girin.",
      );
      return;
    }

    if (selectedFeature.id === "encrypt" && !outputPassword.trim()) {
      showToast(
        "error",
        "Yeni PDF şifresi gerekli",
        "Şifreli PDF oluşturmak için yeni parola alanını doldurun.",
      );
      return;
    }

    if (mergeHasMissingPasswords) {
      showToast(
        "error",
        language === "tr"
          ? "Şifre doğrulaması gerekli"
          : "Password verification required",
        language === "tr"
          ? "Şifreli PDF'ler için parolayı girin ve her dosyanın yanındaki «Parolayı doğrula» ile onaylayın."
          : "For password-protected PDFs, enter the password and tap «Verify password» next to each file.",
      );
      return;
    }

    if (!accessToken) {
      showToast("error", "Oturum gerekli", "İşlem için yeniden giriş yapın.");
      return;
    }

    if (selectedFeature.id === "pdf-to-excel" && !excelConfirmRef.current) {
      setExcelDialogOpen(true);
      return;
    }
    if (selectedFeature.id === "pdf-to-excel") {
      excelConfirmRef.current = false;
    }

    let toolStalemateWatchdogId: number | undefined;

    try {
      clearNbResumeProcess();
      disposeToolProgressSuccess();
      clearToast();

      if (selectedFeature.id === "merge") {
        mergeFlowAbortRef.current?.abort();
        mergeFlowAbortRef.current = new AbortController();
        const mergeSignal = mergeFlowAbortRef.current.signal;

        const formData = new FormData();
        const passwordList: string[] = [];
        uploads.forEach((item) => {
          formData.append("files", item.file);
          passwordList.push(item.password.trim());
        });
        formData.append("passwords_json", JSON.stringify(passwordList));

        setSubmitting(true);
        setMergeJob({
          id: MERGE_JOB_PENDING_ID,
          status: "queued",
          message: "",
          where: "",
          current: 0,
          total: 1,
          percent: 0,
          elapsed_seconds: 0,
          error: null,
          ready: false,
        });
        try {
          const mergeRes = await createMergeJob(formData, accessToken, {
            signal: mergeSignal,
          });
          const { job_id } = mergeRes;
          mergeSaasGatingRef.current = mergeRes.saasGating ?? null;
          setMergeJob((prev) =>
            prev && prev.id === MERGE_JOB_PENDING_ID
              ? { ...prev, id: job_id, message: "Sıraya alındı." }
              : prev,
          );
        } catch (error) {
          setMergeJob(null);
          setSubmitting(false);
          if (isUserAbortError(error)) {
            return;
          }
          showToast(
            "error",
            language === "tr"
              ? "Birleştirme başlatılamadı"
              : "Could not start merge",
            error instanceof Error
              ? error.message
              : language === "tr"
                ? "İstek gönderilemedi."
                : "Request failed.",
          );
        }
        return;
      }

      toolRunAbortRef.current?.abort();
      toolRunAbortRef.current = new AbortController();
      const toolSignal = toolRunAbortRef.current.signal;

      setSubmitting(true);
      setToolRunStartedAt(Date.now());
      const runBytes =
        selectedFeature.id === "html-to-pdf"
          ? 0
          : selectedFeature.id === "image-to-pdf"
            ? uploads.reduce((a, u) => a + u.file.size, 0)
            : (uploads[0]?.file.size ?? 0);
      setToolRunFileBytes(runBytes);
      setToolRunClock(0);

      genericToolStalemateTriggeredRef.current = false;
      toolStalemateWatchdogId = window.setTimeout(() => {
        genericToolStalemateTriggeredRef.current = true;
        toolRunAbortRef.current?.abort();
      }, TOOL_PIPELINE_WATCHDOG_MS);

      const formData = new FormData();
      const fid = selectedFeature.id;

      if (fid === "html-to-pdf") {
        if (htmlToPdfMode === "url") {
          formData.append("source_url", htmlToPdfUrl.trim());
        } else {
          formData.append("html", htmlToPdfRaw);
        }
      } else if (fid === "image-to-pdf") {
        for (const u of uploads) {
          formData.append("files", u.file);
        }
      } else {
        formData.append("file", uploads[0]!.file);
        switch (fid) {
          case "split":
            formData.append("pages_text", pagesText.trim());
            formData.append("mode", splitMode);
            formData.append("password", password.trim());
            break;
          case "pdf-to-word":
          case "pdf-to-excel":
          case "compress":
            formData.append("quality", compressQuality);
            formData.append("password", password.trim());
            break;
          case "delete-pages":
            formData.append("pages_to_delete", deletePagesText.trim());
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "rotate-pdf": {
            const rotObj: Record<string, number> = {};
            for (const [k, d] of Object.entries(rotatePageRotations)) {
              if (d && d !== 0) {
                rotObj[k] = d;
              }
            }
            if (Object.keys(rotObj).length > 0) {
              formData.append("pages_rotation_json", JSON.stringify(rotObj));
            } else {
              formData.append("degrees", "90");
            }
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          }
          case "organize-pdf": {
            const order = organizePageOrder.join(",");
            formData.append("page_order", order);
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          }
          case "unlock-pdf":
            formData.append("password", unlockOpenPassword.trim());
            break;
          case "watermark":
            formData.append("watermark_text", watermarkPhrase.trim());
            formData.append("watermark_color", watermarkColor);
            formData.append("watermark_font", watermarkFont);
            formData.append("watermark_opacity", watermarkOpacity);
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "page-numbers":
            formData.append("start_at", pageNumStart.trim() || "1");
            formData.append("position", pageNumPos);
            formData.append("fmt", pageNumFmt);
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "repair-pdf":
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "pdf-to-ppt":
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "pdf-to-image":
            formData.append("image_format", pdfToImgFmt);
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "encrypt":
            formData.append("input_password", inputPassword.trim());
            formData.append("user_password", outputPassword.trim());
            break;
          case "pdf-to-text":
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "flatten-pdf":
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          default:
            break;
        }
      }

      if (isResultStoreTool(fid)) {
        const res = await postToolToResult(
          selectedFeature.endpoint,
          formData,
          accessToken,
          {
            signal: toolSignal,
            errorMessage:
              language === "tr"
                ? "İşlem başarısız oldu."
                : "The operation failed.",
          },
        );

        let thumbnailBlobUrl: string | null = null;
        if (res.has_thumbnail) {
          try {
            thumbnailBlobUrl = await fetchResultThumbnailBlobUrl(
              res.result_id,
              accessToken,
              {
                signal: toolSignal,
              },
            );
          } catch {
            thumbnailBlobUrl = null;
          }
        }

        disposeToolProgressSuccess();
        toolProgressDisposeRef.current = thumbnailBlobUrl
          ? () => URL.revokeObjectURL(thumbnailBlobUrl)
          : null;
        setToolProgressSuccess({
          filename: res.filename || selectedFeature.fallbackFilename,
          featureTitle: selectedFeature.title,
          gatedDownload: {
            toolId: fid,
            resultId: res.result_id,
            fallbackName: res.filename || selectedFeature.fallbackFilename,
            thumbnailBlobUrl,
            saasGating: res.saasGating ?? null,
          },
        });
        showToast(
          "success",
          language === "tr" ? "İşlem tamamlandı" : "Process complete",
          language === "tr"
            ? "İndirmek için aşağıdaki düğmeyi kullanın."
            : "Use the button below to download.",
        );
        resetForm(true);
        offerPostRunMonetizationHintAfterSuccess(res.saasGating ?? null);
        void refreshSubscriptionState();
        return;
      }

      let pendingLogId: string | null = null;
      const dl = await downloadFromApi(
        selectedFeature.endpoint,
        formData,
        selectedFeature.fallbackFilename,
        accessToken,
        {
          signal: toolSignal,
          onBeforeReadBody: accessToken
            ? async () => {
                try {
                  const row = await createDownloadLog(accessToken, {
                    resultId: null,
                    toolId: selectedFeature.id,
                  });
                  pendingLogId = row.id;
                } catch {
                  /* noop */
                }
              }
            : undefined,
        },
      );
      if (accessToken && pendingLogId) {
        try {
          await ackDownloadLog(accessToken, pendingLogId);
        } catch {
          /* noop */
        }
      }
      applyWorkspaceCleanSlateAfterDownload(selectedFeature.id);
      showToast(
        "success",
        "İşlem tamamlandı",
        "Çıktı dosyası başarıyla indirildi.",
      );
      dl.dispose?.();
      toolProgressDisposeRef.current = null;
      offerPostRunMonetizationHintAfterSuccess(dl.saasGating ?? null);
      void refreshSubscriptionState();
    } catch (error) {
      if (isUserAbortError(error)) {
        if (genericToolStalemateTriggeredRef.current) {
          genericToolStalemateTriggeredRef.current = false;
          showToast(
            "error",
            language === "tr" ? "İşlem zaman aşımı" : "Operation timed out",
            language === "tr"
              ? "Sunucudan uzun süre yanıt gelmedi; bağlantıyı kontrol edin veya daha sonra yeniden deneyin."
              : "No server response for a long time. Check your connection or try again later.",
          );
        }
        return;
      }
      if (error instanceof EntitlementPaymentRequiredError) {
        setUpgradeModalOpen(true);
        return;
      }
      showToast(
        "error",
        "İşlem başarısız",
        friendlyOperationFailedMessage(language),
      );
    } finally {
      if (toolStalemateWatchdogId !== undefined) {
        window.clearTimeout(toolStalemateWatchdogId);
        toolStalemateWatchdogId = undefined;
      }
      if (selectedFeature.id !== "merge") {
        setSubmitting(false);
        setToolRunStartedAt(null);
        setToolRunFileBytes(0);
      }
    }
  }

  function fileIdentityKey(file: File) {
    return `${file.name}::${file.size}`;
  }

  async function handleNewFiles(fileList: File[]) {
    const rawFiles = Array.from(fileList);
    const L = ws(language);

    const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB
    const oversized = rawFiles.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      const names = oversized.map((f) => f.name).join(", ");
      showToast(
        "error",
        language === "tr" ? "Dosya çok büyük" : "File too large",
        language === "tr"
          ? `Maksimum dosya boyutu 200 MB. Büyük dosya(lar): ${names}`
          : `Maximum file size is 200 MB. Oversized: ${names}`,
      );
      return;
    }

    const existingKeys = new Set(uploads.map((u) => fileIdentityKey(u.file)));
    const duplicates = rawFiles.filter((f) =>
      existingKeys.has(fileIdentityKey(f)),
    );
    const freshFiles = rawFiles.filter(
      (f) => !existingKeys.has(fileIdentityKey(f)),
    );

    if (selectedFeature.multiple && duplicates.length > 0) {
      showToast("info", L.mergeDuplicateFileTitle, L.mergeDuplicateFileDetail);
    }

    if (freshFiles.length === 0) {
      return;
    }

    const incomingItems = createUploadItems(freshFiles);
    const nextItems = selectedFeature.multiple
      ? [...uploads, ...incomingItems]
      : incomingItems;
    setUploads(nextItems);
    setPagesError("");
    clearToast();

    if (incomingItems.length === 0) {
      return;
    }

    if (!shouldInspectCurrentFeature) {
      return;
    }

    const token = inspectRunRef.current + 1;
    inspectRunRef.current = token;
    const withLoading = nextItems.map((item) =>
      incomingItems.some((incoming) => incoming.id === item.id)
        ? { ...item, inspecting: true }
        : item,
    );
    setUploads(withLoading);

    const inspectedNewItems = await Promise.all(
      incomingItems.map(async (item) => {
        try {
          const result = await withPdfInspectTimeout(
            inspectPdf(item.file, undefined, accessToken),
            PDF_INSPECT_TIMEOUT_MS,
          );
          return {
            ...item,
            encrypted: Boolean(result.encrypted),
            inspecting: false,
            pageCount: result.page_count ?? null,
            mergePasswordVerified: false,
          };
        } catch (err) {
          const L2 = ws(language);
          if (err instanceof Error && err.message === "pdf_inspect_timeout") {
            showToast(
              "error",
              language === "tr"
                ? "PDF denetimi zaman aşımı"
                : "PDF check timed out",
              language === "tr"
                ? "PDF denetimi uzun sürdü veya yanıt kesildi. Bağlantıyı kontrol edin veya dosyayı yeniden deneyin."
                : "PDF check took too long or stalled. Check your connection or try the file again.",
            );
          } else {
            showToast(
              "error",
              L2.inspectFailedTitle,
              friendlyOperationFailedMessage(language),
            );
          }
          return {
            ...item,
            encrypted: false,
            inspecting: false,
            pageCount: null,
            mergePasswordVerified: false,
          };
        }
      }),
    );

    if (inspectRunRef.current !== token) {
      return;
    }

    setUploads((current) => {
      let mapped = current.map(
        (item) =>
          inspectedNewItems.find((inspected) => inspected.id === item.id) ??
          item,
      );
      if (selectedFeature.id === "merge") {
        const removedIds = new Set(
          inspectedNewItems.filter((i) => i.pageCount === 0).map((i) => i.id),
        );
        if (removedIds.size > 0) {
          showToast(
            "info",
            language === "tr" ? "Geçersiz PDF" : "Invalid PDF",
            language === "tr"
              ? "Bu PDF dosyasında sayfa bulunamadı; listeden çıkarıldı."
              : "This PDF has no pages and was removed from the list.",
          );
          mapped = mapped.filter((item) => !removedIds.has(item.id));
        }
      }
      return mapped;
    });
  }

  const pathname =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/$/, "") || "/"
      : "/";
  const bootstrapFastRoutes =
    pathname === "/login-success" ||
    pathname === "/login-error" ||
    pathname.startsWith("/fake-payment");

  /** Until runtime JSON is known, avoid mounting landing/workspace (prevents maintenance flicker on reload). */
  if (!bootstrapFastRoutes && !runtimeHydrated) {
    if (user?.role !== "ADMIN" && readMaintenanceHint() === true) {
      return (
        <>
          <MaintenancePage />
          <CookieNotice
            language={language}
            visible={shouldShowCookieNotice}
            onAccept={acceptConsent}
            onOpenPrivacy={() => openLegalPage("privacy")}
          />
        </>
      );
    }
    return (
      <>
        <RuntimeBootstrapSplash />
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  const isLoginSuccessRoute = pathname === "/login-success";

  if (isLoginSuccessRoute) {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <Suspense fallback={null}>
          <LoginSuccessPage
            completeOAuthLogin={completeOAuthLogin}
            clearSession={clearSession}
            onNavigateToDashboard={navigateToDashboardAfterOAuth}
          />
        </Suspense>
      </>
    );
  }

  const maintenanceActive = flags.maintenanceMode === true;
  const maintenanceBypass = user?.role === "ADMIN";

  if (
    !isLoginSuccessRoute &&
    maintenanceActive &&
    !maintenanceBypass &&
    !isPathAllowedDuringMaintenance(pathname)
  ) {
    const tokenPending =
      typeof window !== "undefined"
        ? window.localStorage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY)
        : null;
    if (isRestoring && tokenPending) {
      return (
        <>
          <SeoRouteManager
            pathname={pathname}
            view={view}
            language={language}
            selectedFeatureId={selectedFeatureId}
          />
          <MaintenanceTabTitle />
          <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center bg-[#05080f] px-6 py-12 font-sans text-nb-text antialiased">
            <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[28px] border border-white/[0.08] bg-nb-panel/55 px-10 py-16 text-center shadow-[0_50px_100px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                PDF PLATFORM
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Oturum doğrulanıyor
              </h1>
              <p className="mt-4 text-base leading-8 text-nb-muted">
                Güvenli erişim bilgileriniz kontrol ediliyor. Lütfen bekleyin.
              </p>
            </div>
          </div>
          <CookieNotice
            language={language}
            visible={shouldShowCookieNotice}
            onAccept={acceptConsent}
            onOpenPrivacy={() => openLegalPage("privacy")}
          />
        </>
      );
    }

    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <MaintenancePage />
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  if (view === "forgot_password") {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <SystemNotificationBanner language={language} />
        <Suspense fallback={null}>
          <ForgotPasswordPage
            language={language}
            onBackToLogin={() => {
              setAuthError("");
              setView("login");
            }}
            onCompleted={(successMessage) => {
              setAuthError("");
              setView("login");
              showToast(
                "success",
                language === "tr" ? "Şifre sıfırlandı" : "Password reset",
                successMessage,
              );
            }}
          />
        </Suspense>
      </>
    );
  }

  if (view === "landing") {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <SystemNotificationBanner language={language} />
        <Suspense fallback={null}>
          <LandingPage
            language={language}
            onLanguageChange={handleLanguageChange}
            onUseWebApp={openWorkspace}
            isAuthenticated={isAuthenticated}
            authGreeting={user ? userGreetingLine(user, language) : undefined}
            onLogin={() => {
              setAuthError("");
              setView("login");
            }}
            onRegister={() => {
              setAuthError("");
              setView("register");
            }}
            onOpenTerms={() => openLegalPage("terms")}
            onOpenPrivacy={() => openLegalPage("privacy")}
            onOpenKvkk={() => openLegalPage("kvkk")}
            onSelectPlan={(planId) => {
              if (isAuthenticated) {
                openWorkspace();
                setUpgradeModalOpen(true);
              } else {
                sessionStorage.setItem("nb_pending_plan", planId);
                setAuthError("");
                setView("register");
              }
            }}
          />
        </Suspense>
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  if (view === "admin_login") {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <SystemNotificationBanner language={language} />
        <Suspense fallback={null}>
          <AuthPage
            mode="login"
            purpose="admin"
            language={language}
            submitting={authSubmitting || isRestoring}
            serverError={authError}
            registrationSuccessBanner={null}
            onDismissRegistrationSuccess={undefined}
            onBack={() => {
              setAuthError("");
              setView("landing");
              window.history.replaceState({}, "", "/");
            }}
            onModeChange={() => {}}
            onSubmit={handleAuthSubmit}
            onForgotPassword={() => {
              setAuthError("");
              setView("forgot_password");
            }}
            onOpenTerms={() => openLegalPage("terms")}
            onOpenPrivacy={() => openLegalPage("privacy")}
            onOpenKvkk={() => openLegalPage("kvkk")}
          />
        </Suspense>
        {toast ? (
          <div className={`toast toast--${toast.type}`}>
            <div className="toast__title">{toast.title}</div>
            <div className="toast__detail">{toast.detail}</div>
          </div>
        ) : null}
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  if (view === "login" || view === "register") {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <SystemNotificationBanner language={language} />
        <Suspense fallback={null}>
          <AuthPage
            mode={view}
            language={language}
            submitting={authSubmitting || isRestoring}
            serverError={authError}
            registrationSuccessBanner={registrationSuccessBanner}
            onDismissRegistrationSuccess={() =>
              setRegistrationSuccessBanner(null)
            }
            onBack={() => {
              setAuthError("");
              setRegistrationSuccessBanner(null);
              setView("landing");
            }}
            onModeChange={(nextMode) => {
              setAuthError("");
              setView(nextMode);
            }}
            onSubmit={handleAuthSubmit}
            onForgotPassword={() => {
              setAuthError("");
              setView("forgot_password");
            }}
            onOpenTerms={() => openLegalPage("terms")}
            onOpenPrivacy={() => openLegalPage("privacy")}
            onOpenKvkk={() => openLegalPage("kvkk")}
          />
        </Suspense>
        {toast ? (
          <div className={`toast toast--${toast.type}`}>
            <div className="toast__title">{toast.title}</div>
            <div className="toast__detail">{toast.detail}</div>
          </div>
        ) : null}
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  if (view === "terms" || view === "privacy" || view === "kvkk") {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <SystemNotificationBanner language={language} />
        <Suspense fallback={null}>
          <LegalPage
            language={language}
            documentKey={view}
            onBack={closeLegalPage}
          />
        </Suspense>
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  if (isRestoring) {
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <div className="min-h-screen bg-nb-bg px-6 py-12 font-sans text-nb-text antialiased">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[28px] border border-white/[0.08] bg-nb-panel/55 px-10 py-16 text-center shadow-[0_50px_100px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              PDF PLATFORM
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              Oturum doğrulanıyor
            </h1>
            <p className="mt-4 text-base leading-8 text-nb-muted">
              Güvenli erişim bilgileriniz kontrol ediliyor. Lütfen bekleyin.
            </p>
          </div>
        </div>
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  const contactCopy =
    language === "tr"
      ? {
          title: "İletişim",
          name: "Ad soyad",
          email: "E-posta",
          message: "Mesaj",
          submit: "Gönder",
          submitting: "Gönderiliyor…",
          close: "Kapat",
        }
      : {
          title: "Contact",
          name: "Name",
          email: "Email",
          message: "Message",
          submit: "Send",
          submitting: "Sending…",
          close: "Close",
        };

  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-nb-bg px-6 py-12 font-sans text-nb-text antialiased">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-nb-panel/55 px-10 py-16 text-center shadow-xl backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              PDF PLATFORM
            </p>
            <p className="mt-4 text-base text-nb-muted">
              Oturum bilgileri yükleniyor…
            </p>
          </div>
        </div>
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </>
    );
  }

  if (view === "admin") {
    if (user.role !== "ADMIN" || !accessToken) {
      if (!isRestoring) {
        window.history.replaceState({}, "", "/admin-login");
        setView("admin_login");
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-nb-bg">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-nb-primary border-t-transparent" />
        </div>
      );
    }
    return (
      <>
        <SeoRouteManager
          pathname={pathname}
          view={view}
          language={language}
          selectedFeatureId={selectedFeatureId}
        />
        <SystemNotificationBanner language={language} />
        {toast ? (
          <div className={`toast toast--${toast.type}`}>
            <div className="toast__title">{toast.title}</div>
            <div className="toast__detail">{toast.detail}</div>
          </div>
        ) : null}
        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
        <Suspense fallback={null}>
          <AdminPanel
            accessToken={accessToken}
            userEmail={user?.email ?? "admin"}
            onExit={() => {
              setView("web");
              window.history.replaceState(
                {},
                "",
                workspacePathForFeature("split"),
              );
            }}
            onLogout={() => void handleLogout()}
          />
        </Suspense>
      </>
    );
  }

  return (
    <CheckoutCurrencyProvider>
      <SeoRouteManager
        pathname={pathname}
        view={view}
        language={language}
        selectedFeatureId={selectedFeatureId}
      />
      <div className="app-shell">
        <PdfApiOfflineBanner />
        <SystemNotificationBanner language={language} />
        {contactModalOpen ? (
          <div
            className="contact-modal-backdrop"
            role="presentation"
            onClick={closeContactModal}
          >
            <div
              className="contact-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="contact-modal__header">
                <h2 id="contact-modal-title">{contactCopy.title}</h2>
                <button
                  type="button"
                  className="contact-modal__close"
                  onClick={closeContactModal}
                  aria-label={contactCopy.close}
                >
                  ×
                </button>
              </div>
              <form
                className="contact-modal__form"
                onSubmit={handleContactModalSubmit}
              >
                <label className="field">
                  <span>{contactCopy.name}</span>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    autoComplete="name"
                    disabled={contactSubmitting}
                  />
                </label>
                <label className="field">
                  <span>{contactCopy.email}</span>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    autoComplete="email"
                    disabled={contactSubmitting}
                  />
                </label>
                <label className="field field--full">
                  <span>{contactCopy.message}</span>
                  <textarea
                    value={contactMessage}
                    onChange={(event) => setContactMessage(event.target.value)}
                    rows={5}
                    disabled={contactSubmitting}
                  />
                </label>
                <label className="contact-modal__honeypot" aria-hidden="true">
                  <span>Website</span>
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={contactWebsite}
                    onChange={(event) => setContactWebsite(event.target.value)}
                  />
                </label>
                {contactError ? (
                  <p className="field-error">{contactError}</p>
                ) : null}
                <button
                  className="primary-action"
                  type="submit"
                  disabled={contactSubmitting}
                >
                  {contactSubmitting
                    ? contactCopy.submitting
                    : contactCopy.submit}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <ChangePasswordModal
          open={changePasswordModalOpen}
          onClose={() => setChangePasswordModalOpen(false)}
          user={user}
          language={language}
          changePassword={changePassword}
          setInitialPassword={setInitialPassword}
          showToast={showToast}
        />

        <Suspense fallback={null}>
          <PlanUpgradeModal
            open={upgradeModalOpen}
            onClose={() => setUpgradeModalOpen(false)}
            language={language}
            accessToken={accessToken ?? undefined}
            user={user}
            updateProfile={updateProfile}
            showToast={showToast}
            onOpenTerms={() => openLegalPage("terms")}
            onOpenKvkk={() => openLegalPage("kvkk")}
            onBeforeExternalCheckout={persistNbResumeSnapshot}
          />
        </Suspense>

        {uploads[0] &&
        (selectedFeatureId === "split" ||
          selectedFeatureId === "delete-pages" ||
          selectedFeatureId === "rotate-pdf" ||
          selectedFeatureId === "organize-pdf") ? (
          <SplitPagePickerModal
            open={pageVisualModalOpen}
            onClose={() => setPageVisualModalOpen(false)}
            onReset={resetVisualPagePicker}
            file={uploads[0].file}
            password={password}
            maxPage={uploads[0].pageCount}
            language={language}
            mode={pageVisualMode}
            pagesText={
              pageVisualMode === "split"
                ? pagesText
                : pageVisualMode === "delete"
                  ? deletePagesText
                  : ""
            }
            onPagesTextChange={
              pageVisualMode === "split"
                ? setPagesText
                : pageVisualMode === "delete"
                  ? setDeletePagesText
                  : () => {}
            }
            onPagesErrorClear={
              pageVisualMode === "split"
                ? () => setPagesError("")
                : pageVisualMode === "delete"
                  ? () => setDeletePagesError("")
                  : () => {}
            }
            pageRotations={rotatePageRotations}
            onPageRotationsChange={setRotatePageRotations}
            pageOrder={organizePageOrder}
            onPageOrderChange={setOrganizePageOrder}
            strictTurkishForDeleteUi={selectedFeatureId === "delete-pages"}
            onDeleteWouldRemoveWholeDocument={() =>
              showToast("info", "Uyarı", PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG)
            }
          />
        ) : null}

        <GatedResultPreviewModal
          open={gatedHeroModalOpen}
          onClose={() => {
            setGatedHeroModalOpen(false);
            setGatedHeroResultId(null);
            setGatedHeroMergeJobId(null);
          }}
          resultId={gatedHeroResultId}
          mergeJobId={gatedHeroMergeJobId}
          accessToken={accessToken}
          filename={toolProgressSuccess?.filename ?? ""}
          language={language}
        />

        {excelDialogOpen ? (
          <div
            className="fixed inset-0 z-[11500] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setExcelDialogOpen(false);
              }
            }}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/98 to-slate-950/98 p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <h2 className="text-lg font-semibold text-slate-50">
                {W.pdfExcelWarningTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {W.pdfExcelWarningBody}
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                  onClick={() => setExcelDialogOpen(false)}
                >
                  {W.toolProgressDismiss}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-amber-500/35 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25"
                  onClick={() => {
                    excelConfirmRef.current = true;
                    setExcelDialogOpen(false);
                    (
                      document.getElementById(
                        "nb-workspace-tool-form",
                      ) as HTMLFormElement | null
                    )?.requestSubmit();
                  }}
                >
                  {W.pdfExcelWarningConfirm}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {toast ? (
          <div className={`toast toast--${toast.type}`}>
            <div className="toast__title">{toast.title}</div>
            <div className="toast__detail">{toast.detail}</div>
          </div>
        ) : null}

        <DashboardTopNav
          user={user}
          language={language}
          onLanguageChange={(lang) => void handleLanguageChange(lang)}
          plan={user?.role !== "ADMIN" ? (userBalance?.plan ?? null) : undefined}
          creditBalance={user?.role !== "ADMIN" ? (userBalance?.creditBalance ?? null) : undefined}
          creditBalanceLoading={balanceLoading && user?.role !== "ADMIN"}
          hasActiveSubscription={userBalance?.hasActiveSubscription}
          limitsizProActive={limitsizProActive}
          onLogoClick={handleDashboardLogoClick}
          onProfile={handleNavProfile}
          onPassword={handleNavPassword}
          onLogout={() => void handleLogout()}
          onUpgradeClick={
            limitsizProActive
              ? undefined
              : () => setUpgradeModalOpen(true)
          }
          onOpenCreditsPanel={
            user?.role !== "ADMIN" ? openCreditsWorkspaceFromNav : undefined
          }
          showAdminEntry={user?.role === "ADMIN"}
          onOpenAdmin={user?.role === "ADMIN" ? handleGoToAdmin : undefined}
        />
        {workspaceBanner.enabled ? (
          <div className="border-b border-cyan-500/30 bg-cyan-950/50 px-4 py-2 text-center text-xs font-medium text-cyan-100 md:text-sm">
            {workspaceBanner.text}
          </div>
        ) : null}
        <DashboardSidebar
          active={activeSidebar}
          onSelect={handleSidebarSelect}
          language={language}
          lockedFeatures={lockedFeatures}
          userRole={user?.role}
          enabledToolIds={enabledToolIds}
          resolveToolLabel={resolveToolLabel}
          limitsizProActive={limitsizProActive}
          onAdminClick={user?.role === "ADMIN" ? handleGoToAdmin : undefined}
          accessToken={accessToken}
          onUpgrade={() => setUpgradeModalOpen(true)}
        />
        <div
          className={`min-h-screen bg-nb-bg pt-14 md:pl-60 ${bottomToolProgressActive ? "pb-32 md:pb-36" : "pb-10"}`}
        >
          <DashboardSidebarMobileRail
            active={activeSidebar}
            onSelect={handleSidebarSelect}
            language={language}
            lockedFeatures={lockedFeatures}
            userRole={user?.role}
            enabledToolIds={enabledToolIds}
            resolveToolLabel={resolveToolLabel}
          />
          <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
            {contentPanel === "subscription" ? (
              <section className="subscription-card space-y-4">
                <QuotaWidget
                  language={language}
                  accessToken={accessToken}
                  onUpgrade={() => setUpgradeModalOpen(true)}
                />
              </section>
            ) : null}

            {contentPanel === "pricing" && accessToken && user ? (
              <Suspense fallback={null}>
                <PlanUpgradeModal
                  open={true}
                  onClose={() => setContentPanel("subscription")}
                  language={language}
                  accessToken={accessToken}
                  user={user}
                  updateProfile={updateProfile}
                  showToast={showToast}
                  onOpenTerms={() => openLegalPage("terms")}
                  onOpenKvkk={() => openLegalPage("kvkk")}
                  onBeforeExternalCheckout={persistNbResumeSnapshot}
                />
              </Suspense>
            ) : null}

            {contentPanel === "profile" ? (
              <UserProfilePanel
                user={user}
                language={language}
                updateProfile={updateProfile}
                showToast={showToast}
                onOpenChangePassword={() => setChangePasswordModalOpen(true)}
                setInitialPassword={setInitialPassword}
              />
            ) : null}

            {contentPanel === "tool" ? (
              <>
                <section className="workspace-card relative overflow-x-hidden">
                  <div className="workspace-card__header">
                    <div>
                      <h1 className="text-xl font-bold tracking-tight text-nb-text md:text-2xl">
                        {selectedFeature.title}
                      </h1>
                      <h2 className="mt-2 text-base font-normal leading-relaxed text-nb-muted md:text-lg">
                        {selectedFeature.description}
                      </h2>
                    </div>
                  </div>

                  <div className="relative min-h-[280px]">
                    <div
                      className={
                        !selectedFeatureAllowed
                          ? "pointer-events-none blur-[3px] transition-[filter] duration-200"
                          : undefined
                      }
                    >
                      <form
                        key={workspaceSlateNonce}
                        id="nb-workspace-tool-form"
                        className="tool-form"
                        onSubmit={submitCurrentFeature}
                      >
                        {selectedFeature.id === "html-to-pdf" ? (
                          <div className="field field--full">
                            <span>
                              {language === "tr" ? "HTML → PDF" : "HTML → PDF"}
                            </span>
                            <div className="mb-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${htmlToPdfMode === "url" ? "bg-nb-primary/25 text-nb-accent" : "bg-white/5 text-nb-muted"}`}
                                onClick={() => setHtmlToPdfMode("url")}
                              >
                                URL
                              </button>
                              <button
                                type="button"
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${htmlToPdfMode === "html" ? "bg-nb-primary/25 text-nb-accent" : "bg-white/5 text-nb-muted"}`}
                                onClick={() => setHtmlToPdfMode("html")}
                              >
                                HTML
                              </button>
                            </div>
                            {htmlToPdfMode === "url" ? (
                              <input
                                type="url"
                                className="w-full"
                                value={htmlToPdfUrl}
                                onChange={(e) =>
                                  setHtmlToPdfUrl(e.target.value)
                                }
                                placeholder="https://"
                              />
                            ) : (
                              <textarea
                                className="min-h-[140px] w-full font-mono text-sm"
                                value={htmlToPdfRaw}
                                onChange={(e) =>
                                  setHtmlToPdfRaw(e.target.value)
                                }
                              />
                            )}
                            <span className="field-hint">
                              {language === "tr"
                                ? "Bir sayfa adresi veya ham HTML verin. İşlem sunucu üzerinde yapılır."
                                : "Provide a page URL or raw HTML. Processing runs on the server."}
                            </span>
                          </div>
                        ) : null}

                        {toolNeedsUpload ? (
                          <label className="field">
                            <span>{W.filePick}</span>
                            <div className="file-picker-row flex-wrap">
                              <button
                                className="file-picker-button"
                                type="button"
                                onClick={triggerFilePicker}
                              >
                                {pickerButtonText}
                              </button>
                              <span className="file-picker-note">
                                {selectedFeature.multiple
                                  ? uploads.length > 0
                                    ? W.filePickNoteAppend
                                    : W.filePickNoteMulti
                                  : W.filePickNoteSingle}
                              </span>
                            </div>
                            <input
                              key={selectedFeatureId}
                              ref={fileInputRef}
                              className="hidden-file-input"
                              type="file"
                              accept={selectedFeature.accept || "*"}
                              multiple={Boolean(selectedFeature.multiple)}
                              onChange={onFilesChange}
                            />
                          </label>
                        ) : null}

                        {selectedFeature.id === "split" ? (
                          <>
                            <label className="field">
                              <span>{W.pagesLabel}</span>
                              <input
                                type="text"
                                value={pagesText}
                                disabled={splitInputDisabled}
                                onKeyDown={(event) => {
                                  const allowedKeys = [
                                    "Backspace",
                                    "Delete",
                                    "ArrowLeft",
                                    "ArrowRight",
                                    "Tab",
                                    ",",
                                    "-",
                                    " ",
                                    "Home",
                                    "End",
                                  ];
                                  if (allowedKeys.includes(event.key)) {
                                    return;
                                  }
                                  if (!/^\d$/.test(event.key)) {
                                    event.preventDefault();
                                  }
                                }}
                                onChange={(event) => {
                                  const sanitized = event.target.value.replace(
                                    /[^\d,\-\s]/g,
                                    "",
                                  );
                                  setPagesText(sanitized);
                                  const fmt = validatePagesFormat(
                                    sanitized,
                                    language,
                                  );
                                  const maxP = uploads[0]?.pageCount ?? null;
                                  let over = validatePagesMax(
                                    sanitized,
                                    maxP,
                                    language,
                                  );
                                  if (
                                    !fmt &&
                                    !over &&
                                    Boolean(uploads[0]?.encrypted) &&
                                    maxP === null &&
                                    sanitized.trim()
                                  ) {
                                    over = W.validationPagesNeedPassword;
                                  }
                                  setPagesError(fmt || over);
                                }}
                                placeholder={W.pagesPlaceholder}
                              />
                              {pagesError ? (
                                <span className="field-error">
                                  {pagesError}
                                </span>
                              ) : null}
                            </label>

                            {uploads[0]?.file.type === "application/pdf" &&
                            (uploads[0].pageCount ?? 0) > 0 ? (
                              <div className="field">
                                <button
                                  type="button"
                                  className="primary-action w-full sm:w-auto"
                                  onClick={() => {
                                    setPageVisualMode("split");
                                    setPageVisualModalOpen(true);
                                  }}
                                >
                                  {W.splitPickerOpen}
                                </button>
                                <span className="field-hint block mt-1.5">
                                  {language === "tr"
                                    ? "Görsel ızgarada sayfa seçin; metin alanı ile eşzamanlıdır."
                                    : "Pick pages in the grid; the text field updates with your selection."}
                                </span>
                              </div>
                            ) : null}

                            <label className="field">
                              <span>{W.splitModeLabel}</span>
                              <select
                                value={splitMode}
                                onChange={(event) =>
                                  setSplitMode(event.target.value)
                                }
                              >
                                <option value="single">
                                  {W.splitModeSingle}
                                </option>
                                <option value="separate">
                                  {W.splitModeSeparate}
                                </option>
                              </select>
                              <span className="field-hint">
                                {splitModeDescription}
                              </span>
                            </label>
                          </>
                        ) : null}

                        {selectedFeature.id === "delete-pages" ? (
                          <>
                            <label className="field">
                              <span>
                                {language === "tr"
                                  ? "Silinecek sayfalar"
                                  : "Pages to remove"}
                              </span>
                              <input
                                type="text"
                                value={deletePagesText}
                                disabled={splitInputDisabled}
                                onChange={(event) => {
                                  const v = event.target.value.replace(
                                    /[^\d,\-\s]/g,
                                    "",
                                  );
                                  setDeletePagesText(v);
                                  const fmt = validatePagesFormat(v, language);
                                  const maxP = uploads[0]?.pageCount ?? null;
                                  let combined =
                                    fmt || validatePagesMax(v, maxP, language);
                                  if (!combined && maxP && v.trim()) {
                                    const exp = expandPagesString(
                                      v,
                                      maxP,
                                      language,
                                    );
                                    if (exp !== null && exp.length >= maxP) {
                                      combined =
                                        PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG;
                                    }
                                  }
                                  setDeletePagesError(combined);
                                }}
                                placeholder={W.pagesPlaceholder}
                              />
                              {deletePagesError ? (
                                <span className="field-error">
                                  {deletePagesError}
                                </span>
                              ) : null}
                            </label>
                            {uploads[0]?.file.type === "application/pdf" &&
                            (uploads[0].pageCount ?? 0) > 0 ? (
                              <div className="field">
                                <button
                                  type="button"
                                  className="primary-action w-full sm:w-auto"
                                  onClick={() => {
                                    setPageVisualMode("delete");
                                    setPageVisualModalOpen(true);
                                  }}
                                >
                                  {W.splitPickerOpen}
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        {selectedFeature.id === "rotate-pdf" ? (
                          <div className="field">
                            <p className="field-hint mb-3 text-sm text-nb-muted">
                              {language === "tr"
                                ? "PDF'i yükleyin, ardından sayfaları görsel modda döndürün."
                                : "Upload your PDF, then rotate pages in visual mode."}
                            </p>
                            {uploads[0]?.file.type === "application/pdf" &&
                            (uploads[0].pageCount ?? 0) > 0 ? (
                              <button
                                type="button"
                                className="primary-action w-full sm:w-auto"
                                onClick={() => {
                                  setPageVisualMode("rotate");
                                  setPageVisualModalOpen(true);
                                }}
                              >
                                {language === "tr"
                                  ? "Sayfaları Döndür"
                                  : "Rotate Pages"}
                              </button>
                            ) : null}
                            {Object.keys(rotatePageRotations).length > 0 ? (
                              <p className="mt-2 text-xs text-cyan-400">
                                {language === "tr"
                                  ? `${Object.keys(rotatePageRotations).length} sayfa döndürme seçildi`
                                  : `${Object.keys(rotatePageRotations).length} page rotation(s) selected`}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {selectedFeature.id === "organize-pdf" ? (
                          <div className="field">
                            <button
                              type="button"
                              className="primary-action w-full sm:w-auto"
                              onClick={() => {
                                setPageVisualMode("organize");
                                setPageVisualModalOpen(true);
                              }}
                            >
                              {W.splitPickerOpen}
                            </button>
                            {organizePageOrder.length > 0 ? (
                              <span className="field-hint">
                                {language === "tr"
                                  ? `${organizePageOrder.length} sayfa sıralandı: ${organizePageOrder.slice(0, 8).join(", ")}${organizePageOrder.length > 8 ? "…" : ""}`
                                  : `${organizePageOrder.length} pages ordered: ${organizePageOrder.slice(0, 8).join(", ")}${organizePageOrder.length > 8 ? "…" : ""}`}
                              </span>
                            ) : (
                              <span className="field-hint">
                                {language === "tr"
                                  ? "Sayfaları sürükleyerek yeniden sıralayın."
                                  : "Drag pages to reorder them."}
                              </span>
                            )}
                          </div>
                        ) : null}

                        {showUnlockPasswordField ? (
                          <label className="field">
                            <span>
                              {language === "tr"
                                ? "Mevcut PDF parolası"
                                : "Current PDF password"}
                            </span>
                            <input
                              type="password"
                              value={unlockOpenPassword}
                              onChange={(event) =>
                                setUnlockOpenPassword(event.target.value)
                              }
                              placeholder={
                                language === "tr"
                                  ? "Belgeyi açan parola"
                                  : "Password that opens the file"
                              }
                            />
                          </label>
                        ) : null}

                        {selectedFeature.id === "watermark" ? (
                          <>
                            {/* Canlı önizleme */}
                            <div className="field">
                              <span>
                                {language === "tr" ? "Önizleme" : "Preview"}
                              </span>
                              <div className="relative mx-auto flex h-32 w-24 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white shadow-inner">
                                <span
                                  className="pointer-events-none select-none break-all text-center text-[11px] font-bold leading-tight"
                                  style={{
                                    color: watermarkColor,
                                    opacity: parseFloat(watermarkOpacity),
                                    transform: "rotate(-35deg)",
                                    fontFamily:
                                      watermarkFont === "tiro"
                                        ? "Times New Roman, serif"
                                        : watermarkFont === "cour"
                                          ? "Courier New, monospace"
                                          : "Helvetica, Arial, sans-serif",
                                    maxWidth: "90%",
                                  }}
                                >
                                  {watermarkPhrase ||
                                    (language === "tr"
                                      ? "FİLİGRAN"
                                      : "WATERMARK")}
                                </span>
                              </div>
                            </div>
                            <label className="field">
                              <span>
                                {language === "tr"
                                  ? "Filigran metni"
                                  : "Watermark text"}
                              </span>
                              <input
                                type="text"
                                value={watermarkPhrase}
                                onChange={(e) =>
                                  setWatermarkPhrase(e.target.value)
                                }
                                maxLength={120}
                                placeholder={
                                  language === "tr"
                                    ? "örn. GİZLİ"
                                    : "e.g. CONFIDENTIAL"
                                }
                              />
                            </label>
                            <div className="field">
                              <span>
                                {language === "tr" ? "Renk" : "Color"}
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Hazır renkler */}
                                {[
                                  "#8C8C8C",
                                  "#CC0000",
                                  "#0057B8",
                                  "#007A33",
                                  "#E6A817",
                                  "#4B0082",
                                  "#000000",
                                ].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    title={c}
                                    onClick={() => setWatermarkColor(c)}
                                    className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                    style={{
                                      background: c,
                                      borderColor:
                                        watermarkColor === c
                                          ? "white"
                                          : "transparent",
                                    }}
                                  />
                                ))}
                                <input
                                  type="color"
                                  value={watermarkColor}
                                  onChange={(e) =>
                                    setWatermarkColor(e.target.value)
                                  }
                                  title={
                                    language === "tr"
                                      ? "Özel renk"
                                      : "Custom color"
                                  }
                                  className="h-7 w-7 cursor-pointer rounded-full border border-white/20 bg-transparent p-0"
                                  style={{ padding: 0 }}
                                />
                                <span className="font-mono text-xs text-white/40">
                                  {watermarkColor}
                                </span>
                              </div>
                            </div>
                            <label className="field">
                              <span>
                                {language === "tr" ? "Yazı tipi" : "Font"}
                              </span>
                              <select
                                value={watermarkFont}
                                onChange={(e) =>
                                  setWatermarkFont(e.target.value)
                                }
                              >
                                <option value="helv">Helvetica</option>
                                <option value="tiro">Times New Roman</option>
                                <option value="cour">Courier New</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>
                                {language === "tr" ? "Saydamlık" : "Opacity"}{" "}
                                <span className="text-white/40">
                                  {Math.round(
                                    parseFloat(watermarkOpacity) * 100,
                                  )}
                                  %
                                </span>
                              </span>
                              <input
                                type="range"
                                min="0.05"
                                max="0.50"
                                step="0.05"
                                value={watermarkOpacity}
                                onChange={(e) =>
                                  setWatermarkOpacity(e.target.value)
                                }
                                className="w-full accent-cyan-400"
                              />
                            </label>
                          </>
                        ) : null}

                        {selectedFeature.id === "page-numbers" ? (
                          <>
                            <label className="field">
                              <span>
                                {language === "tr"
                                  ? "Numaraya başlama"
                                  : "Start number"}
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={pageNumStart}
                                onChange={(e) =>
                                  setPageNumStart(e.target.value)
                                }
                              />
                            </label>
                            <label className="field">
                              <span>
                                {language === "tr" ? "Konum" : "Position"}
                              </span>
                              <select
                                value={pageNumPos}
                                onChange={(e) =>
                                  setPageNumPos(
                                    e.target.value as "footer" | "header",
                                  )
                                }
                              >
                                <option value="footer">
                                  {language === "tr" ? "Alt bilgi" : "Footer"}
                                </option>
                                <option value="header">
                                  {language === "tr" ? "Üst bilgi" : "Header"}
                                </option>
                              </select>
                            </label>
                            <label className="field">
                              <span>
                                {language === "tr" ? "Biçim" : "Format"}
                              </span>
                              <select
                                value={pageNumFmt}
                                onChange={(e) =>
                                  setPageNumFmt(
                                    e.target.value as "plain" | "page" | "of",
                                  )
                                }
                              >
                                <option value="plain">1, 2, 3 …</option>
                                <option value="page">
                                  {language === "tr"
                                    ? "Sayfa 1, Sayfa 2 …"
                                    : "Page 1, Page 2 …"}
                                </option>
                                <option value="of">1 / 10, 2 / 10 …</option>
                              </select>
                            </label>
                          </>
                        ) : null}

                        {selectedFeature.id === "pdf-to-image" ? (
                          <label className="field">
                            <span>
                              {language === "tr"
                                ? "Görüntü biçimi"
                                : "Image format"}
                            </span>
                            <select
                              value={pdfToImgFmt}
                              onChange={(e) => setPdfToImgFmt(e.target.value)}
                            >
                              <option value="jpg">JPG</option>
                              <option value="png">PNG</option>
                            </select>
                          </label>
                        ) : null}

                        {showSplitPasswordField ? (
                          <label className="field">
                            <span>{W.sourcePassword}</span>
                            <input
                              type="password"
                              value={password}
                              onChange={(event) =>
                                setPassword(event.target.value)
                              }
                              placeholder={
                                language === "tr"
                                  ? "PDF parolası"
                                  : "PDF password"
                              }
                            />
                            <span className="field-hint">
                              {W.sourcePasswordHint}
                            </span>
                          </label>
                        ) : null}

                        {selectedFeature.id === "ppt-to-pdf" ? (
                          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                            {language === "tr"
                              ? "Windows ve yüklü Microsoft PowerPoint ile en iyi sonuç alınır; diğer ortamlarda dönüşüm desteklenmeyebilir."
                              : "Best results on Windows with Microsoft PowerPoint installed. Other environments may not support conversion."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "pdf-to-word" ? (
                          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200/90">
                            {language === "tr"
                              ? "Düz metin içerikli PDF'lerde iyi sonuç alınır. Karmaşık düzen, tablo ve görseller tam olarak korunamayabilir."
                              : "Works well for text-based PDFs. Complex layouts, tables, and images may not be fully preserved."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "pdf-to-excel" ? (
                          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200/90">
                            {language === "tr"
                              ? "Tablo içeren PDF'lerde en iyi sonucu verir. Tablolar ve hücreler mükemmel korunamayabilir; sonucu gözden geçirmeniz önerilir."
                              : "Best for PDFs with tables. Cell structure may not be perfectly preserved; review the result before use."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "pdf-to-ppt" ? (
                          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200/90">
                            {language === "tr"
                              ? "Her sayfa bir slayta dönüştürülür. Animasyon ve özel geçişler desteklenmez; çıktı salt görüntü içerebilir."
                              : "Each page is converted to one slide. Animations and transitions are not supported; output may contain image-based slides."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "word-to-pdf" ? (
                          <div className="rounded-lg border border-green-400/20 bg-green-500/10 px-3 py-2 text-xs text-green-200/90">
                            {language === "tr"
                              ? "En iyi sonuç için Microsoft Word yüklü bir ortamda çalışır. Bazı yazı tipleri veya karmaşık biçimlendirmeler tam olarak aktarılamayabilir."
                              : "Best results when Microsoft Word is available on the server. Some fonts or complex formatting may not transfer perfectly."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "excel-to-pdf" ? (
                          <div className="rounded-lg border border-green-400/20 bg-green-500/10 px-3 py-2 text-xs text-green-200/90">
                            {language === "tr"
                              ? "Tüm sayfalar PDF'e aktarılır. Yazdırma alanı dışındaki içerikler kesilebilir; sayfa düzenini önceden kontrol edin."
                              : "All sheets are exported to PDF. Content outside print areas may be clipped; check your page layout first."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "html-to-pdf" ? (
                          <div className="rounded-lg border border-slate-400/20 bg-slate-500/10 px-3 py-2 text-xs text-slate-300/90">
                            {language === "tr"
                              ? "CSS ve JavaScript desteklenir ancak harici kaynaklar (CDN fontları, uzak görseller) sunucuda yüklenemeyebilir."
                              : "CSS and JavaScript are supported, but external resources (CDN fonts, remote images) may not load on the server."}
                          </div>
                        ) : null}

                        {selectedFeature.id === "compress" ? (
                          <label className="field">
                            <span>
                              {language === "tr" ? "Kalite" : "Quality"}
                            </span>
                            <select
                              value={compressQuality}
                              onChange={(e) =>
                                setCompressQuality(
                                  e.target.value as
                                    | "auto"
                                    | "low"
                                    | "medium"
                                    | "high",
                                )
                              }
                            >
                              <option value="auto">
                                {language === "tr"
                                  ? "Otomatik (önerilen)"
                                  : "Auto (recommended)"}
                              </option>
                              <option value="low">
                                {language === "tr"
                                  ? "Düşük — ekran kalitesi"
                                  : "Low — screen quality"}
                              </option>
                              <option value="medium">
                                {language === "tr"
                                  ? "Orta — e-kitap kalitesi"
                                  : "Medium — e-book quality"}
                              </option>
                              <option value="high">
                                {language === "tr"
                                  ? "Yüksek — baskı kalitesi"
                                  : "High — print quality"}
                              </option>
                            </select>
                          </label>
                        ) : null}

                        {selectedFeature.id === "encrypt" ? (
                          <>
                            {showEncryptSourcePasswordField ? (
                              <label className="field field--full">
                                <span>{W.sourcePassword}</span>
                                <input
                                  type="password"
                                  value={inputPassword}
                                  onChange={(event) =>
                                    setInputPassword(event.target.value)
                                  }
                                  placeholder={
                                    language === "tr"
                                      ? "Mevcut PDF parolası"
                                      : "Current PDF password"
                                  }
                                />
                                <span className="field-hint">
                                  {W.sourcePasswordHint}
                                </span>
                              </label>
                            ) : null}

                            <label className="field field--full">
                              <span>{W.newPdfPassword}</span>
                              <input
                                type="password"
                                value={outputPassword}
                                disabled={uploads.length === 0}
                                onChange={(event) =>
                                  setOutputPassword(event.target.value)
                                }
                                placeholder={
                                  uploads.length === 0 ? "" : W.newPdfPasswordPh
                                }
                              />
                            </label>
                          </>
                        ) : null}

                        {toolNeedsUpload ? (
                          <div className="selected-files">
                            <div className="selected-files__header">
                              <div className="selected-files__title-row">
                                <p>{W.selectedFiles}</p>
                                {selectedFeature.id === "merge" &&
                                uploads.length > 0 ? (
                                  <button
                                    type="button"
                                    className="nb-transition shrink-0 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200/95 hover:border-rose-400/55 hover:bg-rose-950/50 sm:text-sm"
                                    onClick={clearAllUploads}
                                  >
                                    {W.mergeClearAll}
                                  </button>
                                ) : null}
                              </div>
                              {selectedFeature.id === "merge" &&
                              uploads.length > 0 ? (
                                <span className="selected-files__info">
                                  {W.mergeReorderHint}
                                </span>
                              ) : null}
                            </div>
                            {uploads.length === 0 &&
                            selectedFeature.id === "html-to-pdf" ? (
                              <p className="px-1 py-4 text-sm text-nb-muted">
                                {language === "tr"
                                  ? "Dosya gerekmez; yukarıdaki URL veya HTML alanını doldurun."
                                  : "No file needed — fill in the URL or HTML field above."}
                              </p>
                            ) : uploads.length === 0 ? (
                              <EmptyState
                                title={W.emptyStateTitle}
                                hint={W.emptyStateHint}
                              />
                            ) : (
                              <div
                                ref={mergeListScrollRef}
                                className="selected-files__list"
                              >
                                {uploads.map((item, index) => {
                                  const compressEst =
                                    selectedFeature.id === "compress" &&
                                    !item.inspecting
                                      ? compressEstimatePercentRange(
                                          item.file.size,
                                        )
                                      : null;
                                  const dragFromIdx =
                                    mergePointerDraggingId !== null
                                      ? uploads.findIndex(
                                          (u) =>
                                            u.id === mergePointerDraggingId,
                                        )
                                      : -1;
                                  const dragToIdx =
                                    mergeDragOverIndex ?? dragFromIdx;
                                  const previewOff =
                                    mergePointerDraggingId && dragFromIdx >= 0
                                      ? getReorderPreviewOffset(
                                          index,
                                          dragFromIdx,
                                          dragToIdx,
                                          mergeDragSlotPx,
                                        )
                                      : 0;
                                  return (
                                    <div
                                      key={item.id}
                                      data-merge-row-index={index}
                                      className={`selected-file-card ${selectedFeature.id === "merge" ? "draggable merge-row-pointer" : ""} ${
                                        mergePointerDraggingId === item.id
                                          ? "selected-file-card--drag-source"
                                          : ""
                                      } ${
                                        mergeDragOverIndex === index &&
                                        mergePointerDraggingId &&
                                        mergePointerDraggingId !== item.id
                                          ? "selected-file-card--drop-target"
                                          : ""
                                      } ${mergeSnapId === item.id ? "selected-file-card--snap" : ""}`}
                                      style={
                                        mergePointerDraggingId &&
                                        dragFromIdx >= 0
                                          ? {
                                              transform: `translateY(${previewOff}px)`,
                                              transition:
                                                index === dragFromIdx
                                                  ? "none"
                                                  : "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                                            }
                                          : undefined
                                      }
                                      onPointerDown={(e) =>
                                        handleMergeRowPointerDown(
                                          e,
                                          index,
                                          item.id,
                                        )
                                      }
                                    >
                                      <div className="selected-file-card__main">
                                        <div className="selected-file-card__lead">
                                          <div
                                            className="selected-file-card__icon"
                                            aria-hidden
                                          >
                                            <svg
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              className="selected-file-card__icon-svg"
                                            >
                                              <path
                                                d="M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l-6-6Z"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinejoin="round"
                                              />
                                              <path
                                                d="M14 2v6h6"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinejoin="round"
                                              />
                                              <path
                                                d="M8 14h8M8 18h5"
                                                stroke="currentColor"
                                                strokeWidth="1.25"
                                                strokeLinecap="round"
                                              />
                                            </svg>
                                          </div>
                                          <div className="selected-file-card__text">
                                            <strong>{item.file.name}</strong>
                                            <div className="selected-file-card__meta">
                                              <span className="selected-file-card__size">
                                                {formatFileSize(item.file.size)}
                                              </span>
                                              {compressEst ? (
                                                <span
                                                  className="selected-file-card__compress"
                                                  title={
                                                    W.compressEstimateTooltip
                                                  }
                                                >
                                                  {W.compressEstimateLine(
                                                    compressEst.min,
                                                    compressEst.max,
                                                  )}
                                                </span>
                                              ) : null}
                                              {item.inspecting ? (
                                                <span>{W.inspecting}</span>
                                              ) : null}
                                              {!item.inspecting &&
                                              item.encrypted ? (
                                                <span className="warning-text">
                                                  {W.encryptedBadge}
                                                </span>
                                              ) : null}
                                              {!item.inspecting &&
                                              !item.encrypted ? (
                                                <span>{W.ready}</span>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="selected-file-card__actions flex shrink-0 items-center gap-1">
                                          {selectedFeature.id === "merge" ? (
                                            <>
                                              <button
                                                type="button"
                                                draggable={false}
                                                className="nb-transition rounded-lg border border-white/[0.12] bg-nb-panel/80 px-2 py-1 text-xs font-semibold text-nb-text hover:border-nb-primary/40 disabled:opacity-35"
                                                disabled={index === 0}
                                                onClick={() =>
                                                  moveUploadUp(index)
                                                }
                                                aria-label={W.up}
                                              >
                                                ↑
                                              </button>
                                              <button
                                                type="button"
                                                draggable={false}
                                                className="nb-transition rounded-lg border border-white/[0.12] bg-nb-panel/80 px-2 py-1 text-xs font-semibold text-nb-text hover:border-nb-primary/40 disabled:opacity-35"
                                                disabled={
                                                  index >= uploads.length - 1
                                                }
                                                onClick={() =>
                                                  moveUploadDown(index)
                                                }
                                                aria-label={W.down}
                                              >
                                                ↓
                                              </button>
                                            </>
                                          ) : null}
                                          <button
                                            type="button"
                                            draggable={false}
                                            className="remove-button"
                                            onClick={() =>
                                              removeUpload(item.id)
                                            }
                                            aria-label={`${W.remove}: ${item.file.name}`}
                                          >
                                            <svg
                                              className="remove-button__glyph"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              aria-hidden
                                            >
                                              <path
                                                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </svg>
                                            <span>{W.remove}</span>
                                          </button>
                                        </div>
                                      </div>

                                      {selectedFeature.id === "merge" &&
                                      item.encrypted ? (
                                        <div className="mt-3 rounded-xl border border-white/[0.1] bg-nb-panel/50 px-4 py-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nb-muted">
                                            {language === "tr"
                                              ? "Şifre gerekli"
                                              : "Password required"}
                                          </p>
                                          <p className="mt-1 text-sm leading-snug text-nb-text/90">
                                            {W.mergeEncryptedAlert}
                                          </p>
                                          <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <input
                                              type="password"
                                              className="min-w-[180px] flex-1 rounded-lg border border-white/12 bg-nb-bg/90 px-3 py-2.5 text-sm text-nb-text shadow-sm placeholder:text-nb-muted focus:border-nb-primary/45 focus:outline-none focus:ring-2 focus:ring-nb-primary/25"
                                              value={item.password}
                                              onChange={(event) =>
                                                setUploadPassword(
                                                  item.id,
                                                  event.target.value,
                                                )
                                              }
                                              placeholder={W.perFilePasswordPh}
                                              autoComplete="off"
                                            />
                                            <button
                                              type="button"
                                              className="nb-transition rounded-lg border border-nb-primary/35 bg-nb-primary/15 px-3 py-2.5 text-sm font-semibold text-nb-accent hover:bg-nb-primary/25 disabled:opacity-45"
                                              disabled={
                                                mergeVerifyingId === item.id ||
                                                !item.password.trim()
                                              }
                                              onClick={() =>
                                                void verifyMergeFilePassword(
                                                  item.id,
                                                )
                                              }
                                            >
                                              {mergeVerifyingId === item.id
                                                ? W.mergePasswordVerifying
                                                : W.mergePasswordConfirm}
                                            </button>
                                            {item.mergePasswordVerified ? (
                                              <span
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/45 bg-cyan-950/40 text-cyan-300"
                                                title={W.mergePasswordOk}
                                                aria-label={W.mergePasswordOk}
                                              >
                                                <svg
                                                  className="h-5 w-5"
                                                  fill="none"
                                                  viewBox="0 0 24 24"
                                                  stroke="currentColor"
                                                  strokeWidth={2}
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                                  />
                                                </svg>
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {selectedFeature.id === "merge" &&
                        uploads.length > 0 &&
                        (toolFilesStillInspecting ||
                          mergeHasMissingPasswords) ? (
                          <div className="merge-hint-banner" role="note">
                            <span
                              className="merge-hint-banner__dot"
                              aria-hidden
                            />
                            <p className="merge-hint-banner__text">
                              {toolFilesStillInspecting
                                ? W.mergeButtonHintInspecting
                                : W.mergeButtonHintPassword}
                            </p>
                          </div>
                        ) : null}

                        <button
                          className="primary-action"
                          type="submit"
                          disabled={submitDisabled}
                        >
                          {submitting
                            ? premiumProcessingLane
                              ? W.processingPremium
                              : W.processing
                            : selectedFeature.buttonText}
                        </button>
                      </form>
                    </div>
                    {!selectedFeatureAllowed ? (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-nb-bg/70 px-5 text-center backdrop-blur-sm">
                        <p className="text-base font-semibold text-nb-text">
                          {W.proGateTitle}
                        </p>
                        <p className="mt-2 max-w-sm text-sm leading-relaxed text-nb-muted">
                          {W.proGateBody}
                        </p>
                        <button
                          type="button"
                          className="primary-action mt-5"
                          onClick={() => setUpgradeModalOpen(true)}
                        >
                          {W.proGateCta}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}
          </div>
          {TOOLSuccessBarActive && toolProgressSuccess ? (
            <div
              className="merge-progress-fixed merge-progress-fixed--success tool-success-shell"
              role="status"
              aria-live="polite"
            >
              <div className="merge-progress-fixed__inner tool-success-shell__card">
                <div className="tool-success-shell__row">
                  <div
                    className="tool-success-shell__mark"
                    aria-hidden="true"
                  />
                  <div className="tool-success-shell__text">
                    <strong className="tool-success-shell__title">
                      {W.toolProgressSuccessTitle}
                    </strong>
                    <p className="tool-success-shell__subtitle">
                      {toolProgressSuccess.featureTitle} ·{" "}
                      {toolProgressSuccess.filename}
                    </p>
                  </div>
                  <span className="tool-success-shell__pill" aria-hidden="true">
                    %100
                  </span>
                </div>
                <div
                  className="tool-success-shell__meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={100}
                  aria-label={W.toolProgressSuccessTitle}
                >
                  <span className="tool-success-shell__meter-fill" />
                </div>
                {toolProgressSuccess.gatedDownload ? (
                  <SaasGatedPreview
                    gating={
                      toolProgressSuccess.gatedDownload.saasGating ?? null
                    }
                    language={language}
                    filename={toolProgressSuccess.filename}
                    thumbnailUrl={
                      toolProgressSuccess.gatedDownload.thumbnailBlobUrl
                    }
                    onOpenFullPreview={() => {
                      const gd = toolProgressSuccess.gatedDownload;
                      if (!gd) {
                        return;
                      }
                      if (gd.mergeJobId) {
                        setGatedHeroResultId(null);
                        setGatedHeroMergeJobId(gd.mergeJobId);
                        setGatedHeroModalOpen(true);
                        return;
                      }
                      if (gd.resultId) {
                        setGatedHeroMergeJobId(null);
                        setGatedHeroResultId(gd.resultId);
                        setGatedHeroModalOpen(true);
                      }
                    }}
                    onDownload={() => {
                      const gd = toolProgressSuccess.gatedDownload;
                      if (!gd) {
                        return;
                      }
                      if (gd.mergeJobId) {
                        queueMergeGatedDownload(gd.mergeJobId, gd.fallbackName);
                        return;
                      }
                      if (gd.resultId) {
                        queueGatedDownload(
                          gd.resultId,
                          gd.fallbackName,
                          gd.toolId,
                        );
                      }
                    }}
                    onUpgrade={() => openConversionUpgradeModalManual()}
                    onInsufficientCredits={() => {
                      setUpgradeModalOpen(true);
                    }}
                    onRetry={() => {
                      const gd = toolProgressSuccess.gatedDownload;
                      if (!gd) return;
                      if (gd.mergeJobId) {
                        queueMergeGatedDownload(gd.mergeJobId, gd.fallbackName);
                        return;
                      }
                      if (gd.resultId) {
                        queueGatedDownload(gd.resultId, gd.fallbackName, gd.toolId);
                      }
                    }}
                    onDismiss={dismissToolSuccessBar}
                    dismissLabel={W.toolProgressDismiss}
                  />
                ) : (
                  <div className="merge-progress-fixed__success-actions">
                    {toolProgressSuccess.replay ? (
                      <button
                        type="button"
                        className="merge-progress-fixed__download"
                        onClick={() => toolProgressSuccess.replay?.()}
                      >
                        {W.toolDownloadAgain}
                      </button>
                    ) : (
                      <p className="merge-progress-fixed__native-hint">
                        {W.toolProgressNativeDownloadHint}
                      </p>
                    )}
                    <button
                      type="button"
                      className="merge-progress-fixed__dismiss"
                      onClick={dismissToolSuccessBar}
                    >
                      {W.toolProgressDismiss}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {TOOLSuccessBarActive ? null : mergeProgressActive && mergeJob ? (
            <div
              className="merge-progress-fixed"
              role="status"
              aria-live="polite"
            >
              <div className="merge-progress-fixed__inner">
                <div className="merge-progress-fixed__head">
                  <div className="merge-progress-fixed__titles">
                    <strong className="merge-progress-fixed__title">
                      {mergeJob.status === "failed"
                        ? language === "tr"
                          ? "Birleştirme başarısız"
                          : "Merge failed"
                        : selectedFeature.title}
                    </strong>
                    {mergeJob.status !== "failed" ? (
                      <p className="merge-progress-fixed__phase">
                        {mergeJob.id === MERGE_JOB_PENDING_ID
                          ? premiumProcessingLane
                            ? W.mergeProgressQueuePremium
                            : W.mergeProgressStarting
                          : mergeToolPhaseLabel(
                              mergeJob,
                              mergeProgressIndeterminate,
                              W,
                            )}
                      </p>
                    ) : null}
                  </div>
                  {showToolCancelButton ? (
                    <button
                      type="button"
                      className="nb-transition shrink-0 rounded-lg border border-white/14 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-nb-muted hover:border-cyan-500/30 hover:text-cyan-100"
                      onClick={handleCancelCurrentOperation}
                    >
                      {W.toolRunCancel}
                    </button>
                  ) : null}
                  <span className="merge-progress-fixed__pct">
                    {mergeProgressIndeterminate ? "…" : `%${mergeJob.percent}`}
                  </span>
                </div>
                <div
                  className={`progress-bar progress-bar--merge progress-bar--gradient ${mergeProgressIndeterminate ? "progress-bar--indeterminate" : ""} ${mergeJob.status === "failed" ? "progress-bar--failed" : ""}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    mergeProgressIndeterminate
                      ? undefined
                      : mergeJob.status === "failed"
                        ? 100
                        : mergeJob.percent
                  }
                  aria-label={
                    mergeToolPhaseLabel(
                      mergeJob,
                      mergeProgressIndeterminate,
                      W,
                    ) || selectedFeature.title
                  }
                >
                  {mergeProgressIndeterminate ? (
                    <div className="progress-bar__fill progress-bar__fill--indeterminate" />
                  ) : (
                    <div
                      className="progress-bar__fill progress-bar__fill--gradient"
                      style={{
                        width: `${mergeJob.status === "failed" ? 100 : Math.max(mergeJob.percent, 2)}%`,
                      }}
                    />
                  )}
                </div>
                <div className="merge-progress-fixed__meta">
                  <span>
                    {mergeJob.total > 1
                      ? W.mergeFileProgress(
                          mergeJob.current,
                          mergeJob.total,
                          mergeJob.where,
                        )
                      : `${W.mergeStatus}: ${mergeJob.current}/${mergeJob.total}${
                          mergeJob.where ? ` · ${mergeJob.where}` : ""
                        }`}
                  </span>
                  {mergeEtaSeconds !== null &&
                  mergeJob.status === "running" &&
                  !mergeProgressIndeterminate ? (
                    <span className="merge-progress-fixed__eta">
                      {W.mergeEtaLine(mergeEtaSeconds)}
                    </span>
                  ) : null}
                </div>
                {mergeJob.status === "failed" ? (
                  <p className="merge-progress-fixed__err">
                    {friendlyOperationFailedMessage(language)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {TOOLSuccessBarActive ? null : genericToolProgressActive ? (
            <div
              className="merge-progress-fixed merge-progress-fixed--generic"
              role="status"
              aria-live="polite"
            >
              <div className="merge-progress-fixed__inner">
                <div className="merge-progress-fixed__head">
                  <div className="merge-progress-fixed__titles">
                    <strong className="merge-progress-fixed__title">
                      {selectedFeature.title}
                    </strong>
                    <p className="merge-progress-fixed__phase">
                      {genericToolPhaseLabel(
                        selectedFeatureId,
                        genericToolPercent,
                        genericProgressIndeterminate,
                        W,
                        false,
                      )}
                    </p>
                  </div>
                  {showToolCancelButton ? (
                    <button
                      type="button"
                      className="nb-transition shrink-0 rounded-lg border border-white/14 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-nb-muted hover:border-cyan-500/30 hover:text-cyan-100"
                      onClick={handleCancelCurrentOperation}
                    >
                      {W.toolRunCancel}
                    </button>
                  ) : null}
                  <span className="merge-progress-fixed__pct">
                    {genericProgressIndeterminate
                      ? "…"
                      : `%${genericToolPercent}`}
                  </span>
                </div>
                <div
                  className={`progress-bar progress-bar--merge progress-bar--gradient ${genericProgressIndeterminate ? "progress-bar--indeterminate" : ""}`}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    genericProgressIndeterminate
                      ? undefined
                      : genericToolPercent
                  }
                  aria-label={genericToolPhaseLabel(
                    selectedFeatureId,
                    genericToolPercent,
                    genericProgressIndeterminate,
                    W,
                    false,
                  )}
                >
                  {genericProgressIndeterminate ? (
                    <div className="progress-bar__fill progress-bar__fill--indeterminate" />
                  ) : (
                    <div
                      className="progress-bar__fill progress-bar__fill--gradient"
                      style={{ width: `${genericToolPercent}%` }}
                    />
                  )}
                </div>
                <div className="merge-progress-fixed__meta merge-progress-fixed__meta--generic">
                  <span>
                    {premiumProcessingLane
                      ? W.toolProgressSubPremium
                      : W.toolProgressSub}
                  </span>
                  {genericToolFileMb >= 5 ? (
                    <span className="merge-progress-fixed__eta">
                      {W.toolProgressLargeFileHint(genericToolFileMb)}
                    </span>
                  ) : null}
                  {genericToolElapsedSec >= 1 ? (
                    <span className="merge-progress-fixed__eta">
                      {W.toolProgressElapsed(genericToolElapsedSec)}
                    </span>
                  ) : null}
                  {genericToolRemainingSec > 0 && genericToolElapsedSec >= 4 ? (
                    <span className="merge-progress-fixed__eta">
                      {W.mergeEtaLine(genericToolRemainingSec)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="footer-bar">
          <span>PDF PLATFORM</span>
          <span>by NB Global Studio</span>
          <div className="footer-bar__right">
            <span>Web Edition</span>
            <button type="button" onClick={() => openLegalPage("terms")}>
              {language === "tr" ? "HİZMET ŞARTLARI" : "TERMS OF SERVICE"}
            </button>
            <button type="button" onClick={() => openLegalPage("privacy")}>
              {language === "tr" ? "GİZLİLİK POLİTİKASI" : "PRIVACY POLICY"}
            </button>
            <button type="button" onClick={() => openLegalPage("kvkk")}>
              {language === "tr" ? "KVKK" : "KVKK DISCLOSURE"}
            </button>
            <button type="button" onClick={openContactModal}>
              {language === "tr" ? "İLETİŞİM" : "CONTACT"}
            </button>
          </div>
        </footer>

        <CookieNotice
          language={language}
          visible={shouldShowCookieNotice}
          onAccept={acceptConsent}
          onOpenPrivacy={() => openLegalPage("privacy")}
        />
      </div>
    </CheckoutCurrencyProvider>
  );
}

export default App;
