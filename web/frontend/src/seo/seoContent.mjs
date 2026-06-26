/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TEK GERÇEK KAYNAK — Tüm sayfa SEO içeriği (TR birincil, EN ikincil)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Bu dosya HEM Node build script'i (scripts/generate-seo-files.mjs) HEM de
 *  React runtime (src/seo/routeSeoConfig.ts) tarafından tüketilir. Böylece
 *  Google'ın gördüğü statik HTML ile tarayıcıda enjekte edilen meta veriler
 *  ASLA birbirinden ayrışmaz.
 *
 *  Anahtarlar `toolSlugForFeature()` çıktısıyla birebir eşleşir (örn. "compress",
 *  "encrypt", "merge-pdf"). Her araç için:
 *    - title       : <title> ve og:title (≤60 karakter, birincil keyword başta)
 *    - description : meta description / snippet (≤155 karakter)
 *    - h1          : sayfadaki görünür <h1> (prerender gövdesine yazılır)
 *    - intro       : H1 altındaki görünür açıklama paragrafı (snippet kaynağı)
 *    - keywords    : ilgili arama terimleri (içerik üretiminde kullanılır)
 *    - faq         : sayfada görünür + FAQPage schema'ya beslenen Soru/Cevap
 *
 *  .d.mts kardeş dosyası TS tarafına tip sağlar; tsc bu .mjs'i derlemez.
 */

export const BRAND = "PDF PLATFORM";

/** Gerçek, var olan ürün görseli (1280×720). Sosyal paylaşım önizlemesi.
 *  public/app-preview-main.png — landing showcase ve runtime SEO ile aynı dosya. */
export const DEFAULT_OG_IMAGE = "/app-preview-main.png";
export const DEFAULT_OG_IMAGE_WIDTH = "1280";
export const DEFAULT_OG_IMAGE_HEIGHT = "720";

/** Diziye göre sitemap araç sırası — toolSlugForFeature çıktılarıyla aynı. */
export const TOOL_SLUGS = [
  "split-pdf",
  "merge-pdf",
  "delete-pages",
  "rotate-pdf",
  "organize-pdf",
  "compress",
  "pdf-to-word",
  "word-to-pdf",
  "excel-to-pdf",
  "pdf-to-excel",
  "pdf-to-ppt",
  "ppt-to-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "html-to-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
  "pdf-to-text",
  "flatten-pdf",
];

const T = (title, description, h1, intro, keywords, faq) => ({
  title: `${title} | ${BRAND}`,
  description,
  h1,
  intro,
  keywords,
  faq,
});

