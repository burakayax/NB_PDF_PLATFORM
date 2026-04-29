import type { FeatureKey } from "../api/subscription";
import type { Language } from "../i18n/landing";
import { getPublicSiteOrigin } from "./siteOrigin";
import { toolSlugForFeature } from "./toolRoutes";

type SeoPair = { title: string; description: string };

const META: Record<FeatureKey, Record<Language, SeoPair>> = {
  split: {
    tr: {
      title: "PDF sayfalarını ayır | NB PDF PLARTFORM",
      description:
        "PDF dosyanızı sayfa sayfa ayırın. Güvenli sunucu işleme; çıktıyı tek veya çoklu dosya olarak indirin.",
    },
    en: {
      title: "Split PDF pages | NB PDF PLARTFORM",
      description: "Split a PDF into separate pages. Secure processing and fast downloads.",
    },
  },
  merge: {
    tr: {
      title: "PDF birleştir | NB PDF PLARTFORM",
      description:
        "Birden fazla PDF veya görüntüyü tek dosyada birleştirin. Sürükle-bırak ve sıralama ile hızlı birleştirme.",
    },
    en: {
      title: "Merge PDF | NB PDF PLARTFORM",
      description: "Combine multiple PDFs or images into one document with reorder support.",
    },
  },
  "delete-pages": {
    tr: {
      title: "PDF’ten sayfa sil | NB PDF PLARTFORM",
      description: "İstemediğiniz sayfaları seçip PDF’ten güvenle silin.",
    },
    en: {
      title: "Delete PDF pages | NB PDF PLARTFORM",
      description: "Remove unwanted pages from your PDF while keeping the rest intact.",
    },
  },
  "rotate-pdf": {
    tr: {
      title: "PDF döndür | NB PDF PLARTFORM",
      description: "Sayfaları tek tek veya toplu olarak döndürün.",
    },
    en: {
      title: "Rotate PDF | NB PDF PLARTFORM",
      description: "Rotate PDF pages individually or in bulk.",
    },
  },
  "organize-pdf": {
    tr: {
      title: "PDF sayfa sırası | NB PDF PLARTFORM",
      description: "Sayfa sırasını yeniden düzenleyin ve yeni bir PDF oluşturun.",
    },
    en: {
      title: "Organize PDF pages | NB PDF PLARTFORM",
      description: "Reorder pages and export a clean PDF.",
    },
  },
  compress: {
    tr: {
      title: "PDF sıkıştır | NB PDF PLARTFORM",
      description: "Dosya boyutunu küçültün; içeriği koruyarak paylaşıma uygun hale getirin.",
    },
    en: {
      title: "Compress PDF | NB PDF PLARTFORM",
      description: "Shrink PDF file size while preserving readability.",
    },
  },
  "pdf-to-word": {
    tr: {
      title: "PDF’ten Word’e | NB PDF PLARTFORM",
      description: "PDF içeriğini düzenlenebilir Word (DOCX) çıktısına dönüştürün.",
    },
    en: {
      title: "PDF to Word | NB PDF PLARTFORM",
      description: "Convert PDF content to an editable Word document.",
    },
  },
  "word-to-pdf": {
    tr: {
      title: "Word’ten PDF’e | NB PDF PLARTFORM",
      description: "DOC ve DOCX dosyalarını baskıya hazır PDF’e çevirin.",
    },
    en: {
      title: "Word to PDF | NB PDF PLARTFORM",
      description: "Turn DOC/DOCX files into reliable PDFs.",
    },
  },
  "excel-to-pdf": {
    tr: {
      title: "Excel’den PDF’e | NB PDF PLARTFORM",
      description: "Elektronik tablolarınızı paylaşılabilir PDF formatına aktarın.",
    },
    en: {
      title: "Excel to PDF | NB PDF PLARTFORM",
      description: "Export spreadsheets to clean PDF pages.",
    },
  },
  "pdf-to-excel": {
    tr: {
      title: "PDF’ten Excel’e | NB PDF PLARTFORM",
      description: "PDF tablolarını XLSX’e aktarmanıza yardımcı olan dönüştürme aracı.",
    },
    en: {
      title: "PDF to Excel | NB PDF PLARTFORM",
      description: "Extract tables from PDF into Excel-friendly output.",
    },
  },
  "pdf-to-ppt": {
    tr: {
      title: "PDF’ten PowerPoint | NB PDF PLARTFORM",
      description: "Sunum içeriğini PPTX olarak kullanın.",
    },
    en: {
      title: "PDF to PowerPoint | NB PDF PLARTFORM",
      description: "Convert PDF slides toward editable presentation format.",
    },
  },
  "ppt-to-pdf": {
    tr: {
      title: "PowerPoint’ten PDF | NB PDF PLARTFORM",
      description: "PPT/PPTX dosyalarını tek bir PDF’te birleştirin.",
    },
    en: {
      title: "PowerPoint to PDF | NB PDF PLARTFORM",
      description: "Export presentations to universal PDF.",
    },
  },
  "pdf-to-image": {
    tr: {
      title: "PDF’ten görüntüye | NB PDF PLARTFORM",
      description: "Sayfaları PNG/JPEG vb. görüntü paketi olarak indirin.",
    },
    en: {
      title: "PDF to images | NB PDF PLARTFORM",
      description: "Rasterize PDF pages into downloadable images.",
    },
  },
  "image-to-pdf": {
    tr: {
      title: "Görüntüden PDF | NB PDF PLARTFORM",
      description: "Birden fazla görseli tek PDF dosyasında toplayın.",
    },
    en: {
      title: "Images to PDF | NB PDF PLARTFORM",
      description: "Pack JPG/PNG/WebP images into one PDF.",
    },
  },
  "html-to-pdf": {
    tr: {
      title: "HTML’den PDF | NB PDF PLARTFORM",
      description: "URL veya HTML içeriğini sabit düzen PDF’e dönüştürün.",
    },
    en: {
      title: "HTML to PDF | NB PDF PLARTFORM",
      description: "Turn URLs or HTML snippets into printable PDFs.",
    },
  },
  "unlock-pdf": {
    tr: {
      title: "PDF şifresini kaldır | NB PDF PLARTFORM",
      description: "Yetkili olduğunuz şifreli PDF’leri işlem için açın.",
    },
    en: {
      title: "Unlock PDF | NB PDF PLARTFORM",
      description: "Open password-protected PDFs when you have the password.",
    },
  },
  watermark: {
    tr: {
      title: "PDF filigran | NB PDF PLARTFORM",
      description: "Metin veya görsel filigran ekleyin; paylaşımı güvenli biçimde işaretleyin.",
    },
    en: {
      title: "PDF watermark | NB PDF PLARTFORM",
      description: "Add text or image watermarks across pages.",
    },
  },
  "page-numbers": {
    tr: {
      title: "PDF sayfa numarası | NB PDF PLARTFORM",
      description: "Başlık ve dip bilgisinde profesyonel sayfa numaralandırma ekleyin.",
    },
    en: {
      title: "PDF page numbers | NB PDF PLARTFORM",
      description: "Stamp readable page numbers in headers or footers.",
    },
  },
  "repair-pdf": {
    tr: {
      title: "PDF onarımı | NB PDF PLARTFORM",
      description: "Bozuk veya sorunlu PDF’leri yeniden paketlemeyi deneyin.",
    },
    en: {
      title: "Repair PDF | NB PDF PLARTFORM",
      description: "Attempt recovery for corrupted PDF containers.",
    },
  },
  encrypt: {
    tr: {
      title: "PDF şifrele | NB PDF PLARTFORM",
      description: "Açılış parolası ekleyerek belgenizi koruyun.",
    },
    en: {
      title: "Encrypt PDF | NB PDF PLARTFORM",
      description: "Protect PDFs with an owner-supplied password.",
    },
  },
};

