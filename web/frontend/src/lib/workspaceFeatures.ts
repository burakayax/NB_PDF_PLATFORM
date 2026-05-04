import type { FeatureKey } from "../api/subscription";
import type { Language } from "../i18n/landing";
import { featureCopy } from "../i18n/workspace";

/** Workspace tool row: structural fields are fixed; copy comes from CMS overlay + `featureCopy` fallback. */
export type WorkspaceFeatureUi = {
  id: FeatureKey;
  title: string;
  icon: string;
  description: string;
  endpoint: string;
  buttonText: string;
  accept: string;
  multiple?: boolean;
  /** false: URL/HTML gibi dosya yok; varsayılan true */
  requiresUpload?: boolean;
  fallbackFilename: string;
};

const REGISTRY: Omit<WorkspaceFeatureUi, "title" | "description" | "buttonText">[] = [
  {
    id: "split",
    icon: "📄",
    endpoint: "split",
    accept: ".pdf,application/pdf",
    fallbackFilename: "ayrılan-sayfalar.pdf",
  },
  {
    id: "merge",
    icon: "🗂",
    endpoint: "merge",
    accept: ".pdf,application/pdf",
    multiple: true,
    fallbackFilename: "birleştirilmiş.pdf",
  },
  {
    id: "delete-pages",
    icon: "🗑",
    endpoint: "delete-pages",
    accept: ".pdf,application/pdf",
    fallbackFilename: "silinmiş-sayfalar.pdf",
  },
  {
    id: "rotate-pdf",
    icon: "🔄",
    endpoint: "rotate-pdf",
    accept: ".pdf,application/pdf",
    fallbackFilename: "döndürülmüş.pdf",
  },
  {
    id: "organize-pdf",
    icon: "↕",
    endpoint: "organize-pdf",
    accept: ".pdf,application/pdf",
    fallbackFilename: "sıralanmış.pdf",
  },
  {
    id: "compress",
    icon: "🗜",
    endpoint: "compress",
    accept: ".pdf,application/pdf",
    fallbackFilename: "sıkıştırılmış.pdf",
  },
  {
    id: "pdf-to-word",
    icon: "📝",
    endpoint: "pdf-to-word",
    accept: ".pdf,application/pdf",
    fallbackFilename: "çıktı.docx",
  },
  {
    id: "word-to-pdf",
    icon: "🧾",
    endpoint: "word-to-pdf",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fallbackFilename: "çıktı.pdf",
  },
  {
    id: "excel-to-pdf",
    icon: "📊",
    endpoint: "excel-to-pdf",
    accept: ".xlsx,.xlsm,.xltx,.xltm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fallbackFilename: "çıktı.pdf",
  },
  {
    id: "pdf-to-excel",
    icon: "📈",
    endpoint: "pdf-to-excel",
    accept: ".pdf,application/pdf",
    fallbackFilename: "çıktı.xlsx",
  },
  {
    id: "pdf-to-ppt",
    icon: "📽",
    endpoint: "pdf-to-ppt",
    accept: ".pdf,application/pdf",
    fallbackFilename: "sunum.pptx",
  },
  {
    id: "ppt-to-pdf",
    icon: "📊",
    endpoint: "ppt-to-pdf",
    accept: ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
    fallbackFilename: "çıktı.pdf",
  },
  {
    id: "pdf-to-image",
    icon: "🖼",
    endpoint: "pdf-to-image",
    accept: ".pdf,application/pdf",
    fallbackFilename: "sayfalar.zip",
  },
  {
    id: "image-to-pdf",
    icon: "🖼",
    endpoint: "image-to-pdf",
    accept: "image/png,image/jpeg,image/jpg,image/webp",
    multiple: true,
    fallbackFilename: "fotograflar.pdf",
  },
  {
    id: "html-to-pdf",
    icon: "🌐",
    endpoint: "html-to-pdf",
    accept: "",
    requiresUpload: false,
    fallbackFilename: "web.pdf",
  },
  {
    id: "unlock-pdf",
    icon: "🔓",
    endpoint: "unlock-pdf",
    accept: ".pdf,application/pdf",
    fallbackFilename: "açık.pdf",
  },
  {
    id: "watermark",
    icon: "💧",
    endpoint: "watermark",
    accept: ".pdf,application/pdf",
    fallbackFilename: "filigranlı.pdf",
  },
  {
    id: "page-numbers",
    icon: "#",
    endpoint: "page-numbers",
    accept: ".pdf,application/pdf",
    fallbackFilename: "numaralı.pdf",
  },
  {
    id: "repair-pdf",
    icon: "🩹",
    endpoint: "repair-pdf",
    accept: ".pdf,application/pdf",
    fallbackFilename: "onarılmış.pdf",
  },
  {
    id: "encrypt",
    icon: "🔒",
    endpoint: "encrypt",
    accept: ".pdf,application/pdf",
    fallbackFilename: "şifreli.pdf",
  },
  {
    id: "pdf-to-text",
    icon: "📋",
    endpoint: "pdf-to-text",
    accept: ".pdf,application/pdf",
    fallbackFilename: "metin.txt",
  },
  {
    id: "flatten-pdf",
    icon: "🧹",
    endpoint: "flatten-pdf",
    accept: ".pdf,application/pdf",
    fallbackFilename: "düzleştirilmiş.pdf",
  },
];

/** POST sonucu result_id dönen (önizleme + indirmede tüketim) araçlar */
export const RESULT_STORE_TOOL_IDS: FeatureKey[] = [
  "split",
  "compress",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "pdf-to-ppt",
  "pdf-to-image",
  "image-to-pdf",
  "html-to-pdf",
  "encrypt",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "ppt-to-pdf",
  "pdf-to-text",
  "flatten-pdf",
];

export function isResultStoreTool(id: FeatureKey): boolean {
  return RESULT_STORE_TOOL_IDS.includes(id);
}

export const WORKSPACE_TOOL_IDS: FeatureKey[] = REGISTRY.map((r) => r.id);

/**
 * `cms.content.workspace.TOOLS[featureId]` overrides title / description / button.
 * `TOOLS.config.disabledFeatures` (via runtime) removes TOOLS from the list.
 */
export function buildWorkspaceFeaturesFromCms(
  language: Language,
  cms: Record<string, unknown> | null | undefined,
  disabledFeatures: string[],
): WorkspaceFeatureUi[] {
  const disabled = new Set(disabledFeatures);
  const TOOLS = (cms?.workspace as Record<string, unknown> | undefined)?.TOOLS as
    | Record<string, { title?: string; description?: string; button?: string; buttonText?: string }>
    | undefined;

  return REGISTRY.filter((r) => !disabled.has(r.id)).map((r) => {
    const fb = featureCopy(r.id, language);
    const ov = TOOLS?.[r.id];
    const btn =
      typeof ov?.button === "string" && ov.button.trim()
        ? ov.button.trim()
        : typeof ov?.buttonText === "string" && ov.buttonText.trim()
          ? ov.buttonText.trim()
          : fb.button;
    return {
      ...r,
      requiresUpload: r.requiresUpload !== false,
      title: typeof ov?.title === "string" && ov.title.trim() ? ov.title.trim() : fb.title,
      description: typeof ov?.description === "string" && ov.description.trim() ? ov.description.trim() : fb.description,
      buttonText: btn,
    };
  });
}
