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
];

/** Slug → post. */
export function getBlogPost(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}

/** Yeniden eskiye sıralı liste. */
export function getBlogPostsSorted() {
  return [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}
