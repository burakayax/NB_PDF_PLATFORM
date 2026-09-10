/**
 * UYGULAMA YÖNLENDİRME — adres çubuğu ile ekran arasındaki eşleme.
 *
 * Hangi adres hangi ekranı açar, izlemeye hangi ad gönderilir, araç sayfasından
 * gelen kullanıcı giriş sonrası nereye döner: hepsi burada. Ana uygulama
 * dosyasının içinde durduğunda o dosyayı gereksiz büyütüyor ve bu mantığı
 * bulmayı zorlaştırıyordu.
 */
import type { FeatureKey } from "../api/subscription";
import { stripLangPrefix } from "../hooks/usePreferredLanguage";
import { parseWorkspaceToolPath, toolSlugForFeature } from "./toolRoutes";
import type { AppView, ContentPanel } from "./appViews";

export function workspacePathForFeature(featureId: FeatureKey): string {
  return `/tools/${toolSlugForFeature(featureId)}`;
}

/** createMergeJob yanıtı gelene kadar UI'da anında gösterilen yer tutucu iş kimliği. */
export const MERGE_JOB_PENDING_ID = "__merge_pending__";
/** Büyük birleştirmeler (10k+ sayfa) dakikalar sürebilir; 30 sn ile iptal etmeyin. */
export const MERGE_WATCHDOG_MS = 6 * 60 * 60 * 1000;
/** Büyük PDF'lerde /api/inspect-pdf uzun sürebilir; 30 sn ile yükleme iptali yapmayın. */
export const PDF_INSPECT_TIMEOUT_MS = 15 * 60 * 1000;
/** Result-store (Sayfa Sil, Split, …) sunucu işi uzun sürebilir; merge watchdog ile uyumlu üst sınır. */
export const TOOL_PIPELINE_WATCHDOG_MS = 6 * 60 * 60 * 1000;

export function withPdfInspectTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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

export function getTrackedViewName(view: AppView) {
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
    case "on-bilgilendirme":
      return "legal-on-bilgilendirme";
    case "mesafeli-satis":
      return "legal-mesafeli-satis";
    case "web":
      return "workspace";
    case "admin":
      return "admin-panel";
    default:
      return "landing";
  }
}

export function getTrackedPath(view: AppView) {
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
    case "on-bilgilendirme":
      return "/legal/on-bilgilendirme";
    case "mesafeli-satis":
      return "/legal/mesafeli-satis";
    case "web":
      return "/workspace";
    case "admin_login":
      return "/nbadmin";
    case "admin":
      return "/admin";
    case "team_invite":
      return "/team-invite";
    default:
      return "/";
  }
}

export function getInitialViewFromLocation(): AppView {
  if (typeof window === "undefined") {
    return "landing";
  }
  // /en (İngilizce alt dizin) önekini soy: /en/tools/... → /tools/... olarak
  // eşleştir. Dilin kendisi usePreferredLanguage tarafından /en'den algılanır.
  const rawPath =
    stripLangPrefix(window.location.pathname.replace(/\/$/, "")) || "/";
  if (parseWorkspaceToolPath(rawPath)) {
    return "web";
  }
  // Yeni SEO araç sayfaları (AI/Editör/OCR) — FeatureKey değil ama "web" görünümü
  // (App.tsx'teki özel handler bunları tam sayfa render eder; landing'e reset olmaz).
  if (
    rawPath === "/tools/pdf-ozetle" ||
    rawPath === "/tools/pdf-sohbet" ||
    rawPath === "/tools/pdf-duzenle" ||
    rawPath === "/tools/pdf-imzala" ||
    rawPath === "/tools/pdf-yorumla" ||
    rawPath === "/tools/taranmis-pdf-ocr" ||
    rawPath === "/tools/pdf-veri-cikar" ||
    rawPath === "/tools/pdf-ceviri" ||
    rawPath === "/tools/ai-toplu-islem" ||
    rawPath === "/tools/pdf-karsilastir" ||
    rawPath === "/tools/hassas-veri-gizle" ||
    rawPath === "/tools/belge-tara" ||
    rawPath === "/tools/aranabilir-pdf" ||
    rawPath === "/tools/crop-pdf" ||
    rawPath === "/tools/gorsel-sikistir" ||
    rawPath === "/tools/gorsel-boyutlandir" ||
    rawPath === "/tools/pdf-kesit-al" ||
    rawPath === "/pdf-api" ||
    rawPath.startsWith("/pdf-api/") ||
    rawPath === "/blog" ||
    rawPath.startsWith("/blog/")
  ) {
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
    case "/legal/on-bilgilendirme":
      return "on-bilgilendirme";
    case "/legal/mesafeli-satis":
      return "mesafeli-satis";
    case "/workspace":
      return "web";
    case "/nbadmin":
      return "admin_login";
    case "/team-invite":
      return "team_invite";
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
    requestedView === "kvkk" ||
    requestedView === "on-bilgilendirme" ||
    requestedView === "mesafeli-satis"
  ) {
    return requestedView;
  }
  return "landing";
}

