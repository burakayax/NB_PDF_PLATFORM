/**
 * YÜKLENEN DOSYALARIN ÖN KONTROLÜ — her dosya için sunucuya sorup şifreli mi,
 * kaç sayfa, ne kadarı görüntü öğrenir.
 *
 * Ana uygulama dosyasındaki dosya-ekleme akışının en uzun parçasıydı. Ekran
 * durumuna dokunmaz: dosya listesini alır, güncellenmiş listeyi döndürür;
 * kullanıcıya gösterilecek uyarıları verilen `showToast` ile bildirir. Böylece
 * hem tek başına test edilebilir hem de o dosya kısalır.
 */
import { inspectPdf } from "../api";
import { PDF_INSPECT_TIMEOUT_MS, withPdfInspectTimeout } from "./appNavigation";
import { friendlyOperationFailedMessage } from "./userFacingErrors";
import { ws } from "../i18n/workspace";
import type { Language } from "../i18n/landing";

/** Ön kontrolden geçirilecek dosya kaydının bilinmesi gereken alanları. */
type InspectableItem = {
  id: string;
  file: File;
  encrypted: boolean;
  inspecting: boolean;
  pageCount: number | null;
  imageRatio: number | null;
  mergePasswordVerified: boolean;
  corrupt: boolean;
};

export type InspectUploadsOptions = {
  accessToken?: string | null;
  language: Language;
  showToast: (kind: "error", title: string, detail: string) => void;
};

export async function inspectUploadItems<T extends InspectableItem>(
  items: T[],
  { accessToken, language, showToast }: InspectUploadsOptions,
): Promise<T[]> {
  return await Promise.all(
  items.map(async (item) => {
    try {
      const result = await withPdfInspectTimeout(
        inspectPdf(item.file, undefined, accessToken),
        PDF_INSPECT_TIMEOUT_MS,
      );
      const isCorrupt = Boolean(
        (result as { corrupt?: boolean }).corrupt ||
        (result.page_count === 0 && !result.encrypted),
      );
      if (isCorrupt) {
        return {
          ...item,
          encrypted: false,
          inspecting: false,
          pageCount: 0,
          mergePasswordVerified: false,
          corrupt: true,
        };
      }
      return {
        ...item,
        encrypted: Boolean(result.encrypted),
        inspecting: false,
        pageCount: result.page_count ?? null,
        imageRatio:
          typeof result.image_ratio === "number"
            ? result.image_ratio
            : null,
        mergePasswordVerified: false,
        corrupt: false,
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
        // Sunucu anlamlı bir mesaj döndürdüyse (ör. "PDF çok fazla sayfa
        // içeriyor") onu göster; yoksa genel mesaja düş.
        const serverMsg =
          err instanceof Error ? err.message.trim() : "";
        showToast(
          "error",
          L2.inspectFailedTitle,
          serverMsg || friendlyOperationFailedMessage(language),
        );
      }
      return {
        ...item,
        encrypted: false,
        inspecting: false,
        pageCount: null,
        mergePasswordVerified: false,
        corrupt: false,
      };
    }
  }),
  );
}

