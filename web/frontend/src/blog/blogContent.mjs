// ─────────────────────────────────────────────────────────────────────────────
// BLOG İÇERİĞİ — TEK GERÇEK KAYNAK
// Hem Node build script'i (generate-seo-files.mjs → statik HTML + sitemap + JSON-LD)
// hem runtime React (BlogIndexPage / BlogPostPage) bu dosyayı import eder.
// İçerik ÜRÜNÜN GERÇEK özelliklerine sadıktır — uydurma özellik/istatistik yoktur.
// ─────────────────────────────────────────────────────────────────────────────

export const BLOG_BASE = "/blog";

/** Blok tipleri: p | lead | h2 | h3 | ul | ol | tip | steps | cta */
const post = (meta, tr, en) => ({ ...meta, tr, en });

export const BLOG_POSTS = [
  post(
    {
      slug: "faturadan-excele-veri-aktarma",
      date: "2026-07-03",
      updated: "2026-07-03",
      readMinutes: 6,
      tags: { tr: ["Yapay Zekâ", "Veri Çıkarma", "Fatura"], en: ["AI", "Data Extraction", "Invoice"] },
      accent: "fuchsia",
      tool: "/tools/pdf-veri-cikar",
    },
    {
      title: "Faturadan Excel'e Veri Aktarma: 2026 Rehberi (3 Yöntem)",
      description:
        "PDF faturalardaki verileri Excel'e (CSV) aktarmanın 3 yolu — elle, OCR ile ve yapay zekâ ile. Onlarca faturayı tek tabloya nasıl dökeceğinizi adım adım anlatıyoruz.",
      excerpt:
        "PDF faturaları elle Excel'e girmek yavaş ve hataya açık. Bu rehberde faturadan veri aktarmanın 3 yöntemini karşılaştırıp, onlarca faturayı tek tabloya saniyeler içinde nasıl dökeceğinizi gösteriyoruz.",
      blocks: [
        { t: "lead", x: "Muhasebe, satın alma veya finans ekiplerinin en çok zaman kaybettiği işlerden biri: PDF faturalardaki bilgileri tek tek Excel'e girmek. Bu yazıda üç yöntemi dürüstçe karşılaştırıyor ve en hızlısını adım adım gösteriyoruz." },

        { t: "h2", x: "Neden zor bir iş?" },
        { t: "p", x: "PDF, görüntüleme için tasarlanmış bir formattır — verinin \"tablo\" olarak dışa aktarılması için değil. Fatura no, tarih, tutar ve kalemler sayfada görünse de arkada düzenli bir tablo olarak durmaz. Üstelik her tedarikçinin fatura düzeni farklıdır. Bu yüzden kopyala-yapıştır çoğu zaman bozuk hizalama ve hatalı hücrelerle sonuçlanır." },

        { t: "h2", x: "Yöntem 1 — Elle giriş" },
        { t: "p", x: "En bilinen yol: faturayı açıp değerleri tek tek Excel'e yazmak. Tek bir fatura için işe yarar, ama onlarca faturada hem çok zaman alır hem de dikkat hatası kaçınılmazdır." },
        { t: "ul", items: ["Artı: ek araç gerekmez.", "Eksi: yavaş, yorucu ve hataya açık.", "Ne zaman: ayda birkaç fatura."] },

        { t: "h2", x: "Yöntem 2 — OCR ile metin çıkarıp düzenleme" },
        { t: "p", x: "Taranmış (fotoğraf/görüntü) faturalarda önce OCR ile yazıyı metne çevirmeniz gerekir; ardından metni elle tabloya düzenlersiniz. OCR metni verir ama yapıyı (hangi sayı hangi alan) sizin kurmanız gerekir." },
        { t: "tip", x: "Taranmış bir PDF'iniz varsa, OCR aracımız yazıyı tamamen cihazınızda gerçek metne çevirir (Türkçe + İngilizce). Dosya sunucuya yüklenmez." },

        { t: "h2", x: "Yöntem 3 — Yapay zekâ ile otomatik veri çıkarma (en hızlısı)" },
        { t: "p", x: "En pratik yöntem, belgeyi anlayan bir yapay zekânın alanları ve satır kalemlerini sizin yerinize ayıklamasıdır. PDF Platform'un AI Veri Çıkar aracı tam olarak bunu yapar:" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Fatura, irsaliye ya da tablo içeren belgenizi seçin. Metin cihazınızda okunur; taranmışsa OCR otomatik devreye girer." },
          { title: "\"Veriyi Çıkar\" deyin", x: "Yapay zekâ belge türünü tanır ve fatura no, tarih, satıcı/alıcı, vergi no, ara toplam, KDV, genel toplam gibi alanları — ve varsa satır kalemlerini — yapılandırılmış olarak çıkarır." },
          { title: "Tabloda görün, CSV indirin", x: "Sonucu alanlar + tablolar olarak görün; tek tıkla CSV (Excel) veya JSON olarak dışa aktarın." },
        ] },

        { t: "cta", title: "AI Veri Çıkar", x: "Bir faturayı deneyin — alanlar ve kalemler saniyeler içinde tabloya dönüşsün.", btn: "Aracı aç", tool: "/tools/pdf-veri-cikar" },

        { t: "h2", x: "Onlarca faturayı tek tabloda birleştirme" },
        { t: "p", x: "Tek fatura güzel, ama asıl zaman kazancı toplu işlemede. AI Toplu İşlem aracıyla bir klasör dolusu faturayı arka arkaya işleyip hepsinin verisini tek bir CSV tablosunda birleştirebilirsiniz — her satır bir fatura olacak şekilde." },
        { t: "ul", items: ["En fazla 25 dosyayı tek seferde işleyin.", "Her dosya için canlı ilerleme görün.", "Tüm faturaların alanları tek CSV başlığında birleşir."] },

        { t: "cta", title: "AI Toplu İşlem", x: "Birden çok faturayı tek seferde işleyip tek CSV olarak indirin.", btn: "Toplu işleme geç", tool: "/tools/ai-toplu-islem" },

        { t: "h2", x: "Gizlilik notu" },
        { t: "p", x: "Bu araçlarda PDF'inizin metni cihazınızda çıkarılır ve yapay zekâya yalnızca metin gönderilir; dosyanızın kendisi karşıya yüklenmez. Yapısal araçlarımızın çoğu ise (birleştirme, sıkıştırma vb.) tamamen tarayıcınızda çalışır." },
      ],
      faq: [
        { q: "Faturadan Excel'e veri nasıl aktarılır?", a: "PDF'i AI Veri Çıkar aracına yükleyin; yapay zekâ fatura no, tarih, taraflar, tutar ve kalemleri yapılandırılmış olarak çıkarır. Ardından tek tıkla CSV (Excel) olarak indirebilirsiniz." },
        { q: "Taranmış faturalarda çalışır mı?", a: "Evet. Taranmış/fotoğraf faturalarda OCR otomatik devreye girip yazıyı cihazınızda metne çevirir, sonra veri çıkarılır." },
        { q: "Birden çok faturayı tek tabloya alabilir miyim?", a: "Evet. AI Toplu İşlem aracıyla onlarca faturayı işleyip hepsini, her satırı bir dosya olan tek bir CSV tablosunda birleştirebilirsiniz." },
      ],
    },
    {
      title: "Extract Data from Invoices to Excel: 2026 Guide (3 Methods)",
      description:
        "Three ways to get data out of PDF invoices into Excel (CSV) — manual, OCR and AI. We show how to turn dozens of invoices into a single table in seconds.",
      excerpt:
        "Typing invoice data into Excel by hand is slow and error-prone. This guide compares three methods and shows how to turn dozens of invoices into one table in seconds.",
      blocks: [
        { t: "lead", x: "One of the biggest time sinks for accounting, procurement and finance teams: typing data from PDF invoices into Excel one by one. This post honestly compares three methods and shows the fastest, step by step." },
        { t: "h2", x: "Why is it hard?" },
        { t: "p", x: "PDF is a format designed for display — not for exporting data as a \"table\". Invoice numbers, dates, totals and line items look organized on the page but aren't stored as a clean table behind the scenes. And every vendor's layout differs, so copy-paste often produces broken alignment and wrong cells." },
        { t: "h2", x: "Method 1 — Manual entry" },
        { t: "p", x: "The familiar route: open the invoice and type values into Excel. Fine for one invoice, but for dozens it's slow and mistakes are inevitable." },
        { t: "ul", items: ["Pro: no extra tools.", "Con: slow, tedious, error-prone.", "When: a few invoices a month."] },
        { t: "h2", x: "Method 2 — OCR then clean up" },
        { t: "p", x: "For scanned (image) invoices you first need OCR to turn the picture into text, then structure it into a table by hand. OCR gives you text, but you still build the structure." },
        { t: "tip", x: "If your PDF is scanned, our OCR turns the text into real text entirely on your device (Turkish + English). The file is never uploaded." },
        { t: "h2", x: "Method 3 — AI data extraction (the fastest)" },
        { t: "p", x: "The most practical way is to let an AI that understands the document pull out the fields and line items for you. PDF Platform's Extract Data tool does exactly this:" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Pick your invoice, delivery note or table. Text is read on your device; if it's scanned, OCR kicks in automatically." },
          { title: "Click \"Extract Data\"", x: "The AI detects the document type and extracts fields like invoice no, date, seller/buyer, tax id, subtotal, VAT and total — plus any line items — as structured data." },
          { title: "View as a table, export CSV", x: "See the fields + tables; export to CSV (Excel) or JSON in one click." },
        ] },
        { t: "cta", title: "Extract Data", x: "Try one invoice — fields and line items become a table in seconds.", btn: "Open the tool", tool: "/tools/pdf-veri-cikar" },
        { t: "h2", x: "Merge dozens of invoices into one table" },
        { t: "p", x: "A single invoice is nice, but the real win is batch. With the Batch tool you can process a whole folder of invoices and merge their data into one CSV table — one row per invoice." },
        { t: "ul", items: ["Process up to 25 files at once.", "See live progress per file.", "All invoices' fields merge into one CSV header."] },
        { t: "cta", title: "AI Batch", x: "Process many invoices at once and download a single CSV.", btn: "Go to batch", tool: "/tools/ai-toplu-islem" },
        { t: "h2", x: "Privacy note" },
        { t: "p", x: "In these tools your PDF's text is extracted on your device and only the text is sent to the AI; the file itself is not uploaded. Most of our structural tools (merge, compress, etc.) run entirely in your browser." },
      ],
      faq: [
        { q: "How do I extract data from an invoice to Excel?", a: "Upload the PDF to the Extract Data tool; the AI extracts invoice no, date, parties, totals and line items as structured data. Then export to CSV (Excel) in one click." },
        { q: "Does it work on scanned invoices?", a: "Yes. For scanned/photo invoices, OCR runs automatically on your device to turn the image into text, then data is extracted." },
        { q: "Can I merge many invoices into one table?", a: "Yes. With the AI Batch tool you can process dozens of invoices and merge them into one CSV table with one row per file." },
      ],
    },
  ),

  post(
    {
      slug: "iki-pdf-birlestirme-ucretsiz",
      date: "2026-07-03",
      updated: "2026-07-03",
      readMinutes: 4,
      tags: { tr: ["PDF Araçları", "Birleştirme"], en: ["PDF Tools", "Merge"] },
      accent: "blue",
      tool: "/tools/merge-pdf",
    },
    {
      title: "İki veya Daha Fazla PDF'i Ücretsiz Birleştirme (Kurulumsuz)",
      description:
        "Birden fazla PDF'i tek dosyada, üyeliksiz ve ücretsiz birleştirin. Dosyalarınız tarayıcınızdan çıkmadan, cihazınızda işlenir — kurulum gerekmez.",
      excerpt:
        "Birden fazla PDF'i tek belgeye birleştirmenin en kolay yolu. Üyeliksiz, ücretsiz ve dosyalarınız cihazınızdan hiç çıkmadan — adım adım.",
      blocks: [
        { t: "lead", x: "Sözleşme ekleri, taranmış evraklar ya da birden çok raporu tek PDF'te toplamanız gerektiğinde, işi karmaşıklaştırmaya gerek yok. İşte üyelik ve kurulum olmadan, tamamen tarayıcınızda birleştirmenin yolu." },
        { t: "h2", x: "Neden \"cihazda\" birleştirmek önemli?" },
        { t: "p", x: "Çoğu online araç dosyanızı sunucularına yükler. PDF Platform'da birleştirme işlemi tamamen tarayıcınızda (cihazınızda) çalışır — dosyalarınız internete hiç gönderilmez. Bu hem gizlilik hem hız demektir: yükleme beklemez, anında sonuç alırsınız." },
        { t: "h2", x: "Adım adım birleştirme" },
        { t: "steps", items: [
          { title: "PDF'leri ekleyin", x: "Birleştirme aracına birden çok PDF'i sürükleyip bırakın ya da seçin. 80 MB'a kadar, dosya sayısı sınırı yok." },
          { title: "Sırayı ayarlayın", x: "Dosyaların yukarı/aşağı okla sırasını değiştirin; belge bu sırayla birleşecek." },
          { title: "Birleştirin ve indirin", x: "\"Birleştir\" deyin; tek PDF anında hazırlanır ve seçtiğiniz konuma kaydedilir." },
        ] },
        { t: "cta", title: "PDF Birleştir", x: "Dosyalarınızı ekleyin, sıralayın ve tek PDF olarak indirin — ücretsiz.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Sık sorulan pratik ipuçları" },
        { t: "ul", items: ["Görselleri (JPG/PNG) PDF yapmak istiyorsanız \"Görsel → PDF\" aracını kullanın.", "Sadece belirli sayfaları almak için önce \"Böl\" aracıyla ayırabilirsiniz.", "İşlem cihazınızda olduğu için internet kesilse bile çalışır."] },
        { t: "tip", x: "Şifre korumalı bir PDF'i birleştirmek isterseniz önce \"PDF Kilidini Aç\" aracıyla şifreyi kaldırmanız gerekir." },
      ],
      faq: [
        { q: "PDF birleştirmek için üye olmam gerekir mi?", a: "Hayır. Birleştirme aracı üyeliksiz ve ücretsizdir; işlem tarayıcınızda çalışır, dosyalarınız sunucuya yüklenmez." },
        { q: "Dosya boyutu sınırı nedir?", a: "Web'de toplam 80 MB'a kadar dosya birleştirebilirsiniz. Dosya sayısında bir sınır yoktur." },
        { q: "Dosyalarım güvende mi?", a: "Evet. Birleştirme cihazınızda gerçekleşir; dosyalarınız internete hiç gönderilmez." },
      ],
    },
    {
      title: "Merge Two or More PDFs for Free (No Install)",
      description:
        "Combine multiple PDFs into one file, free and without signup. Your files are processed on your device, never uploaded — no installation needed.",
      excerpt:
        "The easiest way to combine multiple PDFs into one document. Free, no signup, and your files never leave your device — step by step.",
      blocks: [
        { t: "lead", x: "When you need to combine contract annexes, scanned papers or several reports into one PDF, there's no need to overcomplicate it. Here's how to merge entirely in your browser, without signup or installation." },
        { t: "h2", x: "Why \"on-device\" merging matters" },
        { t: "p", x: "Most online tools upload your file to their servers. On PDF Platform, merging runs entirely in your browser (on your device) — your files are never sent to the internet. That means both privacy and speed: no upload wait, instant results." },
        { t: "h2", x: "Merge step by step" },
        { t: "steps", items: [
          { title: "Add your PDFs", x: "Drag and drop or select multiple PDFs into the merge tool. Up to 80 MB, no limit on the number of files." },
          { title: "Set the order", x: "Reorder files with the up/down arrows; the document merges in this order." },
          { title: "Merge and download", x: "Click \"Merge\"; a single PDF is prepared instantly and saved to your chosen location." },
        ] },
        { t: "cta", title: "Merge PDF", x: "Add your files, reorder and download one PDF — free.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Handy tips" },
        { t: "ul", items: ["To turn images (JPG/PNG) into a PDF, use the \"Image → PDF\" tool.", "To keep only certain pages, split them first with the \"Split\" tool.", "Because it runs on your device, it works even offline."] },
        { t: "tip", x: "To merge a password-protected PDF, remove the password first with the \"Unlock PDF\" tool." },
      ],
      faq: [
        { q: "Do I need an account to merge PDFs?", a: "No. The merge tool is free and needs no signup; it runs in your browser and your files are not uploaded." },
        { q: "What's the file size limit?", a: "You can merge up to 80 MB total on the web. There's no limit on the number of files." },
        { q: "Are my files safe?", a: "Yes. Merging happens on your device; your files are never sent to the internet." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-baska-dile-cevirme",
      date: "2026-07-03",
      updated: "2026-07-03",
      readMinutes: 5,
      tags: { tr: ["Yapay Zekâ", "Çeviri"], en: ["AI", "Translation"] },
      accent: "violet",
      tool: "/tools/pdf-ceviri",
    },
    {
      title: "PDF'i Başka Dile Çevirmenin En Hızlı Yolu (Yapıyı Bozmadan)",
      description:
        "PDF belgenizi yapay zekâ ile 12+ dile çevirin — başlık, liste ve tablolar korunur. Sonucu düzgün bir PDF olarak indirin. Adım adım rehber.",
      excerpt:
        "Bir PDF'i başka dile çevirirken en büyük dert, düzenin bozulmasıdır. Yapay zekâ ile anlamı ve yapıyı koruyarak nasıl çevireceğinizi anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Yabancı dildeki bir sözleşmeyi, makaleyi ya da kılavuzu anlamak için çeviri şart. Ama çoğu yöntem belgenin düzenini dağıtır. İşte anlamı ve yapıyı koruyarak çevirmenin pratik yolu." },
        { t: "h2", x: "Kopyala-yapıştır çeviri neden yetersiz?" },
        { t: "p", x: "Metni kopyalayıp bir çeviri sitesine yapıştırdığınızda başlıklar, listeler ve tablolar kaybolur; uzun belgelerde bu iş içinden çıkılmaz hale gelir. Ayrıca sayı, tarih ve özel isimlerin olduğu gibi kalması gerekir." },
        { t: "h2", x: "Yapay zekâ ile çeviri — yapıyı koruyarak" },
        { t: "p", x: "PDF Platform'un AI Çeviri aracı belgeyi anlamı ve düzeniyle birlikte çevirir:" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Metin cihazınızda okunur; taranmış belgede OCR devreye girer. Dosyanız karşıya yüklenmez, yalnızca metni çeviriye gider." },
          { title: "Hedef dili seçin", x: "İngilizce, Almanca, Fransızca, İspanyolca, Arapça, Rusça dahil 12'den fazla dil arasından seçin." },
          { title: "Çevirin ve PDF indirin", x: "Başlık, liste ve tablolar korunarak çevrilir; sonucu kopyalayabilir ya da düzgün bir PDF olarak indirebilirsiniz." },
        ] },
        { t: "cta", title: "AI Çeviri", x: "PDF'inizi seçtiğiniz dile çevirin — yapı korunur, PDF olarak indirin.", btn: "Aracı aç", tool: "/tools/pdf-ceviri" },
        { t: "h2", x: "Ne zaman insan çevirmen gerekir?" },
        { t: "p", x: "Yapay zekâ çevirisi hız ve anlama için mükemmeldir. Ancak resmî/hukuki geçerlilik gereken belgelerde (noter, mahkeme, resmî başvuru) yeminli tercüman şarttır. Yapay zekâ bu tür işlerde hızlı bir ön-anlama ve taslak için idealdir." },
        { t: "tip", x: "Çeviriden önce belgenin ne anlattığını hızlıca kavramak isterseniz AI Özet aracıyla önce bir özet çıkarabilirsiniz." },
      ],
      faq: [
        { q: "PDF nasıl başka dile çevrilir?", a: "PDF'i AI Çeviri aracına yükleyin, hedef dili seçin ve \"Çevir\" deyin. Yapay zekâ belgeyi anlam ve yapısını koruyarak çevirir; sonucu PDF olarak indirebilirsiniz." },
        { q: "Çeviride belgenin düzeni korunur mu?", a: "Evet. Başlıklar, listeler ve tablolar korunarak çevrilir; sayı, tarih ve özel isimler olduğu gibi kalır." },
        { q: "Hangi diller destekleniyor?", a: "İngilizce, Türkçe, Almanca, Fransızca, İspanyolca, İtalyanca, Portekizce, Rusça, Arapça, Çince, Japonca ve Felemenkçe dahil 12'den fazla dil." },
      ],
    },
    {
      title: "The Fastest Way to Translate a PDF (Without Breaking Layout)",
      description:
        "Translate your PDF into 12+ languages with AI — headings, lists and tables preserved. Download the result as a clean PDF. Step-by-step guide.",
      excerpt:
        "The biggest headache when translating a PDF is the layout falling apart. Here's how to translate with AI while preserving meaning and structure.",
      blocks: [
        { t: "lead", x: "To understand a contract, paper or manual in another language, translation is essential. But most methods scramble the document's layout. Here's the practical way to translate while preserving meaning and structure." },
        { t: "h2", x: "Why copy-paste translation falls short" },
        { t: "p", x: "When you copy text into a translation site, headings, lists and tables disappear; for long documents this becomes unmanageable. And numbers, dates and proper nouns need to stay intact." },
        { t: "h2", x: "AI translation — preserving structure" },
        { t: "p", x: "PDF Platform's AI Translate tool translates the document along with its meaning and layout:" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Text is read on your device; OCR kicks in for scanned documents. Your file isn't uploaded — only the text goes to translation." },
          { title: "Pick the target language", x: "Choose from 12+ languages including English, German, French, Spanish, Arabic and Russian." },
          { title: "Translate and download PDF", x: "Headings, lists and tables are preserved; copy the result or download it as a clean PDF." },
        ] },
        { t: "cta", title: "AI Translate", x: "Translate your PDF into any language — structure preserved, download as PDF.", btn: "Open the tool", tool: "/tools/pdf-ceviri" },
        { t: "h2", x: "When do you need a human translator?" },
        { t: "p", x: "AI translation is excellent for speed and comprehension. But for documents that need legal validity (notary, court, official applications), a sworn translator is required. AI is ideal for a fast first understanding and draft." },
        { t: "tip", x: "To quickly grasp what a document is about before translating, you can first generate a summary with the AI Summarize tool." },
      ],
      faq: [
        { q: "How do I translate a PDF into another language?", a: "Upload the PDF to the AI Translate tool, pick a target language and click \"Translate\". The AI translates while preserving meaning and structure; you can download the result as a PDF." },
        { q: "Is the layout preserved in translation?", a: "Yes. Headings, lists and tables are kept, and numbers, dates and proper nouns stay intact." },
        { q: "Which languages are supported?", a: "12+ languages including English, Turkish, German, French, Spanish, Italian, Portuguese, Russian, Arabic, Chinese, Japanese and Dutch." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-word-donusturme",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Dönüştürme", "Word"], en: ["Convert", "Word"] }, accent: "cyan", tool: "/tools/pdf-to-word",
    },
    {
      title: "PDF'i Word'e Dönüştürme: Düzenlenebilir Belgeye Çevirin",
      description: "PDF'i düzenlenebilir Word (.docx) belgesine dönüştürün. Biçimi koruyarak metni düzenlemenin en pratik yolu ve dikkat edilmesi gerekenler.",
      excerpt: "Bir PDF'i yeniden yazmadan düzenlemek istiyorsanız çözüm onu Word'e çevirmek. Bu yazıda en pratik yöntemi ve biçim kayıplarını en aza indirme ipuçlarını anlatıyoruz.",
      blocks: [
        { t: "lead", x: "PDF, düzenleme için değil paylaşım için tasarlanmış bir formattır. İçindeki metni değiştirmeniz gerektiğinde en pratik yol, belgeyi düzenlenebilir bir Word dosyasına çevirmektir." },
        { t: "h2", x: "Neden doğrudan düzenlemek zor?" },
        { t: "p", x: "PDF'te metin, satır ve sütunlar sabit konumlara yerleştirilir; bir kelimeyi değiştirdiğinizde düzen kolayca bozulur. Word'e çevirdiğinizde ise paragraflar, başlıklar ve tablolar yeniden akışkan hale gelir ve normal bir belge gibi düzenlenebilir." },
        { t: "h2", x: "Adım adım PDF → Word" },
        { t: "steps", items: [
          { title: "PDF'i araca yükleyin", x: "PDF Platform'un PDF → Word aracını açın ve belgenizi seçin." },
          { title: "Dönüştürün", x: "Araç metni ve düzeni analiz edip düzenlenebilir bir .docx üretir." },
          { title: "Word dosyasını indirin", x: "Sonucu indirip Microsoft Word, Google Docs veya benzeri bir programda düzenleyin." },
        ] },
        { t: "cta", title: "PDF'i Word'e Çevir", x: "PDF'inizi düzenlenebilir Word belgesine dönüştürün.", btn: "Aracı aç", tool: "/tools/pdf-to-word" },
        { t: "tip", x: "Belgeniz taranmışsa (fotoğraf/görüntü), önce metni tanımak için OCR gerekir — aksi halde Word dosyası düzenlenebilir metin yerine resim içerir." },
        { t: "h2", x: "Biçim kaybını en aza indirme" },
        { t: "p", x: "Karmaşık düzenli belgelerde (çok sütunlu, yoğun tablolu) küçük kaymalar olabilir. En temiz sonuç, metin ağırlıklı belgelerde alınır. Dönüştürme sonrası tabloları ve başlıkları hızlıca gözden geçirmeniz yeterlidir." },
      ],
      faq: [
        { q: "PDF Word'e nasıl çevrilir?", a: "PDF'i PDF → Word aracına yükleyin; araç düzenlenebilir bir .docx üretir, siz de indirip Word'de düzenlersiniz." },
        { q: "Biçim korunur mu?", a: "Metin ağırlıklı belgelerde düzen büyük ölçüde korunur. Çok karmaşık tablo/sütun düzenlerinde küçük düzeltmeler gerekebilir." },
        { q: "Taranmış PDF'i Word'e çevirebilir miyim?", a: "Evet, ancak metnin düzenlenebilir olması için önce OCR ile tanınması gerekir." },
      ],
    },
    {
      title: "Convert PDF to Word: Turn It into an Editable Document",
      description: "Convert a PDF into an editable Word (.docx) document. The most practical way to edit the text while keeping formatting — and what to watch for.",
      excerpt: "If you want to edit a PDF without retyping it, the answer is converting it to Word. This post covers the most practical method and tips to minimize formatting loss.",
      blocks: [
        { t: "lead", x: "PDF is a format designed for sharing, not editing. When you need to change the text inside, the most practical way is to convert the document into an editable Word file." },
        { t: "h2", x: "Why is editing directly hard?" },
        { t: "p", x: "In a PDF, text and columns are placed at fixed positions; change one word and the layout easily breaks. Converting to Word makes paragraphs, headings and tables flow again so you can edit like a normal document." },
        { t: "h2", x: "PDF → Word step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Open PDF Platform's PDF → Word tool and select your document." },
          { title: "Convert", x: "The tool analyzes the text and layout and produces an editable .docx." },
          { title: "Download the Word file", x: "Download and edit in Microsoft Word, Google Docs or similar." },
        ] },
        { t: "cta", title: "Convert PDF to Word", x: "Turn your PDF into an editable Word document.", btn: "Open the tool", tool: "/tools/pdf-to-word" },
        { t: "tip", x: "If your document is scanned (image), OCR is needed first to recognize the text — otherwise the Word file contains an image instead of editable text." },
        { t: "h2", x: "Minimizing formatting loss" },
        { t: "p", x: "For complex layouts (multi-column, table-heavy) minor shifts can happen. The cleanest results come from text-heavy documents. A quick review of tables and headings after conversion is usually enough." },
      ],
      faq: [
        { q: "How do I convert PDF to Word?", a: "Upload the PDF to the PDF → Word tool; it produces an editable .docx that you download and edit in Word." },
        { q: "Is formatting preserved?", a: "For text-heavy documents the layout is largely preserved. Very complex table/column layouts may need small fixes." },
        { q: "Can I convert a scanned PDF to Word?", a: "Yes, but the text must first be recognized with OCR to be editable." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-boyutu-kucultme-sikistirma",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 4,
      tags: { tr: ["Sıkıştırma", "Boyut"], en: ["Compress", "Size"] }, accent: "emerald", tool: "/tools/compress",
    },
    {
      title: "PDF Boyutunu Küçültme (Sıkıştırma): E-postaya Sığdırın",
      description: "PDF dosya boyutunu küçültün — e-posta eki sınırlarına takılmadan, gereksiz kalite kaybı olmadan paylaşın. PDF'lerin neden büyüdüğünü ve nasıl küçülteceğinizi anlatıyoruz.",
      excerpt: "E-posta \"dosya çok büyük\" mü diyor? PDF'ler çoğunlukla içindeki görseller yüzünden şişer. Bu yazıda boyutu nasıl küçülteceğinizi ve neye dikkat edeceğinizi anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Çoğu e-posta servisi 20-25 MB ek sınırı koyar. Taranmış ya da görsel yoğun bir PDF bu sınırı kolayca aşar. İyi haber: çoğu PDF, gözle görülür kalite kaybı olmadan önemli ölçüde küçültülebilir." },
        { t: "h2", x: "PDF neden büyür?" },
        { t: "p", x: "Dosya boyutunu en çok görseller belirler: yüksek çözünürlüklü taramalar, fotoğraflar ve gömülü resimler. Metin genelde çok az yer kaplar. Bu yüzden sıkıştırma, asıl olarak görselleri makul bir çözünürlüğe indirerek çalışır." },
        { t: "h2", x: "Adım adım sıkıştırma" },
        { t: "steps", items: [
          { title: "PDF'i araca yükleyin", x: "PDF Platform'un Sıkıştır aracını açın ve dosyanızı seçin." },
          { title: "Sıkıştırın", x: "Araç görselleri ve gereksiz veriyi optimize ederek boyutu düşürür." },
          { title: "Küçük dosyayı indirin", x: "Sonucu indirin — artık e-postaya ya da yüklemeye rahatça sığar." },
        ] },
        { t: "cta", title: "PDF Sıkıştır", x: "PDF'inizin boyutunu küçültüp kolayca paylaşın.", btn: "Aracı aç", tool: "/tools/compress" },
        { t: "tip", x: "En büyük kazanç taranmış belgelerde olur; salt metin PDF'lerde zaten dosya küçük olduğu için kazanç sınırlıdır." },
      ],
      faq: [
        { q: "PDF boyutu nasıl küçültülür?", a: "PDF'i Sıkıştır aracına yükleyin; araç görselleri optimize ederek boyutu düşürür ve küçültülmüş dosyayı indirirsiniz." },
        { q: "Sıkıştırma kaliteyi bozar mı?", a: "Amaç, gözle fark edilmeyecek düzeyde kalite ile en küçük boyutu yakalamaktır. Taranmış belgelerde küçülme yüksek, kalite kaybı düşüktür." },
        { q: "Neden PDF'im çok büyük?", a: "Genellikle yüksek çözünürlüklü taramalar ve fotoğraflar yüzünden. Sıkıştırma bu görselleri makul çözünürlüğe indirir." },
      ],
    },
    {
      title: "Reduce PDF File Size (Compress): Fit It Into an Email",
      description: "Shrink your PDF file size — share it without hitting email attachment limits and without noticeable quality loss. Why PDFs get big and how to compress them.",
      excerpt: "Email saying \"file too large\"? PDFs usually bloat because of the images inside. This post shows how to reduce the size and what to watch for.",
      blocks: [
        { t: "lead", x: "Most email services cap attachments at 20-25 MB. A scanned or image-heavy PDF easily exceeds that. The good news: most PDFs can be shrunk significantly without visible quality loss." },
        { t: "h2", x: "Why do PDFs get big?" },
        { t: "p", x: "Images dominate file size: high-resolution scans, photos and embedded images. Text takes very little space. So compression mainly works by bringing images down to a reasonable resolution." },
        { t: "h2", x: "Compress step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Open PDF Platform's Compress tool and select your file." },
          { title: "Compress", x: "The tool optimizes images and redundant data to reduce size." },
          { title: "Download the smaller file", x: "Download the result — it now fits into email or uploads comfortably." },
        ] },
        { t: "cta", title: "Compress PDF", x: "Reduce your PDF's size and share it easily.", btn: "Open the tool", tool: "/tools/compress" },
        { t: "tip", x: "The biggest gains are on scanned documents; text-only PDFs are already small, so savings are limited." },
      ],
      faq: [
        { q: "How do I reduce PDF size?", a: "Upload the PDF to the Compress tool; it optimizes images to reduce size and you download the smaller file." },
        { q: "Does compression ruin quality?", a: "The goal is the smallest size at a quality you won't notice. Scans shrink a lot with little visible loss." },
        { q: "Why is my PDF so large?", a: "Usually high-resolution scans and photos. Compression brings those images down to a reasonable resolution." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-sifre-kaldirma-koyma",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Güvenlik", "Şifre"], en: ["Security", "Password"] }, accent: "amber", tool: "/tools/unlock-pdf",
    },
    {
      title: "PDF Şifresini Kaldırma ve PDF'e Şifre Koyma",
      description: "Bildiğiniz bir PDF şifresini kaldırın ya da bir PDF'e şifre koyarak koruyun. İki işlemi de güvenli biçimde nasıl yapacağınızı anlatıyoruz.",
      excerpt: "Bir PDF'i her açışta şifre sormasından bıktıysanız ya da hassas bir belgeyi korumak istiyorsanız, ikisi de birkaç adımlık işler. İşte doğru yol.",
      blocks: [
        { t: "lead", x: "PDF şifresiyle ilgili iki farklı ihtiyaç vardır: bildiğiniz şifreyi kalıcı olarak kaldırmak ya da bir belgeye şifre ekleyerek onu korumak. İkisini de ayrı araçlarla yapabilirsiniz." },
        { t: "h2", x: "Şifreyi kaldırma (kilidi açma)" },
        { t: "p", x: "Sürekli şifre soran bir PDF'i her açışta parola girmeden kullanmak isterseniz, PDF Kilidini Aç aracıyla şifreyi kalıcı olarak kaldırabilirsiniz. Bunun için belgenin şifresini bilmeniz gerekir." },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "PDF Kilidini Aç aracına şifreli belgenizi ekleyin." },
          { title: "Şifreyi girin", x: "Belgenin mevcut şifresini girin — yalnız yetkili olduğunuz belgelerde." },
          { title: "Şifresiz dosyayı indirin", x: "Araç şifreyi kaldırır; artık her açışta parola sorulmaz." },
        ] },
        { t: "cta", title: "PDF Kilidini Aç", x: "Bildiğiniz şifreyi kaldırıp PDF'i serbestçe kullanın.", btn: "Aracı aç", tool: "/tools/unlock-pdf" },
        { t: "h2", x: "PDF'e şifre koyma (koruma)" },
        { t: "p", x: "Tam tersi: hassas bir sözleşme, sağlık raporu ya da mali belgeyi paylaşırken korumak isterseniz Şifrele aracıyla PDF'e açılış şifresi ekleyebilirsiniz. Böylece dosyayı yalnızca şifreyi bilenler açar." },
        { t: "cta", title: "PDF Şifrele", x: "Hassas belgenize açılış şifresi ekleyin.", btn: "Şifrele aracı", tool: "/tools/encrypt" },
        { t: "tip", x: "Yalnızca sahibi olduğunuz ya da açıkça yetkilendirildiğiniz belgelerin şifresini kaldırın." },
      ],
      faq: [
        { q: "PDF şifresi nasıl kaldırılır?", a: "PDF Kilidini Aç aracına belgeyi yükleyin, mevcut şifreyi girin ve şifresiz sürümü indirin. Şifreyi bilmeniz gerekir." },
        { q: "PDF'e nasıl şifre koyarım?", a: "Şifrele aracına belgeyi yükleyip bir açılış şifresi belirleyin; dosyayı yalnızca şifreyi bilenler açabilir." },
        { q: "Şifresini bilmediğim PDF'i açabilir miyim?", a: "Hayır. Bu araçlar yalnızca yetkili olduğunuz, şifresini bildiğiniz belgeler içindir." },
      ],
    },
    {
      title: "Remove a PDF Password and Add a Password to a PDF",
      description: "Remove a PDF password you know, or protect a PDF by adding a password. How to do both securely.",
      excerpt: "Tired of a PDF asking for a password every time, or want to protect a sensitive document? Both take just a few steps. Here's the right way.",
      blocks: [
        { t: "lead", x: "There are two different needs around PDF passwords: permanently removing a password you know, or adding a password to protect a document. You can do both with separate tools." },
        { t: "h2", x: "Removing a password (unlocking)" },
        { t: "p", x: "If a PDF keeps asking for a password and you want to use it without typing one each time, the Unlock PDF tool can remove the password permanently. You need to know the document's password." },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Add your password-protected document to the Unlock PDF tool." },
          { title: "Enter the password", x: "Enter the document's current password — only for documents you're authorized to." },
          { title: "Download the unlocked file", x: "The tool removes the password; no more prompt on each open." },
        ] },
        { t: "cta", title: "Unlock PDF", x: "Remove a password you know and use the PDF freely.", btn: "Open the tool", tool: "/tools/unlock-pdf" },
        { t: "h2", x: "Adding a password (protection)" },
        { t: "p", x: "The opposite: to protect a sensitive contract, medical report or financial document when sharing, the Encrypt tool lets you add an open password to a PDF, so only those who know it can open the file." },
        { t: "cta", title: "Encrypt PDF", x: "Add an open password to your sensitive document.", btn: "Encrypt tool", tool: "/tools/encrypt" },
        { t: "tip", x: "Only remove passwords from documents you own or are explicitly authorized to." },
      ],
      faq: [
        { q: "How do I remove a PDF password?", a: "Upload the document to Unlock PDF, enter the current password and download the unlocked version. You need to know the password." },
        { q: "How do I add a password to a PDF?", a: "Upload the document to the Encrypt tool and set an open password; only those who know it can open the file." },
        { q: "Can I open a PDF whose password I don't know?", a: "No. These tools are only for documents you're authorized to and whose password you know." },
      ],
    },
  ),

  post(
    {
      slug: "resimleri-pdf-yapma",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 4,
      tags: { tr: ["Görsel", "PDF Oluşturma"], en: ["Images", "Create PDF"] }, accent: "blue", tool: "/tools/image-to-pdf",
    },
    {
      title: "JPG/PNG Resimleri Tek PDF'e Dönüştürme (Ücretsiz)",
      description: "Telefonla çektiğiniz belgeleri ya da fotoğrafları tek bir PDF'te birleştirin. Üyeliksiz, ücretsiz ve dosyalarınız cihazınızdan çıkmadan.",
      excerpt: "Birden çok fotoğrafı ya da taramayı tek, düzenli bir PDF'te toplamak çok kolay. Üyeliksiz, ücretsiz ve tamamen tarayıcınızda — adım adım.",
      blocks: [
        { t: "lead", x: "Telefonla çektiğiniz evrak fotoğraflarını ya da taramaları e-posta ekine, başvuruya veya arşive uygun tek bir PDF haline getirmek istediğinizde, işi karmaşıklaştırmaya gerek yok." },
        { t: "h2", x: "Neden PDF yapmak daha iyi?" },
        { t: "p", x: "Birden çok JPG/PNG göndermek yerine tek PDF göndermek hem daha düzenli hem daha profesyoneldir: sıralı sayfalar, tek dosya, kolay yazdırma. Karşı taraf tek tıkla tümünü açar." },
        { t: "h2", x: "Adım adım Görsel → PDF" },
        { t: "steps", items: [
          { title: "Görselleri ekleyin", x: "Görsel → PDF aracına JPG/PNG dosyalarını sürükleyip bırakın. 80 MB'a kadar." },
          { title: "Sırayı düzenleyin", x: "Görsellerin sırasını ayarlayın; her görsel bir sayfa olacak." },
          { title: "PDF'i indirin", x: "\"PDF'e Çevir\" deyin; tek PDF anında hazırlanır." },
        ] },
        { t: "cta", title: "Görsel → PDF", x: "Fotoğraf ve taramaları tek PDF'te birleştirin — ücretsiz.", btn: "Aracı aç", tool: "/tools/image-to-pdf" },
        { t: "tip", x: "Bu araç tamamen tarayıcınızda çalışır — görselleriniz cihazınızdan çıkmaz, internete yüklenmez." },
      ],
      faq: [
        { q: "Resimleri PDF'e nasıl çeviririm?", a: "Görsel → PDF aracına JPG/PNG dosyalarını ekleyin, sırayı ayarlayın ve tek PDF olarak indirin. Her görsel bir sayfa olur." },
        { q: "Üye olmam gerekir mi?", a: "Hayır. Araç ücretsiz ve üyeliksizdir; işlem cihazınızda yapılır, dosyalarınız yüklenmez." },
        { q: "Kaç görsel ekleyebilirim?", a: "Toplam 80 MB'a kadar dilediğiniz sayıda görsel ekleyebilirsiniz." },
      ],
    },
    {
      title: "Convert JPG/PNG Images into One PDF (Free)",
      description: "Combine photos or scanned documents into a single PDF. Free, no signup, and your files never leave your device.",
      excerpt: "Combining multiple photos or scans into one tidy PDF is easy. Free, no signup and entirely in your browser — step by step.",
      blocks: [
        { t: "lead", x: "When you want to turn photos of documents or scans into a single PDF suitable for email, an application or your archive, there's no need to overcomplicate it." },
        { t: "h2", x: "Why make a PDF?" },
        { t: "p", x: "Instead of sending several JPG/PNG files, sending one PDF is tidier and more professional: ordered pages, one file, easy printing. The recipient opens everything in one click." },
        { t: "h2", x: "Image → PDF step by step" },
        { t: "steps", items: [
          { title: "Add images", x: "Drag and drop JPG/PNG files into the Image → PDF tool. Up to 80 MB." },
          { title: "Set the order", x: "Arrange the images; each becomes a page." },
          { title: "Download the PDF", x: "Click \"Convert to PDF\"; one PDF is ready instantly." },
        ] },
        { t: "cta", title: "Image → PDF", x: "Combine photos and scans into one PDF — free.", btn: "Open the tool", tool: "/tools/image-to-pdf" },
        { t: "tip", x: "This tool runs entirely in your browser — your images never leave your device or get uploaded." },
      ],
      faq: [
        { q: "How do I convert images to PDF?", a: "Add JPG/PNG files to the Image → PDF tool, set the order and download one PDF. Each image becomes a page." },
        { q: "Do I need an account?", a: "No. The tool is free and needs no signup; it runs on your device and your files aren't uploaded." },
        { q: "How many images can I add?", a: "As many as you like, up to 80 MB total." },
      ],
    },
  ),

  post(
    {
      slug: "uzun-belgeleri-ai-ile-ozetleme",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Yapay Zekâ", "Özetleme"], en: ["AI", "Summarize"] }, accent: "fuchsia", tool: "/tools/pdf-ozetle",
    },
    {
      title: "Uzun Sözleşme ve Raporları Yapay Zekâ ile Özetleme",
      description: "Uzun sözleşmeleri, ihaleleri ve raporları baştan sona okumadan; taraflar, tarihler, tutarlar ve çıkarımlarla özetleyin. Yapay zekâ ile hızlı ve doğru.",
      excerpt: "50 sayfalık bir sözleşmeyi okumaya vaktiniz yok mu? Yapay zekâ, belgenin türünü tanıyıp size en çok lazım olan bilgiyi çıkarır. İşte nasıl.",
      blocks: [
        { t: "lead", x: "Uzun bir sözleşme, ihale şartnamesi ya da rapor elinize geçtiğinde asıl soru şudur: \"Bana ne söylüyor, nelere dikkat etmeliyim?\" Yapay zekâ ile özet, tam da bu soruyu dakikalar yerine saniyelerde yanıtlar." },
        { t: "h2", x: "Sıradan özetten farkı ne?" },
        { t: "p", x: "İyi bir özet, belgeyi kısaltmakla kalmaz; türünü tanıyıp o türe en uygun bilgiyi öne çıkarır. PDF Platform'un AI Özet aracı ihale, sözleşme, akademik makale, mali rapor gibi türleri ayırt eder ve tarafları, önemli tarihleri, tutarları ve yükümlülükleri vurgular." },
        { t: "h2", x: "Adım adım özetleme" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Metin cihazınızda okunur; taranmış belgede OCR otomatik devreye girer. Dosyanız yüklenmez, yalnızca metni yapay zekâya gider." },
          { title: "\"Özet Oluştur\" deyin", x: "Yapay zekâ; başlık, taraflar, ana noktalar, kritik tarih/tutarlar ve çıkarımlarla yapılandırılmış bir özet üretir." },
          { title: "İndirin ya da paylaşın", x: "Özeti düzgün bir PDF olarak indirebilir ya da paylaşabilirsiniz." },
        ] },
        { t: "cta", title: "AI Özet", x: "Uzun belgeyi saniyeler içinde profesyonel bir özete çevirin.", btn: "Aracı aç", tool: "/tools/pdf-ozetle" },
        { t: "tip", x: "Özetten sonra belgeye özel bir sorunuz varsa AI Sohbet aracıyla doğrudan belgeye soru sorabilirsiniz." },
      ],
      faq: [
        { q: "PDF nasıl yapay zekâ ile özetlenir?", a: "PDF'i AI Özet aracına yükleyin; araç türünü tanır ve taraflar, tarihler, tutarlar ve çıkarımlarla yapılandırılmış bir özet üretir. Özeti PDF olarak indirebilirsiniz." },
        { q: "Taranmış belgeyi özetleyebilir miyim?", a: "Evet. Taranmış belgelerde OCR otomatik devreye girip yazıyı metne çevirir, sonra özet çıkarılır." },
        { q: "Özet güvenilir mi?", a: "Özet yalnızca belgedeki bilgiye dayanır; araç emin olmadığı veriyi yazmamak üzere yönlendirilmiştir." },
      ],
    },
    {
      title: "Summarize Long Contracts and Reports with AI",
      description: "Summarize long contracts, tenders and reports without reading them end to end — with parties, dates, amounts and takeaways. Fast and accurate with AI.",
      excerpt: "No time to read a 50-page contract? AI detects the document type and extracts what you most need. Here's how.",
      blocks: [
        { t: "lead", x: "When a long contract, tender or report lands on your desk, the real question is: \"What does it say, and what should I watch for?\" An AI summary answers exactly that in seconds instead of minutes." },
        { t: "h2", x: "How is it different from a plain summary?" },
        { t: "p", x: "A good summary doesn't just shorten the document; it detects its type and surfaces the most relevant information. PDF Platform's AI Summarize tool distinguishes tenders, contracts, academic papers and financial reports, and highlights parties, key dates, amounts and obligations." },
        { t: "h2", x: "Summarize step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Text is read on your device; OCR kicks in for scanned documents. Your file isn't uploaded — only the text goes to the AI." },
          { title: "Click \"Generate Summary\"", x: "The AI produces a structured summary with title, parties, key points, critical dates/amounts and takeaways." },
          { title: "Download or share", x: "Download the summary as a clean PDF or share it." },
        ] },
        { t: "cta", title: "AI Summarize", x: "Turn a long document into a professional summary in seconds.", btn: "Open the tool", tool: "/tools/pdf-ozetle" },
        { t: "tip", x: "After the summary, if you have a specific question about the document, use the AI Chat tool to ask it directly." },
      ],
      faq: [
        { q: "How do I summarize a PDF with AI?", a: "Upload the PDF to the AI Summarize tool; it detects the type and produces a structured summary with parties, dates, amounts and takeaways. You can download it as a PDF." },
        { q: "Can I summarize a scanned document?", a: "Yes. OCR runs automatically for scanned documents to turn the text into text, then the summary is generated." },
        { q: "Is the summary reliable?", a: "The summary relies only on the document's content; the tool is instructed not to state data it isn't sure about." },
      ],
    },
  ),

  post(
    {
      slug: "taranmis-pdf-metne-cevirme-ocr",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 4,
      tags: { tr: ["OCR", "Taranmış PDF"], en: ["OCR", "Scanned PDF"] }, accent: "violet", tool: "/tools/taranmis-pdf-ocr",
    },
    {
      title: "Taranmış PDF'i Düzenlenebilir Metne Çevirme (OCR)",
      description: "Taranmış ya da fotoğraf tabanlı PDF'lerdeki yazıyı OCR ile gerçek, aranabilir metne çevirin — Türkçe ve İngilizce, tarayıcınızda ve ücretsiz.",
      excerpt: "Taranmış bir PDF'te metni seçemiyor, arayamıyor musunuz? Çünkü o yazı aslında bir resim. OCR onu gerçek metne çevirir — işte nasıl.",
      blocks: [
        { t: "lead", x: "Bir belgeyi tarayıp PDF yaptığınızda, sayfadaki yazı aslında bir fotoğraftır. Bu yüzden metni seçemez, arayamaz ya da kopyalayamazsınız. OCR (Optik Karakter Tanıma) bu resmi gerçek metne çevirir." },
        { t: "h2", x: "OCR tam olarak ne yapar?" },
        { t: "p", x: "OCR, sayfa görüntüsündeki harf ve kelimeleri tanıyıp düzenlenebilir, aranabilir metne dönüştürür. Böylece taranmış bir sözleşmeyi, tapuyu ya da faturayı; özetleyebilir, içinde arama yapabilir veya başka bir belgeye kopyalayabilirsiniz." },
        { t: "h2", x: "Adım adım OCR" },
        { t: "steps", items: [
          { title: "Taranmış PDF'i yükleyin", x: "OCR aracına fotoğraf/tarama tabanlı PDF'inizi ekleyin." },
          { title: "Metne çevirin", x: "OCR sayfa görüntülerindeki yazıyı cihazınızda gerçek metne dönüştürür (Türkçe + İngilizce)." },
          { title: "Metni kullanın", x: "Artık metni arayabilir, kopyalayabilir; özetleme ya da çeviri araçlarına verebilirsiniz." },
        ] },
        { t: "cta", title: "Taranmış PDF → Metin (OCR)", x: "Taranmış belgedeki yazıyı gerçek metne çevirin.", btn: "Aracı aç", tool: "/tools/taranmis-pdf-ocr" },
        { t: "tip", x: "İşlem tamamen cihazınızda yapılır — belgeniz sunucuya yüklenmez. En iyi sonuç net, yüksek çözünürlüklü taramalarda alınır." },
      ],
      faq: [
        { q: "Taranmış PDF'teki yazı nasıl metne çevrilir?", a: "PDF'i OCR aracına yükleyin; OCR sayfa görüntülerindeki yazıyı tarayıcınızda gerçek metne dönüştürür. Sonra arayabilir, kopyalayabilir, özetleyebilirsiniz." },
        { q: "OCR hangi dilleri destekler?", a: "Türkçe ve İngilizce desteklenir. İşlem cihazınızda yapılır; belgeniz yüklenmez." },
        { q: "Neden taranmış PDF'te metni seçemiyorum?", a: "Çünkü o yazı aslında bir resimdir. OCR onu gerçek, seçilebilir metne çevirir." },
      ],
    },
    {
      title: "Convert a Scanned PDF into Editable Text (OCR)",
      description: "Turn text inside scanned or photo-based PDFs into real, searchable text with OCR — Turkish and English, in your browser and free.",
      excerpt: "Can't select or search text in a scanned PDF? That's because the text is actually an image. OCR turns it into real text — here's how.",
      blocks: [
        { t: "lead", x: "When you scan a document into a PDF, the text on the page is actually a photo. That's why you can't select, search or copy it. OCR (Optical Character Recognition) turns that image into real text." },
        { t: "h2", x: "What exactly does OCR do?" },
        { t: "p", x: "OCR recognizes the letters and words in the page image and converts them into editable, searchable text. So you can summarize, search within, or copy a scanned contract, deed or invoice." },
        { t: "h2", x: "OCR step by step" },
        { t: "steps", items: [
          { title: "Upload the scanned PDF", x: "Add your photo/scan-based PDF to the OCR tool." },
          { title: "Convert to text", x: "OCR turns the text in the page images into real text on your device (Turkish + English)." },
          { title: "Use the text", x: "Now search, copy, or feed it into summarize or translate tools." },
        ] },
        { t: "cta", title: "Scanned PDF → Text (OCR)", x: "Turn text in a scanned document into real text.", btn: "Open the tool", tool: "/tools/taranmis-pdf-ocr" },
        { t: "tip", x: "Processing happens entirely on your device — your document is not uploaded. Best results come from clear, high-resolution scans." },
      ],
      faq: [
        { q: "How do I convert scanned PDF text to text?", a: "Upload the PDF to the OCR tool; OCR turns the text in the page images into real text in your browser. Then you can search, copy or summarize it." },
        { q: "Which languages does OCR support?", a: "Turkish and English. Processing happens on your device; your document is not uploaded." },
        { q: "Why can't I select text in a scanned PDF?", a: "Because the text is actually an image. OCR turns it into real, selectable text." },
      ],
    },
  ),
];

/** Slug → post. */
export function getBlogPost(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}

/** Yeniden eskiye sıralı liste. */
export function getBlogPostsSorted() {
  return [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}
