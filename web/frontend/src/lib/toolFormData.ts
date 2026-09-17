/**
 * ARAÇ İSTEK GÖVDESİ — seçilen araca göre sunucuya hangi alanların
 * gönderileceğini kurar.
 *
 * Ana uygulama dosyasındaki işlem-başlatma akışının içinde duruyordu; her yeni
 * araç eklendiğinde büyüyen ve gözden kaçması kolay bir yerdi. Saf bir
 * fonksiyon: ekran durumuna dokunmaz, sadece verilen değerlerden istek gövdesi
 * üretir. Böylece her aracın hangi alanı gönderdiği tek başına test edilebilir.
 *
 * YENİ ARAÇ EKLERKEN: alanı buraya ekleyin ve sunucudaki karşılığıyla birebir
 * aynı adı kullanın.
 */
import type { FeatureKey } from "../api/subscription";

/** Araç formlarındaki tüm alanların tek seferde geçirildiği paket. */
export type ToolFormState = {
  files: File[];
  /** Kaynak PDF'in açma parolası (şifreli belgeler). */
  password: string;
  htmlToPdfMode: "url" | "html";
  htmlToPdfUrl: string;
  htmlToPdfRaw: string;
  pagesText: string;
  splitMode: string;
  compressQuality: string;
  deletePagesText: string;
  rotatePageRotations: Record<string, number>;
  organizePageOrder: number[];
  unlockOpenPassword: string;
  watermarkPhrase: string;
  watermarkColor: string;
  watermarkFont: string;
  watermarkOpacity: string;
  pageNumStart: string;
  pageNumPos: string;
  pageNumFmt: string;
  pdfToImgFmt: string;
  /** "ekran" | "normal" | "baski" — sunucu güvenli bir çözünürlüğe çevirir. */
  pdfToImgQuality: string;
  inputPassword: string;
  outputPassword: string;
};

export function buildToolFormData(
  fid: FeatureKey,
  s: ToolFormState,
): FormData {
  const formData = new FormData();

  if (fid === "html-to-pdf") {
    if (s.htmlToPdfMode === "url") {
      formData.append("source_url", s.htmlToPdfUrl.trim());
    } else {
      formData.append("html", s.htmlToPdfRaw);
    }
  } else if (fid === "image-to-pdf") {
    for (const f of s.files) {
      formData.append("files", f);
    }
  } else {
    formData.append("file", s.files[0]!);
    switch (fid) {
      case "split":
        formData.append("pages_text", s.pagesText.trim());
        formData.append("mode", s.splitMode);
        formData.append("password", s.password.trim());
        break;
      case "pdf-to-word":
      case "pdf-to-excel":
      case "compress":
        formData.append("quality", s.compressQuality);
        formData.append("password", s.password.trim());
        break;
      case "delete-pages":
        formData.append("pages_to_delete", s.deletePagesText.trim());
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "rotate-pdf": {
        const rotObj: Record<string, number> = {};
        for (const [k, d] of Object.entries(s.rotatePageRotations)) {
          if (d && d !== 0) {
            rotObj[k] = d;
          }
        }
        if (Object.keys(rotObj).length > 0) {
          formData.append("pages_rotation_json", JSON.stringify(rotObj));
        } else {
          formData.append("degrees", "90");
        }
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      }
      case "organize-pdf": {
        const order = s.organizePageOrder.join(",");
        formData.append("page_order", order);
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      }
      case "unlock-pdf":
        formData.append("password", s.unlockOpenPassword.trim());
        break;
      case "watermark":
        formData.append("watermark_text", s.watermarkPhrase.trim());
        formData.append("watermark_color", s.watermarkColor);
        formData.append("watermark_font", s.watermarkFont);
        formData.append("watermark_opacity", s.watermarkOpacity);
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "page-numbers":
        formData.append("start_at", s.pageNumStart.trim() || "1");
        formData.append("position", s.pageNumPos);
        formData.append("fmt", s.pageNumFmt);
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "repair-pdf":
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "pdf-to-ppt":
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "pdf-to-image":
        formData.append("image_format", s.pdfToImgFmt);
        formData.append("quality", s.pdfToImgQuality);
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "encrypt":
        formData.append("input_password", s.inputPassword.trim());
        formData.append("user_password", s.outputPassword.trim());
        break;
      case "pdf-to-text":
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "flatten-pdf":
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "extract-images":
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      default:
        break;
    }
  }

  return formData;
}

/**
 * TOPLU İŞLEM GÖVDESİ — aynı aracı birden çok dosyaya uygulamak için.
 *
 * Tek dosyalık gövdeden ayrı durur çünkü sunucu tarafı da ayrıdır: dosyalar tek
 * alanda toplu gider ve hangi aracın çalışacağı `tool_type` ile bildirilir.
 * Alan adları tek dosyalık akışla AYNI olmak zorunda; ayrıştıkları an ilgili
 * ayar sessizce yok sayılır.
 */
export function buildBatchFormData(
  fid: FeatureKey,
  files: File[],
  s: ToolFormState,
): FormData {
  const form = new FormData();
  form.append("tool_type", fid);
  for (const file of files) {
    form.append("files", file);
  }
  if (s.password.trim()) {
    form.append("password", s.password.trim());
  }
  if (fid === "compress") {
    form.append("quality", s.compressQuality);
  }
  if (fid === "encrypt") {
    form.append("user_password", s.outputPassword.trim());
    form.append("input_password", s.inputPassword.trim());
  }
  if (fid === "watermark") {
    form.append("watermark_text", s.watermarkPhrase.trim());
    form.append("watermark_color", s.watermarkColor);
    form.append("watermark_font", s.watermarkFont);
    form.append("watermark_opacity", s.watermarkOpacity);
  }
  if (fid === "page-numbers") {
    form.append("start_at", s.pageNumStart.trim() || "1");
    form.append("position", s.pageNumPos);
    form.append("fmt", s.pageNumFmt);
  }
  if (fid === "pdf-to-image") {
    form.append("image_format", s.pdfToImgFmt);
    form.append("quality", s.pdfToImgQuality);
  }
  return form;
}
