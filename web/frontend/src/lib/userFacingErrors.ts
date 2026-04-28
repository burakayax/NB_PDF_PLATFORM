import type { Language } from "../i18n/landing";

/** Generic workspace/tool failure — never expose stack traces or filesystem paths. */
export function friendlyOperationFailedMessage(language: Language): string {
  return language === "tr"
    ? "İşlem başarısız: Lütfen şifrenin doğru olduğundan emin olun."
    : "Operation failed: Please make sure your password is correct.";
}
