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
  {
    id: "grayscale-pdf",
    tr: {
      title: "PDF Gri Tonlama: Renkli PDF'i siyah-beyaza çevirir; metin seçilebilir kalır",
      summary:
        "Renkli PDF'i siyah-beyaza çevirir; metin seçilebilir kalır.",
      link: "https://www.pdfplatform.app/tools/grayscale-pdf",
    },
    en: {
      title: "Grayscale PDF: Turns a colour PDF black-and-white; text stays selectable",
      summary:
        "Turns a colour PDF black-and-white; text stays selectable.",
      link: "https://www.pdfplatform.app/en/tools/grayscale-pdf",
    },
    keywords: {
      tr: ["pdf gri tonlama"],
      en: ["grayscale pdf"],
      tagsTr: ["pdf gri tonlama"],
      tagsEn: ["grayscale pdf"],
    },
  },
  {
    id: "flatten-pdf",
    tr: {
      title: "PDF Düzleştir: Form ve katmanları sabitleyip değiştirilemez yapın",
      summary:
        "Form ve katmanları sabitleyip değiştirilemez yapın.",
      link: "https://www.pdfplatform.app/tools/flatten-pdf",
    },
    en: {
      title: "Flatten PDF: Lock forms and layers so nothing can shift",
      summary:
        "Lock forms and layers so nothing can shift.",
      link: "https://www.pdfplatform.app/en/tools/flatten-pdf",
    },
    keywords: {
      tr: ["pdf düzleştir"],
      en: ["flatten pdf"],
      tagsTr: ["pdf düzleştir"],
      tagsEn: ["flatten pdf"],
    },
  },
  {
    id: "pdf-to-word",
    tr: {
      title: "PDF → Word: Düzenlenebilir Word belgesine çevirin",
      summary:
        "Düzenlenebilir Word belgesine çevirin.",
      link: "https://www.pdfplatform.app/tools/pdf-to-word",
    },
    en: {
      title: "PDF → Word: Convert into an editable Word document",
      summary:
        "Convert into an editable Word document.",
      link: "https://www.pdfplatform.app/en/tools/pdf-to-word",
    },
    keywords: {
      tr: ["pdf → word"],
      en: ["pdf → word"],
      tagsTr: ["pdf → word"],
      tagsEn: ["pdf → word"],
    },
  },
  {
    id: "pdf-to-excel",
    tr: {
      title: "PDF → Excel: Tabloları hesaplanabilir Excel sayfasına aktarın",
      summary:
        "Tabloları hesaplanabilir Excel sayfasına aktarın.",
      link: "https://www.pdfplatform.app/tools/pdf-to-excel",
    },
    en: {
      title: "PDF → Excel: Move tables into a spreadsheet you can calculate with",
      summary:
        "Move tables into a spreadsheet you can calculate with.",
      link: "https://www.pdfplatform.app/en/tools/pdf-to-excel",
    },
    keywords: {
      tr: ["pdf → excel"],
      en: ["pdf → excel"],
      tagsTr: ["pdf → excel"],
      tagsEn: ["pdf → excel"],
    },
  },
  {
    id: "pdf-to-ppt",
    tr: {
      title: "PDF → PowerPoint: Sayfaları düzenlenebilir sunum slaytlarına çevirin",
      summary:
        "Sayfaları düzenlenebilir sunum slaytlarına çevirin.",
      link: "https://www.pdfplatform.app/tools/pdf-to-ppt",
    },
    en: {
      title: "PDF → PowerPoint: Turn pages into editable presentation slides",
      summary:
        "Turn pages into editable presentation slides.",
      link: "https://www.pdfplatform.app/en/tools/pdf-to-ppt",
    },
    keywords: {
      tr: ["pdf → powerpoint"],
      en: ["pdf → powerpoint"],
      tagsTr: ["pdf → powerpoint"],
      tagsEn: ["pdf → powerpoint"],
    },
  },
  {
    id: "word-to-pdf",
    tr: {
      title: "Word → PDF: Word dosyasını herkesin açabildiği PDF yapın",
      summary:
        "Word dosyasını herkesin açabildiği PDF yapın.",
      link: "https://www.pdfplatform.app/tools/word-to-pdf",
    },
    en: {
      title: "Word → PDF: Turn a Word file into a PDF anyone can open",
      summary:
        "Turn a Word file into a PDF anyone can open.",
      link: "https://www.pdfplatform.app/en/tools/word-to-pdf",
    },
    keywords: {
      tr: ["word → pdf"],
      en: ["word → pdf"],
      tagsTr: ["word → pdf"],
      tagsEn: ["word → pdf"],
    },
  },
  {
    id: "excel-to-pdf",
    tr: {
      title: "Excel → PDF: Tabloyu bozulmadan paylaşılabilir PDF yapın",
      summary:
        "Tabloyu bozulmadan paylaşılabilir PDF yapın.",
      link: "https://www.pdfplatform.app/tools/excel-to-pdf",
    },
    en: {
      title: "Excel → PDF: Share a spreadsheet as a PDF that keeps its layout",
      summary:
        "Share a spreadsheet as a PDF that keeps its layout.",
      link: "https://www.pdfplatform.app/en/tools/excel-to-pdf",
    },
    keywords: {
      tr: ["excel → pdf"],
      en: ["excel → pdf"],
      tagsTr: ["excel → pdf"],
      tagsEn: ["excel → pdf"],
    },
  },
  {
    id: "ppt-to-pdf",
    tr: {
      title: "PowerPoint → PDF: Sunumu her cihazda aynı görünen PDF yapın",
      summary:
        "Sunumu her cihazda aynı görünen PDF yapın.",
      link: "https://www.pdfplatform.app/tools/ppt-to-pdf",
    },
    en: {
      title: "PowerPoint → PDF: Make a deck that looks the same on every device",
      summary:
        "Make a deck that looks the same on every device.",
      link: "https://www.pdfplatform.app/en/tools/ppt-to-pdf",
    },
    keywords: {
      tr: ["powerpoint → pdf"],
      en: ["powerpoint → pdf"],
      tagsTr: ["powerpoint → pdf"],
      tagsEn: ["powerpoint → pdf"],
    },
  },
  {
    id: "pdf-to-text",
    tr: {
      title: "PDF → Metin: Belgedeki tüm yazıyı düz metin olarak alın",
      summary:
        "Belgedeki tüm yazıyı düz metin olarak alın.",
      link: "https://www.pdfplatform.app/tools/pdf-to-text",
    },
    en: {
      title: "PDF → Text: Get all the writing as plain text",
      summary:
        "Get all the writing as plain text.",
      link: "https://www.pdfplatform.app/en/tools/pdf-to-text",
    },
    keywords: {
      tr: ["pdf → metin"],
      en: ["pdf → text"],
      tagsTr: ["pdf → metin"],
      tagsEn: ["pdf → text"],
    },
  },
  {
    id: "pdf-to-pdfa",
    tr: {
      title: "PDF → PDF/A (Arşiv): Kurumların istediği ISO arşiv biçimi; yazı tipleri gömülür",
      summary:
        "Kurumların istediği ISO arşiv biçimi; yazı tipleri gömülür.",
      link: "https://www.pdfplatform.app/tools/pdf-to-pdfa",
    },
    en: {
      title: "PDF to PDF/A (Archive): The ISO archival format institutions ask for; fonts embedded",
      summary:
        "The ISO archival format institutions ask for; fonts embedded.",
      link: "https://www.pdfplatform.app/en/tools/pdf-to-pdfa",
    },
    keywords: {
      tr: ["pdf → pdf/a (arşiv)"],
      en: ["pdf to pdf/a (archive)"],
      tagsTr: ["pdf → pdf/a (arşiv)"],
      tagsEn: ["pdf to pdf/a (archive)"],
    },
  },
  {
    id: "deskew-pdf",
    tr: {
      title: "PDF Eğri Tarama Düzeltme: Eğri taranmış sayfaları düzeltir; yazı katmanlı sayfalara dokunmaz",
      summary:
        "Eğri taranmış sayfaları düzeltir; yazı katmanlı sayfalara dokunmaz.",
      link: "https://www.pdfplatform.app/tools/deskew-pdf",
    },
    en: {
      title: "Deskew PDF: Straightens crooked scanned pages; leaves text-layer pages alone",
      summary:
        "Straightens crooked scanned pages; leaves text-layer pages alone.",
      link: "https://www.pdfplatform.app/en/tools/deskew-pdf",
    },
    keywords: {
      tr: ["pdf eğri tarama düzeltme"],
      en: ["deskew pdf"],
      tagsTr: ["pdf eğri tarama düzeltme"],
      tagsEn: ["deskew pdf"],
    },
  },
  {
    id: "repair-pdf",
    tr: {
      title: "PDF Onar: Açılmayan veya bozulmuş dosyayı kurtarın",
      summary:
        "Açılmayan veya bozulmuş dosyayı kurtarın.",
      link: "https://www.pdfplatform.app/tools/repair-pdf",
    },
    en: {
      title: "Repair PDF: Rescue a file that won't open or looks broken",
      summary:
        "Rescue a file that won't open or looks broken.",
      link: "https://www.pdfplatform.app/en/tools/repair-pdf",
    },
    keywords: {
      tr: ["pdf onar"],
      en: ["repair pdf"],
      tagsTr: ["pdf onar"],
      tagsEn: ["repair pdf"],
    },
  },
  {
    id: "extract-images",
    tr: {
      title: "Görselleri Çıkar: Belgedeki tüm fotoğrafları ayrı dosya olarak alın",
      summary:
        "Belgedeki tüm fotoğrafları ayrı dosya olarak alın.",
      link: "https://www.pdfplatform.app/tools/extract-images",
    },
    en: {
      title: "Extract Images: Save every picture in the document as its own file",
      summary:
        "Save every picture in the document as its own file.",
      link: "https://www.pdfplatform.app/en/tools/extract-images",
    },
    keywords: {
      tr: ["görselleri çıkar"],
      en: ["extract images"],
      tagsTr: ["görselleri çıkar"],
      tagsEn: ["extract images"],
    },
  },
  {
    id: "resize-pdf",
    tr: {
      title: "PDF Sayfa Boyutu: Sayfaları A4, A5, Letter veya özel ölçüye getirir",
      summary:
        "Sayfaları A4, A5, Letter veya özel ölçüye getirir.",
      link: "https://www.pdfplatform.app/tools/resize-pdf",
    },
    en: {
      title: "Resize PDF Pages: Fits pages to A4, A5, Letter or a custom size",
      summary:
        "Fits pages to A4, A5, Letter or a custom size.",
      link: "https://www.pdfplatform.app/en/tools/resize-pdf",
    },
    keywords: {
      tr: ["pdf sayfa boyutu"],
      en: ["resize pdf pages"],
      tagsTr: ["pdf sayfa boyutu"],
      tagsEn: ["resize pdf pages"],
    },
  },
  {
    id: "flip-pdf",
    tr: {
      title: "PDF Çevir (Ayna): Sayfaları yatay veya dikey ayna gibi çevirir",
      summary:
        "Sayfaları yatay veya dikey ayna gibi çevirir.",
      link: "https://www.pdfplatform.app/tools/flip-pdf",
    },
    en: {
      title: "Flip PDF: Mirrors pages horizontally or vertically",
      summary:
        "Mirrors pages horizontally or vertically.",
      link: "https://www.pdfplatform.app/en/tools/flip-pdf",
    },
    keywords: {
      tr: ["pdf çevir (ayna)"],
      en: ["flip pdf"],
      tagsTr: ["pdf çevir (ayna)"],
      tagsEn: ["flip pdf"],
    },
  },
  {
    id: "page-numbers",
    tr: {
      title: "Sayfa Numarası: Belgeye düzgün sayfa numaraları ekleyin",
      summary:
        "Belgeye düzgün sayfa numaraları ekleyin.",
      link: "https://www.pdfplatform.app/tools/page-numbers",
    },
    en: {
      title: "Page Numbers: Add clean page numbers to the document",
      summary:
        "Add clean page numbers to the document.",
      link: "https://www.pdfplatform.app/en/tools/page-numbers",
    },
    keywords: {
      tr: ["sayfa numarası"],
      en: ["page numbers"],
      tagsTr: ["sayfa numarası"],
      tagsEn: ["page numbers"],
    },
  },
  {
    id: "watermark",
    tr: {
      title: "Filigran Ekle: Sayfalara kendi damganızı veya yazınızı basın",
      summary:
        "Sayfalara kendi damganızı veya yazınızı basın.",
      link: "https://www.pdfplatform.app/tools/watermark",
    },
    en: {
      title: "Add Watermark: Stamp your own mark or text onto the pages",
      summary:
        "Stamp your own mark or text onto the pages.",
      link: "https://www.pdfplatform.app/en/tools/watermark",
    },
    keywords: {
      tr: ["filigran ekle"],
      en: ["add watermark"],
      tagsTr: ["filigran ekle"],
      tagsEn: ["add watermark"],
    },
  },
  {
    id: "encrypt",
    tr: {
      title: "PDF Şifrele: Belgeyi parolayla koruyup izinleri belirleyin",
      summary:
        "Belgeyi parolayla koruyup izinleri belirleyin.",
      link: "https://www.pdfplatform.app/tools/encrypt",
    },
    en: {
      title: "Encrypt PDF: Protect the file with a password and set permissions",
      summary:
        "Protect the file with a password and set permissions.",
      link: "https://www.pdfplatform.app/en/tools/encrypt",
    },
    keywords: {
      tr: ["pdf şifrele"],
      en: ["encrypt pdf"],
      tagsTr: ["pdf şifrele"],
      tagsEn: ["encrypt pdf"],
    },
  },
  {
    id: "unlock-pdf",
    tr: {
      title: "Şifre Kaldır: Parolasını bildiğiniz belgenin kilidini açın",
      summary:
        "Parolasını bildiğiniz belgenin kilidini açın.",
      link: "https://www.pdfplatform.app/tools/unlock-pdf",
    },
    en: {
      title: "Unlock PDF: Remove the password from a file you own",
      summary:
        "Remove the password from a file you own.",
      link: "https://www.pdfplatform.app/en/tools/unlock-pdf",
    },
    keywords: {
      tr: ["şifre kaldır"],
      en: ["unlock pdf"],
      tagsTr: ["şifre kaldır"],
      tagsEn: ["unlock pdf"],
    },
  },
  {
    id: "pdf-to-image",
    tr: {
      title: "PDF → Görsel: Her sayfayı ayrı bir fotoğraf olarak kaydedin",
      summary:
        "Her sayfayı ayrı bir fotoğraf olarak kaydedin.",
      link: "https://www.pdfplatform.app/tools/pdf-to-image",
    },
    en: {
      title: "PDF → Image: Save each page as its own picture",
      summary:
        "Save each page as its own picture.",
      link: "https://www.pdfplatform.app/en/tools/pdf-to-image",
    },
    keywords: {
      tr: ["pdf → görsel"],
      en: ["pdf → image"],
      tagsTr: ["pdf → görsel"],
      tagsEn: ["pdf → image"],
    },
  },
  {
    id: "image-to-pdf",
    tr: {
      title: "Görsel → PDF: Fotoğrafları sıralayıp tek bir PDF'te toplayın",
      summary:
        "Fotoğrafları sıralayıp tek bir PDF'te toplayın. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/image-to-pdf",
    },
    en: {
      title: "Image → PDF: Order your photos and collect them in one PDF",
      summary:
        "Order your photos and collect them in one PDF. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/image-to-pdf",
    },
    keywords: {
      tr: ["görsel → pdf"],
      en: ["image → pdf"],
      tagsTr: ["görsel → pdf"],
      tagsEn: ["image → pdf"],
    },
  },
  {
    id: "alternate-mix-pdf",
    tr: {
      title: "PDF Dönüşümlü Birleştir: İki PDF'in sayfalarını sırayla serpiştirir (çift taraflı tarama)",
      summary:
        "İki PDF'in sayfalarını sırayla serpiştirir (çift taraflı tarama).",
      link: "https://www.pdfplatform.app/tools/alternate-mix-pdf",
    },
    en: {
      title: "Alternate & Mix PDF: Interleaves the pages of two PDFs (double-sided scans)",
      summary:
        "Interleaves the pages of two PDFs (double-sided scans).",
      link: "https://www.pdfplatform.app/en/tools/alternate-mix-pdf",
    },
    keywords: {
      tr: ["pdf dönüşümlü birleştir"],
      en: ["alternate & mix pdf"],
      tagsTr: ["pdf dönüşümlü birleştir"],
      tagsEn: ["alternate & mix pdf"],
    },
  },
  {
    id: "gorsel-sikistir",
    tr: {
      title: "Görsel Sıkıştır: Fotoğrafları küçültün",
      summary:
        "Fotoğrafları küçültün. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/gorsel-sikistir",
    },
    en: {
      title: "Compress Image: Make photos smaller",
      summary:
        "Make photos smaller. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/compress-image",
    },
    keywords: {
      tr: ["görsel sıkıştır"],
      en: ["compress image"],
      tagsTr: ["görsel sıkıştır"],
      tagsEn: ["compress image"],
    },
  },
  {
    id: "gorsel-boyutlandir",
    tr: {
      title: "Görsel Boyutlandır: Fotoğrafı istediğiniz ölçüye getirin",
      summary:
        "Fotoğrafı istediğiniz ölçüye getirin. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/gorsel-boyutlandir",
    },
    en: {
      title: "Resize Image: Set a photo to exactly the size you need",
      summary:
        "Set a photo to exactly the size you need. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/resize-image",
    },
    keywords: {
      tr: ["görsel boyutlandır"],
      en: ["resize image"],
      tagsTr: ["görsel boyutlandır"],
      tagsEn: ["resize image"],
    },
  },
  {
    id: "udf-to-pdf",
    tr: {
      title: "UDF → PDF: UYAP'tan inen .udf belgesini program kurmadan PDF'ye çevirin",
      summary:
        "UYAP'tan inen .udf belgesini program kurmadan PDF'ye çevirin. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/udf-to-pdf",
    },
    en: {
      title: "UDF → PDF: Turn a .udf file from UYAP into a PDF — no software needed",
      summary:
        "Turn a .udf file from UYAP into a PDF — no software needed. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/udf-to-pdf",
    },
    keywords: {
      tr: ["udf → pdf"],
      en: ["udf → pdf"],
      tagsTr: ["udf → pdf"],
      tagsEn: ["udf → pdf"],
    },
  },
  {
    id: "html-to-pdf",
    tr: {
      title: "HTML → PDF: Bir web sayfasını olduğu gibi PDF'e alın",
      summary:
        "Bir web sayfasını olduğu gibi PDF'e alın.",
      link: "https://www.pdfplatform.app/tools/html-to-pdf",
    },
    en: {
      title: "HTML → PDF: Capture a web page as a PDF, exactly as it looks",
      summary:
        "Capture a web page as a PDF, exactly as it looks.",
      link: "https://www.pdfplatform.app/en/tools/html-to-pdf",
    },
    keywords: {
      tr: ["html → pdf"],
      en: ["html → pdf"],
      tagsTr: ["html → pdf"],
      tagsEn: ["html → pdf"],
    },
  },
  {
    id: "ustveri-temizle",
    tr: {
      title: "PDF Üstveri Temizle: Yazar, program, tarih, XMP ve fotoğraf GPS izlerini siler",
      summary:
        "Yazar, program, tarih, XMP ve fotoğraf GPS izlerini siler. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/ustveri-temizle",
    },
    en: {
      title: "Remove PDF Metadata: Strips author, software, dates, XMP and photo GPS traces",
      summary:
        "Strips author, software, dates, XMP and photo GPS traces. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/remove-pdf-metadata",
    },
    keywords: {
      tr: ["pdf üstveri temizle"],
      en: ["remove pdf metadata"],
      tagsTr: ["pdf üstveri temizle"],
      tagsEn: ["remove pdf metadata"],
    },
  },
  {
    id: "form-doldur",
    tr: {
      title: "PDF Form Doldur: Doldurulabilir form alanlarını bulur ve cihazınızda doldurur",
      summary:
        "Doldurulabilir form alanlarını bulur ve cihazınızda doldurur. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/form-doldur",
    },
    en: {
      title: "Fill PDF Form: Detects fillable fields and fills them on your device",
      summary:
        "Detects fillable fields and fills them on your device. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/fill-pdf-form",
    },
    keywords: {
      tr: ["pdf form doldur"],
      en: ["fill pdf form"],
      tagsTr: ["pdf form doldur"],
      tagsEn: ["fill pdf form"],
    },
  },
  {
    id: "taranmis-pdf-ocr",
    tr: {
      title: "Taranmış PDF (OCR): Taranmış sayfadaki yazıyı okunabilir metne çevirir",
      summary:
        "Taranmış sayfadaki yazıyı okunabilir metne çevirir. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/taranmis-pdf-ocr",
    },
    en: {
      title: "Scanned PDF (OCR): Turns scanned pages into text you can read and copy",
      summary:
        "Turns scanned pages into text you can read and copy. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/ocr-pdf",
    },
    keywords: {
      tr: ["taranmış pdf (ocr)"],
      en: ["scanned pdf (ocr)"],
      tagsTr: ["taranmış pdf (ocr)"],
      tagsEn: ["scanned pdf (ocr)"],
    },
  },
  {
    id: "aranabilir-pdf",
    tr: {
      title: "Aranabilir PDF: Taranmış belgede Ctrl+F ile arama yapabilir hale gelin",
      summary:
        "Taranmış belgede Ctrl+F ile arama yapabilir hale gelin. Dosyaların cihazında işlenir, sunucuya yüklenmez.",
      link: "https://www.pdfplatform.app/tools/aranabilir-pdf",
    },
    en: {
      title: "Searchable PDF: Make a scanned document findable with Ctrl+F",
      summary:
        "Make a scanned document findable with Ctrl+F. Your files are processed on your device and never uploaded.",
      link: "https://www.pdfplatform.app/en/tools/searchable-pdf",
    },
    keywords: {
      tr: ["aranabilir pdf"],
      en: ["searchable pdf"],
      tagsTr: ["aranabilir pdf"],
      tagsEn: ["searchable pdf"],
    },
  },
];
