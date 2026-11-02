// ─────────────────────────────────────────────────────────────────────────────
// QR KOD + İÇİNDEKİLER REHBERLERİ — "PDF'ye QR Kod Ekle" ve "Birleştir + İçindekiler"
// araçlarını anlatan üç yazı. Yalnızca araçların GERÇEK özelliklerine dayanır; TR ve EN
// metinler ayrı yazılmıştır (çeviri değil).
// ─────────────────────────────────────────────────────────────────────────────

const post = (meta, tr, en) => ({ ...meta, tr, en });

export const QR_TOC_EN_SLUGS = {
  "pdf-ye-qr-kod-ekleme-rehberi": "add-qr-code-to-pdf-guide",
  "kartvizit-qr-kod-vcard-nasil-yapilir": "business-card-vcard-qr-code",
  "dava-dosyasi-ihale-icindekiler-yer-imi": "case-file-tender-table-of-contents-bookmarks",
};

export const QR_TOC_POSTS = [
  post(
    {
      slug: "pdf-ye-qr-kod-ekleme-rehberi",
      date: "2026-11-02",
      updated: "2026-11-02",
      readMinutes: 5,
      tags: { tr: ["QR Kod", "PDF Araçları"], en: ["QR Code", "PDF Tools"] },
      accent: "cyan",
      tool: "/tools/pdf-qr-ekle",
    },
    {
      title: "PDF'ye QR Kod Ekleme: Doğru Boyut, Konum ve Baskı",
      description:
        "Fatura, menü, broşür ya da sertifikanıza QR kod eklemek için adım adım rehber. Hangi boyut okunur, nereye konur, baskıda neden bulanıklaşmaz.",
      excerpt:
        "QR kodu PDF'ye eklemek kolay; okunur ve düzgün görünür olması ise ayar işi. Boyut, renk, konum ve baskı için pratik ölçüler.",
      blocks: [
        { t: "lead", x: "Elinizde hazır bir PDF var ve okuyucuyu bir web sayfasına, kişi kartına ya da Wi-Fi ağına götürmek istiyorsunuz. QR kod bunun en kısa yolu; ama kodu sayfaya rastgele koymak, okunmayan bir kare bırakmak demek olabilir." },
        { t: "h2", x: "Adım adım: PDF'ye QR kod koymak" },
        { t: "steps", items: [
          { title: "PDF'i seçin", x: "Belgenizi araca bırakın. Sayfaların küçük resmi önizlemede görünür." },
          { title: "İçeriği girin", x: "Web sitesi, kişi kartı, telefon, e-posta, WhatsApp, Wi-Fi ya da düz metin seçin. Adresin başına «https://» yazmanız gerekmez; araç ekler." },
          { title: "Yerleştirin", x: "QR'ı önizlemede tutup sürükleyin, köşesinden büyütüp küçültün. İlk sayfaya, son sayfaya, tüm sayfalara ya da «1,3,5-7» gibi seçtiğiniz sayfalara ekleyin." },
          { title: "İndirin", x: "Hazır dosya «orijinal-ad_qr.pdf» adıyla iner. Belgenin metni, bağlantıları ve formları olduğu gibi kalır." },
        ] },
        { t: "cta", title: "PDF'ye QR Kod Ekle", x: "QR'ı sayfada istediğiniz yere sürükleyin; dosyanız cihazınızdan çıkmaz.", btn: "Aracı aç", tool: "/tools/pdf-qr-ekle" },
        { t: "h2", x: "Ne kadar büyük olmalı?" },
        { t: "p", x: "Küçük QR'lar okunmakta zorlanır. Araç, 15 mm'nin altına indiğinizde sizi uyarır; kartvizit gibi dar alanlarda bile bu ölçünün altına inmemek iyi bir kuraldır. İçerik uzadıkça kod daha sık desenli olur, yani aynı boyutta daha zor okunur. Uzun bir metin yerine kısa bir adres kullanmak, küçük bir alanda en büyük kazançtır." },
        { t: "h2", x: "Renk ve zemin" },
        { t: "ul", items: [
          "Koyu desen, açık zemin en güvenli birleşimdir.",
          "Açık renkli desen koyu zeminde birçok telefonda okunmaz; araç bunu fark edip uyarır.",
          "Desen ile zemin birbirine yakın tonlardaysa kod okunmayabilir; kontrast düşükse uyarı görürsünüz.",
          "Kodun çevresindeki boş çerçeveyi (kenar boşluğu) daraltmayın; okuyucunun kodu tanıması için gereklidir.",
        ] },
        { t: "h2", x: "Baskıda neden keskin kalır?" },
        { t: "p", x: "QR, PDF'ye resim olarak değil, vektör şekiller olarak çizilir. Bu yüzden büyütseniz de küçültseniz de kenarları keskin kalır; matbaaya giden bir broşürde bile bulanıklık olmaz. Kodun kendisine ihtiyacınız olursa PNG ya da SVG olarak ayrıca indirebilirsiniz." },
        { t: "h2", x: "Logo eklemek" },
        { t: "p", x: "Kodun ortasına küçük bir logo koyabilirsiniz. Logo, kodun bir kısmını kapattığı için araç hata düzeltmeyi otomatik olarak en yüksek düzeye alır; yine de logoyu küçük tutun ve baskıdan önce telefonunuzla deneyin." },
        { t: "tip", x: "Ekrandaki PDF'te QR'ı telefonla okutmak için kodu büyütmeniz gerekebilir; bu ekran sorunudur, baskıda aynı kod rahat okunur. Yine de baskıya göndermeden önce bir deneme çıktısı alın." },
        { t: "h2", x: "Web adresi olan kod PDF içinde tıklanır" },
        { t: "p", x: "İçerik bir web adresiyse, QR'ın bulunduğu alan PDF içinde tıklanabilir bağlantı da olur. Yani belgeyi ekranda okuyan biri koda tıklayarak, çıktısını alan biri telefonunu tutarak aynı yere ulaşır." },
      ],
      faq: [
        { q: "QR kod eklemek dosyamın kalitesini düşürür mü?", a: "Hayır. Sayfanın metni, görselleri, bağlantıları ve formları değişmez; QR yalnızca üstüne eklenir." },
        { q: "Hangi sayfalara eklenir?", a: "İlk sayfa, son sayfa, tüm sayfalar ya da belirttiğiniz sayfalar. Konum, sayfa boyutu farklı olsa bile her sayfada aynı göreli noktaya düşer." },
        { q: "QR için en az boyut nedir?", a: "Güvenilir okuma için en az 15 mm öneriyoruz. Araç daha küçük boyutlarda uyarı verir." },
        { q: "Dosyam sunucuya yükleniyor mu?", a: "Hayır. QR üretimi ve yerleştirme tarayıcınızda yapılır." },
        { q: "Aynı QR'ı PNG olarak alabilir miyim?", a: "Evet. Araçtan QR'ı ayrıca PNG ya da SVG olarak indirebilirsiniz." },
      ],
    },
    {
      title: "Adding a QR Code to a PDF: Size, Placement, Print",
      description:
        "A step-by-step guide to putting a QR code on an invoice, menu, brochure or certificate. What size scans, where to place it and why it stays sharp in print.",
      excerpt:
        "Adding a QR code to a PDF is easy; making it scan reliably is a matter of settings. Practical sizes, colours and print advice.",
      blocks: [
        { t: "lead", x: "You already have a finished PDF and want readers to land on a web page, a contact card or a Wi-Fi network. A QR code is the shortest route there, but dropping one onto the page at random can leave you with a square nobody can scan." },
        { t: "h2", x: "Step by step: putting a QR code on a PDF" },
        { t: "steps", items: [
          { title: "Pick the PDF", x: "Drop your document into the tool. A thumbnail of the page appears as a preview." },
          { title: "Enter the content", x: "Choose website, contact card, phone, email, WhatsApp, Wi-Fi or plain text. You do not need to type https://; the tool adds it." },
          { title: "Place it", x: "Drag the QR on the preview and resize it from its corner. Put it on the first page, the last, every page or just pages such as 1,3,5-7." },
          { title: "Download", x: "The file comes out as original-name_qr.pdf. The text, links and forms of your document stay as they were." },
        ] },
        { t: "cta", title: "Add a QR Code to PDF", x: "Drag the QR anywhere on the page; your file never leaves your device.", btn: "Open the tool", tool: "/tools/pdf-qr-ekle" },
        { t: "h2", x: "How big should it be?" },
        { t: "p", x: "Small codes struggle to scan. The tool warns you below 15 mm, and even on a tight layout such as a business card that is a sensible floor. The more you put in the code the denser its pattern becomes, which makes it harder to read at the same size. A short web address instead of a long text is the biggest win in a small space." },
        { t: "h2", x: "Colour and background" },
        { t: "ul", items: [
          "A dark pattern on a light background is the safest pairing.",
          "A light pattern on a dark background fails on many phones; the tool notices and warns you.",
          "If the pattern and background are close in tone the code may not scan; you get a warning when contrast is low.",
          "Do not squeeze the blank frame around the code; the reader needs it to recognise the code.",
        ] },
        { t: "h2", x: "Why it stays sharp in print" },
        { t: "p", x: "The QR is drawn into the PDF as vector shapes rather than as a picture. Scale it up or down and its edges stay crisp, even on a brochure going to a print shop. If you need the code on its own, you can download it as PNG or SVG too." },
        { t: "h2", x: "Adding a logo" },
        { t: "p", x: "You can place a small logo in the middle. Because a logo hides part of the code, the tool raises error correction to its highest level automatically. Keep the logo small anyway and test the printed result with your phone." },
        { t: "tip", x: "On screen you may need to zoom in before a phone can read the code; that is a screen limit, not a flaw. Print a test copy before sending the job away." },
        { t: "h2", x: "A web-address code is clickable inside the PDF" },
        { t: "p", x: "When the content is a web address, the area under the QR also becomes a clickable link inside the PDF. Someone reading on screen can click it; someone holding a printout can point a phone at it." },
      ],
      faq: [
        { q: "Does adding a QR code reduce my file's quality?", a: "No. The page's text, images, links and forms are untouched; the QR is simply added on top." },
        { q: "Which pages can get one?", a: "The first, the last, every page, or the pages you list. The position lands at the same relative spot on each page even when page sizes differ." },
        { q: "What is the minimum size?", a: "We recommend at least 15 mm for reliable scanning, and the tool warns you below that." },
        { q: "Is my file uploaded?", a: "No. The QR is generated and placed in your browser." },
        { q: "Can I get the QR as a PNG?", a: "Yes. You can download the QR separately as PNG or SVG." },
      ],
    },
  ),

  post(
    {
      slug: "kartvizit-qr-kod-vcard-nasil-yapilir",
      date: "2026-11-02",
      updated: "2026-11-02",
      readMinutes: 5,
      tags: { tr: ["QR Kod", "Kartvizit", "vCard"], en: ["QR Code", "Business Card", "vCard"] },
      accent: "blue",
      tool: "/tools/pdf-qr-ekle",
    },
    {
      title: "Kartvizit QR Kodu: Rehbere Kaydeden vCard Nasıl Yapılır?",
      description:
        "Kartvizitinize rehbere kaydedilen kişi kartı QR kodu ekleyin. vCard nedir, hangi bilgiler yazılır, Türkçe karakterler nasıl korunur ve baskıya hazırlama.",
      excerpt:
        "Kartvizitteki QR kod web sitenize değil, doğrudan telefon rehberine gitsin. vCard nedir, nasıl hazırlanır, nelere dikkat edilir.",
      blocks: [
        { t: "lead", x: "Kartvizit elden ele geçer ama numaranız çoğu zaman rehbere hiç girmez. Kartın üzerine bir kişi kartı (vCard) QR kodu koyarsanız, karşınızdaki telefonunu tutup tek dokunuşla sizi kaydedebilir." },
        { t: "h2", x: "vCard QR kodu nedir?" },
        { t: "p", x: "Web adresi içeren bir QR, okutana bir sayfa açar. Kişi kartı QR'ı ise ad, firma, unvan, telefon, e-posta, web sitesi ve adresi kodun içine yazar; okutan kişi bunları doğrudan rehberine ekleyebilir. Yani karşı tarafın bir şey yazması ya da sayfa gezmesi gerekmez." },
        { t: "h2", x: "Hangi bilgiler yazılır?" },
        { t: "ul", items: [
          "Ad ve soyad",
          "Firma ve unvan",
          "Cep telefonu",
          "E-posta",
          "Web sitesi",
          "Adres (isteğe bağlı)",
        ] },
        { t: "p", x: "Alanların hepsini doldurmanız gerekmez. Ne kadar az bilgi yazarsanız kod o kadar sade, yani küçük bir kartta o kadar kolay okunur olur." },
        { t: "h2", x: "Türkçe karakterler" },
        { t: "p", x: "ç, ğ, ı, İ, ö, ş, ü gibi harfler kişi kartı kodlanırken UTF-8 olarak yazılır, yani adınız ve adresiniz bozulmadan rehbere gelir. Kartı bastırmadan önce kendi telefonunuzla okutup adınızın doğru göründüğünü görmenizi öneririz." },
        { t: "steps", items: [
          { title: "Kartvizit PDF'ini açın", x: "Matbaaya göndereceğiniz ya da dijital paylaşacağınız kartvizit PDF'ini araca bırakın." },
          { title: "«Kişi kartı» sekmesini seçin", x: "Bilgilerinizi girin; telefon numarası ve web adresi araç tarafından düzenlenir." },
          { title: "Boş bir köşeye yerleştirin", x: "QR'ı sürükleyip tasarımı bozmayacağı bir köşeye koyun. Küçük kartta bile 15 mm'nin altına inmeyin." },
          { title: "İndirip deneyin", x: "Dosyayı indirin, ekrandan ya da çıktıdan kendi telefonunuzla okutun." },
        ] },
        { t: "cta", title: "Kartvizite QR Kod Ekle", x: "Kişi kartı QR'ını PDF'inize yerleştirin; dosyanız cihazınızdan çıkmaz.", btn: "Aracı aç", tool: "/tools/pdf-qr-ekle" },
        { t: "h2", x: "Baskıdan önce kontrol listesi" },
        { t: "ul", items: [
          "QR en az 15 mm mi?",
          "Koyu desen açık zeminde mi?",
          "Kodun etrafında boş çerçeve var mı?",
          "Telefonla okutunca ad, numara ve e-posta doğru mu?",
          "Çıktıda (matbaa denemesi) da okunuyor mu?",
        ] },
        { t: "tip", x: "Telefon numaranız ya da e-posta adresiniz değişirse basılı kartlardaki kod eskir; çünkü bilgi koda yazılıdır. Sık değişen bir bilgi için kişi kartı yerine her zaman güncel tutabileceğiniz bir web sayfası adresi kullanmak daha güvenlidir." },
      ],
      faq: [
        { q: "vCard QR'ı bütün telefonlarda çalışır mı?", a: "Çoğu güncel telefonun kamerası kişi kartı kodlarını tanır ve rehbere ekleme önerir. Eski cihazlarda ayrı bir okuyucu uygulaması gerekebilir; baskıdan önce kendi telefonunuzla deneyin." },
        { q: "Türkçe karakterler bozulur mu?", a: "Hayır. Bilgiler UTF-8 olarak kodlanır; ç, ğ, ı, İ, ö, ş, ü doğru görünür." },
        { q: "Kodun içindeki bilgi sonradan değiştirilebilir mi?", a: "Hayır. Bilgi kodun içine yazılıdır; değişirse yeni bir kod üretmeniz gerekir." },
        { q: "QR'ı kartvizit dışında kullanabilir miyim?", a: "Evet. Sunum, broşür ya da e-posta imzası gibi her PDF'te kullanabilirsiniz." },
      ],
    },
    {
      title: "Business Card QR Code: How to Make a vCard",
      description:
        "Put a contact-card QR code on your business card so people can save you to their phone. What a vCard is, what to include, accents and print checks.",
      excerpt:
        "Let the QR on your business card go straight to a phone's contacts instead of a web page. What a vCard is and how to prepare one.",
      blocks: [
        { t: "lead", x: "Business cards change hands, yet the number on them often never reaches the contacts list. Put a contact-card (vCard) QR code on the card and the other person can point their phone at it and save you in a tap." },
        { t: "h2", x: "What is a vCard QR code?" },
        { t: "p", x: "A QR with a web address opens a page. A contact-card QR stores the name, company, title, phone, email, website and address inside the code itself, and the person scanning can add them straight to their contacts. Nobody has to type or browse." },
        { t: "h2", x: "What goes in it?" },
        { t: "ul", items: [
          "First and last name",
          "Company and job title",
          "Mobile number",
          "Email",
          "Website",
          "Address (optional)",
        ] },
        { t: "p", x: "You do not have to fill every field. The less you put in, the simpler the pattern, and the easier it is to read on a small card." },
        { t: "h2", x: "Accented characters" },
        { t: "p", x: "Letters such as ç, ğ, ı, İ, ö, ş and ü are encoded as UTF-8 when the contact card is written, so your name and address arrive in the contacts list intact. Scan your own card with your phone before printing to confirm the name looks right." },
        { t: "steps", items: [
          { title: "Open your card PDF", x: "Drop the business card PDF you plan to print or share into the tool." },
          { title: "Choose the contact-card tab", x: "Enter your details; the phone number and web address are tidied up for you." },
          { title: "Place it in a free corner", x: "Drag the QR to a spot that does not spoil the design. Even on a small card, stay at 15 mm or above." },
          { title: "Download and test", x: "Download the file and scan it with your own phone from the screen or a printout." },
        ] },
        { t: "cta", title: "Add a QR Code to Your Card", x: "Place a contact-card QR on your PDF; your file never leaves your device.", btn: "Open the tool", tool: "/tools/pdf-qr-ekle" },
        { t: "h2", x: "Checklist before printing" },
        { t: "ul", items: [
          "Is the QR at least 15 mm?",
          "Is the dark pattern on a light background?",
          "Is there a blank frame around it?",
          "Do the name, number and email look right when scanned?",
          "Does a printed test copy scan too?",
        ] },
        { t: "tip", x: "If your phone number or email changes, the code on printed cards goes stale, because the details are written into it. For details that change often, a web page address you can keep up to date is safer than a contact card." },
      ],
      faq: [
        { q: "Does a vCard QR work on every phone?", a: "Most current phone cameras recognise contact-card codes and offer to add the contact. Older devices may need a reader app; test with your own phone before printing." },
        { q: "Will accents get garbled?", a: "No. The details are encoded as UTF-8, so ç, ğ, ı, İ, ö, ş and ü appear correctly." },
        { q: "Can I change the details later?", a: "No. They are written into the code; if they change you need to make a new one." },
        { q: "Can I use it outside business cards?", a: "Yes, on a presentation, a brochure or an email-signature PDF." },
      ],
    },
  ),

  post(
    {
      slug: "dava-dosyasi-ihale-icindekiler-yer-imi",
      date: "2026-11-02",
      updated: "2026-11-02",
      readMinutes: 6,
      tags: { tr: ["İçindekiler", "PDF Birleştirme", "Yer İmi"], en: ["Table of Contents", "Merge PDF", "Bookmarks"] },
      accent: "violet",
      tool: "/tools/pdf-birlestir-icindekiler",
    },
    {
      title: "Dava Dosyası ve İhale İçin Tıklanabilir İçindekiler",
      description:
        "Onlarca ek içeren PDF dosyalarını tek belgede birleştirip tıklanabilir içindekiler sayfası ve yer imleri ekleyin. Sıralama, başlık ve sayfa numarası ipuçları.",
      excerpt:
        "Çok parçalı bir dosyada okuyucunun aradığı bölüme saniyeler içinde ulaşması gerekir. Birleştirirken içindekiler ve yer imi eklemenin yolu.",
      blocks: [
        { t: "lead", x: "Dava dosyası, ihale teklifi, muhasebe klasörü ya da tez ekleri… Hepsinde aynı sorun var: onlarca belge tek dosyada toplanıyor, ama okuyan kişi aradığı ekin hangi sayfada olduğunu bulamıyor. Çözüm, birleştirirken içindekiler sayfası ve yer imleri eklemek." },
        { t: "h2", x: "Ne elde edersiniz?" },
        { t: "ul", items: [
          "Dosyaların seçtiğiniz sırayla birleştiği tek bir PDF",
          "En başta, her bölümün adını ve başlangıç sayfasını gösteren içindekiler sayfası",
          "İçindekilerdeki her satıra tıklayınca ilgili bölümün ilk sayfasına gidiş",
          "PDF okuyucunun kenar panelinde yer imleri",
          "İsteğe bağlı: her sayfada «Sayfa 3 / 42» alt bilgisi ve her bölümün başında «İçindekilere dön» bağlantısı",
        ] },
        { t: "h2", x: "Adım adım" },
        { t: "steps", items: [
          { title: "Dosyaları ekleyin", x: "En az 2, en çok 20 PDF seçin; dosya başına 50 MB sınırı var. Her dosya küçük resmi ve sayfa sayısıyla bir kart olur." },
          { title: "Sıralayın", x: "Kartları sürükleyin ya da oklarla taşıyın; «A-Z sırala» ile ada göre dizin." },
          { title: "Başlıkları düzenleyin", x: "Varsayılan başlık dosya adıdır; alt çizgi ve tireler boşluğa çevrilir. «Ek-1 Kira Sözleşmesi» gibi okuyucuya anlamlı bir ad yazın." },
          { title: "Ayarları seçin", x: "Sayfa başlığını, numaralandırmayı, alt bilgiyi ve geri dönüş bağlantısını belirleyin; dosya adını değiştirin." },
          { title: "Birleştirin ve indirin", x: "İçindekiler uzunsa otomatik olarak sonraki sayfaya devam eder; bölüm sayfa numaraları buna göre hesaplanır." },
        ] },
        { t: "cta", title: "Birleştir + İçindekiler", x: "PDF'leri birleştirin, tıklanabilir içindekiler ve yer imi ekleyin; dosyalarınız cihazınızdan çıkmaz.", btn: "Aracı aç", tool: "/tools/pdf-birlestir-icindekiler" },
        { t: "h2", x: "İyi bir içindekiler için başlık yazmak" },
        { t: "p", x: "Dosya adları çoğu zaman bilgisayar için yazılmıştır: «tarama_0047». İçindekiler ise bir insanın gözüne hitap eder. «Ek-3 Banka teminat mektubu» gibi kısa, ne olduğunu söyleyen başlıklar yazın. Çok uzun başlıklar en çok iki satıra kısaltılır; ana fikri başa koyun." },
        { t: "h2", x: "Sayfa boyutları karışıksa" },
        { t: "p", x: "A4, Letter ya da yatay sayfalar kendi boyutlarında kalır; içindekiler sayfası ise A4 dikey eklenir. Yani ekler bozulmaz, yalnızca en başa tek tip bir fihrist gelir." },
        { t: "h2", x: "Şifreli ya da bozuk dosya" },
        { t: "p", x: "Şifreli bir PDF tarayıcıda işlenemez; araç hangi dosyanın şifreli olduğunu açıkça söyler. Önce şifreyi kaldırıp yeniden ekleyin. Okunamayan bir dosya diğerlerini engellemez; kartında işaretlenir ve birleştirmeye alınmaz." },
        { t: "tip", x: "Mahkemeye ya da kuruma sunulacak dosyada kurumun biçim şartı olabilir. Böyle bir şart varsa dosyayı göndermeden önce şartnameyi ya da kurumun yönergesini kontrol edin." },
      ],
      faq: [
        { q: "En az kaç dosya gerekir?", a: "Birleştirme olduğu için en az 2 geçerli PDF gerekir." },
        { q: "İçindekiler birden fazla sayfaya taşarsa ne olur?", a: "Liste otomatik olarak sonraki sayfaya devam eder ve bölüm sayfa numaraları buna göre hesaplanır." },
        { q: "Yer imleri her PDF okuyucuda görünür mü?", a: "Yer imleri standart PDF özelliğidir; çoğu okuyucu bunları kenar panelinde gösterir." },
        { q: "Dosyalarım sunucuya gidiyor mu?", a: "Hayır. Birleştirme ve içindekiler oluşturma tarayıcınızda yapılır." },
        { q: "Sayfa numarası alt bilgisi zorunlu mu?", a: "Hayır, isteğe bağlıdır. Açarsanız tüm sayfalara «Sayfa 3 / 42» yazılır." },
      ],
    },
    {
      title: "Clickable Table of Contents for Case Files and Tenders",
      description:
        "Merge dozens of PDFs into one document with a clickable contents page and bookmarks. Ordering, titles and page-number tips for long, multi-part files.",
      excerpt:
        "In a multi-part file the reader must reach the right section in seconds. How to add a contents page and bookmarks while merging.",
      blocks: [
        { t: "lead", x: "A case file, a tender bid, an accounting folder, thesis appendices: they all share a problem. Dozens of documents end up in one file and the reader cannot tell which page holds the annex they need. The fix is to add a contents page and bookmarks while you merge." },
        { t: "h2", x: "What you get" },
        { t: "ul", items: [
          "One PDF with your files merged in the order you pick",
          "A contents page at the front listing each section and its starting page",
          "A click on any line jumps to that section's first page",
          "Bookmarks in the PDF reader's side panel",
          "Optional: a Page 3 / 42 footer on every page and a Back to contents link at the start of each section",
        ] },
        { t: "h2", x: "Step by step" },
        { t: "steps", items: [
          { title: "Add the files", x: "Choose 2 to 20 PDFs, up to 50 MB each. Every file becomes a card with a thumbnail and its page count." },
          { title: "Put them in order", x: "Drag the cards or move them with the arrows; use Sort A-Z to order by name." },
          { title: "Edit the titles", x: "The default title is the file name with underscores and dashes turned into spaces. Write something meaningful to the reader, such as Annex 1 Lease Agreement." },
          { title: "Choose the settings", x: "Set the heading, numbering, footer and back link, and change the output file name." },
          { title: "Merge and download", x: "If the contents run long they continue onto the next page automatically, and section page numbers are calculated to match." },
        ] },
        { t: "cta", title: "Merge + Table of Contents", x: "Merge PDFs and add a clickable contents page and bookmarks; your files never leave your device.", btn: "Open the tool", tool: "/tools/pdf-birlestir-icindekiler" },
        { t: "h2", x: "Writing titles that work" },
        { t: "p", x: "File names are often written for computers: scan_0047. A contents page is for a person. Use short titles that say what the item is, like Annex 3 Bank guarantee letter. Very long titles are cut to two lines at most, so put the main idea first." },
        { t: "h2", x: "When page sizes are mixed" },
        { t: "p", x: "A4, Letter and landscape pages keep their own size, while the contents page is added as portrait A4. The annexes are not altered; one uniform contents page simply appears at the front." },
        { t: "h2", x: "Protected or damaged files" },
        { t: "p", x: "A password-protected PDF cannot be handled in the browser, and the tool tells you exactly which file it is. Remove the password and add it again. A file that cannot be read does not block the others; its card is flagged and it is left out of the merge." },
        { t: "tip", x: "A court or an agency may have its own format requirements. If so, check the notice or guidance before you send the file." },
      ],
      faq: [
        { q: "What is the minimum number of files?", a: "Because it merges, you need at least 2 valid PDFs." },
        { q: "What if the contents are longer than a page?", a: "The list continues onto the next page automatically and the section page numbers are calculated accordingly." },
        { q: "Do bookmarks show in every PDF reader?", a: "Bookmarks are a standard PDF feature; most readers show them in a side panel." },
        { q: "Do my files get uploaded?", a: "No. Merging and building the contents page happen in your browser." },
        { q: "Is the page footer required?", a: "No, it is optional. If you turn it on, every page gets Page 3 / 42." },
      ],
    },
  ),
];

