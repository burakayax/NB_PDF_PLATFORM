import type { Language } from "../i18n/landing";

/** Generic workspace/tool failure — never expose stack traces or filesystem paths. */
export function friendlyOperationFailedMessage(language: Language): string {
  return language === "tr"
    ? "İşlem başarısız. Lütfen dosyanızı kontrol edip tekrar deneyin."
    : "Operation failed. Please check your file and try again.";
}

/**
 * Sunucunun anlattığı hatayı kullanıcıya olduğu gibi göstermek güvenli mi?
 *
 * PDF sunucusu istemciye dönmeden önce hata metnini zaten temizliyor (dosya
 * yolu, yığın izi vb. ayıklanıyor). Buna rağmen ağ katmanından gelen ham
 * metinler araya karışabildiği için burada ikinci bir süzgeç var: teknik
 * görünen ya da aşırı uzun metinler gösterilmez, genel mesaja düşülür.
 */
function looksTechnical(text: string): boolean {
  const low = text.toLowerCase();
  return (
    low.includes("traceback") ||
    low.includes("<!doctype") ||
    low.includes("error:") ||
    /[a-z]:\\/.test(low) ||
    low.includes("/tmp/") ||
    low.includes("http/1.1")
  );
}

/** Parola sorununu anlatan mesajları tanır (başlığı ona göre seçmek için). */
export function isPasswordProblem(text: string): boolean {
  const low = text.toLowerCase();
  return (
    low.includes("parola") ||
    low.includes("şifre") ||
    low.includes("password")
  );
}

/**
 * İşlem hatasında kullanıcıya gösterilecek başlık ve açıklama.
 *
 * Eskiden hata ne olursa olsun "İşlem başarısız. Lütfen dosyanızı kontrol
 * edin." deniyordu. Sunucu "parola hatalı" dediği hâlde kullanıcı sebebi
 * öğrenemiyor, dosyayı suçlayıp aynı yanlış parolayla tekrar deniyordu.
 */
/**
 * Hata, oturumun düşmesinden mi kaynaklanıyor?
 *
 * NEDEN: Canlı testte uzun bir aradan sonra işlem başlatıldığında oturum
 * sessizce düşmüştü; ekranda yalnızca genel bir "işlem başarısız" yazıyordu.
 * Kullanıcı dosyasında ya da araçta sorun olduğunu sanıp aynı işlemi tekrar
 * deniyor. Oysa yapması gereken tek şey yeniden giriş yapmak.
 */
function oturumSorunuMu(raw: string, error: unknown): boolean {
  const durum = (error as { status?: number } | null)?.status;
  if (durum === 401 || durum === 403) return true;
  const t = raw.toLowerCase();
  return (
    t.includes("oturum gerekli") ||
    t.includes("oturumun süresi") ||
    t.includes("unauthorized") ||
    t.includes("token")
  );
}

export function toolFailureNotice(
  error: unknown,
  language: Language,
): { title: string; detail: string } {
  const raw = error instanceof Error ? error.message.trim() : "";

  if (oturumSorunuMu(raw, error)) {
    return {
      title: language === "tr" ? "Oturumun süresi dolmuş" : "Your session expired",
      detail:
        language === "tr"
          ? "Yeniden giriş yapıp işlemi tekrar başlat. Seçtiğin dosyalar ekranda duruyor, baştan yüklemene gerek yok."
          : "Sign in again and start the operation once more. Your selected files are still here — no need to upload them again.",
    };
  }

  const usable = raw.length > 0 && raw.length <= 260 && !looksTechnical(raw);
  const passwordIssue = usable && isPasswordProblem(raw);
  return {
    title: passwordIssue
      ? language === "tr"
        ? "Parola sorunu"
        : "Password problem"
      : language === "tr"
        ? "İşlem başarısız"
        : "Operation failed",
    detail: usable ? raw : friendlyOperationFailedMessage(language),
  };
}