// ─── Araç SEO içeriği (slug bazlı, TR + EN) ──────────────────────────────────
export const TOOL_SEO = {
  "merge-pdf": {
    tr: T(
      "PDF Birleştirme — online ve ücretsiz",
      "PDF dosyalarını tarayıcınızda anında birleştirin. Birden fazla PDF'i tek belgede toplayın — kurulum veya üyelik gerekmez.",
      "PDF Birleştirme",
      "Birden fazla PDF veya görseli sürükle-bırak ile tek belgede birleştirin. Sayfa sırasını düzenleyin, sonucu saniyeler içinde indirin — kurulum yok, hızlı ve güvenli.",
      ["pdf birleştirme", "pdf birleştir", "pdf merge", "iki pdf birleştirme", "pdf dosyalarını birleştirme"],
      [
        { q: "PDF dosyalarını online ve ücretsiz nasıl birleştiririm?", a: "Dosyalarınızı yükleyin, sürükleyerek sırayı belirleyin ve birleştir butonuna basın. Birleştirilmiş PDF saniyeler içinde hazır olur — kurulum gerekmez." },
        { q: "Birleştirme sırası önemli mi?", a: "Evet. Yüklediğiniz dosyaları sürükleyerek istediğiniz sıraya dizebilir, hatta görselleri de araya ekleyebilirsiniz." },
      ],
    ),
    en: T(
      "Merge PDF files online — free",
      "Merge PDF files instantly in your browser. Combine multiple PDFs into one document — no installation, no sign-up required.",
      "Merge PDF",
      "Combine multiple PDFs or images into a single document with drag-and-drop ordering. Reorder pages and download in seconds — no installation, fast and secure.",
      ["merge pdf", "combine pdf", "join pdf files", "merge pdf online"],
      [
        { q: "How do I merge PDF files online for free?", a: "Upload your files, drag to set the order, and click merge. The combined PDF is ready in seconds — no installation required." },
        { q: "Does the merge order matter?", a: "Yes. Drag uploaded files into any order you like, and you can even insert images between PDFs." },
      ],
    ),
  },

  "split-pdf": {
    tr: T(
      "PDF Ayırma — sayfaları online ayırın",
      "PDF'i ayrı sayfalara veya özel aralıklara bölün. İhtiyacınız olan sayfaları hızlıca çıkarın — tarayıcıda ücretsiz.",
      "PDF Ayırma ve Bölme",
      "Bir PDF'i sayfa sayfa ayırın veya özel sayfa aralıkları seçerek bölün. İhtiyacınız olan sayfaları çıkarın, tek veya çoklu dosya olarak indirin.",
      ["pdf ayırma", "pdf bölme", "pdf sayfa ayırma", "pdf split", "pdf'ten sayfa çıkarma"],
      [
        { q: "Bir PDF'i nasıl ayrı sayfalara bölerim?", a: "PDF'inizi yükleyin, ayırmak istediğiniz sayfaları veya aralıkları seçin ve indirin. Her sayfayı ayrı dosya ya da seçili aralığı tek dosya olarak alabilirsiniz." },
        { q: "Belirli sayfa aralığını çıkarabilir miyim?", a: "Evet. Örneğin 5-10 arası sayfaları seçip yalnızca o aralığı yeni bir PDF olarak indirebilirsiniz." },
      ],
    ),
    en: T(
      "Split PDF — extract pages online",
      "Split a PDF into separate pages or custom ranges. Extract exactly the pages you need — fast and free in your browser.",
      "Split & Extract PDF Pages",
      "Split a PDF page by page or by custom ranges. Extract the pages you need and download them as a single file or multiple files.",
      ["split pdf", "extract pdf pages", "separate pdf pages", "split pdf online"],
      [
        { q: "How do I split a PDF into separate pages?", a: "Upload your PDF, select the pages or ranges to split, and download. Get each page as a separate file or a selected range as one file." },
        { q: "Can I extract a specific page range?", a: "Yes. Select, for example, pages 5–10 and download only that range as a new PDF." },
      ],
    ),
  },

  "delete-pages": {
    tr: T(
      "PDF Sayfa Silme — istenmeyen sayfaları kaldır",
      "PDF'ten istemediğiniz sayfaları seçip güvenle silin. Geri kalan içerik bozulmadan korunur — online ve ücretsiz.",
      "PDF'ten Sayfa Silme",
      "PDF belgenizdeki boş, tekrarlı veya istenmeyen sayfaları seçerek tek tıkla silin. Kalan sayfaların düzeni ve içeriği bozulmadan korunur.",
      ["pdf sayfa silme", "pdf'ten sayfa silme", "pdf sayfa kaldırma", "delete pdf pages"],
      [
        { q: "PDF'ten sayfa nasıl silinir?", a: "PDF'inizi yükleyin, silmek istediğiniz sayfaları işaretleyin ve uygula deyin. Yeni PDF, seçtiğiniz sayfalar çıkarılmış olarak indirilir." },
        { q: "Birden fazla sayfayı aynı anda silebilir miyim?", a: "Evet. İstediğiniz kadar sayfayı işaretleyip tek işlemde silebilirsiniz." },
      ],
    ),
    en: T(
      "Delete PDF Pages — remove unwanted pages",
      "Remove unwanted pages from your PDF while keeping the rest intact. Fast, free and secure — right in your browser.",
      "Delete Pages from PDF",
      "Select blank, duplicate or unwanted pages in your PDF and delete them in one click. The layout and content of the remaining pages stay intact.",
      ["delete pdf pages", "remove pdf pages", "erase pdf page"],
      [
        { q: "How do I delete a page from a PDF?", a: "Upload your PDF, mark the pages to remove, and apply. The new PDF downloads with the selected pages removed." },
        { q: "Can I delete multiple pages at once?", a: "Yes. Mark as many pages as you want and delete them in a single operation." },
      ],
    ),
  },

  "rotate-pdf": {
    tr: T(
      "PDF Döndürme — sayfaları çevirin",
      "PDF sayfalarını tek tek veya toplu olarak 90°, 180° döndürün. Yan yatmış taramaları düzeltin — online ve ücretsiz.",
      "PDF Döndürme",
      "Yan yatmış veya ters taranmış PDF sayfalarını tek tek ya da toplu olarak döndürün. Doğru yönü ayarlayın ve düzeltilmiş PDF'i indirin.",
      ["pdf döndürme", "pdf sayfa çevirme", "pdf çevirme", "rotate pdf"],
      [
        { q: "PDF sayfalarını nasıl döndürürüm?", a: "PDF'inizi yükleyin, döndürmek istediğiniz sayfaları sola/sağa çevirin ve indirin. Tüm sayfaları tek seferde de döndürebilirsiniz." },
        { q: "Döndürme kalıcı olur mu?", a: "Evet. İndirilen PDF'te sayfa yönü kalıcı olarak güncellenir." },
      ],
    ),
    en: T(
      "Rotate PDF — turn pages the right way",
      "Rotate PDF pages individually or in bulk by 90° or 180°. Fix sideways scans — free online, no installation.",
      "Rotate PDF Pages",
      "Rotate sideways or upside-down scanned PDF pages individually or in bulk. Set the correct orientation and download the fixed PDF.",
      ["rotate pdf", "turn pdf page", "rotate pdf online"],
      [
        { q: "How do I rotate PDF pages?", a: "Upload your PDF, turn the chosen pages left or right, and download. You can also rotate all pages at once." },
        { q: "Is the rotation permanent?", a: "Yes. The page orientation is permanently updated in the downloaded PDF." },
      ],
    ),
  },

  "organize-pdf": {
    tr: T(
      "PDF Sayfa Düzenleme — sıralamayı değiştirin",
      "PDF sayfalarının sırasını sürükle-bırak ile yeniden düzenleyin. Sayfaları taşıyın, çıkarın ve temiz bir PDF oluşturun.",
      "PDF Sayfa Düzenleme",
      "PDF sayfalarının sırasını yeniden düzenleyin; sayfaları yukarı/aşağı taşıyın veya konum numarası girerek hızlıca yeniden dizin. Düzenlenmiş PDF'i indirin.",
      ["pdf sayfa düzenleme", "pdf sayfa sıralama", "pdf sayfaları taşıma", "organize pdf"],
      [
        { q: "PDF sayfalarının sırasını nasıl değiştiririm?", a: "PDF'inizi yükleyin, sayfaları sürükleyerek veya konum numarası girerek yeniden sıralayın ve yeni PDF'i indirin." },
        { q: "Sayfaları çıkararak yeniden düzenleyebilir miyim?", a: "Evet. İstemediğiniz sayfaları kaldırıp kalanları yeni bir düzende dışa aktarabilirsiniz." },
      ],
    ),
    en: T(
      "Organize PDF — reorder pages",
      "Reorder PDF pages with drag and drop. Move, remove and arrange pages, then export a clean PDF — free and online.",
      "Organize PDF Pages",
      "Reorder PDF pages by moving them up or down or typing a position number to rearrange quickly. Then export the organized PDF.",
      ["organize pdf", "reorder pdf pages", "rearrange pdf"],
      [
        { q: "How do I change the order of PDF pages?", a: "Upload your PDF, reorder pages by dragging or typing a position number, and download the new PDF." },
        { q: "Can I remove pages while reorganizing?", a: "Yes. Drop unwanted pages and export the rest in a new order." },
      ],
    ),
  },

  compress: {
    tr: T(
      "PDF Sıkıştırma — dosya boyutunu küçültün",
      "PDF dosyalarını kalite kaybı olmadan sıkıştırın. E-posta ekleri ve yüklemeler için PDF'i optimize edin — ücretsiz online araç.",
      "PDF Sıkıştırma",
      "Büyük PDF dosyalarının boyutunu, metin ve görselleri okunaklı tutarak küçültün. E-posta ekleri, portal yüklemeleri ve hızlı paylaşım için idealdir.",
      ["pdf sıkıştırma", "pdf boyut küçültme", "pdf küçültme", "compress pdf"],
      [
        { q: "PDF dosyasını boyutunu küçültmek için nasıl sıkıştırırım?", a: "PDF'inizi yükleyin, sıkıştırma düzeyini seçin ve optimize edilmiş dosyayı indirin. Metin ve görseller okunaklı kalır." },
        { q: "Sıkıştırma kaliteyi bozar mı?", a: "Dengeli düzeyde belirgin bir kalite kaybı olmaz; daha yüksek sıkıştırmada boyut daha çok düşer." },
      ],
    ),
    en: T(
      "Compress PDF — reduce file size online",
      "Compress PDF files to reduce size without losing quality. Optimize PDFs for email attachments and uploads — free online tool.",
      "Compress PDF",
      "Reduce the size of large PDF files while keeping text and images legible. Ideal for email attachments, portal uploads and fast sharing.",
      ["compress pdf", "reduce pdf size", "shrink pdf", "compress pdf online"],
      [
        { q: "How do I compress a PDF to reduce its file size?", a: "Upload your PDF, choose a compression level, and download the optimized file. Text and images stay sharp." },
        { q: "Does compression hurt quality?", a: "At a balanced level there is no noticeable loss; higher compression reduces size further." },
      ],
    ),
  },

  "pdf-to-word": {
    tr: T(
      "PDF'den Word'e Dönüştürme — biçim bozulmaz",
      "PDF'i Word'e (.docx) yazı tipleri, tablolar ve düzen korunarak dönüştürün. Hızlı ve doğru PDF dönüştürücü — online ücretsiz.",
      "PDF'den Word'e Dönüştürme",
      "PDF içeriğini düzenlenebilir Word (.docx) belgesine dönüştürün. Yazı tipleri, tablolar ve sayfa düzeni korunur; sonucu doğrudan Word'de düzenleyin.",
      ["pdf'den word'e", "pdf word dönüştürme", "pdf to word", "pdf'i word yapma", "pdf docx dönüştürme"],
      [
        { q: "PDF'i biçimi bozulmadan Word'e nasıl dönüştürürüm?", a: "PDF'inizi yükleyin; dönüştürücü yazı tiplerini, tabloları ve düzeni koruyarak düzenlenebilir bir .docx üretir." },
        { q: "Taranmış PDF'i Word'e çevirebilir miyim?", a: "Metin katmanı olan PDF'ler en iyi sonucu verir; taranmış belgelerde düzen yaklaşık olarak korunur." },
      ],
    ),
    en: T(
      "PDF to Word converter — keep formatting",
      "Convert PDF to Word (.docx) without losing fonts, tables, or layout. Fast, accurate PDF converter — free in your browser.",
      "PDF to Word",
      "Convert PDF content into an editable Word (.docx) document. Fonts, tables and page layout are preserved so you can edit directly in Word.",
      ["pdf to word", "pdf to docx", "convert pdf to word"],
      [
        { q: "Can I convert PDF to Word without losing formatting?", a: "Yes. Upload your PDF and the converter produces an editable .docx that preserves fonts, tables and layout." },
        { q: "Can I convert a scanned PDF to Word?", a: "PDFs with a text layer give the best results; for scans the layout is approximately preserved." },
      ],
    ),
  },

  "word-to-pdf": {
    tr: T(
      "Word'den PDF'e Dönüştürme — online ücretsiz",
      "Word belgelerini online PDF'e dönüştürün. Düzen ve yazı tipleri korunur — tarayıcıda hızlı ve ücretsiz Word'den PDF dönüşümü.",
      "Word'den PDF'e Dönüştürme",
      "DOC ve DOCX belgelerini baskıya hazır, her cihazda aynı görünen PDF'e dönüştürün. Yazı tipleri ve sayfa düzeni birebir korunur.",
      ["word'den pdf'e", "word pdf dönüştürme", "word to pdf", "docx pdf yapma"],
      [
        { q: "Word belgesini PDF'e nasıl dönüştürürüm?", a: "DOC/DOCX dosyanızı yükleyin ve dönüştür deyin. Düzen ve yazı tipleri korunarak PDF anında hazırlanır." },
        { q: "PDF her cihazda aynı görünür mü?", a: "Evet. PDF sabit düzenlidir; yazı tipleri gömülür ve belge tüm cihazlarda aynı görünür." },
      ],
    ),
    en: T(
      "Word to PDF converter online",
      "Convert Word documents to PDF online. Preserve layout and fonts — fast, free Word to PDF conversion in your browser.",
      "Word to PDF",
      "Convert DOC and DOCX documents into print-ready PDFs that look identical on every device. Fonts and page layout are preserved exactly.",
      ["word to pdf", "docx to pdf", "convert word to pdf"],
      [
        { q: "How do I convert a Word document to PDF?", a: "Upload your DOC/DOCX and click convert. The PDF is created instantly with layout and fonts preserved." },
        { q: "Will the PDF look the same on every device?", a: "Yes. PDF is fixed-layout; fonts are embedded and the document looks identical everywhere." },
      ],
    ),
  },

  "excel-to-pdf": {
    tr: T(
      "Excel'den PDF'e Dönüştürme — tabloları koru",
      "Excel tablolarınızı paylaşılabilir, baskıya hazır PDF'e dönüştürün. Hücreler ve düzen korunur — online ve ücretsiz.",
      "Excel'den PDF'e Dönüştürme",
      "XLS ve XLSX elektronik tablolarınızı, hücre düzeni ve biçimlendirme korunarak temiz PDF sayfalarına aktarın. Raporları kolayca paylaşın.",
      ["excel'den pdf'e", "excel pdf dönüştürme", "excel to pdf", "xlsx pdf yapma"],
      [
        { q: "Excel dosyasını PDF'e nasıl çeviririm?", a: "XLS/XLSX dosyanızı yükleyin; tablolar ve biçimlendirme korunarak paylaşıma hazır bir PDF oluşturulur." },
        { q: "Geniş tablolar düzgün sığar mı?", a: "Sayfa düzeni korunur; geniş tablolar baskı ayarlarına göre sayfalara bölünerek aktarılır." },
      ],
    ),
    en: T(
      "Excel to PDF converter online",
      "Convert Excel spreadsheets to shareable, print-ready PDF. Cells and layout preserved — free online tool.",
      "Excel to PDF",
      "Export XLS and XLSX spreadsheets to clean PDF pages with cell layout and formatting preserved. Share reports with anyone.",
      ["excel to pdf", "xlsx to pdf", "spreadsheet to pdf"],
      [
        { q: "How do I convert an Excel file to PDF?", a: "Upload your XLS/XLSX and a shareable PDF is created with tables and formatting preserved." },
        { q: "Do wide tables fit correctly?", a: "The layout is preserved; wide tables are split across pages based on print settings." },
      ],
    ),
  },

  "pdf-to-excel": {
    tr: T(
      "PDF'den Excel'e Dönüştürme — tabloları çıkar",
      "PDF tablolarını düzenlenebilir Excel dosyasına dönüştürün. Raporlama ve analiz için verileri .xlsx formatına aktarın.",
      "PDF'den Excel'e Dönüştürme",
      "PDF içindeki tabloları düzenlenebilir Excel (.xlsx) çıktısına aktarın. Raporlama, hesaplama ve analiz için verilerinizi tekrar kullanılabilir hale getirin.",
      ["pdf'den excel'e", "pdf excel dönüştürme", "pdf to excel", "pdf tablo çıkarma"],
      [
        { q: "PDF'teki tabloyu Excel'e nasıl aktarırım?", a: "PDF'inizi yükleyin; tablo verileri tespit edilerek düzenlenebilir bir .xlsx dosyasına dönüştürülür." },
        { q: "Çıkan verileri Excel'de düzenleyebilir miyim?", a: "Evet. Çıktı hücre bazlıdır; formül ekleyebilir, sıralayabilir ve analiz edebilirsiniz." },
      ],
    ),
    en: T(
      "PDF to Excel converter online",
      "Convert PDF tables to editable Excel spreadsheets. Extract data from PDFs into .xlsx for reporting and analysis.",
      "PDF to Excel",
      "Extract tables from a PDF into editable Excel (.xlsx) output. Make your data reusable for reporting, calculations and analysis.",
      ["pdf to excel", "pdf to xlsx", "extract pdf tables"],
      [
        { q: "How do I extract a table from PDF to Excel?", a: "Upload your PDF and the table data is detected and converted into an editable .xlsx file." },
        { q: "Can I edit the extracted data in Excel?", a: "Yes. The output is cell-based, so you can add formulas, sort and analyze it." },
      ],
    ),
  },

  "pdf-to-ppt": {
    tr: T(
      "PDF'den PowerPoint'e Dönüştürme",
      "PDF sunumlarını düzenlenebilir PowerPoint (.pptx) slaytlarına dönüştürün. Sunum içeriğini tekrar kullanın — online ve hızlı.",
      "PDF'den PowerPoint'e Dönüştürme",
      "PDF sayfalarını PowerPoint (.pptx) slaytlarına dönüştürün. Sunumlarınızı yeniden düzenlemek ve güncellemek için içeriği yeniden kullanılabilir hale getirin.",
      ["pdf'den powerpoint'e", "pdf ppt dönüştürme", "pdf to ppt", "pdf to powerpoint"],
      [
        { q: "PDF'i PowerPoint'e nasıl dönüştürürüm?", a: "PDF'inizi yükleyin; her sayfa bir slayda dönüştürülerek düzenlenebilir bir .pptx dosyası oluşturulur." },
        { q: "Slaytları sonradan düzenleyebilir miyim?", a: "Evet. Çıktı PowerPoint'te açılır ve metin/öğeler düzenlenebilir." },
      ],
    ),
    en: T(
      "PDF to PowerPoint converter",
      "Convert PDF presentations into editable PowerPoint (.pptx) slides. Reuse slide content — fast and online.",
      "PDF to PowerPoint",
      "Convert PDF pages into PowerPoint (.pptx) slides. Make presentation content reusable so you can restructure and update your decks.",
      ["pdf to ppt", "pdf to powerpoint", "pdf to pptx"],
      [
        { q: "How do I convert a PDF to PowerPoint?", a: "Upload your PDF; each page becomes a slide in an editable .pptx file." },
        { q: "Can I edit the slides afterwards?", a: "Yes. The output opens in PowerPoint with editable text and elements." },
      ],
    ),
  },

  "ppt-to-pdf": {
    tr: T(
      "PowerPoint'ten PDF'e Dönüştürme",
      "PPT ve PPTX sunumlarını tek bir PDF'e dönüştürün. Slaytlar her cihazda aynı görünür — online ve ücretsiz.",
      "PowerPoint'ten PDF'e Dönüştürme",
      "PPT/PPTX sunumlarınızı tek, taşınabilir bir PDF'e dönüştürün. Slayt tasarımı korunur; belgeyi her cihazda güvenle paylaşın.",
      ["powerpoint'ten pdf'e", "ppt pdf dönüştürme", "ppt to pdf", "sunum pdf yapma"],
      [
        { q: "PowerPoint sunumunu PDF'e nasıl çeviririm?", a: "PPT/PPTX dosyanızı yükleyin; tüm slaytlar tasarımı korunarak tek bir PDF'te toplanır." },
        { q: "Animasyonlar PDF'te görünür mü?", a: "PDF sabit düzenlidir; her slaydın son görünümü korunur, animasyonlar statik olarak yansır." },
      ],
    ),
    en: T(
      "PowerPoint to PDF converter",
      "Convert PPT and PPTX presentations into one PDF. Slides look the same on every device — free and online.",
      "PowerPoint to PDF",
      "Convert your PPT/PPTX presentations into a single portable PDF. Slide design is preserved so you can share it safely on any device.",
      ["ppt to pdf", "pptx to pdf", "presentation to pdf"],
      [
        { q: "How do I convert a PowerPoint to PDF?", a: "Upload your PPT/PPTX and all slides are combined into one PDF with the design preserved." },
        { q: "Do animations appear in the PDF?", a: "PDF is fixed-layout; each slide's final appearance is preserved, animations are flattened." },
      ],
    ),
  },

  "pdf-to-image": {
    tr: T(
      "PDF'den JPG'ye Dönüştürme — görsele çevir",
      "PDF sayfalarını yüksek çözünürlüklü JPG/PNG görsellerine dönüştürün. Her sayfayı ayrı görsel olarak indirin — online ücretsiz.",
      "PDF'den Görüntüye (JPG/PNG) Dönüştürme",
      "PDF sayfalarını yüksek kaliteli JPG veya PNG görsellerine dönüştürün. Her sayfa ayrı bir görsel olarak indirilir; sunum ve web kullanımı için idealdir.",
      ["pdf'den jpg'ye", "pdf'den görüntüye", "pdf to jpg", "pdf to image", "pdf png dönüştürme"],
      [
        { q: "PDF sayfalarını JPG'ye nasıl dönüştürürüm?", a: "PDF'inizi yükleyin; her sayfa yüksek çözünürlüklü bir JPG/PNG görseli olarak dışa aktarılır ve toplu indirilir." },
        { q: "Görsel çözünürlüğünü seçebilir miyim?", a: "Evet. Daha yüksek çözünürlük baskı ve yakınlaştırma için daha net görseller üretir." },
      ],
    ),
    en: T(
      "PDF to JPG — convert pages to images",
      "Convert PDF pages to high-resolution JPG/PNG images. Download each page as a separate image — free online.",
      "PDF to Image (JPG/PNG)",
      "Convert PDF pages into high-quality JPG or PNG images. Each page is downloaded as a separate image — ideal for slides and web use.",
      ["pdf to jpg", "pdf to image", "pdf to png", "convert pdf to image"],
      [
        { q: "How do I convert PDF pages to JPG?", a: "Upload your PDF; each page is exported as a high-resolution JPG/PNG image and downloaded together." },
        { q: "Can I choose the image resolution?", a: "Yes. Higher resolution produces sharper images for printing and zooming." },
      ],
    ),
  },

  "image-to-pdf": {
    tr: T(
      "JPG'den PDF'e Dönüştürme — görselleri ekle",
      "JPG, PNG ve WebP görsellerini tek bir PDF dosyasında toplayın. Fotoğraf ve taramaları PDF'e çevirin — online ve ücretsiz.",
      "Görüntüden (JPG/PNG) PDF'e Dönüştürme",
      "Birden fazla JPG, PNG veya WebP görselini tek bir PDF'te birleştirin. Sırayı düzenleyin; fotoğraf, tarama ve ekran görüntülerini paylaşıma hazır PDF yapın.",
      ["jpg'den pdf'e", "görüntüden pdf'e", "image to pdf", "jpg to pdf", "fotoğraf pdf yapma"],
      [
        { q: "Görselleri tek PDF'te nasıl birleştiririm?", a: "JPG/PNG/WebP dosyalarınızı yükleyin, sırayı düzenleyin ve tek bir PDF olarak indirin." },
        { q: "Görsel sırasını değiştirebilir miyim?", a: "Evet. Yüklediğiniz görselleri sürükleyerek istediğiniz sıraya dizebilirsiniz." },
      ],
    ),
    en: T(
      "JPG to PDF — combine images into PDF",
      "Combine JPG, PNG and WebP images into a single PDF file. Turn photos and scans into PDF — free and online.",
      "Image to PDF (JPG/PNG)",
      "Merge multiple JPG, PNG or WebP images into one PDF. Reorder them and turn photos, scans and screenshots into a shareable PDF.",
      ["jpg to pdf", "image to pdf", "png to pdf", "photos to pdf"],
      [
        { q: "How do I combine images into one PDF?", a: "Upload your JPG/PNG/WebP files, arrange the order, and download a single PDF." },
        { q: "Can I change the image order?", a: "Yes. Drag the uploaded images into any order you like." },
      ],
    ),
  },

  "html-to-pdf": {
    tr: T(
      "HTML'den PDF'e Dönüştürme — URL'yi PDF yap",
      "Web sayfası URL'sini veya HTML içeriğini sabit düzenli PDF'e dönüştürün. Sayfaları arşivleyin veya yazdırın — online ve hızlı.",
      "HTML / URL'den PDF'e Dönüştürme",
      "Bir web sayfası adresini (URL) veya HTML içeriğini, baskıya hazır sabit düzenli bir PDF'e dönüştürün. Sayfaları arşivleyin, paylaşın veya yazdırın.",
      ["html'den pdf'e", "url'den pdf'e", "html to pdf", "web sayfası pdf yapma"],
      [
        { q: "Bir web sayfasını PDF'e nasıl çeviririm?", a: "Sayfa adresini (URL) veya HTML içeriğini girin; sayfa render edilerek sabit düzenli bir PDF olarak indirilir." },
        { q: "Sayfa düzeni korunur mu?", a: "Evet. İçerik render edilip PDF'e yazıldığı için görünüm büyük ölçüde korunur." },
      ],
    ),
    en: T(
      "HTML to PDF — convert a URL to PDF",
      "Convert a web page URL or HTML content into a fixed-layout PDF. Archive or print pages — fast and online.",
      "HTML / URL to PDF",
      "Convert a web page address (URL) or HTML content into a print-ready, fixed-layout PDF. Archive, share or print pages.",
      ["html to pdf", "url to pdf", "web page to pdf"],
      [
        { q: "How do I convert a web page to PDF?", a: "Enter the page URL or HTML; the page is rendered and downloaded as a fixed-layout PDF." },
        { q: "Is the page layout preserved?", a: "Yes. Content is rendered and written to PDF, so the appearance is largely preserved." },
      ],
    ),
  },

  "unlock-pdf": {
    tr: T(
      "PDF Şifre Kaldırma — parolayı kaldır",
      "Parolasını bildiğiniz şifreli PDF'lerden korumayı kaldırın. Açma parolasını girin, kilidi açık PDF'i indirin — online.",
      "PDF Şifre Kaldırma",
      "Yetkili olduğunuz, açma parolasını bildiğiniz PDF'lerin şifre korumasını kaldırın. Kilidi açık belgeyi indirip serbestçe işleyin.",
      ["pdf şifre kaldırma", "pdf parola kaldırma", "pdf kilit açma", "unlock pdf"],
      [
        { q: "PDF parolasını nasıl kaldırırım?", a: "Şifreli PDF'inizi yükleyin, açma parolasını girin ve korumasız kopyayı indirin." },
        { q: "Parolayı bilmeden açabilir miyim?", a: "Hayır. Yalnızca açma parolasını bildiğiniz, yetkili olduğunuz belgelerde işlem yapılabilir." },
      ],
    ),
    en: T(
      "Unlock PDF — remove password",
      "Remove protection from password-protected PDFs you have the password for. Enter the open password and download an unlocked PDF.",
      "Unlock PDF",
      "Remove password protection from PDFs you are authorized for and know the open password to. Download the unlocked document and edit freely.",
      ["unlock pdf", "remove pdf password", "decrypt pdf"],
      [
        { q: "How do I remove a PDF password?", a: "Upload your protected PDF, enter the open password, and download an unprotected copy." },
        { q: "Can I open it without the password?", a: "No. The tool only works on documents you are authorized for and know the open password to." },
      ],
    ),
  },

  watermark: {
    tr: T(
      "PDF Filigran Ekleme — metin veya logo",
      "PDF'e metin veya görsel filigran ekleyin. Belgelerinizi 'GİZLİ', 'TASLAK' veya logonuzla işaretleyin — online ve ücretsiz.",
      "PDF Filigran Ekleme",
      "PDF sayfalarına metin veya görsel filigran ekleyin; rengi, yazı tipini ve konumu ayarlayın. Belgelerinizi telif, taslak veya gizlilik amacıyla işaretleyin.",
      ["pdf filigran ekleme", "pdf watermark", "pdf damgalama", "pdf'e logo ekleme"],
      [
        { q: "PDF'e nasıl filigran eklerim?", a: "PDF'inizi yükleyin, metin veya görsel filigranı seçin, renk ve konumu ayarlayıp indirin." },
        { q: "Filigran rengini değiştirebilir miyim?", a: "Evet. Metin rengi (#RRGGBB), yazı tipi ve şeffaflık ayarlanabilir." },
      ],
    ),
    en: T(
      "Add Watermark to PDF — text or logo",
      "Add a text or image watermark to your PDF. Mark documents as 'CONFIDENTIAL', 'DRAFT' or with your logo — free online.",
      "Add Watermark to PDF",
      "Add a text or image watermark across PDF pages and set the color, font and position. Mark documents for copyright, draft or confidentiality.",
      ["add watermark to pdf", "pdf watermark", "stamp pdf", "logo on pdf"],
      [
        { q: "How do I add a watermark to a PDF?", a: "Upload your PDF, choose a text or image watermark, set the color and position, and download." },
        { q: "Can I change the watermark color?", a: "Yes. Text color (#RRGGBB), font and opacity are adjustable." },
      ],
    ),
  },

  "page-numbers": {
    tr: T(
      "PDF Sayfa Numarası Ekleme",
      "PDF'e profesyonel sayfa numaraları ekleyin. Başlık veya dipnotta konum ve biçim seçin — online ve ücretsiz.",
      "PDF Sayfa Numarası Ekleme",
      "PDF belgenize okunaklı sayfa numaraları ekleyin. Numaraları üst bilgi veya alt bilgide konumlandırın; başlangıç değerini ve biçimini ayarlayın.",
      ["pdf sayfa numarası ekleme", "pdf numaralandırma", "pdf page numbers"],
      [
        { q: "PDF'e sayfa numarası nasıl eklerim?", a: "PDF'inizi yükleyin, numara konumunu (üst/alt) ve biçimini seçip indirin." },
        { q: "Belirli bir sayfadan başlatabilir miyim?", a: "Evet. Başlangıç numarasını ve hangi sayfadan başlayacağını ayarlayabilirsiniz." },
      ],
    ),
    en: T(
      "Add Page Numbers to PDF",
      "Add professional page numbers to your PDF. Choose position and format in the header or footer — free online tool.",
      "Add Page Numbers to PDF",
      "Stamp readable page numbers onto your PDF. Position numbers in the header or footer and set the starting value and format.",
      ["add page numbers to pdf", "number pdf pages", "pdf pagination"],
      [
        { q: "How do I add page numbers to a PDF?", a: "Upload your PDF, choose the number position (top/bottom) and format, and download." },
        { q: "Can I start from a specific page?", a: "Yes. Set the starting number and which page numbering begins on." },
      ],
    ),
  },

  "repair-pdf": {
    tr: T(
      "PDF Onarma — bozuk dosyayı kurtar",
      "Açılmayan veya bozuk PDF dosyalarını onarmayı deneyin. İçeriği yeniden paketleyip kurtarın — online ve ücretsiz.",
      "PDF Onarma",
      "Açılmayan, hasarlı veya bozuk PDF dosyalarını yeniden paketleyerek kurtarmayı deneyin. Erişilebilir içeriği yeni, geçerli bir PDF olarak indirin.",
      ["pdf onarma", "bozuk pdf düzeltme", "pdf kurtarma", "repair pdf"],
      [
        { q: "Bozuk bir PDF'i nasıl onarırım?", a: "Hasarlı PDF'inizi yükleyin; araç yapıyı yeniden paketleyerek kurtarılabilen içeriği yeni bir PDF olarak üretir." },
        { q: "Her bozuk PDF kurtarılabilir mi?", a: "Hasarın derecesine bağlıdır; çoğu durumda erişilebilir içerik başarıyla kurtarılır." },
      ],
    ),
    en: T(
      "Repair PDF — recover a corrupted file",
      "Try to repair PDFs that won't open or are corrupted. Re-package and recover the content — free and online.",
      "Repair PDF",
      "Try to recover PDFs that won't open or are damaged by re-packaging them. Download the accessible content as a new, valid PDF.",
      ["repair pdf", "fix corrupted pdf", "recover pdf"],
      [
        { q: "How do I repair a corrupted PDF?", a: "Upload the damaged PDF; the tool re-packages the structure and produces a new PDF from the recoverable content." },
        { q: "Can every corrupted PDF be recovered?", a: "It depends on the damage; in most cases the accessible content is recovered successfully." },
      ],
    ),
  },

  encrypt: {
    tr: T(
      "PDF Şifreleme — parola ile koruyun",
      "PDF'inize açılış parolası ekleyerek erişimi kısıtlayın. Hassas belgeleri şifreleyerek güvende tutun — online ve ücretsiz.",
      "PDF Şifreleme ve Parola Koruma",
      "PDF belgenize bir açılış parolası ekleyerek yetkisiz erişimi engelleyin. Sözleşme, fatura ve hassas belgelerinizi şifreleyerek güvenle paylaşın.",
      ["pdf şifreleme", "pdf parola koruma", "pdf'e şifre ekleme", "encrypt pdf"],
      [
        { q: "PDF'e nasıl parola eklerim?", a: "PDF'inizi yükleyin, bir açılış parolası belirleyin ve şifreli dosyayı indirin. Belge yalnızca parolayla açılır." },
        { q: "Şifreleme ne kadar güvenli?", a: "Belge endüstri standardı şifreleme ile korunur; parolayı yalnızca yetkili kişilerle paylaşın." },
      ],
    ),
    en: T(
      "Encrypt PDF — password protect your file",
      "Add an open password to your PDF to restrict access. Encrypt sensitive documents to keep them secure — free online.",
      "Encrypt & Password Protect PDF",
      "Add an open password to your PDF to block unauthorized access. Encrypt contracts, invoices and sensitive documents and share them safely.",
      ["encrypt pdf", "password protect pdf", "add password to pdf"],
      [
        { q: "How do I add a password to a PDF?", a: "Upload your PDF, set an open password, and download the encrypted file. The document only opens with the password." },
        { q: "How secure is the encryption?", a: "The document is protected with industry-standard encryption; share the password only with authorized people." },
      ],
    ),
  },

  "pdf-to-text": {
    tr: T(
      "PDF Metin Çıkarma — düz metne dönüştür",
      "PDF sayfalarındaki metni düz metin (.txt) dosyasına aktarın. İçeriği kopyalayın, arayın veya yeniden kullanın — online.",
      "PDF'ten Metin Çıkarma",
      "PDF sayfalarındaki metin katmanını düz metin (.txt) dosyasına aktarın. İçeriği kolayca kopyalayın, arayın, düzenleyin veya başka belgelerde kullanın.",
      ["pdf metin çıkarma", "pdf'ten metin alma", "pdf to text", "pdf txt dönüştürme"],
      [
        { q: "PDF'ten metni nasıl çıkarırım?", a: "PDF'inizi yükleyin; metin katmanı düz metin (.txt) olarak dışa aktarılır ve indirilir." },
        { q: "Taranmış PDF'ten metin çıkar mı?", a: "Metin katmanı olan PDF'ler en iyi sonucu verir; taranmış görüntülerde metin sınırlı olabilir." },
      ],
    ),
    en: T(
      "PDF to Text — extract plain text",
      "Extract text from PDF pages into a plain text (.txt) file. Copy, search and reuse the content — free online.",
      "Extract Text from PDF",
      "Export the text layer of PDF pages into a plain text (.txt) file. Easily copy, search, edit or reuse the content in other documents.",
      ["pdf to text", "extract text from pdf", "pdf to txt"],
      [
        { q: "How do I extract text from a PDF?", a: "Upload your PDF; the text layer is exported as a plain text (.txt) file and downloaded." },
        { q: "Does it extract text from scanned PDFs?", a: "PDFs with a text layer give the best results; scanned images may have limited text." },
      ],
    ),
  },

  "flatten-pdf": {
    tr: T(
      "PDF Düzleştirme — formları sabitle",
      "PDF form alanlarını ve açıklamaları sayfaya kalıcı olarak gömün. Düzenlenemez, sabit bir PDF oluşturun — online ve ücretsiz.",
      "PDF Düzleştirme",
      "Doldurulmuş form alanlarını, imzaları ve açıklamaları sayfaya kalıcı olarak gömün. İçeriğin değiştirilemediği, her yerde aynı görünen sabit bir PDF üretin.",
      ["pdf düzleştirme", "pdf flatten", "pdf form sabitleme", "pdf formları gömme"],
      [
        { q: "PDF'i neden düzleştirmeliyim?", a: "Düzleştirme, form alanlarını ve açıklamaları sayfaya gömerek içeriğin yanlışlıkla değiştirilmesini önler ve görünümü her cihazda sabitler." },
        { q: "Düzleştirilen form yeniden düzenlenebilir mi?", a: "Hayır. Düzleştirme kalıcıdır; alanlar artık ayrı ayrı düzenlenemez. Önce bir yedek almanız önerilir." },
      ],
    ),
    en: T(
      "Flatten PDF — lock in form fields",
      "Permanently embed PDF form fields and annotations into the page. Create a non-editable, fixed PDF — free online.",
      "Flatten PDF",
      "Permanently embed filled form fields, signatures and annotations into the page. Produce a fixed PDF whose content can't be changed and looks identical everywhere.",
      ["flatten pdf", "lock pdf form", "embed pdf annotations"],
      [
        { q: "Why should I flatten a PDF?", a: "Flattening embeds form fields and annotations into the page, preventing accidental edits and fixing the appearance on every device." },
        { q: "Can a flattened form be edited again?", a: "No. Flattening is permanent; fields can no longer be edited individually. Keep a backup first." },
      ],
    ),
  },
};

