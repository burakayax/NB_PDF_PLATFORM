// Web uygulamasının kök bileşeni: karşılama, kimlik, yasal sayfalar ve PDF araçları görünümlerini tek state ile yönetir.
// Oturum, abonelik ve dosya yükleme durumunun modüller arasında paylaşılması için tek React ağacında toplanır.
// Bu bileşen parçalanırsa üst düzey hook ve görünüm geçişleri yeniden kablolanmak zorunda kalır.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMergeJob,
  downloadFromApi,
  postToolToResult,
  downloadMergeJob,
  downloadResult,
  EntitlementPaymentRequiredError,
  fetchMergeJob,
  fetchResultThumbnailBlobUrl,
  inspectPdf,
  MergeJobNotFoundError,
  requestMergeJobCancel,
  type MergeJobStatus,
} from "./api";
import { submitContactForm } from "./api/contact";
import { CookieNotice } from "./components/common/CookieNotice";
import { SplitPagePickerModal } from "./components/split/SplitPagePickerModal";
import { SaasGatedPreview } from "./components/SaasGatedPreview";
import { SystemNotificationBanner } from "./components/common/SystemNotificationBanner";
import type { SaaSGating } from "./lib/saasGating";
import { DashboardSidebar, DashboardSidebarMobileRail, type SidebarToolId } from "./components/dashboard/DashboardSidebar";
import { DashboardTopNav } from "./components/dashboard/DashboardTopNav";
import { ChangePasswordModal } from "./components/dashboard/ChangePasswordModal";
import { AdminPanel } from "./admin/AdminPanel";
import { ConversionPopup } from "./components/dashboard/ConversionPopup";
import { ConversionUpgradeModal } from "./components/dashboard/ConversionUpgradeModal";
import { PaymentSummaryModal } from "./components/dashboard/PaymentSummaryModal";
import { UpgradeModal } from "./components/dashboard/UpgradeModal";
import { UserProfilePanel } from "./components/dashboard/UserProfilePanel";
import { userGreetingLine } from "./components/dashboard/userDisplayName";
import { AuthPage } from "./components/auth/AuthPage";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";
import { LoginSuccessPage } from "./components/auth/LoginSuccessPage";
import { LandingPage } from "./components/landing/LandingPage";
import { LegalPage } from "./components/legal/LegalPage";
import {
  fetchSubscriptionStatus,
  fetchSubscriptionSummary,
  type FeatureKey,
  type SubscriptionSummary,
} from "./api/subscription";
import {
  fetchCreditTransactions,
  ackDownloadLog,
  createDownloadLog,
  fetchUserBalance,
  type CreditTransaction,
  type UserBalance,
} from "./api/entitlement";
import {
  confirmFakeCheckout,
  PAYMENT_CHECKOUT_NOT_FOUND,
  resolveFakePaymentRedirect,
  startFakeCheckout,
  type FakePaymentProduct,
} from "./api/fakePayment";
import { CreditDashboard } from "./components/dashboard/CreditDashboard";
import {
  canAutoShowConversionModal,
  conversionModalClickThroughRate,
  CONV_MODAL_SNOOZE_MS,
  CONV_MODAL_SNOOZE_UNTIL_KEY,
  pushConversionModalAnalytics,
  recordConversionModalDismiss,
  recordConversionModalPrimaryClick,
  recordConversionModalShown,
} from "./lib/conversionModalTriggers";
import {
  clearLowCreditSnoozeIfRecovered,
  getLowCreditPopupSnoozeUntil,
  hasShownFirstToolFailurePopup,
  hasShownFirstUpgradeOpPopup,
  markFirstToolFailurePopupShown,
  markFirstUpgradeOpPopupShown,
  snoozeLowCreditPopup,
} from "./lib/conversionPopupTriggers";
import type { ConversionPopupVariant } from "./i18n/conversionPopup";
import { translateAuthApiMessage } from "./i18n/auth";
import {
  featureCopy,
  sidebarToolLabel,
  validatePagesFormat,
  validatePagesMax,
  ws,
} from "./i18n/workspace";
import { getCmsWorkspaceBanner } from "./lib/landingCmsMerge";
import {
  buildWorkspaceFeaturesFromCms,
  isResultStoreTool,
  type WorkspaceFeatureUi,
} from "./lib/workspaceFeatures";
import { useAnalyticsTracking } from "./hooks/useAnalyticsTracking";
import { useAuthSession } from "./hooks/useAuthSession";
import { useSettings } from "./hooks/useSettings";
import { isCreditPackProduct, type CreditPackProduct } from "./lib/creditPacks";
import { useCookieConsent } from "./hooks/useCookieConsent";
import { useErrorLogging } from "./hooks/useErrorLogging";
import { usePreferredLanguage } from "./hooks/usePreferredLanguage";
import { sanitizeDownloadBasename } from "./lib/sanitizeDownloadBasename";

type FeatureId = FeatureKey;

type NonLegalView = "landing" | "login" | "register" | "forgot_password" | "web" | "admin";
type LegalView = "terms" | "privacy";
type AppView = NonLegalView | LegalView;
type ToastType = "success" | "error" | "loading" | "info";

type ContentPanel = "tool" | "subscription" | "profile";

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

