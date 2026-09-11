/**
 * İŞLEM ÖNCESİ KONTROLLER — kullanıcı "başlat" dediğinde, sunucuya gitmeden
 * önce eksik veya hatalı bir şey var mı.
 *
 * Ana uygulama dosyasındaki işlem başlatma akışının başında, iç içe geçmiş bir
 * dizi koşul hâlinde duruyordu. Ekran durumuna dokunmaz: değerleri alır, ne
 * yapılması gerektiğini söyler. Kullanıcının gördüğü uyarı metinleri burada
 * toplandığı için hem tek başına test edilebilir hem de bir kontrolün yanlışlıkla
 * atlanması zorlaşır.
 *
 * Dönen sonuçta `pagesError` / `deletePagesError` alanları BOŞ METİN de
 * olabilir: bu "önceki hatayı temizle" demektir, `undefined` ise "dokunma".
 */
import type { FeatureKey } from "../api/subscription";
import type { Language } from "../i18n/landing";
import {
  validatePagesFormat,
  validatePagesMax,
  expandPagesString,
  PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG,
  ws,
} from "../i18n/workspace";

/** Kontrol için gereken, yüklenen dosyanın bilinmesi gereken tarafı. */
type CheckedUpload = {
  pageCount: number | null;
  encrypted: boolean;
};

export type ToolSubmissionInput = {
  featureId: FeatureKey;
  uploads: CheckedUpload[];
  pagesText: string;
  deletePagesText: string;
  /** Kaynak belgenin açma parolası. */
  password: string;
  /** Şifre çözmede istenen mevcut parola. */
  unlockOpenPassword: string;
  /** Şifrelemede kaynak belgenin parolası. */
  inputPassword: string;
  /** Şifrelemede belirlenen yeni parola. */
  outputPassword: string;
  /** Ekranda ilgili parola alanı gösteriliyor mu (yani zorunlu mu). */
  showSplitPasswordField: boolean;
  showEncryptSourcePasswordField: boolean;
  showUnlockPasswordField: boolean;
  /** Birleştirmede parolası girilmemiş şifreli dosya var mı. */
  mergeHasMissingPasswords: boolean;
  hasAccessToken: boolean;
  /** Excel dönüşümünde kullanıcı uyarıyı onayladı mı. */
  excelConfirmed: boolean;
  language: Language;
};

export type ToolSubmissionCheck = {
  /** İşleme devam edilebilir mi. */
  ok: boolean;
  /** Sayfa alanının altında gösterilecek hata; "" temizler. */
  pagesError?: string;
  deletePagesError?: string;
  /** Kullanıcıya gösterilecek uyarı. */
  toast?: { title: string; detail: string };
  /** Hata değil: Excel dönüşümü için onay penceresi açılmalı. */
  askExcelConfirm?: boolean;
};

function tr(language: Language, turkish: string, english: string): string {
  return language === "tr" ? turkish : english;
}