// ─── Landing / ana sayfa ──────────────────────────────────────────────────────
export const LANDING_SEO = {
  tr: {
    title: `PDF Birleştir, Dönüştür, Sıkıştır | ${BRAND}`,
    description:
      "PDF birleştirme, dönüştürme, sıkıştırma ve düzenleme işlemlerini tek platformda yapın. Kurulum gerekmez — tarayıcıdan çalışır. Masaüstü uygulaması çok yakında.",
    h1: "PDF Birleştir, Dönüştür, Sıkıştır ve Düzenle — Tüm PDF Araçları Tek Platformda",
    intro:
      "PDF PLATFORM; PDF birleştirme, ayırma, sıkıştırma, Word/Excel/PowerPoint dönüştürme, filigran, şifreleme ve daha fazlasını tek profesyonel platformda sunar. Kurulum gerekmez, tarayıcıdan çalışır; Windows masaüstü uygulaması çok yakında geliyor.",
    faq: [
      { q: "PDF dosyaları nasıl ücretsiz birleştirilir?", a: "PDF PLATFORM ile PDF dosyalarınızı tarayıcınızda ücretsiz olarak birleştirebilirsiniz. Dosyaları yükleyin, sayfa sırasını sürükleyerek düzenleyin ve birleştirilmiş PDF'i saniyeler içinde indirin — kurulum gerekmez." },
      { q: "PDF'i Word'e biçimlendirme kaybolmadan nasıl dönüştürebilirim?", a: "PDF PLATFORM'daki PDF dönüştürücü, PDF'i Word'e (.docx) çevirirken yazı tipleri, tablolar ve düzeni korur. Sonuç, düzenlemeye hazır tam anlamıyla düzenlenebilir bir belgedir." },
      { q: "PDF dosyasının boyutu nasıl küçültülür?", a: "PDF'inizi yükleyin, sıkıştırma seviyesini seçin ve optimize edilmiş dosyayı indirin. PDF PLATFORM, metin ve görselleri net tutarken dosya boyutunu e-posta ekleri ve portal yüklemeleri için küçültür." },
      { q: "Online PDF aracı kullanırken verilerim güvende mi?", a: "PDF PLATFORM işlenen belge içeriklerini saklamaz. Yakında çıkacak Windows uygulaması dosyaları tamamen cihazınızda işleyecek; PDF'leriniz hiçbir zaman bilgisayarınızdan çıkmayacak. Web sürümü ise tüm aktarımlar için şifreli bağlantı kullanır." },
      { q: "PDF PLATFORM yazılım yüklemeden çalışır mı?", a: "Evet. Web sürümü tamamen tarayıcınızda çalışır — kurulum veya eklenti gerekmez. Çevrimdışı kullanım ve yüksek hacimli işlemler için Windows masaüstü uygulaması çok yakında geliyor." },
    ],
  },
  en: {
    title: `Merge PDF, Convert, Compress & Edit | ${BRAND}`,
    description:
      "Merge PDF files, convert documents, compress and edit PDFs from one place. No installation needed — works right in your browser. A Windows desktop app is coming soon.",
    h1: "Merge PDF, Convert, Compress and Edit — All PDF Tools in One Place",
    intro:
      "PDF PLATFORM brings PDF merge, split, compress, Word/Excel/PowerPoint conversion, watermarking, encryption and more into one professional platform. No installation needed — it runs in your browser; a Windows desktop app is coming soon.",
    faq: [
      { q: "How do I merge PDF files online for free?", a: "With PDF PLATFORM you can merge PDF files directly in your browser at no cost. Upload your files, drag to reorder pages, and download the combined PDF in seconds — no installation required." },
      { q: "Can I convert PDF to Word without losing formatting?", a: "Yes. The PDF converter in PDF PLATFORM preserves fonts, tables, and layout when converting PDF to Word (.docx). The result is a fully editable document ready for further editing." },
      { q: "How do I compress a PDF to reduce its file size?", a: "Upload your PDF, choose a compression level, and download the optimized file. PDF PLATFORM reduces file size while keeping text and images sharp for email attachments and portal uploads." },
      { q: "Is my PDF data secure when using an online PDF tool?", a: "PDF PLATFORM does not retain processed document contents. The upcoming Windows app will process files entirely on your device — your PDFs never leave your machine. The web version uses secure, encrypted connections for all transfers." },
      { q: "Does PDF PLATFORM work without installing software?", a: "Yes. The web version runs entirely in your browser — no installation, no plugins. A Windows desktop app for offline use and higher-volume operations is coming soon." },
    ],
  },
};

