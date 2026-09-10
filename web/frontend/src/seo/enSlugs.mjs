// ─────────────────────────────────────────────────────────────────────────────
//  İNGİLİZCE URL SLUG'LARI — TEK GERÇEK KAYNAK
// ─────────────────────────────────────────────────────────────────────────────
//  SORUN: /en/ altındaki sayfalar İngilizce içerik sunuyordu ama URL segmenti
//  Türkçe kalıyordu (/en/blog/pdf-word-donusturme). Bu hem tutarsız hem de SEO
//  kaybı: İngilizce arayan kullanıcı sorgusuyla URL'de hiçbir kelime eşleşmiyor.
//
//  ÇÖZÜM: TR yollar DEĞİŞMEZ (mevcut TR sıralamaları korunur); yalnızca /en/
//  altındaki segment İngilizceye çevrilir. Eski /en/<tr-slug> adresleri
//  render.yaml'daki 301 kurallarıyla yeni adrese yönlendirilir; runtime router
//  da her ikisini çözebilir (client-side gezinmede kırık link olmasın).
//
//  Bu dosyayı HEM Node build script'i (scripts/generate-seo-files.mjs) HEM de
//  React runtime import eder → statik HTML ile SPA ASLA ayrışmaz.
// ─────────────────────────────────────────────────────────────────────────────

/** TR araç slug'ı → EN araç slug'ı. Listede olmayan slug zaten İngilizce. */
export const EN_TOOL_SLUGS = {
  "gorsel-sikistir": "compress-image",
  "gorsel-boyutlandir": "resize-image",
  "pdf-kesit-al": "crop-pdf-to-image",
  "belge-tara": "scan-document",
  "aranabilir-pdf": "searchable-pdf",
  "pdf-ozetle": "summarize-pdf",
  "pdf-sohbet": "chat-with-pdf",
  "pdf-duzenle": "edit-pdf",
  "pdf-imzala": "sign-pdf",
  "pdf-yorumla": "annotate-pdf",
  "taranmis-pdf-ocr": "ocr-pdf",
  "pdf-veri-cikar": "extract-data-from-pdf",
  "pdf-ceviri": "translate-pdf",
  "ai-toplu-islem": "batch-process-pdf",
  "pdf-karsilastir": "compare-pdf",
  "hassas-veri-gizle": "redact-pdf",
};

/** TR blog slug'ı → EN blog slug'ı. */
export const EN_BLOG_SLUGS = {
  "pdften-gorsel-resim-cikarma": "extract-images-from-pdf",
  "faturadan-excele-veri-aktarma": "invoice-data-to-excel",
  "iki-pdf-birlestirme-ucretsiz": "merge-two-pdfs-free",
  "pdf-baska-dile-cevirme": "translate-pdf-online",
  "pdf-word-donusturme": "convert-pdf-to-word",
  "pdf-boyutu-kucultme-sikistirma": "reduce-pdf-file-size",
  "pdf-sifre-kaldirma-koyma": "remove-pdf-password",
  "resimleri-pdf-yapma": "images-to-pdf",
  "uzun-belgeleri-ai-ile-ozetleme": "summarize-long-documents-with-ai",
  "taranmis-pdf-metne-cevirme-ocr": "scanned-pdf-to-text-ocr",
  "ihale-sartnamesi-nasil-okunur": "how-to-read-a-tender-document",
  "kira-kontrati-dikkat-edilecek-maddeler": "lease-agreement-checklist",
  "banka-ekstresi-excele-aktarma": "bank-statement-to-excel",
  "yabanci-dildeki-sozlesmeyi-anlama": "understand-a-foreign-language-contract",
  "akademik-makale-ozetleme-literatur": "summarize-academic-papers",
  "faturalari-toplu-muhasebeye-hazirlama": "batch-invoices-for-accounting",
  "pdf-sayfa-silme": "delete-pages-from-pdf",
  "pdf-dondurme-kaydetme": "rotate-pdf-and-save",
  "pdf-sayfa-sirasi-degistirme": "reorder-pdf-pages",
  "pdf-bolme-sayfalara-ayirma": "split-pdf-into-pages",
  "pdf-e-imza-atma-nasil-yapilir": "how-to-sign-a-pdf",
  "pdf-filigran-ekleme": "add-watermark-to-pdf",
  "pdf-uzerine-yazma-isaretleme": "write-and-mark-up-a-pdf",
  "telefonla-belge-tarama-pdf": "scan-documents-with-your-phone",
  "aranabilir-pdf-olusturma-ocr": "create-a-searchable-pdf-ocr",
  "belge-fotografini-kaliteli-pdf-yapma": "document-photo-to-pdf",
  "camscanner-ucretsiz-gizli-alternatif": "camscanner-alternative",
  "word-pdf-cevirme": "convert-word-to-pdf",
  "pdf-jpg-resme-cevirme": "convert-pdf-to-jpg",
  "pdf-metin-duzenleme-silme": "edit-pdf-text",
  "pdf-excel-tablo-cevirme": "convert-pdf-to-excel",
  "excel-pdf-cevirme": "convert-excel-to-pdf",
  "powerpoint-pdf-cevirme": "convert-powerpoint-to-pdf",
  "pdf-sayfa-numarasi-ekleme": "add-page-numbers-to-pdf",
  "bozuk-pdf-onarma": "repair-a-corrupt-pdf",
  "pdf-karsilastirma-farklari-bulma": "compare-two-pdfs",
  "pdf-hassas-veri-gizleme-kvkk": "redact-sensitive-data-in-a-pdf",
  "dosya-yuklemeden-pdf-isleme-gizlilik": "process-pdf-without-uploading",
  "telefonda-pdf-islemleri-uygulamasiz": "pdf-tools-on-your-phone-no-app",
  "en-iyi-ucretsiz-pdf-araclari": "best-free-pdf-tools",
  "ilovepdf-alternatifi-cihazda-ucretsiz": "ilovepdf-alternative",
  "cv-ozgecmis-word-pdf-cevirme": "convert-cv-from-word-to-pdf",
  "smallpdf-alternatifi-sinirsiz-ucretsiz": "smallpdf-alternative",
  "pdf-form-doldurma-online-ucretsiz": "fill-out-a-pdf-form-online",
  "adobe-acrobat-alternatifi-ucretsiz": "adobe-acrobat-alternative",
  "ucretsiz-pdf-duzenleyici-rehberi": "free-pdf-editor",
  "pdf-kirpma-kenar-boslugu-kesme": "crop-a-pdf-trim-margins",
  "ucretsiz-pdf-araci-nasil-secilir": "how-to-choose-a-free-pdf-tool",
  "pdf-kucultme-eposta-whatsapp": "shrink-a-pdf-for-email",
  "telefonda-pdf-duzenleme-uygulamasiz": "edit-a-pdf-on-your-phone",
  "gorsel-boyutlandirma-sosyal-medya": "resize-images-for-social-media",
  "pdf-ten-kesit-alma-gorsel-kirpma": "snip-images-from-a-pdf",
};

