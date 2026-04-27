import type { FeatureKey } from "../api/subscription";
import type { Language } from "./landing";

export const SIDEBAR_TOOL_ORDER: FeatureKey[] = [
  "split",
  "merge",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "compress",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "html-to-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
];

/** UI hint only; server `ToolRegistry.cost` is authoritative at runtime. */
export const SIDEBAR_TOOL_CREDIT_COST: Record<FeatureKey, number> = {
  split: 2,
  merge: 3,
  "pdf-to-word": 3,
  compress: 2,
  "word-to-pdf": 3,
  "excel-to-pdf": 3,
  "pdf-to-excel": 3,
  encrypt: 2,
  "delete-pages": 2,
  "rotate-pdf": 2,
  "organize-pdf": 2,
  "unlock-pdf": 2,
  watermark: 2,
  "page-numbers": 2,
  "repair-pdf": 2,
  "pdf-to-ppt": 4,
  "ppt-to-pdf": 3,
  "pdf-to-image": 3,
  "image-to-pdf": 3,
  "html-to-pdf": 3,
};

export function sidebarToolCreditLine(id: FeatureKey, lang: Language): string {
  const n = SIDEBAR_TOOL_CREDIT_COST[id];
  return lang === "tr" ? `${n} Kredi` : `${n} credit${n === 1 ? "" : "s"}`;
}

const SB: Record<FeatureKey, { tr: string; en: string }> = {
  split: { tr: "PDF Ayır", en: "Split PDF" },
  merge: { tr: "PDF Birleştir", en: "Merge PDF" },
  "pdf-to-word": { tr: "PDF → Word", en: "PDF → Word" },
  "word-to-pdf": { tr: "Word → PDF", en: "Word → PDF" },
  "excel-to-pdf": { tr: "Excel → PDF", en: "Excel → PDF" },
  "pdf-to-excel": { tr: "PDF → Excel", en: "PDF → Excel" },
  compress: { tr: "PDF Sıkıştır", en: "Compress PDF" },
  encrypt: { tr: "PDF Şifrele", en: "Encrypt PDF" },
  "delete-pages": { tr: "Sayfa Sil", en: "Delete pages" },
  "rotate-pdf": { tr: "PDF Döndür", en: "Rotate PDF" },
  "organize-pdf": { tr: "Sayfa Sırala", en: "Organize pages" },
  "unlock-pdf": { tr: "PDF Şifre Çöz", en: "Unlock PDF" },
  watermark: { tr: "Filigran Ekle", en: "Add watermark" },
  "page-numbers": { tr: "Sayfa Numarası", en: "Page numbers" },
  "repair-pdf": { tr: "PDF Onar", en: "Repair PDF" },
  "pdf-to-ppt": { tr: "PDF → PowerPoint", en: "PDF → PowerPoint" },
  "ppt-to-pdf": { tr: "PowerPoint → PDF", en: "PowerPoint → PDF" },
  "pdf-to-image": { tr: "PDF → Görüntü", en: "PDF to image" },
  "image-to-pdf": { tr: "Görüntü → PDF", en: "Image to PDF" },
  "html-to-pdf": { tr: "HTML → PDF", en: "HTML to PDF" },
};

export function sidebarToolLabel(id: FeatureKey, lang: Language): string {
  return SB[id][lang];
}