// ─── Fiyatlandırma ────────────────────────────────────────────────────────────
export const PRICING_SEO = {
  tr: {
    title: `PDF Araçları Fiyatlandırma — 7 Gün İade Garantisi | ${BRAND}`,
    description:
      "PDF birleştirme, dönüştürme ve sıkıştırma araçları için planları inceleyin. 7 gün koşulsuz para iade garantisi. Ücretsiz başlayın, istediğiniz zaman iptal edin.",
    h1: "PDF PLATFORM Fiyatlandırma — Planlar ve Kredi Paketleri",
    intro:
      "Ücretsiz plan dahil aylık abonelik ve kredi paketi seçeneklerini karşılaştırın. Tüm planlar 7 gün koşulsuz para iade garantisiyle gelir; istediğiniz zaman iptal edebilirsiniz.",
  },
  en: {
    title: `PDF Tools Pricing — 7-Day Money-Back Guarantee | ${BRAND}`,
    description:
      "Explore plans for PDF merge, convert, and compress tools. 7-day money-back guarantee, cancel anytime. Start free today.",
    h1: "PDF PLATFORM Pricing — Plans and Credit Packs",
    intro:
      "Compare monthly subscriptions and credit packs, including a free plan. Every plan comes with a 7-day no-questions-asked money-back guarantee, and you can cancel anytime.",
  },
};

