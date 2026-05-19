import type { Language } from "../i18n/landing";

/** Generic workspace/tool failure — never expose stack traces or filesystem paths. */
export function friendlyOperationFailedMessage(language: Language): string {
  return language === "tr"
    ? "İşlem başarısız. Lütfen dosyanızı kontrol edip tekrar deneyin."
    : "Operation failed. Please check your file and try again.";
}