export function ws(lang: Language) {
  const tr = lang === "tr";
  return {
    planNav: tr ? "Kredilerim" : "Credits",
    homeNav: tr ? "Ana Sayfa" : "Home",
    langSection: tr ? "Dil" : "Language",
    emptyStateTitle: tr ? "Henüz işlem yapılmadı" : "Nothing here yet",
    emptyStateHint: tr
      ? "İşlem başlatmak için yukarıdan dosya seçin. Dosya eklendiğinde burada listelenir."
      : "Choose a file above to start. Selected files appear here.",
    mergeReorderHint: tr
      ? "Dosya satırını sürükleyerek sırayı değiştirin veya okları kullanın. Liste uzunsa sürüklerken kenara yaklaştığınızda liste kayar. Birleştirme bu sıraya göre yapılır."
      : "Drag a file row to reorder, or use the arrows. Near the top or bottom edge of the list, the list scrolls while you drag. Merge follows this order.",
    mergeDragHandle: tr ? "Sırayı değiştirmek için sürükleyin" : "Drag to reorder",
    proGateTitle: tr ? "Bu araç için yeterli kredi yok" : "Not enough credits for this tool",
    proGateBody: tr
      ? "Bu aracı kullanmak için kredi gerekir. Kredi satın alarak devam edebilirsiniz."
      : "This tool needs credits. Buy a pack to unlock it.",
    proGateCta: tr ? "Kredi satın al" : "Buy credits",
    featureLockedBadge: tr ? "Kilit" : "Locked",
    navbarCreditsLabel: tr ? "Kredi" : "Credits",
    lockedFeatureTooltip: tr
      ? "Bu araç şu an kredinizle kullanılamıyor"
      : "This tool isn’t available with your current balance",
    filePick: tr ? "Dosya Seç" : "Choose file",
    fileAdd: tr ? "Dosya Ekle" : "Add file",
    selectedFiles: tr ? "Seçilen dosyalar" : "Selected files",
    remove: tr ? "Kaldır" : "Remove",
    up: tr ? "Yukarı" : "Up",
    down: tr ? "Aşağı" : "Down",
    pagesLabel: tr ? "Sayfa numaraları" : "Page numbers",
    pagesPlaceholder: tr ? "Örn: 1,2,3 veya 1-4,7" : "e.g. 1,2,3 or 1-4,7",
    splitModeLabel: tr ? "Ayırma modu" : "Split mode",
    splitModeSingle: tr ? "Tek PDF'de birleştir" : "Single merged PDF",
    splitModeSeparate: tr ? "Ayrı ayrı kaydet (ZIP)" : "Separate files (ZIP)",
    splitPickerOpen: tr ? "Görsel seçici" : "Visual picker",
    splitPickerWaitHint: tr
      ? "PDF yükleyip sayfa bilgisinin gelmesini bekleyin."
      : "Upload a PDF and wait for page metadata to load.",
    sourcePassword: tr ? "Kaynak PDF şifresi" : "Source PDF password",
    sourcePasswordHint: tr
      ? "PDF şifreliyse açmak için parola gerekir."
      : "Required if the PDF is password-protected.",
    newPdfPassword: tr ? "Yeni PDF şifresi" : "New PDF password",
    newPdfPasswordPh: tr ? "Yeni parola girin" : "Enter new password",
    perFilePassword: tr ? "Bu dosyanın şifresi" : "Password for this file",
    perFilePasswordPh: tr ? "PDF parolasını girin" : "Enter PDF password",
    mergeEncryptedAlert: tr
      ? "Bu dosya şifre korumalı. Birleştirme için aşağıya PDF parolasını girin."
      : "This file is password-protected. Enter the PDF password below to include it in the merge.",
    mergeClearAll: tr ? "Tüm dosyaları temizle" : "Clear all files",
    mergeDuplicateFileTitle: tr ? "Dosya zaten listede" : "File already added",
    mergeDuplicateFileDetail: tr
      ? "Seçtiğiniz PDF bu birleştirme listesinde zaten yer almaktadır; aynı dosya iki kez eklenmez."
      : "This PDF is already in the merge list; duplicate files are not added.",
    mergePasswordConfirm: tr ? "Parolayı doğrula" : "Verify password",
    mergePasswordVerifying: tr ? "Doğrulanıyor…" : "Verifying…",
    mergePasswordWrong: tr
      ? "Girdiğiniz parola bu PDF için geçerli değildir. Lütfen dosya sahibi tarafından tanımlanan parolayı kontrol edin."
      : "The password entered is not valid for this PDF. Please check the document password and try again.",
    mergePasswordOk: tr ? "Parola doğrulandı" : "Password verified",
    usageRemainingShort: tr ? "Kalan kredi" : "Credits left",
    usageUnlimited: tr ? "—" : "—",
    usageDailyHeading: tr ? "Kullanım özeti" : "Usage summary",
    /**
     * Credit-balance chip copy. Plural vs singular is folded into a single
     * line to avoid the UI having to reason about language-specific
     * pluralisation rules — the engine is the source of truth for the
     * number itself.
     */
    creditBalanceHeading: tr ? "Kullanılabilir kredi" : "Available credits",
    creditBalanceLine: (n: number) =>
      tr ? `${n} kredi kaldı` : `${n} credit${n === 1 ? "" : "s"} left`,
    creditBalanceExhaustedHint: tr
      ? "Krediniz tükendi. Devam etmek için kredi satın alın."
      : "You're out of credits. Buy a credit pack to continue.",
    /*
     * Credit-dashboard copy. Dashboard is driven entirely by the
     * entitlement engine output: balance + plan + recent ledger rows.
     * Strings here must NEVER reference "daily usage", "limit reached"
     * or any other relic of the retired daily-quota system.
     */
    creditDashboardKicker: tr ? "HESABINIZ" : "YOUR ACCOUNT",
    creditDashboardHeading: tr ? "Kredi Bakiyen" : "Your credits",
    creditDashboardBalanceLabel: tr ? "Kalan krediniz" : "Credits remaining",
    creditRemainingFormatted: (n: string) => (tr ? `Kalan Krediniz: ${n}` : `Your credits: ${n}`),
    creditDashboardBalanceFootnote: tr
      ? "Her araç çalıştırmada kredi düşer; bakiyeniz güncel kullanımınızı yansıtır."
      : "Each tool run spends credits; your balance reflects current usage.",
    creditDashboardPlanLabel: tr ? "Plan" : "Plan",
    creditDashboardSubscriptionLabel: tr ? "Abonelik" : "Subscription",
    creditDashboardSubscriptionActive: tr ? "Aktif" : "Active",
    creditDashboardSubscriptionFree: tr ? "Ücretsiz" : "Free",
    creditDashboardUnlimitedPlanNote: tr ? "" : "",
    creditDashboardRecentHeading: tr ? "Son 10 hareket" : "Recent activity (last 10)",
    creditDashboardRecentEmpty: tr
      ? "Henüz kredi hareketi yok. Bir araç çalıştırdıkça bu liste dolacak."
      : "No credit activity yet. Run a tool and it'll show up here.",
    creditDashboardRecentLoading: tr ? "Hareketler yükleniyor..." : "Loading activity...",
    creditDashboardTopUpHeading: tr ? "Kredi paketleri" : "Credit packs",
    creditDashboardTopUpBody: tr
      ? "İhtiyacınız kadar kredi yükleyin."
      : "Top up with the bundle that fits your workload.",
    creditDashboardPacksHeading: tr ? "Kredi satın al" : "Buy credits",
    creditDashboardPacksBody: tr
      ? "Paket seçin; ödeme sonrası krediler hesabınıza eklenir."
      : "Pick a pack; credits are added after checkout completes.",
    creditPackLine: (c: number) => (tr ? `${c} kredi` : `${c} credits`),
    creditPackBuyCta: tr ? "Satın Al" : "Buy",
    creditDashboardBuyCreditsCta: tr ? "Kredi paketleri" : "Credit packs",
    creditDashboardUpgradePlanCta: tr ? "Kredi paketleri" : "Credit packs",
    creditDashboardBuyingCredits: tr ? "Satın alınıyor..." : "Purchasing...",
    creditDashboardBuyCreditsSuccess: (n: number) =>
      tr
        ? `${n} kredi hesabınıza eklendi.`
        : `${n} credits added to your account.`,
    creditDashboardBuyCreditsError: tr
      ? "Kredi satın alınamadı. Lütfen tekrar deneyin."
      : "Couldn't buy credits. Please try again.",
    /** Shown when 0 < credits < 5 (credit-based workspace). */
    creditRunningOutBanner: tr ? "Kredileriniz azalıyor" : "You are running out of credits",
    /** Ledger-row labels; `amount` is signed so we don't re-add + here. */
    creditTxTypeConsume: tr ? "Kullanım" : "Use",
    creditTxTypeBonus: tr ? "Bonus" : "Bonus",
    creditTxTypeAdminAdd: tr ? "Yönetici ekledi" : "Admin grant",
    creditTxTypeRefund: tr ? "İade" : "Refund",
    creditTxToolLabel: (toolId: string) =>
      tr ? `Araç: ${toolId}` : `Tool: ${toolId}`,
    usageUsedTodayLine: (used: number, limit: number) =>
      tr ? `İşlem: ${used} / ${limit}` : `Operations: ${used} / ${limit}`,
    usageSoftTierLine: (used: number, fastRuns: number) =>
      tr
        ? `İşlem: ${used} (ilk ${fastRuns} öncelikli)`
        : `Operations: ${used} (first ${fastRuns} prioritized)`,
    usageCountOfLimit: (used: number, limit: number) =>
      tr ? `${used} / ${limit} işlem` : `${used} / ${limit} ops`,
    usageRemainingLine: (n: number) => (tr ? `Kalan: ${n}` : `Remaining: ${n}`),
    usageNoDailyCapLine: tr ? "Kota sınırı yok" : "No quota cap",
    usageUpgradeCta: tr ? "Kredi satın al" : "Buy credits",
    /** Üst menüdeki kısa yükseltme düğmesi */
    navbarUpgrade: tr ? "Kredi al" : "Get credits",
    usageLimitReachedTitle: tr ? "Kredi gerekli" : "Credits required",
    usageLimitReachedDetail: tr
      ? "Krediler sayfasına giderek paket satın alabilirsiniz."
      : "Open Credits in the sidebar to buy a pack.",
    usageQuotaExhaustedBanner: tr
      ? "Krediniz bitti. Devam etmek için kredi satın alın."
      : "You're out of credits. Buy a pack to continue.",
    usageSoftFrictionBanner: tr
      ? "Kredi ekleyerek işlemlerinize devam edin."
      : "Add credits to keep processing documents.",
    proBenefitsKicker: tr ? "Kredi sistemi" : "Credit system",
    proBenefitsTitle: tr
      ? "Kullandığın kadar öde"
      : "Pay for what you use",
    proBenefitsIntro: tr
      ? "Her işlem kredi harcar; bakiyeniz panelden takip edilir. İhtiyaç duydukça paket alırsınız — aylık plan yoktur."
      : "Every run spends credits; your balance is always visible. Buy packs when you need them — no monthly subscription tiers.",
    proBenefitTagSpeed: tr ? "Şeffaf" : "Transparent",
    proBenefitSpeed: tr
      ? "Araç başına maliyet net; harcama geçmişiniz kayıt altındadır."
      : "Per-tool costs are clear; your ledger shows every change.",
    proBenefitTagQuality: tr ? "Esnek" : "Flexible",
    proBenefitQuality: tr
      ? "Küçük paketle başlayıp ihtiyaca göre büyütebilirsiniz."
      : "Start with a small pack and scale up as volume grows.",
    proBenefitTagUnlimited: tr ? "Anında" : "Instant",
    proBenefitUnlimited: tr
      ? "Ödeme onayından sonra krediler hesabınıza eklenir."
      : "Credits appear in your account right after purchase completes.",
    proBenefitTagAccess: tr ? "Kontrol" : "Control",
    proBenefitFullAccess: tr
      ? "Bakiyeniz bitmeden tüm uygun araçları kullanmaya devam edersiniz."
      : "Keep using every tool your balance covers — no separate “plan gates”.",
    validationPagesNeedPassword: tr
      ? "Sayfa sınırını doğrulamak için önce PDF parolasını girin."
      : "Enter the PDF password first to validate page numbers against the document.",
    inspectFailedTitle: tr ? "PDF ön kontrolü başarısız" : "PDF preview failed",
    inspectFailedDetail: tr
      ? "Sunucuya bağlanılamıyor veya dosya okunamadı. API adresini ve sunucuyu kontrol edin."
      : "Could not reach the server or read the file. Check API URL and that the backend is running.",
    inspecting: tr ? "PDF kontrol ediliyor…" : "Checking PDF…",
    encryptedBadge: tr ? "Şifreli PDF" : "Encrypted PDF",
    ready: tr ? "Hazır" : "Ready",
    compressEstimateLine: (minPct: number, maxPct: number) =>
      tr
        ? `Tahmini boyut düşüşü: ~%${minPct}–${maxPct} (tipik)`
        : `Est. size reduction: ~${minPct}–${maxPct}% (typical)`,
    compressEstimateTooltip: tr
      ? "Yaklaşık tahmin; gerçek sonuç PDF içeriğine göre değişir."
      : "Approximate; actual savings depend on PDF content.",
    notesTitle: tr ? "Web sürümü notları" : "Web edition notes",
    platform: tr ? "Platform" : "Platform",
    tesseract: tr ? "Tesseract" : "Tesseract",
    notConfigured: tr ? "yapılandırılmadı" : "not configured",
    processing: tr ? "İŞLEM SÜRÜYOR…" : "PROCESSING…",
    processingQueued: tr ? "İŞLEM SÜRÜYOR…" : "PROCESSING…",
    processingPremium: tr ? "İŞLEM SÜRÜYOR…" : "PROCESSING…",
    subscriptionWarn: tr
      ? "Bu araç için yeterli krediniz yok. Kredi ekleyerek kullanabilirsiniz."
      : "You don’t have enough credits for this tool. Add credits to use it.",
    mergeProgressPreparing: tr ? "Dosyalar hazırlanıyor…" : "Preparing files…",
    mergeProgressStarting: tr ? "İstek gönderiliyor…" : "Sending request…",
    mergeProgressQueueFree: tr ? "Birleştirme hazırlanıyor…" : "Preparing merge…",
    mergeProgressQueuePremium: tr ? "Birleştirme hazırlanıyor…" : "Preparing merge…",
    toolProgressSub: tr ? "Tamamlanınca dosya indirilecek." : "The file will download when ready.",
    toolProgressSubQueueFree: tr
      ? "Tamamlanınca dosya indirilecek."
      : "The file will download when ready.",
    toolProgressSubPremium: tr
      ? "Tamamlanınca dosya indirilecek."
      : "The file will download when ready.",
    toolProgressPhaseQueueFree: tr ? "İşlem sunucuda başlatılıyor…" : "Starting work on the server…",
    toolProgressPhaseHandoff: tr ? "İşlem sunucuda başlatılıyor…" : "Starting work on the server…",
    toolProgressPhaseAnalyzing: tr ? "Dosya analiz ediliyor…" : "Analyzing file…",
    toolProgressPhaseCompressing: tr ? "Sıkıştırma uygulanıyor…" : "Applying compression…",
    toolProgressPhaseProcessing: tr ? "İşlem uygulanıyor…" : "Processing…",
    toolProgressPhaseFinishing: tr ? "Son işlemler…" : "Finalizing…",
    toolProgressPhaseMerging: tr ? "PDF'ler birleştiriliyor…" : "Merging PDFs…",
    toolProgressSuccessTitle: tr ? "İşlem tamamlandı" : "Completed",
    toolDownloadAgain: tr ? "Tekrar indir" : "Download again",
    toolProgressDismiss: tr ? "Kapat" : "Dismiss",
    toolProgressNativeDownloadHint: tr
      ? "İndirme tarayıcıya bırakıldı; tekrar için indirilenler klasörünü kontrol edin."
      : "Download was handed off to the browser; check your Downloads folder.",
    toolProgressLargeFileHint: (mb: number) =>
      tr
        ? `Dosya büyük (~${mb.toFixed(1)} MB); sunucuda işlem uzun sürebilir.`
        : `Large file (~${mb.toFixed(1)} MB); server processing may take longer.`,
    toolProgressElapsed: (sec: number) =>
      tr ? `Geçen süre: ${sec} sn` : `Elapsed: ${sec}s`,
    mergeStatus: tr ? "Durum" : "Status",
    mergeEtaLine: (totalSec: number) => {
      const s = Math.max(0, Math.round(totalSec));
      if (!tr) {
        if (s < 60) {
          return `Est. ~${s}s remaining`;
        }
        return `Est. ~${Math.floor(s / 60)}m ${s % 60}s remaining`;
      }
      if (s < 60) {
        return `Tahmini kalan: ~${s} sn`;
      }
      return `Tahmini kalan: ~${Math.floor(s / 60)} dk ${s % 60} sn`;
    },
    mergeToastFailedTitle: tr ? "Birleştirme başarısız" : "Merge failed",
    mergeToastFailedGeneric: tr ? "PDF birleştirme sırasında hata oluştu." : "An error occurred while merging PDFs.",
    mergeToastQueued: tr ? "Birleştirme sırası oluşturuldu" : "Merge job queued",
    mergeToastRunning: tr ? "Birleştirme sürüyor" : "Merging…",
    mergeToastSuccessTitle: tr ? "İşlem tamamlandı" : "Done",
    mergeToastSuccessBody: tr ? "Birleştirilen PDF indirildi." : "Merged PDF downloaded.",
    mergeToastPollErrorTitle: tr ? "İlerleme bilgisi alınamadı" : "Could not read progress",
    mergeToastPollErrorDetail: tr ? "Birleştirme durumu alınamadı." : "Merge status could not be loaded.",
    mergeToastDownloadErrorTitle: tr ? "İndirme tamamlanamadı" : "Download failed",
    toolRunCancel: tr ? "İptal" : "Cancel",
    toolRunCancelledInfo: tr ? "İşlem iptal edildi veya sunucu isteği kesti." : "The operation was cancelled or aborted.",
    mergeJobSessionLostTitle: tr ? "Birleştirme oturumu bulunamadı" : "Merge session not found",
    mergeJobSessionLostDetail: tr
      ? "Sunucu yeniden başlamış veya oturum süresi dolmuş olabilir. Lütfen tekrar deneyin."
      : "The server may have restarted or the session may have expired. Please try again.",
    mergeFileProgress: (cur: number, tot: number, name: string) => {
      const a = Math.max(1, cur);
      const b = Math.max(1, tot);
      const n = name.trim();
      if (tr) {
        return n ? `Dosya ${a}/${b}: ${n}` : `Dosya ${a}/${b}`;
      }
      return n ? `File ${a}/${b}: ${n}` : `File ${a}/${b}`;
    },
    resultCreatedUtc: (s: string) => (tr ? `Oluşturulma (UTC): ${s}` : `Created (UTC): ${s}`),
    lowCreditBanner: (n: number) =>
      tr
        ? `Kredi bakiyeniz düşük (${n}). Paket tüketmeden önce yüklemenizi öneririz.`
        : `Your credit balance is low (${n}). Consider topping up before you run out.`,
    pdfExcelWarningTitle: tr ? "Tablo yapısı uyarısı" : "Table structure notice",
    pdfExcelWarningBody: tr
      ? "PDF’inizde net bir tablo yapısı yoksa Excel çıktısı dağınık olabilir. Bu işlem kredi tüketir. Devam etmek istiyor musunuz?"
      : "If your PDF has no clear table structure, the Excel file may be messy. This action will use credits. Continue?",
    pdfExcelWarningConfirm: tr ? "Evet, devam" : "Yes, continue",
    mergeButtonHintInspecting: tr
      ? "Ön kontrol tamamlanana kadar birleştirme kapalı — tüm satırlarda Hazır görün."
      : "Merge unlocks after the quick check — every row should show Ready.",
    mergeButtonHintPassword: tr
      ? "Şifreli dosyalarda önce Parolayı doğrula — ardından birleştirme açılır."
      : "For locked files, use Verify password first — then merge enables.",
    validationPagesRequired: tr ? "Sayfa numaralarını girin." : "Enter page numbers.",
    validationPagesInvalid: tr ? "Geçerli bir sayfa listesi girin." : "Enter a valid page list.",
    validationRangeInvalid: (token: string) =>
      tr ? `Geçersiz aralık: ${token}` : `Invalid range: ${token}`,
    validationRangeOrder: (token: string) =>
      tr ? `Başlangıç bitişten büyük olamaz: ${token}` : `Start cannot exceed end: ${token}`,
    validationPageInvalid: (token: string) =>
      tr ? `Geçersiz sayfa: ${token}` : `Invalid page: ${token}`,
    validationPageTooHigh: (max: number) =>
      tr
        ? `PDF yalnızca ${max} sayfa içeriyor; girdiğiniz sayfalar bu sınırı aşıyor.`
        : `This PDF has only ${max} page(s); your selection exceeds that.`,
    filePickNoteSingle: tr ? "Tek dosya seçerek devam edin." : "Select a single file to continue.",
    filePickNoteMulti: tr ? "Birden fazla dosya seçebilirsiniz." : "You can select multiple files.",
    filePickNoteAppend: tr ? "Yeni seçilen dosyalar listenin sonuna eklenir." : "New files are appended to the list.",
    upgradeNudgeAria: tr ? "Kredi önerisi" : "Credits suggestion",
    /** Behavioral nudges after soft limit (1), repeated use (2), multiple queued delays (3). */
    upgradeNudgeTierBody: (tier: 1 | 2 | 3) => {
      if (tier === 1) {
        return tr
          ? "Kredi bakiyeniz düşük. Devam etmek için paket satın alabilirsiniz."
          : "Your credit balance is low. Buy a pack to keep going.";
      }
      if (tier === 2) {
        return tr
          ? "Bu aracı sık kullanıyorsunuz. Bakiyenizi yükseltmek için kredi paketi alın."
          : "You use this tool often. Top up with a credit pack when you need more runs.";
      }
      return tr
        ? "Daha hızlı sonuç ve tam erişim için kredi ekleyin veya öncelikli hattı tercih edin."
        : "Add credits or use the priority lane for faster results and full access.";
    },
    upgradeNudgeContinueFree: tr ? "Beklemeden devam et" : "Continue without waiting",
    upgradeNudgeUpgradeInstant: tr ? "Kredi paketlerini aç" : "Open credit packs",
    /** Shown while a free-tier job is in progress (queue / server delay monetization). */
    delayMonetizationDuringBody: tr
      ? "Kredi bakiyeniz düşükse paket satın alarak devam edebilirsiniz."
      : "If your balance is low, buy a credit pack to keep going.",
    delayMonetizationInstantCta: tr ? "Kredi satın al" : "Buy credits",
    /** Subtle reminder after a run (credit-based product). */
    delayMonetizationAfterHint: tr
      ? "İhtiyaç duyduğunuzda kredi paketi alabilirsiniz."
      : "You can buy a credit pack whenever you need more runs.",
    delayMonetizationAfterDismiss: tr ? "Gizle" : "Hide",
  };
}

