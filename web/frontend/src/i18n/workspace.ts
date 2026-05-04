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
  "pdf-to-text",
  "flatten-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
];

/** PDF Sayfa Sil: çıktıda en az bir sayfa zorunludur. */
export const PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG =
  "En az bir sayfa kalmalıdır. Tüm sayfaları silemezsiniz.";

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
  "pdf-to-text": { tr: "PDF → Metin", en: "PDF to Text" },
  "flatten-pdf": { tr: "PDF Düzleştir", en: "Flatten PDF" },
};

export function sidebarToolLabel(id: FeatureKey, lang: Language): string {
  return SB[id][lang];
}

export function ws(lang: Language) {
  const tr = lang === "tr";
  return {
    homeNav: tr ? "Ana Sayfa" : "Home",
    langSection: tr ? "Dil" : "Language",
    emptyStateTitle: tr ? "Henüz işlem yapılmadı" : "Nothing here yet",
    emptyStateHint: tr
      ? "İşlem başlatmak için yukarıdan dosya seçin. Dosya eklendiğinde burada listelenir."
      : "Choose a file above to start. Selected files appear here.",
    mergeReorderHint: tr
      ? "Dosya satırını sürükleyerek sırayı değiştirin veya okları kullanın. Liste uzunsa sürüklerken kenara yaklaştığınızda liste kayar. Birleştirme bu sıraya göre yapılır."
      : "Drag a file row to reorder, or use the arrows. Near the top or bottom edge of the list, the list scrolls while you drag. Merge follows this order.",
    mergeDragHandle: tr
      ? "Sırayı değiştirmek için sürükleyin"
      : "Drag to reorder",
    featureLockedBadge: tr ? "Kilit" : "Locked",
    /** Limitsiz Pro — navbar / compact surfaces. */
    unlimitedSidebarBadge: tr ? "∞ LİMİTSİZ" : "∞ UNLIMITED",
    unlimitedAccessActive: tr
      ? "Limitsiz Erişim Aktif"
      : "Unlimited access active",
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
    usageUnlimited: tr ? "—" : "—",
    usageDailyHeading: tr ? "Kullanım özeti" : "Usage summary",
    creditDashboardKicker: tr ? "HESABINIZ" : "YOUR ACCOUNT",
    creditDashboardPlanLabel: tr ? "Plan" : "Plan",
    creditDashboardSubscriptionLabel: tr ? "Abonelik" : "Subscription",
    creditDashboardSubscriptionActive: tr ? "Aktif" : "Active",
    creditDashboardSubscriptionFree: tr ? "Ücretsiz" : "Free",
    creditDashboardUnlimitedPlanNote: tr ? "" : "",
    creditDashboardRecentHeading: tr
      ? "Son 10 hareket"
      : "Recent activity (last 10)",
    creditDashboardRecentLoading: tr
      ? "Hareketler yükleniyor..."
      : "Loading activity...",
    creditPackBuyCta: tr ? "Satın Al" : "Buy",
    creditDashboardBuyingCredits: tr ? "Satın alınıyor..." : "Purchasing...",
    creditTxTypeConsume: tr ? "Kullanım" : "Use",
    creditTxTypeBonus: tr ? "Bonus" : "Bonus",
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
    proBenefitQuality: tr
      ? "Küçük paketle başlayıp ihtiyaca göre büyütebilirsiniz."
      : "Start with a small pack and scale up as volume grows.",
    proBenefitTagUnlimited: tr ? "Anında" : "Instant",
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
    mergeProgressPreparing: tr ? "Dosyalar hazırlanıyor…" : "Preparing files…",
    mergeProgressStarting: tr ? "İstek gönderiliyor…" : "Sending request…",
    mergeProgressQueueFree: tr
      ? "Birleştirme hazırlanıyor…"
      : "Preparing merge…",
    mergeProgressQueuePremium: tr
      ? "Birleştirme hazırlanıyor…"
      : "Preparing merge…",
    toolProgressSub: tr
      ? "Tamamlanınca dosya indirilecek."
      : "The file will download when ready.",
    toolProgressSubQueueFree: tr
      ? "Tamamlanınca dosya indirilecek."
      : "The file will download when ready.",
    toolProgressSubPremium: tr
      ? "Tamamlanınca dosya indirilecek."
      : "The file will download when ready.",
    toolProgressPhaseQueueFree: tr
      ? "İşlem sunucuda başlatılıyor…"
      : "Starting work on the server…",
    toolProgressPhaseHandoff: tr
      ? "İşlem sunucuda başlatılıyor…"
      : "Starting work on the server…",
    toolProgressPhaseAnalyzing: tr
      ? "Dosya analiz ediliyor…"
      : "Analyzing file…",
    toolProgressPhaseCompressing: tr
      ? "Sıkıştırma uygulanıyor…"
      : "Applying compression…",
    toolProgressPhaseProcessing: tr ? "İşlem uygulanıyor…" : "Processing…",
    toolProgressPhaseFinishing: tr ? "Son işlemler…" : "Finalizing…",
    toolProgressPhaseMerging: tr ? "PDF'ler birleştiriliyor…" : "Merging PDFs…",
    toolProgressSuccessTitle: tr ? "İşlem tamamlandı" : "Completed",
    toolDownloadAgain: tr ? "Tekrar indir" : "Download again",
    toolProgressDismiss: tr ? "Kapat" : "Dismiss",
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
    mergeToastFailedGeneric: tr
      ? "PDF birleştirme sırasında hata oluştu."
      : "An error occurred while merging PDFs.",
    mergeToastQueued: tr
      ? "Birleştirme sırası oluşturuldu"
      : "Merge job queued",
    mergeToastRunning: tr ? "Birleştirme sürüyor" : "Merging…",
    mergeToastSuccessTitle: tr ? "İşlem tamamlandı" : "Done",
    mergeToastSuccessBody: tr
      ? "Birleştirilen PDF indirildi."
      : "Merged PDF downloaded.",
    mergeToastPollErrorTitle: tr
      ? "İlerleme bilgisi alınamadı"
      : "Could not read progress",
    mergeToastPollErrorDetail: tr
      ? "Birleştirme durumu alınamadı."
      : "Merge status could not be loaded.",
    mergeToastDownloadErrorTitle: tr
      ? "İndirme tamamlanamadı"
      : "Download failed",
    toolRunCancel: tr ? "İptal" : "Cancel",
    toolRunCancelledInfo: tr
      ? "İşlem iptal edildi."
      : "The operation was cancelled.",
    mergeJobSessionLostTitle: tr
      ? "Birleştirme oturumu bulunamadı"
      : "Merge session not found",
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
    resultCreatedUtc: (s: string) =>
      tr ? `Oluşturulma (UTC): ${s}` : `Created (UTC): ${s}`,
    lowCreditBanner: (n: number) =>
      tr
        ? `Kredi bakiyeniz düşük! İşlemlerinizin yarıda kalmaması için kredi yüklemenizi öneririz.`
        : `Your credit balance is low! Top up now to avoid any interruption to your tasks.`,
    pdfExcelWarningTitle: tr
      ? "Tablo yapısı uyarısı"
      : "Table structure notice",
    pdfExcelWarningBody: tr
      ? "PDF’inizde net bir tablo yapısı yoksa Excel çıktısı dağınık olabilir. Devam etmek istiyor musunuz?"
      : "If your PDF has no clear table structure, the Excel file may be messy. Continue?",
    pdfExcelWarningConfirm: tr ? "Evet, devam" : "Yes, continue",
    mergeButtonHintInspecting: tr
      ? "Ön kontrol tamamlanana kadar birleştirme kapalı — tüm satırlarda Hazır görün."
      : "Merge unlocks after the quick check — every row should show Ready.",
    mergeButtonHintPassword: tr
      ? "Şifreli dosyalarda önce Parolayı doğrula — ardından birleştirme açılır."
      : "For locked files, use Verify password first — then merge enables.",
    validationPagesRequired: tr
      ? "Sayfa numaralarını girin."
      : "Enter page numbers.",
    validationPagesInvalid: tr
      ? "Geçerli bir sayfa listesi girin."
      : "Enter a valid page list.",
    validationRangeInvalid: (token: string) =>
      tr ? `Geçersiz aralık: ${token}` : `Invalid range: ${token}`,
    validationRangeOrder: (token: string) =>
      tr
        ? `Başlangıç bitişten büyük olamaz: ${token}`
        : `Start cannot exceed end: ${token}`,
    validationPageInvalid: (token: string) =>
      tr ? `Geçersiz sayfa: ${token}` : `Invalid page: ${token}`,
    validationPageTooHigh: (max: number) =>
      tr
        ? `PDF yalnızca ${max} sayfa içeriyor; girdiğiniz sayfalar bu sınırı aşıyor.`
        : `This PDF has only ${max} page(s); your selection exceeds that.`,
    filePickNoteSingle: tr
      ? "Tek dosya seçerek devam edin."
      : "Select a single file to continue.",
    filePickNoteMulti: tr
      ? "Birden fazla dosya seçebilirsiniz."
      : "You can select multiple files.",
    filePickNoteAppend: tr
      ? "Yeni seçilen dosyalar listenin sonuna eklenir."
      : "New files are appended to the list.",
}
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

export function featureCopy(
  id: FeatureKey,
  lang: Language,
): { title: string; description: string; button: string } {
  const tr = lang === "tr";
  const map: Record<
    FeatureKey,
    { title: string; description: string; button: string }
  > = {
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
      description: tr
        ? "Word belgesini PDF biçiminde dışa aktarır."
        : "Export a Word document to PDF.",
      button: tr ? "PDF İNDİR" : "DOWNLOAD PDF",
    },
    "excel-to-pdf": {
      title: tr ? "EXCEL → PDF" : "EXCEL → PDF",
      description: tr
        ? "Excel tablolarını PDF biçimine dönüştürür."
        : "Convert Excel spreadsheets to PDF.",
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
      description: tr
        ? "PDF dosyasına güvenli bir açılış parolası uygular."
        : "Apply an open password to protect the PDF.",
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
      description: tr
        ? "Tüm sayfalara metin filigranı ekler."
        : "Add a text watermark on every page.",
      button: tr ? "FİLİGRANLI PDF AL" : "GET WATERMARKED PDF",
    },
    "page-numbers": {
      title: tr ? "SAYFA NUMARASI" : "PAGE NUMBERS",
      description: tr
        ? "Alt veya üst bilgiye otomatik sayfa numarası basar."
        : "Add automatic page numbers in the header or footer.",
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
      description: tr
        ? "Her sayfayı JPG veya PNG olarak ZIP içinde dışa aktarır."
        : "Export each page as JPG/PNG in a ZIP file.",
      button: tr ? "ZIP İNDİR" : "DOWNLOAD ZIP",
    },
    "image-to-pdf": {
      title: tr ? "GÖRÜNTÜ → PDF" : "IMAGE TO PDF",
      description: tr
        ? "Birden çok görüntüyü tek PDF’e birleştirir."
        : "Combine multiple images into one PDF.",
      button: tr ? "PDF AL" : "GET PDF",
    },
    "html-to-pdf": {
      title: tr ? "HTML → PDF" : "HTML TO PDF",
      description: tr
        ? "Bir web adresini veya HTML parçasını PDF’e çevirir."
        : "Turn a web URL or HTML snippet into a PDF.",
      button: tr ? "PDF OLUŞTUR" : "CREATE PDF",
    },
    "pdf-to-text": {
      title: tr ? "PDF → METİN" : "PDF TO TEXT",
      description: tr
        ? "PDF içindeki metin katmanını düz metin dosyasına aktarır."
        : "Extract the text layer from a PDF as a plain text file.",
      button: tr ? "METİN ÇIK." : "EXTRACT TEXT",
    },
    "flatten-pdf": {
      title: tr ? "PDF DÜZLEŞTIR" : "FLATTEN PDF",
      description: tr
        ? "Etkileşimli form alanlarını ve açıklamaları sayfaya gömer, düzenlenemez hale getirir."
        : "Embed interactive form fields and annotations into the page permanently.",
      button: tr ? "DÜZLEŞTİR" : "FLATTEN",
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
export function expandPagesString(
  value: string,
  maxPage: number,
  lang: Language,
): number[] | null {
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

export function validatePagesMax(
  value: string,
  maxPage: number | null,
  lang: Language,
): string {
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