/**
 * TAM SAYFA render edilen özel SEO araç sayfaları (workspace FeatureKey DEĞİL; App.tsx'teki
 * `seoSlug` dalları render eder). Bu yollarda oturum açık kullanıcıda URL /workspace'e
 * YENİDEN YAZILMAMALI (aksi halde sayfa açılıp hemen ana menüye atılır) ve misafir login'e
 * atılmamalı. getInitialViewFromLocation'daki "web" listesiyle aynı olmalı.
 */
export const FULLPAGE_SEO_TOOL_PATHS: ReadonlySet<string> = new Set([
  "/tools/pdf-ozetle", "/tools/pdf-sohbet", "/tools/pdf-duzenle", "/tools/pdf-imzala",
  "/tools/pdf-yorumla", "/tools/taranmis-pdf-ocr", "/tools/pdf-veri-cikar", "/tools/pdf-ceviri",
  "/tools/ai-toplu-islem", "/tools/pdf-karsilastir", "/tools/hassas-veri-gizle",
  "/tools/belge-tara", "/tools/aranabilir-pdf", "/tools/crop-pdf", "/tools/gorsel-sikistir",
  "/tools/gorsel-boyutlandir", "/tools/pdf-kesit-al",
]);
export function isFullPageSeoToolPath(p: string): boolean {
  return FULLPAGE_SEO_TOOL_PATHS.has(p);
}

/**
 * FeatureKey olmayan SEO araç slug'ları → workspace'teki karşılık gelen panel.
 * Giriş YAPMIŞ kullanıcı bu araçlara gittiğinde (ör. Taramalarım → "Araçlarda aç")
 * harici SEO sayfası değil, panelin İÇİ açılır (sidebar + üst bar korunur).
 */
export const SPECIAL_TOOL_PANELS: Record<string, ContentPanel> = {
  "pdf-duzenle": "editor",
  "pdf-imzala": "sign",
  "pdf-yorumla": "annotate",
  "crop-pdf": "crop",
  "gorsel-sikistir": "compress-image",
  "gorsel-boyutlandir": "resize-image",
  "pdf-kesit-al": "snip",
  "aranabilir-pdf": "searchable",
  "taranmis-pdf-ocr": "searchable",
  "belge-tara": "scanner",
};
/** AI araç slug'ı → "ai" panelinin modu. */
export const AI_TOOL_MODES: Record<
  string,
  "summarize" | "chat" | "extract" | "translate" | "redact" | "batch" | "compare"
> = {
  "pdf-ozetle": "summarize",
  "pdf-sohbet": "chat",
  "pdf-veri-cikar": "extract",
  "pdf-ceviri": "translate",
  "hassas-veri-gizle": "redact",
  "ai-toplu-islem": "batch",
  "pdf-karsilastir": "compare",
};
/** Slug'ın workspace içinde açılabilir bir karşılığı var mı? */
export function hasInAppPanelForSeoSlug(slug: string): boolean {
  return !!SPECIAL_TOOL_PANELS[slug] || !!AI_TOOL_MODES[slug];
}

/**
 * URL'deki `/tools/<slug>` parçası (yoksa ""). Bekleyen dosyanın hangi araca
 * teslim edileceğini belirlerken React state'i DEĞİL bunu kullanıyoruz:
 * tam sayfa yüklemede `selectedFeatureId`/`contentPanel` henüz varsayılan
 * değerinde olabiliyor, URL ise ilk andan itibaren doğru.
 */
export function currentToolSlugFromUrl(): string {
  if (typeof window === "undefined") return "";
  const p = stripLangPrefix(window.location.pathname.replace(/\/+$/, "")) || "/";
  return p.startsWith("/tools/") ? p.slice("/tools/".length) : "";
}

/**
 * Giriş yapılmamış kullanıcı bir araç deep-link'ine (ör. PWA kısayolu /tools/x) gelip
 * login'e yönlendirildiğinde, giriş sonrası tam o araca dönmek için saklanan hedef.
 * sessionStorage → yalnızca mevcut oturum; tarayıcı kapanınca temizlenir.
 */
export const PENDING_TOOL_STORAGE_KEY = "nb_pending_tool";

export function savePendingTool(id: FeatureKey): void {
  try {
    sessionStorage.setItem(PENDING_TOOL_STORAGE_KEY, id);
  } catch {
    /* yoksay */
  }
}

export function readPendingToolAndClear(): FeatureKey | null {
  try {
    const v = sessionStorage.getItem(PENDING_TOOL_STORAGE_KEY);
    if (v) {
      sessionStorage.removeItem(PENDING_TOOL_STORAGE_KEY);
      return v as FeatureKey;
    }
  } catch {
    /* yoksay */
  }
  return null;
}

export function clearPendingTool(): void {
  try {
    sessionStorage.removeItem(PENDING_TOOL_STORAGE_KEY);
  } catch {
    /* yoksay */
  }
}