export type UpgradeNudgeTierWeb = 0 | 1 | 2 | 3;

/**
 * Legacy export retained for compatibility. Nudges are driven by credit
 * balance in `App.tsx`; this always returns 0.
 */
export function computeUpgradeNudgeTierWeb(_input: {
  planIsFree?: boolean;
  softFrictionAfterOps?: number;
  usedToday?: number;
  throttleEventsToday?: number;
  lifetimeThrottleEvents?: number;
  lifetimeTotalOps?: number;
}): UpgradeNudgeTierWeb {
  void _input;
  return 0;
}

export function featureCopy(id: FeatureKey, lang: Language): { title: string; description: string; button: string } {
  const tr = lang === "tr";
  const map: Record<FeatureKey, { title: string; description: string; button: string }> = {
    split: {
      title: tr ? "SAYFA AYIR" : "SPLIT PAGES",
      description: tr
        ? "Seçilen PDF içinden istediğiniz sayfaları düzenli ve güvenli biçimde ayırır."
        : "Extract selected pages from your PDF safely.",
      button: tr ? "SAYFALARI AYIR" : "SPLIT PAGES",
    },
    merge: {
      title: tr ? "PDF BİRLEŞTİR" : "MERGE PDF",
      description: tr
        ? "Birden fazla PDF dosyasını istediğiniz sıraya göre tek dosyada birleştirir."
        : "Combine multiple PDFs in your chosen order.",
      button: tr ? "PDF'LERİ BİRLEŞTİR" : "MERGE PDFS",
    },
    "pdf-to-word": {
      title: tr ? "PDF → WORD" : "PDF → WORD",
      description: tr
        ? "PDF dosyasını düzenlenebilir Word belgesine dönüştürür (metin tabanlı PDF'ler)."
        : "Convert PDF to an editable Word document (text-based PDFs).",
      button: tr ? "WORD İNDİR" : "DOWNLOAD WORD",
    },
    "word-to-pdf": {
      title: tr ? "WORD → PDF" : "WORD → PDF",
      description: tr ? "Word belgesini PDF biçiminde dışa aktarır." : "Export a Word document to PDF.",
      button: tr ? "PDF İNDİR" : "DOWNLOAD PDF",
    },
    "excel-to-pdf": {
      title: tr ? "EXCEL → PDF" : "EXCEL → PDF",
      description: tr ? "Excel tablolarını PDF biçimine dönüştürür." : "Convert Excel spreadsheets to PDF.",
      button: tr ? "PDF İNDİR" : "DOWNLOAD PDF",
    },
    "pdf-to-excel": {
      title: tr ? "PDF → EXCEL" : "PDF → EXCEL",
      description: tr
        ? "PDF tablo yapısını korumaya odaklanarak Excel çıktısı oluşturur."
        : "Build an Excel file while preserving table structure where possible.",
      button: tr ? "EXCEL İNDİR" : "DOWNLOAD EXCEL",
    },
    compress: {
      title: tr ? "PDF SIKIŞTIR" : "COMPRESS PDF",
      description: tr
        ? "PDF akışını optimize ederek dosya boyutunu küçültmeye çalışır."
        : "Optimize the PDF stream to reduce file size.",
      button: tr ? "SIKIŞTIRILMIŞ PDF İNDİR" : "DOWNLOAD COMPRESSED PDF",
    },
    encrypt: {
      title: tr ? "PDF ŞİFRELE" : "ENCRYPT PDF",
      description: tr ? "PDF dosyasına güvenli bir açılış parolası uygular." : "Apply an open password to protect the PDF.",
      button: tr ? "ŞİFRELİ PDF İNDİR" : "DOWNLOAD ENCRYPTED PDF",
    },
    "delete-pages": {
      title: tr ? "SAYFA SİL" : "DELETE PAGES",
      description: tr
        ? "Belirttiğiniz sayfaları PDF’den kaldırır, geri kalanı yeni dosya olarak verir."
        : "Remove the pages you specify and output the rest as a new file.",
      button: tr ? "SAYFALARI SİL" : "DELETE PAGES",
    },
    "rotate-pdf": {
      title: tr ? "PDF DÖNDÜR" : "ROTATE PDF",
      description: tr
        ? "Seçili veya tüm sayfalarda 90° / 180° / 270° dönüş uygular."
        : "Rotate selected or all pages by 90°, 180°, or 270°.",
      button: tr ? "DÖNDÜRÜLMÜŞ PDF AL" : "GET ROTATED PDF",
    },
    "organize-pdf": {
      title: tr ? "SAYFA SIRALA" : "ORGANIZE PAGES",
      description: tr
        ? "Sayfa sırasını virgülle (ör. 3,1,2,4) belirterek yeniden düzenler."
        : "Reorder pages by listing the new 1-based order (e.g. 3,1,2,4).",
      button: tr ? "SIRALANMIŞ PDF AL" : "GET REORDERED PDF",
    },
    "unlock-pdf": {
      title: tr ? "PDF ŞİFRE ÇÖZ" : "UNLOCK PDF",
      description: tr
        ? "Bilinen açılış parolası ile korumayı kaldırır; yalnızca yetkili belgeler için."
        : "Remove open-password protection if you supply the correct password.",
      button: tr ? "AÇIK PDF AL" : "GET UNLOCKED PDF",
    },
    watermark: {
      title: tr ? "FİLİGRAN EKLE" : "ADD WATERMARK",
      description: tr ? "Tüm sayfalara metin filigranı ekler." : "Add a text watermark on every page.",
      button: tr ? "FİLİGRANLI PDF AL" : "GET WATERMARKED PDF",
    },
    "page-numbers": {
      title: tr ? "SAYFA NUMARASI" : "PAGE NUMBERS",
      description: tr ? "Alt veya üst bilgiye otomatik sayfa numarası basar." : "Add automatic page numbers in the header or footer.",
      button: tr ? "NUMARALI PDF AL" : "GET NUMBERED PDF",
    },
    "repair-pdf": {
      title: tr ? "PDF ONAR" : "REPAIR PDF",
      description: tr
        ? "Bozuk veya açılması zor dosyalarda temel kurtarma dener."
        : "Basic recovery for damaged or hard-to-open PDFs.",
      button: tr ? "ONARILMIŞ PDF AL" : "GET REPAIRED PDF",
    },
    "pdf-to-ppt": {
      title: tr ? "PDF → POWERPOINT" : "PDF → POWERPOINT",
      description: tr
        ? "Sayfaları slayt görsellerine dönüştürerek PPTX üretir."
        : "Render pages as slide images and build a PPTX.",
      button: tr ? "PPTX İNDİR" : "DOWNLOAD PPTX",
    },
    "ppt-to-pdf": {
      title: tr ? "POWERPOINT → PDF" : "POWERPOINT → PDF",
      description: tr
        ? "Sunumu PDF’e aktarır (Windows + PowerPoint ortamında en iyi sonuç)."
        : "Convert a presentation to PDF (best on Windows with PowerPoint).",
      button: tr ? "PDF İNDİR" : "DOWNLOAD PDF",
    },
    "pdf-to-image": {
      title: tr ? "PDF → GÖRÜNTÜ" : "PDF TO IMAGE",
      description: tr ? "Her sayfayı JPG veya PNG olarak ZIP içinde dışa aktarır." : "Export each page as JPG/PNG in a ZIP file.",
      button: tr ? "ZIP İNDİR" : "DOWNLOAD ZIP",
    },
    "image-to-pdf": {
      title: tr ? "GÖRÜNTÜ → PDF" : "IMAGE TO PDF",
      description: tr ? "Birden çok görüntüyü tek PDF’e birleştirir." : "Combine multiple images into one PDF.",
      button: tr ? "PDF AL" : "GET PDF",
    },
    "html-to-pdf": {
      title: tr ? "HTML → PDF" : "HTML TO PDF",
      description: tr
        ? "Bir web adresini veya HTML parçasını PDF’e çevirir."
        : "Turn a web URL or HTML snippet into a PDF.",
      button: tr ? "PDF OLUŞTUR" : "CREATE PDF",
    },
  };
  return map[id];
}

