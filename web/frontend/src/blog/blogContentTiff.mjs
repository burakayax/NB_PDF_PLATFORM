// ────────────────────────────────────────────────────────────────────────
// TIFF REHBERİ — «TIFF'ten PDF'e» aracını anlatan yazı. Yalnızca aracın GERÇEK
// özelliklerine dayanır; TR ve EN metinler ayrı yazılmıştır (çeviri değil).
// Kurumların kabul ettiği dosya biçimi/boyut sınırı hakkında kesin iddia yoktur:
// bunlar kurumdan kuruma değişir ve kullanıcı kendi ekranından doğrulamalıdır.
// ────────────────────────────────────────────────────────────────────────

const post = (meta, tr, en) => ({ ...meta, tr, en });

export const TIFF_EN_SLUGS = {
  "tiff-pdf-cevirme-cok-sayfali-tif": "convert-multi-page-tiff-to-pdf",
};

export const TIFF_POSTS = [
  post(
    {
      slug: "tiff-pdf-cevirme-cok-sayfali-tif",
      date: "2026-11-04",
      updated: "2026-11-04",
      readMinutes: 5,
      tags: { tr: ["TIFF", "Tarama", "PDF Araçları"], en: ["TIFF", "Scanning", "PDF Tools"] },
      accent: "cyan",
      tool: "/tools/tiff-to-pdf",
    },
    {
      title: "TIFF'i PDF'e Çevirme: Çok Sayfalı TIF Taramaları",
      description:
        "Tarayıcıdan çıkan tek ya da çok sayfalı TIF/TIFF dosyasını PDF'e çevirmenin yolları: sayfa sırası, boyut, gizlilik ve yüklemeden önce kontrol listesi.",
      excerpt:
        "Tarayıcı TIF verdi, başvuru ekranı PDF istiyor. Çok sayfalı TIFF'i sırayı bozmadan tek PDF yapmanın adımları ve dikkat edilecekler.",
      blocks: [
        { t: "lead", x: "Ofis tarayıcıları ve fotokopi makineleri taramayı çoğu zaman TIF ya da TIFF olarak kaydeder. Dosya bir görüntü gibi açılır, ama bir başvuru ekranına, e-postaya ya da arşive koymak istediğinizde PDF gerekir. Aşağıda TIFF'i PDF'e çevirmenin yolları, hangisinin ne zaman uygun olduğu ve çevirdikten sonra neleri kontrol etmeniz gerektiği var." },
        { t: "h2", x: "TIFF nedir, neden tarayıcılar bunu kullanır?" },
        { t: "p", x: "TIFF, görüntüyü kayıpsız saklayan bir biçimdir. Tek bir TIFF dosyasının içinde birden fazla sayfa bulunabilir; bu yüzden onlarca sayfalık bir taramanın tek dosya olarak çıkması normaldir. Dezavantajı, çoğu tarayıcının ve telefonun bu biçimi kendiliğinden önizleyememesi, kurumların yükleme ekranlarının ise sıkça PDF istemesidir." },
        { t: "h2", x: "Adım adım: TIFF'i PDF'e çevirmek" },
        { t: "steps", items: [
          { title: "Dosyayı ekleyin", x: "TIF ya da TIFF dosyanızı araca bırakın. Birden fazla dosya ekleyebilirsiniz; hepsi listede görünür." },
          { title: "Sırayı kontrol edin", x: "Birden çok dosya varsa okla yukarı ya da aşağı taşıyın. PDF, listedeki sırayla oluşur." },
          { title: "Sayfa boyutunu seçin", x: "«Taramanın kendi boyutu» sayfayı olduğu gibi bırakır; «A4'e sığdır» tüm sayfaları aynı boyuta getirir." },
          { title: "Çevirin ve indirin", x: "«PDF'e çevir»e basın. Çok sayfalı TIFF'in her sayfası PDF'te ayrı bir sayfa olur." },
        ] },
        { t: "cta", title: "TIFF'ten PDF'e", x: "Dosyanız tarayıcınızda çevrilir, sunucuya yüklenmez.", btn: "Aracı aç", tool: "/tools/tiff-to-pdf" },
        { t: "h2", x: "Hangi yöntem ne zaman?" },
        { t: "ul", items: [
          "Tek seferlik, hassas olmayan bir dosya: çevrimiçi dönüştürücülerin çoğu iş görür; ancak birçoğu dosyayı kendi sunucusuna yükler ve günlük dosya sınırı koyar.",
          "Kimlik, dava dosyası, sağlık ya da mali belge: dosyayı hiç yüklemeyen, işlemi tarayıcıda yapan bir araç tercih edin. Bu sitedeki araç böyle çalışır.",
          "Mac kullanıyorsanız: Önizleme uygulaması TIFF'i açıp PDF olarak dışa aktarabilir.",
          "Yüzlerce dosya ya da otomasyon: komut satırı araçları (örneğin ImageMagick) uygundur, ama kurulum ve bilgi ister.",
        ] },
        { t: "h2", x: "Çevirdikten sonra kontrol listesi" },
        { t: "ul", items: [
          "Sayfa sayısı özgün TIFF ile aynı mı?",
          "Sayfalar doğru sırada ve doğru yönde mi?",
          "Metin okunaklı mı? Çok soluk taramalar PDF'te de soluk kalır.",
          "Dosya boyutu yükleyeceğiniz ekranın sınırının altında mı?",
        ] },
        { t: "h2", x: "PDF çok büyük çıkarsa" },
        { t: "p", x: "TIFF kayıpsız olduğu için sonuç PDF'in boyutu yüksek olabilir. Yükleme ekranı sınır koyuyorsa «PDF Sıkıştır» aracıyla dosyayı küçültün. Sınır ve kabul edilen biçimler kurumdan kuruma değiştiği için kesin değerleri her zaman ilgili ekrandaki açıklamadan okuyun." },
        { t: "h2", x: "Yazıyı seçilebilir yapmak" },
        { t: "p", x: "Tarama bir görüntüdür; PDF'e çevrilince de görüntü olarak kalır, içindeki yazı seçilemez ve aranamaz. Metne ihtiyacınız varsa çıkan PDF'i «Aranabilir PDF (OCR)» aracından geçirin. OCR sonucunu önemli belgelerde özgün sayfayla karşılaştırmak iyi bir alışkanlıktır." },
        { t: "tip", x: "JPG, PNG ya da WebP görselleriniz varsa «Görselden PDF'e» aracını kullanın; TIFF için ayrı olan bu araç çok sayfalı dosyaları sayfa sayfa açmak üzere hazırlandı." },
      ],
      faq: [
        { q: "Çok sayfalı TIFF'in bütün sayfaları PDF'e geçer mi?", a: "Evet. Her TIFF sayfası PDF'te ayrı bir sayfa olur ve özgün sıra korunur." },
        { q: "Birden fazla TIFF'i tek PDF'te birleştirebilir miyim?", a: "Evet. Dosyaları ekleyin, okla sıralayın; seçtiğiniz sırayla tek PDF olurlar." },
        { q: "Dosyam bir sunucuya yükleniyor mu?", a: "Hayır. Çevirme işlemi tarayıcınızda yapılır; dosya cihazınızdan çıkmaz." },
        { q: "Çevirince PDF'teki yazı seçilebilir olur mu?", a: "Hayır, tarama görüntü olarak kalır. Seçilebilir ve aranabilir metin için PDF'i OCR aracından geçirin." },
        { q: "Bir başvuru ekranı TIF'i kabul etmiyor, PDF istiyor. Ne yapmalıyım?", a: "TIF'i PDF'e çevirip yükleyin. Kabul edilen biçimler ve boyut sınırı kuruma göre değişir; ekrandaki açıklamayı esas alın." },
        { q: "Çıkan PDF çok büyük, küçültebilir miyim?", a: "Evet, «PDF Sıkıştır» aracıyla dosya boyutunu küçültebilirsiniz." },
      ],
    },
    {
      title: "Convert TIFF to PDF: Multi-Page TIF Scans Explained",
      description:
        "How to turn a single or multi-page TIF/TIFF scan into a PDF: keeping page order, file size, privacy, and a checklist to run before you submit it.",
      excerpt:
        "Your scanner gave you a TIF and the form wants a PDF. How to convert a multi-page TIFF without losing page order, and what to check afterwards.",
      blocks: [
        { t: "lead", x: "Office scanners and copiers often save a scan as TIF or TIFF. It opens like a picture, but the moment you need to attach it to an online form, email it or file it, a PDF is what people ask for. Here is how to convert a TIFF, which route suits which situation, and what to check before you hit submit." },
        { t: "h2", x: "Why does the scanner give you a TIFF?" },
        { t: "p", x: "TIFF stores the image without losing detail, and one file can hold many pages, so a thirty-page scan arriving as a single file is perfectly normal. The catch is that many phones and browsers cannot preview it, while upload forms tend to prefer PDF." },
        { t: "h2", x: "Converting step by step" },
        { t: "steps", items: [
          { title: "Add the file", x: "Drop your TIF or TIFF into the tool. You can add several files and see them in a list." },
          { title: "Check the order", x: "With more than one file, move them up or down with the arrows. The PDF follows the list order." },
          { title: "Pick a page size", x: "Same as the scan keeps each page as it is; Fit to A4 puts every page on the same size." },
          { title: "Convert and download", x: "Press Convert to PDF. Every page of a multi-page TIFF becomes its own PDF page." },
        ] },
        { t: "cta", title: "TIFF to PDF", x: "The file is converted in your browser and never uploaded.", btn: "Open the tool", tool: "/tools/tiff-to-pdf" },
        { t: "h2", x: "Which route when?" },
        { t: "ul", items: [
          "A one-off, non-sensitive file: most online converters will do, although many upload the file to their servers and cap the number of free conversions per day.",
          "ID papers, court files, medical or financial documents: pick a tool that processes the file in your browser instead of uploading it. The tool on this site works that way.",
          "On a Mac: the built-in Preview app can open a TIFF and export it as a PDF.",
          "Hundreds of files or automation: command-line tools such as ImageMagick fit, at the cost of setup and know-how.",
        ] },
        { t: "h2", x: "Checks after converting" },
        { t: "ul", items: [
          "Does the PDF have the same number of pages as the TIFF?",
          "Are the pages in the right order and the right way up?",
          "Is the text legible? A faint scan stays faint in the PDF.",
          "Is the file under the size limit of the form you are filling in?",
        ] },
        { t: "h2", x: "If the PDF turns out huge" },
        { t: "p", x: "Because TIFF is lossless, the PDF can end up large. If the upload form has a limit, run the result through Compress PDF. Accepted formats and size limits differ from one organisation to the next, so always read the exact numbers on the form itself." },
        { t: "h2", x: "Making the text selectable" },
        { t: "p", x: "A scan is a picture, and it stays a picture inside the PDF: you cannot select or search the words. If you need real text, run the PDF through the Searchable PDF (OCR) tool, and for anything important compare the output with the original page." },
        { t: "tip", x: "For JPG, PNG or WebP pictures use the Image to PDF tool instead; the TIFF tool is separate because it is built to open multi-page files page by page." },
      ],
      faq: [
        { q: "Are all pages of a multi-page TIFF kept?", a: "Yes. Each TIFF page becomes its own page in the PDF, in the original order." },
        { q: "Can I merge several TIFFs into a single PDF?", a: "Yes. Add the files, order them with the arrows and they are combined in that order." },
        { q: "Is my file uploaded to a server?", a: "No. The conversion runs in your browser and the file stays on your device." },
        { q: "Will the text in the PDF be selectable?", a: "No, the scan stays an image. Use the OCR tool for selectable, searchable text." },
        { q: "A form rejects TIF and wants a PDF. What should I do?", a: "Convert the TIF to PDF and upload that. Accepted formats and size limits vary by organisation, so follow what the form says." },
        { q: "The PDF is too big. Can I shrink it?", a: "Yes, Compress PDF can make the file smaller." },
      ],
    },
  ),
];

/** Elle yazılmış Instagram slaytları (carouselCopy.mjs'e katılır). */
export const TIFF_CAROUSELS = {
  "tiff-pdf-cevirme-cok-sayfali-tif": {
    hook: "Tarayıcı TIF verdi, başvuru PDF istiyor",
    slides: [
      ["Dört adım", "Dosyayı ekleyin, sırayı kontrol edin, sayfa boyutunu seçin, çevirin. Dosyanız cihazınızdan çıkmaz."],
      ["Her sayfa ayrı sayfa", "Çok sayfalı TIFF'in her sayfası PDF'te ayrı bir sayfa olur, sıra bozulmaz."],
      ["Birden çok dosya", "Birkaç TIFF'i okla sıralayıp tek PDF'te birleştirebilirsiniz."],
      ["Yazı seçilebilir mi?", "Hayır, tarama görüntü olarak kalır. Aranabilir metin için PDF'i OCR aracından geçirin."],
      ["PDF büyük çıktıysa", "PDF Sıkıştır ile yükleme ekranının sınırına indirin. Kesin sınırı kendi ekranınızdan okuyun."],
    ],
  },
};