// ─── Hukuki sayfalar ──────────────────────────────────────────────────────────
export const LEGAL_SEO = {
  terms: {
    tr: {
      title: `Hizmet Şartları | ${BRAND}`,
      description: "PDF PLATFORM hizmet şartlarını okuyun.",
      h1: "Hizmet Şartları",
      intro: "PDF PLATFORM hizmetlerinin kullanımına ilişkin şartlar ve koşullar.",
    },
    en: {
      title: `Terms of Service | ${BRAND}`,
      description: "Read the terms of service for PDF PLATFORM.",
      h1: "Terms of Service",
      intro: "Terms and conditions for using PDF PLATFORM services.",
    },
  },
  privacy: {
    tr: {
      title: `Gizlilik Politikası | ${BRAND}`,
      description: "PDF PLATFORM gizlilik politikasını okuyun.",
      h1: "Gizlilik Politikası",
      intro: "Kişisel verilerinizin nasıl işlendiğine ve korunduğuna dair gizlilik politikamız.",
    },
    en: {
      title: `Privacy Policy | ${BRAND}`,
      description: "Read the privacy policy for PDF PLATFORM.",
      h1: "Privacy Policy",
      intro: "Our privacy policy on how your personal data is processed and protected.",
    },
  },
  kvkk: {
    tr: {
      title: `KVKK Aydınlatma Metni | ${BRAND}`,
      description:
        "PDF PLATFORM kişisel verilerin işlenmesine ilişkin KVKK aydınlatma metnini okuyun.",
      h1: "KVKK Aydınlatma Metni",
      intro: "6698 sayılı KVKK kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni.",
    },
    en: {
      title: `KVKK Notice | ${BRAND}`,
      description: "Read PDF PLATFORM's KVKK personal data processing notice.",
      h1: "KVKK Notice",
      intro: "Information notice on the processing of personal data under Turkish KVKK law (No. 6698).",
    },
  },
};

// ─── SoftwareApplication featureList ─────────────────────────────────────────
export const SOFTWARE_FEATURE_LIST = {
  tr: [
    "PDF birleştirme",
    "PDF ayırma",
    "PDF sıkıştırma",
    "PDF dönüştürme (Word, Excel, PowerPoint)",
    "PDF'den görüntüye ve görüntüden PDF'e",
    "PDF şifreleme ve parola koruma",
    "PDF filigran ve sayfa numarası ekleme",
    "PDF döndürme, sayfa silme ve düzenleme",
  ],
  en: [
    "Merge PDF",
    "Split PDF",
    "Compress PDF",
    "PDF conversion (Word, Excel, PowerPoint)",
    "PDF to image and image to PDF",
    "PDF encryption and password protection",
    "Add watermark and page numbers to PDF",
    "Rotate, delete and organize PDF pages",
  ],
};

/** Bir aracın belirli dildeki SEO içeriğini döndürür; bulunamazsa null. */
export function getToolSeo(slug, language) {
  const entry = TOOL_SEO[slug];
  if (!entry) return null;
  return entry[language] ?? entry.tr;
}