/** `<title>` içinden marka sonekini ayırarak H1 / JSON-LD name için kısa başlık üretir. */
export function headlineFromWorkspaceTitle(pageTitle: string): string {
  const pipe = pageTitle.lastIndexOf(" | ");
  if (pipe >= 0) {
    return pageTitle.slice(0, pipe).trim();
  }
  return pageTitle.trim();
}

export function workspaceToolMeta(featureId: FeatureKey, language: Language): SeoPair {
  return META[featureId]?.[language] ?? META.split[language];
}

const HEAD_IDS = {
  canonical: "nb-seo-canonical",
  hreflangTr: "nb-seo-hreflang-tr",
  hreflangEn: "nb-seo-hreflang-en",
  hreflangDefault: "nb-seo-hreflang-x-default",
  jsonLd: "nb-seo-jsonld-software",
} as const;

function upsertLinkTag(options: {
  id: string;
  rel: string;
  href: string;
  hreflang?: string | null;
}) {
  let el = document.getElementById(options.id) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.id = options.id;
    document.head.appendChild(el);
  }
  el.setAttribute("rel", options.rel);
  el.setAttribute("href", options.href);
  if (options.hreflang != null && options.hreflang !== "") {
    el.setAttribute("hreflang", options.hreflang);
  } else {
    el.removeAttribute("hreflang");
  }
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.setAttribute("type", "application/ld+json");
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Workspace dışına çıkıldığında kanonik / JSON-LD / hreflang enjeksiyonlarını kaldırır. */
export function resetWorkspaceHeadSeo(): void {
  for (const id of Object.values(HEAD_IDS)) {
    document.getElementById(id)?.remove();
  }
}

/**
 * Araç sayfası için title, meta description, canonical, hreflang, JSON-LD (SoftwareApplication)
 * ve document dil özniteliğini günceller.
 */
export function applyWorkspaceToolMeta(featureId: FeatureKey, language: Language): void {
  const { title, description } = workspaceToolMeta(featureId, language);
  document.title = title;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", description);

  const origin = getPublicSiteOrigin();
  const slug = toolSlugForFeature(featureId);
  const pathname = `/tools/${slug}`;

  if (!origin) {
    resetWorkspaceHeadSeo();
    return;
  }

  const canonicalUrl = `${origin}${pathname}`;
  const headline = headlineFromWorkspaceTitle(title);

  upsertLinkTag({
    id: HEAD_IDS.canonical,
    rel: "canonical",
    href: canonicalUrl,
  });

  const urlTr = `${canonicalUrl}?lang=tr`;
  const urlEn = `${canonicalUrl}?lang=en`;

  upsertLinkTag({
    id: HEAD_IDS.hreflangTr,
    rel: "alternate",
    href: urlTr,
    hreflang: "tr",
  });
  upsertLinkTag({
    id: HEAD_IDS.hreflangEn,
    rel: "alternate",
    href: urlEn,
    hreflang: "en",
  });
  upsertLinkTag({
    id: HEAD_IDS.hreflangDefault,
    rel: "alternate",
    href: canonicalUrl,
    hreflang: "x-default",
  });

  upsertJsonLd(HEAD_IDS.jsonLd, {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: headline,
    description,
    applicationCategory: "PDF tool",
    operatingSystem: "Windows, macOS, Android, iOS",
    url: canonicalUrl,
  });
}
