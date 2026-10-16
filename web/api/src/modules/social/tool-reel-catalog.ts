/**
 * Araç tanıtım videolarının METİN kataloğu.
 *
 * Her satırın bir de ÇEKİM SENARYOSU vardır (frontend `scripts/tool-reels/scenarios/<id>.mjs`);
 * senaryosu olmayan araç buraya eklenmemeli, yoksa videosu hiç üretilemez.
 *
 * Başlık/özet ELLE yazılır ve doğrulanmış olmalıdır: gönderi metni bunlardan şablonla kurulur
 * (yapay zekâ kullanılmaz; model özette olmayan iddialar ekleyebiliyordu). Özette "cihazında
 * işlenir" gibi gizlilik cümlesi varsa `frontend/src/lib/onDeviceTools.ts` ile uyumlu olmalı.
 */

export type ToolReelSide = { title: string; summary: string; link: string };

export type ToolReelCatalogEntry = {
  /** Senaryo kimliğiyle aynı. */
  id: string;
  tr: ToolReelSide;
  en: ToolReelSide;
  keywords: { tr: string[]; en: string[]; tagsTr: string[]; tagsEn: string[] };
  /**
   * "ücretsiz / free" içeren arama ifadeleri etiketlenebilir mi? Yalnızca sitenin kendi sayfası aracın
   * ücretsiz kullanılabildiğini söylüyorsa true (misafir/ücretsiz üyelik hakkı). Emin değilsen ekleme.
   */
  freeClaim?: boolean;
};

export const TOOL_REEL_CATALOG: ToolReelCatalogEntry[] = [
  {
    id: "compress",
    freeClaim: true,
    tr: {
      title: "PDF Sıkıştır: büyük dosyayı saniyeler içinde küçült",
      summary:
        "Büyük PDF'i e-postaya sığacak boyuta indir. Hedef boyut belirle ya da kaliteyi seç, sonucu indir veya paylaş.",
      link: "https://www.pdfplatform.app/tools/compress",
    },
    en: {
      title: "Compress PDF: shrink a large file in seconds",
      summary:
        "Make a big PDF small enough to email. Set a target size or pick the quality, then download or share the result.",
      link: "https://www.pdfplatform.app/en/tools/compress",
    },
    keywords: {
      tr: ["pdf sıkıştırma", "pdf boyutu küçültme", "pdf küçültme"],
      en: ["compress pdf", "reduce pdf size", "shrink pdf"],
      tagsTr: ["pdf sıkıştır", "pdf küçült"],
      tagsEn: ["compress pdf", "pdf size"],
    },
  },
  {
    id: "merge",
    freeClaim: true,
    tr: {
      title: "PDF Birleştir: birden çok PDF'i tek dosyada topla",
      summary:
        "Birden çok PDF'i istediğin sıraya dizip tek dosya yap. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/merge-pdf",
    },
    en: {
      title: "Merge PDF: combine several PDFs into one file",
      summary:
        "Put several PDFs in the order you want and make a single file. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/merge-pdf",
    },
    keywords: {
      tr: ["pdf birleştirme", "pdf birleştir", "pdf dosyalarını birleştir"],
      en: ["merge pdf", "combine pdf", "join pdf files"],
      tagsTr: ["pdf birleştir", "pdf birleştirme"],
      tagsEn: ["merge pdf", "combine pdf"],
    },
  },
  {
    id: "cv-olustur",
    freeClaim: true,
    tr: {
      title: "CV Oluştur: hazır şablonla dakikalar içinde CV'ni hazırla",
      summary:
        "30 hazır şablondan seç, bilgilerini gir; CV'n canlı oluşsun. ATS röntgeniyle kontrol et, PDF olarak indir. Bilgilerin yalnızca tarayıcında kalır, sunucuya gönderilmez.",
      link: "https://www.pdfplatform.app/tools/cv-olustur",
    },
    en: {
      title: "CV Maker: build your CV in minutes with a ready template",
      summary:
        "Pick from 30 templates, fill in your details and watch your CV build live. Check it with the ATS X-ray and download it as a PDF. Your details stay in your browser and are never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/cv-maker",
    },
    keywords: {
      tr: ["cv hazırlama", "cv oluşturma", "cv şablonu"],
      en: ["cv maker", "resume builder", "cv template"],
      tagsTr: ["cv hazırla", "cv şablonu"],
      tagsEn: ["cv maker", "resume builder"],
    },
  },
];