export function checkToolSubmission(
  input: ToolSubmissionInput,
): ToolSubmissionCheck {
  const {
    featureId,
    uploads,
    pagesText,
    deletePagesText,
    password,
    unlockOpenPassword,
    inputPassword,
    outputPassword,
    showSplitPasswordField,
    showEncryptSourcePasswordField,
    showUnlockPasswordField,
    mergeHasMissingPasswords,
    hasAccessToken,
    excelConfirmed,
    language,
  } = input;
  const W = ws(language);
  const first = uploads[0];

  // 1) Dosya seçilmiş mi. Adresten üretilen araç dosya istemez.
  if (featureId !== "html-to-pdf") {
    if (featureId === "image-to-pdf" && uploads.length === 0) {
      return {
        ok: false,
        toast: {
          title: tr(language, "Dosya seçilmedi", "No file selected"),
          detail: tr(
            language,
            "Lütfen en az bir görüntü seçin.",
            "Please select at least one image.",
          ),
        },
      };
    }
    if (featureId !== "merge" && uploads.length === 0) {
      return {
        ok: false,
        toast: {
          title: tr(language, "Dosya seçilmedi", "No file selected"),
          detail: tr(
            language,
            "Lütfen önce işlenecek dosyayı seçin.",
            "Please select the file to process first.",
          ),
        },
      };
    }
  }

  // 2) Sayfa numaraları — ayırma.
  if (featureId === "split") {
    const pagesError = validatePageSelection(
      pagesText,
      first,
      language,
      W.validationPagesNeedPassword,
      W.validationPagesRequired,
    );
    if (pagesError) {
      return {
        ok: false,
        pagesError,
        toast: {
          title: tr(
            language,
            "Sayfa numaraları geçersiz",
            "Invalid page numbers",
          ),
          detail: pagesError,
        },
      };
    }
    // Geçerli: varsa eski hatayı temizle.
    return withRemainingChecks({ pagesError: "" });
  }

  // 3) Sayfa numaraları — sayfa silme. Ek kural: en az bir sayfa kalmalı.
  if (featureId === "delete-pages") {
    let error = validatePageSelection(
      deletePagesText,
      first,
      language,
      W.validationPagesNeedPassword,
      W.validationPagesRequired,
    );
    const maxPages = first?.pageCount ?? null;
    if (!error && maxPages && deletePagesText.trim()) {
      const pages = expandPagesString(deletePagesText, maxPages, language);
      if (pages !== null && pages.length >= maxPages) {
        error = PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG;
      }
    }
    if (error) {
      const deletesEverything = error === PDF_DELETE_LEAVE_AT_LEAST_ONE_MSG;
      return {
        ok: false,
        deletePagesError: error,
        toast: {
          title: deletesEverything
            ? tr(language, "Uyarı", "Warning")
            : tr(language, "Sayfa listesi geçersiz", "Invalid page list"),
          detail: error,
        },
      };
    }
    return withRemainingChecks({ deletePagesError: "" });
  }

  return withRemainingChecks({});

  /** Araçtan bağımsız, her yolda çalışan son kontroller. */
  function withRemainingChecks(
    fieldErrors: Pick<ToolSubmissionCheck, "pagesError" | "deletePagesError">,
  ): ToolSubmissionCheck {
    if (showSplitPasswordField && !password.trim()) {
      return {
        ...fieldErrors,
        ok: false,
        toast: {
          title: tr(
            language,
            "Kaynak PDF şifresi gerekli",
            "Source PDF password required",
          ),
          detail: tr(
            language,
            "Seçilen PDF şifreli olduğu için şifre alanını doldurmanız gerekiyor.",
            "Enter the PDF password below to unlock the file.",
          ),
        },
      };
    }

    if (showEncryptSourcePasswordField && !inputPassword.trim()) {
      return {
        ...fieldErrors,
        ok: false,
        toast: {
          title: "Kaynak PDF şifresi gerekli",
          detail:
            "Seçilen PDF şifreli olduğu için kaynak PDF şifresini girin.",
        },
      };
    }

    if (showUnlockPasswordField && !unlockOpenPassword.trim()) {
      return {
        ...fieldErrors,
        ok: false,
        toast: {
          title: "Parola gerekli",
          detail: "PDF'yi açmak için mevcut parolayı girin.",
        },
      };
    }

    if (featureId === "encrypt" && !outputPassword.trim()) {
      return {
        ...fieldErrors,
        ok: false,
        toast: {
          title: "Yeni PDF şifresi gerekli",
          detail:
            "Şifreli PDF oluşturmak için yeni parola alanını doldurun.",
        },
      };
    }

    if (mergeHasMissingPasswords) {
      return {
        ...fieldErrors,
        ok: false,
        toast: {
          title: tr(
            language,
            "Şifre doğrulaması gerekli",
            "Password verification required",
          ),
          detail: tr(
            language,
            "Şifreli PDF'ler için parolayı girin ve her dosyanın yanındaki «Parolayı doğrula» ile onaylayın.",
            "For password-protected PDFs, enter the password and tap «Verify password» next to each file.",
          ),
        },
      };
    }

    if (!hasAccessToken) {
      return {
        ...fieldErrors,
        ok: false,
        toast: {
          title: "Oturum gerekli",
          detail: "İşlem için yeniden giriş yapın.",
        },
      };
    }

    // Excel dönüşümü kullanıcıyı bir kez uyarır; onay hatadan sayılmaz.
    if (featureId === "pdf-to-excel" && !excelConfirmed) {
      return { ...fieldErrors, ok: false, askExcelConfirm: true };
    }

    return { ...fieldErrors, ok: true };
  }
}

/**
 * Sayfa listesi kontrolü. Şifreli belgede sayfa sayısı bilinemediği için
 * "önce parolayı girin" denir; aksi hâlde sınır kontrolü yapılamaz.
 */
function validatePageSelection(
  text: string,
  upload: CheckedUpload | undefined,
  language: Language,
  needPasswordMessage: string,
  requiredMessage: string,
): string {
  const format = validatePagesFormat(text, language);
  const maxPages = upload?.pageCount ?? null;
  let overflow = validatePagesMax(text, maxPages, language);
  if (
    !format &&
    !overflow &&
    Boolean(upload?.encrypted) &&
    maxPages === null &&
    text.trim()
  ) {
    overflow = needPasswordMessage;
  }
  return format || overflow || (!text.trim() ? requiredMessage : "");
}
