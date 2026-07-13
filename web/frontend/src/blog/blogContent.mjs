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

  post(
    {
      slug: "ihale-sartnamesi-nasil-okunur",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 6,
      tags: { tr: ["İhale", "Yapay Zekâ"], en: ["Tenders", "AI"] }, accent: "fuchsia", tool: "/tools/pdf-ozetle",
    },
    {
      title: "İhale Şartnamesi Nasıl Okunur? Nelere Dikkat Etmeli",
      description: "İhale şartnamesindeki kritik maddeleri kaçırmadan okuyun: teminat, cayma bedeli, son teklif tarihi, istenen belgeler. Yapay zekâ ile şartnameyi dakikalar yerine saniyelerde kavrayın.",
      excerpt: "Onlarca sayfalık bir ihale şartnamesinde asıl önemli olan birkaç maddeyi kaçırmak pahalıya patlar. Yapay zekânın şartnameyi nasıl okunur hale getirdiğini anlatıyoruz.",
      blocks: [
        { t: "lead", x: "İhale şartnameleri uzun, teknik ve yoğundur; ama başarı ya da eleme çoğu zaman birkaç kritik maddeye bağlıdır. Bu yazıda bir şartnamede mutlaka bakmanız gerekenleri ve süreci nasıl hızlandıracağınızı anlatıyoruz." },
        { t: "h2", x: "Bir şartnamede mutlaka bakılması gerekenler" },
        { t: "ul", items: [
          "Taraflar: idare (ihaleyi açan) ve istekliden beklenenler.",
          "İş kapsamı: tam olarak ne isteniyor, teslim koşulları.",
          "İstenen belgeler ve yeterlilik kriterleri (iş deneyimi, kapasite).",
          "Teminat tutarı ve türü (geçici/kesin teminat).",
          "Son teklif tarihi ve saati — kaçırılırsa elenirsiniz.",
          "Cayma bedeli, gecikme cezası ve fesih şartları.",
          "Değerlendirme kriteri: en düşük fiyat mı, ekonomik açıdan en avantajlı teklif mi?",
        ] },
        { t: "h2", x: "Yapay zekâ ile şartnameyi saniyelerde kavrayın" },
        { t: "p", x: "PDF Platform'un AI Özet aracı belgenin ihale şartnamesi olduğunu tanır ve tam da yukarıdaki maddeleri — taraflar, teminat, son tarih, cayma bedeli, değerlendirme kriteri — öne çıkararak yapılandırılmış bir özet verir. Böylece 40 sayfayı okumadan neye teklif verdiğinizi görürsünüz." },
        { t: "steps", items: [
          { title: "Şartname PDF'ini yükleyin", x: "Metin cihazınızda okunur; taranmışsa OCR devreye girer." },
          { title: "\"Özet Oluştur\" deyin", x: "Taraflar, kritik tarih/tutarlar ve yükümlülükler vurgulanarak özet çıkar." },
          { title: "Belirsiz noktaları sorun", x: "\"Teminat oranı nedir?\" gibi bir sorunuz varsa AI Sohbet ile doğrudan belgeye sorabilirsiniz." },
        ] },
        { t: "cta", title: "AI ile Şartname Özeti", x: "İhale şartnamesindeki kritik maddeleri saniyeler içinde görün.", btn: "Aracı aç", tool: "/tools/pdf-ozetle" },
        { t: "tip", x: "Yapay zekâ özeti hızlı bir kavrayış içindir; nihai teklif ve hukuki değerlendirme için şartnamenin ilgili maddelerini asıl metninden teyit edin." },
      ],
      faq: [
        { q: "İhale şartnamesinde en çok neye dikkat edilmeli?", a: "Son teklif tarihi, teminat, istenen belgeler/yeterlilik, cayma bedeli ve değerlendirme kriteri. Bunları kaçırmak elenmeye yol açabilir." },
        { q: "Yapay zekâ şartnameyi özetleyebilir mi?", a: "Evet. AI Özet aracı şartnameyi tanır ve taraflar, teminat, son tarih, cayma bedeli gibi kritik maddeleri öne çıkarır." },
        { q: "Özet yeterli mi, asıl metni okumalı mıyım?", a: "Özet hızlı kavrayış içindir. Teklif vermeden önce kritik maddeleri şartnamenin asıl metninden teyit etmeniz önerilir." },
      ],
    },
    {
      title: "How to Read a Tender Document (RFP): What to Watch For",
      description: "Read the critical clauses in a tender/RFP without missing them: deposit, penalty, submission deadline, required documents. Grasp it in seconds with AI.",
      excerpt: "Missing a few key clauses in a long tender document is costly. Here's how AI makes an RFP readable in seconds.",
      blocks: [
        { t: "lead", x: "Tender documents are long, technical and dense; yet winning or being disqualified often hinges on a few critical clauses. This post covers what to always check and how to speed up the process." },
        { t: "h2", x: "What to always check in a tender" },
        { t: "ul", items: [
          "Parties: the awarding body and what's expected from the bidder.",
          "Scope: exactly what's required and delivery terms.",
          "Required documents and qualification criteria (experience, capacity).",
          "Deposit amount and type (bid/performance bond).",
          "Submission deadline and time — miss it and you're out.",
          "Withdrawal penalty, late penalties and termination clauses.",
          "Evaluation criteria: lowest price or most economically advantageous?",
        ] },
        { t: "h2", x: "Grasp the tender in seconds with AI" },
        { t: "p", x: "PDF Platform's AI Summarize tool recognizes the document as a tender and surfaces exactly those clauses — parties, deposit, deadline, penalty, evaluation criteria — as a structured summary. So you see what you're bidding on without reading 40 pages." },
        { t: "steps", items: [
          { title: "Upload the tender PDF", x: "Text is read on your device; OCR kicks in if scanned." },
          { title: "Click \"Generate Summary\"", x: "Get a summary highlighting parties, critical dates/amounts and obligations." },
          { title: "Ask about unclear points", x: "For a question like \"What's the deposit rate?\", use AI Chat to ask the document directly." },
        ] },
        { t: "cta", title: "AI Tender Summary", x: "See the critical clauses of a tender in seconds.", btn: "Open the tool", tool: "/tools/pdf-ozetle" },
        { t: "tip", x: "The AI summary is for quick comprehension; verify critical clauses in the original text before bidding or making a legal assessment." },
      ],
      faq: [
        { q: "What matters most in a tender document?", a: "Submission deadline, deposit, required documents/qualifications, penalties and evaluation criteria. Missing these can disqualify you." },
        { q: "Can AI summarize a tender?", a: "Yes. The AI Summarize tool recognizes tenders and surfaces critical clauses like parties, deposit, deadline and penalties." },
        { q: "Is the summary enough, or should I read the original?", a: "The summary is for quick comprehension. Verify critical clauses in the original text before bidding." },
      ],
    },
  ),

  post(
    {
      slug: "kira-kontrati-dikkat-edilecek-maddeler",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 6,
      tags: { tr: ["Sözleşme", "Yapay Zekâ"], en: ["Contracts", "AI"] }, accent: "blue", tool: "/tools/pdf-sohbet",
    },
    {
      title: "Kira Kontratı İmzalamadan Önce Dikkat Edilecek Maddeler",
      description: "Kira sözleşmesi imzalamadan önce bakmanız gereken maddeler: kira artışı, depozito, tahliye, aidat, sözleşme süresi. Yapay zekâ ile kontratı hızlıca anlayın.",
      excerpt: "Kira kontratını hızlıca imzalamadan önce birkaç madde ileride büyük fark yaratır. Nelere bakmalısınız ve yapay zekâ nasıl yardımcı olur?",
      blocks: [
        { t: "lead", x: "Kira sözleşmeleri genelde standart görünür, ama depozito iadesi, kira artış oranı ve tahliye şartları gibi maddeler ileride ciddi anlaşmazlıklara yol açabilir. İmzalamadan önce şu noktalara bakın." },
        { t: "h2", x: "Kira kontratında kontrol listesi" },
        { t: "ul", items: [
          "Kira bedeli, ödeme günü ve ödeme şekli.",
          "Kira artış oranı ve hangi endekse bağlı olduğu.",
          "Depozito tutarı ve iade koşulları.",
          "Sözleşme süresi ve yenileme/fesih şartları.",
          "Aidat, fatura ve tadilat sorumlulukları kimde?",
          "Tahliye koşulları ve bildirim süreleri.",
          "Demirbaş listesi ve mevcut hasarların kaydı.",
        ] },
        { t: "h2", x: "Yapay zekâya kontratı sorun" },
        { t: "p", x: "Uzun bir sözleşmede aradığınız maddeyi bulmak zaman alır. PDF Platform'un AI Sohbet aracıyla kontratı yükleyip doğrudan soru sorabilirsiniz: \"Kira artışı hangi orana bağlı?\", \"Depozito ne zaman iade ediliyor?\". Yapay zekâ yalnızca sözleşmedeki bilgiye dayanarak yanıtlar." },
        { t: "cta", title: "Sözleşmeye Soru Sor", x: "Kira kontratını yükleyip merak ettiğiniz maddeyi doğrudan sorun.", btn: "AI Sohbet'i aç", tool: "/tools/pdf-sohbet" },
        { t: "tip", x: "Yapay zekâ, sözleşmeyi anlamanıza yardımcı olur; hukuki bağlayıcılık ve anlaşmazlık durumunda bir avukata danışın. Bu araç hukuki danışmanlık yerine geçmez." },
      ],
      faq: [
        { q: "Kira kontratında en önemli maddeler nelerdir?", a: "Kira artış oranı, depozito iade koşulları, sözleşme süresi, tahliye/fesih şartları ve aidat/tadilat sorumlulukları." },
        { q: "Sözleşmedeki bir maddeyi yapay zekâya sorabilir miyim?", a: "Evet. AI Sohbet aracına kontratı yükleyip doğrudan soru sorabilirsiniz; yanıtlar yalnızca belgedeki bilgiye dayanır." },
        { q: "Yapay zekâ hukuki tavsiye verir mi?", a: "Hayır. Belgeyi anlamanıza yardımcı olur ama hukuki danışmanlık yerine geçmez; bağlayıcı konularda avukata danışın." },
      ],
    },
    {
      title: "What to Check Before Signing a Lease Agreement",
      description: "Clauses to review before signing a lease: rent increase, deposit, eviction, dues, term. Understand the contract quickly with AI.",
      excerpt: "Before quickly signing a lease, a few clauses make a big difference later. What to look for, and how AI helps.",
      blocks: [
        { t: "lead", x: "Leases often look standard, but clauses like deposit return, rent increase rate and eviction terms can cause serious disputes later. Check these before signing." },
        { t: "h2", x: "Lease checklist" },
        { t: "ul", items: [
          "Rent amount, payment day and method.",
          "Rent increase rate and which index it's tied to.",
          "Deposit amount and return conditions.",
          "Term and renewal/termination clauses.",
          "Who's responsible for dues, bills and repairs?",
          "Eviction conditions and notice periods.",
          "Inventory list and record of existing damage.",
        ] },
        { t: "h2", x: "Ask the AI about the contract" },
        { t: "p", x: "Finding a specific clause in a long contract takes time. With PDF Platform's AI Chat tool you can upload the lease and ask directly: \"What's the rent increase tied to?\", \"When is the deposit returned?\". The AI answers based only on the contract." },
        { t: "cta", title: "Ask Your Contract", x: "Upload the lease and ask the clause you care about directly.", btn: "Open AI Chat", tool: "/tools/pdf-sohbet" },
        { t: "tip", x: "AI helps you understand the contract; for legal validity and disputes, consult a lawyer. This tool is not a substitute for legal advice." },
      ],
      faq: [
        { q: "What are the most important clauses in a lease?", a: "Rent increase rate, deposit return conditions, term, eviction/termination clauses, and responsibility for dues/repairs." },
        { q: "Can I ask AI about a clause in the contract?", a: "Yes. Upload the lease to AI Chat and ask directly; answers rely only on the document's content." },
        { q: "Does AI give legal advice?", a: "No. It helps you understand the document but isn't a substitute for legal advice; consult a lawyer on binding matters." },
      ],
    },
  ),

  post(
    {
      slug: "banka-ekstresi-excele-aktarma",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Muhasebe", "Veri Çıkarma"], en: ["Accounting", "Data"] }, accent: "emerald", tool: "/tools/pdf-veri-cikar",
    },
    {
      title: "Banka Ekstresini (PDF) Excel'e Aktarma",
      description: "PDF banka ekstresindeki hareketleri Excel'e (CSV) aktarın — tarih, açıklama, tutar sütunlarıyla. Yapay zekâ ile elle yazmadan, hızlı ve düzenli.",
      excerpt: "PDF banka ekstresindeki yüzlerce hareketi elle Excel'e girmek işkence. Yapay zekâ ile bunu nasıl düzenli bir tabloya dökeceğinizi gösteriyoruz.",
      blocks: [
        { t: "lead", x: "Muhasebe kapanışı, harcama takibi ya da bütçe için banka ekstresindeki hareketleri Excel'de görmek gerekir. Ama bankaların PDF ekstresi düzgün bir tablo olarak gelmez; kopyala-yapıştır hizayı bozar." },
        { t: "h2", x: "Neden PDF ekstre Excel'e zor aktarılır?" },
        { t: "p", x: "PDF ekstrede satırlar göze düzenli görünse de arkada tablo yapısı yoktur. Bu yüzden kopyaladığınızda tarih, açıklama ve tutarlar tek hücreye ya da yanlış sütunlara düşer. Yapay zekâ bu yapıyı tanıyıp doğru sütunlara ayırır." },
        { t: "h2", x: "Adım adım ekstre → Excel" },
        { t: "steps", items: [
          { title: "Ekstre PDF'ini yükleyin", x: "AI Veri Çıkar aracına banka ekstrenizi ekleyin. Metin cihazınızda okunur." },
          { title: "\"Veriyi Çıkar\" deyin", x: "Yapay zekâ hareketleri tarih, açıklama ve tutar olarak yapılandırılmış tabloya döker." },
          { title: "CSV indirin", x: "Sonucu CSV olarak indirip Excel'de açın; artık filtreleyip toplayabilirsiniz." },
        ] },
        { t: "cta", title: "Ekstreyi Excel'e Aktar", x: "Banka ekstresindeki hareketleri düzenli bir tabloya dökün.", btn: "Aracı aç", tool: "/tools/pdf-veri-cikar" },
        { t: "tip", x: "Birden çok aya ait ekstreniz varsa AI Toplu İşlem ile hepsini işleyip tek CSV'de birleştirebilirsiniz." },
      ],
      faq: [
        { q: "PDF banka ekstresi Excel'e nasıl aktarılır?", a: "Ekstreyi AI Veri Çıkar aracına yükleyin; yapay zekâ hareketleri tarih/açıklama/tutar sütunlarına ayırır ve CSV olarak indirirsiniz." },
        { q: "Hareketler doğru sütunlara ayrılıyor mu?", a: "Evet. Yapay zekâ ekstrenin yapısını tanıyıp verileri ilgili sütunlara yerleştirir; kopyala-yapıştırdaki hiza bozulması yaşanmaz." },
        { q: "Verilerim güvende mi?", a: "PDF'inizin metni cihazınızda çıkarılır ve yalnızca metin işleme gider; dosyanın kendisi karşıya yüklenmez." },
      ],
    },
    {
      title: "Export a Bank Statement (PDF) to Excel",
      description: "Export transactions from a PDF bank statement into Excel (CSV) — with date, description and amount columns. Fast and tidy with AI, no manual typing.",
      excerpt: "Typing hundreds of transactions from a PDF bank statement into Excel is painful. Here's how AI turns it into a tidy table.",
      blocks: [
        { t: "lead", x: "For month-end accounting, expense tracking or budgeting, you need bank statement transactions in Excel. But banks' PDF statements don't come as a clean table; copy-paste breaks the alignment." },
        { t: "h2", x: "Why is a PDF statement hard to export?" },
        { t: "p", x: "Even if rows look organized in the PDF, there's no table structure behind them. So when you copy, dates, descriptions and amounts land in one cell or the wrong columns. AI recognizes the structure and splits it into the right columns." },
        { t: "h2", x: "Statement → Excel step by step" },
        { t: "steps", items: [
          { title: "Upload the statement PDF", x: "Add your bank statement to the Extract Data tool. Text is read on your device." },
          { title: "Click \"Extract Data\"", x: "The AI turns transactions into a structured table of date, description and amount." },
          { title: "Download CSV", x: "Download as CSV and open in Excel; now you can filter and total." },
        ] },
        { t: "cta", title: "Export Statement to Excel", x: "Turn bank statement transactions into a tidy table.", btn: "Open the tool", tool: "/tools/pdf-veri-cikar" },
        { t: "tip", x: "If you have statements for several months, use AI Batch to process them all and merge into one CSV." },
      ],
      faq: [
        { q: "How do I export a PDF bank statement to Excel?", a: "Upload it to the Extract Data tool; the AI splits transactions into date/description/amount columns and you download CSV." },
        { q: "Are transactions split into the right columns?", a: "Yes. The AI recognizes the statement structure and places data into the right columns — no copy-paste misalignment." },
        { q: "Is my data safe?", a: "Your PDF's text is extracted on your device and only text is processed; the file itself isn't uploaded." },
      ],
    },
  ),

  post(
    {
      slug: "yabanci-dildeki-sozlesmeyi-anlama",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Çeviri", "Sözleşme"], en: ["Translation", "Contracts"] }, accent: "violet", tool: "/tools/pdf-ceviri",
    },
    {
      title: "Yabancı Dildeki Sözleşmeyi Anlamanın Hızlı Yolu",
      description: "İngilizce ya da başka dildeki bir sözleşmeyi, raporu veya e-postayı hızlıca anlamak için pratik yöntem: yapay zekâ ile çeviri + özet, yapı korunarak.",
      excerpt: "Elinize yabancı dilde bir sözleşme geçti ve içeriğini hızlıca anlamanız mı gerekiyor? Çeviri ve özetin birlikte nasıl işe yaradığını anlatıyoruz.",
      blocks: [
        { t: "lead", x: "İş dünyasında yabancı dilde sözleşme, teklif ya da teknik doküman sıkça karşınıza çıkar. Her satırı sözlükle çevirmek yerine, belgeyi yapıyı bozmadan çevirip ana noktalarını çıkarabilirsiniz." },
        { t: "h2", x: "Önce çevir, sonra özetle" },
        { t: "p", x: "En verimli yaklaşım iki adımlıdır: (1) belgeyi anadilinize çevirin, (2) uzun ise ana noktalarını özetleyin. PDF Platform'da ikisini de yapabilirsiniz — çeviri yapıyı (başlık, liste, tablo) korur; özet ise taraflar, tarihler ve yükümlülükleri öne çıkarır." },
        { t: "steps", items: [
          { title: "Belgeyi çevirin", x: "AI Çeviri aracına PDF'i yükleyin, hedef dili seçin; yapı korunarak çevrilir, PDF olarak indirebilirsiniz." },
          { title: "Uzun ise özetleyin", x: "AI Özet ile çevrilmiş belgenin ana noktalarını, taraflarını ve kritik maddelerini çıkarın." },
          { title: "Takıldığınız yeri sorun", x: "Belirli bir maddeyi anlamak için AI Sohbet ile doğrudan soru sorun." },
        ] },
        { t: "cta", title: "AI Çeviri", x: "Yabancı dildeki belgeyi yapısını koruyarak çevirin.", btn: "Aracı aç", tool: "/tools/pdf-ceviri" },
        { t: "tip", x: "Yapay zekâ çevirisi hızlı anlama içindir; resmî/hukuki geçerlilik gereken belgelerde yeminli tercüman şarttır." },
      ],
      faq: [
        { q: "Yabancı dildeki sözleşmeyi nasıl hızlı anlarım?", a: "Önce AI Çeviri ile anadilinize çevirin, uzun ise AI Özet ile ana noktalarını çıkarın; takıldığınız maddeyi AI Sohbet'e sorabilirsiniz." },
        { q: "Çeviride sözleşmenin düzeni korunur mu?", a: "Evet. Başlıklar, listeler ve tablolar korunarak çevrilir; sonucu PDF olarak indirebilirsiniz." },
        { q: "Resmî işlemler için yeterli mi?", a: "Hızlı anlama için idealdir; noter/mahkeme gibi resmî geçerlilik gereken yerlerde yeminli tercüman gerekir." },
      ],
    },
    {
      title: "The Fast Way to Understand a Contract in a Foreign Language",
      description: "A practical method to quickly understand a contract, report or email in English or another language: AI translation + summary, with structure preserved.",
      excerpt: "Got a contract in a foreign language and need to grasp it fast? Here's how translation and summary work together.",
      blocks: [
        { t: "lead", x: "In business you often face contracts, proposals or technical docs in a foreign language. Instead of translating every line with a dictionary, you can translate the document without breaking its structure and extract its key points." },
        { t: "h2", x: "Translate first, then summarize" },
        { t: "p", x: "The most efficient approach is two steps: (1) translate the document into your language, (2) if it's long, summarize the key points. On PDF Platform you can do both — translation preserves structure (headings, lists, tables); the summary surfaces parties, dates and obligations." },
        { t: "steps", items: [
          { title: "Translate the document", x: "Upload the PDF to AI Translate, pick a target language; it translates preserving structure and you can download a PDF." },
          { title: "Summarize if long", x: "Use AI Summarize to extract the key points, parties and critical clauses of the translated document." },
          { title: "Ask about tricky parts", x: "Use AI Chat to ask directly about a specific clause you want to understand." },
        ] },
        { t: "cta", title: "AI Translate", x: "Translate a foreign-language document while preserving structure.", btn: "Open the tool", tool: "/tools/pdf-ceviri" },
        { t: "tip", x: "AI translation is for fast comprehension; documents needing official/legal validity require a sworn translator." },
      ],
      faq: [
        { q: "How do I quickly understand a foreign-language contract?", a: "First translate it with AI Translate, then if long extract key points with AI Summarize; ask AI Chat about any clause you're stuck on." },
        { q: "Is the layout preserved in translation?", a: "Yes. Headings, lists and tables are kept, and you can download the result as a PDF." },
        { q: "Is it enough for official use?", a: "It's ideal for fast understanding; official validity (notary/court) requires a sworn translator." },
      ],
    },
  ),

  post(
    {
      slug: "akademik-makale-ozetleme-literatur",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Akademik", "Özetleme"], en: ["Academic", "Summarize"] }, accent: "cyan", tool: "/tools/pdf-ozetle",
    },
    {
      title: "Akademik Makaleleri Hızlı Özetleme (Literatür Taraması İçin)",
      description: "Onlarca akademik makaleyi literatür taraması için hızlıca eleyin: araştırma sorusu, yöntem, bulgular ve sonucu yapay zekâ ile saniyeler içinde çıkarın.",
      excerpt: "Literatür taramasında en çok zaman, ilgisiz makaleleri elemekle kaybedilir. Yapay zekâ ile bir makalenin işinize yarayıp yaramadığını saniyelerde anlayın.",
      blocks: [
        { t: "lead", x: "Tez, ödev ya da araştırma için literatür taraması yaparken onlarca makaleyi tek tek okumak imkânsıza yakındır. Asıl beceri, hangi makalenin işinize yaradığını hızlıca ayıklamaktır." },
        { t: "h2", x: "Bir makalede hızlıca bakılacaklar" },
        { t: "ul", items: [
          "Araştırma sorusu / hipotez: ne soruyor?",
          "Yöntem: nasıl bir çalışma (deney, anket, meta-analiz)?",
          "Bulgular: ne buldu?",
          "Sonuç ve katkı: alana ne ekliyor, sınırlılıkları neler?",
        ] },
        { t: "h2", x: "Yapay zekâ ile eleme" },
        { t: "p", x: "PDF Platform'un AI Özet aracı akademik metni tanır ve araştırma sorusu, yöntem, bulgular ve sonuç ekseninde yapılandırılmış bir özet verir. Bir makalenin taramanıza uygun olup olmadığını okumadan görürsünüz." },
        { t: "cta", title: "AI Özet", x: "Makalenin işinize yarayıp yaramadığını saniyelerde görün.", btn: "Aracı aç", tool: "/tools/pdf-ozetle" },
        { t: "tip", x: "Çok sayıda makaleniz varsa AI Toplu İşlem ile hepsini birden özetleyip tek bir belgede toplayabilir, taramanızı hızlandırabilirsiniz. İntihal/atıf kurallarına dikkat edin — özet, kaynağı okumak ve doğru atıf yapmak yerine geçmez." },
      ],
      faq: [
        { q: "Akademik makale nasıl hızlı özetlenir?", a: "PDF'i AI Özet aracına yükleyin; araştırma sorusu, yöntem, bulgular ve sonuç ekseninde yapılandırılmış bir özet alırsınız." },
        { q: "Onlarca makaleyi birden özetleyebilir miyim?", a: "Evet. AI Toplu İşlem ile birçok makaleyi işleyip sonuçları tek belgede toplayabilirsiniz." },
        { q: "Özet, makaleyi okumanın yerine geçer mi?", a: "Hayır. Eleme ve hızlı kavrayış için idealdir; atıf yapacağınız kaynakları asıl metninden okumanız gerekir." },
      ],
    },
    {
      title: "Quickly Summarize Academic Papers (for Literature Review)",
      description: "Screen dozens of academic papers for a literature review fast: extract the research question, method, findings and conclusion with AI in seconds.",
      excerpt: "In a literature review, most time is lost screening out irrelevant papers. Use AI to tell in seconds whether a paper is useful.",
      blocks: [
        { t: "lead", x: "For a thesis, assignment or research, reading dozens of papers one by one is nearly impossible. The real skill is quickly screening which paper is useful to you." },
        { t: "h2", x: "What to check quickly in a paper" },
        { t: "ul", items: [
          "Research question / hypothesis: what does it ask?",
          "Method: what kind of study (experiment, survey, meta-analysis)?",
          "Findings: what did it find?",
          "Conclusion and contribution: what does it add, what are the limitations?",
        ] },
        { t: "h2", x: "Screening with AI" },
        { t: "p", x: "PDF Platform's AI Summarize tool recognizes academic text and gives a structured summary around research question, method, findings and conclusion. You see whether a paper fits your review without reading it." },
        { t: "cta", title: "AI Summarize", x: "See in seconds whether a paper is useful to you.", btn: "Open the tool", tool: "/tools/pdf-ozetle" },
        { t: "tip", x: "If you have many papers, use AI Batch to summarize them all and gather the results in one document to speed up your review. Mind plagiarism/citation rules — a summary is not a substitute for reading the source and citing correctly." },
      ],
      faq: [
        { q: "How do I quickly summarize an academic paper?", a: "Upload the PDF to AI Summarize; you get a structured summary around research question, method, findings and conclusion." },
        { q: "Can I summarize dozens of papers at once?", a: "Yes. With AI Batch you can process many papers and gather the results in one document." },
        { q: "Does a summary replace reading the paper?", a: "No. It's ideal for screening and quick comprehension; sources you cite must be read in full." },
      ],
    },
  ),

  post(
    {
      slug: "faturalari-toplu-muhasebeye-hazirlama",
      date: "2026-07-03", updated: "2026-07-03", readMinutes: 5,
      tags: { tr: ["Muhasebe", "Toplu İşlem"], en: ["Accounting", "Batch"] }, accent: "amber", tool: "/tools/ai-toplu-islem",
    },
    {
      title: "Onlarca Faturayı Muhasebeye Hazırlama (Toplu İşlem)",
      description: "Bir klasör dolusu PDF faturayı tek seferde işleyip verilerini tek bir Excel (CSV) tablosunda toplayın. Ay sonu muhasebe kapanışını saatlerden dakikalara indirin.",
      excerpt: "Ay sonu geldi, elinizde onlarca PDF fatura var ve hepsini tek tek muhasebeye girmeniz gerekiyor. Bunu toplu işlemle nasıl dakikalara indireceğinizi anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Küçük işletmeler ve serbest çalışanlar için ay sonu, PDF faturaları tek tek açıp muhasebe tablosuna girmekle geçer. Toplu işlemle bu iş, her faturayı ayrı ayrı açmadan, tek adımda hallolur." },
        { t: "h2", x: "Toplu işlem neyi çözer?" },
        { t: "p", x: "Tek fatura işlemek kolaydır; asıl dert onlarca faturayı arka arkaya işlemektir. AI Toplu İşlem, bir klasör dolusu faturayı sırayla işleyip her birinin verisini (fatura no, tarih, satıcı, tutar, KDV) çıkarır ve hepsini tek bir CSV tablosunda — her satır bir fatura olacak şekilde — birleştirir." },
        { t: "steps", items: [
          { title: "Faturaları toplu yükleyin", x: "AI Toplu İşlem aracına PDF faturalarınızı ekleyin (en fazla 25 dosya)." },
          { title: "\"Veri Çıkar\" modunu seçin", x: "İşlemi başlatın; her fatura için canlı ilerleme görürsünüz." },
          { title: "Tek CSV indirin", x: "Tüm faturaların verisi tek tabloda birleşir; Excel'de açıp muhasebeye aktarın." },
        ] },
        { t: "cta", title: "AI Toplu İşlem", x: "Onlarca faturayı tek seferde işleyip tek CSV olarak indirin.", btn: "Aracı aç", tool: "/tools/ai-toplu-islem" },
        { t: "tip", x: "Metin faturaların yanında taranmış faturalarınız varsa OCR otomatik devreye girer; yine de sonuçları kritik tutarlar açısından bir kez gözden geçirmeniz önerilir." },
      ],
      faq: [
        { q: "Onlarca faturayı tek seferde nasıl işlerim?", a: "AI Toplu İşlem aracına faturaları toplu yükleyin, \"Veri Çıkar\" modunu seçin ve başlatın; tüm faturaların verisi tek CSV'de birleşir." },
        { q: "Kaç fatura işleyebilirim?", a: "Tek seferde en fazla 25 dosya işlenebilir; daha fazlası için işlemi tekrarlayabilirsiniz." },
        { q: "Sonuçlar güvenilir mi?", a: "Yapay zekâ yalnızca belgedeki bilgiyi kullanır; yine de muhasebe kaydından önce kritik tutarları gözden geçirmeniz önerilir." },
      ],
    },
    {
      title: "Prepare Dozens of Invoices for Accounting (Batch)",
      description: "Process a whole folder of PDF invoices at once and gather their data into one Excel (CSV) table. Cut month-end accounting from hours to minutes.",
      excerpt: "Month-end is here, you have dozens of PDF invoices, and you need to enter them all into accounting. Here's how batch processing cuts it to minutes.",
      blocks: [
        { t: "lead", x: "For small businesses and freelancers, month-end is spent opening PDF invoices one by one and entering them into an accounting sheet. Batch processing handles this in one step, without opening each invoice separately." },
        { t: "h2", x: "What does batch solve?" },
        { t: "p", x: "Processing one invoice is easy; the real pain is dozens in a row. AI Batch processes a whole folder of invoices in turn, extracts each one's data (invoice no, date, seller, amount, VAT) and merges them into one CSV table — one row per invoice." },
        { t: "steps", items: [
          { title: "Bulk-upload invoices", x: "Add your PDF invoices to the AI Batch tool (up to 25 files)." },
          { title: "Choose \"Extract\" mode", x: "Start; you see live progress per invoice." },
          { title: "Download one CSV", x: "All invoices' data merge into one table; open in Excel and import into accounting." },
        ] },
        { t: "cta", title: "AI Batch", x: "Process dozens of invoices at once and download one CSV.", btn: "Open the tool", tool: "/tools/ai-toplu-islem" },
        { t: "tip", x: "If you have scanned invoices alongside text ones, OCR kicks in automatically; still, review results for critical amounts once." },
      ],
      faq: [
        { q: "How do I process dozens of invoices at once?", a: "Bulk-upload them to AI Batch, choose \"Extract\" mode and start; all invoices' data merge into one CSV." },
        { q: "How many invoices can I process?", a: "Up to 25 files at once; repeat for more." },
        { q: "Are the results reliable?", a: "The AI uses only the document's content; still, review critical amounts before posting to accounting." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-sayfa-silme",
      date: "2026-07-06",
      updated: "2026-07-06",
      readMinutes: 5,
      tags: { tr: ["PDF Düzenle", "Sayfa Sil", "Ücretsiz"], en: ["Edit PDF", "Delete Pages", "Free"] },
      accent: "blue",
      tool: "/tools/delete-pages",
    },
    {
      title: "PDF'ten Sayfa Silme: Üyeliksiz, Ücretsiz ve Cihazınızda (2026)",
      description:
        "PDF'ten istediğiniz sayfaları silmenin en kolay yolu — üyeliksiz, ücretsiz ve dosyanız cihazınızdan çıkmadan. Boş, gereksiz ya da hatalı sayfaları saniyeler içinde çıkarın.",
      excerpt:
        "Bir PDF'te boş, tekrar eden ya da istemediğiniz sayfalar mı var? Bunları silmek için pahalı programa veya üyeliğe gerek yok. İşte tamamen tarayıcınızda, adım adım.",
      blocks: [
        { t: "lead", x: "Taranmış bir evrakın arasına karışan boş sayfa, iki kez gelen bir belge ya da paylaşmadan önce çıkarmak istediğiniz bir bölüm… PDF'ten sayfa silmek çok yaygın bir ihtiyaç. İyi haber: bunun için ne program kurmanız ne de üye olmanız gerekiyor." },

        { t: "h2", x: "Ne zaman sayfa silmek gerekir?" },
        { t: "ul", items: [
          "Tarayıcının eklediği boş veya çift sayfaları temizlemek.",
          "Bir raporu paylaşmadan önce iç/gizli sayfaları çıkarmak.",
          "Birleştirdiğiniz belgede tekrar eden kapak sayfalarını atmak.",
          "Yalnızca gereken bölümü bırakıp gerisini silmek.",
        ] },

        { t: "h2", x: "Cihazda silmek neden daha iyi?" },
        { t: "p", x: "Çoğu online araç dosyanızı sunucusuna yükler. PDF Platform'da (giriş yapmadan, misafir olarak) sayfa silme işlemi tamamen tarayıcınızda çalışır — dosyanız internete hiç gönderilmez. Bu hem gizlilik hem hız demektir: yükleme beklemezsiniz, internet kesilse bile çalışır." },

        { t: "h2", x: "Adım adım: PDF'ten sayfa silme" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "\"Sayfa Sil\" aracına PDF'inizi sürükleyin. Tüm sayfalar küçük önizlemeler halinde listelenir." },
          { title: "Silinecek sayfaları seçin", x: "Çıkarmak istediğiniz sayfaların üzerine tıklayarak işaretleyin. Kalan sayfaların yeni sırasını anında görürsünüz." },
          { title: "İndirin", x: "Onaylayın ve temizlenmiş PDF'i indirin. Orijinal dosyanız değişmez; yeni bir kopya oluşturulur." },
        ] },

        { t: "cta", title: "Sayfa Sil", x: "Boş ya da gereksiz sayfaları saniyeler içinde çıkarın — üyeliksiz, cihazınızda.", btn: "Aracı aç", tool: "/tools/delete-pages" },

        { t: "h2", x: "İpuçları" },
        { t: "tip", x: "Çok sayfalı bir belgede yalnızca birkaç sayfayı tutmak istiyorsanız, silmek yerine \"PDF Böl\" aracıyla o sayfaları ayırmak daha hızlı olabilir." },
        { t: "ul", items: [
          "Sayfaların sırasını da değiştirmek istiyorsanız \"Sayfa Sırala\" aracını kullanın.",
          "Yanlışlıkla yanlış sayfayı seçerseniz, indirmeden önce seçimi kaldırabilirsiniz.",
          "İşlem cihazınızda olduğu için dosya boyutu makulse anında sonuç alırsınız.",
        ] },

        { t: "h2", x: "Gizlilik notu" },
        { t: "p", x: "Bu araç misafir olarak kullanıldığında tamamen tarayıcınızda çalışır; PDF'iniz sunucuya yüklenmez. Yapısal araçlarımızın çoğu (birleştir, böl, döndür, sırala) aynı şekilde cihazınızda çalışır." },
      ],
      faq: [
        { q: "PDF'ten sayfa silmek ücretsiz mi?", a: "Evet. Sayfa Sil aracı üyeliksiz ve ücretsizdir; işlem tarayıcınızda gerçekleşir, dosyanız yüklenmez." },
        { q: "Silinen sayfalar orijinal dosyayı bozar mı?", a: "Hayır. Orijinal PDF'iniz değişmeden kalır; araç, seçtiğiniz sayfalar çıkarılmış yeni bir kopya oluşturur." },
        { q: "Aynı anda birden çok sayfa silebilir miyim?", a: "Evet. İstediğiniz kadar sayfayı işaretleyip tek seferde çıkarabilirsiniz." },
      ],
    },
    {
      title: "How to Delete Pages from a PDF: Free, No Signup, On Your Device (2026)",
      description:
        "The easiest way to delete pages from a PDF — free, no signup and your file never leaves your device. Remove blank, duplicate or unwanted pages in seconds.",
      excerpt:
        "Got blank, duplicate or unwanted pages in a PDF? You don't need expensive software or an account to remove them. Here's how, entirely in your browser.",
      blocks: [
        { t: "lead", x: "A blank page from a scanner, a document that came in twice, or a section you want to remove before sharing… deleting PDF pages is a very common need. The good news: you don't have to install anything or sign up." },

        { t: "h2", x: "When do you need to delete pages?" },
        { t: "ul", items: [
          "Cleaning up blank or duplicate pages a scanner added.",
          "Removing internal/confidential pages before sharing a report.",
          "Dropping repeated cover pages in a merged document.",
          "Keeping only the section you need and removing the rest.",
        ] },

        { t: "h2", x: "Why deleting on your device is better" },
        { t: "p", x: "Most online tools upload your file to their servers. On PDF Platform (as a guest, no login) page deletion runs entirely in your browser — your file is never sent over the internet. That means both privacy and speed: no upload wait, and it works even offline." },

        { t: "h2", x: "Step by step: delete pages from a PDF" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Drop your PDF into the \"Delete Pages\" tool. Every page shows up as a thumbnail." },
          { title: "Select pages to remove", x: "Click the pages you want to drop. You'll instantly see the new order of the remaining pages." },
          { title: "Download", x: "Confirm and download the cleaned PDF. Your original file stays untouched; a new copy is created." },
        ] },

        { t: "cta", title: "Delete Pages", x: "Remove blank or unwanted pages in seconds — no signup, on your device.", btn: "Open the tool", tool: "/tools/delete-pages" },

        { t: "h2", x: "Tips" },
        { t: "tip", x: "If you only want to keep a few pages out of many, splitting those pages out with \"Split PDF\" may be faster than deleting the rest." },
        { t: "ul", items: [
          "To reorder pages too, use the \"Organize pages\" tool.",
          "Picked the wrong page? Just deselect it before downloading.",
          "Because it runs on your device, reasonably sized files finish instantly.",
        ] },

        { t: "h2", x: "Privacy note" },
        { t: "p", x: "Used as a guest, this tool runs entirely in your browser; your PDF is not uploaded. Most of our structural tools (merge, split, rotate, organize) work the same way, on your device." },
      ],
      faq: [
        { q: "Is deleting PDF pages free?", a: "Yes. The Delete Pages tool is free and needs no signup; it runs in your browser and your file isn't uploaded." },
        { q: "Does deleting pages damage the original file?", a: "No. Your original PDF stays unchanged; the tool creates a new copy with the selected pages removed." },
        { q: "Can I delete multiple pages at once?", a: "Yes. Select as many pages as you like and remove them in one go." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-dondurme-kaydetme",
      date: "2026-07-06",
      updated: "2026-07-06",
      readMinutes: 5,
      tags: { tr: ["PDF Düzenle", "Döndürme", "Ücretsiz"], en: ["Edit PDF", "Rotate", "Free"] },
      accent: "emerald",
      tool: "/tools/rotate-pdf",
    },
    {
      title: "Yan Dönmüş PDF'i Düzeltme: PDF Döndürme ve Kalıcı Kaydetme (2026)",
      description:
        "Yan ya da ters taranmış bir PDF'i doğru yöne çevirip kalıcı olarak kaydedin — üyeliksiz, ücretsiz ve cihazınızda. Tek sayfa ya da tüm belgeyi saniyeler içinde düzeltin.",
      excerpt:
        "Taradığınız belge yan mı çıktı? Görüntüleyicide çevirdiğinizde tekrar bozuluyor mu? PDF'i kalıcı olarak döndürüp doğru yönde kaydetmenin yolu — tamamen tarayıcınızda.",
      blocks: [
        { t: "lead", x: "Bir belgeyi tarayınca ya da telefonla çekince sayfaların yan veya ters çıkması çok sık yaşanır. PDF görüntüleyicide \"döndür\" demek çoğu zaman kalıcı olmaz — dosyayı bir daha açtığınızda yine yan durur. Kalıcı çözüm, sayfaları döndürüp öyle kaydetmektir." },

        { t: "h2", x: "Neden görüntüleyicide döndürmek yetmez?" },
        { t: "p", x: "Çoğu PDF görüntüleyicide döndürme yalnızca o anki görünümü değiştirir; dosyanın içindeki sayfa yönü değişmez. Bu yüzden dosyayı paylaştığınızda veya yazdırdığınızda yine yan görünür. Sayfayı gerçekten döndürüp kaydetmeniz gerekir." },

        { t: "h2", x: "Adım adım: PDF döndürme ve kaydetme" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "\"PDF Döndür\" aracına dosyanızı sürükleyin. Her sayfa küçük önizleme olarak gelir." },
          { title: "Yönü ayarlayın", x: "Her kartın üzerindeki sola/sağa döndür düğmeleriyle sayfaları 90°'lik adımlarla çevirin. Yalnızca yan olan sayfaları ya da tümünü düzeltebilirsiniz." },
          { title: "Kalıcı olarak indirin", x: "Onaylayıp indirin — yeni PDF artık doğru yönde kaydedilir; her açılışta düzgün görünür." },
        ] },

        { t: "cta", title: "PDF Döndür", x: "Yan taranmış sayfaları doğru yöne çevirip kalıcı kaydedin — cihazınızda, üyeliksiz.", btn: "Aracı aç", tool: "/tools/rotate-pdf" },

        { t: "h2", x: "İpuçları" },
        { t: "ul", items: [
          "Tek bir sayfa yan ise yalnızca onu döndürebilirsiniz; tüm belgeyi çevirmeniz gerekmez.",
          "Ters (180°) sayfaları iki kez döndürerek düzeltin.",
          "Döndürdükten sonra gereksiz sayfalar varsa \"Sayfa Sil\" aracıyla temizleyin.",
        ] },
        { t: "tip", x: "Döndürme işlemi misafir olarak tamamen tarayıcınızda çalışır; dosyanız sunucuya yüklenmez, internet kesilse bile çalışır." },

        { t: "h2", x: "Gizlilik notu" },
        { t: "p", x: "PDF Döndür aracı cihazınızda çalışır; belgeniz karşıya gönderilmez. Aynı şekilde birleştir, böl, sil ve sırala araçları da yapısal işlemleri tarayıcınızda yapar." },
      ],
      faq: [
        { q: "PDF döndürme kalıcı olur mu?", a: "Evet. Araç sayfayı gerçekten döndürüp öyle kaydeder; indirdiğiniz PDF her açılışta doğru yönde görünür." },
        { q: "Sadece bir sayfayı döndürebilir miyim?", a: "Evet. Her sayfayı ayrı ayrı sola/sağa döndürebilir ya da tümünü birden çevirebilirsiniz." },
        { q: "Dosyam yüklenmiyor mu?", a: "Misafir olarak kullanıldığında döndürme tarayıcınızda gerçekleşir; dosyanız internete gönderilmez." },
      ],
    },
    {
      title: "Fix a Sideways PDF: Rotate Pages and Save Permanently (2026)",
      description:
        "Rotate a sideways or upside-down scanned PDF to the right orientation and save it permanently — free, no signup, on your device. Fix one page or the whole file in seconds.",
      excerpt:
        "Did your scan come out sideways? Does rotating in the viewer reset every time? Here's how to rotate a PDF permanently and save it the right way up — entirely in your browser.",
      blocks: [
        { t: "lead", x: "When you scan or photograph a document, pages often come out sideways or upside-down. Hitting \"rotate\" in a PDF viewer usually isn't permanent — reopen the file and it's sideways again. The real fix is to rotate the pages and save them that way." },

        { t: "h2", x: "Why rotating in the viewer isn't enough" },
        { t: "p", x: "In most viewers, rotate only changes the current view; the page orientation inside the file stays the same. So when you share or print it, it looks sideways again. You need to actually rotate the page and save it." },

        { t: "h2", x: "Step by step: rotate and save a PDF" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Drop your file into the \"Rotate PDF\" tool. Each page appears as a thumbnail." },
          { title: "Set the orientation", x: "Use the rotate-left/right buttons on each card to turn pages in 90° steps. Fix only the sideways pages, or all of them." },
          { title: "Download permanently", x: "Confirm and download — the new PDF is saved in the correct orientation and looks right every time." },
        ] },

        { t: "cta", title: "Rotate PDF", x: "Turn sideways scans the right way up and save permanently — on your device, no signup.", btn: "Open the tool", tool: "/tools/rotate-pdf" },

        { t: "h2", x: "Tips" },
        { t: "ul", items: [
          "If only one page is sideways, rotate just that page — no need to turn the whole file.",
          "Fix upside-down (180°) pages by rotating twice.",
          "After rotating, clean up any unwanted pages with the \"Delete Pages\" tool.",
        ] },
        { t: "tip", x: "As a guest, rotation runs entirely in your browser; your file is not uploaded and it works even if your connection drops." },

        { t: "h2", x: "Privacy note" },
        { t: "p", x: "The Rotate PDF tool runs on your device; your document is not sent anywhere. Merge, split, delete and organize tools handle their structural work in your browser the same way." },
      ],
      faq: [
        { q: "Is PDF rotation permanent?", a: "Yes. The tool actually rotates the page and saves it that way; the downloaded PDF shows the right orientation every time you open it." },
        { q: "Can I rotate just one page?", a: "Yes. Rotate each page individually left/right, or turn them all at once." },
        { q: "Is my file uploaded?", a: "Used as a guest, rotation happens in your browser; your file isn't sent over the internet." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-sayfa-sirasi-degistirme",
      date: "2026-07-06",
      updated: "2026-07-06",
      readMinutes: 5,
      tags: { tr: ["PDF Düzenle", "Sayfa Sırala", "Ücretsiz"], en: ["Edit PDF", "Organize", "Free"] },
      accent: "violet",
      tool: "/tools/organize-pdf",
    },
    {
      title: "PDF Sayfa Sırasını Değiştirme: Sayfaları Yeniden Düzenleme (2026)",
      description:
        "PDF sayfalarını sürükleyerek yeniden sıralayın, karışık taranmış belgeleri düzeltin — üyeliksiz, ücretsiz ve cihazınızda. Adım adım rehber.",
      excerpt:
        "Sayfalar yanlış sırada mı tarandı? Bir sayfayı başa ya da sona mı almak istiyorsunuz? PDF sayfalarını yeniden düzenlemenin en kolay yolu — tamamen tarayıcınızda.",
      blocks: [
        { t: "lead", x: "Toplu tarayıcıdan ters sırayla çıkan belgeler, sonradan araya eklenmesi gereken bir sayfa ya da yalnızca daha mantıklı bir akış… PDF sayfalarının sırasını değiştirmek düşündüğünüzden çok daha kolay." },

        { t: "h2", x: "Ne zaman sayfa sıralamak gerekir?" },
        { t: "ul", items: [
          "Otomatik tarayıcının ters sırayla verdiği sayfaları düzeltmek.",
          "Bir eki ya da kapağı belgenin başına/sonuna taşımak.",
          "Birden çok belgeyi birleştirdikten sonra akışı düzenlemek.",
          "Sunumdan önce bölümleri mantıklı bir sıraya koymak.",
        ] },

        { t: "h2", x: "Adım adım: sayfaları yeniden düzenleme" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "\"Sayfa Sırala\" aracına dosyanızı sürükleyin. Sayfalar numaralı önizlemeler olarak gelir." },
          { title: "Yeni sırayı belirleyin", x: "Sayfaları yukarı/aşağı düğmeleriyle taşıyın ya da hedef konum numarasını girin. Yeni sırayı anında görürsünüz." },
          { title: "İndirin", x: "Onaylayın ve yeniden düzenlenmiş PDF'i indirin. Orijinal dosyanız değişmez." },
        ] },

        { t: "cta", title: "Sayfa Sırala", x: "Sayfaları saniyeler içinde yeniden düzenleyin — üyeliksiz, cihazınızda.", btn: "Aracı aç", tool: "/tools/organize-pdf" },

        { t: "h2", x: "İlgili araçlar" },
        { t: "ul", items: [
          "Sayfa çıkarmak istiyorsanız \"Sayfa Sil\" aracını kullanın.",
          "Yan sayfaları düzeltmek için \"PDF Döndür\".",
          "İki belgeyi tek dosyada toplamak için \"PDF Birleştir\".",
        ] },
        { t: "tip", x: "Sıralama işlemi misafir olarak tamamen tarayıcınızda çalışır; dosyanız sunucuya yüklenmez." },

        { t: "h2", x: "Gizlilik notu" },
        { t: "p", x: "Sayfa Sırala aracı cihazınızda çalışır; PDF'iniz karşıya gönderilmez. Yapısal araçlarımızın çoğu aynı gizlilik ilkesiyle tarayıcınızda çalışır." },
      ],
      faq: [
        { q: "PDF sayfalarının sırasını nasıl değiştiririm?", a: "Sayfa Sırala aracına PDF'i yükleyin, sayfaları yukarı/aşağı taşıyın ya da konum numarası girin, ardından yeniden düzenlenmiş dosyayı indirin." },
        { q: "Orijinal dosyam bozulur mu?", a: "Hayır. Orijinal PDF değişmez; araç yeni sıraya göre yeni bir kopya oluşturur." },
        { q: "Ücretsiz mi?", a: "Evet, üyeliksiz ve ücretsizdir; işlem tarayıcınızda gerçekleşir." },
      ],
    },
    {
      title: "Reorder PDF Pages: Rearrange a Document Easily (2026)",
      description:
        "Reorder PDF pages by moving them around, fix documents scanned out of order — free, no signup and on your device. A step-by-step guide.",
      excerpt:
        "Pages scanned in the wrong order? Want to move a page to the front or back? Here's the easiest way to rearrange PDF pages — entirely in your browser.",
      blocks: [
        { t: "lead", x: "Documents that come out of a batch scanner in reverse, a page that needs to be inserted later, or just a more logical flow… reordering PDF pages is far easier than you might think." },

        { t: "h2", x: "When do you need to reorder pages?" },
        { t: "ul", items: [
          "Fixing pages a batch scanner delivered in reverse order.",
          "Moving an annex or cover to the front/back of the document.",
          "Tidying the flow after merging several documents.",
          "Putting sections in a logical order before a presentation.",
        ] },

        { t: "h2", x: "Step by step: rearrange pages" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Drop your file into the \"Organize pages\" tool. Pages appear as numbered thumbnails." },
          { title: "Set the new order", x: "Move pages with the up/down buttons or type a target position number. You'll see the new order instantly." },
          { title: "Download", x: "Confirm and download the rearranged PDF. Your original file stays unchanged." },
        ] },

        { t: "cta", title: "Organize pages", x: "Rearrange pages in seconds — no signup, on your device.", btn: "Open the tool", tool: "/tools/organize-pdf" },

        { t: "h2", x: "Related tools" },
        { t: "ul", items: [
          "To remove pages, use the \"Delete Pages\" tool.",
          "To fix sideways pages, use \"Rotate PDF\".",
          "To combine two documents into one, use \"Merge PDF\".",
        ] },
        { t: "tip", x: "As a guest, reordering runs entirely in your browser; your file is not uploaded." },

        { t: "h2", x: "Privacy note" },
        { t: "p", x: "The Organize pages tool runs on your device; your PDF is not sent anywhere. Most of our structural tools follow the same privacy principle and work in your browser." },
      ],
      faq: [
        { q: "How do I change the order of PDF pages?", a: "Upload the PDF to the Organize pages tool, move pages up/down or type a position number, then download the rearranged file." },
        { q: "Will my original file be damaged?", a: "No. The original PDF stays unchanged; the tool creates a new copy in the new order." },
        { q: "Is it free?", a: "Yes, free and no signup; the work happens in your browser." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-bolme-sayfalara-ayirma",
      date: "2026-07-06",
      updated: "2026-07-06",
      readMinutes: 6,
      tags: { tr: ["PDF Düzenle", "Böl", "Ücretsiz"], en: ["Edit PDF", "Split", "Free"] },
      accent: "cyan",
      tool: "/tools/split-pdf",
    },
    {
      title: "PDF Bölme: Bir PDF'i Sayfalara veya Parçalara Ayırma (2026)",
      description:
        "Büyük bir PDF'i tek tek sayfalara ya da belirli aralıklara bölün — üyeliksiz, ücretsiz ve cihazınızda. İstediğiniz sayfaları ayrı dosya olarak çıkarın.",
      excerpt:
        "Kalın bir PDF'ten yalnızca birkaç sayfa mı lazım? Belgeyi bölümlere mi ayırmak istiyorsunuz? PDF bölmenin en kolay yolu — tamamen tarayıcınızda, adım adım.",
      blocks: [
        { t: "lead", x: "Bazen bir belgenin tamamına değil, yalnızca birkaç sayfasına ihtiyacınız olur: bir sözleşmenin imza sayfası, bir raporun tek bölümü ya da e-postayla göndermek için küçük bir parça. PDF bölme tam da bunun için var." },

        { t: "h2", x: "PDF bölmenin yaygın kullanımları" },
        { t: "ul", items: [
          "Kalın bir belgeden yalnızca gereken sayfaları çıkarmak.",
          "Tek PDF'i bölümlere ayırıp ayrı ayrı paylaşmak.",
          "E-posta eki için büyük dosyayı küçük parçalara bölmek.",
          "Her sayfayı ayrı bir PDF olarak kaydetmek.",
        ] },

        { t: "h2", x: "Adım adım: PDF bölme" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "\"PDF Böl\" aracına dosyanızı sürükleyin. Sayfalar önizleme ızgarasında listelenir." },
          { title: "Sayfaları/aralığı seçin", x: "Çıkarmak istediğiniz sayfaları işaretleyin. Seçtiğiniz sayfalar tek bir PDF'te toplanabilir ya da her biri ayrı dosya olarak hazırlanabilir." },
          { title: "İndirin", x: "Sonucu tek PDF olarak ya da ayrı dosyaları ZIP içinde indirin." },
        ] },

        { t: "cta", title: "PDF Böl", x: "İstediğiniz sayfaları ayırın — üyeliksiz, cihazınızda, saniyeler içinde.", btn: "Aracı aç", tool: "/tools/split-pdf" },

        { t: "h2", x: "Bölmek mi, silmek mi?" },
        { t: "p", x: "Yalnızca birkaç sayfayı tutmak istiyorsanız \"Böl\" aracıyla o sayfaları ayırmak en pratiğidir. Tersine, çoğu sayfayı tutup birkaçını atacaksanız \"Sayfa Sil\" daha hızlıdır. İkisi de cihazınızda çalışır." },

        { t: "h2", x: "İpuçları" },
        { t: "ul", items: [
          "Böldükten sonra parçaları tekrar tek dosyada toplamak için \"PDF Birleştir\" aracını kullanın.",
          "Sayfalar yanlış sıradaysa önce \"Sayfa Sırala\" ile düzeltin.",
          "İşlem tarayıcınızda olduğu için dosyanız internete gönderilmez.",
        ] },

        { t: "h2", x: "Gizlilik notu" },
        { t: "p", x: "PDF Böl aracı misafir olarak tamamen tarayıcınızda çalışır; dosyanız sunucuya yüklenmez. Yapısal araçlarımızın çoğu aynı ilkeyle cihazınızda çalışır." },
      ],
      faq: [
        { q: "PDF nasıl bölünür?", a: "PDF Böl aracına dosyayı yükleyin, çıkarmak istediğiniz sayfaları seçin ve tek PDF ya da ayrı dosyalar (ZIP) olarak indirin. İşlem tarayıcınızda gerçekleşir." },
        { q: "Her sayfayı ayrı PDF yapabilir miyim?", a: "Evet. Seçtiğiniz sayfaları ayrı dosyalar olarak hazırlayıp ZIP içinde indirebilirsiniz." },
        { q: "Ücretsiz ve gizli mi?", a: "Evet. Üyeliksiz, ücretsiz ve dosyanız cihazınızdan çıkmadan çalışır." },
      ],
    },
    {
      title: "Split a PDF: Separate a PDF into Pages or Parts (2026)",
      description:
        "Split a large PDF into single pages or specific ranges — free, no signup and on your device. Extract exactly the pages you need as separate files.",
      excerpt:
        "Need only a few pages from a thick PDF? Want to break a document into parts? Here's the easiest way to split a PDF — entirely in your browser, step by step.",
      blocks: [
        { t: "lead", x: "Sometimes you don't need a whole document, just a few pages: the signature page of a contract, a single section of a report, or a small part to email. Splitting a PDF is exactly for that." },

        { t: "h2", x: "Common uses for splitting a PDF" },
        { t: "ul", items: [
          "Extracting only the pages you need from a thick document.",
          "Breaking one PDF into sections to share separately.",
          "Splitting a large file into smaller parts for an email attachment.",
          "Saving each page as its own PDF.",
        ] },

        { t: "h2", x: "Step by step: split a PDF" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Drop your file into the \"Split PDF\" tool. Pages are listed in a preview grid." },
          { title: "Select pages/range", x: "Mark the pages you want. Selected pages can be combined into one PDF, or each saved as a separate file." },
          { title: "Download", x: "Download the result as a single PDF, or separate files inside a ZIP." },
        ] },

        { t: "cta", title: "Split PDF", x: "Pull out the pages you need — no signup, on your device, in seconds.", btn: "Open the tool", tool: "/tools/split-pdf" },

        { t: "h2", x: "Split or delete?" },
        { t: "p", x: "If you want to keep just a few pages, splitting them out is the most practical. Conversely, if you want to keep most pages and drop a few, \"Delete Pages\" is faster. Both run on your device." },

        { t: "h2", x: "Tips" },
        { t: "ul", items: [
          "To recombine parts into one file, use the \"Merge PDF\" tool.",
          "If pages are out of order, fix them first with \"Organize pages\".",
          "Because it runs in your browser, your file is not sent over the internet.",
        ] },

        { t: "h2", x: "Privacy note" },
        { t: "p", x: "As a guest, the Split PDF tool runs entirely in your browser; your file is not uploaded. Most of our structural tools follow the same principle and work on your device." },
      ],
      faq: [
        { q: "How do I split a PDF?", a: "Upload the file to the Split PDF tool, select the pages you want, and download as a single PDF or separate files (ZIP). The work happens in your browser." },
        { q: "Can I save each page as a separate PDF?", a: "Yes. You can prepare the selected pages as separate files and download them inside a ZIP." },
        { q: "Is it free and private?", a: "Yes. Free, no signup, and your file never leaves your device." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-e-imza-atma-nasil-yapilir",
      date: "2026-07-10",
      updated: "2026-07-10",
      readMinutes: 5,
      tags: { tr: ["İmza", "E-İmza", "Üyeliksiz"], en: ["Signature", "E-sign", "No sign-up"] },
      accent: "cyan",
      tool: "/tools/pdf-imzala",
    },
    {
      title: "PDF'e Elektronik İmza Atma: Ücretsiz ve Üyeliksiz (2026)",
      description:
        "PDF'e imza nasıl atılır? İmzanızı çizin, yazın veya görsel yükleyin; sözleşme ve formları saniyeler içinde imzalayın. İmzanız cihazınızdan çıkmaz — üyeliksiz ve ücretsiz.",
      excerpt:
        "Sözleşme, form ve dilekçeleri yazdırıp ıslak imzalayıp tekrar taramaya son. Bu rehberde PDF'e elektronik imzayı — imzayı çizerek, yazarak veya yükleyerek — cihazınızdan çıkmadan nasıl atacağınızı adım adım gösteriyoruz.",
      blocks: [
        { t: "lead", x: "Bir sözleşmeyi imzalamak için onu yazdırıp ıslak imza atıp tekrar taramak; hem zaman kaybı hem de kalite kaybıdır. PDF'e doğrudan elektronik imza atmak çok daha hızlı ve temizdir. İşte cihazınızdan çıkmadan, üyelik gerektirmeden bunu yapmanın yolu." },

        { t: "h2", x: "Elektronik imza nedir, e-imza (nitelikli) ile farkı ne?" },
        { t: "p", x: "Gündelik kullanımda \"PDF'e imza atmak\", belgeye imza görselinizi yerleştirmek demektir; sözleşme, teklif, kira formu, dilekçe gibi belgelerin büyük çoğunluğu için yeterlidir. Resmî kurumların istediği nitelikli elektronik imza (NES) ise ayrı bir e-imza cihazı/sertifikası gerektirir. Bu araç birinci türü — hızlı, görünür imza yerleştirmeyi — sağlar." },

        { t: "h2", x: "İmzanızı üç şekilde oluşturun" },
        { t: "p", x: "PDF İmzala aracı imzanızı üç yolla almanıza izin verir: fareyle/parmağınızla çizin, adınızı el yazısı fontuyla yazın veya hazır bir imza görselini (şeffaf PNG en iyisi) yükleyin." },
        { t: "ul", items: ["Çiz: dokunmatik ekranda parmağınızla en doğal sonuç.", "Yaz: adınız el yazısı fontuna dönüşür.", "Yükle: kaşe/imza görselinizi ekleyin."] },

        { t: "h2", x: "Adım adım: PDF'e imza atma" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "İmzalanacak sözleşme veya formu sürükleyip bırakın ya da seçin. Dosya tarayıcınızda açılır." },
          { title: "İmzanızı oluşturun", x: "«İmza Ekle» ile imzanızı çizin, yazın veya yükleyin. İmza oluşur oluşmaz sayfanın ortasına yerleşir." },
          { title: "Yerleştirin ve ayarlayın", x: "İmzayı sürükleyerek istediğiniz yere taşıyın, köşeden boyutlandırın, üstteki tutamakla döndürün; gerekirse saydamlığını ayarlayın. Tarih veya metin de ekleyebilirsiniz." },
          { title: "Uygulayın ve indirin", x: "Çok sayfalıysa «Tüm sayfalara uygula» ile aynı yere kopyalayın, sonra «Uygula ve İndir» deyin. İmzalı PDF hazır." },
        ] },

        { t: "tip", x: "İmzanız ve dosyanız sunucuya GİTMEZ — imzalama tamamen tarayıcınızda (cihazınızda) yapılır. Bu yüzden gizli belgeleri de gönül rahatlığıyla imzalayabilirsiniz." },

        { t: "cta", title: "PDF İmzala", x: "Sözleşmenizi saniyeler içinde imzalayın — üyeliksiz, cihazınızda.", btn: "Aracı aç", tool: "/tools/pdf-imzala" },

        { t: "h2", x: "Aynı imzayı birden çok sayfaya koyma" },
        { t: "p", x: "Çok sayfalı sözleşmelerde her sayfanın altına imza gerekebilir. İmzanızı bir sayfaya yerleştirip «Tüm sayfalara uygula» dediğinizde, aynı imza tüm sayfalarda aynı hizaya kopyalanır. Bir öğeyi kopyalayıp başka yere yapıştırmak için Ctrl+C / Ctrl+V kısayollarını da kullanabilirsiniz." },

        { t: "h2", x: "İmza + tarih + metin birlikte" },
        { t: "p", x: "İmzanın yanına tarih ve serbest metin (ör. \"Okudum, onaylıyorum\") de ekleyebilirsiniz. Metin rengini istediğiniz gibi seçebilir, konumunu sürükleyerek ayarlayabilirsiniz — hepsi tek geçişte PDF'e gömülür." },
      ],
      faq: [
        { q: "PDF'e nasıl imza atarım?", a: "PDF'i yükleyin, «İmza Ekle» ile imzanızı çizin/yazın/yükleyin; imza sayfaya yerleşir. Sürükleyerek konumlandırın, köşeden boyutlandırın, «Uygula ve İndir» deyin. Tümü tarayıcınızda çalışır." },
        { q: "İmzam sunucuya yükleniyor mu?", a: "Hayır. İmzalama tamamen cihazınızda yapılır; PDF ve imza asla karşıya yüklenmez. %100 gizli ve üyeliksizdir." },
        { q: "Birden çok sayfaya aynı imzayı atabilir miyim?", a: "Evet. İmzayı bir sayfaya yerleştirip «Tüm sayfalara uygula» dediğinizde aynı imza tüm sayfalarda aynı hizaya eklenir." },
      ],
    },
    {
      title: "How to Sign a PDF Electronically: Free, No Sign-up (2026)",
      description:
        "How to sign a PDF: draw, type or upload your signature and sign contracts and forms in seconds. Your signature never leaves your device — no sign-up, free.",
      excerpt:
        "Stop printing, wet-signing and re-scanning contracts. This guide shows how to sign a PDF electronically — by drawing, typing or uploading your signature — without your file ever leaving your device.",
      blocks: [
        { t: "lead", x: "Printing a contract, signing it by hand and scanning it back is slow and lossy. Signing the PDF directly is far faster and cleaner. Here's how to do it without your file leaving your device and without an account." },
        { t: "h2", x: "Electronic signature vs. qualified e-signature" },
        { t: "p", x: "In everyday use, \"signing a PDF\" means placing your signature image on the document — enough for most contracts, quotes, rental forms and letters. A qualified electronic signature (QES) required by some authorities needs a separate certificate/device. This tool provides the first kind: quick, visible signature placement." },
        { t: "h2", x: "Create your signature three ways" },
        { t: "p", x: "The Sign PDF tool lets you capture your signature by drawing with the mouse/finger, typing your name in a handwriting font, or uploading a signature image (transparent PNG works best)." },
        { t: "ul", items: ["Draw: most natural with a finger on touch screens.", "Type: your name becomes a handwriting font.", "Upload: add your stamp/signature image."] },
        { t: "h2", x: "Step by step: sign a PDF" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Drag and drop or choose the contract or form to sign. The file opens in your browser." },
          { title: "Create your signature", x: "Click «Add signature» to draw, type or upload it. It's placed in the center of the page as soon as it's created." },
          { title: "Place and adjust", x: "Drag it where you want, resize from the corner, rotate with the top handle, and adjust opacity if needed. You can also add a date or text." },
          { title: "Apply and download", x: "For multi-page files use «Apply to all pages» to copy it to the same spot, then click «Apply & download». Your signed PDF is ready." },
        ] },
        { t: "tip", x: "Your signature and file are NOT uploaded — signing happens entirely in your browser (on your device), so you can sign confidential documents safely." },
        { t: "cta", title: "Sign PDF", x: "Sign your contract in seconds — no sign-up, on your device.", btn: "Open the tool", tool: "/tools/pdf-imzala" },
        { t: "h2", x: "Put the same signature on every page" },
        { t: "p", x: "Multi-page contracts often need a signature on each page. Place your signature once and click «Apply to all pages» to copy it to the same position across all pages. You can also use Ctrl+C / Ctrl+V to copy an item elsewhere." },
        { t: "h2", x: "Signature + date + text together" },
        { t: "p", x: "You can add a date and free text (e.g. \"Read and approved\") next to the signature, pick any text color, and position everything by dragging — all burned into the PDF in one pass." },
      ],
      faq: [
        { q: "How do I sign a PDF?", a: "Upload the PDF, click «Add signature» to draw/type/upload it; it's placed on the page. Drag to position, resize from the corner, then «Apply & download». Everything runs in your browser." },
        { q: "Is my signature uploaded to a server?", a: "No. Signing happens entirely on your device; the PDF and signature are never uploaded. It's 100% private and needs no sign-up." },
        { q: "Can I put the same signature on multiple pages?", a: "Yes. Place it on one page and click «Apply to all pages» to add it at the same position across all pages." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-filigran-ekleme",
      date: "2026-07-10",
      updated: "2026-07-10",
      readMinutes: 4,
      tags: { tr: ["Filigran", "Watermark", "Belge"], en: ["Watermark", "Branding", "Document"] },
      accent: "sky",
      tool: "/tools/watermark",
    },
    {
      title: "PDF'e Filigran Ekleme: Metin, Renk ve Saydamlık Ayarıyla",
      description:
        "PDF'e filigran nasıl eklenir? \"TASLAK\", \"GİZLİ\" veya şirket adınızı; renk, yazı tipi ve saydamlık ayarıyla belgenin üzerine yerleştirin. Hızlı ve pratik.",
      excerpt:
        "Bir belgeyi \"TASLAK\" veya \"GİZLİ\" olarak işaretlemek, ya da paylaştığınız PDF'lere şirket adınızı basmak istiyorsanız filigran en pratik yoldur. Renk, yazı tipi ve saydamlığı ayarlayarak dakikalar içinde nasıl ekleyeceğinizi anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Filigran; bir PDF'in üzerine yarı saydam bir yazı basarak belgenin durumunu (taslak, gizli, kopya) veya sahibini belirtmenin en hızlı yoludur. Sözleşme paylaşırken, teklif gönderirken ya da belge sızıntısını caydırmak isterken işe yarar." },

        { t: "h2", x: "Filigran ne işe yarar?" },
        { t: "ul", items: ["Belge durumunu belirtir: TASLAK, GİZLİ, ONAYLANMADI.", "Sahiplik/marka basar: şirket adınız veya web siteniz.", "İzinsiz paylaşımı caydırır: yarı saydam metin ekran görüntüsünde de kalır."] },

        { t: "h2", x: "Adım adım: PDF'e filigran ekleme" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Filigran eklemek istediğiniz belgeyi seçin." },
          { title: "Filigran metnini yazın", x: "\"TASLAK\", \"GİZLİ\" ya da şirket adınız gibi bir metin girin." },
          { title: "Renk, yazı tipi ve saydamlığı ayarlayın", x: "Rengi (#RRGGBB), yazı tipini ve saydamlığı belgeyi okunur bırakacak şekilde seçin." },
          { title: "Önizleyip indirin", x: "Sonucu önizleyin, uygun görünüyorsa filigranlı PDF'i indirin." },
        ] },

        { t: "tip", x: "Saydamlığı çok düşük (koyu) tutarsanız filigran metni okumayı zorlaştırır; çok yüksek (soluk) tutarsanız fark edilmez. %10–20 arası çoğu belge için idealdir." },

        { t: "cta", title: "Filigran Ekle", x: "Belgenize TASLAK, GİZLİ veya markanızı dakikalar içinde basın.", btn: "Aracı aç", tool: "/tools/watermark" },

        { t: "h2", x: "Filigrandan sonra: koruma ve numaralandırma" },
        { t: "p", x: "Filigran, belgeyi görsel olarak işaretler ama düzenlenmesini engellemez. Belgeyi gerçekten korumak istiyorsanız parola ile şifreleyebilir; resmî belgelerde sayfa numarası da ekleyebilirsiniz. Bu araçlar birbirini tamamlar." },
        { t: "ul", items: ["Parola korumak için: PDF Şifrele.", "Sayfa numarası için: Sayfa Numarası Ekle.", "İmza gerekiyorsa: PDF İmzala."] },
      ],
      faq: [
        { q: "PDF'e filigran nasıl eklenir?", a: "PDF'i Filigran aracına yükleyin, filigran metnini (ör. TASLAK) yazın, renk/yazı tipi/saydamlığı seçin, önizleyip indirin." },
        { q: "Filigranın rengini ve saydamlığını değiştirebilir miyim?", a: "Evet. Filigran metninin rengini (#RRGGBB), yazı tipini ve saydamlığını belgeyi okunur bırakacak şekilde ayarlayabilirsiniz." },
        { q: "Filigran belgeyi korur mu?", a: "Filigran belgeyi görsel olarak işaretler ama düzenlemeyi engellemez. Gerçek koruma için PDF'i parolayla şifreleyin." },
      ],
    },
    {
      title: "How to Add a Watermark to a PDF: Text, Color and Opacity",
      description:
        "How to add a watermark to a PDF: place \"DRAFT\", \"CONFIDENTIAL\" or your company name over the document with color, font and opacity control. Fast and simple.",
      excerpt:
        "Whether you want to mark a document as \"DRAFT\" or \"CONFIDENTIAL\", or stamp your company name on shared PDFs, a watermark is the quickest way. Here's how to add one in minutes with color, font and opacity control.",
      blocks: [
        { t: "lead", x: "A watermark stamps a semi-transparent line of text over a PDF to signal its status (draft, confidential, copy) or its owner. It's handy when sharing contracts, sending quotes or discouraging leaks." },
        { t: "h2", x: "What is a watermark good for?" },
        { t: "ul", items: ["State the status: DRAFT, CONFIDENTIAL, NOT APPROVED.", "Stamp ownership/brand: your company name or website.", "Discourage sharing: the semi-transparent text stays visible in screenshots too."] },
        { t: "h2", x: "Step by step: add a watermark" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Choose the document you want to watermark." },
          { title: "Type the watermark text", x: "Enter text such as \"DRAFT\", \"CONFIDENTIAL\" or your company name." },
          { title: "Set color, font and opacity", x: "Pick the color (#RRGGBB), font and an opacity that keeps the document readable." },
          { title: "Preview and download", x: "Preview the result and, if it looks right, download the watermarked PDF." },
        ] },
        { t: "tip", x: "Too dark (low opacity) makes text hard to read; too faint (high opacity) and it's barely visible. 10–20% works for most documents." },
        { t: "cta", title: "Add Watermark", x: "Stamp DRAFT, CONFIDENTIAL or your brand in minutes.", btn: "Open the tool", tool: "/tools/watermark" },
        { t: "h2", x: "After the watermark: protect and number" },
        { t: "p", x: "A watermark marks a document visually but doesn't prevent editing. To really protect it, encrypt with a password; for official documents you can also add page numbers. These tools complement each other." },
        { t: "ul", items: ["To password-protect: Encrypt PDF.", "For page numbers: Add Page Numbers.", "If you need a signature: Sign PDF."] },
      ],
      faq: [
        { q: "How do I add a watermark to a PDF?", a: "Upload the PDF to the Watermark tool, type the watermark text (e.g. DRAFT), choose color/font/opacity, preview and download." },
        { q: "Can I change the watermark color and opacity?", a: "Yes. You can set the watermark text's color (#RRGGBB), font and opacity so the document stays readable." },
        { q: "Does a watermark protect the document?", a: "A watermark marks the document visually but doesn't prevent editing. For real protection, encrypt the PDF with a password." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-uzerine-yazma-isaretleme",
      date: "2026-07-10",
      updated: "2026-07-10",
      readMinutes: 5,
      tags: { tr: ["İşaretleme", "Vurgu", "Not"], en: ["Markup", "Highlight", "Notes"] },
      accent: "amber",
      tool: "/tools/pdf-yorumla",
    },
    {
      title: "PDF Üzerine Yazma ve İşaretleme: Vurgu, Not ve Çizim",
      description:
        "PDF üzerine nasıl yazılır ve işaretlenir? Fosforlu kalemle vurgu, serbest çizim, kutu, ok ve metin notu ekleyin. Yazı silinmez, her şey cihazınızda işlenir — üyeliksiz.",
      excerpt:
        "Bir belgeyi incelerken önemli yerleri işaretlemek, kenara not düşmek veya bir yeri kutuya almak istersiniz. PDF İşaretle aracıyla fosforlu vurgu, çizim, kutu, ok ve metin notunu — yazıyı silmeden, cihazınızdan çıkmadan — nasıl ekleyeceğinizi gösteriyoruz.",
      blocks: [
        { t: "lead", x: "Bir sözleşmeyi, ödevi ya da raporu incelerken kalem elinizde olsun istersiniz: önemli cümleyi fosforlu boyayın, kenara not düşün, bir maddeyi kutuya alın, bir yeri okla gösterin. PDF İşaretle bunu tarayıcıda, dosyanız cihazınızdan çıkmadan yapmanızı sağlar." },

        { t: "h2", x: "Hangi işaretleme araçları var?" },
        { t: "ul", items: ["Fosforlu: metnin üzerini yarı saydam boyar; alttaki yazı okunur kalır.", "Kalem: serbest çizim; düz çizgi modu da var.", "Kutu ve Ok: bir bölgeyi çerçeveleyin veya işaret edin.", "Metin: kenara veya belge üzerine not yazın."] },

        { t: "h2", x: "Adım adım: PDF'i işaretleme" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "İşaretlemek istediğiniz belgeyi sürükleyip bırakın ya da seçin." },
          { title: "Bir araç ve renk seçin", x: "Fosforlu, kalem, kutu, ok veya metin; ardından bir renk ve kalınlık seçin." },
          { title: "Sayfada çizin", x: "Sürükleyerek işaretleyin. Fosforlu/kalemde «Düz» modu satırların üstünü düzgün çekmenizi sağlar." },
          { title: "Düzenleyin ve indirin", x: "«Seç» aracıyla bir işareti taşıyın, boyutlandırın, rengini değiştirin; Ctrl+Z ile geri alın. «Uygula ve İndir» deyin." },
        ] },

        { t: "tip", x: "İşaretlemeler belgenin ÜZERİNE eklenir; mevcut yazı asla silinmez veya değişmez. Fosforlu ve kalem yarı saydam olduğundan altındaki metin okunmaya devam eder." },

        { t: "cta", title: "PDF İşaretle", x: "Belgenizi fosforlu, çizim ve notlarla işaretleyin — cihazınızda, üyeliksiz.", btn: "Aracı aç", tool: "/tools/pdf-yorumla" },

        { t: "h2", x: "İnceleme ve iş birliği için pratik" },
        { t: "p", x: "İşaretli PDF'i indirip e-postayla paylaşabilirsiniz; karşı taraf herhangi bir PDF görüntüleyicide notlarınızı görür. Bir imza da gerekiyorsa PDF İmzala, metin düzeltmesi gerekiyorsa PDF Düzenle araçlarıyla aynı belgede devam edebilirsiniz." },
      ],
      faq: [
        { q: "PDF üzerine nasıl yazılır/işaretlenir?", a: "PDF'i İşaretle aracına yükleyin, fosforlu/kalem/kutu/ok/metin araçlarından birini seçip sayfada sürükleyin. «Uygula ve İndir» ile işaretli PDF'i alın. Tümü tarayıcınızda çalışır." },
        { q: "Yazının üzerini boyayınca metin silinir mi?", a: "Hayır. İşaretlemeler üste eklenir; mevcut yazı silinmez. Fosforlu ve kalem yarı saydam olduğundan alttaki yazı görünür kalır." },
        { q: "Yaptığım işareti geri alabilir/düzenleyebilir miyim?", a: "Evet. Ctrl+Z ile geri alabilir; «Seç» aracıyla bir işareti sonradan taşıyabilir, boyutlandırabilir veya rengini değiştirebilirsiniz." },
      ],
    },
    {
      title: "How to Write and Mark Up a PDF: Highlight, Note and Draw",
      description:
        "How to write on and mark up a PDF: add highlighter marks, freehand drawing, boxes, arrows and text notes. The text stays intact and everything runs on your device — no sign-up.",
      excerpt:
        "Reviewing a document, you want to highlight what matters, jot a note in the margin or box a clause. Markup PDF lets you add highlights, drawings, boxes, arrows and text notes — without erasing the text and without your file leaving your device.",
      blocks: [
        { t: "lead", x: "Reviewing a contract, an assignment or a report, you want a pen in hand: highlight the key sentence, jot a note, box a clause, point with an arrow. Markup PDF lets you do this in the browser, with your file never leaving your device." },
        { t: "h2", x: "Which markup tools are there?" },
        { t: "ul", items: ["Highlighter: paints over text semi-transparently; the text below stays readable.", "Pen: freehand drawing, with a straight-line mode too.", "Box and Arrow: frame a region or point to it.", "Text: write a note in the margin or on the document."] },
        { t: "h2", x: "Step by step: mark up a PDF" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Drag and drop or choose the document you want to mark up." },
          { title: "Pick a tool and color", x: "Highlighter, pen, box, arrow or text; then choose a color and thickness." },
          { title: "Draw on the page", x: "Drag to mark. Marker/pen offer a «Straight» mode to draw cleanly over lines of text." },
          { title: "Edit and download", x: "Use «Select» to move, resize or recolor a mark; undo with Ctrl+Z. Then «Apply & download»." },
        ] },
        { t: "tip", x: "Marks are added ON TOP of the document; existing text is never removed or changed. Highlighter and pen are semi-transparent, so the text below stays readable." },
        { t: "cta", title: "Markup PDF", x: "Mark up your document with highlights, drawings and notes — on your device, no sign-up.", btn: "Open the tool", tool: "/tools/pdf-yorumla" },
        { t: "h2", x: "Handy for review and collaboration" },
        { t: "p", x: "Download the marked-up PDF and share it by email; the other side sees your notes in any PDF viewer. If you also need a signature use Sign PDF, and for text corrections use Edit PDF on the same document." },
      ],
      faq: [
        { q: "How do I write on / mark up a PDF?", a: "Upload the PDF to the Markup tool, pick highlighter/pen/box/arrow/text and drag on the page. Click «Apply & download» to get the marked-up PDF. Everything runs in your browser." },
        { q: "Does highlighting over text erase it?", a: "No. Marks are added on top; existing text is not removed. Highlighter and pen are semi-transparent, so the text below stays visible." },
        { q: "Can I undo or edit a mark I made?", a: "Yes. Undo with Ctrl+Z; use the «Select» tool to move, resize or recolor a mark afterwards." },
      ],
    },
  ),

  post(
    {
      slug: "telefonla-belge-tarama-pdf",
      date: "2026-07-13",
      updated: "2026-07-13",
      readMinutes: 6,
      tags: { tr: ["Belge Tarama", "Mobil", "PDF"], en: ["Scanning", "Mobile", "PDF"] },
      accent: "cyan",
      tool: "/tools/image-to-pdf",
    },
    {
      title: "Telefonla Belge Tarama: Uygulamasız, Ücretsiz ve Cihazınızda (2026)",
      description:
        "Telefonunuzun kamerasıyla belge tarayıp PDF yapın — uygulama kurmadan, tarayıcıda. Kenarlar otomatik bulunur, perspektif düzeltilir ve dosyanız cihazınızdan çıkmaz.",
      excerpt:
        "Bir sözleşmeyi, faturayı ya da not kağıdını hızlıca dijitalleştirmek için ayrı bir uygulama kurmanıza gerek yok. Telefonunuzun tarayıcısından belgeyi çekin; kenarları otomatik bulunsun, perspektifi düzelsin ve tek dokunuşla PDF olsun — hepsi cihazınızda.",
      blocks: [
        { t: "lead", x: "Elinizde kağıt bir belge var ve onu hızlıca PDF yapmanız gerekiyor. Çoğu kişi bunun için mağazadan bir tarayıcı uygulaması indirir; reklamlar, üyelik ekranları ve dosyalarını buluta yükleyen izinlerle uğraşır. Oysa telefonunuzun tarayıcısında, hiçbir şey kurmadan, belgeyi çekip düzgün bir PDF'e çevirebilirsiniz — üstelik dosyanız cihazınızdan hiç çıkmadan." },

        { t: "h2", x: "Neden tarayıcıda ve cihazda?" },
        { t: "p", x: "Uygulama kurmak yer kaplar, güncelleme ister ve çoğu tarama uygulaması belgenizi işlemek için sunucularına gönderir. PDF Platform'un belge tarayıcısı ise doğrudan telefon tarayıcınızda açılır ve tüm işlemi — kenar bulma, perspektif düzeltme, PDF oluşturma — cihazınızda yapar. Bu, iki büyük fark demektir: kurulum yok ve belgeniz internete yüklenmez." },

        { t: "h2", x: "Nasıl çalışır? Adım adım" },
        { t: "steps", items: [
          { title: "Ana sayfada «Belge Tara»ya dokunun", x: "Telefonunuzda pdfplatform.app'i açın; araç seçicinin üstündeki «📸 Kamerayla Belge Tara» düğmesine dokunun. Kamera izni verin." },
          { title: "Kamerayı belgeye doğrultun", x: "Belgenin kenarları canlı olarak yeşil çerçeveyle işaretlenir. Telefonu sabit tuttuğunuzda sistem belgeyi kendiliğinden yakalar — deklanşöre basmanıza gerek yok." },
          { title: "Filtreyi seçin, köşeleri onaylayın", x: "Renkli, Gri veya Siyah-Beyaz arasından seçin. Otomatik bulunan köşeler hazırdır; istersen parmakla ince ayar yapabilirsin." },
          { title: "PDF'i oluşturun", x: "Tek sayfa ya da birden çok sayfa ekleyin, ardından «PDF Oluştur» deyin. Sonuçta Kaydet, Paylaş veya PDF araçlarında açma seçenekleri çıkar." },
        ] },

        { t: "tip", x: "Kenar tespiti tamamen otomatiktir: belgeyi çerçeveye alıp sabit tutmanız yeterli. Işık iyiyse ve belge zeminden ayrıştıysa kenarlar anında bulunur; bulunamazsa köşeleri elle sürükleyerek düzeltebilirsiniz." },

        { t: "h2", x: "Çok sayfalı belgeleri tek PDF'te toplayın" },
        { t: "p", x: "Bir sözleşmenin tüm sayfalarını ya da bir defter dolusu notu arka arkaya tarayıp tek bir PDF'te birleştirebilirsiniz. Her sayfa tarandıkça küçük bir önizleme olarak eklenir; sırasını görür, istemediğinizi silersiniz. Ücretsiz planda tek taramada 3 sayfaya kadar tarayabilir; sınırsız sayfa için Pro'ya geçebilirsiniz." },

        { t: "cta", title: "Görsel → PDF", x: "Zaten çektiğiniz fotoğraflar varsa onları da saniyeler içinde tek PDF'e çevirin — cihazınızda, üyeliksiz.", btn: "Aracı aç", tool: "/tools/image-to-pdf" },

        { t: "h2", x: "Gizlilik: belgeniz cihazınızdan çıkmaz" },
        { t: "p", x: "Kimlik, sözleşme, fatura gibi belgeleri tararken en büyük endişe, dosyanın bir sunucuya gitmesidir. Burada böyle bir şey olmaz: kamera görüntüsü, kenar tespiti ve PDF oluşturma tamamen tarayıcınızda çalışır. Oluşan PDF yalnızca sizin kaydettiğiniz veya paylaştığınız yere gider." },
      ],
      faq: [
        { q: "Telefonla belge taramak için uygulama gerekir mi?", a: "Hayır. pdfplatform.app'i telefon tarayıcınızda açıp «Belge Tara»ya dokunmanız yeterli. Kurulum, üyelik ya da uygulama mağazası gerekmez." },
        { q: "Belgenin kenarlarını kendim mi seçmem gerekiyor?", a: "Hayır, kenarlar otomatik bulunur. Kamerayı belgeye doğrultup sabit tuttuğunuzda sistem belgeyi kendiliğinden yakalar; gerekirse köşeleri elle düzeltebilirsiniz." },
        { q: "Taradığım belge sunucuya yüklenir mi?", a: "Hayır. Tarama, kenar tespiti ve PDF oluşturma tamamen cihazınızda çalışır; belgeniz internete gönderilmez." },
        { q: "Birden çok sayfayı tek PDF yapabilir miyim?", a: "Evet. Sayfaları arka arkaya tarayıp tek PDF'te birleştirebilirsiniz. Ücretsizde tek taramada 3 sayfa; sınırsız sayfa Pro özelliğidir." },
      ],
    },
    {
      title: "Scan Documents with Your Phone: No App, Free, On Your Device (2026)",
      description:
        "Scan documents to PDF with your phone camera — no app to install, right in the browser. Edges are detected automatically, perspective is fixed and your file never leaves your device.",
      excerpt:
        "You don't need a separate app to digitize a contract, invoice or note. Capture the document from your phone's browser; edges are detected, perspective is corrected and it becomes a PDF in one tap — all on your device.",
      blocks: [
        { t: "lead", x: "You have a paper document and need it as a PDF fast. Most people install a scanner app for this and deal with ads, sign-up screens and permissions that upload their files to the cloud. But you can capture and convert a document to a clean PDF right in your phone's browser, with nothing to install — and your file never leaves your device." },
        { t: "h2", x: "Why in the browser and on-device?" },
        { t: "p", x: "Installing an app takes space, needs updates, and most scanner apps send your document to their servers for processing. PDF Platform's document scanner opens right in your phone browser and does everything — edge detection, perspective correction, PDF creation — on your device. That means two big wins: no install and your document is never uploaded." },
        { t: "h2", x: "How it works, step by step" },
        { t: "steps", items: [
          { title: "Tap «Scan document» on the homepage", x: "Open pdfplatform.app on your phone and tap the «📸 Scan a document with camera» button above the tool picker. Allow camera access." },
          { title: "Point the camera at the document", x: "The document's edges are marked live with a green outline. Hold steady and the system captures it by itself — no shutter press needed." },
          { title: "Pick a filter, confirm the corners", x: "Choose Color, Gray or Black & White. The auto-detected corners are ready; fine-tune them with your finger if you like." },
          { title: "Create the PDF", x: "Add one page or several, then tap «Create PDF». You'll get options to Save, Share or open it in the PDF tools." },
        ] },
        { t: "tip", x: "Edge detection is fully automatic: just frame the document and hold still. With good light and clear contrast the edges snap instantly; if not, drag the corners to adjust." },
        { t: "h2", x: "Combine multi-page documents into one PDF" },
        { t: "p", x: "Scan every page of a contract or a notebook back-to-back and merge them into a single PDF. Each page appears as a small preview as you go; you can see the order and remove any you don't want. The free plan scans up to 3 pages per scan; upgrade to Pro for unlimited pages." },
        { t: "cta", title: "Image → PDF", x: "Already have photos? Turn them into a single PDF in seconds — on your device, no sign-up.", btn: "Open the tool", tool: "/tools/image-to-pdf" },
        { t: "h2", x: "Privacy: your document stays on your device" },
        { t: "p", x: "The biggest worry when scanning IDs, contracts or invoices is the file going to a server. That doesn't happen here: the camera frame, edge detection and PDF creation all run in your browser. The resulting PDF only goes where you save or share it." },
      ],
      faq: [
        { q: "Do I need an app to scan documents with my phone?", a: "No. Just open pdfplatform.app in your phone browser and tap «Scan document». No install, sign-up or app store needed." },
        { q: "Do I have to select the document edges myself?", a: "No, edges are detected automatically. Point the camera at the document and hold steady; the system captures it by itself. You can adjust the corners by hand if needed." },
        { q: "Is my scanned document uploaded to a server?", a: "No. Scanning, edge detection and PDF creation all run on your device; your document is never sent to the internet." },
        { q: "Can I make one PDF from several pages?", a: "Yes. Scan pages back-to-back and merge them into one PDF. Free allows 3 pages per scan; unlimited pages is a Pro feature." },
      ],
    },
  ),

  post(
    {
      slug: "aranabilir-pdf-olusturma-ocr",
      date: "2026-07-13",
      updated: "2026-07-13",
      readMinutes: 6,
      tags: { tr: ["OCR", "Aranabilir PDF", "Tarama"], en: ["OCR", "Searchable PDF", "Scanning"] },
      accent: "violet",
      tool: "/tools/taranmis-pdf-ocr",
    },
    {
      title: "Aranabilir PDF Nasıl Oluşturulur? OCR ile Ctrl+F'te Bulunan Belgeler",
      description:
        "Taranmış bir belge aslında bir resimdir; içinde arama yapılamaz. OCR ile görünmez metin katmanı ekleyerek PDF'i aranabilir yapın — Türkçe destekli, tamamen cihazınızda.",
      excerpt:
        "Telefonla taradığınız belge göze yazı gibi görünse de aslında bir fotoğraftır; Ctrl+F ile arayamaz, metni kopyalayamazsınız. Aranabilir PDF, görüntünün üzerine görünmez bir metin katmanı ekleyerek bunu çözer. Nasıl yapıldığını anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Bir belgeyi tarayıp PDF yaptığınızda, o PDF içindeki yazı bilgisayar için metin değil, sadece piksellerden oluşan bir resimdir. Bu yüzden belgede kelime aratamaz, bir cümleyi seçip kopyalayamazsınız. «Aranabilir PDF» tam olarak bu sorunu çözer." },

        { t: "h2", x: "Aranabilir PDF nedir?" },
        { t: "p", x: "Aranabilir PDF, taranan görüntünün tam üzerine hizalanmış, gözle görünmeyen bir metin katmanı gömülmüş PDF'tir. Belge göze aynı görünür — fotoğrafı görürsünüz — ama arkada gerçek, seçilebilir metin durur. Böylece Ctrl+F ile kelime arayabilir, metni seçip kopyalayabilir; arşiv ve doküman sistemleri de belgenin içeriğine göre arama yapabilir." },

        { t: "h2", x: "OCR bu işi nasıl yapar?" },
        { t: "p", x: "OCR (Optik Karakter Tanıma), görüntüdeki yazıyı «okur» ve her kelimenin metnini ve konumunu çıkarır. Ardından bu kelimeler, görüntünün üzerine tam kendi konumlarına, görünmez biçimde yerleştirilir. Sonuç: görünüşü bozulmamış ama içi aranabilir bir belge." },

        { t: "h2", x: "PDF Platform'da aranabilir PDF yapmak" },
        { t: "steps", items: [
          { title: "Belgeyi tarayın veya yükleyin", x: "Telefonla belge tarayıcısını kullanın ya da elinizdeki taranmış PDF'i açın." },
          { title: "«Aranabilir PDF yap» deyin", x: "Belge tarayıcıda PDF'i oluşturduktan sonra «🔍 Aranabilir PDF yap» seçeneğini kullanın; metin cihazınızda tanınır (Türkçe + İngilizce)." },
          { title: "Kaydedin ve arayın", x: "Oluşan PDF'i kaydedin. Artık herhangi bir PDF görüntüleyicide Ctrl+F ile kelime arayabilir, metni kopyalayabilirsiniz." },
        ] },

        { t: "tip", x: "OCR tamamen cihazınızda çalışır — Türkçe karakterler dahil (ş, ğ, ı, İ). Belgeniz metne çevrilmek için hiçbir sunucuya gönderilmez. Aranabilir PDF üretimi bir Pro özelliğidir." },

        { t: "cta", title: "Taranmış PDF → Metin (OCR)", x: "Yalnızca metni mi istiyorsunuz? Taranmış PDF'i cihazınızda düz metne çevirin.", btn: "OCR aracını aç", tool: "/tools/taranmis-pdf-ocr" },

        { t: "h2", x: "Nerede işe yarar?" },
        { t: "ul", items: ["Arşivleme: yüzlerce taranmış belge arasında kelimeyle arama yapabilmek.", "Hukuk ve muhasebe: sözleşme veya faturada bir tutarı/maddeyi anında bulmak.", "Öğrenciler: ders notu fotoğraflarında konu araması.", "Erişilebilirlik: ekran okuyucuların belgeyi okuyabilmesi."] },
      ],
      faq: [
        { q: "Aranabilir PDF ile normal taranmış PDF farkı nedir?", a: "Normal taranmış PDF bir resimdir; içinde arama yapılamaz. Aranabilir PDF'te görüntünün üzerine görünmez bir metin katmanı gömülüdür, böylece Ctrl+F ile arama ve kopyalama çalışır." },
        { q: "Türkçe karakterlerde çalışır mı?", a: "Evet. OCR Türkçe + İngilizce destekler ve ş, ğ, ı, İ gibi karakterler doğru şekilde aranabilir metne dönüştürülür." },
        { q: "Belgem sunucuya gönderilir mi?", a: "Hayır. OCR ve metin katmanı gömme işlemi tamamen cihazınızda yapılır; belgeniz internete yüklenmez." },
        { q: "Belgenin görünüşü değişir mi?", a: "Hayır. Metin katmanı görünmezdir; belge göze tıpatıp aynı görünür, sadece artık aranabilir ve kopyalanabilir olur." },
      ],
    },
    {
      title: "How to Create a Searchable PDF: OCR So You Can Find Text with Ctrl+F",
      description:
        "A scanned document is really an image — you can't search it. Add an invisible text layer with OCR to make the PDF searchable — Turkish supported, entirely on your device.",
      excerpt:
        "A document you scan with your phone looks like text but is actually a photo; you can't search it with Ctrl+F or copy the text. A searchable PDF fixes this by adding an invisible text layer over the image. Here's how.",
      blocks: [
        { t: "lead", x: "When you scan a document to PDF, the text inside is not text to a computer — it's an image made of pixels. That's why you can't search for a word or select and copy a sentence. A «searchable PDF» solves exactly this." },
        { t: "h2", x: "What is a searchable PDF?" },
        { t: "p", x: "A searchable PDF has an invisible text layer embedded right over the scanned image, aligned to each word. The document looks the same — you see the photo — but real, selectable text sits behind it. So you can search with Ctrl+F, select and copy text; archive and document systems can also search by content." },
        { t: "h2", x: "How does OCR do it?" },
        { t: "p", x: "OCR (Optical Character Recognition) «reads» the text in the image and extracts each word's text and position. Those words are then placed invisibly over the image at their exact positions. The result: a document that looks untouched but is searchable inside." },
        { t: "h2", x: "Making a searchable PDF on PDF Platform" },
        { t: "steps", items: [
          { title: "Scan or upload the document", x: "Use the phone document scanner, or open a scanned PDF you already have." },
          { title: "Choose «Make searchable»", x: "After creating the PDF in the scanner, use «🔍 Make searchable»; text is recognized on your device (Turkish + English)." },
          { title: "Save and search", x: "Save the resulting PDF. Now you can search with Ctrl+F and copy text in any PDF viewer." },
        ] },
        { t: "tip", x: "OCR runs entirely on your device — including Turkish characters (ş, ğ, ı, İ). Your document is never sent to a server for recognition. Searchable PDF output is a Pro feature." },
        { t: "cta", title: "Scanned PDF → Text (OCR)", x: "Just want the text? Convert a scanned PDF to plain text on your device.", btn: "Open the OCR tool", tool: "/tools/taranmis-pdf-ocr" },
        { t: "h2", x: "Where is it useful?" },
        { t: "ul", items: ["Archiving: search by keyword across hundreds of scanned documents.", "Legal and accounting: instantly find an amount or clause in a contract or invoice.", "Students: search topics in photos of lecture notes.", "Accessibility: screen readers can read the document."] },
      ],
      faq: [
        { q: "What's the difference between a searchable PDF and a normal scanned PDF?", a: "A normal scanned PDF is an image; you can't search inside it. A searchable PDF has an invisible text layer over the image, so Ctrl+F search and copy work." },
        { q: "Does it work with Turkish characters?", a: "Yes. OCR supports Turkish + English, and characters like ş, ğ, ı, İ are converted correctly into searchable text." },
        { q: "Is my document sent to a server?", a: "No. OCR and text-layer embedding happen entirely on your device; your document is not uploaded." },
        { q: "Does the document's appearance change?", a: "No. The text layer is invisible; the document looks identical, it just becomes searchable and copyable." },
      ],
    },
  ),

  post(
    {
      slug: "belge-fotografini-kaliteli-pdf-yapma",
      date: "2026-07-13",
      updated: "2026-07-13",
      readMinutes: 5,
      tags: { tr: ["Belge Tarama", "Kalite", "PDF"], en: ["Scanning", "Quality", "PDF"] },
      accent: "emerald",
      tool: "/tools/image-to-pdf",
    },
    {
      title: "Belge Fotoğrafını Düzgün PDF'e Çevirme: Eğiklik, Gölge ve Kenar Sorunları",
      description:
        "Telefonla çekilen belge fotoğrafları çoğu zaman eğri ve gölgelidir. Otomatik perspektif düzeltme ve gölge temizleme ile fotoğrafı tarayıcı çıktısı gibi düzgün bir PDF'e çevirin.",
      excerpt:
        "Bir belgeyi telefonla çektiğinizde sonuç genelde eğri, köşeleri kırpık ve tek yanı gölgeli olur. İyi bir belge tarayıcı bunları otomatik düzeltir. Perspektif düzeltme ve gölge temizlemenin nasıl çalıştığını gösteriyoruz.",
      blocks: [
        { t: "lead", x: "Kağıt bir belgeyi telefonla çekmek kolaydır; ama sonuç çoğu zaman «tarama» gibi görünmez: belge eğridir, masa da kadraja girmiştir, bir köşe gölgede kalmıştır. İyi bir tarayıcı işte tam burada devreye girer — fotoğrafı düz, temiz bir belgeye çevirir." },

        { t: "h2", x: "Perspektif düzeltme: eğri belgeyi «dümdüz» yapmak" },
        { t: "p", x: "Belgeyi tam tepeden çekmediğiniz için kenarlar birbirine paralel çıkmaz; belge yamuk görünür. Belge tarayıcı, dört köşeyi otomatik bularak görüntüyü yeniden hesaplar ve belgeyi karşıdan bakılmış gibi düz bir dikdörtgene dönüştürür. Böylece arka plandaki masa da kırpılır, yalnız belge kalır." },

        { t: "h2", x: "Gölge temizleme ve kontrast (Otomatik filtre)" },
        { t: "p", x: "Elle çekimde ışık her zaman eşit gelmez; bir kenar koyu, bir kenar parlak olur. «Otomatik» filtre, her renk kanalında arka plan aydınlatmasını tahmin edip dengeleyerek gölgeleri temizler ve zemini dümdüz beyaza yaklaştırır — metin keskinleşir, renkler korunur. Bu, tarama uygulamalarındaki «magic color» etkisine benzer." },

        { t: "h2", x: "Hangi filtreyi ne zaman kullanmalı?" },
        { t: "ul", items: ["Renkli: logolu, renkli faturalar ve fotoğraflı belgeler için.", "Gri: metin ağırlıklı belgeler; daha küçük dosya.", "Siyah-Beyaz: en keskin metin, en küçük dosya — düz metin belgeler için ideal.", "Otomatik (Pro): gölge temizleme + kontrast; en profesyonel, tarayıcı benzeri çıktı."] },

        { t: "h2", x: "Adım adım kaliteli tarama" },
        { t: "steps", items: [
          { title: "İyi ışık ve düz zemin", x: "Belgeyi düz bir zemine koyun, gölge düşürmeyecek şekilde üstten çekin. Zeminle belge arasında renk farkı olsun ki kenarlar kolay bulunsun." },
          { title: "Otomatik yakalamayı bekleyin", x: "Kamerayı sabit tutun; kenarlar yeşil çerçeveyle işaretlenip belge kendiliğinden yakalanır." },
          { title: "Filtreyi seçin ve oluşturun", x: "Belgeye uygun filtreyi seçip PDF'i oluşturun; gerekirse köşeleri düzeltin." },
        ] },

        { t: "cta", title: "Görsel → PDF", x: "Elinizdeki belge fotoğraflarını tek PDF'e çevirin — cihazınızda, üyeliksiz.", btn: "Aracı aç", tool: "/tools/image-to-pdf" },

        { t: "p", x: "Tarama sonrası dosya büyükse Sıkıştır aracıyla boyutu küçültebilir; sayfaları yeniden sıralamak, döndürmek veya silmek isterseniz taradığınız PDF'i doğrudan ilgili araçta açabilirsiniz." },
      ],
      faq: [
        { q: "Eğri çektiğim belgeyi düz yapabilir miyim?", a: "Evet. Belge tarayıcı dört köşeyi otomatik bulup perspektifi düzeltir; belge karşıdan bakılmış gibi düz bir dikdörtgene dönüşür ve arka plan kırpılır." },
        { q: "Belgedeki gölgeleri nasıl temizlerim?", a: "«Otomatik» filtre, arka plan aydınlatmasını dengeleyerek gölgeleri temizler ve zemini beyaza yaklaştırır. Bu filtre bir Pro özelliğidir; Renkli/Gri/Siyah-Beyaz filtreler ücretsizdir." },
        { q: "Hangi filtre en küçük dosyayı verir?", a: "Siyah-Beyaz filtre en keskin metni ve en küçük dosyayı üretir; düz metin belgeler için idealdir. Renkli belgeler için Renkli veya Otomatik'i tercih edin." },
      ],
    },
    {
      title: "Turn a Document Photo into a Clean PDF: Skew, Shadows and Edges",
      description:
        "Phone photos of documents are usually skewed and shadowed. With automatic perspective correction and shadow removal, turn the photo into a clean, scanner-like PDF.",
      excerpt:
        "When you photograph a document, the result is usually skewed, with clipped corners and a shadow on one side. A good document scanner fixes these automatically. Here's how perspective correction and shadow removal work.",
      blocks: [
        { t: "lead", x: "Photographing a paper document is easy; but the result rarely looks like a «scan»: the document is skewed, the desk is in frame, one corner is in shadow. A good scanner steps in exactly here — turning the photo into a flat, clean document." },
        { t: "h2", x: "Perspective correction: making a skewed document flat" },
        { t: "p", x: "Because you don't shoot perfectly top-down, the edges aren't parallel and the document looks slanted. The scanner finds the four corners automatically and recomputes the image, turning the document into a flat rectangle as if viewed head-on. The desk behind it is cropped away, leaving only the document." },
        { t: "h2", x: "Shadow removal and contrast (Auto filter)" },
        { t: "p", x: "Handheld shots rarely have even light; one edge is dark, another bright. The «Auto» filter estimates and balances background lighting on each color channel to remove shadows and flatten the background toward white — text sharpens, colors stay. It's similar to the «magic color» effect in scanner apps." },
        { t: "h2", x: "Which filter, when?" },
        { t: "ul", items: ["Color: for invoices with logos and documents with photos.", "Gray: text-heavy documents; smaller file.", "Black & White: sharpest text, smallest file — ideal for plain text.", "Auto (Pro): shadow removal + contrast; the most professional, scanner-like output."] },
        { t: "h2", x: "Step by step: a quality scan" },
        { t: "steps", items: [
          { title: "Good light and a flat surface", x: "Place the document on a flat surface and shoot from above without casting a shadow. Keep contrast between the surface and the document so edges are easy to find." },
          { title: "Wait for auto-capture", x: "Hold the camera steady; edges are marked with a green outline and the document is captured by itself." },
          { title: "Pick a filter and create", x: "Choose the right filter for the document and create the PDF; adjust corners if needed." },
        ] },
        { t: "cta", title: "Image → PDF", x: "Turn your document photos into a single PDF — on your device, no sign-up.", btn: "Open the tool", tool: "/tools/image-to-pdf" },
        { t: "p", x: "If the file is large after scanning, use Compress to reduce its size; to reorder, rotate or delete pages, open your scanned PDF directly in the matching tool." },
      ],
      faq: [
        { q: "Can I straighten a document I shot at an angle?", a: "Yes. The scanner finds the four corners automatically and corrects perspective; the document becomes a flat rectangle as if viewed head-on, with the background cropped." },
        { q: "How do I remove shadows from a document?", a: "The «Auto» filter balances background lighting to remove shadows and flatten the background toward white. This filter is a Pro feature; Color/Gray/Black & White filters are free." },
        { q: "Which filter gives the smallest file?", a: "Black & White gives the sharpest text and smallest file; it's ideal for plain text documents. For color documents, prefer Color or Auto." },
      ],
    },
  ),

  post(
    {
      slug: "camscanner-ucretsiz-gizli-alternatif",
      date: "2026-07-13",
      updated: "2026-07-13",
      readMinutes: 5,
      tags: { tr: ["Belge Tarama", "Alternatif", "Gizlilik"], en: ["Scanning", "Alternative", "Privacy"] },
      accent: "blue",
      tool: "/tools/image-to-pdf",
    },
    {
      title: "CamScanner'a Ücretsiz ve Gizli Alternatif: Tarayıcıda Belge Tarama",
      description:
        "Uygulama kurmadan, filigransız ve dosyalarınızı buluta yüklemeden belge tarayın. Tarayıcıda çalışan, cihazınızda işleyen ücretsiz bir belge tarama alternatifi.",
      excerpt:
        "Belge tarama uygulamaları pratik ama çoğu reklam gösterir, çıktıya filigran koyar ya da dosyanızı buluta yükler. Tarayıcıda çalışan, cihazınızda işleyen ve temel özellikleri ücretsiz olan bir alternatifi tanıtıyoruz.",
      blocks: [
        { t: "lead", x: "CamScanner gibi tarama uygulamaları işi görür; ama birçoğu üyelik ister, ücretsiz sürümde çıktıya filigran koyar, reklam gösterir ve belgelerinizi işlemek için kendi bulutlarına yükler. Hassas belgeler söz konusuysa bu son madde tek başına yeterince rahatsız edici." },

        { t: "h2", x: "Tarayıcıda + cihazda ne değişiyor?" },
        { t: "p", x: "PDF Platform'un belge tarayıcısı telefon tarayıcınızda açılır — kurulum yok. Daha önemlisi, tüm işlem cihazınızda çalışır: kamera görüntüsü, otomatik kenar bulma, perspektif düzeltme ve PDF oluşturma. Belgeniz herhangi bir sunucuya yüklenmez, çıktıya zorunlu filigran konmaz." },

        { t: "h2", x: "Dürüst karşılaştırma" },
        { t: "ul", items: ["Kurulum: Uygulama yok — telefon tarayıcısında açılır.", "Gizlilik: Tarama cihazınızda; belge buluta yüklenmez.", "Filigran: Çıktıya zorunlu filigran yok.", "Ücretsiz: Tarama, PDF, kaydetme ve paylaşma ücretsiz; tek taramada 3 sayfa.", "Pro: Otomatik gölge temizleme, sınırsız sayfa ve aranabilir PDF (OCR)."] },

        { t: "h2", x: "Temelde ücretsiz olan ne?" },
        { t: "p", x: "Belgeyi tarama, otomatik kenar bulma, perspektif düzeltme, Renkli/Gri/Siyah-Beyaz filtreler, PDF oluşturma, kaydetme ve paylaşma — tümü ücretsizdir ve üyelik istemez. Tek taramada 3 sayfaya kadar tarayabilirsiniz." },

        { t: "h2", x: "Pro neyi ekler?" },
        { t: "p", x: "Daha profesyonel taramalar için Pro üç şey ekler: gölgeleri temizleyip zemini beyazlatan «Otomatik» filtre, tek taramada sınırsız sayfa ve metni Ctrl+F ile aranabilir/kopyalanabilir yapan aranabilir PDF (OCR). Hepsi yine cihazınızda çalışır." },

        { t: "cta", title: "Görsel → PDF", x: "Belgelerinizi ya da fotoğraflarınızı tek PDF'e çevirin — cihazınızda, üyeliksiz.", btn: "Hemen deneyin", tool: "/tools/image-to-pdf" },

        { t: "h2", x: "Kimler için ideal?" },
        { t: "p", x: "Ara sıra bir belge tarayan ama telefonuna bir uygulama daha kurmak istemeyen; kimlik, sözleşme, fatura gibi belgeleri buluta yüklemeden dijitalleştirmek isteyen herkes için. Bir bağlantıdan açılır, işini görür ve belgeniz sizde kalır." },
      ],
      faq: [
        { q: "Ücretsiz bir CamScanner alternatifi var mı?", a: "Evet. PDF Platform'un belge tarayıcısı tarayıcıda çalışır; tarama, perspektif düzeltme, filtreler, PDF oluşturma ve paylaşma ücretsizdir ve çıktıya zorunlu filigran koymaz." },
        { q: "Belgelerim buluta yüklenir mi?", a: "Hayır. Tüm tarama ve PDF oluşturma işlemi cihazınızda çalışır; belgeniz sunucuya gönderilmez." },
        { q: "Çıktıda filigran olur mu?", a: "Hayır. Oluşturduğunuz PDF'e zorunlu filigran eklenmez." },
        { q: "Hangi özellikler Pro?", a: "Otomatik gölge temizleme filtresi, tek taramada sınırsız sayfa ve aranabilir PDF (OCR) Pro özellikleridir. Temel tarama ve PDF oluşturma ücretsizdir." },
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
