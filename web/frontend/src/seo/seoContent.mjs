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

export const BRAND = "PDF Platform";

/** Markalı sosyal paylaşım görseli (1200×630 — WhatsApp/OG standardı).
 *  public/og-image.png — amblem + "PDF PLATFORM" + slogan + domain. */
export const DEFAULT_OG_IMAGE = "/og-image.png";
export const DEFAULT_OG_IMAGE_WIDTH = "1200";
export const DEFAULT_OG_IMAGE_HEIGHT = "630";

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
  "belge-tara",
  "aranabilir-pdf",
  "html-to-pdf",
  "unlock-pdf",
  "watermark",
  "page-numbers",
  "repair-pdf",
  "encrypt",
  "pdf-to-text",
  "flatten-pdf",
  "pdf-ozetle",
  "pdf-sohbet",
  "pdf-duzenle",
  "pdf-imzala",
  "pdf-yorumla",
  "taranmis-pdf-ocr",
  "pdf-veri-cikar",
  "pdf-ceviri",
  "ai-toplu-islem",
  "pdf-karsilastir",
  "hassas-veri-gizle",
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
      "Birden fazla PDF'i sürükle-bırak ile tek belgede birleştirin — üyelik veya kayıt gerekmez. Dosyalarınız sunucuya gitmeden tarayıcınızda işlenir (tamamen gizli), sonuç saniyeler içinde otomatik indirilir; 80 MB'a kadar ücretsiz ve sınırsız.",
      ["pdf birleştirme", "pdf birleştir", "pdf merge", "kayıt olmadan pdf birleştirme", "üyeliksiz pdf birleştirme", "iki pdf birleştirme"],
      [
        { q: "PDF dosyalarını üye olmadan, online ve ücretsiz nasıl birleştiririm?", a: "Dosyalarınızı sürükleyip bırakın, sırayı ayarlayın ve birleştir deyin. PDF'iniz sunucuya gönderilmeden cihazınızda birleştirilir ve saniyeler içinde otomatik indirilir — üyelik yok, kurulum yok." },
        { q: "Dosyalarım güvende mi?", a: "Evet — birleştirme tamamen tarayıcınızda (cihazınızda) yapılır. Dosyalarınız sunucuya hiç yüklenmez, bilgisayarınızdan çıkmaz; %100 gizlidir." },
      ],
    ),
    en: T(
      "Merge PDF files online — free",
      "Merge PDF files instantly in your browser. Combine multiple PDFs into one document — no installation, no sign-up required.",
      "Merge PDF",
      "Combine multiple PDFs into a single document with drag-and-drop ordering — no account or sign-up needed. Your files are processed in your browser (never uploaded to a server, fully private), and the result downloads automatically in seconds — free and unlimited up to 80 MB.",
      ["merge pdf", "combine pdf", "join pdf files", "merge pdf without signup", "merge pdf no upload", "merge pdf online"],
      [
        { q: "How do I merge PDF files without signing up, online and free?", a: "Drag and drop your files, set the order, and click merge. Your PDF is combined on your device — never sent to a server — and downloads automatically in seconds. No sign-up, no installation." },
        { q: "Are my files safe?", a: "Yes — merging happens entirely in your browser (on your device). Your files are never uploaded to a server and never leave your computer; it's 100% private." },
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
      "Birden fazla JPG, PNG veya WebP görselini tek bir PDF'te birleştirin — üyelik gerekmez. Görselleriniz sunucuya gitmeden tarayıcınızda işlenir (gizli); fotoğraf, tarama ve ekran görüntülerini saniyeler içinde ücretsiz PDF yapın.",
      ["jpg'den pdf'e", "görüntüden pdf'e", "image to pdf", "kayıt olmadan jpg pdf", "fotoğraf pdf yapma"],
      [
        { q: "Görselleri üye olmadan tek PDF'te nasıl birleştiririm?", a: "JPG/PNG/WebP dosyalarınızı sürükleyip bırakın, sırayı düzenleyin ve PDF olarak indirin. Görselleriniz cihazınızda işlenir, sunucuya gitmez — üyelik yok, ücretsiz." },
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

  "belge-tara": {
    tr: T(
      "Belge Tarama — Telefonla PDF'e Tara",
      "Telefonunuzun kamerasıyla belge tarayıp PDF yapın. Kenarlar otomatik bulunur, perspektif düzeltilir — uygulamasız, ücretsiz ve cihazınızda.",
      "Telefonla Belge Tarama — Ücretsiz PDF Tarayıcı",
      "Belgenizi telefon kameranızla tarayıp saniyeler içinde PDF yapın. Kenarlar otomatik bulunur ve perspektif düzeltilir; her şey cihazınızda işlenir — belgeniz sunucuya gitmez, uygulama kurmanız gerekmez. Çok sayfalı tarama, gölge temizleme ve aranabilir PDF (OCR) desteğiyle.",
      ["belge tarama", "pdf tara", "telefonla belge tarama", "belge tarayıcı", "pdf tarayıcı", "belge tarama ücretsiz", "kamera ile pdf", "camscanner alternatif"],
      [
        { q: "Telefonla belge taramak için uygulama gerekir mi?", a: "Hayır. Sayfayı telefon tarayıcınızda açıp «Belge Tara»ya dokunmanız yeterli; kamerayı belgeye doğrultun, kenarlar otomatik bulunur ve PDF oluşur. Kurulum veya üyelik gerekmez." },
        { q: "Taradığım belge sunucuya yüklenir mi?", a: "Hayır. Kamera görüntüsü, otomatik kenar tespiti ve PDF oluşturma tamamen cihazınızda çalışır; belgeniz internete gönderilmez." },
        { q: "Birden çok sayfayı tek PDF yapabilir miyim?", a: "Evet. Sayfaları arka arkaya tarayıp tek PDF'te birleştirebilirsiniz. Ücretsizde tek taramada 3 sayfa; sınırsız sayfa, gölge temizleme ve aranabilir PDF (OCR) Pro özellikleridir." },
      ],
    ),
    en: T(
      "Document Scanner — Scan to PDF with Phone",
      "Scan documents to PDF with your phone camera. Edges are detected automatically, perspective is corrected — no app, free and on your device.",
      "Scan Documents to PDF — Free Online Scanner",
      "Scan your document with your phone camera and turn it into a PDF in seconds. Edges are detected automatically and perspective is corrected; everything runs on your device — your document is never uploaded and there's no app to install. With multi-page scanning, shadow removal and searchable PDF (OCR).",
      ["document scanner", "scan to pdf", "scan document with phone", "pdf scanner", "free document scanner", "camera to pdf", "camscanner alternative"],
      [
        { q: "Do I need an app to scan documents with my phone?", a: "No. Just open the page in your phone browser and tap «Scan document»; point the camera at the document, edges are detected automatically and a PDF is created. No install or sign-up needed." },
        { q: "Is my scanned document uploaded to a server?", a: "No. The camera frame, automatic edge detection and PDF creation all run on your device; your document is never sent to the internet." },
        { q: "Can I make one PDF from several pages?", a: "Yes. Scan pages back-to-back and merge them into one PDF. Free allows 3 pages per scan; unlimited pages, shadow removal and searchable PDF (OCR) are Pro features." },
      ],
    ),
  },

  "aranabilir-pdf": {
    tr: T(
      "Aranabilir PDF — OCR ile PDF'i Aranabilir Yap",
      "Taranmış PDF veya görselleri OCR ile aranabilir PDF'e çevirin. Metni Ctrl+F ile arayın ve kopyalayın — Türkçe destekli, cihazınızda.",
      "Aranabilir PDF Oluşturma — OCR ile Metin Katmanı",
      "Taranmış bir PDF ya da belge fotoğrafı aslında bir resimdir; içinde arama yapılamaz. Bu araç, OCR ile metni tanıyıp görüntünün üzerine görünmez bir metin katmanı ekler — belge göze aynı görünür ama artık Ctrl+F ile aranabilir ve kopyalanabilir. Türkçe + İngilizce desteklenir ve işlem cihazınızda yapılır.",
      ["aranabilir pdf", "ocr pdf", "pdf ocr", "taranan pdf aranabilir", "pdf metin tanıma", "searchable pdf", "pdf aranabilir yapma", "taranmış pdf arama"],
      [
        { q: "Aranabilir PDF nasıl oluşturulur?", a: "Taranmış PDF'inizi veya belge görsellerinizi yükleyin; araç metni OCR ile tanıyıp görüntünün üzerine görünmez bir metin katmanı ekler. Oluşan PDF'te Ctrl+F ile arama yapabilir ve metni kopyalayabilirsiniz." },
        { q: "Türkçe karakterlerde çalışır mı?", a: "Evet. OCR Türkçe + İngilizce destekler; ş, ğ, ı, İ gibi karakterler doğru şekilde aranabilir metne dönüştürülür." },
        { q: "Belgem sunucuya gönderilir mi?", a: "Hayır. OCR ve metin katmanı gömme tamamen cihazınızda çalışır; belgeniz internete yüklenmez." },
      ],
    ),
    en: T(
      "Searchable PDF — Make a PDF Searchable with OCR",
      "Turn scanned PDFs or images into searchable PDFs with OCR. Search text with Ctrl+F and copy it — Turkish supported, on your device.",
      "Create a Searchable PDF with OCR",
      "A scanned PDF or a document photo is really an image; you can't search inside it. This tool recognizes the text with OCR and adds an invisible text layer over the image — the document looks the same but is now searchable with Ctrl+F and copyable. Turkish + English are supported and processing happens on your device.",
      ["searchable pdf", "ocr pdf", "make pdf searchable", "pdf ocr online", "scanned pdf to searchable", "pdf text recognition", "convert scan to searchable pdf"],
      [
        { q: "How do I create a searchable PDF?", a: "Upload your scanned PDF or document images; the tool recognizes the text with OCR and adds an invisible text layer over the image. In the resulting PDF you can search with Ctrl+F and copy text." },
        { q: "Does it work with Turkish characters?", a: "Yes. OCR supports Turkish + English; characters like ş, ğ, ı, İ are converted correctly into searchable text." },
        { q: "Is my document sent to a server?", a: "No. OCR and text-layer embedding run entirely on your device; your document is never uploaded." },
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

  "pdf-ozetle": {
    tr: T(
      "PDF Özetle — Yapay Zekâ ile PDF Özeti",
      "PDF'inizi yapay zekâ ile saniyeler içinde özetleyin. Taraflar, önemli tarihler, tutarlar ve çıkarımlarla profesyonel bir özet — ihale, sözleşme, rapor ve daha fazlası.",
      "Yapay Zekâ ile PDF Özetle",
      "Uzun raporu, sözleşmeyi ya da ihaleyi baştan sona okumadan; belgenin türünü tanıyıp taraflar, önemli tarihler, tutarlar ve sonuçlarla profesyonel bir özet çıkarın. Metin cihazınızda okunur; özet indirilebilir ve paylaşılabilir. Taranmış belgelerde OCR devreye girer.",
      ["pdf özetle", "pdf özetleme", "yapay zeka pdf özet", "ai ile pdf özeti", "belge özetleme", "sözleşme özetleme", "ihale özetleme"],
      [
        { q: "PDF nasıl yapay zekâ ile özetlenir?", a: "PDF'i yükleyin; araç belgeyi okur, türünü (ihale, sözleşme, akademik…) tanır ve taraflar, tarihler, tutarlar ve çıkarımlarla yapılandırılmış bir özet üretir." },
        { q: "Taranmış PDF'i özetleyebilir miyim?", a: "Evet. Taranmış/fotoğraf PDF'lerde OCR otomatik devreye girip yazıyı metne çevirir, ardından özet çıkarılır." },
      ],
    ),
    en: T(
      "Summarize PDF — AI PDF Summary",
      "Summarize your PDF with AI in seconds. A professional summary with parties, key dates, amounts and takeaways — tenders, contracts, reports and more.",
      "Summarize PDF with AI",
      "Get a professional summary of a long report, contract or tender without reading it end to end — the tool detects the document type and surfaces parties, key dates, amounts and conclusions. Text is read on your device; the summary can be downloaded or shared. Scanned documents are handled with OCR.",
      ["summarize pdf", "ai pdf summary", "pdf summarizer", "summarize contract", "document summary ai"],
      [
        { q: "How do I summarize a PDF with AI?", a: "Upload the PDF; the tool reads it, detects its type (tender, contract, academic…) and produces a structured summary with parties, dates, amounts and takeaways." },
        { q: "Can I summarize a scanned PDF?", a: "Yes. For scanned/image PDFs, OCR kicks in automatically to turn the image into text, then the summary is generated." },
      ],
    ),
  },

  "pdf-sohbet": {
    tr: T(
      "PDF ile Sohbet — Belgeye Soru Sor (Yapay Zekâ)",
      "PDF'inize doğal dille soru sorun, yapay zekâ yalnızca belgedeki bilgiye dayanarak anında yanıtlasın. Uzun belgelerden aradığınız cevabı okumadan bulun.",
      "PDF ile Sohbet Et",
      "Belgenize istediğiniz soruyu sohbet eder gibi sorun; yapay zekâ yalnızca belgedeki bilgiye dayanarak yanıtlar — uydurma yok. Uzun sözleşme, rapor veya kılavuzda aradığınızı okumadan bulun. Taranmış belgelerde OCR ile metin çıkarılır.",
      ["pdf ile sohbet", "pdf chat", "belgeye soru sor", "pdf soru cevap", "yapay zeka pdf sohbet"],
      [
        { q: "PDF ile sohbet nasıl çalışır?", a: "PDF'i yükleyin ve doğal dille soru sorun. Yapay zekâ yalnızca belgedeki bilgiye dayanarak yanıtlar; belgede yoksa 'belgede yok' der." },
        { q: "Yanıtlar güvenilir mi?", a: "Yanıtlar yalnızca yüklediğiniz belgeden gelir, uydurma yapılmaz. Böylece kaynağı belgeniz olan doğru cevaplar alırsınız." },
      ],
    ),
    en: T(
      "Chat with PDF — Ask Your Document (AI)",
      "Ask your PDF questions in plain language and let AI answer instantly, based only on the document. Find answers in long documents without reading them.",
      "Chat with your PDF",
      "Ask your document anything, conversationally; the AI answers based only on the document's content — no made-up facts. Find what you need in a long contract, report or manual without reading it. Scanned documents are read with OCR.",
      ["chat with pdf", "ask pdf questions", "pdf chat ai", "pdf q&a", "talk to pdf"],
      [
        { q: "How does chatting with a PDF work?", a: "Upload the PDF and ask questions in plain language. The AI answers based only on the document; if the answer isn't there, it says so." },
        { q: "Are the answers reliable?", a: "Answers come only from your uploaded document, with no fabrication — so you get accurate answers grounded in your file." },
      ],
    ),
  },

  "pdf-duzenle": {
    tr: T(
      "PDF Düzenle — Mevcut Metni Sil ve Değiştir (online)",
      "PDF'teki mevcut yazıyı gerçekten silin ve yerine yenisini yazın. Metin ekleyin, düzenleyin — Türkçe destekli, online ve kolay.",
      "PDF Düzenle — Metni Gerçekten Değiştir",
      "PDF'teki mevcut yazının üstüne kutu çizin; o metin gerçekten silinsin ve yerine yenisini yazın (örtme değil, gerçek düzenleme). Yeni metin de ekleyebilirsiniz. Türkçe karakterler tam desteklenir; sonucu düzenlenmiş PDF olarak indirin. Not: güvenli düzenleme için dosyanız sunucumuzda işlenir ve işlem biter bitmez silinir.",
      ["pdf düzenle", "pdf metni değiştir", "pdf yazı sil", "pdf metin düzenleme", "pdf'te metni değiştir", "online pdf editör", "pdf üzerinde yazı değiştirme"],
      [
        { q: "PDF'teki mevcut yazıyı nasıl silip değiştiririm?", a: "PDF'i yükleyin, editör tam ekran açılır. 'Metni Değiştir' ile değiştirmek istediğiniz yazının üstüne kutu çizin — o metin gelir, yenisini yazın (boş bırakırsanız silinir). «Tamam» → «PDF'i Hazırla» → indirin." },
        { q: "Metin gerçekten siliniyor mu, yoksa üstü mü örtülüyor?", a: "Gerçekten siliniyor. PyMuPDF redaction ile seçili bölgedeki metin PDF'ten kaldırılır (örtme değil), yerine yeni metin yazılır." },
        { q: "Dosyam güvende mi?", a: "Evet. Gerçek metin düzenleme için dosya güvenli sunucumuzda işlenir ve işlem biter bitmez silinir, saklanmaz. (Diğer araçlarımız cihazınızda çalışır.)" },
      ],
    ),
    en: T(
      "Edit PDF — Delete & Replace Existing Text (online)",
      "Truly delete existing text in a PDF and type a replacement. Add and edit text — online and easy.",
      "Edit PDF — Really Change the Text",
      "Draw a box over existing text in the PDF; it is truly deleted and you type a replacement (not a cover-up — real editing). You can also add new text. Download the edited PDF. Note: for secure editing your file is processed on our server and deleted right after.",
      ["edit pdf", "change pdf text", "delete text from pdf", "edit pdf text", "replace text in pdf", "online pdf editor"],
      [
        { q: "How do I delete and change existing text in a PDF?", a: "Upload the PDF and the editor opens full-screen. With 'Replace Text', draw a box over the text you want to change — it's captured, then type the new text (leave empty to delete). Click 'Done' → 'Prepare PDF' → download." },
        { q: "Is the text truly deleted or just covered?", a: "Truly deleted. Using PyMuPDF redaction, the text in the selected area is removed from the PDF (not covered), and new text is written in its place." },
        { q: "Is my file safe?", a: "Yes. For real text editing the file is processed on our secure server and deleted right after — never stored. (Our other tools run on your device.)" },
      ],
    ),
  },

  "pdf-imzala": {
    tr: T(
      "PDF İmzala — Online İmza Ekle (Üyeliksiz, Cihazda)",
      "PDF'e elektronik imza ekleyin: imzanızı çizin, yazın ya da görsel yükleyin; istediğiniz yere yerleştirin. İmzanız cihazınızdan çıkmaz — %100 gizli, üyeliksiz, ücretsiz.",
      "PDF'e İmza Ekle — Cihazında, Gizli",
      "Sözleşme, form ve belgeleri saniyeler içinde imzalayın. İmzanızı fareyle/parmağınızla çizin, adınızı el yazısı fontuyla yazın veya hazır imza görselinizi yükleyin; ardından PDF sayfasında istediğiniz yere sürükleyip boyutlandırın. Tüm işlem tarayıcınızda (cihazınızda) gerçekleşir — dosyanız ve imzanız sunucuya GİTMEZ. İmzalı PDF'i indirin.",
      ["pdf imzala", "pdf imza ekle", "online pdf imzalama", "elektronik imza pdf", "pdf'e imza", "belge imzalama", "ücretsiz pdf imza", "e-imza pdf"],
      [
        { q: "PDF'e nasıl imza eklerim?", a: "PDF'i yükleyin, «İmza Oluştur» ile imzanızı çizin/yazın/yükleyin, sonra sayfada istediğiniz yere tıklayıp yerleştirin. Sürükleyerek konumlandırın, köşeden boyutlandırın, «Uygula ve İndir» deyin." },
        { q: "İmzam ve dosyam sunucuya gidiyor mu?", a: "Hayır. İmzalama tamamen tarayıcınızda (cihazınızda) yapılır; PDF ve imza asla yüklenmez. %100 gizli ve üyeliksizdir." },
        { q: "Birden fazla sayfaya imza atabilir miyim?", a: "Evet. Farklı sayfaları seçip her birine imza/tarih yerleştirebilir, hepsini tek seferde uygulayabilirsiniz." },
      ],
    ),
    en: T(
      "Sign PDF — Add Your Signature Online (No Sign-up, On-device)",
      "Add an electronic signature to a PDF: draw, type or upload your signature and place it anywhere. Your signature never leaves your device — 100% private, no sign-up, free.",
      "Add a Signature to PDF — On Your Device, Private",
      "Sign contracts, forms and documents in seconds. Draw your signature with the mouse/finger, type your name in a handwriting font, or upload a signature image; then drag and resize it anywhere on the PDF page. Everything happens in your browser (on your device) — your file and signature are NEVER uploaded. Download the signed PDF.",
      ["sign pdf", "add signature to pdf", "online pdf signing", "electronic signature pdf", "esign pdf", "sign document online", "free pdf signature"],
      [
        { q: "How do I add a signature to a PDF?", a: "Upload the PDF, click 'Create signature' to draw/type/upload it, then click on the page to place it. Drag to position, resize from the corner, and click 'Apply & download'." },
        { q: "Do my signature and file get uploaded?", a: "No. Signing happens entirely in your browser (on your device); the PDF and signature are never uploaded. It's 100% private and needs no sign-up." },
        { q: "Can I sign multiple pages?", a: "Yes. Select different pages and place a signature/date on each, then apply them all at once." },
      ],
    ),
  },

  "pdf-yorumla": {
    tr: T(
      "PDF İşaretle — Vurgu, Not, Çizim Ekle (Üyeliksiz, Cihazda)",
      "PDF'e fosforlu kalemle vurgu, keçeli kalem çizimi, kutu, ok ve metin notu ekleyin. Yazı silinmeden üzerini işaretleyin. Her şey cihazınızda işlenir — %100 gizli, üyeliksiz, ücretsiz.",
      "PDF'e Vurgu, Not ve Çizim Ekle — Cihazında, Gizli",
      "Bir belgeyi incelerken önemli yerleri fosforlu kalemle işaretleyin, keçeli kalemle serbestçe çizin, kutu içine alın, ok çekin ve metin notu ekleyin. Fosforlu ve keçeli kalem yarı saydamdır; altındaki yazı okunmaya devam eder. Farklı renk ve kalınlık seçin, birden fazla sayfada çalışın. Tüm işlem tarayıcınızda (cihazınızda) gerçekleşir — dosyanız sunucuya GİTMEZ. İşaretli PDF'i indirin.",
      ["pdf yorumla", "pdf vurgu", "pdf işaretleme", "pdf fosforlu kalem", "pdf üzerine yazma", "pdf not ekleme", "pdf çizim", "pdf highlight türkçe"],
      [
        { q: "PDF'te yazının üzerini nasıl işaretlerim?", a: "PDF'i yükleyin, «Fosforlu» aracını seçin, bir renk seçip yazının üzerinde sürükleyin. Kalem yarı saydamdır, altındaki metin okunur kalır. «Uygula ve İndir» ile işaretli PDF'i indirin." },
        { q: "Yazının üzerini çizince metin silinir mi?", a: "Hayır. İşaretlemeler PDF'in üzerine eklenir; mevcut yazı asla silinmez veya değişmez. Fosforlu/keçeli kalem yarı saydam olduğundan alttaki yazı görünür kalır." },
        { q: "Dosyam sunucuya gidiyor mu?", a: "Hayır. Tüm işaretleme tarayıcınızda (cihazınızda) yapılır; PDF asla yüklenmez. %100 gizli ve üyeliksizdir." },
      ],
    ),
    en: T(
      "Markup PDF — Highlight, Note, Draw (No Sign-up, On-device)",
      "Add highlighter marks, freehand marker drawings, boxes, arrows and text notes to a PDF. Mark over text without erasing it. Everything runs on your device — 100% private, no sign-up, free.",
      "Add Highlights, Notes and Drawings to PDF — On Your Device, Private",
      "While reviewing a document, highlight the important parts with a marker, draw freely with a felt pen, box things in, draw arrows and add text notes. The highlighter and marker are semi-transparent, so the text underneath stays readable. Pick different colors and thicknesses, and work across multiple pages. Everything happens in your browser (on your device) — your file is NEVER uploaded. Download the annotated PDF.",
      ["annotate pdf", "highlight pdf", "pdf marker", "draw on pdf", "pdf comments", "pdf notes", "mark up pdf", "pdf highlighter"],
      [
        { q: "How do I highlight text in a PDF?", a: "Upload the PDF, pick the 'Marker' tool, choose a color and drag over the text. The marker is semi-transparent, so the underlying text stays readable. Click 'Apply & download' to get the annotated PDF." },
        { q: "Does drawing over text erase it?", a: "No. Annotations are drawn on top of the PDF; existing text is never removed or changed. The highlighter/marker is semi-transparent, so the text below stays visible." },
        { q: "Does my file get uploaded?", a: "No. All annotating happens in your browser (on your device); the PDF is never uploaded. It's 100% private and needs no sign-up." },
      ],
    ),
  },

  "taranmis-pdf-ocr": {
    tr: T(
      "Taranmış PDF'i Metne Çevir (OCR)",
      "Taranmış veya fotoğraf tabanlı PDF'lerdeki yazıyı OCR ile gerçek metne çevirin — Türkçe ve İngilizce destekli, tarayıcınızda ve ücretsiz.",
      "Taranmış PDF → Metin (OCR)",
      "Fotoğraf/tarama belgelerdeki yazı aslında resimdir; OCR bu yazıyı cihazınızda gerçek metne çevirir (Türkçe + İngilizce). Böylece gazete, tapu, fatura ve resmi evrakı özetleyebilir, arayabilir ve düzenleyebilirsiniz.",
      ["taranmış pdf metne çevir", "ocr pdf", "pdf ocr türkçe", "resimden metin", "taranmış belge okuma"],
      [
        { q: "Taranmış PDF'teki yazıyı nasıl metne çeviririm?", a: "PDF'i yükleyin; OCR sayfa görüntülerindeki yazıyı tarayıcınızda gerçek metne dönüştürür. Sonra özetleyebilir, arayabilir veya düzenleyebilirsiniz." },
        { q: "OCR hangi dilleri destekliyor?", a: "Türkçe ve İngilizce desteklenir. İşlem cihazınızda yapılır; belgeniz sunucuya yüklenmez." },
      ],
    ),
    en: T(
      "Scanned PDF to Text (OCR)",
      "Turn text inside scanned or photo-based PDFs into real text with OCR — Turkish and English, in your browser and free.",
      "Scanned PDF → Text (OCR)",
      "Text inside photo/scanned documents is actually an image; OCR converts it into real text on your device (Turkish + English). So you can summarize, search and edit invoices, official papers and more.",
      ["scanned pdf to text", "ocr pdf", "pdf ocr", "image to text pdf", "read scanned document"],
      [
        { q: "How do I convert a scanned PDF to text?", a: "Upload the PDF; OCR turns the text in the page images into real text in your browser. You can then summarize, search or edit it." },
        { q: "Which languages does OCR support?", a: "Turkish and English are supported. Processing happens on your device; your document is not uploaded to a server." },
      ],
    ),
  },

  "pdf-veri-cikar": {
    tr: T(
      "PDF Veri Çıkarma — Fatura ve Tablodan Veri (Yapay Zekâ)",
      "Fatura, ihale, sözleşme ya da tablodaki bilgileri yapay zekâ ile yapılandırılmış veriye çevirin: alanlar + satır kalemleri, tabloya dökün, CSV indirin.",
      "PDF'ten Veri Çıkar (Yapay Zekâ)",
      "Fatura, irsaliye, ihale ya da tablodaki bilgileri okumadan otomatik çıkarın: belge türü, fatura no, tarih, taraflar, vergi no, ara toplam, KDV, genel toplam ve satır kalemleri yapılandırılmış veri olarak gelir. Sonucu tabloda görün, CSV veya JSON olarak dışa aktarın. Metin cihazınızda okunur; taranmış belgelerde OCR devreye girer.",
      ["pdf veri çıkarma", "faturadan veri çıkarma", "pdf tablo çıkarma", "pdf'ten excel", "fatura okuma yapay zeka", "pdf veri ayıklama", "belgeden veri çıkarma"],
      [
        { q: "Faturadan veri nasıl çıkarılır?", a: "PDF'i yükleyin; yapay zekâ belge türünü tanır ve fatura no, tarih, taraflar, toplam, KDV gibi alanları ve satır kalemlerini yapılandırılmış olarak çıkarır. CSV/JSON indirebilirsiniz." },
        { q: "Birden çok faturayı tek tabloya alabilir miyim?", a: "Evet. «AI Toplu İşlem» aracıyla onlarca faturayı işleyip hepsini tek bir CSV tablosunda birleştirebilirsiniz." },
      ],
    ),
    en: T(
      "PDF Data Extraction — Invoices & Tables (AI)",
      "Turn invoices, tenders, contracts or tables into structured data with AI: fields + line items, view as a table, export CSV.",
      "Extract Data from PDF (AI)",
      "Extract information from invoices, delivery notes, tenders or tables automatically: document type, invoice no, date, parties, tax id, subtotal, VAT, total and line items come back as structured data. View it as a table and export CSV or JSON. Text is read on your device; scanned documents are handled with OCR.",
      ["pdf data extraction", "extract data from invoice", "pdf table extraction", "pdf to excel data", "invoice parsing ai", "document data extraction"],
      [
        { q: "How do I extract data from an invoice?", a: "Upload the PDF; the AI detects the document type and extracts fields like invoice no, date, parties, total, VAT and line items as structured data. You can download CSV/JSON." },
        { q: "Can I extract many invoices into one table?", a: "Yes. With the «AI Batch» tool you can process dozens of invoices and merge them all into a single CSV table." },
      ],
    ),
  },

  "pdf-ceviri": {
    tr: T(
      "PDF Çeviri — PDF'i Yapay Zekâ ile Çevir (12+ Dil)",
      "PDF belgenizi yapay zekâ ile istediğiniz dile çevirin — anlam, ton ve yapı korunur. İngilizce, Almanca, Fransızca, Arapça ve daha fazlası; sonucu PDF indirin.",
      "PDF'i Yapay Zekâ ile Çevir",
      "PDF belgenizi 12'den fazla dile çevirin; başlık, liste ve tablolar korunur, sayı ve tarihler bozulmaz. İngilizce, Türkçe, Almanca, Fransızca, İspanyolca, Arapça, Rusça ve daha fazlası. Metin cihazınızda okunur; çeviriyi düzgün bir PDF olarak indirin.",
      ["pdf çeviri", "pdf çevir", "pdf tercüme", "belge çevirisi", "yapay zeka pdf çeviri", "ingilizce pdf çevir", "pdf dil çevirme"],
      [
        { q: "PDF nasıl başka dile çevrilir?", a: "PDF'i yükleyin, hedef dili seçin ve «Çevir» deyin. Yapay zekâ belgeyi anlam ve yapısını koruyarak çevirir; sonucu PDF olarak indirebilirsiniz." },
        { q: "Çeviride belgenin düzeni korunur mu?", a: "Evet. Başlıklar, listeler ve tablolar korunarak çevrilir; sayı, tarih ve özel isimler olduğu gibi kalır." },
      ],
    ),
    en: T(
      "Translate PDF — Translate PDF with AI (12+ Languages)",
      "Translate your PDF into any language with AI — meaning, tone and structure preserved. English, German, French, Arabic and more; download the result as PDF.",
      "Translate PDF with AI",
      "Translate your PDF into 12+ languages; headings, lists and tables are preserved and numbers/dates stay intact. English, Turkish, German, French, Spanish, Arabic, Russian and more. Text is read on your device; download the translation as a clean PDF.",
      ["translate pdf", "pdf translator", "translate pdf online", "document translation ai", "translate pdf to english", "ai pdf translation"],
      [
        { q: "How do I translate a PDF into another language?", a: "Upload the PDF, pick a target language and click 'Translate'. The AI translates while preserving meaning and structure; you can download the result as a PDF." },
        { q: "Is the layout preserved in translation?", a: "Yes. Headings, lists and tables are kept, and numbers, dates and proper nouns stay intact." },
      ],
    ),
  },

  "hassas-veri-gizle": {
    tr: T(
      "PDF'te Hassas Veri Gizleme (Redaction) — KVKK Dostu",
      "PDF'teki kişisel/hassas verileri (TC, IBAN, telefon, e-posta, isim, adres) bulup kalıcı olarak kaldırın — örtme değil, gerçek redaction. KVKK uyumlu paylaşım için.",
      "PDF'te Hassas Veriyi Gizle (Redaction)",
      "Bir belgeyi paylaşmadan önce kişisel verileri kaldırmak KVKK açısından kritiktir. Bu araç TC kimlik, IBAN, telefon ve e-postayı cihazınızda otomatik bulur; isim ve adresleri yapay zekâ ile tespit eder. Onayladığınız bilgiler PDF'ten GERÇEKTEN silinir (üstü örtülmez), böylece PDF'in ham verisinden bile okunamaz.",
      ["pdf hassas veri gizleme", "pdf redaction", "kvkk pdf", "pdf'te tc gizleme", "pdf kişisel veri kaldırma", "pdf karartma", "belgeden bilgi silme"],
      [
        { q: "PDF'teki hassas veri nasıl gizlenir?", a: "PDF'i yükleyin; araç TC/IBAN/telefon/e-postayı cihazınızda, isim/adresi yapay zekâ ile bulur. Onayladıklarınız sunucuda gerçek redaction ile PDF'ten kalıcı kaldırılır." },
        { q: "Veriler gerçekten siliniyor mu, üstü mü örtülüyor?", a: "Gerçekten siliniyor. PyMuPDF redaction ile veri PDF'in içeriğinden kaldırılır; üstüne siyah kutu konulup altında metin kalması gibi bir durum olmaz." },
        { q: "KVKK için uygun mu?", a: "Kişisel verileri kalıcı olarak kaldırmanıza yardımcı olur. Yine de kritik belgelerde sonucu gözden geçirmeniz ve kurumsal veri politikanıza uymanız önerilir." },
      ],
    ),
    en: T(
      "Redact Sensitive Data in PDF — GDPR/KVKK Friendly",
      "Find and permanently remove personal/sensitive data (ID, IBAN, phone, email, names, addresses) from a PDF — true redaction, not just covering.",
      "Redact Sensitive Data in a PDF",
      "Removing personal data before sharing a document is critical for privacy compliance. This tool auto-detects national ID, IBAN, phone and email on your device and finds names/addresses with AI. What you confirm is truly removed from the PDF (not covered), so it can't be read even from the raw data.",
      ["pdf redaction", "redact pdf", "remove sensitive data pdf", "gdpr pdf", "hide personal data pdf", "black out pdf text"],
      [
        { q: "How do I redact sensitive data in a PDF?", a: "Upload the PDF; the tool finds ID/IBAN/phone/email on your device and names/addresses with AI. What you confirm is permanently removed via true server-side redaction." },
        { q: "Is the data truly removed or just covered?", a: "Truly removed. With PyMuPDF redaction the data is stripped from the PDF's content; there's no black box with readable text underneath." },
        { q: "Is it suitable for GDPR/KVKK?", a: "It helps you permanently remove personal data. Still, review the result on critical documents and follow your organization's data policy." },
      ],
    ),
  },

  "pdf-karsilastir": {
    tr: T(
      "PDF Karşılaştırma — İki Belgenin Farkını Bul (Yapay Zekâ)",
      "İki PDF'i (ör. sözleşmenin iki sürümü) yapay zekâ ile karşılaştırın; eklenen, çıkarılan ve değişen maddeleri saniyeler içinde çıkarın.",
      "İki PDF'i Yapay Zekâ ile Karşılaştır",
      "Bir sözleşmenin, teklifin ya da raporun iki sürümü arasındaki anlamlı farkları elle satır satır aramadan bulun. Yapay zekâ; eklenen, çıkarılan ve değişen maddeleri (özellikle tutar, tarih, süre, yükümlülük gibi bağlayıcı değişiklikleri) çıkarır. Metin cihazınızda okunur.",
      ["pdf karşılaştırma", "iki pdf karşılaştır", "belge karşılaştırma", "sözleşme karşılaştırma", "pdf fark bulma", "pdf diff"],
      [
        { q: "İki PDF nasıl karşılaştırılır?", a: "İki belgeyi (A: eski, B: yeni) yükleyin; yapay zekâ eklenen, çıkarılan ve değişen maddeleri çıkarır ve renk kodlu olarak listeler." },
        { q: "Hangi farkları yakalar?", a: "Özellikle bağlayıcı değişiklikleri: tutar, tarih, süre, taraf, yükümlülük ve ceza maddelerini. Biçimsel/önemsiz farkları yok sayar." },
      ],
    ),
    en: T(
      "Compare PDFs — Find the Difference Between Two Documents (AI)",
      "Compare two PDFs (e.g. two versions of a contract) with AI; extract added, removed and changed clauses in seconds.",
      "Compare Two PDFs with AI",
      "Find the meaningful differences between two versions of a contract, proposal or report without scanning line by line. AI extracts added, removed and changed clauses — especially binding changes to amounts, dates, terms and obligations. Text is read on your device.",
      ["compare pdf", "pdf comparison", "compare two pdfs", "document comparison", "contract comparison", "pdf diff"],
      [
        { q: "How do I compare two PDFs?", a: "Upload two documents (A: old, B: new); the AI extracts added, removed and changed clauses and lists them color-coded." },
        { q: "Which differences does it catch?", a: "Especially binding changes: amounts, dates, terms, parties, obligations and penalties. It ignores trivial/formatting differences." },
      ],
    ),
  },

  "ai-toplu-islem": {
    tr: T(
      "AI Toplu İşlem — Çok Sayıda PDF'i Tek Seferde İşle",
      "Onlarca PDF'i tek seferde yapay zekâ ile işleyin: her belgeyi özetleyin, verisini çıkarın veya çevirin; sonuçları tek CSV/PDF olarak indirin.",
      "PDF'leri Toplu İşle (Yapay Zekâ)",
      "Bir klasör dolusu PDF'i tek seferde işleyin: her faturayı, sözleşmeyi ya da raporu özetleyin, verisini çıkarın veya çevirin. Onlarca faturanın verisini tek bir CSV tablosunda birleştirin. Metin cihazınızda okunur; dosya başına ilerleme gösterilir.",
      ["toplu pdf işleme", "çoklu pdf özet", "toplu fatura okuma", "çoklu pdf çeviri", "pdf toplu veri çıkarma", "birden fazla pdf işleme"],
      [
        { q: "Birden çok PDF'i tek seferde nasıl işlerim?", a: "PDF'leri toplu yükleyin, işlemi (özet / veri çıkar / çeviri) seçin ve başlatın. Her dosya sırayla işlenir; sonuçları tek CSV veya PDF olarak indirebilirsiniz." },
        { q: "Faturaları tek tabloda birleştirebilir miyim?", a: "Evet. Veri çıkarma modunda tüm faturaların alanları birleştirilip, her satırı bir dosya olan tek bir CSV tablosu oluşturulur." },
      ],
    ),
    en: T(
      "AI Batch — Process Many PDFs at Once",
      "Process dozens of PDFs at once with AI: summarize, extract data or translate each; export results as one CSV/PDF.",
      "Batch Process PDFs (AI)",
      "Process a whole folder of PDFs at once: summarize, extract data from or translate each invoice, contract or report. Merge the data of dozens of invoices into a single CSV table. Text is read on your device; per-file progress is shown.",
      ["batch pdf processing", "bulk pdf summary", "batch invoice extraction", "multiple pdf translation", "bulk pdf data extraction", "process multiple pdfs"],
      [
        { q: "How do I process multiple PDFs at once?", a: "Upload the PDFs in bulk, choose the operation (summarize / extract / translate) and start. Each file is processed in turn; you can export the results as one CSV or PDF." },
        { q: "Can I merge invoices into one table?", a: "Yes. In extract mode, the fields of all invoices are merged into a single CSV table with one row per file." },
      ],
    ),
  },
};

// ─── Landing / ana sayfa ──────────────────────────────────────────────────────
export const LANDING_SEO = {
  tr: {
    title: `PDF Birleştir, Dönüştür, Sıkıştır | ${BRAND}`,
    description:
      "PDF birleştir, dönüştür, sıkıştır — üyeliksiz ve ücretsiz. Birleştirme ve görselden PDF tarayıcınızda, dosyalarınız cihazınızdan çıkmadan çalışır; kurulum yok.",
    h1: "PDF Birleştir, Dönüştür, Sıkıştır ve Düzenle — Tüm PDF Araçları Tek Platformda",
    intro:
      "PDF Platform; PDF birleştirme, ayırma, sıkıştırma, Word/Excel/PowerPoint dönüştürme, filigran ve şifrelemeyi tek platformda sunar. Birleştirme ve görselden PDF gibi araçlar üyelik gerektirmeden, tamamen tarayıcınızda çalışır — dosyalarınız cihazınızdan hiç çıkmaz, anında ve 80 MB'a kadar ücretsizdir. Kurulum gerekmez.",
    faq: [
      { q: "PDF birleştirmek için üye olmam gerekiyor mu?", a: "Hayır. Birleştirme, görselden PDF gibi temel araçları üyelik veya kayıt olmadan, ücretsiz ve sınırsız kullanabilirsiniz. Üyelik yalnızca işlem geçmişini kaydetmek, Word/Excel dönüştürme ve OCR gibi gelişmiş araçlar ve daha büyük dosyalar için gerekir." },
      { q: "Dosyalarım güvende mi? Sunucuya yükleniyor mu?", a: "Birleştirme ve görselden PDF gibi araçlarda dosyalarınız tamamen TARAYICINIZDA (cihazınızda) işlenir — sunucuya hiç gönderilmez, bilgisayarınızdan çıkmaz, %100 gizlidir. Sunucu gerektiren dönüştürme gibi işlemlerde ise içerik saklanmaz ve şifreli bağlantı kullanılır." },
      { q: "PDF dosyaları nasıl ücretsiz birleştirilir?", a: "Dosyalarınızı sürükleyip bırakın, sırayı ayarlayın ve birleştir deyin. Birleştirilmiş PDF saniyeler içinde, cihazınızda hazırlanır ve otomatik indirilir — üyelik yok, kurulum yok, dosyanız sunucuya gitmez." },
      { q: "PDF'i Word'e biçimlendirme kaybolmadan nasıl dönüştürebilirim?", a: "PDF Platform'daki PDF dönüştürücü, PDF'i Word'e (.docx) çevirirken yazı tipleri, tablolar ve düzeni korur. Sonuç, düzenlemeye hazır tam anlamıyla düzenlenebilir bir belgedir." },
      { q: "PDF dosyasının boyutu nasıl küçültülür?", a: "PDF'inizi yükleyin, sıkıştırma seviyesini seçin ve optimize edilmiş dosyayı indirin. PDF Platform, metin ve görselleri net tutarken dosya boyutunu e-posta ekleri ve portal yüklemeleri için küçültür." },
      { q: "PDF Platform yazılım yüklemeden çalışır mı?", a: "Evet. Web sürümü tamamen tarayıcınızda çalışır — kurulum veya eklenti gerekmez. Birleştirme gibi araçlar dosyanızı cihazınızda işler; çevrimdışı kullanım için Windows masaüstü uygulaması çok yakında geliyor." },
    ],
  },
  en: {
    title: `Merge PDF, Convert, Compress & Edit | ${BRAND}`,
    description:
      "Merge PDF, convert, compress — free and no sign-up. Merge and image-to-PDF run in your browser; your files never leave your device. No installation.",
    h1: "Merge PDF, Convert, Compress and Edit — All PDF Tools in One Place",
    intro:
      "PDF Platform brings PDF merge, split, compress, Word/Excel/PowerPoint conversion, watermarking and encryption into one platform. Tools like merge and image-to-PDF need no account and run entirely in your browser — your files never leave your device, processing is instant and free up to 80 MB. No installation required.",
    faq: [
      { q: "Do I need an account to merge PDF files?", a: "No. You can use basic tools like merge and image-to-PDF for free and without any sign-up or account. An account is only needed to save your history, for advanced server tools like Word/Excel conversion and OCR, and for larger files." },
      { q: "Are my files safe? Are they uploaded to a server?", a: "For tools like merge and image-to-PDF your files are processed entirely IN YOUR BROWSER (on your device) — they are never sent to a server and never leave your computer, so they're 100% private. Server-based tools like conversion don't retain content and use encrypted connections." },
      { q: "How do I merge PDF files online for free?", a: "Drag and drop your files, set the order, and click merge. The combined PDF is prepared on your device in seconds and downloads automatically — no sign-up, no installation, your file never goes to a server." },
      { q: "Can I convert PDF to Word without losing formatting?", a: "Yes. The PDF converter in PDF Platform preserves fonts, tables, and layout when converting PDF to Word (.docx). The result is a fully editable document ready for further editing." },
      { q: "How do I compress a PDF to reduce its file size?", a: "Upload your PDF, choose a compression level, and download the optimized file. PDF Platform reduces file size while keeping text and images sharp for email attachments and portal uploads." },
      { q: "Does PDF Platform work without installing software?", a: "Yes. The web version runs entirely in your browser — no installation, no plugins. Tools like merge process your file on your device; a Windows desktop app for offline use is coming soon." },
    ],
  },
};

// ─── Fiyatlandırma ────────────────────────────────────────────────────────────
export const PRICING_SEO = {
  tr: {
    title: `PDF Araçları Fiyatlandırma — 7 Gün İade Garantisi | ${BRAND}`,
    description:
      "PDF birleştirme, dönüştürme ve sıkıştırma araçları için planları inceleyin. 7 gün koşulsuz para iade garantisi. Ücretsiz başlayın, istediğiniz zaman iptal edin.",
    h1: "PDF Platform Fiyatlandırma — Planlar ve Kredi Paketleri",
    intro:
      "Ücretsiz plan dahil aylık abonelik ve kredi paketi seçeneklerini karşılaştırın. Tüm planlar 7 gün koşulsuz para iade garantisiyle gelir; istediğiniz zaman iptal edebilirsiniz.",
  },
  en: {
    title: `PDF Tools Pricing — 7-Day Money-Back Guarantee | ${BRAND}`,
    description:
      "Explore plans for PDF merge, convert, and compress tools. 7-day money-back guarantee, cancel anytime. Start free today.",
    h1: "PDF Platform Pricing — Plans and Credit Packs",
    intro:
      "Compare monthly subscriptions and credit packs, including a free plan. Every plan comes with a 7-day no-questions-asked money-back guarantee, and you can cancel anytime.",
  },
};

// ─── Geliştirici API landing ──────────────────────────────────────────────────
export const API_SEO = {
  tr: {
    title: `PDF & Yapay Zekâ API — Belge İşlemeyi Yazılımınıza Gömün | ${BRAND}`,
    description:
      "PDF veri çıkarma, özetleme ve çeviriyi tek API ile kendi yazılımınıza entegre edin. Fatura okuma, sözleşme özeti, belge çevirisi — yapılandırılmış JSON, API anahtarıyla.",
    h1: "PDF & Yapay Zekâ API — Geliştiriciler İçin",
    intro:
      "PDF Platform API'siyle belge işlemeyi kendi ürününüze gömün: fatura/tablo verisi çıkarın, uzun belgeleri özetleyin, 12+ dile çevirin. API anahtarı alın, /v1 uçlarını çağırın, yapılandırılmış JSON alın. Kullanım kredi bazlıdır.",
    keywords: ["pdf api", "belge işleme api", "fatura okuma api", "pdf veri çıkarma api", "yapay zeka pdf api", "pdf özetleme api", "document ai api"],
    faq: [
      { q: "PDF Platform API'si ne yapar?", a: "PDF/belge metninden yapılandırılmış veri çıkarma, özetleme ve çeviriyi programatik sunar. /v1 uçlarını API anahtarınızla çağırır, JSON yanıt alırsınız." },
      { q: "Nasıl başlarım?", a: "Hesap açın, panelden bir API anahtarı üretin ve /v1/extract, /v1/summarize, /v1/translate uçlarını çağırın. Her istek AI kredinizden düşer." },
      { q: "Faturalandırma nasıl?", a: "Kullanım kredi bazlıdır: kredi paketi (top-up) alır, her API çağrısında 1 kredi harcarsınız. Fatura otomatik kesilir." },
    ],
  },
  en: {
    title: `PDF & AI API — Embed Document Processing in Your Software | ${BRAND}`,
    description:
      "Integrate PDF data extraction, summarization and translation into your own software with one API. Invoice parsing, contract summaries, document translation — structured JSON, with an API key.",
    h1: "PDF & AI API — For Developers",
    intro:
      "Embed document processing into your product with the PDF Platform API: extract invoice/table data, summarize long documents, translate to 12+ languages. Get an API key, call the /v1 endpoints, receive structured JSON. Usage is credit-based.",
    keywords: ["pdf api", "document processing api", "invoice extraction api", "pdf data extraction api", "document ai api", "pdf summarization api"],
    faq: [
      { q: "What does the PDF Platform API do?", a: "It offers programmatic structured-data extraction, summarization and translation from PDF/document text. Call the /v1 endpoints with your API key and get JSON responses." },
      { q: "How do I get started?", a: "Create an account, generate an API key from the dashboard, and call /v1/extract, /v1/summarize, /v1/translate. Each request uses one AI credit." },
      { q: "How is it billed?", a: "Usage is credit-based: buy a credit pack (top-up) and spend 1 credit per API call. Invoices are issued automatically." },
    ],
  },
};

// ─── Hukuki sayfalar ──────────────────────────────────────────────────────────
export const LEGAL_SEO = {
  terms: {
    tr: {
      title: `Hizmet Şartları | ${BRAND}`,
      description: "PDF Platform hizmet şartlarını okuyun.",
      h1: "Hizmet Şartları",
      intro: "PDF Platform hizmetlerinin kullanımına ilişkin şartlar ve koşullar.",
    },
    en: {
      title: `Terms of Service | ${BRAND}`,
      description: "Read the terms of service for PDF Platform.",
      h1: "Terms of Service",
      intro: "Terms and conditions for using PDF Platform services.",
    },
  },
  privacy: {
    tr: {
      title: `Gizlilik Politikası | ${BRAND}`,
      description: "PDF Platform gizlilik politikasını okuyun.",
      h1: "Gizlilik Politikası",
      intro: "Kişisel verilerinizin nasıl işlendiğine ve korunduğuna dair gizlilik politikamız.",
    },
    en: {
      title: `Privacy Policy | ${BRAND}`,
      description: "Read the privacy policy for PDF Platform.",
      h1: "Privacy Policy",
      intro: "Our privacy policy on how your personal data is processed and protected.",
    },
  },
  kvkk: {
    tr: {
      title: `KVKK Aydınlatma Metni | ${BRAND}`,
      description:
        "PDF Platform kişisel verilerin işlenmesine ilişkin KVKK aydınlatma metnini okuyun.",
      h1: "KVKK Aydınlatma Metni",
      intro: "6698 sayılı KVKK kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni.",
    },
    en: {
      title: `KVKK Notice | ${BRAND}`,
      description: "Read PDF Platform's KVKK personal data processing notice.",
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

// ─── Tematik iç linkleme (SEO prerender + React SPA ortak kaynağı) ─────────────

/** Araç slug → tematik ilgili araçlar (curated iç link). */
export const RELATED_TOOLS = {
  "split-pdf": ["merge-pdf", "organize-pdf", "delete-pages", "rotate-pdf"],
  "merge-pdf": ["split-pdf", "organize-pdf", "compress", "page-numbers"],
  "delete-pages": ["organize-pdf", "split-pdf", "rotate-pdf", "merge-pdf"],
  "rotate-pdf": ["organize-pdf", "delete-pages", "split-pdf", "merge-pdf"],
  "organize-pdf": ["delete-pages", "rotate-pdf", "split-pdf", "page-numbers"],
  "compress": ["merge-pdf", "split-pdf", "flatten-pdf", "pdf-to-image"],
  "pdf-to-word": ["word-to-pdf", "pdf-to-excel", "pdf-to-text", "pdf-ozetle"],
  "word-to-pdf": ["pdf-to-word", "merge-pdf", "compress", "watermark"],
  "excel-to-pdf": ["pdf-to-excel", "merge-pdf", "compress"],
  "pdf-to-excel": ["excel-to-pdf", "pdf-veri-cikar", "pdf-to-word", "pdf-to-text"],
  "pdf-to-ppt": ["ppt-to-pdf", "pdf-to-image", "pdf-to-word"],
  "ppt-to-pdf": ["pdf-to-ppt", "merge-pdf", "compress"],
  "pdf-to-image": ["image-to-pdf", "pdf-to-ppt", "compress"],
  "image-to-pdf": ["pdf-to-image", "belge-tara", "compress", "pdf-to-word"],
  "belge-tara": ["image-to-pdf", "aranabilir-pdf", "pdf-to-image", "compress"],
  "aranabilir-pdf": ["taranmis-pdf-ocr", "belge-tara", "pdf-to-text", "image-to-pdf"],
  "html-to-pdf": ["pdf-to-word", "merge-pdf", "compress"],
  "unlock-pdf": ["encrypt", "compress", "watermark", "pdf-to-word"],
  "watermark": ["page-numbers", "compress", "encrypt", "pdf-imzala"],
  "page-numbers": ["watermark", "merge-pdf", "organize-pdf", "compress"],
  "repair-pdf": ["compress", "merge-pdf", "pdf-to-word"],
  "encrypt": ["unlock-pdf", "watermark", "compress", "flatten-pdf"],
  "pdf-to-text": ["pdf-to-word", "taranmis-pdf-ocr", "pdf-ozetle", "pdf-veri-cikar"],
  "flatten-pdf": ["compress", "watermark", "page-numbers", "encrypt"],
  "pdf-ozetle": ["pdf-sohbet", "pdf-ceviri", "pdf-veri-cikar", "taranmis-pdf-ocr"],
  "pdf-sohbet": ["pdf-ozetle", "pdf-ceviri", "pdf-veri-cikar"],
  "pdf-duzenle": ["pdf-imzala", "pdf-yorumla", "watermark", "page-numbers"],
  "pdf-imzala": ["pdf-yorumla", "pdf-duzenle", "watermark", "encrypt"],
  "pdf-yorumla": ["pdf-imzala", "pdf-duzenle", "watermark"],
  "taranmis-pdf-ocr": ["pdf-to-text", "pdf-ozetle", "pdf-to-word", "pdf-ceviri"],
  "pdf-veri-cikar": ["pdf-to-excel", "pdf-ozetle", "pdf-sohbet", "ai-toplu-islem"],
  "pdf-ceviri": ["pdf-ozetle", "pdf-sohbet", "pdf-veri-cikar"],
  "ai-toplu-islem": ["pdf-ozetle", "pdf-veri-cikar", "pdf-ceviri"],
  "pdf-karsilastir": ["pdf-ozetle", "pdf-sohbet", "pdf-duzenle"],
  "hassas-veri-gizle": ["pdf-duzenle", "encrypt", "watermark"],
};

/** Blog yazısı slug → o işi yapan araçlar (yazı içi CTA + araç→rehber ters harita). */
export const BLOG_RELATED_TOOLS = {
  "word-pdf-cevirme": ["word-to-pdf", "pdf-to-word"],
  "pdf-jpg-resme-cevirme": ["pdf-to-image", "image-to-pdf"],
  "pdf-metin-duzenleme-silme": ["pdf-duzenle", "taranmis-pdf-ocr"],
  "pdf-excel-tablo-cevirme": ["pdf-to-excel", "pdf-veri-cikar", "ai-toplu-islem"],
  "faturadan-excele-veri-aktarma": ["pdf-veri-cikar", "pdf-to-excel"],
  "banka-ekstresi-excele-aktarma": ["pdf-veri-cikar", "pdf-to-excel"],
  "faturalari-toplu-muhasebeye-hazirlama": ["pdf-veri-cikar", "ai-toplu-islem", "pdf-to-excel"],
  "iki-pdf-birlestirme-ucretsiz": ["merge-pdf", "split-pdf", "compress"],
  "pdf-bolme-sayfalara-ayirma": ["split-pdf", "merge-pdf", "organize-pdf"],
  "pdf-sayfa-silme": ["delete-pages", "organize-pdf", "split-pdf"],
  "pdf-dondurme-kaydetme": ["rotate-pdf", "organize-pdf"],
  "pdf-sayfa-sirasi-degistirme": ["organize-pdf", "delete-pages", "rotate-pdf"],
  "pdf-boyutu-kucultme-sikistirma": ["compress", "flatten-pdf"],
  "pdf-word-donusturme": ["pdf-to-word", "word-to-pdf"],
  "resimleri-pdf-yapma": ["image-to-pdf", "pdf-to-image"],
  "pdf-sifre-kaldirma-koyma": ["unlock-pdf", "encrypt"],
  "pdf-baska-dile-cevirme": ["pdf-ceviri", "pdf-ozetle", "pdf-sohbet"],
  "yabanci-dildeki-sozlesmeyi-anlama": ["pdf-ceviri", "pdf-sohbet", "pdf-ozetle"],
  "uzun-belgeleri-ai-ile-ozetleme": ["pdf-ozetle", "pdf-sohbet"],
  "akademik-makale-ozetleme-literatur": ["pdf-ozetle", "pdf-sohbet", "pdf-ceviri"],
  "ihale-sartnamesi-nasil-okunur": ["pdf-ozetle", "pdf-sohbet", "pdf-veri-cikar"],
  "kira-kontrati-dikkat-edilecek-maddeler": ["pdf-ozetle", "pdf-sohbet"],
  "taranmis-pdf-metne-cevirme-ocr": ["taranmis-pdf-ocr", "pdf-to-text"],
  "pdf-e-imza-atma-nasil-yapilir": ["pdf-imzala", "pdf-duzenle", "pdf-yorumla"],
  "pdf-filigran-ekleme": ["watermark", "encrypt", "page-numbers"],
  "pdf-uzerine-yazma-isaretleme": ["pdf-yorumla", "pdf-imzala", "pdf-duzenle"],
  "telefonla-belge-tarama-pdf": ["image-to-pdf", "pdf-to-image", "compress"],
  "aranabilir-pdf-olusturma-ocr": ["taranmis-pdf-ocr", "pdf-to-text", "image-to-pdf"],
  "belge-fotografini-kaliteli-pdf-yapma": ["image-to-pdf", "compress", "pdf-to-image"],
  "camscanner-ucretsiz-gizli-alternatif": ["image-to-pdf", "taranmis-pdf-ocr", "compress"],
};

/** Araç kısa etiketi — SEO title'ın "—" öncesi (ör. "PDF Birleştir"). */
export function toolShortLabel(slug, language = "tr") {
  const c = TOOL_SEO[slug]?.[language] ?? TOOL_SEO[slug]?.tr;
  const t = (c && c.title) || "";
  return (t.split(/[—–|]/)[0] || "").trim() || slug.replace(/-/g, " ");
}

/** İlgili araç linkleri: [{ slug, label }]. */
export function getRelatedToolLinks(slug, language = "tr") {
  return (RELATED_TOOLS[slug] || []).map((s) => ({ slug: s, label: toolShortLabel(s, language) }));
}

/** Bu aracı "ilgili" gösteren blog yazısı slug'ları (ters harita). */
export function getGuideSlugsForTool(slug) {
  return Object.keys(BLOG_RELATED_TOOLS).filter((b) => BLOG_RELATED_TOOLS[b].includes(slug));
}
