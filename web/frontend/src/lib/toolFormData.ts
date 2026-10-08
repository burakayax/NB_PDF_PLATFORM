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

/** PDF Kırp ayarları (hepsi metin: arayüz alanlarından gelir). */
export type CropOptions = {
  mode: "margins" | "auto";
  top: string;
  bottom: string;
  left: string;
  right: string;
  pad: string;
  uniform: boolean;
  from: string;
  to: string;
};

/** Küçük araçların (sayfa boyutu, ayna, serpiştirme) ayarları. */
export type MiniToolOptions = {
  resizeSize: string;
  resizeW: string;
  resizeH: string;
  resizeOrientation: "auto" | "portrait" | "landscape";
  resizeFit: "fit" | "fill" | "stretch";
  resizeMargin: string;
  flipDirection: "horizontal" | "vertical";
  flipFrom: string;
  flipTo: string;
  mixReverse: boolean;
};

export const DEFAULT_MINI_OPTIONS: MiniToolOptions = {
  resizeSize: "a4",
  resizeW: "210",
  resizeH: "297",
  resizeOrientation: "auto",
  resizeFit: "fit",
  resizeMargin: "0",
  flipDirection: "horizontal",
  flipFrom: "1",
  flipTo: "",
  mixReverse: false,
};

export const DEFAULT_CROP_OPTIONS: CropOptions = {
  mode: "auto",
  top: "0",
  bottom: "0",
  left: "0",
  right: "0",
  pad: "5",
  uniform: false,
  from: "1",
  to: "",
};