/** Elle yazılmış Instagram slaytları (carouselCopy.mjs'e katılır). */
export const QR_TOC_CAROUSELS = {
  "pdf-ye-qr-kod-ekleme-rehberi": {
    hook: "PDF'ye QR kod koymadan önce bilmeniz gerekenler",
    slides: [
      ["Dört adım", "PDF'i seçin, QR'ın içeriğini girin, sayfada sürükleyip yerleştirin, indirin. Dosyanız cihazınızdan çıkmaz."],
      ["Ne kadar büyük olmalı?", "Güvenilir okuma için en az 15 mm. Daha küçüğünde araç sizi uyarır."],
      ["Renk seçimi", "Koyu desen, açık zemin. Açık renkli kod koyu zeminde birçok telefonda okunmaz."],
      ["Baskıda bulanıklaşmaz", "QR, PDF'ye resim değil vektör olarak çizilir. Büyütseniz de kenarları keskin kalır."],
      ["Web adresi ise tıklanır", "Kod bir web adresiyse, PDF içinde tıklanabilir bağlantı da olur."],
    ],
  },
  "kartvizit-qr-kod-vcard-nasil-yapilir": {
    hook: "Kartvizitiniz tek dokunuşla telefon rehberine kaydedilsin",
    slides: [
      ["Kişi kartı QR'ı nedir?", "Adınız, firmanız, telefonunuz ve e-postanız kodun içinde durur. Okutan kişi tek dokunuşla rehberine ekler."],
      ["Hepsini yazmayın", "Ne kadar az bilgi yazarsanız kod o kadar sade olur ve küçük kartta o kadar kolay okunur."],
      ["Türkçe harfler", "ç, ğ, ı, İ, ö, ş, ü bozulmadan kodlanır. Yine de baskıdan önce kendi telefonunuzla deneyin."],
      ["Boyutu küçültmeyin", "Küçük kartta bile 15 mm'nin altına inmeyin. Koyu desen, açık zemin kullanın."],
      ["Bilgi değişirse", "Numara ya da e-posta değişirse basılı kod eskir. Sık değişen bilgi için güncel bir web sayfası adresi kullanın."],
    ],
  },
  "dava-dosyasi-ihale-icindekiler-yer-imi": {
    hook: "Onlarca ek tek dosyada: aranan sayfa saniyede bulunsun",
    slides: [
      ["Ne ekler?", "PDF'leri birleştirir, en başa tıklanabilir içindekiler sayfası koyar, her bölüme yer imi ekler."],
      ["Sırayı siz belirlersiniz", "Kartları sürükleyin ya da oklarla taşıyın. İsterseniz «A-Z sırala» ile ada göre dizin."],
      ["Başlıkları düzenleyin", "Dosya adı yerine «Ek-3 Banka teminat mektubu» gibi okuyucuya anlamlı bir ad yazın."],
      ["Uzun liste sorun değil", "İçindekiler bir sayfaya sığmazsa sonraki sayfaya devam eder. Bölüm sayfa numaraları buna göre hesaplanır."],
      ["Şifreli dosya varsa", "Araç hangi dosyanın şifreli olduğunu söyler. Şifreyi kaldırıp yeniden ekleyin."],
    ],
  },
};