/** Ters yön tabloları (EN slug → TR slug); modül yüklenirken bir kez kurulur. */
const TR_TOOL_SLUGS = invert(EN_TOOL_SLUGS);
const TR_BLOG_SLUGS = invert(EN_BLOG_SLUGS);

function invert(map) {
  const out = {};
  for (const [tr, en] of Object.entries(map)) out[en] = tr;
  return out;
}

/** TR araç slug'ı → o dildeki slug. */
export function toolSlugForLang(trSlug, lang) {
  return lang === "en" ? EN_TOOL_SLUGS[trSlug] ?? trSlug : trSlug;
}
/** TR blog slug'ı → o dildeki slug. */
export function blogSlugForLang(trSlug, lang) {
  return lang === "en" ? EN_BLOG_SLUGS[trSlug] ?? trSlug : trSlug;
}
/** Herhangi bir araç slug'ı (TR ya da EN) → kanonik TR slug'ı. */
export function toolSlugToTr(slug) {
  return TR_TOOL_SLUGS[slug] ?? slug;
}
/** Herhangi bir blog slug'ı (TR ya da EN) → kanonik TR slug'ı. */
export function blogSlugToTr(slug) {
  return TR_BLOG_SLUGS[slug] ?? slug;
}

/**
 * Dil-öneksiz bir "bare" yolu (/, /pricing, /blog/x, /tools/x) hedef dildeki
 * GERÇEK yayın yoluna çevirir. Tek dönüşüm noktası: canonical, hreflang,
 * sitemap, prerender çıktı yolu ve gövde içi linkler hep bunu kullanır.
 */
export function localizedPath(barePath, lang) {
  const bare = barePath === "" ? "/" : barePath;
  const translated = bare.startsWith("/blog/")
    ? `/blog/${blogSlugForLang(bare.slice("/blog/".length), lang)}`
    : bare.startsWith("/tools/")
      ? `/tools/${toolSlugForLang(bare.slice("/tools/".length), lang)}`
      : bare;
  if (lang !== "en") return translated;
  return translated === "/" ? "/en" : `/en${translated}`;
}

/**
 * Yayın yolunu (dil öneki + o dilin slug'ı) dil-öneksiz kanonik TR yola indirger.
 * Router eşleştirmesi bunu kullanır → /en/blog/convert-pdf-to-word da,
 * eski /en/blog/pdf-word-donusturme de aynı yazıyı bulur.
 */
export function canonicalBarePath(pathname) {
  const bare = pathname.replace(/\/+$/, "").replace(/^\/en(?=\/|$)/, "") || "/";
  if (bare.startsWith("/blog/")) {
    return `/blog/${blogSlugToTr(bare.slice("/blog/".length))}`;
  }
  if (bare.startsWith("/tools/")) {
    return `/tools/${toolSlugToTr(bare.slice("/tools/".length))}`;
  }
  return bare;
}
