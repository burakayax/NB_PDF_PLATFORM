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
    {
      title: "A Free, Private CamScanner Alternative: Scan Documents in Your Browser",
      description:
        "Scan documents without installing an app, without watermarks, and without uploading your files to the cloud. A free document-scanning alternative that runs in your browser and processes on your device.",
      excerpt:
        "Document scanning apps are handy, but most show ads, stamp a watermark on the output, or upload your file to the cloud. Here's an alternative that runs in your browser, processes on your device, and keeps the core features free.",
      blocks: [
        { t: "lead", x: "Scanning apps like CamScanner get the job done — but many require an account, watermark the output on the free tier, show ads, and upload your documents to their own cloud to process them. When sensitive documents are involved, that last point alone is unsettling enough." },

        { t: "h2", x: "What changes with browser + on-device?" },
        { t: "p", x: "PDF Platform's document scanner opens in your phone's browser — no install. More importantly, the whole process runs on your device: the camera image, automatic edge detection, perspective correction and PDF creation. Your document is never uploaded to any server, and no forced watermark is added to the output." },

        { t: "h2", x: "An honest comparison" },
        { t: "ul", items: ["Install: No app — opens in your phone's browser.", "Privacy: Scanning happens on your device; the document isn't uploaded to the cloud.", "Watermark: No forced watermark on the output.", "Free: Scanning, PDF, saving and sharing are free; up to 3 pages per scan.", "Pro: Automatic shadow removal, unlimited pages and searchable PDF (OCR)."] },

        { t: "h2", x: "What's free at the core?" },
        { t: "p", x: "Scanning a document, automatic edge detection, perspective correction, Color/Gray/Black-and-White filters, PDF creation, saving and sharing — all free and no account required. You can scan up to 3 pages per scan." },

        { t: "h2", x: "What does Pro add?" },
        { t: "p", x: "For more professional scans, Pro adds three things: an «Auto» filter that removes shadows and whitens the background, unlimited pages per scan, and searchable PDF (OCR) that makes text findable with Ctrl+F and copyable. All of it still runs on your device." },

        { t: "cta", title: "Image → PDF", x: "Turn your documents or photos into a single PDF — on your device, no account.", btn: "Try it now", tool: "/tools/image-to-pdf" },

        { t: "h2", x: "Who is it ideal for?" },
        { t: "p", x: "For anyone who scans a document now and then but doesn't want to install yet another app; who wants to digitize IDs, contracts and invoices without uploading them to the cloud. It opens from a link, does the job, and your document stays with you." },
      ],
      faq: [
        { q: "Is there a free CamScanner alternative?", a: "Yes. PDF Platform's document scanner runs in the browser; scanning, perspective correction, filters, PDF creation and sharing are free, and it adds no forced watermark to the output." },
        { q: "Are my documents uploaded to the cloud?", a: "No. All scanning and PDF creation runs on your device; your document is never sent to a server." },
        { q: "Will there be a watermark on the output?", a: "No. No forced watermark is added to the PDF you create." },
        { q: "Which features are Pro?", a: "The automatic shadow-removal filter, unlimited pages per scan, and searchable PDF (OCR) are Pro features. Basic scanning and PDF creation are free." },
      ],
    },
  ),

  post(
    {
      slug: "word-pdf-cevirme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Dönüştürme", "Word", "PDF"], en: ["Convert", "Word", "PDF"] },
      accent: "blue",
      tool: "/tools/word-to-pdf",
    },
    {
      title: "Word'ü PDF'e Çevirme: Biçimi Bozmadan (2026 Rehberi)",
      description:
        "Word (.doc/.docx) belgelerini düzen ve yazı tipleri korunacak şekilde PDF'e dönüştürün. Neden PDF'e çevirmelisiniz, nasıl yapılır ve nelere dikkat etmelisiniz — adım adım.",
      excerpt:
        "Word belgenizi paylaşmadan önce PDF'e çevirmek, düzenin herkeste aynı görünmesini garanti eder. Biçimi bozmadan Word'den PDF'e dönüştürmenin en pratik yolunu ve püf noktalarını anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Bir Word belgesini başkasına gönderdiğinizde, karşı taraftaki farklı Office sürümü veya eksik yazı tipi yüzünden düzen kayabilir. PDF bu sorunu çözer: belge herkeste birebir aynı görünür. İşte Word'ü biçimi bozmadan PDF'e çevirmenin yolu." },
        { t: "h2", x: "Neden Word'ü PDF'e çevirmelisiniz?" },
        { t: "ul", items: [
          "Düzen kilitlenir: yazı tipleri, tablolar ve boşluklar herkeste aynı görünür.",
          "Her cihazda açılır: telefon, tablet, bilgisayar — özel program gerekmez.",
          "Yanlışlıkla değiştirilmez: teklif, sözleşme ve CV'ler için güvenli.",
          "Resmî gönderimler genelde PDF ister.",
        ] },
        { t: "h2", x: "Adım adım dönüştürme" },
        { t: "steps", items: [
          { title: "Belgeyi yükleyin", x: "Word'den PDF'e aracına .doc, .docx, .odt veya .rtf dosyanızı sürükleyip bırakın." },
          { title: "Dönüştürün", x: "Belge sunucuda işlenir; düzen, yazı tipleri ve tablolar korunarak PDF'e çevrilir." },
          { title: "Önizleyip indirin", x: "Sonucu kontrol edin ve PDF'i indirin. Sayfa yapısı orijinal belgenizle aynı kalır." },
        ] },
        { t: "cta", title: "Word'den PDF'e", x: "Word belgenizi düzeni bozulmadan PDF'e çevirin.", btn: "Aracı aç", tool: "/tools/word-to-pdf" },
        { t: "h2", x: "Biçim korunması için ipuçları" },
        { t: "tip", x: "Belgenizde standart yazı tipleri (Arial, Times New Roman, Calibri) kullanırsanız çıktı orijinaline en yakın olur. Çok özel/kurulu olmayan yazı tipleri bazı sistemlerde farklı görünebilir." },
        { t: "p", x: "Ters yönde ihtiyacınız varsa — yani PDF'i tekrar düzenlenebilir Word'e çevirmek — bunun için ayrı bir aracımız var." },
        { t: "cta", title: "PDF'den Word'e", x: "Elinizde düzenlenebilir hâli yoksa, PDF'i tekrar Word'e çevirin.", btn: "PDF → Word", tool: "/tools/pdf-to-word" },
      ],
      faq: [
        { q: "Word'ü PDF'e çevirince biçim bozulur mu?", a: "Hayır. Dönüştürmede düzen, yazı tipleri, tablolar ve sayfa yapısı korunur. En iyi sonuç için belgede yaygın yazı tipleri kullanın." },
        { q: "Hangi dosya türlerini yükleyebilirim?", a: ".doc, .docx, .odt ve .rtf gibi yaygın belge biçimlerini yükleyip PDF'e çevirebilirsiniz." },
        { q: "PDF'i tekrar Word'e çevirebilir miyim?", a: "Evet. PDF'den Word'e aracıyla PDF'i düzenlenebilir .docx belgesine geri çevirebilirsiniz." },
      ],
    },
    {
      title: "How to Convert Word to PDF Without Breaking Formatting (2026)",
      description:
        "Convert Word (.doc/.docx) documents to PDF while keeping layout and fonts intact. Why convert to PDF, how to do it, and what to watch for — step by step.",
      excerpt:
        "Converting your Word file to PDF before sharing guarantees the layout looks the same for everyone. Here's the most practical way to go from Word to PDF without breaking formatting.",
      blocks: [
        { t: "lead", x: "When you send a Word document, a different Office version or a missing font on the other end can shift your layout. PDF fixes this: the document looks identical for everyone. Here's how to convert Word to PDF without breaking formatting." },
        { t: "h2", x: "Why convert Word to PDF?" },
        { t: "ul", items: [
          "Locks the layout: fonts, tables and spacing look the same everywhere.",
          "Opens on any device: phone, tablet, computer — no special software.",
          "Can't be edited by accident: safe for proposals, contracts and CVs.",
          "Official submissions usually require PDF.",
        ] },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Upload the document", x: "Drag your .doc, .docx, .odt or .rtf file into the Word to PDF tool." },
          { title: "Convert", x: "The document is processed on the server and converted to PDF with layout, fonts and tables preserved." },
          { title: "Preview and download", x: "Check the result and download the PDF. The page structure matches your original document." },
        ] },
        { t: "cta", title: "Word to PDF", x: "Convert your Word document to PDF with layout intact.", btn: "Open the tool", tool: "/tools/word-to-pdf" },
        { t: "h2", x: "Tips for preserving formatting" },
        { t: "tip", x: "If your document uses standard fonts (Arial, Times New Roman, Calibri), the output will be closest to the original. Very custom, non-installed fonts may render differently on some systems." },
        { t: "p", x: "Need the other direction — turning a PDF back into an editable Word file? We have a separate tool for that." },
        { t: "cta", title: "PDF to Word", x: "No editable version on hand? Convert the PDF back to Word.", btn: "PDF → Word", tool: "/tools/pdf-to-word" },
      ],
      faq: [
        { q: "Will converting Word to PDF break the formatting?", a: "No. Layout, fonts, tables and page structure are preserved during conversion. For the best result, use common fonts in your document." },
        { q: "Which file types can I upload?", a: "You can upload common document formats like .doc, .docx, .odt and .rtf and convert them to PDF." },
        { q: "Can I convert the PDF back to Word?", a: "Yes. Use the PDF to Word tool to turn the PDF back into an editable .docx document." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-jpg-resme-cevirme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Dönüştürme", "Görsel", "JPG"], en: ["Convert", "Image", "JPG"] },
      accent: "fuchsia",
      tool: "/tools/pdf-to-image",
    },
    {
      title: "PDF'i JPG'ye / Resme Çevirme: Her Sayfa Ayrı Görsel",
      description:
        "PDF sayfalarını yüksek çözünürlüklü JPG veya PNG görsellerine dönüştürün. Her sayfa ayrı bir görsel olur — sosyal medya, sunum ve web için pratik. Adım adım anlatım.",
      excerpt:
        "Bir PDF sayfasını görsel olarak paylaşmak, web'e koymak veya sunuma eklemek gerektiğinde en temiz yol onu JPG/PNG'ye çevirmektir. Nasıl yapılacağını ve JPG mi PNG mi seçeceğinizi anlatıyoruz.",
      blocks: [
        { t: "lead", x: "PDF'i her yere gömemezsiniz — ama bir görseli gömebilirsiniz. Bir sayfayı sosyal medyada paylaşmak, bir web sayfasına koymak ya da sunuma eklemek için PDF'i JPG veya PNG'ye çevirmek en pratik yoldur." },
        { t: "h2", x: "Ne zaman işe yarar?" },
        { t: "ul", items: [
          "Sosyal medyada tek bir sayfayı görsel olarak paylaşmak.",
          "Web sitesine veya blog yazısına önizleme koymak.",
          "Sunuma (PowerPoint/Slides) bir sayfayı resim olarak eklemek.",
          "PDF açamayan birine sayfayı hızlıca göstermek.",
        ] },
        { t: "h2", x: "Adım adım dönüştürme" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "PDF'den JPG'ye aracına belgenizi ekleyin." },
          { title: "Sayfalar görsele dönüşsün", x: "Her sayfa yüksek çözünürlüklü ayrı bir JPG/PNG olarak işlenir." },
          { title: "İndirin", x: "Görselleri tek tek ya da hepsini bir ZIP olarak indirin." },
        ] },
        { t: "cta", title: "PDF'den JPG'ye", x: "PDF sayfalarını yüksek kaliteli görsellere çevirin.", btn: "Aracı aç", tool: "/tools/pdf-to-image" },
        { t: "h2", x: "JPG mi PNG mi?" },
        { t: "p", x: "JPG dosya boyutu küçüktür ve fotoğraf/yoğun içerikli sayfalar için idealdir. PNG ise keskin kenarları ve metni daha net korur, şeffaflık destekler — logo, diyagram veya çok metinli sayfalarda tercih edin." },
        { t: "h2", x: "Tersi: Görselleri PDF yapmak" },
        { t: "p", x: "Elinizde birden çok fotoğraf/görsel varsa ve bunları tek bir PDF'te toplamak istiyorsanız, bunun için ayrı bir aracımız var — üstelik tamamen cihazınızda çalışır." },
        { t: "cta", title: "Görselden PDF'e", x: "Fotoğraflarınızı tek bir PDF'te toplayın — cihazınızda.", btn: "Görsel → PDF", tool: "/tools/image-to-pdf" },
      ],
      faq: [
        { q: "PDF'i JPG'ye nasıl çeviririm?", a: "PDF'i araca yükleyin; her sayfa ayrı bir JPG/PNG görseline dönüştürülür. Görselleri tek tek veya ZIP olarak indirebilirsiniz." },
        { q: "Görsel kalitesi düşer mi?", a: "Sayfalar yüksek çözünürlükte işlenir; baskı ve ekran için net sonuç alırsınız. Daha keskin metin için PNG'yi tercih edin." },
        { q: "Tek bir sayfayı çevirebilir miyim?", a: "Her sayfa ayrı bir görsel olduğu için istediğiniz sayfanın görselini seçip indirebilirsiniz." },
      ],
    },
    {
      title: "How to Convert PDF to JPG / Images: One Image per Page",
      description:
        "Convert PDF pages into high-resolution JPG or PNG images. Each page becomes a separate image — handy for social media, slides and the web. Step-by-step guide.",
      excerpt:
        "When you need to share a PDF page as an image, put it on the web, or drop it into a slide, the cleanest way is to convert it to JPG/PNG. Here's how — and whether to pick JPG or PNG.",
      blocks: [
        { t: "lead", x: "You can't embed a PDF everywhere — but you can embed an image. To share a page on social media, place it on a web page, or add it to a slide, converting the PDF to JPG or PNG is the most practical route." },
        { t: "h2", x: "When is it useful?" },
        { t: "ul", items: [
          "Sharing a single page as an image on social media.",
          "Adding a preview to a website or blog post.",
          "Dropping a page into a presentation as a picture.",
          "Quickly showing a page to someone who can't open a PDF.",
        ] },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Add your document to the PDF to JPG tool." },
          { title: "Pages become images", x: "Each page is processed as a separate high-resolution JPG/PNG." },
          { title: "Download", x: "Download the images one by one or all together as a ZIP." },
        ] },
        { t: "cta", title: "PDF to JPG", x: "Turn PDF pages into high-quality images.", btn: "Open the tool", tool: "/tools/pdf-to-image" },
        { t: "h2", x: "JPG or PNG?" },
        { t: "p", x: "JPG is smaller and ideal for photo-heavy pages. PNG keeps sharp edges and text crisper and supports transparency — prefer it for logos, diagrams or text-heavy pages." },
        { t: "h2", x: "The reverse: images to PDF" },
        { t: "p", x: "If you have several photos/images and want to combine them into one PDF, we have a separate tool for that — and it runs entirely on your device." },
        { t: "cta", title: "Images to PDF", x: "Combine your photos into a single PDF — on your device.", btn: "Images → PDF", tool: "/tools/image-to-pdf" },
      ],
      faq: [
        { q: "How do I convert a PDF to JPG?", a: "Upload the PDF to the tool; each page is converted into a separate JPG/PNG image. Download them individually or as a ZIP." },
        { q: "Will image quality drop?", a: "Pages are processed at high resolution for crisp results on screen and in print. For sharper text, prefer PNG." },
        { q: "Can I convert just one page?", a: "Since each page becomes a separate image, you can pick and download the image for the page you want." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-metin-duzenleme-silme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 5,
      tags: { tr: ["Düzenleme", "PDF", "Metin"], en: ["Editing", "PDF", "Text"] },
      accent: "blue",
      tool: "/tools/pdf-duzenle",
    },
    {
      title: "PDF Nasıl Düzenlenir: Mevcut Metni Gerçekten Silip Değiştirme",
      description:
        "Çoğu araç PDF metnini yalnızca ÜZERİNİ kapatır. PDF Düzenle aracı mevcut yazıyı gerçekten siler ve yerine yenisini yazar — Türkçe destekli. Nasıl yapılır, adım adım.",
      excerpt:
        "Bir PDF'te yanlış bir tarih, fiyat veya isim mi var? Çoğu 'düzenleyici' yazının üzerini beyaz kutuyla kapatır — metin altta durmaya devam eder. Gerçek düzenleme bundan farklıdır; işte nasıl yapıldığı.",
      blocks: [
        { t: "lead", x: "PDF'te küçük bir hatayı düzeltmek — yanlış bir tarih, güncel olmayan bir fiyat, bir yazım hatası — göründüğünden zor olabilir. Çünkü çoğu online 'PDF düzenleyici' aslında metni silmez; sadece üzerine beyaz bir kutu koyar. Bu yazıda gerçek düzenlemeyi anlatıyoruz." },
        { t: "h2", x: "\"Üzerini kapatma\" ile \"gerçek silme\" farkı" },
        { t: "p", x: "Metnin üzerine kutu koyan araçlarda orijinal yazı belgenin içinde kalır: kopyala-yapıştır yapıldığında ya da metin arandığında eski içerik hâlâ görünebilir. Bu hem dağınık hem de gizlilik açısından risklidir. Gerçek düzenleme, yazıyı belgenin içinden kaldırıp yerine yenisini koyar." },
        { t: "tip", x: "PDF Düzenle aracımız PyMuPDF ile mevcut metni GERÇEKTEN kaldırır ve yerine yazdığınızı koyar — üzerini örtmez. Türkçe karakterler tam desteklenir." },
        { t: "h2", x: "Adım adım düzenleme" },
        { t: "steps", items: [
          { title: "PDF'i açın", x: "PDF Düzenle aracına belgenizi yükleyin." },
          { title: "Metne tıklayın", x: "Değiştirmek istediğiniz yazıya tıklayın; mevcut metin seçilir." },
          { title: "Silin veya yeniden yazın", x: "Yazıyı kaldırın ya da yerine yenisini yazın. Metin ekleyebilir, düzeltebilirsiniz." },
          { title: "İndirin", x: "Düzenlenmiş PDF'i indirin — değişiklik belgeye işlenmiş olur." },
        ] },
        { t: "cta", title: "PDF Düzenle", x: "PDF'teki yazıyı gerçekten silip değiştirin — üzerini örtmeden.", btn: "Aracı aç", tool: "/tools/pdf-duzenle" },
        { t: "h2", x: "Ne zaman iyi çalışır, ne zaman çalışmaz?" },
        { t: "p", x: "Bu araç, içinde gerçek metin katmanı olan PDF'lerde çalışır (örneğin Word'den üretilmiş bir PDF). Taranmış / fotoğraf PDF'lerde yazı aslında bir görüntüdür; bu durumda önce OCR ile metne çevirmeniz gerekir." },
        { t: "cta", title: "Taranmış PDF'i metne çevir", x: "Belgeniz taranmışsa, önce yazıyı OCR ile gerçek metne dönüştürün.", btn: "OCR aracı", tool: "/tools/taranmis-pdf-ocr" },
      ],
      faq: [
        { q: "PDF'teki mevcut yazıyı gerçekten silebilir miyim?", a: "Evet. PDF Düzenle aracı yazının üzerini kapatmak yerine metni belgeden gerçekten kaldırır ve yerine yenisini yazmanıza izin verir." },
        { q: "Türkçe karakterler destekleniyor mu?", a: "Evet. Türkçe karakterler (ç, ğ, ı, ö, ş, ü) tam olarak desteklenir." },
        { q: "Taranmış (fotoğraf) PDF'te çalışır mı?", a: "Taranmış PDF'lerde yazı bir görüntüdür; önce OCR ile metne çevirmeniz gerekir, ardından düzenleme yapılabilir." },
      ],
    },
    {
      title: "How to Edit a PDF: Actually Delete and Replace Existing Text",
      description:
        "Most tools only COVER PDF text. The Edit PDF tool truly deletes the existing text and writes new text in its place. How it works, step by step.",
      excerpt:
        "Wrong date, price or name in a PDF? Most 'editors' cover the text with a white box — the text still sits underneath. Real editing is different; here's how it works.",
      blocks: [
        { t: "lead", x: "Fixing a small mistake in a PDF — a wrong date, an outdated price, a typo — can be harder than it looks. Because most online 'PDF editors' don't actually delete the text; they just place a white box over it. This post covers real editing." },
        { t: "h2", x: "\"Cover up\" vs \"truly delete\"" },
        { t: "p", x: "With tools that put a box over the text, the original text stays inside the document: it can still show up when copied or searched. That's messy and a privacy risk. Real editing removes the text from the document and puts new text in its place." },
        { t: "tip", x: "Our Edit PDF tool uses PyMuPDF to TRULY remove existing text and place your new text — it doesn't cover it up. Turkish characters are fully supported." },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Open the PDF", x: "Upload your document to the Edit PDF tool." },
          { title: "Click the text", x: "Click the text you want to change; the existing text is selected." },
          { title: "Delete or rewrite", x: "Remove the text or type a replacement. You can add and correct text." },
          { title: "Download", x: "Download the edited PDF — the change is baked into the document." },
        ] },
        { t: "cta", title: "Edit PDF", x: "Truly delete and replace PDF text — no covering up.", btn: "Open the tool", tool: "/tools/pdf-duzenle" },
        { t: "h2", x: "When it works — and when it doesn't" },
        { t: "p", x: "This tool works on PDFs that contain a real text layer (for example, a PDF exported from Word). In scanned/photo PDFs the text is actually an image; there you first need to turn it into text with OCR." },
        { t: "cta", title: "OCR a scanned PDF", x: "If your document is scanned, first turn the text into real text with OCR.", btn: "OCR tool", tool: "/tools/taranmis-pdf-ocr" },
      ],
      faq: [
        { q: "Can I really delete existing text in a PDF?", a: "Yes. Instead of covering the text, the Edit PDF tool truly removes it from the document and lets you write new text in its place." },
        { q: "Are Turkish characters supported?", a: "Yes. Turkish characters (ç, ğ, ı, ö, ş, ü) are fully supported." },
        { q: "Does it work on scanned (photo) PDFs?", a: "In scanned PDFs the text is an image; you first need to turn it into text with OCR, then editing can be applied." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-excel-tablo-cevirme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Dönüştürme", "Excel", "Tablo"], en: ["Convert", "Excel", "Table"] },
      accent: "fuchsia",
      tool: "/tools/pdf-to-excel",
    },
    {
      title: "PDF'i Excel'e Çevirme: Tabloları .xlsx'e Aktarma (2026)",
      description:
        "PDF'teki tabloları düzenlenebilir Excel (.xlsx) dosyasına aktarın. Ne zaman düz dönüştürme, ne zaman yapay zekâ ile veri çıkarma daha iyi — adım adım anlatıyoruz.",
      excerpt:
        "PDF'teki bir tabloyu Excel'de düzenlemek istiyorsanız, kopyala-yapıştır çoğu zaman hizalamayı bozar. Tabloları temiz şekilde .xlsx'e aktarmanın yolunu ve ne zaman AI'nın daha iyi olduğunu anlatıyoruz.",
      blocks: [
        { t: "lead", x: "PDF'teki bir raporu, fiyat listesini ya da tabloyu Excel'de analiz etmek için önce veriyi hücrelere düzgün taşımanız gerekir. Kopyala-yapıştır genelde her şeyi tek sütuna yığar. İşte tabloları temizce Excel'e aktarmanın yolu." },
        { t: "h2", x: "Adım adım dönüştürme" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "PDF'den Excel'e aracına tablo içeren belgenizi ekleyin." },
          { title: "Tablolar çıkarılsın", x: "Sayfalardaki tablo yapısı algılanıp satır/sütunlar korunarak .xlsx'e dökülür." },
          { title: "Excel dosyasını indirin", x: "Sonucu indirin ve Excel'de doğrudan düzenleyin, filtreleyin, hesaplayın." },
        ] },
        { t: "cta", title: "PDF'den Excel'e", x: "PDF tablolarını düzenlenebilir Excel dosyasına aktarın.", btn: "Aracı aç", tool: "/tools/pdf-to-excel" },
        { t: "h2", x: "Düz dönüştürme mi, yapay zekâ mı?" },
        { t: "p", x: "PDF'te net, ızgara şeklinde tablolar varsa düz dönüştürme hızlı ve yeterlidir. Ancak fatura, irsaliye gibi her biri farklı düzende olan belgelerden alan çıkarmak istiyorsanız — fatura no, tarih, tutar, kalemler gibi — yapay zekâ ile veri çıkarma çok daha isabetlidir." },
        { t: "tip", x: "Onlarca faturayı tek bir CSV tablosunda toplamak istiyorsanız, AI Veri Çıkar ve AI Toplu İşlem araçları bu iş için tasarlandı — her satır bir belge olacak şekilde birleştirir." },
        { t: "cta", title: "AI Veri Çıkar", x: "Faturalar gibi karmaşık belgelerden alanları yapay zekâ ile çıkarın.", btn: "AI ile çıkar", tool: "/tools/pdf-veri-cikar" },
      ],
      faq: [
        { q: "PDF'i Excel'e nasıl çeviririm?", a: "PDF'i araca yükleyin; tablolar algılanıp satır/sütunları korunarak düzenlenebilir bir .xlsx dosyasına aktarılır." },
        { q: "Tablo düzgün çıkmazsa ne yapmalıyım?", a: "Belge fatura gibi değişken düzenliyse, düz dönüştürme yerine AI Veri Çıkar aracını deneyin; alanları ve kalemleri yapılandırılmış olarak çıkarır." },
        { q: "Birden çok belgeyi tek tabloya alabilir miyim?", a: "Evet. AI Toplu İşlem aracıyla birden çok belgeyi işleyip verilerini tek bir CSV tablosunda birleştirebilirsiniz." },
      ],
    },
    {
      title: "How to Convert PDF to Excel: Export Tables to .xlsx (2026)",
      description:
        "Export tables from a PDF into an editable Excel (.xlsx) file. When plain conversion is enough and when AI data extraction is better — step by step.",
      excerpt:
        "If you want to work with a PDF table in Excel, copy-paste usually breaks the alignment. Here's how to export tables cleanly to .xlsx — and when AI is the better choice.",
      blocks: [
        { t: "lead", x: "To analyze a report, price list or table from a PDF in Excel, you first need the data to land in proper cells. Copy-paste usually dumps everything into one column. Here's how to export tables cleanly to Excel." },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Add your document with tables to the PDF to Excel tool." },
          { title: "Tables get extracted", x: "The table structure on the pages is detected and written to .xlsx with rows/columns preserved." },
          { title: "Download the Excel file", x: "Download the result and edit, filter and calculate directly in Excel." },
        ] },
        { t: "cta", title: "PDF to Excel", x: "Export PDF tables into an editable Excel file.", btn: "Open the tool", tool: "/tools/pdf-to-excel" },
        { t: "h2", x: "Plain conversion or AI?" },
        { t: "p", x: "If the PDF has clean, grid-like tables, plain conversion is fast and enough. But if you need to pull fields from documents that each have a different layout — like invoices (invoice no, date, totals, line items) — AI data extraction is far more accurate." },
        { t: "tip", x: "To gather dozens of invoices into a single CSV table, the Extract Data and Batch tools are built for exactly this — merging one row per document." },
        { t: "cta", title: "Extract Data", x: "Pull fields from complex documents like invoices with AI.", btn: "Extract with AI", tool: "/tools/pdf-veri-cikar" },
      ],
      faq: [
        { q: "How do I convert a PDF to Excel?", a: "Upload the PDF to the tool; tables are detected and exported to an editable .xlsx file with rows/columns preserved." },
        { q: "What if the table doesn't come out clean?", a: "If the document has a variable layout like invoices, try the Extract Data tool instead of plain conversion; it extracts fields and line items as structured data." },
        { q: "Can I combine several documents into one table?", a: "Yes. With the AI Batch tool you can process several documents and merge their data into a single CSV table." },
      ],
    },
  ),

  post(
    {
      slug: "excel-pdf-cevirme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Dönüştürme", "Excel", "PDF"], en: ["Convert", "Excel", "PDF"] },
      accent: "blue",
      tool: "/tools/excel-to-pdf",
    },
    {
      title: "Excel'i PDF'e Çevirme: Tabloları ve Düzeni Koruyarak (2026)",
      description:
        "Excel (.xls/.xlsx) tablolarınızı hücreler ve düzen korunacak şekilde paylaşıma ve baskıya hazır PDF'e dönüştürün. Neden PDF'e çevirmeli, nasıl yapılır — adım adım.",
      excerpt:
        "Excel dosyasını olduğu gibi göndermek çoğu zaman kayan hücreler ve bozuk sayfa düzeniyle sonuçlanır. Tabloları koruyarak Excel'i PDF'e çevirmenin ve baskıya hazır hâle getirmenin yolunu anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Bir Excel tablosunu göndermek, çoğu zaman karşı tarafta kayan sütunlar, bölünen sayfalar ve bozuk yazdırma alanıyla sonuçlanır. PDF bu sorunu çözer: tablo herkeste birebir aynı, baskıya hazır görünür. İşte Excel'i düzeni bozmadan PDF'e çevirmenin yolu." },
        { t: "h2", x: "Neden Excel'i PDF'e çevirmelisiniz?" },
        { t: "ul", items: [
          "Düzen kilitlenir: hücreler, sütun genişlikleri ve sayfa sonları herkeste aynı görünür.",
          "Baskıya hazır: yazdırma alanı ve sığdırma sorunları ortadan kalkar.",
          "Yanlışlıkla değiştirilmez: rapor, teklif ve fatura tabloları için güvenli.",
          "Excel kurulu olmayan cihazlarda da açılır.",
        ] },
        { t: "h2", x: "Adım adım dönüştürme" },
        { t: "steps", items: [
          { title: "Excel'i yükleyin", x: "Excel'den PDF'e aracına .xls, .xlsx, .ods veya .csv dosyanızı ekleyin." },
          { title: "Dönüştürün", x: "Belge sunucuda işlenir; tablolar, hücreler ve biçimlendirme korunarak PDF'e çevrilir." },
          { title: "Önizleyip indirin", x: "Sonucu kontrol edip PDF'i indirin — tablonuz paylaşıma ve baskıya hazırdır." },
        ] },
        { t: "cta", title: "Excel'den PDF'e", x: "Excel tablonuzu düzeni bozulmadan PDF'e çevirin.", btn: "Aracı aç", tool: "/tools/excel-to-pdf" },
        { t: "h2", x: "Geniş tablolar için ipucu" },
        { t: "tip", x: "Çok sütunlu geniş tablolarda, çevirmeden önce Excel'de sayfa düzenini 'Yatay (Landscape)' yapmak ve yazdırma alanını ayarlamak, çıktının sığmasını ve okunaklı olmasını sağlar." },
        { t: "h2", x: "Tersi: PDF'teki tabloyu Excel'e almak" },
        { t: "p", x: "Elinizde bir PDF var ve içindeki tabloyu Excel'de düzenlemek istiyorsanız, bunun için ayrı bir aracımız var — tabloları .xlsx'e çıkarır." },
        { t: "cta", title: "PDF'den Excel'e", x: "PDF'teki tabloları düzenlenebilir Excel'e aktarın.", btn: "PDF → Excel", tool: "/tools/pdf-to-excel" },
      ],
      faq: [
        { q: "Excel'i PDF'e çevirince tablo bozulur mu?", a: "Hayır. Hücreler, sütun düzeni ve biçimlendirme korunur. Geniş tablolarda yatay sayfa düzeni ve yazdırma alanını ayarlamak en iyi sonucu verir." },
        { q: "Hangi dosya türlerini yükleyebilirim?", a: ".xls, .xlsx, .ods ve .csv gibi yaygın tablo biçimlerini yükleyip PDF'e çevirebilirsiniz." },
        { q: "PDF'teki tabloyu tekrar Excel'e alabilir miyim?", a: "Evet. PDF'den Excel'e aracıyla PDF'teki tabloları düzenlenebilir bir .xlsx dosyasına aktarabilirsiniz." },
      ],
    },
    {
      title: "How to Convert Excel to PDF Keeping Tables and Layout (2026)",
      description:
        "Convert Excel (.xls/.xlsx) tables into a share-ready, print-ready PDF with cells and layout preserved. Why convert to PDF and how — step by step.",
      excerpt:
        "Sending an Excel file as-is often results in shifted cells and broken page layout. Here's how to convert Excel to PDF while keeping tables intact and print-ready.",
      blocks: [
        { t: "lead", x: "Sending an Excel table often ends with shifted columns, split pages and a broken print area on the other end. PDF fixes this: the table looks identical and print-ready for everyone. Here's how to convert Excel to PDF without breaking the layout." },
        { t: "h2", x: "Why convert Excel to PDF?" },
        { t: "ul", items: [
          "Locks the layout: cells, column widths and page breaks look the same everywhere.",
          "Print-ready: print-area and fit-to-page issues disappear.",
          "Can't be changed by accident: safe for report, quote and invoice tables.",
          "Opens on devices without Excel installed.",
        ] },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Upload the Excel file", x: "Add your .xls, .xlsx, .ods or .csv file to the Excel to PDF tool." },
          { title: "Convert", x: "The file is processed on the server and converted to PDF with tables, cells and formatting preserved." },
          { title: "Preview and download", x: "Check the result and download the PDF — your table is share- and print-ready." },
        ] },
        { t: "cta", title: "Excel to PDF", x: "Convert your Excel table to PDF with layout intact.", btn: "Open the tool", tool: "/tools/excel-to-pdf" },
        { t: "h2", x: "Tip for wide tables" },
        { t: "tip", x: "For wide, many-column tables, setting the page orientation to Landscape and adjusting the print area in Excel before converting helps everything fit and stay readable." },
        { t: "h2", x: "The reverse: getting a table out of a PDF" },
        { t: "p", x: "If you have a PDF and want to edit the table inside it in Excel, we have a separate tool that extracts tables to .xlsx." },
        { t: "cta", title: "PDF to Excel", x: "Export tables from a PDF into editable Excel.", btn: "PDF → Excel", tool: "/tools/pdf-to-excel" },
      ],
      faq: [
        { q: "Will converting Excel to PDF break the table?", a: "No. Cells, column layout and formatting are preserved. For wide tables, using landscape orientation and setting the print area gives the best result." },
        { q: "Which file types can I upload?", a: "You can upload common spreadsheet formats like .xls, .xlsx, .ods and .csv and convert them to PDF." },
        { q: "Can I get the table back into Excel?", a: "Yes. Use the PDF to Excel tool to export tables from the PDF into an editable .xlsx file." },
      ],
    },
  ),

  post(
    {
      slug: "powerpoint-pdf-cevirme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Dönüştürme", "PowerPoint", "Sunum"], en: ["Convert", "PowerPoint", "Slides"] },
      accent: "fuchsia",
      tool: "/tools/ppt-to-pdf",
    },
    {
      title: "PowerPoint'i PDF'e Çevirme (ve PDF'i PowerPoint'e)",
      description:
        "PPT/PPTX sunumlarını tasarımı korunacak şekilde tek PDF'e çevirin; ya da PDF'i tekrar düzenlenebilir PowerPoint slaytlarına dönüştürün. İki yön, adım adım.",
      excerpt:
        "Sunumu PDF olarak paylaşmak, slaytların herkeste aynı görünmesini ve yanlışlıkla değişmemesini sağlar. PowerPoint'i PDF'e — ve gerektiğinde tersini — nasıl yapacağınızı anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Bir sunumu PowerPoint dosyası olarak göndermek riskli olabilir: karşı tarafta yazı tipleri kayabilir, animasyonlar bozulabilir ya da slaytlar yanlışlıkla değiştirilebilir. PDF, sunumu herkeste birebir aynı ve değiştirilemez hâle getirir." },
        { t: "h2", x: "PowerPoint'i PDF'e çevirme" },
        { t: "steps", items: [
          { title: "Sunumu yükleyin", x: "PowerPoint'ten PDF'e aracına .ppt veya .pptx dosyanızı ekleyin." },
          { title: "Dönüştürün", x: "Tüm slaytlar tasarımı korunarak tek bir PDF'te toplanır." },
          { title: "İndirin", x: "PDF'i indirin — her cihazda aynı görünen, paylaşıma hazır sunum." },
        ] },
        { t: "cta", title: "PowerPoint'ten PDF'e", x: "Sunumunuzu tasarımı bozulmadan tek PDF'e çevirin.", btn: "Aracı aç", tool: "/tools/ppt-to-pdf" },
        { t: "h2", x: "PDF'i tekrar PowerPoint'e çevirme" },
        { t: "p", x: "Elinizde yalnızca PDF hâli olan bir sunumu düzenlemek isterseniz, PDF'i tekrar PowerPoint slaytlarına dönüştürebilirsiniz — her sayfa bir slayt olur ve içeriği yeniden kullanabilirsiniz." },
        { t: "cta", title: "PDF'den PowerPoint'e", x: "PDF sunumunu düzenlenebilir .pptx slaytlarına çevirin.", btn: "PDF → PowerPoint", tool: "/tools/pdf-to-ppt" },
        { t: "h2", x: "Hangisini ne zaman kullanmalı?" },
        { t: "ul", items: [
          "Paylaşmak / sunmak / arşivlemek için: PowerPoint → PDF.",
          "Eski bir sunumu düzenlemek / içeriği yeniden kullanmak için: PDF → PowerPoint.",
        ] },
      ],
      faq: [
        { q: "PowerPoint'i PDF'e nasıl çeviririm?", a: "PPT/PPTX dosyanızı araca yükleyin; tüm slaytlar tasarımı korunarak tek bir PDF'te toplanır ve indirebilirsiniz." },
        { q: "Sunum tasarımı bozulur mu?", a: "Hayır. Slayt düzeni, yazı tipleri ve görseller korunur; sunum her cihazda aynı görünür." },
        { q: "PDF'i tekrar PowerPoint'e çevirebilir miyim?", a: "Evet. PDF'den PowerPoint'e aracıyla her sayfayı bir slayt olacak şekilde düzenlenebilir .pptx dosyasına çevirebilirsiniz." },
      ],
    },
    {
      title: "How to Convert PowerPoint to PDF (and PDF Back to PowerPoint)",
      description:
        "Convert PPT/PPTX slides into a single PDF with the design preserved, or turn a PDF back into editable PowerPoint slides. Both directions, step by step.",
      excerpt:
        "Sharing a deck as a PDF keeps slides looking the same for everyone and safe from accidental edits. Here's how to convert PowerPoint to PDF — and back when you need to.",
      blocks: [
        { t: "lead", x: "Sending a deck as a PowerPoint file can be risky: fonts may shift, animations may break, or slides may be changed by accident. PDF makes the deck look identical for everyone and un-editable." },
        { t: "h2", x: "PowerPoint to PDF" },
        { t: "steps", items: [
          { title: "Upload the deck", x: "Add your .ppt or .pptx file to the PowerPoint to PDF tool." },
          { title: "Convert", x: "All slides are combined into a single PDF with the design preserved." },
          { title: "Download", x: "Download the PDF — a share-ready deck that looks the same on every device." },
        ] },
        { t: "cta", title: "PowerPoint to PDF", x: "Convert your deck into a single PDF with the design intact.", btn: "Open the tool", tool: "/tools/ppt-to-pdf" },
        { t: "h2", x: "PDF back to PowerPoint" },
        { t: "p", x: "If you only have the PDF version of a deck and want to edit it, you can convert the PDF back into PowerPoint slides — each page becomes a slide and you can reuse the content." },
        { t: "cta", title: "PDF to PowerPoint", x: "Turn a PDF deck into editable .pptx slides.", btn: "PDF → PowerPoint", tool: "/tools/pdf-to-ppt" },
        { t: "h2", x: "Which one, when?" },
        { t: "ul", items: [
          "To share / present / archive: PowerPoint → PDF.",
          "To edit an old deck / reuse content: PDF → PowerPoint.",
        ] },
      ],
      faq: [
        { q: "How do I convert PowerPoint to PDF?", a: "Upload your PPT/PPTX to the tool; all slides are combined into a single PDF with the design preserved, ready to download." },
        { q: "Will the design break?", a: "No. Slide layout, fonts and images are preserved; the deck looks the same on every device." },
        { q: "Can I convert the PDF back to PowerPoint?", a: "Yes. Use the PDF to PowerPoint tool to turn each page into a slide in an editable .pptx file." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-sayfa-numarasi-ekleme",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 3,
      tags: { tr: ["Düzenleme", "PDF", "Sayfa Numarası"], en: ["Editing", "PDF", "Page Numbers"] },
      accent: "blue",
      tool: "/tools/page-numbers",
    },
    {
      title: "PDF'e Sayfa Numarası Ekleme: Konum ve Biçim Seçerek",
      description:
        "PDF belgenize profesyonel sayfa numaraları ekleyin — üst/alt konum ve biçim seçin. Rapor, tez ve sözleşmeler için pratik, adım adım anlatım.",
      excerpt:
        "Uzun bir raporu, tezi ya da sözleşmeyi düzenli hâle getirmenin en kolay yolu sayfa numarası eklemektir. Konumu ve biçimi seçerek PDF'e nasıl sayfa numarası ekleyeceğinizi gösteriyoruz.",
      blocks: [
        { t: "lead", x: "Çok sayfalı bir belgeyi paylaşırken sayfa numaraları büyük fark yaratır: okuyucu yönünü kaybetmez, baskıda sayfalar karışmaz, atıf yapmak kolaylaşır. PDF'inize dakikalar içinde numara eklemenin yolu burada." },
        { t: "h2", x: "Ne zaman gerekir?" },
        { t: "ul", items: [
          "Rapor, tez ve akademik belgelerde referans kolaylığı.",
          "Sözleşme ve resmî evrakta sayfa bütünlüğü.",
          "Baskıya gidecek uzun belgelerde sıralamayı korumak.",
        ] },
        { t: "h2", x: "Adım adım" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Sayfa Numarası aracına belgenizi ekleyin." },
          { title: "Konum ve biçimi seçin", x: "Numaranın üstte mi altta mı olacağını ve biçimini belirleyin." },
          { title: "İndirin", x: "Numaralandırılmış PDF'i indirin — her sayfa profesyonelce numaralanmış olur." },
        ] },
        { t: "cta", title: "Sayfa Numarası Ekle", x: "PDF'inize konum ve biçim seçerek sayfa numarası ekleyin.", btn: "Aracı aç", tool: "/tools/page-numbers" },
        { t: "h2", x: "İpucu" },
        { t: "tip", x: "Belgenizde kapak sayfası varsa, numaralandırmayı içerik sayfasından başlatmayı düşünün — kapakta numara görünmemesi daha profesyonel durur." },
      ],
      faq: [
        { q: "PDF'e sayfa numarası nasıl eklerim?", a: "PDF'inizi yükleyin, numaranın konumunu (üst/alt) ve biçimini seçip indirin. Her sayfa otomatik numaralanır." },
        { q: "Numaranın yerini seçebilir miyim?", a: "Evet. Numarayı başlık (üst) veya dipnot (alt) konumuna yerleştirebilir, biçimini seçebilirsiniz." },
        { q: "Mevcut içerik bozulur mu?", a: "Hayır. Sayfa numarası belgenin üzerine eklenir; mevcut metin ve düzen korunur." },
      ],
    },
    {
      title: "How to Add Page Numbers to a PDF: Choose Position and Format",
      description:
        "Add professional page numbers to your PDF — choose header/footer position and format. Handy for reports, theses and contracts, step by step.",
      excerpt:
        "The easiest way to make a long report, thesis or contract feel organized is to add page numbers. Here's how to add them to a PDF, choosing position and format.",
      blocks: [
        { t: "lead", x: "When sharing a multi-page document, page numbers make a big difference: readers don't lose their place, printed pages don't get mixed up, and referencing becomes easy. Here's how to add numbers to your PDF in minutes." },
        { t: "h2", x: "When do you need it?" },
        { t: "ul", items: [
          "Easy referencing in reports, theses and academic documents.",
          "Page integrity in contracts and official paperwork.",
          "Keeping order in long documents headed for print.",
        ] },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Add your document to the Page Numbers tool." },
          { title: "Choose position and format", x: "Set whether the number goes at the top or bottom, and pick its format." },
          { title: "Download", x: "Download the numbered PDF — every page is professionally numbered." },
        ] },
        { t: "cta", title: "Add Page Numbers", x: "Add page numbers to your PDF with your choice of position and format.", btn: "Open the tool", tool: "/tools/page-numbers" },
        { t: "h2", x: "Tip" },
        { t: "tip", x: "If your document has a cover page, consider starting numbering from the content page — leaving the cover without a number looks more professional." },
      ],
      faq: [
        { q: "How do I add page numbers to a PDF?", a: "Upload your PDF, choose the position (top/bottom) and format, then download. Every page is numbered automatically." },
        { q: "Can I choose where the number goes?", a: "Yes. You can place the number in the header (top) or footer (bottom) and pick its format." },
        { q: "Will it break the existing content?", a: "No. The page number is added on top of the document; existing text and layout are preserved." },
      ],
    },
  ),

  post(
    {
      slug: "bozuk-pdf-onarma",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Sorun Giderme", "PDF", "Onarma"], en: ["Troubleshooting", "PDF", "Repair"] },
      accent: "fuchsia",
      tool: "/tools/repair-pdf",
    },
    {
      title: "Açılmayan / Bozuk PDF'i Onarma: İçeriği Kurtarma Yolları",
      description:
        "PDF açılmıyor, hata veriyor ya da bozuk mu görünüyor? Bozuk PDF'i onarıp içeriği kurtarmayı deneyin. Neden bozulur, nasıl onarılır — adım adım.",
      excerpt:
        "\"PDF açılamıyor\" ya da \"dosya bozuk\" hatası, önemli bir belgede can sıkıcıdır. PDF'in neden bozulduğunu ve yapıyı yeniden paketleyerek kurtarılabilen içeriği nasıl geri alacağınızı anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Önemli bir PDF'i açmaya çalışırken \"dosya hasarlı\" veya \"açılamıyor\" hatasıyla karşılaşmak sinir bozucudur. İyi haber: çoğu bozuk PDF'te içerik hâlâ oradadır, sadece dosyanın yapısı zarar görmüştür — ve bu genelde onarılabilir." },
        { t: "h2", x: "PDF neden bozulur?" },
        { t: "ul", items: [
          "Yarım kalan indirme veya aktarım (bağlantı koptu).",
          "USB/disk hatası ya da dosyanın eksik kaydedilmesi.",
          "Uyumsuz bir programla düzenleme veya hatalı dışa aktarma.",
          "E-posta/eklenti sıkıştırmasının dosyayı bozması.",
        ] },
        { t: "h2", x: "Onarmayı deneyin — adım adım" },
        { t: "steps", items: [
          { title: "Bozuk PDF'i yükleyin", x: "PDF Onarma aracına açılmayan dosyanızı ekleyin." },
          { title: "Onarım çalışsın", x: "Araç dosyanın yapısını yeniden paketleyip kurtarılabilen içeriği toplar." },
          { title: "Sonucu indirin", x: "Onarılmış PDF'i indirip açmayı deneyin. İçerik büyük ölçüde geri gelebilir." },
        ] },
        { t: "cta", title: "PDF Onar", x: "Açılmayan PDF'inizi onarıp içeriği kurtarmayı deneyin.", btn: "Aracı aç", tool: "/tools/repair-pdf" },
        { t: "h2", x: "Ne beklemeli?" },
        { t: "p", x: "Onarım her zaman %100 garanti değildir — hasarın derecesine bağlıdır. Yapısı bozulmuş ama içeriği duran dosyalarda başarı yüksektir; tamamen silinmiş/şifreli veriyi geri getiremez. Yine de denemek çoğu zaman belgeyi kurtarır." },
        { t: "tip", x: "Onarımdan sonra dosya çok büyük geldiyse, sıkıştırma aracıyla boyutu düşürebilir; taranmış ve metni gitmişse OCR ile yeniden metin katmanı ekleyebilirsiniz." },
      ],
      faq: [
        { q: "Bozuk bir PDF'i nasıl onarırım?", a: "Hasarlı PDF'inizi PDF Onarma aracına yükleyin; araç yapıyı yeniden paketleyerek kurtarılabilen içeriği yeni bir dosyada toplar." },
        { q: "Her bozuk dosya kurtarılır mı?", a: "Hayır, başarı hasarın derecesine bağlıdır. Yapısı bozulmuş ama içeriği duran dosyalarda başarı yüksektir; tamamen silinmiş veri geri getirilemez." },
        { q: "PDF neden açılmıyor?", a: "En yaygın nedenler yarım indirme, disk/aktarım hatası, uyumsuz bir programla hatalı dışa aktarma ve dosyanın eksik kaydedilmesidir." },
      ],
    },
    {
      title: "How to Repair a Corrupt / Won't-Open PDF: Ways to Recover Content",
      description:
        "PDF won't open, throws an error or looks corrupt? Try repairing the broken PDF and recovering its content. Why PDFs break and how to fix them — step by step.",
      excerpt:
        "A \"can't open\" or \"file is corrupt\" error on an important document is frustrating. Here's why a PDF breaks and how to recover the salvageable content by re-packaging its structure.",
      blocks: [
        { t: "lead", x: "Hitting a \"file is damaged\" or \"can't open\" error on an important PDF is maddening. The good news: in most broken PDFs the content is still there — only the file's structure is damaged — and that's often repairable." },
        { t: "h2", x: "Why do PDFs break?" },
        { t: "ul", items: [
          "An interrupted download or transfer (the connection dropped).",
          "A USB/disk error or the file not being fully saved.",
          "Editing with an incompatible program or a faulty export.",
          "Email/attachment compression corrupting the file.",
        ] },
        { t: "h2", x: "Try repairing — step by step" },
        { t: "steps", items: [
          { title: "Upload the broken PDF", x: "Add your won't-open file to the Repair PDF tool." },
          { title: "Let the repair run", x: "The tool re-packages the file's structure and gathers the salvageable content." },
          { title: "Download the result", x: "Download the repaired PDF and try opening it. Much of the content may come back." },
        ] },
        { t: "cta", title: "Repair PDF", x: "Try to repair your won't-open PDF and recover the content.", btn: "Open the tool", tool: "/tools/repair-pdf" },
        { t: "h2", x: "What to expect" },
        { t: "p", x: "Repair is not always a 100% guarantee — it depends on the degree of damage. Success is high for files whose structure is broken but whose content remains; it can't bring back fully deleted or encrypted data. Still, trying often recovers the document." },
        { t: "tip", x: "If the file is very large after repair, you can shrink it with the compress tool; if it's scanned and the text is gone, you can add a text layer again with OCR." },
      ],
      faq: [
        { q: "How do I repair a corrupt PDF?", a: "Upload your damaged PDF to the Repair PDF tool; it re-packages the structure and gathers the salvageable content into a new file." },
        { q: "Is every broken file recoverable?", a: "No, success depends on the degree of damage. It's high for files whose structure is broken but content remains; fully deleted data can't be recovered." },
        { q: "Why won't my PDF open?", a: "The most common causes are an interrupted download, a disk/transfer error, a faulty export from an incompatible program, and the file not being fully saved." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-karsilastirma-farklari-bulma",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 5,
      tags: { tr: ["Yapay Zekâ", "Karşılaştırma", "Sözleşme"], en: ["AI", "Compare", "Contract"] },
      accent: "fuchsia",
      tool: "/tools/pdf-karsilastir",
    },
    {
      title: "İki PDF'i Karşılaştırma: Sözleşme Sürümleri Arasındaki Farkı Bulma",
      description:
        "İki PDF'i (ör. sözleşmenin eski ve yeni sürümü) yapay zekâ ile karşılaştırın; eklenen, çıkarılan ve değişen maddeleri — özellikle tutar, tarih ve yükümlülükleri — saniyeler içinde görün.",
      excerpt:
        "Bir sözleşmenin iki sürümünü satır satır karşılaştırmak yorucu ve risklidir; küçük bir değişiklik gözden kaçabilir. Yapay zekâ ile iki PDF arasındaki bağlayıcı farkları saniyeler içinde nasıl bulacağınızı anlatıyoruz.",
      blocks: [
        { t: "lead", x: "\"Bu, geçen hafta gönderdikleri sürümün aynısı mı, yoksa bir madde mi değişti?\" — sözleşmelerde en riskli sorulardan biri. İki PDF'i elle karşılaştırmak hem yorucu hem de tehlikeli: değişen tek bir tarih ya da tutar gözden kaçabilir. Yapay zekâ bu işi saniyelere indirir." },
        { t: "h2", x: "Elle karşılaştırmanın riski" },
        { t: "p", x: "İki uzun belgeyi yan yana okumak dikkat ister; sayfalarca metinde eklenen bir cümleyi, silinen bir istisnayı ya da değişen bir rakamı kaçırmak kolaydır. Üstelik biçim farkları (yeniden numaralanmış maddeler, kayan paragraflar) gerçek içerik değişikliğini gizleyebilir." },
        { t: "h2", x: "Yapay zekâ ile karşılaştırma — adım adım" },
        { t: "steps", items: [
          { title: "İki sürümü yükleyin", x: "A (eski) ve B (yeni) belgelerini PDF Karşılaştırma aracına ekleyin." },
          { title: "Karşılaştırın", x: "Yapay zekâ metni anlar ve eklenen, çıkarılan, değiştirilen maddeleri ayıklar." },
          { title: "Farkları inceleyin", x: "Özellikle bağlayıcı değişiklikleri görün: tutar, tarih, süre, taraf, yükümlülük ve ceza maddeleri." },
        ] },
        { t: "cta", title: "PDF Karşılaştır", x: "Bir sözleşmenin iki sürümünü karşılaştırın — bağlayıcı farkları saniyeler içinde görün.", btn: "Aracı aç", tool: "/tools/pdf-karsilastir" },
        { t: "h2", x: "Ne zaman çok işe yarar?" },
        { t: "ul", items: [
          "Sözleşme revizyonlarını onaylamadan önce kontrol etmek.",
          "İhale/şartname güncellemelerinde neyin değiştiğini görmek.",
          "Karşı tarafın gönderdiği 'küçük düzeltme'lerin gerçekte ne içerdiğini anlamak.",
        ] },
        { t: "tip", x: "Bir sözleşmeyi imzalamadan önce yalnızca farkı değil, tamamını da anlamak isterseniz; PDF Özetle ve PDF ile Sohbet araçlarıyla belgeye soru sorabilirsiniz." },
        { t: "cta", title: "PDF ile Sohbet", x: "Belgeye \"ceza maddesi nedir?\" gibi sorular sorup net cevaplar alın.", btn: "Sohbet aracı", tool: "/tools/pdf-sohbet" },
      ],
      faq: [
        { q: "İki PDF nasıl karşılaştırılır?", a: "İki belgeyi (A: eski, B: yeni) PDF Karşılaştırma aracına yükleyin; yapay zekâ eklenen, çıkarılan ve değişen maddeleri çıkarır." },
        { q: "Hangi farkları yakalar?", a: "Özellikle bağlayıcı değişiklikleri: tutar, tarih, süre, taraf, yükümlülük ve ceza maddelerini öne çıkarır." },
        { q: "Biçim değişikliğiyle içerik değişikliğini ayırır mı?", a: "Evet. Yapay zekâ metnin anlamına bakar; yeniden numaralama veya kayan paragraf gibi biçim farklarını gerçek içerik değişikliğinden ayırmaya çalışır." },
      ],
    },
    {
      title: "How to Compare Two PDFs: Find the Differences Between Contract Versions",
      description:
        "Compare two PDFs (e.g., old and new versions of a contract) with AI; see added, removed and changed clauses — especially amounts, dates and obligations — in seconds.",
      excerpt:
        "Comparing two versions of a contract line by line is tedious and risky; a small change can slip through. Here's how to find the binding differences between two PDFs in seconds with AI.",
      blocks: [
        { t: "lead", x: "\"Is this the same version they sent last week, or did a clause change?\" — one of the riskiest questions in contracts. Comparing two PDFs by hand is tedious and dangerous: a single changed date or amount can slip by. AI brings this down to seconds." },
        { t: "h2", x: "The risk of manual comparison" },
        { t: "p", x: "Reading two long documents side by side demands focus; across pages of text it's easy to miss an added sentence, a removed exception or a changed figure. And formatting differences (renumbered clauses, shifted paragraphs) can hide the real content changes." },
        { t: "h2", x: "Comparing with AI — step by step" },
        { t: "steps", items: [
          { title: "Upload both versions", x: "Add documents A (old) and B (new) to the Compare PDF tool." },
          { title: "Compare", x: "The AI understands the text and extracts added, removed and changed clauses." },
          { title: "Review the differences", x: "See binding changes in particular: amounts, dates, terms, parties, obligations and penalty clauses." },
        ] },
        { t: "cta", title: "Compare PDF", x: "Compare two versions of a contract — see the binding differences in seconds.", btn: "Open the tool", tool: "/tools/pdf-karsilastir" },
        { t: "h2", x: "When is it most useful?" },
        { t: "ul", items: [
          "Checking contract revisions before you approve them.",
          "Seeing what changed in tender/spec updates.",
          "Understanding what the other side's 'minor edits' actually contain.",
        ] },
        { t: "tip", x: "If you want to understand not just the difference but the whole document before signing, the Summarize and Chat with PDF tools let you ask questions about it." },
        { t: "cta", title: "Chat with PDF", x: "Ask the document questions like \"what is the penalty clause?\" and get clear answers.", btn: "Chat tool", tool: "/tools/pdf-sohbet" },
      ],
      faq: [
        { q: "How do I compare two PDFs?", a: "Upload both documents (A: old, B: new) to the Compare PDF tool; the AI extracts added, removed and changed clauses." },
        { q: "Which differences does it catch?", a: "It highlights binding changes in particular: amounts, dates, terms, parties, obligations and penalty clauses." },
        { q: "Does it separate formatting changes from content changes?", a: "Yes. The AI looks at the meaning of the text and tries to separate formatting differences like renumbering or shifted paragraphs from real content changes." },
      ],
    },
  ),

  post(
    {
      slug: "pdf-hassas-veri-gizleme-kvkk",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 5,
      tags: { tr: ["KVKK", "Gizlilik", "Redaction"], en: ["Privacy", "Redaction", "GDPR"] },
      accent: "blue",
      tool: "/tools/hassas-veri-gizle",
    },
    {
      title: "PDF'te Hassas Veri Gizleme (Redaction): KVKK Uyumlu Paylaşım",
      description:
        "PDF'teki TC, IBAN, telefon, e-posta, isim ve adres gibi kişisel verileri KALICI olarak kaldırın — üzerini örtme değil, gerçek redaction. KVKK uyumlu paylaşım için adım adım.",
      excerpt:
        "Bir belgeyi paylaşmadan önce içindeki TC kimlik, IBAN veya adres gibi kişisel verileri gizlemek çoğu zaman yasal bir zorunluluktur. Ama siyah kutu koymak yetmez — veri altta durmaya devam eder. Gerçek redaction'ı anlatıyoruz.",
      blocks: [
        { t: "lead", x: "Bir sözleşmeyi, faturayı ya da resmî belgeyi paylaşmadan önce içindeki kişisel verileri (TC kimlik, IBAN, telefon, adres) gizlemeniz gerekir — bu çoğu zaman KVKK açısından bir zorunluluktur. Ama dikkat: metnin üzerine siyah kutu koymak GERÇEK bir gizleme değildir." },
        { t: "h2", x: "Neden \"siyah kutu\" güvenli değil?" },
        { t: "p", x: "Çoğu araçta hassas veriyi \"gizlemek\" için üzerine siyah bir dikdörtgen çizersiniz. Ancak orijinal yazı belgenin içinde durmaya devam eder: PDF'i bir metin düzenleyicide açan, kutuyu kaldıran ya da metni kopyalayan biri veriyi geri okuyabilir. Bu, sızıntı ve KVKK ihlali riski demektir." },
        { t: "tip", x: "Gerçek redaction, veriyi belgenin İÇERİĞİNDEN kaldırır. Hassas Veri Gizleme aracımız PyMuPDF redaction ile veriyi tamamen siler — üzerini örtmez. Kaldırılan yerde arama, kopyalama veya kurtarma mümkün olmaz." },
        { t: "h2", x: "Nasıl çalışır — adım adım" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Hassas Veri Gizleme aracına belgenizi ekleyin." },
          { title: "Hassas alanlar bulunsun", x: "TC, IBAN, telefon ve e-posta gibi kalıplar cihazınızda; isim ve adres gibi bağlama dayalı veriler yapay zekâ ile tespit edilir." },
          { title: "Kalıcı olarak kaldırın", x: "Onayladığınız alanlar belgenin içeriğinden gerçekten silinir. Temizlenmiş PDF'i indirin." },
        ] },
        { t: "cta", title: "Hassas Veri Gizle", x: "Kişisel verileri kalıcı olarak kaldırıp belgeyi KVKK uyumlu paylaşın.", btn: "Aracı aç", tool: "/tools/hassas-veri-gizle" },
        { t: "h2", x: "Ne zaman gerekir?" },
        { t: "ul", items: [
          "Sözleşme veya faturayı üçüncü tarafla paylaşmadan önce.",
          "Resmî başvuru, ihale veya mahkeme dosyalarında.",
          "Örnek/şablon olarak yayınlanacak belgelerde.",
        ] },
        { t: "p", x: "Kişisel verilerin cihazda tespit edilen kısmı (TC, IBAN, telefon, e-posta) belgeden çıkarken karşıya gönderilmez; yalnızca isim/adres gibi bağlama dayalı tespitte metin yapay zekâya iletilir." },
      ],
      faq: [
        { q: "PDF'teki hassas veri nasıl gizlenir?", a: "PDF'i yükleyin; araç TC/IBAN/telefon/e-postayı cihazınızda, isim/adres gibi verileri yapay zekâ ile bulur ve onayınızla kalıcı olarak kaldırır." },
        { q: "Veriler gerçekten siliniyor mu, üstü mü örtülüyor?", a: "Gerçekten siliniyor. PyMuPDF redaction ile veri PDF'in içeriğinden kaldırılır; üzerine kutu çizilmez, geri okunamaz." },
        { q: "Bu KVKK açısından yeterli mi?", a: "Gerçek redaction, kişisel veriyi belgeden kaldırdığı için 'siyah kutu'ya göre çok daha güvenlidir. Yine de paylaşım öncesi sonucu kontrol etmeniz önerilir." },
      ],
    },
    {
      title: "Redact Sensitive Data in a PDF: Share Safely (GDPR/KVKK)",
      description:
        "Permanently remove personal data like national ID, IBAN, phone, email, name and address from a PDF — real redaction, not covering up. Step by step for compliant sharing.",
      excerpt:
        "Before sharing a document, hiding personal data like an ID number, IBAN or address is often a legal requirement. But a black box isn't enough — the data still sits underneath. Here's real redaction.",
      blocks: [
        { t: "lead", x: "Before sharing a contract, invoice or official document, you need to hide the personal data inside it (ID numbers, IBAN, phone, address) — often a legal requirement under GDPR/KVKK. But beware: drawing a black box over text is NOT real hiding." },
        { t: "h2", x: "Why a \"black box\" isn't safe" },
        { t: "p", x: "In most tools you \"hide\" sensitive data by drawing a black rectangle over it. But the original text stays inside the document: anyone who opens the PDF in a text editor, removes the box, or copies the text can read the data back. That's a leak and a compliance risk." },
        { t: "tip", x: "Real redaction removes the data from the document's CONTENT. Our redaction tool uses PyMuPDF to delete the data entirely — it doesn't cover it. In the redacted spot, searching, copying or recovery is impossible." },
        { t: "h2", x: "How it works — step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Add your document to the redaction tool." },
          { title: "Sensitive fields get found", x: "Patterns like ID, IBAN, phone and email are detected on your device; context-based data like names and addresses is detected with AI." },
          { title: "Remove permanently", x: "The fields you confirm are truly deleted from the document's content. Download the cleaned PDF." },
        ] },
        { t: "cta", title: "Redact Sensitive Data", x: "Permanently remove personal data and share the document safely.", btn: "Open the tool", tool: "/tools/hassas-veri-gizle" },
        { t: "h2", x: "When do you need it?" },
        { t: "ul", items: [
          "Before sharing a contract or invoice with a third party.",
          "In official applications, tenders or court files.",
          "For documents published as samples/templates.",
        ] },
        { t: "p", x: "The part of the personal data detected on your device (ID, IBAN, phone, email) is not sent anywhere as it's removed; only context-based detection (name/address) sends text to the AI." },
      ],
      faq: [
        { q: "How do I redact sensitive data in a PDF?", a: "Upload the PDF; the tool finds ID/IBAN/phone/email on your device and name/address with AI, then permanently removes them with your confirmation." },
        { q: "Is the data truly deleted, or just covered?", a: "Truly deleted. With PyMuPDF redaction the data is removed from the PDF's content; no box is drawn over it and it can't be read back." },
        { q: "Is this enough for GDPR/KVKK?", a: "Real redaction removes the personal data from the document, making it far safer than a 'black box'. Still, it's recommended to review the result before sharing." },
      ],
    },
  ),

  post(
    {
      slug: "dosya-yuklemeden-pdf-isleme-gizlilik",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Gizlilik", "Cihazda İşleme", "PDF Araçları"], en: ["Privacy", "On-device", "PDF Tools"] },
      accent: "fuchsia",
      tool: "/tools/merge-pdf",
    },
    {
      title: "Dosyanı Yüklemeden PDF İşleme: Neden Cihazda Çalışmak Daha Güvenli?",
      description:
        "Çoğu online PDF aracı dosyanızı sunucuya yükler. PDF Platform'un yapısal araçları ise tamamen tarayıcınızda çalışır — dosyanız cihazınızdan hiç çıkmaz. Neden önemli, hangi araçlar?",
      excerpt:
        "Bir PDF'i birleştirmek için onu tanımadığınız bir sunucuya yüklemek zorunda mısınız? Hayır. Yapısal PDF işlemlerinin çoğu tamamen tarayıcınızda yapılabilir — dosyanız internete hiç gönderilmeden.",
      blocks: [
        { t: "lead", x: "Çoğu online PDF aracının çalışma şekli şu: dosyanızı sunucularına yükler, orada işler, sonucu geri verir. Ama sözleşme, kimlik, fatura gibi belgeler için bu, dosyanızın tanımadığınız bir sunucuda bir kopyasının oluşması demektir. Oysa yapısal PDF işlemlerinin çoğu için buna gerek yok." },
        { t: "h2", x: "\"Cihazda işleme\" ne demek?" },
        { t: "p", x: "Cihazda (client-side) işleme, tüm işin tarayıcınızın içinde yapılması demektir — dosya internete hiç gönderilmez. Bu üç şey demektir: gizlilik (dosya sizde kalır), hız (yükleme/indirme beklenmez, anında sonuç) ve çevrimdışı çalışabilme." },
        { t: "h2", x: "Tarayıcınızda çalışan araçlar" },
        { t: "ul", items: [
          "Birleştir, Böl, Döndür, Sayfa Sil, Sayfaları Sırala — hepsi cihazınızda.",
          "Görselden PDF, PDF'e imza atma ve yorumlama — cihazınızda.",
          "Belge Tarayıcı — kamera görüntüsü de dahil, tamamen cihazınızda.",
        ] },
        { t: "cta", title: "Cihazda Birleştir", x: "PDF'lerinizi sunucuya yüklemeden, tarayıcınızda birleştirin.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Peki her araç cihazda mı çalışır?" },
        { t: "p", x: "Dürüst olalım: hayır. Word/Excel'e dönüştürme, OCR ve sıkıştırma gibi ağır işler sunucuda yapılır (bunlar tarayıcıda pratik değildir). Yapay zekâ araçlarında ise dosyanız yüklenmez — metin cihazınızda çıkarılıp yalnızca metin işlenir. Yani hangi aracın nerede çalıştığı bellidir." },
        { t: "tip", x: "Gizliliğin en önemli olduğu belgelerde (kimlik, sözleşme, sağlık) cihazda çalışan yapısal araçları ve belge tarayıcıyı tercih edin; paylaşım öncesi gerekiyorsa hassas verileri gerçek redaction ile kaldırın." },
        { t: "cta", title: "Hassas Veri Gizle", x: "Paylaşmadan önce kişisel verileri kalıcı olarak kaldırın.", btn: "Redaction aracı", tool: "/tools/hassas-veri-gizle" },
      ],
      faq: [
        { q: "PDF'i sunucuya yüklemeden işleyebilir miyim?", a: "Evet. Birleştirme, bölme, döndürme, sayfa silme/sıralama, görselden PDF, imza, yorumlama ve belge tarama gibi yapısal işlemler tamamen tarayıcınızda çalışır; dosya internete gönderilmez." },
        { q: "Hangi araçlar sunucuda çalışır?", a: "Word/Excel/PowerPoint dönüşümü, OCR ve sıkıştırma gibi ağır işler sunucuda yapılır. Yapay zekâ araçlarında dosya yüklenmez; yalnızca cihazda çıkarılan metin işlenir." },
        { q: "Cihazda işleme neden daha hızlı?", a: "Dosya yüklenip indirilmediği için bekleme olmaz; işlem tarayıcınızda anında yapılır ve çevrimdışıyken bile çalışabilir." },
      ],
    },
    {
      title: "Process PDFs Without Uploading: Why On-Device Is Safer",
      description:
        "Most online PDF tools upload your file to a server. PDF Platform's structural tools run entirely in your browser — your file never leaves your device. Why it matters, and which tools.",
      excerpt:
        "Do you have to upload a PDF to an unknown server just to merge it? No. Most structural PDF operations can run entirely in your browser — without your file ever being sent to the internet.",
      blocks: [
        { t: "lead", x: "Most online PDF tools work like this: they upload your file to their servers, process it there, and hand back the result. But for documents like contracts, IDs and invoices, that means a copy of your file ends up on a server you don't control. For most structural PDF operations, that's unnecessary." },
        { t: "h2", x: "What does \"on-device\" mean?" },
        { t: "p", x: "On-device (client-side) processing means the whole job happens inside your browser — the file is never sent to the internet. That means three things: privacy (the file stays with you), speed (no upload/download wait, instant result) and the ability to work offline." },
        { t: "h2", x: "Tools that run in your browser" },
        { t: "ul", items: [
          "Merge, Split, Rotate, Delete Pages, Reorder Pages — all on your device.",
          "Images to PDF, signing and annotating a PDF — on your device.",
          "Document Scanner — including the camera image, entirely on your device.",
        ] },
        { t: "cta", title: "Merge On-Device", x: "Merge your PDFs in your browser, without uploading to a server.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "So does every tool run on-device?" },
        { t: "p", x: "Let's be honest: no. Heavy jobs like Word/Excel conversion, OCR and compression run on the server (they aren't practical in the browser). With AI tools, your file isn't uploaded — the text is extracted on your device and only the text is processed. So it's always clear which tool runs where." },
        { t: "tip", x: "For the most sensitive documents (IDs, contracts, health records), prefer the on-device structural tools and the document scanner; and if needed before sharing, remove sensitive data with real redaction." },
        { t: "cta", title: "Redact Sensitive Data", x: "Permanently remove personal data before sharing.", btn: "Redaction tool", tool: "/tools/hassas-veri-gizle" },
      ],
      faq: [
        { q: "Can I process a PDF without uploading it to a server?", a: "Yes. Structural operations like merging, splitting, rotating, deleting/reordering pages, images to PDF, signing, annotating and document scanning run entirely in your browser; the file is not sent to the internet." },
        { q: "Which tools run on the server?", a: "Heavy jobs like Word/Excel/PowerPoint conversion, OCR and compression run on the server. With AI tools the file isn't uploaded; only the text extracted on your device is processed." },
        { q: "Why is on-device processing faster?", a: "Because the file isn't uploaded and downloaded, there's no wait; the operation happens instantly in your browser and can even work offline." },
      ],
    },
  ),

  post(
    {
      slug: "telefonda-pdf-islemleri-uygulamasiz",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 4,
      tags: { tr: ["Mobil", "Cihazda İşleme", "PDF Araçları"], en: ["Mobile", "On-device", "PDF Tools"] },
      accent: "blue",
      tool: "/tools/merge-pdf",
    },
    {
      title: "Telefonda PDF İşlemleri: Uygulama Yüklemeden Birleştir, Düzenle, Tara",
      description:
        "Telefonda PDF birleştirme, sayfa silme, döndürme ve belge tarama — uygulama yüklemeden, doğrudan tarayıcıda. Yapısal işlemler cihazınızda çalışır, dosyanız gizli kalır.",
      excerpt:
        "PDF işlemek için telefonuna bir sürü uygulama yüklemene gerek yok. Birleştirme, sayfa silme, döndürme ve belge tarama gibi işler doğrudan telefon tarayıcında, dosyan cihazından çıkmadan yapılabilir.",
      blocks: [
        { t: "lead", x: "Telefonda hızlıca iki PDF'i birleştirmek ya da bir belge taramak gerektiğinde, uygulama mağazasına gidip yer kaplayan, reklamlı bir uygulama indirmek zorunda değilsin. Bu işlerin çoğu doğrudan telefon tarayıcında, cihazında çalışır." },
        { t: "h2", x: "Telefonda tarayıcıda çalışan işlemler" },
        { t: "ul", items: [
          "PDF birleştirme ve sayfalara ayırma",
          "Sayfa silme, döndürme, yeniden sıralama",
          "Görsellerden (fotoğraf) PDF oluşturma",
          "Kamerayla belge tarama (kenar bulma + perspektif düzeltme)",
        ] },
        { t: "h2", x: "Neden uygulama yüklemeden daha iyi?" },
        { t: "p", x: "Uygulama kurmak yer kaplar, güncelleme ister ve çoğu ücretsiz uygulama işlevleri kilitler ya da çıktıya zorunlu filigran ekler. Tarayıcıda ise link açılır, iş biter. Üstelik bu yapısal işlemler cihazında çalıştığı için dosyan internete gönderilmez — hız ve gizlilik bir arada." },
        { t: "cta", title: "Telefonda Birleştir", x: "İki PDF'i telefonunda, uygulama yüklemeden birleştir.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Belgeyi telefonla tarama" },
        { t: "p", x: "Belge Tarayıcı, telefon kameranı kullanarak belgenin köşelerini otomatik bulur, perspektifi düzeltir ve temiz bir PDF üretir — tamamen cihazında. Kimlik, sözleşme veya fatura gibi belgeleri buluta göndermeden dijitalleştirebilirsin." },
        { t: "cta", title: "Belge Tara", x: "Telefon kameranla belgeyi tarayıp PDF yap — cihazında, gizli.", btn: "Tarayıcıyı aç", tool: "/tools/belge-tara" },
        { t: "h2", x: "Peki ağır işler?" },
        { t: "p", x: "Word/Excel'e dönüştürme, OCR ve sıkıştırma gibi ağır işler telefonda pratik olmadığı için sunucuda yapılır; telefonda da çalışırlar, sadece dosya yüklenir. Yapısal işlemler ise (birleştir, tara vb.) tamamen cihazında kalır." },
      ],
      faq: [
        { q: "Telefonda PDF birleştirmek için uygulama gerekir mi?", a: "Hayır. PDF birleştirme, sayfa silme/döndürme ve belge tarama gibi işlemler doğrudan telefon tarayıcında, cihazında çalışır; uygulama yüklemene gerek yoktur." },
        { q: "Dosyam telefonda güvende mi?", a: "Yapısal işlemler (birleştir, böl, döndür, tara) tamamen cihazında yapılır; dosya internete gönderilmez. Yalnızca dönüştürme/OCR gibi ağır işler sunucuda çalışır." },
        { q: "Çıktıya filigran ekleniyor mu?", a: "Hayır. Ürettiğin PDF'e zorunlu filigran eklenmez." },
      ],
    },
    {
      title: "PDF on Your Phone: Merge, Edit and Scan Without an App",
      description:
        "Merge, delete pages, rotate and scan documents on your phone — without installing an app, right in the browser. Structural tools run on your device; your file stays private.",
      excerpt:
        "You don't need to install a bunch of apps to work with PDFs on your phone. Merging, deleting pages, rotating and scanning documents can happen right in your phone's browser, without your file leaving the device.",
      blocks: [
        { t: "lead", x: "When you need to quickly merge two PDFs or scan a document on your phone, you don't have to head to the app store for a bulky, ad-filled app. Most of these tasks run right in your phone's browser, on your device." },
        { t: "h2", x: "Tasks that run in your phone's browser" },
        { t: "ul", items: [
          "Merging and splitting PDFs",
          "Deleting, rotating and reordering pages",
          "Creating a PDF from images (photos)",
          "Scanning documents with the camera (edge detection + perspective correction)",
        ] },
        { t: "h2", x: "Why is no-install better?" },
        { t: "p", x: "Installing an app takes space, needs updates, and many free apps lock features or add a forced watermark to the output. In the browser, a link opens and the job is done. And because these structural tasks run on your device, your file isn't sent to the internet — speed and privacy together." },
        { t: "cta", title: "Merge on Phone", x: "Merge two PDFs on your phone, no app needed.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Scanning a document with your phone" },
        { t: "p", x: "The Document Scanner uses your phone camera to automatically find the document's corners, correct the perspective and produce a clean PDF — entirely on your device. You can digitize IDs, contracts or invoices without sending them to the cloud." },
        { t: "cta", title: "Scan Document", x: "Scan a document with your phone camera into a PDF — on your device, private.", btn: "Open the scanner", tool: "/tools/belge-tara" },
        { t: "h2", x: "What about heavy jobs?" },
        { t: "p", x: "Heavy jobs like Word/Excel conversion, OCR and compression aren't practical on a phone, so they run on the server; they work on mobile too, the file is just uploaded. Structural tasks (merge, scan, etc.) stay entirely on your device." },
      ],
      faq: [
        { q: "Do I need an app to merge PDFs on my phone?", a: "No. Merging, deleting/rotating pages and scanning documents run right in your phone's browser, on your device; you don't need to install an app." },
        { q: "Is my file safe on my phone?", a: "Structural tasks (merge, split, rotate, scan) happen entirely on your device; the file isn't sent to the internet. Only heavy jobs like conversion/OCR run on the server." },
        { q: "Is a watermark added to the output?", a: "No. No forced watermark is added to the PDF you create." },
      ],
    },
  ),

  post(
    {
      slug: "en-iyi-ucretsiz-pdf-araclari",
      date: "2026-07-21",
      updated: "2026-07-21",
      readMinutes: 5,
      tags: { tr: ["Rehber", "PDF Araçları", "Ücretsiz"], en: ["Guide", "PDF Tools", "Free"] },
      accent: "fuchsia",
      tool: "/",
    },
    {
      title: "En İyi Ücretsiz Online PDF Araçları (2026 Rehberi)",
      description:
        "Birleştirme, dönüştürme, sıkıştırma, düzenleme ve yapay zekâ — ihtiyacınıza göre en iyi ücretsiz online PDF araçları. Hangi işi hangi araçla yapacağınızı kategorilere göre anlattık.",
      excerpt:
        "\"En iyi ücretsiz PDF aracı\" diye tek bir cevap yok — işe göre değişir. Bu rehberde PDF işlerini kategorilere ayırıp her biri için doğru aracı ve nelere dikkat etmeniz gerektiğini anlatıyoruz.",
      blocks: [
        { t: "lead", x: "İnternette yüzlerce PDF aracı var ama hangisi ne zaman gerekir? Bu rehber, PDF işlerini beş kategoriye ayırıp her biri için doğru aracı gösteriyor — ve bir aracı seçerken nelere (gizlilik, filigran, dosya boyutu) dikkat etmeniz gerektiğini." },
        { t: "h2", x: "1) Düzenleme ve organizasyon" },
        { t: "p", x: "Sayfaları birleştirmek, ayırmak, silmek, döndürmek veya yeniden sıralamak en sık ihtiyaçtır. Bu işlemler hafiftir ve iyi araçlarda cihazınızda (tarayıcıda) çalışır — dosyanız sunucuya gitmez, anında sonuç alırsınız." },
        { t: "cta", title: "PDF Birleştir", x: "Birden çok PDF'i tek belgede toplayın — cihazınızda.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "2) Dönüştürme" },
        { t: "p", x: "PDF'i Word/Excel/PowerPoint'e ya da tersine çevirmek; PDF'i JPG'ye almak. Bunlar ağır işlemlerdir ve genelde sunucuda yapılır. Bir dönüştürücü seçerken en önemli ölçüt: biçimin (düzen, tablo, yazı tipi) ne kadar korunduğu." },
        { t: "cta", title: "PDF → Word", x: "PDF'i düzenlenebilir Word belgesine çevirin.", btn: "Aracı aç", tool: "/tools/pdf-to-word" },
        { t: "h2", x: "3) Optimizasyon ve güvenlik" },
        { t: "p", x: "Dosya boyutunu küçültmek (sıkıştırma), şifre koymak/kaldırmak, filigran veya sayfa numarası eklemek. E-postayla göndermek için sıkıştırma, paylaşmadan önce şifreleme sık kullanılır." },
        { t: "cta", title: "PDF Sıkıştır", x: "PDF boyutunu e-postaya uygun hâle getirin.", btn: "Aracı aç", tool: "/tools/compress" },
        { t: "h2", x: "4) Yapay zekâ ile PDF" },
        { t: "p", x: "Uzun belgeleri özetlemek, belgeye soru sormak, faturalardan veri çıkarmak veya iki sözleşmeyi karşılaştırmak. Yapay zekâ araçlarında genelde dosyanın kendisi yüklenmez; metin çıkarılıp yalnızca metin işlenir." },
        { t: "cta", title: "PDF Özetle", x: "Uzun bir belgeyi saniyeler içinde özetleyin.", btn: "Aracı aç", tool: "/tools/pdf-ozetle" },
        { t: "h2", x: "5) Bir aracı seçerken nelere dikkat etmeli?" },
        { t: "ul", items: [
          "Gizlilik: Dosya sunucuya mı yükleniyor, yoksa cihazınızda mı işleniyor? Hassas belgelerde cihazda işleme tercih edin.",
          "Filigran: Ücretsiz çıktıya zorunlu filigran ekleniyor mu?",
          "Üyelik: Basit bir iş için hesap açmaya zorluyor mu?",
          "Dosya boyutu/limit: Kaç MB'a kadar, günde kaç işlem?",
        ] },
        { t: "tip", x: "PDF Platform'da yapısal araçlar (birleştir, böl, döndür, tara) cihazınızda çalışır, çıktıya zorunlu filigran eklenmez ve çoğu işlem üyeliksiz yapılabilir." },
      ],
      faq: [
        { q: "En iyi ücretsiz PDF aracı hangisi?", a: "İşe göre değişir: düzenleme/organizasyon için cihazda çalışan yapısal araçlar; dönüştürme için biçimi koruyan dönüştürücüler; uzun belgeler için yapay zekâ araçları en uygunudur." },
        { q: "Online PDF araçları güvenli mi?", a: "Çoğu online araç dosyanızı sunucuya yükler. Hassas belgelerde, işlemi cihazınızda (tarayıcıda) yapan araçları tercih edin — dosya internete gönderilmez." },
        { q: "Ücretsiz araçlar filigran ekler mi?", a: "Bazıları ekler. Seçmeden önce çıktıya zorunlu filigran eklenip eklenmediğini kontrol edin; PDF Platform zorunlu filigran eklemez." },
      ],
    },
    {
      title: "The Best Free Online PDF Tools (2026 Guide)",
      description:
        "Merge, convert, compress, edit and AI — the best free online PDF tools for your need. We break down which tool to use for which job, by category.",
      excerpt:
        "There's no single answer to \"the best free PDF tool\" — it depends on the job. This guide splits PDF tasks into categories and shows the right tool for each, plus what to watch for.",
      blocks: [
        { t: "lead", x: "There are hundreds of PDF tools online, but which one when? This guide splits PDF work into five categories and shows the right tool for each — and what to watch for (privacy, watermark, file size) when choosing." },
        { t: "h2", x: "1) Editing and organizing" },
        { t: "p", x: "Merging, splitting, deleting, rotating or reordering pages is the most common need. These tasks are light and, in good tools, run on your device (in the browser) — your file doesn't go to a server and you get an instant result." },
        { t: "cta", title: "Merge PDF", x: "Combine multiple PDFs into one — on your device.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "2) Converting" },
        { t: "p", x: "Turning PDF into Word/Excel/PowerPoint or back; getting a PDF as JPG. These are heavy tasks usually done on the server. The key criterion when choosing a converter: how well formatting (layout, tables, fonts) is preserved." },
        { t: "cta", title: "PDF to Word", x: "Convert a PDF into an editable Word document.", btn: "Open the tool", tool: "/tools/pdf-to-word" },
        { t: "h2", x: "3) Optimizing and securing" },
        { t: "p", x: "Reducing file size (compression), adding/removing a password, adding a watermark or page numbers. Compression to email a file and encryption before sharing are common." },
        { t: "cta", title: "Compress PDF", x: "Make your PDF small enough to email.", btn: "Open the tool", tool: "/tools/compress" },
        { t: "h2", x: "4) PDF with AI" },
        { t: "p", x: "Summarizing long documents, asking a document questions, extracting data from invoices, or comparing two contracts. In AI tools the file itself usually isn't uploaded; text is extracted and only the text is processed." },
        { t: "cta", title: "Summarize PDF", x: "Summarize a long document in seconds.", btn: "Open the tool", tool: "/tools/pdf-ozetle" },
        { t: "h2", x: "5) What to watch for when choosing a tool" },
        { t: "ul", items: [
          "Privacy: Is the file uploaded to a server, or processed on your device? For sensitive documents, prefer on-device processing.",
          "Watermark: Does the free output get a forced watermark?",
          "Signup: Does it force an account for a simple task?",
          "File size/limits: Up to how many MB, how many operations a day?",
        ] },
        { t: "tip", x: "On PDF Platform, structural tools (merge, split, rotate, scan) run on your device, no forced watermark is added, and most tasks can be done without an account." },
      ],
      faq: [
        { q: "Which is the best free PDF tool?", a: "It depends on the job: on-device structural tools for editing/organizing; format-preserving converters for conversion; AI tools for long documents." },
        { q: "Are online PDF tools safe?", a: "Most upload your file to a server. For sensitive documents, prefer tools that process on your device (in the browser) — the file isn't sent to the internet." },
        { q: "Do free tools add a watermark?", a: "Some do. Check whether a forced watermark is added before choosing; PDF Platform doesn't add a forced watermark." },
      ],
    },
  ),
  post(
    {
      slug: "ilovepdf-alternatifi-cihazda-ucretsiz",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 5,
      tags: { tr: ["Karşılaştırma", "Gizlilik"], en: ["Comparison", "Privacy"] },
      accent: "cyan",
      tool: "/tools/merge-pdf",
    },
    {
      title: "iLovePDF Alternatifi: Dosyanız Cihazdan Çıkmadan Ücretsiz PDF Araçları",
      description:
        "iLovePDF'ye ücretsiz ve gizli bir alternatif mi arıyorsunuz? Birleştir, böl, döndür, sil gibi araçları dosyanız sunucuya hiç gitmeden, tarayıcınızda kullanın.",
      excerpt:
        "iLovePDF alternatifi ararken en kritik soru: dosyam nereye gidiyor? Cihazda çalışan, üyeliksiz ve zorunlu filigransız araçlarla dürüst bir karşılaştırma.",
      blocks: [
        { t: "lead", x: "iLovePDF popüler bir araç, ama çoğu işlemde dosyanız önce sunucularına yüklenir. Hassas bir sözleşme, kimlik ya da mali tabloyu işlerken bu bir soru işareti bırakır. İşte dosyanızı cihazınızdan çıkarmadan aynı işleri yapmanın yolu." },
        { t: "h2", x: "iLovePDF'de dosyanız nereye gidiyor?" },
        { t: "p", x: "iLovePDF gibi çoğu online araçta birleştirme, bölme veya dönüştürme için dosyanız sunucuya yüklenir, orada işlenir ve sonra silinir. Genelde güvenlidir; ama dosya yine de bir süre internete çıkar. Gizli belgelerde en güvenli yaklaşım, dosyanın cihazdan hiç ayrılmamasıdır." },
        { t: "h2", x: "Bir alternatifte neye bakmalısınız?" },
        { t: "ul", items: [
          "Gizlilik: Dosya sunucuya mı yükleniyor, yoksa tarayıcınızda mı işleniyor?",
          "Zorunlu filigran: Ücretsiz çıktıya damga ekleniyor mu?",
          "Üyelik zorunluluğu: Basit bir işlem için hesap isteniyor mu?",
          "Günlük/işlem sınırı: Ücretsizde kaç işlem yapabiliyorsunuz?",
        ] },
        { t: "h2", x: "PDF Platform'un farkı: yapısal araçlar cihazda çalışır" },
        { t: "p", x: "PDF Platform'da birleştirme, bölme, döndürme, sayfa silme, sayfa sıralama ve görselden PDF gibi yapısal işlemler tamamen tarayıcınızda (cihazınızda) çalışır — dosyanız internete hiç gönderilmez. Üyelik gerekmez, ücretsiz çıktıya zorunlu filigran eklenmez ve internet kesilse bile çalışır." },
        { t: "cta", title: "PDF Birleştir", x: "Dosyalarınızı ekleyin, sıralayın ve tek PDF olarak indirin — cihazınızda, ücretsiz.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Hangi araçlar cihazda, hangileri sunucuda?" },
        { t: "p", x: "Dürüst olmak gerekirse her işlem tarayıcıda yapılamaz. Ayrımı net söyleyelim:" },
        { t: "ul", items: [
          "Cihazda (dosya çıkmaz): birleştir, böl, döndür, sayfa sil, sayfa sırala, görsel → PDF, belge tara, imza ve işaretleme.",
          "Sunucuda (içerik saklanmaz, şifreli bağlantı): Word/Excel/PowerPoint dönüştürme, OCR, sıkıştırma ve yapay zekâ araçları (özet, sohbet, çeviri).",
        ] },
        { t: "tip", x: "Gizli bir belgeyi yalnızca birleştirmek/bölmek istiyorsanız cihazda çalışan araçları seçin; dosyanız hiç internete çıkmaz. Dönüştürme gerekiyorsa işlem sonrası içerik saklanmaz." },
      ],
      faq: [
        { q: "iLovePDF'ye tamamen ücretsiz bir alternatif var mı?", a: "Evet. PDF Platform'da birleştir, böl, döndür, sil gibi yapısal araçlar üyeliksiz, ücretsiz ve zorunlu filigransızdır; işlem tarayıcınızda çalışır." },
        { q: "Dosyam gerçekten sunucuya yüklenmiyor mu?", a: "Yapısal araçlarda (birleştir, böl, döndür, sil, sırala, görsel → PDF) dosyanız tamamen cihazınızda işlenir, internete hiç gönderilmez. Dönüştürme ve OCR gibi işlemler sunucuda yapılır ancak içerik saklanmaz." },
        { q: "Ücretsiz çıktıya filigran ekleniyor mu?", a: "Hayır. PDF Platform ücretsiz çıktılara zorunlu filigran eklemez." },
        { q: "Üye olmadan kullanabilir miyim?", a: "Evet. Temel araçlar üyelik veya kurulum gerektirmez; doğrudan tarayıcıda çalışırsınız." },
      ],
    },
    {
      title: "iLovePDF Alternative: Free PDF Tools That Keep Your File On Your Device",
      description:
        "Looking for a free, private alternative to iLovePDF? Use merge, split, rotate and delete right in your browser — your file is never uploaded to a server.",
      excerpt:
        "The key question when looking for an iLovePDF alternative: where does my file go? An honest comparison with tools that run on-device, need no signup and add no forced watermark.",
      blocks: [
        { t: "lead", x: "iLovePDF is popular, but for most operations your file is uploaded to its servers first. When you're handling a sensitive contract, ID or financial statement, that leaves a question mark. Here's how to do the same tasks without your file ever leaving your device." },
        { t: "h2", x: "Where does your file go in iLovePDF?" },
        { t: "p", x: "In most online tools like iLovePDF, merging, splitting or converting uploads your file to a server, processes it there, and then deletes it. It's usually safe, but the file still goes to the internet for a while. For confidential documents, the safest approach is for the file to never leave your device." },
        { t: "h2", x: "What to look for in an alternative" },
        { t: "ul", items: [
          "Privacy: Is the file uploaded to a server, or processed in your browser?",
          "Forced watermark: Is a stamp added to the free output?",
          "Signup requirement: Does a simple task require an account?",
          "Daily/usage limits: How many operations can you do for free?",
        ] },
        { t: "h2", x: "The PDF Platform difference: structural tools run on-device" },
        { t: "p", x: "On PDF Platform, structural operations like merge, split, rotate, delete pages, reorder pages and image-to-PDF run entirely in your browser (on your device) — your file is never sent to the internet. No signup is required, no forced watermark is added to the free output, and it even works when your connection drops." },
        { t: "cta", title: "Merge PDF", x: "Add your files, reorder and download one PDF — on your device, free.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Which tools run on-device, which on the server?" },
        { t: "p", x: "To be honest, not every operation can run in the browser. Here's the clear split:" },
        { t: "ul", items: [
          "On-device (file never leaves): merge, split, rotate, delete pages, reorder pages, image → PDF, document scan, sign and annotate.",
          "On the server (content not stored, encrypted connection): Word/Excel/PowerPoint conversion, OCR, compression and AI tools (summarize, chat, translate).",
        ] },
        { t: "tip", x: "If you only need to merge or split a confidential document, pick the on-device tools; your file never touches the internet. If conversion is needed, content is not retained after processing." },
      ],
      faq: [
        { q: "Is there a completely free alternative to iLovePDF?", a: "Yes. On PDF Platform, structural tools like merge, split, rotate and delete are free, need no signup and add no forced watermark; processing runs in your browser." },
        { q: "Is my file really not uploaded to a server?", a: "For structural tools (merge, split, rotate, delete, reorder, image → PDF) your file is processed entirely on your device and never sent to the internet. Operations like conversion and OCR run on the server, but content is not stored." },
        { q: "Is a watermark added to the free output?", a: "No. PDF Platform does not add a forced watermark to free output." },
        { q: "Can I use it without an account?", a: "Yes. The basic tools need no account or installation; you work directly in the browser." },
      ],
    },
  ),
  post(
    {
      slug: "cv-ozgecmis-word-pdf-cevirme",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 4,
      tags: { tr: ["Nasıl Yapılır", "Dönüştürme"], en: ["How-to", "Conversion"] },
      accent: "blue",
      tool: "/tools/word-to-pdf",
    },
    {
      title: "CV'yi (Özgeçmiş) Word'den PDF'e Çevirme — İş Başvurusu İçin Doğru Yöntem",
      description:
        "Word'de hazırladığınız özgeçmişi biçimi bozulmadan PDF'e çevirin. İşverenlerin beklediği profesyonel format, doğru dosya adı ve adım adım dönüştürme.",
      excerpt:
        "İş başvurusunda CV'nizi neden PDF göndermelisiniz ve Word'den biçimi bozulmadan nasıl çevirirsiniz — adım adım.",
      blocks: [
        { t: "lead", x: "Bir CV, işverenin sizinle ilgili gördüğü ilk belgedir. Word'de hazırladığınız özgeçmiş farklı bilgisayarlarda kayabilir, yazı tipleri değişebilir. Çözüm basit: göndermeden önce PDF'e çevirmek." },
        { t: "h2", x: "CV neden PDF olarak gönderilmeli?" },
        { t: "ul", items: [
          "Her cihazda aynı görünür: Yazı tipleri, satır aralıkları ve düzen, açan kişiden bağımsız olarak korunur.",
          "Profesyonel standart: Çoğu işveren ve kariyer portalı PDF'i tercih eder, hatta zorunlu tutar.",
          "Yanlışlıkla değişmez: Word dosyası açılırken kayabilir; PDF sabittir.",
        ] },
        { t: "h2", x: "Word CV'yi PDF'e çevirme — adım adım" },
        { t: "steps", items: [
          { title: "Word dosyanızı yükleyin", x: "Word'den PDF'e aracına .doc veya .docx özgeçmişinizi sürükleyip bırakın." },
          { title: "Dönüştürün", x: "\"Dönüştür\" deyin; yazı tipleri, tablolar ve düzen korunarak PDF anında hazırlanır." },
          { title: "İndirin ve adlandırın", x: "PDF'i indirin ve \"Ad_Soyad_CV.pdf\" gibi düzgün bir adla kaydedin." },
        ] },
        { t: "cta", title: "Word'ü PDF'e Çevir", x: "Özgeçmişinizi yükleyin, biçimi bozulmadan PDF olarak indirin — ücretsiz.", btn: "Aracı aç", tool: "/tools/word-to-pdf" },
        { t: "h2", x: "Göndermeden önce son kontroller" },
        { t: "ul", items: [
          "Dosya adı profesyonel mi? \"belge1.pdf\" yerine \"Ad_Soyad_CV.pdf\".",
          "PDF'te yazı tipleri ve hizalama Word'deki gibi mi görünüyor?",
          "Fotoğraf ve bağlantılar (LinkedIn, e-posta) doğru yerinde mi?",
          "Dosya çok büyükse \"PDF Küçült\" ile e-posta boyutuna indirin.",
        ] },
        { t: "tip", x: "Birden çok belgeyi (CV + ön yazı + sertifikalar) tek dosyada göndermeniz istenirse, PDF'e çevirdikten sonra \"PDF Birleştir\" ile tek belgede toplayabilirsiniz." },
      ],
      faq: [
        { q: "Word CV'yi PDF'e çevirince biçim bozulur mu?", a: "Hayır. Word'den PDF'e aracı yazı tiplerini, tabloları ve düzeni koruyarak dönüştürür; CV'niz her cihazda aynı görünür." },
        { q: "CV'yi PDF yapmak ücretsiz mi?", a: "Evet. Word belgenizi yükleyip PDF'i anında oluşturabilir ve indirebilirsiniz." },
        { q: "Dosya adını ne yapmalıyım?", a: "\"Ad_Soyad_CV.pdf\" gibi net bir ad kullanın; işverenler bunu profesyonel bulur ve dosyanızı kolayca bulur." },
        { q: "CV ve ön yazıyı tek PDF yapabilir miyim?", a: "Evet. Her ikisini PDF'e çevirdikten sonra \"PDF Birleştir\" aracıyla tek belgede toplayabilirsiniz." },
      ],
    },
    {
      title: "How to Convert a CV (Résumé) From Word to PDF the Right Way",
      description:
        "Convert your Word résumé to PDF without breaking the formatting. The professional format employers expect, the right file name, and step-by-step conversion.",
      excerpt:
        "Why you should send your CV as a PDF for job applications, and how to convert it from Word without breaking the formatting — step by step.",
      blocks: [
        { t: "lead", x: "A CV is the first document an employer sees about you. A résumé built in Word can shift on different computers and its fonts can change. The fix is simple: convert it to PDF before sending." },
        { t: "h2", x: "Why should a CV be sent as a PDF?" },
        { t: "ul", items: [
          "Looks the same on every device: Fonts, line spacing and layout are preserved regardless of who opens it.",
          "Professional standard: Most employers and career portals prefer, or even require, PDF.",
          "Won't change by accident: A Word file can shift when opened; a PDF is fixed.",
        ] },
        { t: "h2", x: "Convert a Word CV to PDF — step by step" },
        { t: "steps", items: [
          { title: "Upload your Word file", x: "Drag and drop your .doc or .docx résumé into the Word-to-PDF tool." },
          { title: "Convert", x: "Click \"Convert\"; the PDF is prepared instantly with fonts, tables and layout preserved." },
          { title: "Download and name it", x: "Download the PDF and save it with a clean name like \"First_Last_CV.pdf\"." },
        ] },
        { t: "cta", title: "Convert Word to PDF", x: "Upload your résumé and download it as a PDF without breaking the formatting — free.", btn: "Open the tool", tool: "/tools/word-to-pdf" },
        { t: "h2", x: "Final checks before you send" },
        { t: "ul", items: [
          "Is the file name professional? Use \"First_Last_CV.pdf\" instead of \"document1.pdf\".",
          "Do the fonts and alignment in the PDF match the Word version?",
          "Are the photo and links (LinkedIn, email) in the right place?",
          "If the file is too big, shrink it to email size with \"Compress PDF\".",
        ] },
        { t: "tip", x: "If you're asked to send several documents (CV + cover letter + certificates) as one file, convert them to PDF and then combine them with \"Merge PDF\"." },
      ],
      faq: [
        { q: "Does converting a Word CV to PDF break the formatting?", a: "No. The Word-to-PDF tool preserves fonts, tables and layout, so your CV looks the same on every device." },
        { q: "Is converting a CV to PDF free?", a: "Yes. Upload your Word document and create and download the PDF instantly." },
        { q: "What should I name the file?", a: "Use a clear name like \"First_Last_CV.pdf\"; employers find it professional and can locate your file easily." },
        { q: "Can I combine my CV and cover letter into one PDF?", a: "Yes. After converting both to PDF, combine them into one document with the \"Merge PDF\" tool." },
      ],
    },
  ),
  post(
    {
      slug: "smallpdf-alternatifi-sinirsiz-ucretsiz",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 5,
      tags: { tr: ["Karşılaştırma", "Ücretsiz"], en: ["Comparison", "Free"] },
      accent: "violet",
      tool: "/tools/merge-pdf",
    },
    {
      title: "SmallPDF Alternatifi: Günlük Sınır ve Filigran Olmadan Ücretsiz PDF Araçları",
      description:
        "SmallPDF'nin günlük işlem sınırı ve üyelik baskısı olmadan PDF araçları arıyorsanız: birleştir, böl, döndür, sıkıştır — sınırsız, üyeliksiz ve cihazınızda.",
      excerpt:
        "SmallPDF alternatifi ararken en çok takılınan yer: günlük işlem sınırı ve üyelik duvarı. Sınırsız, üyeliksiz ve zorunlu filigransız araçlarla karşılaştırma.",
      blocks: [
        { t: "lead", x: "SmallPDF iyi bir araç, ama ücretsiz kullanımda günlük işlem sınırına ve sık sık üyelik/Pro duvarına takılırsınız. Peki aynı işleri sınır olmadan, üye olmadan yapmak mümkün mü? Evet." },
        { t: "h2", x: "SmallPDF ücretsiz sürümünün sınırları" },
        { t: "ul", items: [
          "Günlük işlem sınırı: Ücretsizde belirli sayıda işlemden sonra beklemeniz ya da Pro'ya geçmeniz istenir.",
          "Üyelik/Pro baskısı: Bazı araçlar veya toplu işlemler hesap ister.",
          "Yükleme: Çoğu işlemde dosyanız sunucuya gider.",
        ] },
        { t: "h2", x: "PDF Platform'da sınır yok, üyelik yok" },
        { t: "p", x: "PDF Platform'da birleştirme, bölme, döndürme, sayfa silme, sayfa sıralama ve görselden PDF gibi yapısal araçlar üyeliksiz, günlük sınır olmadan ve zorunlu filigran eklenmeden çalışır. Üstelik bu işlemler tamamen tarayıcınızda (cihazınızda) yapılır — dosyanız sunucuya hiç gitmez." },
        { t: "cta", title: "PDF Birleştir", x: "Dosyalarınızı ekleyin, sıralayın ve tek PDF olarak indirin — sınırsız ve ücretsiz.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Hangi işler ücretsiz, hangileri hesap ister?" },
        { t: "p", x: "Dürüst ayrım: yapısal araçlar tamamen ücretsiz ve üyeliksizdir. Word/Excel dönüştürme, OCR ve yapay zekâ araçları (özet, sohbet, çeviri) sunucuda çalışır; bunlar için daha büyük dosyalar ve geçmiş kaydı hesap gerektirir ancak içerik saklanmaz." },
        { t: "ul", items: [
          "Sınırsız & üyeliksiz: birleştir, böl, döndür, sil, sırala, görsel → PDF, belge tara, imza, işaretleme.",
          "Hesap/plan: Word/Excel/PowerPoint dönüştürme, OCR, sıkıştırma ve AI araçları (daha büyük dosya + geçmiş için).",
        ] },
        { t: "tip", x: "Sadece birleştir/böl/döndür gibi bir iş yapacaksanız hiç hesap açmadan, günlük sınıra takılmadan halledebilirsiniz — dosyanız da cihazınızdan çıkmaz." },
      ],
      faq: [
        { q: "SmallPDF'ye ücretsiz ve sınırsız bir alternatif var mı?", a: "Evet. PDF Platform'da yapısal araçlar (birleştir, böl, döndür, sil, sırala, görsel → PDF) üyeliksiz, günlük sınır olmadan ve zorunlu filigransız çalışır." },
        { q: "Günlük işlem sınırı var mı?", a: "Cihazda çalışan yapısal araçlarda günlük işlem sınırı yoktur; istediğiniz kadar kullanabilirsiniz." },
        { q: "Üye olmadan kullanabilir miyim?", a: "Evet. Temel araçlar üyelik veya kurulum gerektirmez; doğrudan tarayıcıda çalışırsınız." },
        { q: "Dosyalarım sunucuya yükleniyor mu?", a: "Yapısal araçlarda dosyanız tamamen cihazınızda işlenir, sunucuya gitmez. Dönüştürme/OCR gibi işlemler sunucuda yapılır ama içerik saklanmaz." },
      ],
    },
    {
      title: "SmallPDF Alternative: Free PDF Tools With No Daily Limit or Watermark",
      description:
        "Want PDF tools without SmallPDF's daily task limit and signup pressure? Merge, split, rotate and compress — unlimited, no signup, and on your device.",
      excerpt:
        "The usual snag when looking for a SmallPDF alternative: the daily task limit and the signup wall. A comparison with unlimited, signup-free, watermark-free tools.",
      blocks: [
        { t: "lead", x: "SmallPDF is a solid tool, but on the free tier you hit a daily task limit and frequent signup/Pro walls. Is it possible to do the same tasks with no limit and no account? Yes." },
        { t: "h2", x: "The limits of SmallPDF's free tier" },
        { t: "ul", items: [
          "Daily task limit: After a set number of free tasks you're asked to wait or upgrade to Pro.",
          "Signup/Pro pressure: Some tools or batch operations require an account.",
          "Upload: For most operations your file goes to a server.",
        ] },
        { t: "h2", x: "On PDF Platform there's no limit and no signup" },
        { t: "p", x: "On PDF Platform, structural tools like merge, split, rotate, delete pages, reorder pages and image-to-PDF work with no signup, no daily limit and no forced watermark. And these operations run entirely in your browser (on your device) — your file never goes to a server." },
        { t: "cta", title: "Merge PDF", x: "Add your files, reorder and download one PDF — unlimited and free.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Which tasks are free, which need an account?" },
        { t: "p", x: "The honest split: structural tools are fully free and signup-free. Word/Excel conversion, OCR and AI tools (summarize, chat, translate) run on the server; those need an account for larger files and history, but content is not stored." },
        { t: "ul", items: [
          "Unlimited & signup-free: merge, split, rotate, delete, reorder, image → PDF, document scan, sign, annotate.",
          "Account/plan: Word/Excel/PowerPoint conversion, OCR, compression and AI tools (for larger files + history).",
        ] },
        { t: "tip", x: "If you just need to merge/split/rotate, you can do it without creating an account or hitting a daily limit — and your file never leaves your device." },
      ],
      faq: [
        { q: "Is there a free, unlimited alternative to SmallPDF?", a: "Yes. On PDF Platform, structural tools (merge, split, rotate, delete, reorder, image → PDF) work with no signup, no daily limit and no forced watermark." },
        { q: "Is there a daily task limit?", a: "The on-device structural tools have no daily task limit; use them as much as you like." },
        { q: "Can I use it without an account?", a: "Yes. The basic tools need no account or installation; you work directly in the browser." },
        { q: "Are my files uploaded to a server?", a: "For structural tools your file is processed entirely on your device and not sent to a server. Conversion/OCR run on the server, but content is not stored." },
      ],
    },
  ),
  post(
    {
      slug: "pdf-form-doldurma-online-ucretsiz",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 4,
      tags: { tr: ["Nasıl Yapılır", "Form"], en: ["How-to", "Forms"] },
      accent: "emerald",
      tool: "/tools/pdf-yorumla",
    },
    {
      title: "PDF Form Doldurma: Yazdırmadan, Online ve Ücretsiz (Düz Formlar Dahil)",
      description:
        "PDF formlarını yazdırmadan bilgisayarda doldurun. Doldurulabilir alanı olmayan (düz/taranmış) formlara bile metin ekleyip imzalayın — ücretsiz ve kolay.",
      excerpt:
        "Elinize gelen PDF formu yazdırıp elle doldurmaya gerek yok. Doldurulabilir alanı olsun olmasın, PDF'e nasıl metin ekleyip imzalarsınız — adım adım.",
      blocks: [
        { t: "lead", x: "Başvuru, sözleşme ya da dilekçe... Çoğu PDF form aslında \"düz\"dür; yani içinde tıklayıp yazabileceğiniz hazır alan yoktur. Yazdırıp elle doldurmak yerine, metni doğrudan formun üzerine ekleyebilirsiniz." },
        { t: "h2", x: "İki tür PDF form vardır" },
        { t: "ul", items: [
          "Doldurulabilir (interaktif) form: İçinde hazır alanlar vardır; herhangi bir PDF okuyucuda alanlara tıklayıp yazabilirsiniz.",
          "Düz form: Çoğu resmi/taranmış belge böyledir; hazır alan yoktur. Bunlarda metni formun uygun yerine \"üzerine\" eklemeniz gerekir.",
        ] },
        { t: "h2", x: "Düz bir PDF formunu doldurma — adım adım" },
        { t: "steps", items: [
          { title: "Formu yükleyin", x: "PDF formunuzu işaretleme/metin aracına yükleyin." },
          { title: "Metin ekleyin", x: "Metin/not aracıyla ilgili boşluğa tıklayıp cevabınızı yazın; her alana ayrı kutu ekleyebilirsiniz." },
          { title: "İmzalayın ve indirin", x: "Gerekiyorsa imzanızı ekleyip \"Uygula ve İndir\" ile doldurulmuş PDF'i indirin." },
        ] },
        { t: "cta", title: "PDF'e Metin/İşaret Ekle", x: "Formunuzu yükleyin, boşluklara metin ekleyin ve doldurulmuş PDF'i indirin — ücretsiz.", btn: "Aracı aç", tool: "/tools/pdf-yorumla" },
        { t: "h2", x: "İmza gerekiyorsa" },
        { t: "p", x: "Form imza istiyorsa, metni ekledikten sonra imzanızı çizip/yazıp yerleştirebilirsiniz. İmzalama tamamen cihazınızda yapılır; belgeniz sunucuya gitmez." },
        { t: "tip", x: "Onay kutuları için küçük bir \"X\" veya \"✓\" metni ekleyebilirsiniz. Formu birden çok sayfaysa her sayfaya ayrı ayrı metin/işaret ekleyebilirsiniz." },
      ],
      faq: [
        { q: "Doldurulabilir alanı olmayan PDF'i doldurabilir miyim?", a: "Evet. Düz (interaktif alanı olmayan) formlarda metni doğrudan formun üzerine ekleyebilirsiniz; yazdırmaya gerek kalmaz." },
        { q: "PDF form doldurmak ücretsiz mi?", a: "Evet. Formunuzu yükleyip metin ekleyebilir ve doldurulmuş PDF'i indirebilirsiniz." },
        { q: "Doldurduğum formu imzalayabilir miyim?", a: "Evet. Metni ekledikten sonra imzanızı çizip yerleştirebilirsiniz; imzalama cihazınızda yapılır, dosya sunucuya gitmez." },
        { q: "Formu telefonda doldurabilir miyim?", a: "Evet. Araç tarayıcı tabanlıdır; Android, iPhone ve iPad dahil her cihazda çalışır." },
      ],
    },
    {
      title: "How to Fill Out a PDF Form Online for Free (Flat Forms Too)",
      description:
        "Fill PDF forms on your computer without printing. Even for forms with no fillable fields (flat/scanned), add text and sign — free and easy.",
      excerpt:
        "No need to print and hand-fill a PDF form you received. Whether it has fillable fields or not, here's how to add text and sign a PDF — step by step.",
      blocks: [
        { t: "lead", x: "Applications, contracts, petitions... Most PDF forms are actually \"flat\" — they have no ready fields you can click and type into. Instead of printing and filling by hand, you can add text directly on top of the form." },
        { t: "h2", x: "There are two kinds of PDF forms" },
        { t: "ul", items: [
          "Fillable (interactive) form: It has ready fields; you can click and type into them in any PDF reader.",
          "Flat form: Most official/scanned documents are like this; there are no ready fields. Here you add text \"on top\" at the right spot.",
        ] },
        { t: "h2", x: "Filling a flat PDF form — step by step" },
        { t: "steps", items: [
          { title: "Upload the form", x: "Upload your PDF form to the annotate/text tool." },
          { title: "Add text", x: "With the text/note tool, click the relevant blank and type your answer; add a separate box for each field." },
          { title: "Sign and download", x: "If needed, add your signature and download the filled PDF with \"Apply & download\"." },
        ] },
        { t: "cta", title: "Add Text/Markup to PDF", x: "Upload your form, add text to the blanks, and download the filled PDF — free.", btn: "Open the tool", tool: "/tools/pdf-yorumla" },
        { t: "h2", x: "If a signature is required" },
        { t: "p", x: "If the form asks for a signature, after adding your text you can draw/type your signature and place it. Signing happens entirely on your device; your document is not sent to a server." },
        { t: "tip", x: "For checkboxes, add a small \"X\" or \"✓\" text. If the form has multiple pages, add text/marks to each page separately." },
      ],
      faq: [
        { q: "Can I fill a PDF that has no fillable fields?", a: "Yes. On flat forms (no interactive fields) you add text directly on top of the form; no printing needed." },
        { q: "Is filling a PDF form free?", a: "Yes. Upload your form, add text, and download the filled PDF." },
        { q: "Can I sign the form I filled?", a: "Yes. After adding text, you can draw and place your signature; signing happens on your device and the file isn't uploaded." },
        { q: "Can I fill the form on my phone?", a: "Yes. The tool is browser-based and works on any device — Android, iPhone, and iPad." },
      ],
    },
  ),
  post(
    {
      slug: "adobe-acrobat-alternatifi-ucretsiz",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 5,
      tags: { tr: ["Karşılaştırma", "Ücretsiz"], en: ["Comparison", "Free"] },
      accent: "fuchsia",
      tool: "/tools/merge-pdf",
    },
    {
      title: "Adobe Acrobat Alternatifi: Program Kurmadan, Ücretsiz PDF İşlemleri",
      description:
        "Adobe Acrobat'a ücretsiz bir alternatif mi arıyorsunuz? Birleştir, böl, dönüştür, imzala ve metin ekle — kurulum yok, çoğu iş için ücret yok, tarayıcıda.",
      excerpt:
        "Çoğu PDF işi için pahalı Acrobat aboneliğine gerek yok. Birleştirmeden imzaya, kurulum olmadan tarayıcıda yapabileceğiniz işler ve dürüst sınırlar.",
      blocks: [
        { t: "lead", x: "Adobe Acrobat güçlü bir program, ama tam sürümü ücretli ve kurulum ister. İyi haber: gündelik PDF işlerinin büyük kısmı için ne abonelik ne de kurulum gerekir — hepsini tarayıcınızda ücretsiz yapabilirsiniz." },
        { t: "h2", x: "Acrobat olmadan hangi işleri yapabilirsiniz?" },
        { t: "ul", items: [
          "Birleştir, böl, döndür, sayfa sil, sayfa sırala — hepsi ücretsiz ve cihazınızda.",
          "Görselden PDF, belge tarama, sayfa numarası ve filigran ekleme.",
          "Metin ekleme, işaretleme ve imza atma.",
          "Word/Excel/PowerPoint dönüştürme, sıkıştırma ve OCR (sunucuda, içerik saklanmaz).",
        ] },
        { t: "h2", x: "Kurulum ve abonelik derdi yok" },
        { t: "p", x: "PDF Platform tamamen tarayıcıda çalışır — indirme, kurulum veya eklenti gerektirmez. Birleştirme, bölme ve imza gibi yapısal işlemler cihazınızda yapılır; dosyanız sunucuya bile gitmez. Üyelik yalnızca daha büyük dosyalar, geçmiş kaydı ve gelişmiş dönüştürme için gerekir." },
        { t: "cta", title: "PDF Araçlarını Aç", x: "Birleştirin, dönüştürün, imzalayın — kurulum olmadan, ücretsiz.", btn: "Aracı aç", tool: "/tools/merge-pdf" },
        { t: "h2", x: "Peki Acrobat ne zaman gerekir?" },
        { t: "p", x: "Dürüst olalım: karmaşık form tasarımı, ileri düzey ön kontrol (prepress) veya kurumsal doküman iş akışları için Acrobat Pro hâlâ güçlü bir seçenektir. Ama çoğu kullanıcının ihtiyacı birleştirmek, dönüştürmek, imzalamak ve metin eklemek — bunlar için ücretli bir programa gerek yok." },
        { t: "tip", x: "Yalnızca bir PDF'i imzalamak ya da birleştirmek için Acrobat kurmayın; tarayıcıda saniyeler içinde, dosyanız cihazınızdan çıkmadan yapabilirsiniz." },
      ],
      faq: [
        { q: "Adobe Acrobat'a ücretsiz bir alternatif var mı?", a: "Evet. Gündelik işler (birleştir, böl, dönüştür, imzala, metin ekle) için PDF Platform'u kurulum ve çoğunda ücret olmadan tarayıcıda kullanabilirsiniz." },
        { q: "Program kurmam gerekir mi?", a: "Hayır. Her şey tarayıcıda çalışır; indirme, kurulum veya eklenti gerekmez." },
        { q: "PDF imzalamak için Acrobat şart mı?", a: "Hayır. İmzanızı tarayıcıda çizip/yükleyip PDF'e ekleyebilirsiniz; işlem cihazınızda yapılır, dosya sunucuya gitmez." },
        { q: "Acrobat gerçekten ne zaman gerekir?", a: "İleri düzey form tasarımı, prepress veya kurumsal iş akışları için Acrobat Pro güçlüdür; ama çoğu gündelik iş için ücretsiz tarayıcı araçları yeterlidir." },
      ],
    },
    {
      title: "Free Adobe Acrobat Alternative: PDF Tasks With No Install",
      description:
        "Looking for a free Adobe Acrobat alternative? Merge, split, convert, sign and add text — no installation, no charge for most tasks, right in your browser.",
      excerpt:
        "You don't need a pricey Acrobat subscription for most PDF tasks. What you can do in the browser without installing anything — and the honest limits.",
      blocks: [
        { t: "lead", x: "Adobe Acrobat is powerful, but the full version is paid and needs installation. The good news: for most everyday PDF tasks you need neither a subscription nor an install — you can do it all free in your browser." },
        { t: "h2", x: "What can you do without Acrobat?" },
        { t: "ul", items: [
          "Merge, split, rotate, delete pages, reorder pages — all free and on your device.",
          "Image-to-PDF, document scanning, page numbers and watermarks.",
          "Adding text, annotating and signing.",
          "Word/Excel/PowerPoint conversion, compression and OCR (on the server, content not stored).",
        ] },
        { t: "h2", x: "No install, no subscription hassle" },
        { t: "p", x: "PDF Platform runs entirely in the browser — no download, install or plugin. Structural tasks like merge, split and sign happen on your device; your file doesn't even go to a server. An account is only needed for larger files, history and advanced conversion." },
        { t: "cta", title: "Open PDF Tools", x: "Merge, convert, sign — with no install, free.", btn: "Open the tool", tool: "/tools/merge-pdf" },
        { t: "h2", x: "So when do you actually need Acrobat?" },
        { t: "p", x: "Let's be honest: for complex form design, advanced prepress, or enterprise document workflows, Acrobat Pro is still a strong option. But most users just need to merge, convert, sign and add text — and for that you don't need a paid program." },
        { t: "tip", x: "Don't install Acrobat just to sign or merge one PDF; you can do it in the browser in seconds, without your file leaving your device." },
      ],
      faq: [
        { q: "Is there a free alternative to Adobe Acrobat?", a: "Yes. For everyday tasks (merge, split, convert, sign, add text) you can use PDF Platform in the browser with no install and, for most, no charge." },
        { q: "Do I need to install a program?", a: "No. Everything runs in the browser; no download, install or plugin is required." },
        { q: "Do I need Acrobat to sign a PDF?", a: "No. Draw or upload your signature in the browser and add it to the PDF; it happens on your device and the file isn't uploaded." },
        { q: "When do you really need Acrobat?", a: "For advanced form design, prepress, or enterprise workflows, Acrobat Pro is powerful; but for most everyday tasks, free browser tools are enough." },
      ],
    },
  ),
  post(
    {
      slug: "ucretsiz-pdf-duzenleyici-rehberi",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 5,
      tags: { tr: ["Nasıl Yapılır", "Düzenleme"], en: ["How-to", "Editing"] },
      accent: "sky",
      tool: "/tools/pdf-duzenle",
    },
    {
      title: "Ücretsiz PDF Düzenleyici: Metin Ekleme, Silme, İmza ve Form Doldurma",
      description:
        "PDF'i ücretsiz düzenleyin: mevcut yazıyı değiştirin/silin, yeni metin ekleyin, imzalayın, işaretleyin ve form doldurun — kurulum yok, tarayıcıda.",
      excerpt:
        "PDF düzenlemenin tek bir yolu yok: yazıyı değiştirmek, metin eklemek, imzalamak, işaretlemek... İhtiyacınıza göre hangi aracı kullanacağınızı gösteren rehber.",
      blocks: [
        { t: "lead", x: "\"PDF düzenleme\" herkes için aynı şey değildir: kimi mevcut yazıyı değiştirmek, kimi üzerine not eklemek, kimi imzalamak ister. Doğru aracı seçince iş saniyeler sürer. İşte ihtiyaca göre yol haritası." },
        { t: "h2", x: "1) Mevcut yazıyı değiştirmek veya silmek" },
        { t: "p", x: "PDF'teki bir yazıyı gerçekten silip yenisini yazmak istiyorsanız \"PDF Düzenle\" aracını kullanın. Değiştirmek istediğiniz metnin üzerine kutu çizin, yenisini yazın (boş bırakırsanız silinir) ve indirin." },
        { t: "cta", title: "PDF Düzenle", x: "Mevcut yazıyı gerçekten silip değiştirin — kutu çizin, yeni metni yazın, indirin.", btn: "Aracı aç", tool: "/tools/pdf-duzenle" },
        { t: "h2", x: "2) Üzerine metin, not veya işaret eklemek" },
        { t: "p", x: "Mevcut yazıya dokunmadan üzerine metin, vurgu, kutu veya çizim eklemek istiyorsanız \"PDF İşaretle\" aracı idealdir. Formlardaki boşlukları doldurmak için de bunu kullanabilirsiniz." },
        { t: "h2", x: "3) İmza atmak" },
        { t: "p", x: "Belgeyi imzalamak için \"PDF İmzala\" aracıyla imzanızı çizin, yazın veya yükleyin; sayfada istediğiniz yere yerleştirin. İmzalama tamamen cihazınızda yapılır." },
        { t: "h2", x: "4) Form doldurmak" },
        { t: "p", x: "Doldurulabilir alanı olmayan (düz) formlarda metni doğrudan üzerine ekleyerek doldurabilirsiniz — ayrıntılı adımlar için form doldurma rehberimize bakın." },
        { t: "tip", x: "Gizli belgelerde işaretleme ve imza tamamen cihazınızda çalışır; dosyanız sunucuya gitmez. Gerçek metin silme/değiştirme ise güvenli sunucuda yapılır ve dosya işlem sonrası saklanmaz." },
      ],
      faq: [
        { q: "PDF'i ücretsiz düzenleyebilir miyim?", a: "Evet. Metin ekleme, işaretleme ve imza gibi işlemler ücretsizdir; mevcut yazıyı gerçek anlamda silip değiştirmek için de PDF Düzenle aracını kullanabilirsiniz." },
        { q: "PDF'teki yazıyı gerçekten silebilir miyim?", a: "Evet. PDF Düzenle aracı, seçtiğiniz bölgedeki metni gerçekten kaldırır (üstünü örtmez) ve yerine yenisini yazabilirsiniz." },
        { q: "Kurulum gerekiyor mu?", a: "Hayır. Tüm düzenleme araçları tarayıcıda çalışır; indirme veya kurulum gerekmez." },
        { q: "Hangi araç ne işe yarar?", a: "Mevcut yazıyı silmek/değiştirmek için PDF Düzenle; üzerine not/metin için PDF İşaretle; imza için PDF İmzala; düz form doldurmak için işaretleme aracı." },
      ],
    },
    {
      title: "Free PDF Editor: Add and Delete Text, Sign and Fill Forms",
      description:
        "Edit PDFs for free: change or delete existing text, add new text, sign, annotate and fill forms — no installation, right in your browser.",
      excerpt:
        "There's no single way to edit a PDF: changing text, adding text, signing, annotating... A guide to which tool to use for what you actually need.",
      blocks: [
        { t: "lead", x: "\"Editing a PDF\" means different things to different people: some want to change existing text, some to add notes on top, some to sign. Pick the right tool and it takes seconds. Here's a roadmap by need." },
        { t: "h2", x: "1) Change or delete existing text" },
        { t: "p", x: "If you want to actually remove text in a PDF and type new text, use the \"Edit PDF\" tool. Draw a box over the text to change, type the new text (leave empty to delete) and download." },
        { t: "cta", title: "Edit PDF", x: "Truly delete and replace existing text — draw a box, type the new text, download.", btn: "Open the tool", tool: "/tools/pdf-duzenle" },
        { t: "h2", x: "2) Add text, notes or marks on top" },
        { t: "p", x: "To add text, highlights, boxes or drawings on top without touching existing text, the \"Annotate PDF\" tool is ideal. You can also use it to fill in blanks on forms." },
        { t: "h2", x: "3) Sign" },
        { t: "p", x: "To sign a document, use the \"Sign PDF\" tool to draw, type or upload your signature and place it anywhere on the page. Signing happens entirely on your device." },
        { t: "h2", x: "4) Fill forms" },
        { t: "p", x: "For forms with no fillable fields (flat), you can fill them by adding text directly on top — see our form-filling guide for detailed steps." },
        { t: "tip", x: "For confidential documents, annotating and signing run entirely on your device; your file doesn't go to a server. Real text deletion/editing is done on a secure server and the file isn't stored after processing." },
      ],
      faq: [
        { q: "Can I edit a PDF for free?", a: "Yes. Tasks like adding text, annotating and signing are free; to truly delete and replace existing text you can use the Edit PDF tool." },
        { q: "Can I really delete text in a PDF?", a: "Yes. The Edit PDF tool actually removes the text in the selected area (it doesn't just cover it) and lets you type new text in its place." },
        { q: "Do I need to install anything?", a: "No. All editing tools run in the browser; no download or installation is required." },
        { q: "Which tool does what?", a: "Edit PDF to delete/change existing text; Annotate PDF for notes/text on top; Sign PDF for signatures; the annotate tool for filling flat forms." },
      ],
    },
  ),
  post(
    {
      slug: "pdf-kirpma-kenar-boslugu-kesme",
      date: "2026-07-22",
      updated: "2026-07-22",
      readMinutes: 4,
      tags: { tr: ["Nasıl Yapılır", "Kırpma"], en: ["How-to", "Crop"] },
      accent: "cyan",
      tool: "/tools/crop-pdf",
    },
    {
      title: "PDF Kırpma: Kenar Boşluklarını Kesme ve Sayfayı Daraltma (Ücretsiz)",
      description:
        "PDF sayfalarını tarayıcınızda kırpın: kenar boşluklarını kesin, tabloya/grafiğe odaklanın ya da üst/alt bilgiyi çıkarın — dosyanız cihazınızdan çıkmadan, ücretsiz.",
      excerpt:
        "Taranmış belgelerin geniş boşlukları, tek bir tabloya odaklanma ya da üst/alt bilgiyi çıkarma... PDF'i cihazınızda nasıl kırparsınız — adım adım.",
      blocks: [
        { t: "lead", x: "Taranmış bir belgenin kocaman beyaz kenarları mı var, yoksa bir sayfadaki tek bir tabloya mı odaklanmak istiyorsunuz? PDF kırpma, sayfanın görünür alanını istediğiniz dikdörtgene daraltır — hem de dosyanız cihazınızdan hiç çıkmadan." },
        { t: "h2", x: "PDF kırpma ne işe yarar?" },
        { t: "ul", items: [
          "Taranmış belgelerdeki geniş kenar boşluklarını kesmek.",
          "Bir sayfadaki tek bir tabloya, grafiğe veya bölüme odaklanmak.",
          "Tekrar eden üst bilgi/alt bilgi (header/footer) alanını görünümden çıkarmak.",
          "Sunum veya baskı için sayfayı düzgün bir çerçeveye getirmek.",
        ] },
        { t: "h2", x: "PDF nasıl kırpılır — adım adım" },
        { t: "steps", items: [
          { title: "PDF'i yükleyin", x: "Kırpma aracına PDF'inizi sürükleyip bırakın; ilk sayfa önizlemede açılır." },
          { title: "Kırpma kutusunu ayarlayın", x: "Kutuyu sürükleyerek taşıyın, köşelerden veya kenarlardan boyutlandırarak tutmak istediğiniz alanı seçin." },
          { title: "Kapsamı seçip indirin", x: "'Tüm sayfalar' ya da 'Yalnız bu sayfa' deyin ve 'Kırp ve İndir' ile sonucu alın." },
        ] },
        { t: "cta", title: "PDF Kırp", x: "Kutuyu sürükleyip boyutlandırın, kırpın ve indirin — cihazınızda, ücretsiz.", btn: "Aracı aç", tool: "/tools/crop-pdf" },
        { t: "h2", x: "Kırpma içeriği siler mi?" },
        { t: "p", x: "Hayır. Kırpma, sayfanın görünür alanını (CropBox) daraltan standart bir PDF işlemidir; kalan alan net biçimde görüntülenir ve yazdırılır. İşlem tamamen tarayıcınızda çalışır, dosyanız sunucuya gitmez." },
        { t: "tip", x: "Farklı sayfalarda farklı alanları kırpmak isterseniz 'Yalnız bu sayfa' seçeneğiyle sayfa sayfa uygulayın. Sayfaları önce döndürmeniz gerekiyorsa 'PDF Döndür' aracını kullanın." },
      ],
      faq: [
        { q: "PDF nasıl kırpılır?", a: "PDF'inizi yükleyin, kırpma kutusunu sürükleyip köşelerden boyutlandırarak istediğiniz alanı seçin ve 'Kırp ve İndir' deyin. İşlem cihazınızda yapılır." },
        { q: "Kenar boşluklarını kesebilir miyim?", a: "Evet. Kutuyu içeri doğru daraltarak taranmış belgelerdeki geniş beyaz kenarları kesebilirsiniz." },
        { q: "Kırpma tüm sayfalara mı uygulanır?", a: "İkisi de mümkün. 'Tüm sayfalar' ya da 'Yalnız bu sayfa' ile istediğiniz kapsama uygulayabilirsiniz." },
        { q: "Dosyam sunucuya yüklenir mi?", a: "Hayır. Kırpma tamamen tarayıcınızda (cihazınızda) çalışır; dosyanız internete hiç gönderilmez, %100 gizlidir." },
        { q: "PDF kırpmak ücretsiz mi?", a: "Evet. Kırpma üyeliksiz ve ücretsizdir; kurulum gerekmez, doğrudan tarayıcıda çalışır." },
      ],
    },
    {
      title: "How to Crop a PDF: Trim Margins and Focus the Page (Free)",
      description:
        "Crop PDF pages in your browser: trim margins, focus on a table or chart, or remove headers/footers — your file never leaves your device, free.",
      excerpt:
        "Wide margins on scanned documents, focusing on a single table, or removing headers/footers... how to crop a PDF on your device — step by step.",
      blocks: [
        { t: "lead", x: "Got a scanned document with huge white borders, or want to focus on a single table on a page? Cropping a PDF narrows the visible area to any rectangle you choose — and your file never leaves your device." },
        { t: "h2", x: "What is cropping a PDF good for?" },
        { t: "ul", items: [
          "Trimming the wide margins on scanned documents.",
          "Focusing on a single table, chart or section on a page.",
          "Removing repeating header/footer areas from view.",
          "Framing the page neatly for presentation or printing.",
        ] },
        { t: "h2", x: "How to crop a PDF — step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Drag and drop your PDF into the crop tool; the first page opens in the preview." },
          { title: "Set the crop box", x: "Drag the box to move it, and resize from the corners or edges to select the area you want to keep." },
          { title: "Choose scope and download", x: "Pick 'All pages' or 'This page only' and click 'Crop & Download' to get the result." },
        ] },
        { t: "cta", title: "Crop PDF", x: "Drag and resize the box, crop and download — on your device, free.", btn: "Open the tool", tool: "/tools/crop-pdf" },
        { t: "h2", x: "Does cropping delete content?" },
        { t: "p", x: "No. Cropping is a standard PDF operation that narrows the page's visible area (CropBox); the remaining area displays and prints cleanly. It runs entirely in your browser, and your file is not sent to a server." },
        { t: "tip", x: "To crop different areas on different pages, use 'This page only' and apply it page by page. If you need to rotate pages first, use the 'Rotate PDF' tool." },
      ],
      faq: [
        { q: "How do I crop a PDF?", a: "Upload your PDF, drag and resize the crop box from the corners to select the area you want, and click 'Crop & Download'. It happens on your device." },
        { q: "Can I trim the margins?", a: "Yes. Narrow the box inward to cut the wide white borders on scanned documents." },
        { q: "Is the crop applied to all pages?", a: "Either way. Use 'All pages' or 'This page only' to apply it to the scope you want." },
        { q: "Is my file uploaded to a server?", a: "No. Cropping runs entirely in your browser (on your device); your file is never sent to the internet and stays 100% private." },
        { q: "Is cropping a PDF free?", a: "Yes. Cropping is free and needs no signup or installation; it runs directly in the browser." },
      ],
    },
  ),
  post(
    {
      slug: "ucretsiz-pdf-araci-nasil-secilir",
      date: "2026-07-23",
      updated: "2026-07-23",
      readMinutes: 7,
      tags: { tr: ["Rehber", "Gizlilik"], en: ["Guide", "Privacy"] },
      accent: "emerald",
      tool: "/tools/merge-pdf",
    },
    {
      title: "Ücretsiz PDF Aracı Nasıl Seçilir? 2026 Rehberi (Gizlilik ve Güvenlik)",
      description:
        "Her \"ücretsiz PDF aracı\" aynı değil. Dosya yükleme, üyelik, filigran, günlük sınır ve gizlilik — bilinçli seçim için tam kontrol listesi ve karşılaştırma.",
      excerpt:
        "Dosyanı sunucuya yükleyen mi, cihazında işleyen mi? Ücretsiz bir PDF aracını seçmeden önce bakman gereken 6 şey — dürüst bir rehber.",
      blocks: [
        { t: "lead", x: "\"Ücretsiz online PDF aracı\" araması yüzlerce sonuç verir ama hepsi aynı değildir. Bazısı dosyanı sunucusuna yükler, bazısı çıktıya filigran koyar, bazısı basit bir işlem için üyelik ister. Bu rehber, doğru aracı seçmen için nelere bakman gerektiğini adım adım anlatır." },

        { t: "h2", x: "Çoğu online PDF aracının görünmeyen tarafı: dosya yükleme" },
        { t: "p", x: "Çoğu online PDF aracında birleştirme, bölme ya da dönüştürme için dosyan önce onların sunucusuna yüklenir, orada işlenir, sonra silinir. Genelde güvenlidir; ama bir sözleşme, kimlik ya da mali tablo için dosyanın bir süreliğine de olsa internete çıkması bir soru işareti bırakır. Alternatif yaklaşım: işlemin dosyanın hiç cihazından çıkmadan, doğrudan tarayıcıda yapılması." },

        { t: "h2", x: "İyi bir ücretsiz PDF aracında aranacak 6 şey" },
        { t: "ul", items: [
          "Gizlilik: Dosya sunucuya mı yükleniyor, yoksa tarayıcında mı (cihazında) işleniyor? Hassas belgeler için cihazda işleme en güvenlisidir.",
          "Zorunlu filigran: Ücretsiz çıktıya damga ekleniyor mu? Profesyonel bir belge için bu can sıkıcıdır.",
          "Üyelik zorunluluğu: Basit bir birleştirme için hesap açmak gerekiyor mu?",
          "Günlük/işlem sınırı: Ücretsizde belirli sayıda işlemden sonra beklemen ya da ödeme yapman isteniyor mu?",
          "Kurulum: Tarayıcıda mı çalışıyor, yoksa program/eklenti mi istiyor?",
          "Kapsam: Sadece birleştirme mi, yoksa böl/kırp/döndür/dönüştür/imza gibi ihtiyaç duyacağın araçlar da var mı?",
        ] },

        { t: "h2", x: "Neden \"cihazda işleme\" fark yaratır?" },
        { t: "p", x: "Bir araç işlemi tarayıcında yapıyorsa üç şey kazanırsın: gizlilik (dosya internete gitmez), hız (yükleme/indirme beklemezsin, anında sonuç) ve çevrimdışı çalışma (bir kez açıldıktan sonra bağlantı kesilse de çalışır). PDF Platform'da birleştir, böl, kırp, döndür, sayfa sil, sırala ve görsel→PDF gibi yapısal araçlar tamamen cihazında çalışır — dosyan sunucuya hiç gitmez." },

        { t: "cta", title: "PDF Araçlarını Dene", x: "Birleştir, böl, kırp, döndür — dosyan cihazından çıkmadan, üyeliksiz ve ücretsiz.", btn: "Aracı aç", tool: "/tools/merge-pdf" },

        { t: "h2", x: "Hangi işlem cihazda yapılabilir, hangisi sunucu ister?" },
        { t: "p", x: "Dürüst olmak gerekir: her işlem tarayıcıda yapılamaz. Doğru araç, bu ayrımı sana açıkça söyleyendir. Genel kural:" },
        { t: "ul", items: [
          "Cihazda yapılabilir (dosya çıkmaz): birleştir, böl, döndür, sayfa sil, sayfa sırala, kırp, görsel→PDF, imza ve işaretleme.",
          "Sunucu gerektirir: Word/Excel/PowerPoint dönüştürme, OCR (taranmış belgeyi metne çevirme), yüksek oranlı sıkıştırma ve yapay zekâ (özet, sohbet, çeviri). Burada da iyi bir araç içeriği saklamaz ve şifreli bağlantı kullanır.",
        ] },

        { t: "h2", x: "Kısa özet: nasıl seçmeli?" },
        { t: "steps", items: [
          { title: "Hassas belge mi?", x: "Evetse, işlemi cihazında (tarayıcıda) yapan bir araç seç — dosya internete gitmesin." },
          { title: "Sadece basit bir iş mi (birleştir/böl/kırp)?", x: "Üyelik ve kurulum isteyeni ele; bunlar üyeliksiz ve anında yapılabilir." },
          { title: "Dönüştürme/OCR gerekiyor mu?", x: "Bunlar sunucu ister; içeriğin saklanmadığını ve şifreli aktarım kullanıldığını doğrula." },
        ] },
        { t: "tip", x: "Pratik test: Aracı aç, bir dosya seç ve işlemin ne kadar sürede bittiğine bak. Yükleme çubuğu görmeden anında sonuç geliyorsa, işlem büyük olasılıkla cihazında yapılıyordur — yani dosyan internete gitmemiştir." },
      ],
      faq: [
        { q: "Ücretsiz PDF araçları güvenli mi?", a: "Çoğu dosyanı sunucusuna yükler; genelde güvenlidir ama hassas belgeler için işlemi cihazında (tarayıcıda) yapan araçları tercih et — o zaman dosya internete hiç gönderilmez." },
        { q: "Dosyamı yüklemeden PDF birleştirebilir miyim?", a: "Evet. Tarayıcıda çalışan araçlarda (ör. PDF Platform'un birleştirme aracı) dosya cihazında işlenir, sunucuya gitmez. Sürükle, sırala, indir — hepsi yerel." },
        { q: "Ücretsiz araçlar filigran koyar mı?", a: "Bazıları koyar. Seçmeden önce ücretsiz çıktıya zorunlu filigran eklenip eklenmediğini kontrol et; PDF Platform zorunlu filigran eklemez." },
        { q: "Hangi PDF işlemleri sunucu gerektirir?", a: "Word/Excel dönüştürme, OCR, yüksek sıkıştırma ve yapay zekâ araçları sunucuda çalışır. Birleştir, böl, kırp, döndür gibi yapısal işlemler cihazında yapılabilir." },
        { q: "En iyi ücretsiz PDF aracı hangisi?", a: "İşine bağlı: hassas belgede cihazda çalışan yapısal araçlar; dönüştürmede biçimi koruyan dönüştürücüler; uzun belgede yapay zekâ araçları. Öncelik gizlilikse, cihazda-işleme yaklaşımı belirleyici olur." },
      ],
    },
    {
      title: "How to Choose a Free PDF Tool in 2026 (Privacy & Security Guide)",
      description:
        "Not every \"free PDF tool\" is the same. Uploading, sign-up, watermarks, daily limits and privacy — a full checklist and comparison to choose wisely.",
      excerpt:
        "Does it upload your file to a server, or process it on your device? The 6 things to check before picking a free PDF tool — an honest guide.",
      blocks: [
        { t: "lead", x: "Searching for a \"free online PDF tool\" returns hundreds of results, but they're not the same. Some upload your file to their servers, some add a watermark, some ask you to sign up for a simple task. This guide walks through exactly what to check so you pick the right one." },

        { t: "h2", x: "The hidden side of most online PDF tools: uploading" },
        { t: "p", x: "In most online PDF tools, merging, splitting or converting uploads your file to their server, processes it there, and then deletes it. It's usually safe, but for a contract, ID or financial statement, having the file go to the internet — even briefly — leaves a question mark. The alternative: the operation runs directly in your browser, so the file never leaves your device." },

        { t: "h2", x: "6 things to look for in a free PDF tool" },
        { t: "ul", items: [
          "Privacy: Is the file uploaded to a server, or processed in your browser (on your device)? On-device is safest for sensitive documents.",
          "Forced watermark: Is a stamp added to the free output? Annoying for a professional document.",
          "Sign-up requirement: Does a simple merge require an account?",
          "Daily/usage limit: Are you asked to wait or pay after a set number of free tasks?",
          "Installation: Does it run in the browser, or need a program/plugin?",
          "Coverage: Just merging, or also split/crop/rotate/convert/sign — the tools you'll actually need?",
        ] },

        { t: "h2", x: "Why \"on-device\" processing matters" },
        { t: "p", x: "If a tool runs the operation in your browser, you gain three things: privacy (the file doesn't go online), speed (no upload/download wait, instant results), and offline use (once loaded, it works even if your connection drops). On PDF Platform, structural tools like merge, split, crop, rotate, delete pages, reorder and image→PDF run entirely on your device — your file never goes to a server." },

        { t: "cta", title: "Try the PDF Tools", x: "Merge, split, crop, rotate — without your file leaving your device, no sign-up, free.", btn: "Open the tool", tool: "/tools/merge-pdf" },

        { t: "h2", x: "Which operations run on-device, which need a server?" },
        { t: "p", x: "To be honest, not everything can run in the browser. The right tool is the one that tells you the split clearly. The general rule:" },
        { t: "ul", items: [
          "Can run on-device (file never leaves): merge, split, rotate, delete pages, reorder, crop, image→PDF, sign and annotate.",
          "Needs a server: Word/Excel/PowerPoint conversion, OCR (turning scans into text), high-ratio compression and AI (summarize, chat, translate). Even here, a good tool doesn't store content and uses an encrypted connection.",
        ] },

        { t: "h2", x: "Quick summary: how to choose" },
        { t: "steps", items: [
          { title: "Is it a sensitive document?", x: "If yes, pick a tool that runs the operation on your device (in the browser) so the file doesn't go online." },
          { title: "Just a simple task (merge/split/crop)?", x: "Skip the ones that require sign-up or installation; these can be done with no account, instantly." },
          { title: "Need conversion/OCR?", x: "Those need a server; confirm content isn't stored and an encrypted connection is used." },
        ] },
        { t: "tip", x: "A quick test: open the tool, pick a file, and watch how fast it finishes. If you get instant results with no upload bar, the operation is likely running on your device — meaning your file didn't go to the internet." },
      ],
      faq: [
        { q: "Are free PDF tools safe?", a: "Most upload your file to a server; that's usually safe, but for sensitive documents prefer tools that process on your device (in the browser) — then the file is never sent to the internet." },
        { q: "Can I merge PDFs without uploading my file?", a: "Yes. With browser-based tools (like PDF Platform's merge tool), the file is processed on your device and not sent to a server. Drag, reorder, download — all local." },
        { q: "Do free tools add a watermark?", a: "Some do. Before choosing, check whether a forced watermark is added to the free output; PDF Platform doesn't add one." },
        { q: "Which PDF operations need a server?", a: "Word/Excel conversion, OCR, high compression and AI tools run on a server. Structural tasks like merge, split, crop and rotate can run on your device." },
        { q: "What's the best free PDF tool?", a: "It depends on the task: on-device structural tools for sensitive files; format-preserving converters for conversion; AI tools for long documents. If privacy is the priority, the on-device approach is the deciding factor." },
      ],
    },
  ),
  post(
    {
      slug: "pdf-kucultme-eposta-whatsapp",
      date: "2026-07-23",
      updated: "2026-07-23",
      readMinutes: 4,
      tags: { tr: ["Nasıl Yapılır", "Sıkıştırma"], en: ["How-to", "Compress"] },
      accent: "amber",
      tool: "/tools/compress",
    },
    {
      title: "PDF'i E-postayla veya WhatsApp'ta Gönderilecek Kadar Küçültme",
      description:
        "PDF çok büyük, e-posta veya WhatsApp kabul etmiyor mu? Dosyayı gönderim sınırlarının altına indirmek için PDF sıkıştırma — metin ve görseller net kalır.",
      excerpt:
        "\"Dosya çok büyük\" hatası mı alıyorsun? PDF'i e-posta ve WhatsApp sınırlarının altına indirmenin en kolay yolu — adım adım.",
      blocks: [
        { t: "lead", x: "Bir PDF'i e-postayla göndermek istiyorsun ama \"dosya çok büyük\" diyor; ya da WhatsApp belgeyi kabul etmiyor. Çözüm dosyayı bölmek değil, sıkıştırmak: boyutu düşürüp içeriği korumak." },
        { t: "h2", x: "Neden büyük? Ve tipik sınırlar" },
        { t: "ul", items: [
          "Taranmış belgeler ve bol görselli PDF'ler en çok yer kaplar.",
          "Gmail eki: ~25 MB · Outlook: ~20 MB · WhatsApp belge: ~100 MB ama pratikte çok büyük dosyalar takılır.",
          "Portal/başvuru sistemleri sık sık 2–10 MB sınırı koyar.",
        ] },
        { t: "h2", x: "PDF'i küçültme — adım adım" },
        { t: "steps", items: [
          { title: "PDF'i yükle", x: "Sıkıştırma aracına dosyanı sürükleyip bırak." },
          { title: "Sıkıştırma düzeyini seç", x: "Dengeli düzeyde belirgin kalite kaybı olmaz; daha yüksek düzey boyutu daha çok düşürür." },
          { title: "İndir ve gönder", x: "Optimize edilmiş dosyayı indir; artık e-posta/WhatsApp sınırının altında." },
        ] },
        { t: "cta", title: "PDF Küçült", x: "Dosyanı yükle, sıkıştır ve gönderime hazır hâlde indir — ücretsiz.", btn: "Aracı aç", tool: "/tools/compress" },
        { t: "h2", x: "Küçültünce kalite bozulur mu?" },
        { t: "p", x: "Dengeli düzeyde hayır — metin seçilebilir ve net kalır, görseller okunaklı olur. Metin katmanı korunduğu için sıkıştırılmış PDF'te de arama yapabilir, kopyalayabilirsin. En büyük kazanç genellikle taranmış (görsel ağırlıklı) PDF'lerde olur." },
        { t: "tip", x: "Hâlâ büyükse: gereksiz sayfaları \"PDF Böl/Sil\" ile çıkar ya da yalnız gereken sayfaları gönder. Birden çok belgeyi tek dosyada göndereceksen önce sıkıştır, sonra \"PDF Birleştir\" ile topla." },
      ],
      faq: [
        { q: "PDF'i e-postaya sığdıracak kadar nasıl küçültürüm?", a: "PDF'i sıkıştırma aracına yükle, bir sıkıştırma düzeyi seç ve indir. Dosya Gmail/Outlook sınırlarının (≈20–25 MB) altına iner; daha da küçük gerekiyorsa yüksek düzeyi seç." },
        { q: "WhatsApp'ta PDF neden gönderilmiyor?", a: "Genelde dosya çok büyük olduğu için. PDF'i sıkıştırıp boyutunu düşürünce WhatsApp belge olarak sorunsuz gönderir." },
        { q: "Sıkıştırınca metin seçilebilir kalır mı?", a: "Evet. Metin katmanı korunur; sıkıştırılmış PDF'te de metni seçebilir, arayabilir ve kopyalayabilirsin." },
        { q: "PDF küçültmek ücretsiz mi?", a: "Evet. PDF'ini yükle, sıkıştır ve optimize edilmiş dosyayı indir — üyelik gerekmez." },
        { q: "Taranmış PDF'i küçültebilir miyim?", a: "Evet. Görsel ağırlıklı, taranmış PDF'lerde sıkıştırma genellikle en yüksek boyut kazancını sağlar." },
      ],
    },
    {
      title: "How to Shrink a PDF to Email or Send on WhatsApp",
      description:
        "PDF too big for email or WhatsApp? Compress it below the sending limits while keeping text and images sharp — step by step.",
      excerpt:
        "Getting a \"file too large\" error? The easiest way to get a PDF under email and WhatsApp limits — step by step.",
      blocks: [
        { t: "lead", x: "You want to email a PDF but it says \"file too large\", or WhatsApp won't accept the document. The fix isn't splitting it — it's compressing: reduce the size while keeping the content." },
        { t: "h2", x: "Why so big? And typical limits" },
        { t: "ul", items: [
          "Scanned documents and image-heavy PDFs take the most space.",
          "Gmail attachment: ~25 MB · Outlook: ~20 MB · WhatsApp document: ~100 MB, but very large files stall in practice.",
          "Portals and application systems often cap at 2–10 MB.",
        ] },
        { t: "h2", x: "Shrink a PDF — step by step" },
        { t: "steps", items: [
          { title: "Upload the PDF", x: "Drag and drop your file into the compress tool." },
          { title: "Pick a compression level", x: "At a balanced level there's no noticeable quality loss; a higher level reduces size further." },
          { title: "Download and send", x: "Download the optimized file — now under the email/WhatsApp limit." },
        ] },
        { t: "cta", title: "Compress PDF", x: "Upload your file, compress it, and download it ready to send — free.", btn: "Open the tool", tool: "/tools/compress" },
        { t: "h2", x: "Does compressing hurt quality?" },
        { t: "p", x: "At a balanced level, no — text stays selectable and crisp, and images stay readable. The text layer is preserved, so you can still search and copy in the compressed PDF. The biggest savings usually come from scanned, image-heavy PDFs." },
        { t: "tip", x: "Still too big? Remove unneeded pages with \"Split/Delete\", or send only the pages you need. If you're sending several documents as one file, compress first, then combine with \"Merge PDF\"." },
      ],
      faq: [
        { q: "How do I shrink a PDF to fit an email?", a: "Upload it to the compress tool, pick a level, and download. The file drops under Gmail/Outlook limits (≈20–25 MB); for even smaller, choose a higher level." },
        { q: "Why won't WhatsApp send my PDF?", a: "Usually because the file is too large. Compress the PDF to reduce its size and WhatsApp will send it as a document with no problem." },
        { q: "Does the text stay selectable after compressing?", a: "Yes. The text layer is preserved, so you can still select, search and copy text in the compressed PDF." },
        { q: "Is compressing a PDF free?", a: "Yes. Upload your PDF, compress it, and download the optimized file — no account needed." },
        { q: "Can I compress a scanned PDF?", a: "Yes. Image-heavy scanned PDFs usually see the biggest size reduction from compression." },
      ],
    },
  ),
  post(
    {
      slug: "telefonda-pdf-duzenleme-uygulamasiz",
      date: "2026-07-23",
      updated: "2026-07-23",
      readMinutes: 4,
      tags: { tr: ["Nasıl Yapılır", "Mobil"], en: ["How-to", "Mobile"] },
      accent: "sky",
      tool: "/tools/pdf-yorumla",
    },
    {
      title: "Telefonda PDF Düzenleme (Uygulamasız): Metin, İmza ve İşaretleme",
      description:
        "Telefonda uygulama kurmadan PDF düzenle: metin/not ekle, imzala, işaretle. Tarayıcıda çalışır — Android ve iPhone'da, dosyan cihazından çıkmadan.",
      excerpt:
        "Telefona uygulama kurmadan PDF'e metin ekle, imzala, işaretle — hepsi tarayıcıda. Android ve iPhone'da nasıl yapılır.",
      blocks: [
        { t: "lead", x: "Yolda bir belgeyi imzalaman ya da bir forma not eklemen gerekti ama telefonuna PDF uygulaması kurmak istemiyorsun. Gerek de yok — bunların çoğunu telefon tarayıcında, kurulum olmadan yapabilirsin." },
        { t: "h2", x: "Telefonda uygulamasız neler yapabilirsin?" },
        { t: "ul", items: [
          "Üzerine metin/not ekleme ve boşlukları doldurma → İşaretle aracı",
          "İmza atma (parmakla çiz, yaz veya fotoğrafını yükle) → İmzala aracı",
          "Fosforlu, kutu, çizim ile işaretleme → İşaretle aracı",
          "Mevcut yazıyı gerçekten silip değiştirme → Düzenle aracı",
        ] },
        { t: "h2", x: "Adım adım (Android ve iPhone)" },
        { t: "steps", items: [
          { title: "Tarayıcıda aracı aç", x: "Telefonunun tarayıcısında (Chrome/Safari) araç sayfasını aç — kurulum yok." },
          { title: "PDF'ini yükle", x: "Dosyanı seç; işaretle/imzala aracı doğrudan telefonda çalışır." },
          { title: "Düzenle ve indir", x: "Parmakla imzala/işaretle, sonra \"Uygula ve İndir\" ile kaydet." },
        ] },
        { t: "cta", title: "Telefonda PDF İşaretle", x: "Metin ekle, imzala, işaretle — telefonunda, uygulamasız ve ücretsiz.", btn: "Aracı aç", tool: "/tools/pdf-yorumla" },
        { t: "h2", x: "Dosyam güvende mi?" },
        { t: "p", x: "İşaretleme ve imzalama tamamen telefonunun tarayıcısında (cihazında) yapılır; PDF sunucuya yüklenmez, %100 gizlidir. Yalnızca gerçek metin silme/değiştirme sunucuda yapılır ve dosya işlem sonrası saklanmaz." },
        { t: "tip", x: "İmza için imzanı bir kez beyaz kağıda atıp fotoğrafını yükleyebilirsin; araç arka planı temizleyip belgeye yerleştirir. Formu doldurup imzaladıktan sonra e-postayla ya da WhatsApp'la doğrudan telefondan gönderebilirsin." },
      ],
      faq: [
        { q: "Telefonda uygulama kurmadan PDF düzenleyebilir miyim?", a: "Evet. Telefon tarayıcında (Chrome/Safari) araç sayfasını aç; metin ekleme, işaretleme ve imzalama kurulum olmadan çalışır." },
        { q: "iPhone'da PDF'e imza atabilir miyim?", a: "Evet. Safari'de imzalama aracını aç, imzanı parmağınla çiz veya fotoğrafını yükle, sayfaya yerleştir ve indir." },
        { q: "Telefonda PDF'e metin ekleyebilir miyim?", a: "Evet. İşaretleme aracıyla boşluklara dokunup metin ekleyebilir, formları doldurabilirsin — hepsi telefonda." },
        { q: "Dosyam telefonda güvende mi?", a: "İşaretleme ve imzalama cihazında yapılır, dosya sunucuya gitmez. Gerçek metin düzenleme sunucuda yapılır ama dosya saklanmaz." },
        { q: "Ücretsiz mi?", a: "Evet. Metin ekleme, işaretleme ve imzalama üyeliksiz ve ücretsizdir." },
      ],
    },
    {
      title: "How to Edit a PDF on Your Phone (No App): Text, Signature, Markup",
      description:
        "Edit a PDF on your phone without installing an app: add text, sign, and annotate. Works in the browser on Android and iPhone, without uploading your file.",
      excerpt:
        "Add text, sign and annotate a PDF on your phone with no app — all in the browser. How to do it on Android and iPhone.",
      blocks: [
        { t: "lead", x: "You need to sign a document or add a note to a form on the go, but you don't want to install a PDF app on your phone. You don't have to — you can do most of this in your phone's browser, with no installation." },
        { t: "h2", x: "What can you do on your phone with no app?" },
        { t: "ul", items: [
          "Add text/notes and fill in blanks → Annotate tool",
          "Sign (draw with your finger, type, or upload a photo) → Sign tool",
          "Highlight, boxes, drawing → Annotate tool",
          "Actually delete and change existing text → Edit tool",
        ] },
        { t: "h2", x: "Step by step (Android and iPhone)" },
        { t: "steps", items: [
          { title: "Open the tool in your browser", x: "Open the tool page in your phone browser (Chrome/Safari) — no install." },
          { title: "Upload your PDF", x: "Pick your file; the annotate/sign tool runs right on the phone." },
          { title: "Edit and download", x: "Sign/mark with your finger, then save with \"Apply & download\"." },
        ] },
        { t: "cta", title: "Annotate PDF on Your Phone", x: "Add text, sign, annotate — on your phone, no app, free.", btn: "Open the tool", tool: "/tools/pdf-yorumla" },
        { t: "h2", x: "Is my file safe?" },
        { t: "p", x: "Annotating and signing happen entirely in your phone's browser (on your device); the PDF isn't uploaded and stays 100% private. Only true text deletion/editing runs on a server, and the file isn't stored after processing." },
        { t: "tip", x: "For a signature, sign once on white paper and upload the photo; the tool cleans the background and places it on the document. After filling and signing, you can email or WhatsApp it straight from your phone." },
      ],
      faq: [
        { q: "Can I edit a PDF on my phone without installing an app?", a: "Yes. Open the tool page in your phone browser (Chrome/Safari); adding text, annotating and signing work with no installation." },
        { q: "Can I sign a PDF on iPhone?", a: "Yes. Open the sign tool in Safari, draw your signature with your finger or upload a photo, place it on the page, and download." },
        { q: "Can I add text to a PDF on my phone?", a: "Yes. With the annotate tool you can tap blanks and add text, and fill forms — all on the phone." },
        { q: "Is my file safe on the phone?", a: "Annotating and signing happen on your device and the file isn't sent to a server. True text editing runs on a server but the file isn't stored." },
        { q: "Is it free?", a: "Yes. Adding text, annotating and signing are free and need no sign-up." },
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