// PDF ön incelemesi (şifreli mi) gerektiren modül kimlikleri; inspect isteği bu listeye göre tetiklenir.
// Parola alanlarının görünürlüğü modül bazında olduğundan hangi işlemlerin inceleme istediği açıkça seçilmelidir.
// Liste backend veya UI ile senkron bozulursa şifreli dosyada parola alanı çıkmaz veya gereksiz istek atılır.
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function EmptyState({ title, hint, compact = false }: { title: string; hint: string; compact?: boolean }) {
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
function compressEstimatePercentRange(bytes: number): { min: number; max: number } {
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
      <p className="text-[12px] font-medium leading-relaxed text-cyan-100/90">{W.upgradeNudgeTierBody(tier)}</p>
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

function mergeToolPhaseLabel(job: MergeJobStatus, indeterminate: boolean, W: ReturnType<typeof ws>): string {
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
function mergePointerYToIndex(clientY: number, container: HTMLElement | null): number {
  if (!container) {
    return 0;
  }
  const cards = [...container.querySelectorAll("[data-merge-row-index]")] as HTMLElement[];
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
function getReorderPreviewOffset(index: number, from: number, to: number, slot: number): number {
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

/** createMergeJob yanıtı gelene kadar UI’da anında gösterilen yer tutucu iş kimliği. */
const MERGE_JOB_PENDING_ID = "__merge_pending__";

function getTrackedViewName(view: AppView) {
  switch (view) {
    case "landing":
      return "landing";
    case "login":
      return "auth-login";
    case "register":
      return "auth-register";
    case "forgot_password":
      return "auth-forgot-password";
    case "terms":
      return "legal-terms";
    case "privacy":
      return "legal-privacy";
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
    case "web":
      return "/workspace";
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
    case "/workspace":
      return "web";
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
    requestedView === "terms" ||
    requestedView === "privacy"
  ) {
    return requestedView;
  }
  return "landing";
}

function App() {
  const { language, setLanguage, detectInitialLanguage } = usePreferredLanguage();
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
  const { hasConsent, isReady: isCookieConsentReady, acceptConsent } = useCookieConsent();
  const { cms, site, TOOLSPublic, flags } = useSettings();
  const [view, setView] = useState<AppView>(getInitialViewFromLocation);
  const [legalBackView, setLegalBackView] = useState<NonLegalView>("landing");
  const [selectedFeatureId, setSelectedFeatureId] = useState<FeatureId>("split");
  const [contentPanel, setContentPanel] = useState<ContentPanel>("tool");
  const [activeSidebar, setActiveSidebar] = useState<SidebarToolId>("split");
  const [submitting, setSubmitting] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [registrationSuccessBanner, setRegistrationSuccessBanner] = useState<string | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
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
      localStorage.setItem(splitDraftStorageKey, JSON.stringify({ pagesText, splitMode, v: 1 }));
    } catch {
      /* ignore */
    }
  }, [pagesText, splitMode, selectedFeatureId, splitDraftStorageKey]);

  const [outputPassword, setOutputPassword] = useState("");
  const [deletePagesText, setDeletePagesText] = useState("");
  const [deletePagesError, setDeletePagesError] = useState("");
  const [rotateDeg, setRotateDeg] = useState("90");
  const [rotatePagesOnly, setRotatePagesOnly] = useState("");
  const [organizeOrder, setOrganizeOrder] = useState("");
  const [unlockOpenPassword, setUnlockOpenPassword] = useState("");
  const [watermarkPhrase, setWatermarkPhrase] = useState("TASLAK");
  const [pageNumStart, setPageNumStart] = useState("1");
  const [pageNumPos, setPageNumPos] = useState<"footer" | "header">("footer");
  const [pdfToPptDpi, setPdfToPptDpi] = useState("150");
  const [pdfToImgFmt, setPdfToImgFmt] = useState("jpg");
  const [pdfToImgDpi, setPdfToImgDpi] = useState("150");
  const [htmlToPdfMode, setHtmlToPdfMode] = useState<"url" | "html">("url");
  const [htmlToPdfUrl, setHtmlToPdfUrl] = useState("https://");
  const [htmlToPdfRaw, setHtmlToPdfRaw] = useState("<html><body><p>Merhaba</p></body></html>");
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
      resultId: string;
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
  const toolProgressDisposeRef = useRef<(() => void) | null>(null);
  const toolRunAbortRef = useRef<AbortController | null>(null);
  const mergeFlowAbortRef = useRef<AbortController | null>(null);
  const [mergePointerDraggingId, setMergePointerDraggingId] = useState<string | null>(null);
  const [mergeDragOverIndex, setMergeDragOverIndex] = useState<number | null>(null);
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
  const mergePollInFlightRef = useRef(false);
  const mergeListScrollRef = useRef<HTMLDivElement | null>(null);
  const [mergeVerifyingId, setMergeVerifyingId] = useState<string | null>(null);
  const [mergeSnapId, setMergeSnapId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [conversionUpgradeModalOpen, setConversionUpgradeModalOpen] = useState(false);
  /** Lightweight conversion surfaces (insufficient credits / first failure / first upgrade moment). */
  const [conversionPopupOpen, setConversionPopupOpen] = useState(false);
  const [conversionPopupVariant, setConversionPopupVariant] = useState<ConversionPopupVariant | null>(null);
  const conversionModalShowSourceRef = useRef<"auto" | "manual">("manual");
  const [upgradeNudgeLoadingHidden, setUpgradeNudgeLoadingHidden] = useState(false);
  const [upgradeNudgePostSuccessHidden, setUpgradeNudgePostSuccessHidden] = useState(false);
  const [postRunUpgradeHintVisible, setPostRunUpgradeHintVisible] = useState(false);
  const [postRunUpgradeHintDismissed, setPostRunUpgradeHintDismissed] = useState(false);
  /**
   * Credit balance + plan snapshot served by `/api/entitlement/balance`.
   * This is the ONLY source of truth for remaining-runs UI — we intentionally
   * do not derive it from `SubscriptionSummary.usage.*` (those fields belonged
   * to legacy subscription usage fields and have been removed from the wire
   * contract on purpose).
   */
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  /**
   * Recent `CreditTransaction` rows for the credit dashboard's "recent
   * activity" list. Kept in sync with `userBalance` so the two panels can
   * never disagree about what just happened — both refresh after any
   * successful tool run, grant, or fake-payment confirm.
   */
  const [creditTransactions, setCreditTransactions] = useState<
    CreditTransaction[] | null
  >(null);
  const [creditTransactionsLoading, setCreditTransactionsLoading] =
    useState(false);
  /** Tracks which credit-pack SKU is currently in checkout+confirm (instant flow). */
  const [paymentSummaryProduct, setPaymentSummaryProduct] = useState<CreditPackProduct | null>(null);
  const subscriptionSummaryRef = useRef<SubscriptionSummary | null>(null);
  const userBalanceRef = useRef<UserBalance | null>(null);
  const userRef = useRef(user);
  const conversionPopupOpenRef = useRef(false);
  const conversionPopupVariantRef = useRef<ConversionPopupVariant | null>(null);
  const upgradeModalOpenRef = useRef(false);
  const conversionUpgradeModalOpenRef = useRef(false);
  const tryShowConversionPopupRef = useRef<
    (variant: ConversionPopupVariant, trigger?: "balance" | "download") => void
  >(() => {});
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
  /**
   * After `saasGating.reason === "insufficient_credits"` (or download 402), blocks
   * `submitCurrentFeature` until balance rises above the snapshot or the preview is dismissed.
   */
  const insufficientCreditsToolRunBlockRef = useRef(false);
  const insufficientCreditsBarrierCreditSnapshotRef = useRef<number | null>(null);
  /** One-shot: user acknowledged PDF→Excel table-structure warning. */
  const excelConfirmRef = useRef(false);
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [splitPickerOpen, setSplitPickerOpen] = useState(false);

  function armInsufficientCreditsToolBarrier() {
    insufficientCreditsToolRunBlockRef.current = true;
    insufficientCreditsBarrierCreditSnapshotRef.current = userBalanceRef.current?.creditBalance ?? 0;
  }

  function clearInsufficientCreditsToolBarrier() {
    insufficientCreditsToolRunBlockRef.current = false;
    insufficientCreditsBarrierCreditSnapshotRef.current = null;
  }

  const navigateToDashboardAfterOAuth = useCallback(() => {
    const url = new URL(window.location.href);
    url.pathname = "/workspace";
    url.searchParams.delete("token");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
    setSelectedFeatureId("split");
    setActiveSidebar("split");
    setContentPanel("tool");
    setView("web");
  }, []);

  const workspaceFeatures = useMemo(
    () => buildWorkspaceFeaturesFromCms(language, cms, TOOLSPublic.disabledFeatures),
    [language, cms, TOOLSPublic.disabledFeatures],
  );

  const selectedFeature = useMemo((): Feature => {
    const hit =
      workspaceFeatures.find((feature) => feature.id === selectedFeatureId) ?? workspaceFeatures[0];
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
  }, [isAuthenticated, subscriptionSummary, subscriptionLoading, workspaceFeatures]);

  const enabledToolIds = useMemo(() => workspaceFeatures.map((f) => f.id), [workspaceFeatures]);
  const resolveToolLabel = useCallback(
    (id: FeatureKey) => workspaceFeatures.find((f) => f.id === id)?.title ?? sidebarToolLabel(id, language),
    [workspaceFeatures, language],
  );


  const primaryUpload = uploads[0] ?? null;
  const currentPdfIsEncrypted = Boolean(primaryUpload?.encrypted);
  const shouldInspectCurrentFeature = pdfInspectionFeatures.includes(selectedFeatureId);
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
  }, [isAuthenticated, subscriptionLoading, subscriptionSummary, selectedFeatureId]);
  const shouldShowCookieNotice = isCookieConsentReady && !hasConsent;
  const trackedView = getTrackedViewName(view);
  const trackedPath = getTrackedPath(view);
  const workspaceBanner = useMemo(() => getCmsWorkspaceBanner(cms), [cms]);
  const serverAnalyticsEnabled = site.analyticsEnabled !== false;

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

  useAnalyticsTracking({
    enabled: hasConsent,
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
      }, 4200);
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

  const disposeToolProgressSuccess = useCallback(() => {
    toolProgressDisposeRef.current?.();
    toolProgressDisposeRef.current = null;
    clearInsufficientCreditsToolBarrier();
    setToolProgressSuccess(null);
  }, []);

  function resetForm(clearInputValue: boolean) {
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
    setOrganizeOrder("");
    setUnlockOpenPassword("");
    setWatermarkPhrase("TASLAK");
    setPageNumStart("1");
    setPageNumPos("footer");
    setPdfToPptDpi("150");
    setPdfToImgFmt("jpg");
    setPdfToImgDpi("150");
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
  }

  function setUploadPassword(targetId: string, value: string) {
    setUploads((current) =>
      current.map((item) =>
        item.id === targetId ? { ...item, password: value, mergePasswordVerified: false } : item,
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
        language === "tr" ? "Önce bu dosya için parolayı girin." : "Enter the password for this file first.",
      );
      return;
    }
    setMergeVerifyingId(itemId);
    try {
      const result = await inspectPdf(item.file, pwd, accessToken);
      const ok = result.page_count !== null && !result.inspect_error;
      setUploads((cur) =>
        cur.map((u) => (u.id === itemId ? { ...u, mergePasswordVerified: ok } : u)),
      );
      if (!ok) {
        showToast("error", language === "tr" ? "Parola doğrulanamadı" : "Invalid password", L.mergePasswordWrong);
      }
    } catch (err) {
      setUploads((cur) => cur.map((u) => (u.id === itemId ? { ...u, mergePasswordVerified: false } : u)));
      showToast(
        "error",
        language === "tr" ? "Parola doğrulanamadı" : "Invalid password",
        err instanceof Error ? err.message : L.mergePasswordWrong,
      );
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

  function handleMergeRowPointerDown(event: React.PointerEvent<HTMLDivElement>, index: number, itemId: string) {
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
          listEl.scrollTop = Math.min(listEl.scrollHeight - listEl.clientHeight, listEl.scrollTop + 16);
        }
      }
      const hover = mergePointerYToIndex(ev.clientY, mergeListScrollRef.current);
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

  /**
   * Gated indirme: sunucu dosya adı + tarayıcı ``Save As`` (download attribute) ile
   * ``GET /api/pdf/result/{id}/download``; indirme kanıtı için log + başarılı akışta ACK.
   */
  const runGatedDownloadWithFilename = useCallback(
    async (resultId: string, serverFallbackName: string, clientFileName: string, toolId: FeatureKey) => {
      let logId: string | null = null;
      if (accessToken) {
        try {
          const created = await createDownloadLog(accessToken, { resultId, toolId });
          logId = created.id;
        } catch {
          /* kanıt isteğe bağlı; indirmeyi engellememeli */
        }
      }
      try {
        const outcome = await downloadResult(resultId, serverFallbackName, accessToken, {
          clientDownloadName: clientFileName,
        });
        if (outcome.status === "payment_required") {
          if (outcome.saasGating) {
            setUserBalance((prev) =>
              prev ? { ...prev, creditBalance: outcome.saasGating!.creditsAfter } : prev,
            );
          }
          armInsufficientCreditsToolBarrier();
          tryShowConversionPopupRef.current("insufficient_credits", "download");
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
        if (logId && accessToken) {
          void ackDownloadLog(accessToken, logId).catch(() => {});
        }
        showToast(
          "success",
          language === "tr" ? "İndirme tamamlandı" : "Download complete",
          clientFileName,
        );
        void refreshSubscriptionState();
        if (accessToken && user) {
          const balanceCtx = {
            userId: user.id,
            role: user.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
          };
          const next = await fetchUserBalance(accessToken, balanceCtx).catch(() => null);
          if (next) {
            setUserBalance(next);
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        showToast(
          "error",
          language === "tr" ? "İndirme başarısız" : "Download failed",
          detail,
        );
      }
    },
    [accessToken, language, refreshSubscriptionState, showToast, user],
  );

  const queueGatedDownload = useCallback(
    (resultId: string, fallbackName: string, toolId: FeatureKey) => {
      const name = sanitizeDownloadBasename(fallbackName, "download.pdf");
      void runGatedDownloadWithFilename(resultId, fallbackName, name, toolId);
    },
    [runGatedDownloadWithFilename],
  );

  const openConversionUpgradeModalManual = useCallback(() => {
    conversionModalShowSourceRef.current = "manual";
    setConversionUpgradeModalOpen(true);
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
    /** OAuth tamamlandıktan sonra view=web iken /login-success’ten /workspace’e geçişe izin ver. */
    if (path === "/login-success" && view !== "web") {
      return;
    }
    if (view === "web" && (!isAuthenticated || isRestoring)) {
      return;
    }
    if (view === "admin" && (!isAuthenticated || isRestoring || user?.role !== "ADMIN")) {
      return;
    }
    const next = view === "admin" ? "/admin" : getTrackedPath(view);
    const current = path;
    const normalizedNext = next.replace(/\/$/, "") || "/";
    if (current !== normalizedNext) {
      const sp = new URLSearchParams(window.location.search);
      const keep = new URLSearchParams();
      for (const key of ["payment", "oauth_error", "email_verified"] as const) {
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
  }, [view, isAuthenticated, isRestoring, user?.role]);

  useEffect(() => {
    if (view !== "admin" || isRestoring || !isAuthenticated) {
      return;
    }
    if (user?.role !== "ADMIN") {
      setView("web");
      window.history.replaceState({}, "", "/workspace");
    }
  }, [view, isRestoring, isAuthenticated, user?.role]);

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
    window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams.toString()}` : "") + url.hash);

    if (payment === "success") {
      void (async () => {
        await refreshSession();
        await refreshSubscriptionState();
        showToast(
          "success",
          language === "tr" ? "Ödeme tamamlandı" : "Payment complete",
          language === "tr" ? "Planınız güncellendi." : "Your plan has been updated.",
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
  }, [isAuthenticated, isRestoring, accessToken, refreshSession, refreshSubscriptionState, language]);

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
    disposeToolProgressSuccess();
  }, [selectedFeatureId, disposeToolProgressSuccess]);

  useEffect(() => {
    subscriptionSummaryRef.current = subscriptionSummary;
  }, [subscriptionSummary]);

  useEffect(() => {
    userBalanceRef.current = userBalance;
  }, [userBalance]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    conversionPopupOpenRef.current = conversionPopupOpen;
  }, [conversionPopupOpen]);

  useEffect(() => {
    conversionPopupVariantRef.current = conversionPopupVariant;
  }, [conversionPopupVariant]);

  useEffect(() => {
    upgradeModalOpenRef.current = upgradeModalOpen;
  }, [upgradeModalOpen]);

  useEffect(() => {
    conversionUpgradeModalOpenRef.current = conversionUpgradeModalOpen;
  }, [conversionUpgradeModalOpen]);

  /**
   * Post-run upgrade hint trigger. The legacy implementation fired this
   * based on legacy server-side friction signals that no longer exist;
   * that dataset no longer exists. We now show the hint when a FREE user
   * finishes a run and either (a) their credit balance hit zero or (b) the
   * just-returned engine decision predicted that zero state. Both fields
   * come exclusively from the entitlement engine.
   */
  const offerPostRunMonetizationHintAfterSuccess = useCallback(
    (gating?: SaaSGating | null) => {
      const ur = userRef.current;
      const sum = subscriptionSummaryRef.current;
      if (!sum || ur?.role === "ADMIN" || sum.currentPlan.name !== "FREE") {
        return;
      }
      const creditsAfter =
        typeof gating?.creditsAfter === "number" ? gating.creditsAfter : null;
      const balance = userBalanceRef.current?.creditBalance ?? null;
      const exhausted =
        (creditsAfter !== null && creditsAfter <= 0) ||
        (balance !== null && balance <= 0);
      if (exhausted) {
        setPostRunUpgradeHintVisible(true);
        setPostRunUpgradeHintDismissed(false);
      }
      queueMicrotask(() => tryShowConversionPopupRef.current("pro_unlock"));
    },
    [],
  );

  useEffect(() => {
    if (selectedFeatureId !== "merge" || !mergeJob?.id || mergeJob.id === MERGE_JOB_PENDING_ID) {
      return;
    }

    let active = true;
    mergePollHandledRef.current = false;
    const jobId = mergeJob.id;
    const fallbackName = selectedFeature.fallbackFilename;

    const tick = async () => {
      if (!active || mergePollHandledRef.current || mergePollInFlightRef.current) {
        return;
      }

      const M = ws(language);
      const pollSignal = mergeFlowAbortRef.current?.signal;
      mergePollInFlightRef.current = true;
      try {
        const nextStatus = await fetchMergeJob(jobId, accessToken, { signal: pollSignal });
        if (!active || mergePollHandledRef.current) {
          return;
        }

        setMergeJob(nextStatus);

        if (nextStatus.status === "failed") {
          showToast("error", M.mergeToastFailedTitle, nextStatus.error || M.mergeToastFailedGeneric);
          tryShowConversionPopupRef.current("buy_credits");
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
          try {
            const dl = await downloadMergeJob(jobId, fallbackName, accessToken, { signal: pollSignal });
            if (!active) {
              return;
            }
            void refreshSubscriptionState();
            if (accessToken && user) {
              const balanceCtx = {
                userId: user.id,
                role: user.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
              };
              void fetchUserBalance(accessToken, balanceCtx).then((b) => {
                if (b) {
                  setUserBalance(b);
                }
              });
            }
            showToast("success", M.mergeToastSuccessTitle, M.mergeToastSuccessBody);
            resetForm(true);
            setSubmitting(false);
            setMergeJob(null);
            disposeToolProgressSuccess();
            if (dl.dispose) {
              toolProgressDisposeRef.current = dl.dispose;
            }
            setToolProgressSuccess({
              filename: fallbackName,
              featureTitle: selectedFeature.title,
              replay: dl.replay,
            });
            offerPostRunMonetizationHintAfterSuccess(dl.saasGating ?? null);
          } catch (downloadErr) {
            if (!active) {
              return;
            }
            setSubmitting(false);
            if (isUserAbortError(downloadErr)) {
              setMergeJob(null);
              return;
            }
            if (downloadErr instanceof EntitlementPaymentRequiredError) {
              if (downloadErr.saasGating) {
                setUserBalance((prev) =>
                  prev && downloadErr.saasGating
                    ? { ...prev, creditBalance: downloadErr.saasGating.creditsAfter }
                    : prev,
                );
              }
              armInsufficientCreditsToolBarrier();
              tryShowConversionPopupRef.current("insufficient_credits", "download");
              return;
            }
            const detail =
              downloadErr instanceof Error ? downloadErr.message : M.mergeToastPollErrorDetail;
            showToast("error", M.mergeToastDownloadErrorTitle, detail);
            tryShowConversionPopupRef.current("buy_credits");
            return;
          }
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
          showToast("info", M.mergeJobSessionLostTitle, M.mergeJobSessionLostDetail);
          return;
        }
        const detail = error instanceof Error ? error.message : M.mergeToastPollErrorDetail;
        showToast("error", M.mergeToastPollErrorTitle, detail);
        tryShowConversionPopupRef.current("buy_credits");
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
    accessToken,
    offerPostRunMonetizationHintAfterSuccess,
    user,
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
      void inspectPdf(primary.file, pwd, accessToken).then((result) => {
        setUploads((cur) =>
          cur.map((u, i) => (i === 0 ? { ...u, pageCount: result.page_count ?? null } : u)),
        );
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [password, selectedFeatureId, uploads[0]?.id, uploads[0]?.encrypted, language, accessToken]);

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

  useEffect(() => {
    setUpgradeModalOpen(false);
    setConversionUpgradeModalOpen(false);
  }, [view]);

  const dismissConversionUpgradeModal = useCallback(() => {
    recordConversionModalDismiss();
    setConversionUpgradeModalOpen(false);
  }, []);

  const snoozeConversionUpgradeModal = useCallback(() => {
    recordConversionModalDismiss();
    try {
      localStorage.setItem(CONV_MODAL_SNOOZE_UNTIL_KEY, String(Date.now() + CONV_MODAL_SNOOZE_MS));
    } catch {
      /* private mode */
    }
    setConversionUpgradeModalOpen(false);
  }, []);

  const prevConversionModalOpenRef = useRef(false);
  useEffect(() => {
    const open = conversionUpgradeModalOpen;
    if (open && !prevConversionModalOpenRef.current) {
      const source = conversionModalShowSourceRef.current;
      const stats = recordConversionModalShown(source);
      pushConversionModalAnalytics("nb_conversion_modal_shown", {
        source,
        shown_total: stats.shownTotal,
        auto_shows_today: stats.autoShowsToday,
        dismiss_total: stats.dismissTotal,
        ctr_pct: conversionModalClickThroughRate(stats),
      });
    }
    prevConversionModalOpenRef.current = open;
  }, [conversionUpgradeModalOpen]);

  /**
   * Auto-open the conversion upgrade modal once after a FREE-plan user hits
   * zero credits. `canAutoShowConversionModal` caps how often this fires.
   */
  useEffect(() => {
    if (view !== "web" || !isAuthenticated || subscriptionLoading || !subscriptionSummary) {
      return;
    }
    if (subscriptionSummary.currentPlan.name !== "FREE" || user?.role === "ADMIN") {
      return;
    }
    if (conversionUpgradeModalOpen || upgradeModalOpen || conversionPopupOpen) {
      return;
    }
    if (!userBalance || userBalance.hasActiveSubscription) {
      return;
    }
    if (userBalance.creditBalance > 0) {
      return;
    }
    if (!canAutoShowConversionModal(Date.now())) {
      return;
    }
    conversionModalShowSourceRef.current = "auto";
    setConversionUpgradeModalOpen(true);
  }, [
    view,
    isAuthenticated,
    subscriptionLoading,
    subscriptionSummary,
    conversionUpgradeModalOpen,
    upgradeModalOpen,
    conversionPopupOpen,
    user?.role,
    userBalance,
  ]);

  /**
   * Completes redirect-based fake checkout: user lands on
   * `/fake-payment/success?sessionId=...`, we confirm server-side, refresh
   * balance, then normalize the URL to `/workspace`.
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
    const sessionId = new URLSearchParams(window.location.search).get("sessionId");
    if (!sessionId) {
      fakePaymentSuccessHandledRef.current = true;
      showToast(
        "error",
        language === "tr" ? "Oturum bilgisi eksik" : "Missing session",
        language === "tr" ? "Geçersiz ödeme dönüş adresi." : "Invalid payment return URL.",
      );
      window.history.replaceState({}, "", "/workspace");
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
        if (
          "creditsGranted" in result &&
          result.product !== "PRO" &&
          result.product !== "BUSINESS"
        ) {
          setUserBalance((prev) =>
            prev ? { ...prev, creditBalance: result.creditsAfter } : null,
          );
        }
        const balanceCtx = {
          userId: user.id,
          role: user.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
        };
        const [nextBalance, nextTransactions] = await Promise.all([
          fetchUserBalance(accessToken, balanceCtx).catch(() => null),
          fetchCreditTransactions(accessToken, 10).catch(() => null),
        ]);
        if (nextBalance) {
          setUserBalance(nextBalance);
        }
        if (nextTransactions) {
          setCreditTransactions(nextTransactions);
        }
        const Wloc = ws(language);
        if ("alreadyConfirmed" in result && result.alreadyConfirmed) {
          showToast(
            "success",
            language === "tr" ? "Zaten onaylandı" : "Already confirmed",
            language === "tr" ? "Bu ödeme daha önce tamamlandı." : "This payment was already completed.",
          );
        } else if ("creditsGranted" in result) {
          showToast(
            "success",
            language === "tr" ? "Ödeme tamamlandı" : "Payment complete",
            Wloc.creditDashboardBuyCreditsSuccess(result.creditsGranted),
          );
        }
      } catch (error) {
        showToast(
          "error",
          language === "tr" ? "Onay başarısız" : "Confirm failed",
          error instanceof Error ? error.message : "",
        );
      } finally {
        window.history.replaceState({}, "", "/workspace");
      }
    })();
  }, [isAuthenticated, accessToken, isRestoring, language, refreshSession, refreshSubscriptionState, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || !accessToken) {
      setSubscriptionSummary(null);
      setUserBalance(null);
      setCreditTransactions(null);
      return;
    }

    const authToken = accessToken;
    const authUser = user;

    let cancelled = false;
    let intervalId: number | undefined;

    async function loadSubscriptionBlock() {
      setSubscriptionLoading(true);
      setCreditTransactionsLoading(true);
      try {
        const balanceCtx = {
          userId: authUser.id,
          role: authUser.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
        };
        const [summary, status, balance, transactions] = await Promise.all([
          fetchSubscriptionSummary(authToken),
          fetchSubscriptionStatus(authToken),
          fetchUserBalance(authToken, balanceCtx).catch(() => null),
          fetchCreditTransactions(authToken, 10).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setSubscriptionSummary(summary);
        if (balance) {
          setUserBalance(balance);
        }
        if (transactions) {
          setCreditTransactions(transactions);
        }

        const adminProNavbar = authUser.role === "ADMIN" && status.plan === "PRO";
        const needsJwtRefresh =
          Boolean(status.plan_downgraded) || (!adminProNavbar && status.plan !== authUser.plan);
        if (needsJwtRefresh) {
          const refreshed = await refreshSession();
          if (cancelled || !refreshed) {
            return;
          }
          const [nextSummary, nextStatus, nextBalance, nextTransactions] =
            await Promise.all([
              fetchSubscriptionSummary(refreshed.accessToken),
              fetchSubscriptionStatus(refreshed.accessToken),
              fetchUserBalance(refreshed.accessToken, balanceCtx).catch(() => null),
              fetchCreditTransactions(refreshed.accessToken, 10).catch(() => null),
            ]);
          if (!cancelled) {
            setSubscriptionSummary(nextSummary);
            if (nextBalance) {
              setUserBalance(nextBalance);
            }
            if (nextTransactions) {
              setCreditTransactions(nextTransactions);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          showToast(
            "error",
            "Abonelik bilgisi alınamadı",
            error instanceof Error ? error.message : "Plan bilgileri yüklenemedi.",
          );
        }
      } finally {
        if (!cancelled) {
          setSubscriptionLoading(false);
          setCreditTransactionsLoading(false);
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
  }, [accessToken, isAuthenticated, refreshSession, user?.id, user?.plan, user?.role]);

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
    ].includes(selectedFeature.id) &&
    uploads.length > 0 &&
    currentPdfIsEncrypted;
  const showUnlockPasswordField = selectedFeature.id === "unlock-pdf" && uploads.length > 0;
  const showEncryptSourcePasswordField = selectedFeature.id === "encrypt" && uploads.length > 0 && currentPdfIsEncrypted;
  const mergeHasMissingPasswords =
    selectedFeature.id === "merge" &&
    uploads.some((item) => item.encrypted && (!item.password.trim() || !item.mergePasswordVerified));
  const toolFilesStillInspecting =
    uploads.length > 0 &&
    uploads.some((u) => u.inspecting) &&
    pdfInspectionFeatures.includes(selectedFeatureId);
  /**
   * Credit/workspace chrome (sidebar chip, mobile pill, in-tool hints) for
   * signed-in non-admin users once balance is loaded.
   */
  const showCreditWorkspaceChrome = user?.role !== "ADMIN" && Boolean(userBalance);
  /**
   * Credit depletion replaces the old "friction active" signal. `userBalance`
   * is the authoritative source; `subscriptionSummary` no longer carries any
   * usage data. A null balance (load failure / pre-boot) is treated as
   * "not yet depleted" to avoid flashing the upgrade banner during refresh.
   */
  const creditsExhausted =
    userBalance !== null &&
    !userBalance.hasActiveSubscription &&
    userBalance.role !== "ADMIN" &&
    userBalance.creditBalance <= 0;
  const creditsRunningLow = Boolean(
    userBalance &&
      !userBalance.hasActiveSubscription &&
      userBalance.role !== "ADMIN" &&
      userBalance.creditBalance > 0 &&
      userBalance.creditBalance < 5,
  );
  /** 5–14 credits: “moderate low” strip (5+ already covered by `creditsRunningLow`). */
  const creditsModerateLow = Boolean(
    userBalance &&
      !userBalance.hasActiveSubscription &&
      userBalance.role !== "ADMIN" &&
      userBalance.creditBalance >= 5 &&
      userBalance.creditBalance < 15,
  );
  /**
   * Paid lane (PRO / BUSINESS / admin bypass). The engine treats these as
   * "active_subscription" / "admin_bypass" — UI uses the same predicate so
   * the progress hint matches what the engine will allow.
   */
  const premiumProcessingLane = Boolean(
    user?.role === "ADMIN" ||
      userBalance?.hasActiveSubscription ||
      (subscriptionSummary &&
        (subscriptionSummary.currentPlan.name === "PRO" ||
          subscriptionSummary.currentPlan.name === "BUSINESS")),
  );
  /** Standard (non-priority) processing lane — not subscription / admin. */
  const creditStandardLaneQueue = showCreditWorkspaceChrome && !premiumProcessingLane;

  const mergeProgressActive = Boolean(
    mergeJob && selectedFeatureId === "merge" && mergeJob.status !== "completed" && mergeJob.status !== "cancelled",
  );
  const genericToolProgressActive =
    submitting && selectedFeatureId !== "merge" && view === "web" && contentPanel === "tool";
  const showToolCancelButton = Boolean(
    view === "web" &&
      contentPanel === "tool" &&
      ((mergeProgressActive && mergeJob && mergeJob.status !== "failed") || genericToolProgressActive),
  );
  const TOOLSuccessBarActive = Boolean(toolProgressSuccess && view === "web" && contentPanel === "tool");
  const hideMonetizationHintsForInsufficientGate =
    toolProgressSuccess?.gatedDownload?.saasGating?.reason === "insufficient_credits";
  const bottomToolProgressActive =
    mergeProgressActive || genericToolProgressActive || TOOLSuccessBarActive;
  const standardLaneProcessingUpsell = Boolean(
    showCreditWorkspaceChrome &&
      !premiumProcessingLane &&
      (submitting || mergeProgressActive || genericToolProgressActive),
  );
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
      ? Math.round((mergeJob.elapsed_seconds / mergeJob.percent) * (100 - mergeJob.percent))
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
        : selectedFeatureId === "pdf-to-word" || selectedFeatureId === "pdf-to-excel"
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
  const genericToolRemainingSec = Math.max(0, genericToolEstimateSec - genericToolElapsedSec);
  const genericToolPercent = Math.min(
    97,
    Math.max(2, Math.round((genericToolElapsedSec / Math.max(genericToolEstimateSec, 1)) * 100)),
  );
  const genericProgressIndeterminate =
    genericToolProgressActive &&
    (premiumProcessingLane
      ? genericToolElapsedSec < 4 || genericToolPercent < 5
      : genericToolElapsedSec < 5 || genericToolPercent < 6);

  /** Inline nudge after success when credits are depleted (non-subscriber). */
  const upgradeNudgeTier: 0 | 1 = useMemo(() => {
    if (user?.role === "ADMIN") {
      return 0;
    }
    if (!subscriptionSummary || subscriptionSummary.currentPlan.name !== "FREE") {
      return 0;
    }
    if (!userBalance || userBalance.hasActiveSubscription) {
      return 0;
    }
    return userBalance.creditBalance <= 0 ? 1 : 0;
  }, [subscriptionSummary, user?.role, userBalance]);

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

  const showUpgradeNudgeOnLoading =
    upgradeNudgeTier >= 1 &&
    !upgradeNudgeLoadingHidden &&
    showCreditWorkspaceChrome &&
    !premiumProcessingLane &&
    (genericToolProgressActive ||
      (mergeProgressActive && mergeJob && mergeJob.status !== "failed"));

  const splitInputDisabled = uploads.length === 0;
  const toolNeedsUpload = selectedFeature.requiresUpload !== false;
  const submitDisabled =
    submitting ||
    (toolNeedsUpload && uploads.length === 0) ||
    !selectedFeatureAllowed ||
    (selectedFeature.id === "split" && (!!pagesError || !pagesText.trim())) ||
    (selectedFeature.id === "delete-pages" && (!!deletePagesError || !deletePagesText.trim())) ||
    (selectedFeature.id === "organize-pdf" && !organizeOrder.trim()) ||
    (showUnlockPasswordField && !unlockOpenPassword.trim()) ||
    (selectedFeature.id === "watermark" && !watermarkPhrase.trim()) ||
    (selectedFeature.id === "html-to-pdf" && htmlToPdfMode === "url" && !htmlToPdfUrl.trim()) ||
    (selectedFeature.id === "html-to-pdf" && htmlToPdfMode === "html" && !htmlToPdfRaw.trim()) ||
    (showSplitPasswordField && !password.trim()) ||
    (showEncryptSourcePasswordField && !inputPassword.trim()) ||
    (selectedFeature.id === "encrypt" && (!outputPassword.trim() || uploads.length === 0)) ||
    mergeHasMissingPasswords ||
    toolFilesStillInspecting;
  const pickerButtonText = selectedFeature.multiple && uploads.length > 0 ? W.fileAdd : W.filePick;

  function openLegalPage(target: LegalView) {
    if (view === "landing" || view === "login" || view === "register" || view === "web") {
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

  /** Opens the credit-pack modal (instant checkout from there). */
  function handleBuyCredits() {
    if (!accessToken) {
      showToast(
        "error",
        language === "tr" ? "Oturum gerekli" : "Sign-in required",
        language === "tr" ? "Kredi satın almak için giriş yapın." : "Please sign in to buy credits.",
      );
      return;
    }
    setUpgradeModalOpen(true);
  }

  async function refreshEntitlementAfterPurchase() {
    if (!accessToken || !user) {
      return;
    }
    const balanceCtx = {
      userId: user.id,
      role: user.role === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
    };
    const [nextBalance, nextTransactions] = await Promise.all([
      fetchUserBalance(accessToken, balanceCtx).catch(() => null),
      fetchCreditTransactions(accessToken, 10).catch(() => null),
    ]);
    if (nextBalance) {
      setUserBalance(nextBalance);
    }
    if (nextTransactions) {
      setCreditTransactions(nextTransactions);
    }
  }

  const handleSelectCreditPackForPayment = useCallback(
    (product: FakePaymentProduct) => {
      if (!isCreditPackProduct(product)) {
        return;
      }
      if (!accessToken || !user) {
        showToast(
          "error",
          language === "tr" ? "Oturum gerekli" : "Sign-in required",
          language === "tr" ? "Kredi satın almak için giriş yapın." : "Please sign in to buy credits.",
        );
        return;
      }
      setPaymentSummaryProduct(product);
    },
    [accessToken, user, language, showToast],
  );

  async function handleCreditPackPurchaseSuccess() {
    try {
      await refreshEntitlementAfterPurchase();
    } catch {
      /* still toast */
    }
    setPaymentSummaryProduct(null);
    setUpgradeModalOpen(false);
    showToast(
      "success",
      language === "tr" ? "Ödeme tamamlandı" : "Payment complete",
      language === "tr" ? "Krediler hesabınıza eklendi." : "Credits have been added to your account.",
    );
  }

  const closeConversionPopup = useCallback((snoozeInsufficientCredits: boolean) => {
    if (conversionPopupVariantRef.current === "insufficient_credits" && snoozeInsufficientCredits) {
      snoozeLowCreditPopup();
    }
    setConversionPopupOpen(false);
    setConversionPopupVariant(null);
  }, []);

  const dismissConversionPopup = useCallback(() => {
    closeConversionPopup(conversionPopupVariantRef.current === "insufficient_credits");
  }, [closeConversionPopup]);

  const onConversionPopupPrimary = useCallback(() => {
    const v = conversionPopupVariantRef.current;
    const snooze = v === "insufficient_credits";
    closeConversionPopup(snooze);
    if (v === "insufficient_credits" || v === "buy_credits") {
      setUpgradeModalOpen(true);
    } else if (v === "pro_unlock") {
      setUpgradeModalOpen(true);
    }
  }, [closeConversionPopup]);

  const onConversionPopupSecondary = useCallback(() => {
    const v = conversionPopupVariantRef.current;
    if (v === "insufficient_credits") {
      closeConversionPopup(true);
      setUpgradeModalOpen(true);
      return;
    }
    closeConversionPopup(false);
  }, [closeConversionPopup]);

  const tryShowConversionPopup = useCallback((variant: ConversionPopupVariant, trigger?: "balance" | "download") => {
    if (view !== "web" || !isAuthenticated) {
      return;
    }
    if (user?.role === "ADMIN") {
      return;
    }
    const insuffDownload = variant === "insufficient_credits" && trigger === "download";
    if (!insuffDownload && conversionPopupOpenRef.current) {
      return;
    }
    if (!insuffDownload && (upgradeModalOpenRef.current || conversionUpgradeModalOpenRef.current)) {
      return;
    }

    if (variant === "insufficient_credits" && trigger !== "download") {
      return;
    }

    if (variant === "buy_credits" && hasShownFirstToolFailurePopup()) {
      return;
    }

    if (variant === "pro_unlock") {
      if (hasShownFirstUpgradeOpPopup()) {
        return;
      }
      const sum = subscriptionSummaryRef.current;
      const ub = userBalanceRef.current;
      if (!sum || sum.currentPlan.name !== "FREE") {
        return;
      }
      if (ub?.hasActiveSubscription) {
        return;
      }
    }

    if (variant === "buy_credits") {
      markFirstToolFailurePopupShown();
    }
    if (variant === "pro_unlock") {
      markFirstUpgradeOpPopupShown();
    }

    setConversionPopupVariant(variant);
    setConversionPopupOpen(true);
  }, [view, isAuthenticated, user?.role]);

  useEffect(() => {
    tryShowConversionPopupRef.current = tryShowConversionPopup;
  }, [tryShowConversionPopup]);

  useEffect(() => {
    const n = userBalance?.creditBalance;
    if (typeof n === "number") {
      clearLowCreditSnoozeIfRecovered(n);
    }
  }, [userBalance?.creditBalance]);

  useEffect(() => {
    if (!insufficientCreditsToolRunBlockRef.current) {
      return;
    }
    const snap = insufficientCreditsBarrierCreditSnapshotRef.current;
    if (snap === null) {
      return;
    }
    const b = userBalance?.creditBalance;
    if (typeof b === "number" && b > snap) {
      clearInsufficientCreditsToolBarrier();
    }
  }, [userBalance?.creditBalance]);

  async function handleContactModalSubmit(event: React.FormEvent<HTMLFormElement>) {
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
      setContactError(tr ? "Ad soyad en az 2 karakter olmalı." : "Name must be at least 2 characters.");
      return;
    }
    if (!contactEmail.trim()) {
      setContactError(tr ? "E-posta gerekli." : "Email is required.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(contactEmail.trim())) {
      setContactError(tr ? "Geçerli bir e-posta girin." : "Enter a valid email address.");
      return;
    }
    if (!contactMessage.trim()) {
      setContactError(tr ? "Mesaj gerekli." : "Message is required.");
      return;
    }
    if (contactMessage.trim().length < 10) {
      setContactError(tr ? "Mesaj en az 10 karakter olmalı." : "Message must be at least 10 characters.");
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
        tr ? "Mesajınız başarıyla gönderildi" : "Your message has been sent successfully",
      );
    } catch (error) {
      setContactError(error instanceof Error ? error.message : tr ? "Gönderilemedi." : "Could not send.");
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
      window.history.replaceState({}, "", "/workspace");
      return;
    }
    setContentPanel("tool");
    setActiveSidebar("split");
    setSelectedFeatureId("split");
  }

  function handleNavProfile() {
    setContentPanel("profile");
  }

  function handleNavPassword() {
    setChangePasswordModalOpen(true);
  }

  async function handleAuthSubmit(payload: { email: string; password: string; firstName?: string; lastName?: string }) {
    try {
      setAuthSubmitting(true);
      setAuthError("");

      if (view === "register") {
        const firstName = payload.firstName?.trim() ?? "";
        const lastName = payload.lastName?.trim() ?? "";
        if (!firstName || !lastName) {
          const msg = language === "tr" ? "Ad ve soyad gereklidir." : "First and last name are required.";
          setAuthError(msg);
          throw new Error(msg);
        }
        const registerResult = await register(firstName, lastName, payload.email, payload.password, language);
        setRegistrationSuccessBanner(
          language === "tr"
            ? "Güvenliğiniz için bir doğrulama e-postası gönderdik. Hesabınızı kullanmaya başlamak için lütfen e-posta adresinizi onaylayın."
            : registerResult.message,
        );
        setView("login");
        return;
      }

      const loggedInUser = await login(payload.email, payload.password);
      if (loggedInUser.preferredLanguage && loggedInUser.preferredLanguage !== language) {
        setLanguage(loggedInUser.preferredLanguage);
      }
      setSelectedFeatureId("split");
      setActiveSidebar("split");
      setContentPanel("tool");
      setView("web");
    } catch (error) {
      const fallback =
        language === "tr" ? "Kimlik doğrulama işlemi başarısız oldu." : "Authentication failed.";
      const raw = error instanceof Error ? error.message : fallback;
      setAuthError(translateAuthApiMessage(raw, language));
      throw error;
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    setAuthError("");
    setLanguage(detectInitialLanguage());
    setView("landing");
    showToast("success", "Oturum kapatıldı", "Hesabınızdan güvenli şekilde çıkış yapıldı.");
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
      const title = previous === "tr" ? "Dil tercihi kaydedilemedi" : "Could not save language";
      const detail =
        error instanceof Error ? error.message : previous === "tr" ? "Sunucuya bağlanılamadı veya oturum süresi doldu." : "Network error or session expired.";
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
      showToast("error", "Dosya seçilmedi", "Lütfen önce işlenecek dosyayı seçin.");
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
      const pageValidation = fmt || over || (!pagesText.trim() ? W.validationPagesRequired : "");
      setPagesError(pageValidation);
      if (pageValidation) {
        showToast("error", language === "tr" ? "Sayfa numaraları geçersiz" : "Invalid page numbers", pageValidation);
        return;
      }
    }

    if (selectedFeature.id === "delete-pages") {
      const fmt = validatePagesFormat(deletePagesText, language);
      const maxP = uploads[0]?.pageCount ?? null;
      let over = validatePagesMax(deletePagesText, maxP, language);
      if (!fmt && !over && Boolean(uploads[0]?.encrypted) && maxP === null && deletePagesText.trim()) {
        over = W.validationPagesNeedPassword;
      }
      const pageValidation = fmt || over || (!deletePagesText.trim() ? W.validationPagesRequired : "");
      setDeletePagesError(pageValidation);
      if (pageValidation) {
        showToast("error", language === "tr" ? "Sayfa listesi geçersiz" : "Invalid page list", pageValidation);
        return;
      }
    }

    if (showSplitPasswordField && !password.trim()) {
      showToast("error", "Kaynak PDF şifresi gerekli", "Seçilen PDF şifreli olduğu için şifre alanını doldurmanız gerekiyor.");
      return;
    }

    if (showEncryptSourcePasswordField && !inputPassword.trim()) {
      showToast("error", "Kaynak PDF şifresi gerekli", "Seçilen PDF şifreli olduğu için kaynak PDF şifresini girin.");
      return;
    }

    if (showUnlockPasswordField && !unlockOpenPassword.trim()) {
      showToast("error", "Parola gerekli", "PDF’yi açmak için mevcut parolayı girin.");
      return;
    }

    if (selectedFeature.id === "encrypt" && !outputPassword.trim()) {
      showToast("error", "Yeni PDF şifresi gerekli", "Şifreli PDF oluşturmak için yeni parola alanını doldurun.");
      return;
    }

    if (mergeHasMissingPasswords) {
      showToast(
        "error",
        language === "tr" ? "Şifre doğrulaması gerekli" : "Password verification required",
        language === "tr"
          ? "Şifreli PDF’ler için parolayı girin ve her dosyanın yanındaki «Parolayı doğrula» ile onaylayın."
          : "For password-protected PDFs, enter the password and tap «Verify password» next to each file.",
      );
      return;
    }

    if (!accessToken) {
      showToast("error", "Oturum gerekli", "İşlem için yeniden giriş yapın.");
      return;
    }

    if (insufficientCreditsToolRunBlockRef.current) {
      showToast(
        "error",
        language === "tr" ? "Önce kredi ekleyin veya yükseltin" : "Add credits or upgrade first",
        language === "tr"
          ? "Yetersiz kredi nedeniyle yeni işlem başlatılamıyor. Kredi satın alın, planı yükseltin veya önizlemeyi kapatın."
          : "You can’t start another run while credits are insufficient. Buy credits, upgrade, or dismiss the preview.",
      );
      return;
    }

    if (selectedFeature.id === "pdf-to-excel" && !excelConfirmRef.current) {
      setExcelDialogOpen(true);
      return;
    }
    if (selectedFeature.id === "pdf-to-excel") {
      excelConfirmRef.current = false;
    }

    try {
      disposeToolProgressSuccess();
      clearToast();
      setPostRunUpgradeHintVisible(false);

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
          const mergeRes = await createMergeJob(formData, accessToken, { signal: mergeSignal });
          const { job_id } = mergeRes;
          setMergeJob((prev) =>
            prev && prev.id === MERGE_JOB_PENDING_ID ? { ...prev, id: job_id, message: "Sıraya alındı." } : prev,
          );
        } catch (error) {
          setMergeJob(null);
          setSubmitting(false);
          if (isUserAbortError(error)) {
            return;
          }
          showToast(
            "error",
            language === "tr" ? "Birleştirme başlatılamadı" : "Could not start merge",
            error instanceof Error ? error.message : language === "tr" ? "İstek gönderilemedi." : "Request failed.",
          );
          tryShowConversionPopupRef.current("buy_credits");
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
            : uploads[0]?.file.size ?? 0;
      setToolRunFileBytes(runBytes);
      setToolRunClock(0);

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
            formData.append("password", password.trim());
            break;
          case "delete-pages":
            formData.append("pages_to_delete", deletePagesText.trim());
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "rotate-pdf": {
            formData.append("degrees", rotateDeg);
            if (rotatePagesOnly.trim()) {
              formData.append("pages", rotatePagesOnly.trim());
            }
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          }
          case "organize-pdf":
            formData.append("page_order", organizeOrder.trim());
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "unlock-pdf":
            formData.append("password", unlockOpenPassword.trim());
            break;
          case "watermark":
            formData.append("watermark_text", watermarkPhrase.trim());
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "page-numbers":
            formData.append("start_at", pageNumStart.trim() || "1");
            formData.append("position", pageNumPos);
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
            formData.append("dpi", pdfToPptDpi.trim() || "150");
            break;
          case "pdf-to-image":
            formData.append("image_format", pdfToImgFmt);
            formData.append("dpi", pdfToImgDpi.trim() || "150");
            if (password.trim()) {
              formData.append("password", password.trim());
            }
            break;
          case "encrypt":
            formData.append("input_password", inputPassword.trim());
            formData.append("user_password", outputPassword.trim());
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
          { signal: toolSignal, errorMessage: language === "tr" ? "İşlem başarısız oldu." : "The operation failed." },
        );

        let thumbnailBlobUrl: string | null = null;
        if (res.has_thumbnail) {
          try {
            thumbnailBlobUrl = await fetchResultThumbnailBlobUrl(res.result_id, accessToken, {
              signal: toolSignal,
            });
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
            resultId: res.result_id,
            fallbackName: res.filename || selectedFeature.fallbackFilename,
            thumbnailBlobUrl,
            saasGating: res.saasGating ?? null,
          },
        });
        showToast(
          "success",
          language === "tr" ? "İşlem tamamlandı" : "Process complete",
          language === "tr" ? "İndirmek için aşağıdaki düğmeyi kullanın." : "Use the button below to download.",
        );
        resetForm(true);
        offerPostRunMonetizationHintAfterSuccess(res.saasGating ?? null);
        void refreshSubscriptionState();
        return;
      }

      const dl = await downloadFromApi(
        selectedFeature.endpoint,
        formData,
        selectedFeature.fallbackFilename,
        accessToken,
        { signal: toolSignal },
      );
      showToast("success", "İşlem tamamlandı", "Çıktı dosyası başarıyla indirildi.");
      resetForm(true);
      disposeToolProgressSuccess();
      if (dl.dispose) {
        toolProgressDisposeRef.current = dl.dispose;
      }
      setToolProgressSuccess({
        filename: selectedFeature.fallbackFilename,
        featureTitle: selectedFeature.title,
        replay: dl.replay,
      });
      offerPostRunMonetizationHintAfterSuccess(dl.saasGating ?? null);
      void refreshSubscriptionState();
    } catch (error) {
      if (isUserAbortError(error)) {
        return;
      }
      if (error instanceof EntitlementPaymentRequiredError) {
        if (error.saasGating) {
          setUserBalance((prev) =>
            prev && error.saasGating
              ? { ...prev, creditBalance: error.saasGating.creditsAfter }
              : prev,
          );
        }
        armInsufficientCreditsToolBarrier();
        tryShowConversionPopupRef.current("insufficient_credits", "download");
        return;
      }
      const detail = error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu.";
      showToast("error", "İşlem başarısız", detail);
      tryShowConversionPopupRef.current("buy_credits");
    } finally {
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
    const existingKeys = new Set(uploads.map((u) => fileIdentityKey(u.file)));
    const duplicates = rawFiles.filter((f) => existingKeys.has(fileIdentityKey(f)));
    const freshFiles = rawFiles.filter((f) => !existingKeys.has(fileIdentityKey(f)));

    if (selectedFeature.multiple && duplicates.length > 0) {
      showToast("info", L.mergeDuplicateFileTitle, L.mergeDuplicateFileDetail);
    }

    if (freshFiles.length === 0) {
      return;
    }

    const incomingItems = createUploadItems(freshFiles);
    const nextItems = selectedFeature.multiple ? [...uploads, ...incomingItems] : incomingItems;
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
      incomingItems.some((incoming) => incoming.id === item.id) ? { ...item, inspecting: true } : item,
    );
    setUploads(withLoading);

    const inspectedNewItems = await Promise.all(
      incomingItems.map(async (item) => {
        try {
          const result = await inspectPdf(item.file, undefined, accessToken);
          return {
            ...item,
            encrypted: Boolean(result.encrypted),
            inspecting: false,
            pageCount: result.page_count ?? null,
            mergePasswordVerified: false,
          };
        } catch (err) {
          const L2 = ws(language);
          showToast("error", L2.inspectFailedTitle, err instanceof Error ? err.message : L2.inspectFailedDetail);
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

    setUploads((current) =>
      current.map((item) => inspectedNewItems.find((inspected) => inspected.id === item.id) ?? item),
    );
  }

  const pathname = typeof window !== "undefined" ? window.location.pathname.replace(/\/$/, "") || "/" : "/";
  const isLoginSuccessRoute = pathname === "/login-success";

  if (isLoginSuccessRoute) {
    return (
      <LoginSuccessPage
        completeOAuthLogin={completeOAuthLogin}
        clearSession={clearSession}
        onNavigateToDashboard={navigateToDashboardAfterOAuth}
      />
    );
  }

  if (view === "forgot_password") {
    return (
      <>
        <SystemNotificationBanner language={language} />
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
      </>
    );
  }

  if (view === "landing") {
    return (
      <>
        <SystemNotificationBanner language={language} />
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
        />
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
        <SystemNotificationBanner language={language} />
        <AuthPage
          mode={view}
          language={language}
          submitting={authSubmitting || isRestoring}
          serverError={authError}
          registrationSuccessBanner={registrationSuccessBanner}
          onDismissRegistrationSuccess={() => setRegistrationSuccessBanner(null)}
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
        />
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

  if (view === "terms" || view === "privacy") {
    return (
      <>
        <SystemNotificationBanner language={language} />
        <LegalPage language={language} documentKey={view} onBack={closeLegalPage} />
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
        <div className="min-h-screen bg-nb-bg px-6 py-12 font-sans text-nb-text antialiased">
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[28px] border border-white/[0.08] bg-nb-panel/55 px-10 py-16 text-center shadow-[0_50px_100px_-24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">NB PDF PLARTFORM</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Oturum doğrulanıyor</h1>
            <p className="mt-4 text-base leading-8 text-nb-muted">Güvenli erişim bilgileriniz kontrol ediliyor. Lütfen bekleyin.</p>
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
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">NB PDF PLARTFORM</p>
            <p className="mt-4 text-base text-nb-muted">Oturum bilgileri yükleniyor…</p>
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
      return (
        <>
          <div className="min-h-screen bg-nb-bg px-6 py-16 text-center text-nb-muted">
            <p className="text-lg font-semibold text-nb-text">Yönetici erişimi gerekli</p>
            <p className="mt-2 text-sm">Yetkili bir yönetici hesabıyla giriş yapın.</p>
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
        <AdminPanel
          accessToken={accessToken}
          userEmail={user?.email ?? "admin"}
          onExit={() => {
            setView("web");
            window.history.replaceState({}, "", "/workspace");
          }}
          onLogout={() => void handleLogout()}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
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
              <button type="button" className="contact-modal__close" onClick={closeContactModal} aria-label={contactCopy.close}>
                ×
              </button>
            </div>
            <form className="contact-modal__form" onSubmit={handleContactModalSubmit}>
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
              {contactError ? <p className="field-error">{contactError}</p> : null}
              <button className="primary-action" type="submit" disabled={contactSubmitting}>
                {contactSubmitting ? contactCopy.submitting : contactCopy.submit}
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

      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        language={language}
        buyingProduct={null}
        onBuyPack={(product) => void handleSelectCreditPackForPayment(product)}
      />

      {paymentSummaryProduct && accessToken ? (
        <PaymentSummaryModal
          open
          product={paymentSummaryProduct}
          accessToken={accessToken}
          language={language}
          onClose={() => setPaymentSummaryProduct(null)}
          onPurchaseSuccess={() => void handleCreditPackPurchaseSuccess()}
        />
      ) : null}

      {uploads[0] && selectedFeatureId === "split" ? (
        <SplitPagePickerModal
          open={splitPickerOpen}
          onClose={() => setSplitPickerOpen(false)}
          file={uploads[0].file}
          password={password}
          maxPage={uploads[0].pageCount}
          pagesText={pagesText}
          onPagesTextChange={setPagesText}
          onPagesErrorClear={() => setPagesError("")}
          language={language}
        />
      ) : null}

      <ConversionPopup
        open={conversionPopupOpen}
        variant={conversionPopupVariant}
        language={language}
        onDismiss={dismissConversionPopup}
        onPrimary={onConversionPopupPrimary}
        onSecondary={onConversionPopupSecondary}
      />

      <ConversionUpgradeModal
        open={conversionUpgradeModalOpen}
        onClose={dismissConversionUpgradeModal}
        onContinueWithoutWaiting={() => {
          const stats = recordConversionModalPrimaryClick();
          pushConversionModalAnalytics("nb_conversion_modal_primary_click", {
            shown_total: stats.shownTotal,
            primary_total: stats.primaryClicksTotal,
            ctr_pct: conversionModalClickThroughRate(stats),
          });
          setConversionUpgradeModalOpen(false);
          setUpgradeModalOpen(true);
        }}
        onMaybeLater={snoozeConversionUpgradeModal}
        language={language}
        operationsToday={userBalance?.creditBalance ?? 0}
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
            <h2 className="text-lg font-semibold text-slate-50">{W.pdfExcelWarningTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{W.pdfExcelWarningBody}</p>
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
                  (document.getElementById("nb-workspace-tool-form") as HTMLFormElement | null)?.requestSubmit();
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
        creditBalance={userBalance?.creditBalance ?? null}
        creditBalanceLoading={subscriptionLoading && !userBalance}
        hasActiveSubscription={userBalance?.hasActiveSubscription}
        onLogoClick={handleDashboardLogoClick}
        onProfile={handleNavProfile}
        onPassword={handleNavPassword}
        onLogout={() => void handleLogout()}
        onUpgradeClick={() => setUpgradeModalOpen(true)}
        showAdminEntry={user?.role === "ADMIN"}
        onOpenAdmin={() => {
          setView("admin");
          window.history.replaceState({}, "", "/admin");
        }}
      />
      {workspaceBanner.enabled ? (
        <div className="border-b border-cyan-500/30 bg-cyan-950/50 px-4 py-2 text-center text-xs font-medium text-cyan-100 md:text-sm">
          {workspaceBanner.text}
        </div>
      ) : null}
      {flags.maintenanceMode ? (
        <div className="border-b border-amber-500/35 bg-amber-950/55 px-4 py-2 text-center text-xs font-medium text-amber-100 md:text-sm">
          {language === "tr"
            ? "Bakım modu etkin — işlemler kısıtlanabilir. Yönetim panelinden kapatılabilir."
            : "Maintenance mode is on — some actions may be limited. Disable it from the admin panel."}
        </div>
      ) : null}
      <DashboardSidebar
        active={activeSidebar}
        onSelect={handleSidebarSelect}
        language={language}
        onLanguageChange={(lang) => void handleLanguageChange(lang)}
        onGoHome={goToLandingFromDashboard}
        lockedFeatures={lockedFeatures}
        subscriptionSummary={subscriptionSummary}
        userBalance={userBalance}
        userRole={user?.role}
        onUsageUpgradeClick={() => setUpgradeModalOpen(true)}
        onBuyCredits={() => handleBuyCredits()}
        enabledToolIds={enabledToolIds}
        resolveToolLabel={resolveToolLabel}
        onOpenAdminDashboard={
          user?.role === "ADMIN"
            ? () => {
                setView("admin");
                window.history.replaceState({}, "", "/admin");
              }
            : undefined
        }
      />
      {showCreditWorkspaceChrome && !bottomToolProgressActive && userBalance ? (
        <div className="pointer-events-none fixed bottom-4 left-4 z-30 max-w-[calc(100vw-2rem)] md:hidden">
          <div
            className={`pointer-events-auto rounded-xl border px-3 py-3 text-xs shadow-lg backdrop-blur-md ${
              creditsExhausted || creditsRunningLow
                ? "border-amber-500/45 bg-gradient-to-b from-amber-950/50 to-nb-bg-elevated/98"
                : "border-white/[0.1] bg-nb-bg-elevated/95"
            }`}
          >
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-nb-muted">{W.creditBalanceHeading}</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums leading-none text-nb-text">
                  {userBalance.hasActiveSubscription ? W.usageUnlimited : userBalance.creditBalance}
                </p>
              </div>
            </div>
            {creditsRunningLow ? (
              <p className="mt-2 text-[11px] font-semibold leading-snug text-amber-200/95">{W.creditRunningOutBanner}</p>
            ) : null}
            {creditsExhausted ? (
              <p className="mt-2 text-[11px] leading-snug text-amber-200/90">{W.creditBalanceExhaustedHint}</p>
            ) : null}
            <div className="mt-2.5 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => handleBuyCredits()}
                className="nb-transition w-full rounded-lg border border-nb-primary/45 bg-nb-primary/12 px-2 py-2 text-[10px] font-bold uppercase tracking-[0.05em] text-nb-accent hover:bg-nb-primary/18"
              >
                {W.creditDashboardBuyCreditsCta}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div
        className={`min-h-screen bg-nb-bg pt-14 md:pl-60 ${bottomToolProgressActive ? "pb-32 md:pb-36" : "pb-10"}`}
      >
        <DashboardSidebarMobileRail
          active={activeSidebar}
          onSelect={handleSidebarSelect}
          language={language}
          onLanguageChange={(lang) => void handleLanguageChange(lang)}
          onGoHome={goToLandingFromDashboard}
          lockedFeatures={lockedFeatures}
          userRole={user?.role}
          enabledToolIds={enabledToolIds}
          resolveToolLabel={resolveToolLabel}
          onOpenAdminDashboard={
            user?.role === "ADMIN"
              ? () => {
                  setView("admin");
                  window.history.replaceState({}, "", "/admin");
                }
              : undefined
          }
        />
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
          {contentPanel === "subscription" ? (
            <section className="subscription-card">
              <CreditDashboard
                language={language}
                balance={userBalance}
                balanceLoading={subscriptionLoading}
                transactions={creditTransactions}
                transactionsLoading={creditTransactionsLoading}
                onBuyPack={(product) => void handleSelectCreditPackForPayment(product)}
                buyingProduct={null}
              />
            </section>
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
              <p className="section-kicker">{selectedFeature.title}</p>
              <h2>{selectedFeature.description}</h2>
            </div>
          </div>

          {showCreditWorkspaceChrome && creditsExhausted ? (
            <div className="border-b border-amber-500/25 bg-gradient-to-r from-amber-950/45 via-amber-950/25 to-transparent px-4 py-3 md:px-6">
              <p className="text-sm font-medium leading-snug text-amber-50/95">{W.creditBalanceExhaustedHint}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBuyCredits()}
                  className="nb-transition inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-nb-primary/45 bg-nb-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] text-nb-accent hover:bg-nb-primary/25"
                >
                  {W.creditDashboardBuyCreditsCta}
                </button>
              </div>
            </div>
          ) : null}

          {showCreditWorkspaceChrome && creditsRunningLow ? (
            <div className="border-b border-amber-500/30 bg-gradient-to-r from-amber-950/35 via-amber-950/15 to-transparent px-4 py-3 md:px-6">
              <p className="text-sm font-semibold text-amber-50/95">{W.creditRunningOutBanner}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBuyCredits()}
                  className="nb-transition inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-nb-primary/45 bg-nb-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.06em] text-nb-accent hover:bg-nb-primary/25"
                >
                  {W.creditDashboardBuyCreditsCta}
                </button>
              </div>
            </div>
          ) : null}

          {showCreditWorkspaceChrome && creditsModerateLow && !creditsRunningLow ? (
            <div className="border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-transparent px-4 py-2.5 md:px-6">
              <p className="text-[13px] font-medium text-cyan-100/90">{W.lowCreditBanner(userBalance?.creditBalance ?? 0)}</p>
            </div>
          ) : null}

          {standardLaneProcessingUpsell ? (
            <div
              className="border-b border-indigo-500/20 bg-gradient-to-r from-cyan-950/35 via-nb-panel/40 to-indigo-950/25 px-4 py-3 md:px-6"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="min-w-0 text-sm font-medium leading-snug text-slate-200">{W.delayMonetizationDuringBody}</p>
                <button
                  type="button"
                  className="nb-transition shrink-0 rounded-xl bg-gradient-to-b from-cyan-400 to-cyan-500 px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-950 shadow-[0_8px_24px_-10px_rgba(34,211,238,0.45)] hover:brightness-105"
                  onClick={() => openConversionUpgradeModalManual()}
                >
                  {W.delayMonetizationInstantCta}
                </button>
              </div>
            </div>
          ) : null}

          <div className="relative min-h-[280px]">
            <div
              className={
                !selectedFeatureAllowed
                  ? "pointer-events-none blur-[3px] transition-[filter] duration-200"
                  : undefined
              }
            >
              <form id="nb-workspace-tool-form" className="tool-form" onSubmit={submitCurrentFeature}>
            {selectedFeature.id === "html-to-pdf" ? (
              <div className="field field--full">
                <span>{language === "tr" ? "HTML → PDF" : "HTML → PDF"}</span>
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
                    onChange={(e) => setHtmlToPdfUrl(e.target.value)}
                    placeholder="https://"
                  />
                ) : (
                  <textarea
                    className="min-h-[140px] w-full font-mono text-sm"
                    value={htmlToPdfRaw}
                    onChange={(e) => setHtmlToPdfRaw(e.target.value)}
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
                <button className="file-picker-button" type="button" onClick={triggerFilePicker}>
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
                      const sanitized = event.target.value.replace(/[^\d,\-\s]/g, "");
                      setPagesText(sanitized);
                      const fmt = validatePagesFormat(sanitized, language);
                      const maxP = uploads[0]?.pageCount ?? null;
                      let over = validatePagesMax(sanitized, maxP, language);
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
                  {pagesError ? <span className="field-error">{pagesError}</span> : null}
                </label>

                {uploads[0]?.file.type === "application/pdf" && (uploads[0].pageCount ?? 0) > 0 ? (
                  <div className="field">
                    <button type="button" className="primary-action w-full sm:w-auto" onClick={() => setSplitPickerOpen(true)}>
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
                  <select value={splitMode} onChange={(event) => setSplitMode(event.target.value)}>
                    <option value="single">{W.splitModeSingle}</option>
                    <option value="separate">{W.splitModeSeparate}</option>
                  </select>
                  <span className="field-hint">{splitModeDescription}</span>
                </label>
              </>
            ) : null}

            {selectedFeature.id === "delete-pages" ? (
              <label className="field">
                <span>{language === "tr" ? "Silinecek sayfalar" : "Pages to remove"}</span>
                <input
                  type="text"
                  value={deletePagesText}
                  disabled={splitInputDisabled}
                  onChange={(event) => {
                    const v = event.target.value.replace(/[^\d,\-\s]/g, "");
                    setDeletePagesText(v);
                    const fmt = validatePagesFormat(v, language);
                    const maxP = uploads[0]?.pageCount ?? null;
                    setDeletePagesError(fmt || validatePagesMax(v, maxP, language));
                  }}
                  placeholder={W.pagesPlaceholder}
                />
                {deletePagesError ? <span className="field-error">{deletePagesError}</span> : null}
              </label>
            ) : null}

            {selectedFeature.id === "rotate-pdf" ? (
              <>
                <label className="field">
                  <span>{language === "tr" ? "Dönüş açısı" : "Rotation"}</span>
                  <select value={rotateDeg} onChange={(e) => setRotateDeg(e.target.value)}>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                  </select>
                </label>
                <label className="field">
                  <span>{language === "tr" ? "Sadece belirli sayfalar (isteğe bağlı)" : "Only certain pages (optional)"}</span>
                  <input
                    type="text"
                    value={rotatePagesOnly}
                    onChange={(e) => setRotatePagesOnly(e.target.value.replace(/[^\d,\-\s]/g, ""))}
                    placeholder={language === "tr" ? "Boş: tüm sayfalar" : "Empty: all pages"}
                  />
                </label>
              </>
            ) : null}

            {selectedFeature.id === "organize-pdf" ? (
              <label className="field">
                <span>{language === "tr" ? "Yeni sıra (1 tabanlı, virgülle)" : "New order (1-based, comma-separated)"}</span>
                <input
                  type="text"
                  value={organizeOrder}
                  onChange={(e) => setOrganizeOrder(e.target.value.replace(/[^\d,\s]/g, ""))}
                  placeholder="3,1,2,4"
                />
                <span className="field-hint">
                  {language === "tr"
                    ? "Toplam sayfa adedi kadar ve her sayfayı bir kez içermelidir."
                    : "Must list every page exactly once, in the new order."}
                </span>
              </label>
            ) : null}

            {showUnlockPasswordField ? (
              <label className="field">
                <span>{language === "tr" ? "Mevcut PDF parolası" : "Current PDF password"}</span>
                <input
                  type="password"
                  value={unlockOpenPassword}
                  onChange={(event) => setUnlockOpenPassword(event.target.value)}
                  placeholder={language === "tr" ? "Belgeyi açan parola" : "Password that opens the file"}
                />
              </label>
            ) : null}

            {selectedFeature.id === "watermark" ? (
              <label className="field">
                <span>{language === "tr" ? "Filigran metni" : "Watermark text"}</span>
                <input
                  type="text"
                  value={watermarkPhrase}
                  onChange={(e) => setWatermarkPhrase(e.target.value)}
                  maxLength={120}
                />
              </label>
            ) : null}

            {selectedFeature.id === "page-numbers" ? (
              <>
                <label className="field">
                  <span>{language === "tr" ? "Numaraya başlama" : "Start number"}</span>
                  <input type="number" min={1} value={pageNumStart} onChange={(e) => setPageNumStart(e.target.value)} />
                </label>
                <label className="field">
                  <span>{language === "tr" ? "Konum" : "Position"}</span>
                  <select value={pageNumPos} onChange={(e) => setPageNumPos(e.target.value as "footer" | "header")}>
                    <option value="footer">{language === "tr" ? "Alt bilgi" : "Footer"}</option>
                    <option value="header">{language === "tr" ? "Üst bilgi" : "Header"}</option>
                  </select>
                </label>
              </>
            ) : null}

            {selectedFeature.id === "pdf-to-ppt" ? (
              <label className="field">
                <span>DPI</span>
                <input type="number" min={72} max={200} value={pdfToPptDpi} onChange={(e) => setPdfToPptDpi(e.target.value)} />
              </label>
            ) : null}

            {selectedFeature.id === "pdf-to-image" ? (
              <>
                <label className="field">
                  <span>{language === "tr" ? "Görüntü biçimi" : "Image format"}</span>
                  <select value={pdfToImgFmt} onChange={(e) => setPdfToImgFmt(e.target.value)}>
                    <option value="jpg">JPG</option>
                    <option value="png">PNG</option>
                  </select>
                </label>
                <label className="field">
                  <span>DPI</span>
                  <input type="number" min={72} max={300} value={pdfToImgDpi} onChange={(e) => setPdfToImgDpi(e.target.value)} />
                </label>
              </>
            ) : null}

            {showSplitPasswordField ? (
              <label className="field">
                <span>{W.sourcePassword}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={language === "tr" ? "PDF parolası" : "PDF password"}
                />
                <span className="field-hint">{W.sourcePasswordHint}</span>
              </label>
            ) : null}

            {selectedFeature.id === "ppt-to-pdf" && language === "en" ? (
              <p className="text-xs text-amber-200/80">
                Best on Windows with Microsoft PowerPoint installed. Other environments may not support conversion.
              </p>
            ) : null}
            {selectedFeature.id === "ppt-to-pdf" && language === "tr" ? (
              <p className="text-xs text-amber-200/80">
                Windows ve yüklü Microsoft PowerPoint ile en iyi sonuç alınır; diğer ortamlarda dönüşüm desteklenmeyebilir.
              </p>
            ) : null}

            {selectedFeature.id === "encrypt" ? (
              <>
                {showEncryptSourcePasswordField ? (
                  <label className="field field--full">
                    <span>{W.sourcePassword}</span>
                    <input
                      type="password"
                      value={inputPassword}
                      onChange={(event) => setInputPassword(event.target.value)}
                      placeholder={language === "tr" ? "Mevcut PDF parolası" : "Current PDF password"}
                    />
                    <span className="field-hint">{W.sourcePasswordHint}</span>
                  </label>
                ) : null}

                <label className="field field--full">
                  <span>{W.newPdfPassword}</span>
                  <input
                    type="password"
                    value={outputPassword}
                    disabled={uploads.length === 0}
                    onChange={(event) => setOutputPassword(event.target.value)}
                    placeholder={uploads.length === 0 ? "" : W.newPdfPasswordPh}
                  />
                </label>
              </>
            ) : null}

            {toolNeedsUpload ? (
            <div className="selected-files">
              <div className="selected-files__header">
                <div className="selected-files__title-row">
                  <p>{W.selectedFiles}</p>
                  {selectedFeature.id === "merge" && uploads.length > 0 ? (
                    <button
                      type="button"
                      className="nb-transition shrink-0 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200/95 hover:border-rose-400/55 hover:bg-rose-950/50 sm:text-sm"
                      onClick={clearAllUploads}
                    >
                      {W.mergeClearAll}
                    </button>
                  ) : null}
                </div>
                {selectedFeature.id === "merge" && uploads.length > 0 ? (
                  <span className="selected-files__info">{W.mergeReorderHint}</span>
                ) : null}
              </div>
              {uploads.length === 0 && selectedFeature.id === "html-to-pdf" ? (
                <p className="px-1 py-4 text-sm text-nb-muted">
                  {language === "tr"
                    ? "Dosya gerekmez; yukarıdaki URL veya HTML alanını doldurun."
                    : "No file needed — fill in the URL or HTML field above."}
                </p>
              ) : uploads.length === 0 ? (
                <EmptyState title={W.emptyStateTitle} hint={W.emptyStateHint} />
              ) : (
                <div ref={mergeListScrollRef} className="selected-files__list">
                  {uploads.map((item, index) => {
                    const compressEst =
                      selectedFeature.id === "compress" && !item.inspecting
                        ? compressEstimatePercentRange(item.file.size)
                        : null;
                    const dragFromIdx =
                      mergePointerDraggingId !== null ? uploads.findIndex((u) => u.id === mergePointerDraggingId) : -1;
                    const dragToIdx = mergeDragOverIndex ?? dragFromIdx;
                    const previewOff =
                      mergePointerDraggingId && dragFromIdx >= 0
                        ? getReorderPreviewOffset(index, dragFromIdx, dragToIdx, mergeDragSlotPx)
                        : 0;
                    return (
                    <div
                      key={item.id}
                      data-merge-row-index={index}
                      className={`selected-file-card ${selectedFeature.id === "merge" ? "draggable merge-row-pointer" : ""} ${
                        mergePointerDraggingId === item.id ? "selected-file-card--drag-source" : ""
                      } ${
                        mergeDragOverIndex === index &&
                        mergePointerDraggingId &&
                        mergePointerDraggingId !== item.id
                          ? "selected-file-card--drop-target"
                          : ""
                      } ${mergeSnapId === item.id ? "selected-file-card--snap" : ""}`}
                      style={
                        mergePointerDraggingId && dragFromIdx >= 0
                          ? {
                              transform: `translateY(${previewOff}px)`,
                              transition:
                                index === dragFromIdx
                                  ? "none"
                                  : "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
                            }
                          : undefined
                      }
                      onPointerDown={(e) => handleMergeRowPointerDown(e, index, item.id)}
                    >
                      <div className="selected-file-card__main">
                        <div className="selected-file-card__lead">
                          <div className="selected-file-card__icon" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none" className="selected-file-card__icon-svg">
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
                              <span className="selected-file-card__size">{formatFileSize(item.file.size)}</span>
                              {compressEst ? (
                                <span className="selected-file-card__compress" title={W.compressEstimateTooltip}>
                                  {W.compressEstimateLine(compressEst.min, compressEst.max)}
                                </span>
                              ) : null}
                              {item.inspecting ? <span>{W.inspecting}</span> : null}
                              {!item.inspecting && item.encrypted ? <span className="warning-text">{W.encryptedBadge}</span> : null}
                              {!item.inspecting && !item.encrypted ? <span>{W.ready}</span> : null}
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
                                onClick={() => moveUploadUp(index)}
                                aria-label={W.up}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                draggable={false}
                                className="nb-transition rounded-lg border border-white/[0.12] bg-nb-panel/80 px-2 py-1 text-xs font-semibold text-nb-text hover:border-nb-primary/40 disabled:opacity-35"
                                disabled={index >= uploads.length - 1}
                                onClick={() => moveUploadDown(index)}
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
                            onClick={() => removeUpload(item.id)}
                            aria-label={`${W.remove}: ${item.file.name}`}
                          >
                            <svg className="remove-button__glyph" viewBox="0 0 24 24" fill="none" aria-hidden>
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

                      {selectedFeature.id === "merge" && item.encrypted ? (
                        <div className="mt-3 rounded-xl border border-white/[0.1] bg-nb-panel/50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nb-muted">
                            {language === "tr" ? "Şifre gerekli" : "Password required"}
                          </p>
                          <p className="mt-1 text-sm leading-snug text-nb-text/90">{W.mergeEncryptedAlert}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <input
                              type="password"
                              className="min-w-[180px] flex-1 rounded-lg border border-white/12 bg-nb-bg/90 px-3 py-2.5 text-sm text-nb-text shadow-sm placeholder:text-nb-muted focus:border-nb-primary/45 focus:outline-none focus:ring-2 focus:ring-nb-primary/25"
                              value={item.password}
                              onChange={(event) => setUploadPassword(item.id, event.target.value)}
                              placeholder={W.perFilePasswordPh}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              className="nb-transition rounded-lg border border-nb-primary/35 bg-nb-primary/15 px-3 py-2.5 text-sm font-semibold text-nb-accent hover:bg-nb-primary/25 disabled:opacity-45"
                              disabled={mergeVerifyingId === item.id || !item.password.trim()}
                              onClick={() => void verifyMergeFilePassword(item.id)}
                            >
                              {mergeVerifyingId === item.id ? W.mergePasswordVerifying : W.mergePasswordConfirm}
                            </button>
                            {item.mergePasswordVerified ? (
                              <span
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/45 bg-cyan-950/40 text-cyan-300"
                                title={W.mergePasswordOk}
                                aria-label={W.mergePasswordOk}
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

            {selectedFeature.id === "merge" && uploads.length > 0 && (toolFilesStillInspecting || mergeHasMissingPasswords) ? (
              <div className="merge-hint-banner" role="note">
                <span className="merge-hint-banner__dot" aria-hidden />
                <p className="merge-hint-banner__text">
                  {toolFilesStillInspecting ? W.mergeButtonHintInspecting : W.mergeButtonHintPassword}
                </p>
              </div>
            ) : null}

            <button className="primary-action" type="submit" disabled={submitDisabled}>
              {submitting
                ? creditStandardLaneQueue
                  ? W.processingQueued
                  : premiumProcessingLane
                    ? W.processingPremium
                    : W.processing
                : selectedFeature.buttonText}
            </button>
          </form>
            </div>
            {!selectedFeatureAllowed ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-nb-bg/70 px-5 text-center backdrop-blur-sm">
                <p className="text-base font-semibold text-nb-text">{W.proGateTitle}</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-nb-muted">{W.proGateBody}</p>
                <button type="button" className="primary-action mt-5" onClick={() => setUpgradeModalOpen(true)}>
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
          <div className="merge-progress-fixed merge-progress-fixed--success" role="status" aria-live="polite">
            <div className="merge-progress-fixed__inner">
              <div className="merge-progress-fixed__head">
                <div className="merge-progress-fixed__titles">
                  <strong className="merge-progress-fixed__title merge-progress-fixed__title--success">
                    {W.toolProgressSuccessTitle}
                  </strong>
                  <p className="merge-progress-fixed__phase merge-progress-fixed__phase--success">
                    {toolProgressSuccess.featureTitle} · {toolProgressSuccess.filename}
                  </p>
                </div>
                <span className="merge-progress-fixed__pct merge-progress-fixed__pct--success" aria-hidden>
                  %100
                </span>
              </div>
              <div
                className="progress-bar progress-bar--merge progress-bar--success"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={100}
                aria-label={W.toolProgressSuccessTitle}
              >
                <div className="progress-bar__fill progress-bar__fill--success" style={{ width: "100%" }} />
              </div>
              {showCreditWorkspaceChrome &&
              postRunUpgradeHintVisible &&
              !postRunUpgradeHintDismissed &&
              !hideMonetizationHintsForInsufficientGate ? (
                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] leading-relaxed text-slate-400">{W.delayMonetizationAfterHint}</p>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="nb-transition text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                      onClick={() => openConversionUpgradeModalManual()}
                    >
                      {W.delayMonetizationInstantCta}
                    </button>
                    <button
                      type="button"
                      className="nb-transition text-[11px] text-slate-500 hover:text-slate-400"
                      onClick={() => setPostRunUpgradeHintDismissed(true)}
                    >
                      {W.delayMonetizationAfterDismiss}
                    </button>
                  </div>
                </div>
              ) : null}
              {upgradeNudgeTier >= 1 &&
              showCreditWorkspaceChrome &&
              !upgradeNudgePostSuccessHidden &&
              !hideMonetizationHintsForInsufficientGate ? (
                <UpgradeNudgeInline
                  tier={upgradeNudgeTier as 1 | 2 | 3}
                  W={W}
                  onContinueFree={() => setUpgradeNudgePostSuccessHidden(true)}
                  onUpgrade={() => {
                    openConversionUpgradeModalManual();
                    setUpgradeNudgePostSuccessHidden(true);
                  }}
                />
              ) : null}
              {toolProgressSuccess.gatedDownload ? (
                <SaasGatedPreview
                  gating={toolProgressSuccess.gatedDownload.saasGating ?? null}
                  language={language}
                  filename={toolProgressSuccess.filename}
                  thumbnailUrl={toolProgressSuccess.gatedDownload.thumbnailBlobUrl}
                  onDownload={() => {
                    const gd = toolProgressSuccess.gatedDownload;
                    if (gd) {
                      queueGatedDownload(gd.resultId, gd.fallbackName, selectedFeatureId);
                    }
                  }}
                  onUpgrade={() => openConversionUpgradeModalManual()}
                  onInsufficientCredits={() => {
                    armInsufficientCreditsToolBarrier();
                    tryShowConversionPopupRef.current("insufficient_credits", "download");
                  }}
                  onRetry={
                    toolProgressSuccess.gatedDownload?.saasGating?.reason === "insufficient_credits"
                      ? undefined
                      : () => {
                          const gd = toolProgressSuccess.gatedDownload;
                          if (gd) {
                            queueGatedDownload(gd.resultId, gd.fallbackName, selectedFeatureId);
                          }
                        }
                  }
                  onDismiss={disposeToolProgressSuccess}
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
                    <p className="merge-progress-fixed__native-hint">{W.toolProgressNativeDownloadHint}</p>
                  )}
                  <button type="button" className="merge-progress-fixed__dismiss" onClick={disposeToolProgressSuccess}>
                    {W.toolProgressDismiss}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}
        {TOOLSuccessBarActive ? null : mergeProgressActive && mergeJob ? (
          <div className="merge-progress-fixed" role="status" aria-live="polite">
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
                        ? creditStandardLaneQueue
                          ? W.mergeProgressQueueFree
                          : premiumProcessingLane
                            ? W.mergeProgressQueuePremium
                            : W.mergeProgressStarting
                        : mergeToolPhaseLabel(mergeJob, mergeProgressIndeterminate, W)}
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
                  mergeProgressIndeterminate ? undefined : mergeJob.status === "failed" ? 100 : mergeJob.percent
                }
                aria-label={mergeToolPhaseLabel(mergeJob, mergeProgressIndeterminate, W) || selectedFeature.title}
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
                    ? W.mergeFileProgress(mergeJob.current, mergeJob.total, mergeJob.where)
                    : `${W.mergeStatus}: ${mergeJob.current}/${mergeJob.total}${
                        mergeJob.where ? ` · ${mergeJob.where}` : ""
                      }`}
                </span>
                {mergeEtaSeconds !== null && mergeJob.status === "running" && !mergeProgressIndeterminate ? (
                  <span className="merge-progress-fixed__eta">{W.mergeEtaLine(mergeEtaSeconds)}</span>
                ) : null}
              </div>
              {showUpgradeNudgeOnLoading && mergeProgressActive ? (
                <UpgradeNudgeInline
                  tier={upgradeNudgeTier as 1 | 2 | 3}
                  W={W}
                  onContinueFree={() => setUpgradeNudgeLoadingHidden(true)}
                  onUpgrade={() => {
                    openConversionUpgradeModalManual();
                    setUpgradeNudgeLoadingHidden(true);
                  }}
                />
              ) : null}
              {mergeJob.status === "failed" && mergeJob.error ? (
                <p className="merge-progress-fixed__err">{mergeJob.error}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {TOOLSuccessBarActive ? null : genericToolProgressActive ? (
          <div className="merge-progress-fixed merge-progress-fixed--generic" role="status" aria-live="polite">
            <div className="merge-progress-fixed__inner">
              <div className="merge-progress-fixed__head">
                <div className="merge-progress-fixed__titles">
                  <strong className="merge-progress-fixed__title">{selectedFeature.title}</strong>
                  <p className="merge-progress-fixed__phase">
                    {genericToolPhaseLabel(
                      selectedFeatureId,
                      genericToolPercent,
                      genericProgressIndeterminate,
                      W,
                      creditStandardLaneQueue,
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
                  {genericProgressIndeterminate ? "…" : `%${genericToolPercent}`}
                </span>
              </div>
              <div
                className={`progress-bar progress-bar--merge progress-bar--gradient ${genericProgressIndeterminate ? "progress-bar--indeterminate" : ""}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={genericProgressIndeterminate ? undefined : genericToolPercent}
                aria-label={genericToolPhaseLabel(
                  selectedFeatureId,
                  genericToolPercent,
                  genericProgressIndeterminate,
                  W,
                  creditStandardLaneQueue,
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
                  {creditStandardLaneQueue
                    ? W.toolProgressSubQueueFree
                    : premiumProcessingLane
                      ? W.toolProgressSubPremium
                      : W.toolProgressSub}
                </span>
                {genericToolFileMb >= 5 ? (
                  <span className="merge-progress-fixed__eta">{W.toolProgressLargeFileHint(genericToolFileMb)}</span>
                ) : null}
                {genericToolElapsedSec >= 1 ? (
                  <span className="merge-progress-fixed__eta">{W.toolProgressElapsed(genericToolElapsedSec)}</span>
                ) : null}
                {genericToolRemainingSec > 0 && genericToolElapsedSec >= 4 ? (
                  <span className="merge-progress-fixed__eta">{W.mergeEtaLine(genericToolRemainingSec)}</span>
                ) : null}
              </div>
              {showUpgradeNudgeOnLoading && genericToolProgressActive ? (
                <UpgradeNudgeInline
                  tier={upgradeNudgeTier as 1 | 2 | 3}
                  W={W}
                  onContinueFree={() => setUpgradeNudgeLoadingHidden(true)}
                  onUpgrade={() => {
                    openConversionUpgradeModalManual();
                    setUpgradeNudgeLoadingHidden(true);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="footer-bar">
        <span>NB PDF PLARTFORM</span>
        <span>by NB Global Studio</span>
        <div className="footer-bar__right">
          <span>Web Edition</span>
          <button type="button" onClick={() => openLegalPage("terms")}>
            {language === "tr" ? "HİZMET ŞARTLARI" : "TERMS OF SERVICE"}
          </button>
          <button type="button" onClick={() => openLegalPage("privacy")}>
            {language === "tr" ? "GİZLİLİK POLİTİKASI" : "PRIVACY POLICY"}
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
  );
}

export default App;
