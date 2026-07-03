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
];

/** Slug → post. */
export function getBlogPost(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}

/** Yeniden eskiye sıralı liste. */
export function getBlogPostsSorted() {
  return [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}