/** Boş veya sadece format; max sayfa sınırı ayrı kontrol edilir. */
/** Selected 1-based page indices → comma / range string (e.g. 1-3,5,7-9). */
export function formatPageSelection(pages: number[]): string {
  const sorted = [...new Set(pages)]
    .filter((n) => n >= 1)
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return "";
  }
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) {
      j += 1;
    }
    if (i === j) {
      parts.push(String(sorted[i]));
    } else {
      parts.push(`${sorted[i]}-${sorted[j]}`);
    }
    i = j + 1;
  }
  return parts.join(",");
}

/**
 * Parse page string into a sorted unique list. Returns null if invalid or out of range.
 */
export function expandPagesString(value: string, maxPage: number, lang: Language): number[] | null {
  const raw = value.trim();
  if (!raw) {
    return [];
  }
  if (validatePagesFormat(value, lang)) {
    return null;
  }
  if (validatePagesMax(value, maxPage, lang)) {
    return null;
  }
  const out: number[] = [];
  for (const token of raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    if (token.includes("-")) {
      const [a, b] = token.split("-", 2).map((x) => x.trim());
      const s = Number(a);
      const e = Number(b);
      for (let p = s; p <= e; p++) {
        if (p >= 1 && p <= maxPage) {
          out.push(p);
        }
      }
    } else {
      const p = Number(token);
      if (p >= 1 && p <= maxPage) {
        out.push(p);
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function validatePagesFormat(value: string, lang: Language): string {
  const raw = value.trim();
  const L = ws(lang);
  if (!raw) {
    return "";
  }
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return L.validationPagesInvalid;
  }
  for (const token of parts) {
    if (token.includes("-")) {
      const [start, end] = token.split("-", 2).map((x) => x.trim());
      if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) {
        return L.validationRangeInvalid(token);
      }
      if (Number(start) > Number(end)) {
        return L.validationRangeOrder(token);
      }
    } else if (!/^\d+$/.test(token)) {
      return L.validationPageInvalid(token);
    }
  }
  return "";
}

export function maxPageInSelection(value: string): number | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  let maxP = 0;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const token of parts) {
    if (token.includes("-")) {
      const [a, b] = token.split("-", 2).map((x) => x.trim());
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) {
        return null;
      }
      maxP = Math.max(maxP, Number(a), Number(b));
    } else if (/^\d+$/.test(token)) {
      maxP = Math.max(maxP, Number(token));
    } else {
      return null;
    }
  }
  return maxP || null;
}

export function validatePagesMax(value: string, maxPage: number | null, lang: Language): string {
  if (!maxPage || maxPage < 1) {
    return "";
  }
  const fmt = validatePagesFormat(value, lang);
  if (fmt) {
    return fmt;
  }
  const hi = maxPageInSelection(value);
  if (hi === null) {
    return "";
  }
  if (hi > maxPage) {
    return ws(lang).validationPageTooHigh(maxPage);
  }
  return "";
}