/** Boş olmayan üst/alt bilgi metinlerini JSON'a çevirir; hiç yoksa "". */
export function headerFooterJson(m?: Record<string, string>): string {
  if (!m) return "";
  const temiz: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "string" && v.trim()) temiz[k] = v;
  }
  return Object.keys(temiz).length ? JSON.stringify(temiz) : "";
}

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
  /** PDF sıkıştırma hedef boyutu (KB); 0 = hedef yok, kalite menüsü geçerli. */
  compressTargetKb?: number;
  /** Hedefe inilemezse sayfaları görüntüye çevirmeye izin (yazı seçilemez olur). */
  compressAllowRaster?: boolean;
  deletePagesText: string;
  rotatePageRotations: Record<string, number>;
  organizePageOrder: number[];
  unlockOpenPassword: string;
  watermarkPhrase: string;
  watermarkColor: string;
  watermarkFont: string;
  watermarkOpacity: string;
  watermarkRotation: string;
  /** Logo/görsel filigranı; seçiliyse metin yerine bu kullanılır. */
  watermarkImage?: File | null;
  watermarkPosition?: string;
  watermarkSize: string;
  watermarkFrom: string;
  watermarkTo: string;
  pageNumStart: string;
  pageNumPos: string;
  pageNumFmt: string;
  pageNumSize: string;
  pageNumColor: string;
  pageNumFrom: string;
  pageNumTo: string;
  /** Serbest üst/alt bilgi metinleri: {"header-left": "...", ...}. Boşsa gönderilmez. */
  headerFooterTexts?: Record<string, string>;
  cropOptions?: CropOptions;
  miniOptions?: MiniToolOptions;
  /** Gelişmiş bölme: her N sayfa / en çok MB. */
  splitEveryN?: string;
  splitMaxMb?: string;
  pdfToImgFmt: string;
  pdfToImgPages: string;
  /** "1b" | "2b" | "3b" — PDF/A uyumluluk düzeyi. */
  pdfaVersion: string;
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
  } else if (fid === "image-to-pdf" || fid === "alternate-mix-pdf") {
    for (const f of s.files) {
      formData.append("files", f);
    }
    if (fid === "alternate-mix-pdf" && (s.miniOptions ?? DEFAULT_MINI_OPTIONS).mixReverse) {
      formData.append("reverse_second", "1");
    }
  } else {
    formData.append("file", s.files[0]!);
    switch (fid) {
      case "split":
        formData.append("pages_text", s.pagesText.trim());
        formData.append("mode", s.splitMode);
        if (s.splitMode === "every") formData.append("every_n", (s.splitEveryN ?? "").trim() || "1");
        if (s.splitMode === "size") formData.append("max_mb", (s.splitMaxMb ?? "").trim() || "5");
        formData.append("password", s.password.trim());
        break;
      case "pdf-to-word":
      case "pdf-to-excel":
      case "compress":
        formData.append("quality", s.compressQuality);
        formData.append("password", s.password.trim());
        if (fid === "compress" && s.compressTargetKb && s.compressTargetKb > 0) {
          formData.append("target_kb", String(Math.round(s.compressTargetKb)));
          if (s.compressAllowRaster) formData.append("allow_rasterize", "1");
        }
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
        formData.append("watermark_rotation", s.watermarkRotation || "45");
        formData.append("watermark_size", s.watermarkSize || "70");
        formData.append("from_page", s.watermarkFrom.trim() || "1");
        formData.append("to_page", s.watermarkTo.trim() || "0");
        if (s.watermarkImage) {
          formData.append("watermark_image", s.watermarkImage);
          formData.append("watermark_position", s.watermarkPosition || "center");
        }
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "page-numbers":
        formData.append("start_at", s.pageNumStart.trim() || "1");
        formData.append("position", s.pageNumPos);
        formData.append("fmt", s.pageNumFmt);
        formData.append("font_size", s.pageNumSize.trim() || "9");
        formData.append("color", s.pageNumColor || "#666666");
        formData.append("from_page", s.pageNumFrom.trim() || "1");
        formData.append("to_page", s.pageNumTo.trim() || "0");
        {
          const hf = headerFooterJson(s.headerFooterTexts);
          if (hf) formData.append("header_footer_json", hf);
        }
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
        if (s.pdfToImgPages.trim()) formData.append("pages", s.pdfToImgPages.trim());
        if (s.password.trim()) {
          formData.append("password", s.password.trim());
        }
        break;
      case "pdf-to-pdfa":
        formData.append("version", s.pdfaVersion);
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
      case "deskew-pdf":
      case "grayscale-pdf":
        if (s.password.trim()) formData.append("password", s.password.trim());
        break;
      case "resize-pdf": {
        const m = s.miniOptions ?? DEFAULT_MINI_OPTIONS;
        formData.append("page_size", m.resizeSize);
        formData.append("custom_w_mm", m.resizeW.trim() || "0");
        formData.append("custom_h_mm", m.resizeH.trim() || "0");
        formData.append("orientation", m.resizeOrientation);
        formData.append("fit", m.resizeFit);
        formData.append("margin_mm", m.resizeMargin.trim() || "0");
        if (s.password.trim()) formData.append("password", s.password.trim());
        break;
      }
      case "flip-pdf": {
        const m = s.miniOptions ?? DEFAULT_MINI_OPTIONS;
        formData.append("direction", m.flipDirection);
        formData.append("from_page", m.flipFrom.trim() || "1");
        formData.append("to_page", m.flipTo.trim() || "0");
        if (s.password.trim()) formData.append("password", s.password.trim());
        break;
      }
      case "crop-pdf": {
        const c = s.cropOptions ?? DEFAULT_CROP_OPTIONS;
        formData.append("crop_mode", c.mode);
        formData.append("top_mm", c.top.trim() || "0");
        formData.append("bottom_mm", c.bottom.trim() || "0");
        formData.append("left_mm", c.left.trim() || "0");
        formData.append("right_mm", c.right.trim() || "0");
        formData.append("pad_mm", c.pad.trim() || "5");
        if (c.uniform) formData.append("uniform", "1");
        formData.append("from_page", c.from.trim() || "1");
        formData.append("to_page", c.to.trim() || "0");
        if (s.password.trim()) formData.append("password", s.password.trim());
        break;
      }
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
    form.append("watermark_rotation", s.watermarkRotation || "45");
    form.append("watermark_size", s.watermarkSize || "70");
    form.append("from_page", s.watermarkFrom.trim() || "1");
    form.append("to_page", s.watermarkTo.trim() || "0");
  }
  if (fid === "page-numbers") {
    form.append("start_at", s.pageNumStart.trim() || "1");
    form.append("position", s.pageNumPos);
    form.append("fmt", s.pageNumFmt);
    form.append("font_size", s.pageNumSize.trim() || "9");
    form.append("color", s.pageNumColor || "#666666");
    form.append("from_page", s.pageNumFrom.trim() || "1");
    form.append("to_page", s.pageNumTo.trim() || "0");
    const hf = headerFooterJson(s.headerFooterTexts);
    if (hf) form.append("header_footer_json", hf);
  }
  if (fid === "pdf-to-image") {
    form.append("image_format", s.pdfToImgFmt);
    form.append("quality", s.pdfToImgQuality);
    if (s.pdfToImgPages.trim()) form.append("pages", s.pdfToImgPages.trim());
  }
  return form;
}
