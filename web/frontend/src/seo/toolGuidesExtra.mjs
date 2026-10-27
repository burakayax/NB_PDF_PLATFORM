/**
 * İÇERİĞİ KISA KALAN ARAÇ SAYFALARI İÇİN REHBER METİNLERİ (toolGuides.mjs'in devamı).
 *
 * Aynı kurallar geçerli: yazılan her cümle aracın GERÇEKTEN yaptığı bir şey olmalı ve araç
 * sayfalarındaki mevcut açıklama/SSS ile çelişmemeli. Dosyanın cihazda mı sunucuda mı
 * işlendiği bilgisi content/toolProcessing.mjs (gizlilik tablosu) ile aynı olmak zorundadır:
 * merge/split/rotate/delete/organize cihazda; diğerleri sunucuda işlenir ve işlem bitince silinir.
 * `toolGuides.mjs` bu dosyayı içe aktarıp TOOL_GUIDE'a katar.
 */
export const TOOL_GUIDE_EXTRA = {
  "unlock-pdf": {
    tr: {
      steps: [
        { title: "Şifreli PDF'i yükleyin", x: "«Dosya Seç» ile açılış parolası olan PDF'inizi seçin ya da alana sürükleyip bırakın." },
        { title: "Parolayı girin", x: "Belgeyi açarken kullandığınız parolayı yazın. Parolayı bilmiyorsanız araç belgeyi açamaz." },
        { title: "Kilidi kaldırın", x: "«Şifreyi Kaldır» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem biter bitmez silinir." },
        { title: "Korumasız kopyayı indirin", x: "Parolasız yeni PDF'i kaydedin. Özgün dosyanız olduğu gibi kalır." },
      ],
      useCases: [
        { title: "Her açılışta parola yazmaktan kurtulmak", x: "Kendi arşivinizdeki bir faturayı ya da raporu parolasız kopyalayıp günlük işlerde kolayca açın." },
        { title: "Belgeyi birleştirmeye ya da düzenlemeye hazırlamak", x: "Şifreli bir PDF'in kilidini kaldırıp Birleştir, Böl veya Sayfa Sil gibi araçlarla işleyin." },
        { title: "Kurumdan gelen parolalı dosya", x: "Banka ekstresi ya da bordro gibi parolayla gelen belgeyi, parolayı bildiğiniz için açıp parolasız saklayın." },
      ],
      faq: [
        { q: "Unuttuğum parolayı bu araçla bulabilir miyim?", a: "Hayır. Araç parolayı tahmin etmez ya da kırmaz; yalnızca doğru parolayı girdiğiniz belgenin korumasını kaldırır." },
        { q: "Yüklediğim şifreli dosya sunucuda saklanır mı?", a: "Hayır. Dosya işlem için yüklenir ve işlem biter bitmez geçici klasörden silinir; hazırlanan çıktı indirebilmeniz için en fazla 24 saat tutulur." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the protected PDF", x: "Choose the PDF that has an opening password with «Choose file», or drag it onto the area." },
        { title: "Enter the password", x: "Type the password you use to open the document. Without it the tool cannot open the file." },
        { title: "Remove the lock", x: "Click the unlock button. The file is uploaded for processing and deleted as soon as it finishes." },
        { title: "Download the unprotected copy", x: "Save the new PDF that opens without a password. Your original file stays as it was." },
      ],
      useCases: [
        { title: "Stop typing the password every time", x: "Make a password-free copy of an invoice or report in your own archive so it opens easily day to day." },
        { title: "Prepare a document for merging or editing", x: "Unlock the PDF first, then process it with tools such as Merge, Split or Delete Pages." },
        { title: "Password-protected files from institutions", x: "Open a bank statement or payslip that arrives with a password — you know it — and keep a copy without one." },
      ],
      faq: [
        { q: "Can this tool find a password I forgot?", a: "No. It does not guess or crack passwords; it only removes the protection from documents when you enter the correct one." },
        { q: "Is my protected file stored on the server?", a: "No. The file is uploaded for processing and deleted from the temporary folder as soon as it finishes; the finished output is kept for at most 24 hours so you can download it." },
      ],
    },
  },

  "pdf-to-ppt": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile dönüştürmek istediğiniz sunum PDF'ini seçin." },
        { title: "Dönüştürmeyi başlatın", x: "«PowerPoint'e Dönüştür» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "İlerlemeyi izleyin", x: "Sayfa sayısı arttıkça işlem biraz uzar; ilerleme çubuğundan durumu görebilirsiniz." },
        { title: ".pptx dosyasını indirin", x: "Her PDF sayfası bir slayt olur. PowerPoint'te açıp slaytları düzenleyin." },
      ],
      useCases: [
        { title: "Elinizde yalnızca PDF kalan sunum", x: "Kaynak dosyasını kaybettiğiniz bir sunumu yeniden düzenlenebilir hâle getirin." },
        { title: "Eski sunumu güncelleme", x: "Geçen yılın rapor ya da ders sunumunu PowerPoint'e aktarıp tarihleri ve rakamları güncelleyin." },
        { title: "Slaytlardan parça almak", x: "Bir PDF'teki belirli sayfaları kendi sunumunuza taşımak için önce .pptx'e çevirin." },
      ],
      faq: [
        { q: "Dönüştürülen sunumda her şey birebir aynı mı çıkar?", a: "Karmaşık yerleşimlerde küçük kaymalar olabilir. En iyi sonuç metin katmanı olan, düz tasarımlı PDF'lerde alınır; çıktıyı PowerPoint'te gözden geçirmenizi öneririz." },
        { q: "Taranmış bir PDF'i PowerPoint'e çevirebilir miyim?", a: "Taranmış sayfalar resim olduğu için metin olarak düzenlenemez. Önce «Taranmış PDF → Metin (OCR)» aracıyla metni çıkarmanız gerekir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the presentation PDF you want to convert with «Choose file»." },
        { title: "Start the conversion", x: "Click the convert button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Follow the progress", x: "More pages take a little longer; the progress bar shows where it is." },
        { title: "Download the .pptx", x: "Each PDF page becomes one slide. Open it in PowerPoint and edit the slides." },
      ],
      useCases: [
        { title: "A deck you only have as a PDF", x: "Make a presentation editable again when you have lost the source file." },
        { title: "Updating an old deck", x: "Bring last year's report or lecture slides into PowerPoint and refresh the dates and figures." },
        { title: "Reusing slides", x: "Convert to .pptx first when you want to move certain PDF pages into your own presentation." },
      ],
      faq: [
        { q: "Will the converted deck look exactly the same?", a: "Complex layouts can shift slightly. Plain PDFs with a text layer convert best; we recommend reviewing the result in PowerPoint." },
        { q: "Can I convert a scanned PDF to PowerPoint?", a: "Scanned pages are pictures, so their text can't be edited. Extract the text first with the Scanned PDF to Text (OCR) tool." },
      ],
    },
  },

  encrypt: {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile korumak istediğiniz PDF'i seçin." },
        { title: "Parola belirleyin", x: "Belgeyi açmak için gerekecek parolayı yazın. Uzun, tahmin edilmesi zor bir parola seçin." },
        { title: "Şifreleyin", x: "«Şifrele» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Şifreli dosyayı indirin", x: "Yeni PDF yalnızca parolayla açılır. Parolayı belgeden ayrı bir kanaldan paylaşın." },
      ],
      useCases: [
        { title: "Sözleşme ve teklif göndermek", x: "E-postayla giden sözleşmeyi parolalayın; parolayı telefonla ya da mesajla ayrıca iletin." },
        { title: "Kimlik ve sağlık belgeleri", x: "Kimlik fotokopisi, rapor ya da tahlil sonucu gibi kişisel belgeleri paylaşmadan önce koruyun." },
        { title: "Bordro ve finansal tablolar", x: "Muhasebeye ya da bankaya giden tabloları yetkisiz kişilerin açmasını engelleyin." },
      ],
      faq: [
        { q: "Parolayı unutursam belgeyi kurtarabilir misiniz?", a: "Hayır. Parolayı biz saklamayız ve kurtaramayız; parolayı güvenli bir yerde tutun. Özgün şifresiz dosyanızı da silmeyin." },
        { q: "Şifrelenen PDF her programda açılır mı?", a: "Standart PDF şifrelemesi kullanıldığı için güncel tarayıcılar ve PDF okuyucular parola sorarak açar. Çok eski programlar AES-256'yı desteklemeyebilir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF you want to protect with «Choose file»." },
        { title: "Set a password", x: "Type the password people will need to open the document. Pick a long one that is hard to guess." },
        { title: "Encrypt", x: "Click the encrypt button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Download the protected file", x: "The new PDF opens only with the password. Share the password through a separate channel." },
      ],
      useCases: [
        { title: "Sending contracts and offers", x: "Password-protect a contract before emailing it and pass the password on by phone or message." },
        { title: "ID and health documents", x: "Protect personal papers such as ID copies, reports or lab results before you share them." },
        { title: "Payroll and financial statements", x: "Stop unauthorised people from opening tables you send to an accountant or a bank." },
      ],
      faq: [
        { q: "Can you recover the document if I forget the password?", a: "No. We do not store the password and cannot recover it, so keep it somewhere safe — and keep your original unprotected file too." },
        { q: "Will an encrypted PDF open everywhere?", a: "Current browsers and PDF readers ask for the password and open it. Very old programs may not support AES-256." },
      ],
    },
  },

  "html-to-pdf": {
    tr: {
      steps: [
        { title: "Kaynağı seçin", x: "Bir web adresi (URL) girin ya da HTML kodunuzu yapıştırın." },
        { title: "Dönüştürün", x: "«PDF'e Çevir» düğmesine basın. Sayfa sunucuda gerçek bir tarayıcı motoruyla çizilir; yazı tipleri ve görseller yüklenir." },
        { title: "Sonucu kontrol edin", x: "Çıktı sayfa sayfa PDF olarak hazırlanır; metin seçilebilir kalır." },
        { title: "PDF'i indirin", x: "Dosyayı kaydedin; arşivleyin, e-postayla gönderin veya yazdırın." },
      ],
      useCases: [
        { title: "Web sayfasını arşivlemek", x: "Bir makaleyi, siparişi ya da bilgi sayfasını sonradan değişmeyecek biçimde PDF olarak saklayın." },
        { title: "Kendi HTML şablonunuzdan belge üretmek", x: "Hazırladığınız fatura ya da rapor şablonunu yapıştırıp yazdırılabilir PDF'e çevirin." },
        { title: "Paylaşılabilir kopya", x: "İnternet bağlantısı olmayan birine sayfanın görünümünü tek dosya olarak gönderin." },
      ],
      faq: [
        { q: "Giriş yapmam gereken sayfaları çevirebilir miyim?", a: "Araç sayfayı oturumunuz olmadan açar; giriş gerektiren sayfaların yalnızca herkese açık hâli çıkar. Bu tür sayfalar için HTML kodunu yapıştırmayı deneyin." },
        { q: "Çıktı ekranda gördüğümden farklı olabilir mi?", a: "Sayfa yazdırma görünümüyle çizilir; menü ve reklam gibi öğeler sitenin yazdırma ayarına göre değişebilir." },
      ],
    },
    en: {
      steps: [
        { title: "Choose the source", x: "Enter a web address (URL) or paste your HTML code." },
        { title: "Convert", x: "Click the convert button. The page is rendered on the server with a real browser engine, loading fonts and images." },
        { title: "Check the result", x: "The output is built page by page as a PDF; the text stays selectable." },
        { title: "Download the PDF", x: "Save the file to archive it, email it or print it." },
      ],
      useCases: [
        { title: "Archiving a web page", x: "Keep an article, an order or an info page as a PDF that will not change later." },
        { title: "Producing documents from your own HTML template", x: "Paste an invoice or report template and turn it into a printable PDF." },
        { title: "A shareable copy", x: "Send someone who is offline how a page looked as a single file." },
      ],
      faq: [
        { q: "Can I convert pages that need a login?", a: "The page is opened without your session, so only the public version of such pages is captured. For those, try pasting the HTML code instead." },
        { q: "Can the output differ from what I see on screen?", a: "The page is rendered in its print view, so elements such as menus and ads may change depending on the site's print settings." },
      ],
    },
  },

  "ppt-to-pdf": {
    tr: {
      steps: [
        { title: "Sunumu yükleyin", x: "«Dosya Seç» ile .ppt veya .pptx dosyanızı seçin." },
        { title: "Dönüştürün", x: "«PDF'e Dönüştür» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Bekleyin", x: "Slayt ve görsel sayısı arttıkça işlem biraz uzar." },
        { title: "PDF'i indirin", x: "Her slayt PDF'te bir sayfa olur. Dosya her cihazda aynı görünür." },
      ],
      useCases: [
        { title: "Sunumu e-postayla göndermek", x: "Karşı tarafta PowerPoint olmasa da açılan, düzeni bozulmayan tek bir dosya gönderin." },
        { title: "Ders notu ve el ilanı", x: "Slaytları PDF'e çevirip öğrencilerle paylaşın ya da yazdırın." },
        { title: "Teklif ve rapor ekleri", x: "Sunumunuzu başka PDF'lerle birleştirerek tek bir dosyada teslim edin." },
      ],
      faq: [
        { q: "Sunumdaki geçişler ve videolar PDF'e taşınır mı?", a: "Hayır. PDF sabit bir belgedir; geçişler ve videolar çalışmaz, slaytın görünümü sayfa olarak kalır." },
        { q: "Özel yazı tipleri doğru çıkar mı?", a: "Sunucuda bulunmayan yazı tipleri benzer bir yazı tipiyle değiştirilebilir. Önemli bir sunumda çıktıyı kontrol etmenizi öneririz." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the presentation", x: "Choose your .ppt or .pptx file with «Choose file»." },
        { title: "Convert", x: "Click the convert button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Wait", x: "More slides and images take a little longer." },
        { title: "Download the PDF", x: "Each slide becomes one PDF page, and the file looks the same on every device." },
      ],
      useCases: [
        { title: "Emailing a presentation", x: "Send one file that opens without PowerPoint and keeps its layout." },
        { title: "Lecture notes and handouts", x: "Turn slides into a PDF to share with students or print." },
        { title: "Attachments to offers and reports", x: "Merge the deck with other PDFs and deliver everything as one file." },
      ],
      faq: [
        { q: "Are transitions and videos carried into the PDF?", a: "No. A PDF is a fixed document, so transitions and videos do not play; each slide stays as a page." },
        { q: "Do custom fonts come out right?", a: "Fonts that are not available on the server may be replaced with a similar one. Check the output for an important deck." },
      ],
    },
  },

  "excel-to-pdf": {
    tr: {
      steps: [
        { title: "Tabloyu yükleyin", x: "«Dosya Seç» ile .xls veya .xlsx dosyanızı seçin." },
        { title: "Dönüştürün", x: "«PDF'e Dönüştür» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Sayfa düzenini kontrol edin", x: "Geniş tablolar sayfa ayarına göre birden çok sayfaya bölünebilir." },
        { title: "PDF'i indirin", x: "Hücre biçimleri ve düzen korunmuş PDF'i kaydedin." },
      ],
      useCases: [
        { title: "Raporu değiştirilemez göndermek", x: "Fiyat listesi ya da aylık raporu formülleri göstermeden, görünümü sabit bir PDF olarak paylaşın." },
        { title: "Yazdırmaya hazırlık", x: "Tabloyu önce PDF'e çevirip yazıcı ayarlarıyla uğraşmadan çıktı alın." },
        { title: "Arşivleme", x: "Dönem sonu tablolarını her bilgisayarda aynı açılan bir biçimde saklayın." },
      ],
      faq: [
        { q: "Tablo sayfaya sığmazsa ne olur?", a: "Çalışma sayfasının kendi yazdırma ayarı esas alınır. Sığmayan sütunlar sonraki sayfalara taşar; Excel'de «Sayfaya sığdır» ayarını yapıp tekrar yükleyebilirsiniz." },
        { q: "Formüller PDF'te görünür mü?", a: "Hayır. PDF'te yalnızca hücrelerin hesaplanmış değerleri görünür; formüller dosyada kalmaz." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the spreadsheet", x: "Choose your .xls or .xlsx file with «Choose file»." },
        { title: "Convert", x: "Click the convert button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Check the page layout", x: "Wide tables can be split over several pages according to the sheet's page setup." },
        { title: "Download the PDF", x: "Save the PDF with cell formats and layout preserved." },
      ],
      useCases: [
        { title: "Sending a report nobody can change", x: "Share a price list or monthly report as a fixed PDF without exposing formulas." },
        { title: "Getting ready to print", x: "Convert to PDF first and print without fighting printer settings." },
        { title: "Archiving", x: "Keep period-end tables in a format that opens the same on every computer." },
      ],
      faq: [
        { q: "What if the table doesn't fit the page?", a: "The sheet's own print setup is used, so columns that don't fit continue on the next pages. Set «Fit to page» in Excel and upload again if needed." },
        { q: "Are formulas visible in the PDF?", a: "No. The PDF only shows the calculated values of the cells; formulas are not kept in the file." },
      ],
    },
  },

  "pdf-to-excel": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Tablo içeren PDF'i «Dosya Seç» ile seçin." },
        { title: "Dönüştürün", x: "«Excel'e Dönüştür» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Sonucu inceleyin", x: "Tespit edilen tablolar hücrelere aktarılır; rakamları ve sütunları kontrol edin." },
        { title: ".xlsx dosyasını indirin", x: "Dosyayı Excel'de açıp sıralayın, filtreleyin veya formül ekleyin." },
      ],
      useCases: [
        { title: "Banka ekstresini analiz etmek", x: "PDF ekstredeki hareketleri Excel'e alıp kategorilere göre toplayın." },
        { title: "Fatura ve fiyat listeleri", x: "Tedarikçiden PDF gelen fiyat listesini düzenlenebilir tabloya çevirin." },
        { title: "Raporlardaki rakamları yeniden kullanmak", x: "Elle yeniden yazmak yerine tabloyu aktarıp kendi hesaplamanıza katın." },
      ],
      faq: [
        { q: "Taranmış bir PDF'teki tabloyu aktarabilir miyim?", a: "Taranmış sayfalar resimdir ve tablo olarak okunamaz. Metin katmanı olan (dijital) PDF'lerde sonuç çok daha iyidir." },
        { q: "Sütunlar kayarsa ne yapmalıyım?", a: "Tablo çizgisiz ya da karmaşık biçimliyse hücreler kayabilir. Aktardıktan sonra Excel'de sütunları düzeltmeniz gerekebilir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF that contains tables with «Choose file»." },
        { title: "Convert", x: "Click the convert button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Review the result", x: "Detected tables are placed into cells; check the figures and columns." },
        { title: "Download the .xlsx", x: "Open it in Excel to sort, filter or add formulas." },
      ],
      useCases: [
        { title: "Analysing a bank statement", x: "Bring the transactions of a PDF statement into Excel and total them by category." },
        { title: "Invoices and price lists", x: "Turn a supplier's PDF price list into an editable table." },
        { title: "Reusing figures from reports", x: "Transfer the table instead of retyping it and include it in your own calculations." },
      ],
      faq: [
        { q: "Can I extract a table from a scanned PDF?", a: "Scanned pages are images and can't be read as tables. Digital PDFs with a text layer give far better results." },
        { q: "What if columns end up misaligned?", a: "Tables without ruling lines or with complex formatting can shift cells. You may need to adjust the columns in Excel afterwards." },
      ],
    },
  },

  "pdf-to-text": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Metnini almak istediğiniz PDF'i «Dosya Seç» ile seçin." },
        { title: "Metni çıkarın", x: "«Metne Dönüştür» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "İçeriği kontrol edin", x: "Metin sayfa sırasıyla düz yazı olarak hazırlanır." },
        { title: ".txt dosyasını indirin", x: "Dosyayı herhangi bir metin düzenleyicide açın, kopyalayın veya aratın." },
      ],
      useCases: [
        { title: "Alıntı ve kopyalama", x: "Kopyalamaya izin vermeyen görünümlü uzun bir belgeden metni tek seferde alın." },
        { title: "Metni başka araca vermek", x: "Çıkan düz yazıyı çeviri, özet ya da analiz için başka bir programa yapıştırın." },
        { title: "Belgede toplu arama", x: "Yüzlerce sayfalık bir PDF'in metnini .txt yapıp bir metin düzenleyicide hızlıca arayın." },
      ],
      faq: [
        { q: "Çıkan metinde sayfa düzeni korunur mu?", a: "Hayır. Çıktı düz metindir; tablolar, sütunlar ve görseller düzenleriyle gelmez, yalnızca yazı alınır." },
        { q: "Taranmış PDF'te metin çıkmıyorsa ne yapmalıyım?", a: "Sayfa resimden oluşuyorsa «Taranmış PDF → Metin (OCR)» aracını kullanın; yazıyı cihazınızda tanır." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF whose text you want with «Choose file»." },
        { title: "Extract the text", x: "Click the extract button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Check the content", x: "The text is prepared as plain writing in page order." },
        { title: "Download the .txt", x: "Open it in any text editor to copy or search." },
      ],
      useCases: [
        { title: "Quoting and copying", x: "Take the text of a long document in one go instead of selecting it page by page." },
        { title: "Feeding text to another tool", x: "Paste the plain text into a translator, summariser or analysis program." },
        { title: "Searching a large document", x: "Turn a PDF of hundreds of pages into .txt and search it quickly in a text editor." },
      ],
      faq: [
        { q: "Is the page layout kept in the extracted text?", a: "No. The output is plain text; tables, columns and images do not keep their layout — only the writing is taken." },
        { q: "What if a scanned PDF gives no text?", a: "If the pages are images, use the Scanned PDF to Text (OCR) tool, which recognises the writing on your device." },
      ],
    },
  },

  "flatten-pdf": {
    tr: {
      steps: [
        { title: "Doldurulmuş PDF'i yükleyin", x: "Form alanları ya da açıklamaları olan PDF'i «Dosya Seç» ile seçin." },
        { title: "Düzleştirin", x: "«Düzleştir» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Görünümü kontrol edin", x: "Yazdığınız değerler artık sayfanın bir parçasıdır; alanlar tek tek düzenlenemez." },
        { title: "PDF'i indirin", x: "Sabitlenmiş kopyayı kaydedin. Özgün, düzenlenebilir dosyayı da saklamanızı öneririz." },
      ],
      useCases: [
        { title: "Doldurulmuş formu teslim etmek", x: "Başvuru formunu doldurduktan sonra değerlerin sonradan değiştirilememesi için sabitleyin." },
        { title: "Her programda aynı görünüm", x: "Bazı okuyucularda boş görünen form alanlarını sayfaya gömerek herkes için görünür yapın." },
        { title: "İmzalı belgeyi sabitlemek", x: "Eklediğiniz imza ve notların kaymasını ya da silinmesini önleyin." },
      ],
      faq: [
        { q: "Düzleştirme dosya boyutunu etkiler mi?", a: "Genellikle çok az etkiler; form alanları sayfaya gömüldüğü için dosya biraz küçülebilir ya da aynı kalabilir." },
        { q: "Düzleştirdikten sonra formu yeniden doldurabilir miyim?", a: "Hayır. İşlem kalıcıdır. Yeniden doldurmak istiyorsanız özgün dosyayı kullanın." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the filled PDF", x: "Choose the PDF with form fields or annotations using «Choose file»." },
        { title: "Flatten", x: "Click the flatten button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Check the look", x: "The values you typed are now part of the page; the fields can no longer be edited one by one." },
        { title: "Download the PDF", x: "Save the locked-in copy. We recommend keeping the original editable file too." },
      ],
      useCases: [
        { title: "Submitting a completed form", x: "Lock the values after filling in an application so they cannot be changed later." },
        { title: "The same look in every reader", x: "Embed form fields that appear blank in some readers so everyone sees them." },
        { title: "Fixing a signed document", x: "Stop the signature and notes you added from shifting or being removed." },
      ],
      faq: [
        { q: "Does flattening change the file size?", a: "Usually very little; because the fields are embedded in the page, the file may get slightly smaller or stay the same." },
        { q: "Can I fill the form again after flattening?", a: "No. The change is permanent. Use your original file if you need to fill it in again." },
      ],
    },
  },

  "repair-pdf": {
    tr: {
      steps: [
        { title: "Bozuk PDF'i yükleyin", x: "Açılmayan ya da hata veren dosyayı «Dosya Seç» ile seçin." },
        { title: "Onarmayı deneyin", x: "«Onar» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Sonucu açın", x: "Araç dosya yapısını yeniden kurar ve kurtarabildiği sayfaları yeni bir PDF'e yazar." },
        { title: "Kurtarılan dosyayı indirin", x: "Yeni PDF'i açıp eksik sayfa olup olmadığını kontrol edin." },
      ],
      useCases: [
        { title: "Yarım inen dosya", x: "İndirme yarıda kesilmiş bir PDF'ten erişilebilen sayfaları kurtarın." },
        { title: "Hata veren okuyucu", x: "«Dosya bozuk» uyarısı veren bir belgeyi yeniden geçerli bir yapıya kavuşturun." },
        { title: "Arşivdeki eski dosyalar", x: "Yıllar önce kaydedilmiş, artık açılmayan belgeleri kurtarmayı deneyin." },
      ],
      faq: [
        { q: "Onarma başarısız olursa ne yapmalıyım?", a: "Hasar çok büyükse içerik kurtarılamayabilir. Dosyanın başka bir kaynaktan (e-posta, bulut yedeği) yeni bir kopyasını almayı deneyin." },
        { q: "Onarılan dosyada eksik sayfa olabilir mi?", a: "Evet. Yalnızca erişilebilen içerik kurtarılır; bu yüzden sonucu açıp sayfa sayısını özgün belgeyle karşılaştırın." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the damaged PDF", x: "Choose the file that won't open or shows an error with «Choose file»." },
        { title: "Try to repair it", x: "Click the repair button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Open the result", x: "The tool rebuilds the file structure and writes the pages it could recover into a new PDF." },
        { title: "Download the recovered file", x: "Open the new PDF and check whether any pages are missing." },
      ],
      useCases: [
        { title: "A half-downloaded file", x: "Recover the readable pages from a PDF whose download was cut off." },
        { title: "A reader that shows an error", x: "Give a document that says «file is damaged» a valid structure again." },
        { title: "Old files in your archive", x: "Try to rescue documents saved years ago that no longer open." },
      ],
      faq: [
        { q: "What if the repair fails?", a: "If the damage is severe, the content may not be recoverable. Try to get a fresh copy of the file from another source such as email or a cloud backup." },
        { q: "Can the repaired file have missing pages?", a: "Yes. Only accessible content is recovered, so open the result and compare the page count with the original." },
      ],
    },
  },

  "delete-pages": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile PDF'inizi seçin. Sayfalar küçük resimler olarak ekrana gelir." },
        { title: "Silinecek sayfaları işaretleyin", x: "Kaldırmak istediğiniz sayfalara tıklayın. Birden çok sayfa seçebilirsiniz." },
        { title: "Uygulayın", x: "Silme düğmesine basın. İşlem dosyanız cihazınızdan çıkmadan tarayıcıda yapılır." },
        { title: "Yeni PDF'i indirin", x: "Seçtiğiniz sayfalar çıkarılmış hâliyle kaydedin; özgün dosyanız değişmez." },
      ],
      useCases: [
        { title: "Boş ve kapak sayfalarını atmak", x: "Tarama sırasında oluşan boş sayfaları ve gereksiz kapakları temizleyin." },
        { title: "Kişisel bilgi içeren sayfayı çıkarmak", x: "Paylaşmadan önce kimlik ya da adres içeren sayfayı belgeden kaldırın." },
        { title: "Yükleme sınırına uymak", x: "Portalın izin verdiği sayfa sayısına inmek için gereksiz ekleri silin." },
      ],
      faq: [
        { q: "Çok büyük dosyada da cihazda çalışır mı?", a: "80 MB'a kadar ve parolası olmayan dosyalar cihazınızda işlenir; bunun üstündeki ya da parolalı dosyalarda sunucu kullanılır." },
        { q: "Yanlışlıkla sildiğim sayfayı nasıl geri alırım?", a: "Özgün dosyanız değişmediği için aynı dosyayı yeniden yükleyip doğru sayfaları seçmeniz yeterlidir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose your PDF with «Choose file». The pages appear as thumbnails." },
        { title: "Mark the pages to delete", x: "Click the pages you want to remove. You can select several." },
        { title: "Apply", x: "Click the delete button. It runs in your browser and the file never leaves your device." },
        { title: "Download the new PDF", x: "Save it without the selected pages; your original file is unchanged." },
      ],
      useCases: [
        { title: "Dropping blank and cover pages", x: "Clean out blank pages created during scanning and covers you don't need." },
        { title: "Removing a page with personal details", x: "Take out a page with ID or address details before you share the document." },
        { title: "Meeting an upload limit", x: "Delete unnecessary attachments to get under the number of pages a portal allows." },
      ],
      faq: [
        { q: "Does it work on very large files on my device?", a: "Files up to 80 MB without a password are processed on your device; larger or password-protected files use the server." },
        { q: "How do I get back a page I deleted by mistake?", a: "Your original file is unchanged, so upload it again and select the right pages." },
      ],
    },
  },

  "grayscale-pdf": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Renkli PDF'inizi «Dosya Seç» ile seçin." },
        { title: "Gri tonlamayı uygulayın", x: "Gri tonlama düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Sonucu kontrol edin", x: "Renkler gri tonlara dönüşür; yazı ve çizimler seçilebilir kalır." },
        { title: "PDF'i indirin", x: "Siyah-beyaz kopyayı kaydedin." },
      ],
      useCases: [
        { title: "Yazıcıda mürekkep tasarrufu", x: "Renkli bir raporu siyah-beyaz basmadan önce gri tonlamaya çevirin." },
        { title: "Resmî başvurular", x: "Siyah-beyaz istenen portallara yükleyeceğiniz belgeyi hazırlayın." },
        { title: "Fotokopi ve faks benzeri çıktılar", x: "Renk bilgisi gereksiz olan belgeyi daha sade bir görünüme getirin." },
      ],
      faq: [
        { q: "Gri tonlama görsellerin kalitesini düşürür mü?", a: "Yalnızca renkler griye çevrilir; çözünürlük korunur. Renkle ayırt edilen grafikler gri tonlarda zor okunabilir, sonucu kontrol edin." },
        { q: "Bu işlem yalnızca belirli sayfalara uygulanabilir mi?", a: "Hayır, işlem belgenin tüm sayfalarına uygulanır." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose your colour PDF with «Choose file»." },
        { title: "Apply grayscale", x: "Click the grayscale button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Check the result", x: "Colours turn into shades of gray; text and drawings stay selectable." },
        { title: "Download the PDF", x: "Save the black-and-white copy." },
      ],
      useCases: [
        { title: "Saving printer ink", x: "Convert a colour report to grayscale before printing it in black and white." },
        { title: "Official applications", x: "Prepare a document for portals that ask for black and white." },
        { title: "Photocopy-style output", x: "Give a document a plainer look when colour information is unnecessary." },
      ],
      faq: [
        { q: "Does grayscale reduce image quality?", a: "Only the colours change to gray; resolution is kept. Charts that rely on colour can be hard to read in grays, so check the result." },
        { q: "Can I apply it to specific pages only?", a: "No, it is applied to all pages of the document." },
      ],
    },
  },

  "rotate-pdf": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile yan ya da ters duran sayfaları olan PDF'i seçin." },
        { title: "Sayfaları çevirin", x: "Her sayfanın altındaki sola/sağa düğmeleriyle tek tek ya da hepsini birden döndürün." },
        { title: "Kaydedin", x: "İşlem dosyanız cihazınızdan çıkmadan tarayıcıda yapılır." },
        { title: "Düzeltilmiş PDF'i indirin", x: "Sayfa yönü indirilen dosyada kalıcı olarak güncellenir." },
      ],
      useCases: [
        { title: "Yan taranmış sayfalar", x: "Tarayıcıda yan yatmış sayfaları doğru yöne çevirin." },
        { title: "Karışık yönlü belge", x: "Dikey ve yatay sayfaları bir arada olan raporu tek tek düzeltin." },
        { title: "Telefon fotoğrafından PDF", x: "Ters çekilmiş sayfaları döndürüp okunur hâle getirin." },
      ],
      faq: [
        { q: "Döndürme sayfanın içeriğini bozar mı?", a: "Hayır. Sayfanın yönü değişir, içerik aynı kalır; metin ve görseller kalite kaybetmez." },
        { q: "90° dışında bir açıyla döndürebilir miyim?", a: "Bu araç sayfaları 90° katlarıyla çevirir. Hafif eğik taramalar için «PDF Eğri Tarama Düzeltme» aracını kullanın." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF that has sideways or upside-down pages with «Choose file»." },
        { title: "Turn the pages", x: "Use the left/right buttons under each page to rotate one by one, or rotate all at once." },
        { title: "Save", x: "It runs in your browser and the file never leaves your device." },
        { title: "Download the corrected PDF", x: "The page orientation is updated permanently in the downloaded file." },
      ],
      useCases: [
        { title: "Pages scanned sideways", x: "Turn pages that came out sideways from the scanner the right way up." },
        { title: "Mixed-orientation documents", x: "Fix portrait and landscape pages individually in the same report." },
        { title: "PDF from phone photos", x: "Rotate pages photographed upside down so they read normally." },
      ],
      faq: [
        { q: "Does rotating damage the page content?", a: "No. Only the orientation changes; text and images lose no quality." },
        { q: "Can I rotate by an angle other than 90°?", a: "This tool turns pages in multiples of 90°. For slightly crooked scans use the Deskew PDF tool." },
      ],
    },
  },

  "deskew-pdf": {
    tr: {
      steps: [
        { title: "Taranmış PDF'i yükleyin", x: "Eğri çıkmış taramayı «Dosya Seç» ile seçin." },
        { title: "Düzeltmeyi başlatın", x: "Düzelt düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Eğim otomatik bulunur", x: "Araç yazı satırlarının eğimini ölçer ve sayfayı o kadar döndürür." },
        { title: "Düzelmiş PDF'i indirin", x: "Sonucu açıp satırların yataya oturduğunu kontrol edin." },
      ],
      useCases: [
        { title: "Telefonla çekilmiş belge", x: "Elde tutarken hafif eğik çekilen sayfaları düzeltin." },
        { title: "Toplu tarama", x: "Tarayıcının besleyicisinden eğri geçen sayfaları tek tek uğraşmadan düzeltin." },
        { title: "OCR öncesi hazırlık", x: "Eğri sayfalar metin tanımayı zorlaştırır; önce düzeltip sonra OCR uygulayın." },
      ],
      faq: [
        { q: "Dijital (yazı katmanı olan) PDF'lere de uygulanır mı?", a: "Hayır. Yazı katmanı olan sayfalara dokunulmaz; yalnızca tamamen resimden oluşan taranmış sayfalar düzeltilir." },
        { q: "Ters ya da yan duran sayfayı düzeltir mi?", a: "Hayır, yalnızca küçük eğimleri düzeltir. Yan ya da ters sayfalar için «PDF Döndür» aracını kullanın." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the scanned PDF", x: "Choose the crooked scan with «Choose file»." },
        { title: "Start the correction", x: "Click the straighten button. The file is uploaded for processing and deleted when it finishes." },
        { title: "The tilt is found automatically", x: "The tool measures the slant of the text lines and rotates the page by that amount." },
        { title: "Download the straightened PDF", x: "Open the result and check that the lines sit level." },
      ],
      useCases: [
        { title: "Documents shot with a phone", x: "Fix pages that came out slightly tilted when held in the hand." },
        { title: "Bulk scanning", x: "Straighten pages that passed through the feeder crooked without handling each one." },
        { title: "Preparing for OCR", x: "Tilted pages make text recognition harder, so straighten first and run OCR after." },
      ],
      faq: [
        { q: "Does it apply to digital PDFs with a text layer?", a: "No. Pages with a text layer are left untouched; only fully image-based scanned pages are corrected." },
        { q: "Will it fix a sideways or upside-down page?", a: "No, it only corrects small tilts. Use the Rotate PDF tool for sideways or upside-down pages." },
      ],
    },
  },

  "organize-pdf": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile PDF'inizi seçin. Sayfalar küçük resimler olarak dizilir." },
        { title: "Sayfaları yeniden sıralayın", x: "Yukarı/aşağı düğmeleriyle taşıyın ya da bir sayfanın konum numarasını yazarak istediğiniz yere gönderin." },
        { title: "Gereksizleri çıkarın", x: "İstemediğiniz sayfaları işaretleyip düzenden çıkarabilirsiniz." },
        { title: "Yeni PDF'i indirin", x: "İşlem cihazınızdan çıkmadan tarayıcıda yapılır; sonuç yeni sıralamayla kaydedilir." },
      ],
      useCases: [
        { title: "Karışık taranmış belge", x: "Yanlış sırada taranan sayfaları doğru sıraya dizin." },
        { title: "Raporun bölümlerini yeniden düzenlemek", x: "Ek ya da özet sayfasını başa almak için sayfaları taşıyın." },
        { title: "Çift taraflı tarama sonrası", x: "Ön ve arka yüzleri ayrı taradıysanız sayfaları doğru çiftlere göre yerleştirin." },
      ],
      faq: [
        { q: "Sayfa sayısı çok olan dosyada kolay mı?", a: "Konum numarası girerek uzun belgelerde bir sayfayı doğrudan istediğiniz yere gönderebilirsiniz." },
        { q: "İki dosyanın sayfalarını iç içe dizebilir miyim?", a: "Bunun için «Serpiştir» aracını kullanın; ön ve arka yüz dosyalarını sırayla birleştirir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose your PDF with «Choose file». The pages are laid out as thumbnails." },
        { title: "Reorder the pages", x: "Move them with the up/down buttons, or type a page's position number to send it exactly where you want." },
        { title: "Remove what you don't need", x: "Mark unwanted pages and take them out of the layout." },
        { title: "Download the new PDF", x: "It runs in your browser and the file never leaves your device; the result is saved in the new order." },
      ],
      useCases: [
        { title: "A jumbled scan", x: "Put pages that were scanned in the wrong order back in sequence." },
        { title: "Rearranging report sections", x: "Move pages to bring an appendix or summary to the front." },
        { title: "After double-sided scanning", x: "If fronts and backs were scanned separately, place the pages in the right pairs." },
      ],
      faq: [
        { q: "Is it easy on a file with many pages?", a: "In long documents you can type a position number to send a page straight where you want it." },
        { q: "Can I interleave the pages of two files?", a: "Use the Interleave tool for that; it merges front-side and back-side files in alternating order." },
      ],
    },
  },

  "extract-images": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Görsellerini almak istediğiniz PDF'i «Dosya Seç» ile seçin." },
        { title: "Ayıklamayı başlatın", x: "«Görselleri Çıkar» düğmesine basın. Dosya işlem için sunucuya yüklenir ve işlem bitince silinir." },
        { title: "Görseller toplanır", x: "PDF'e gömülü fotoğraf ve logolar özgün biçimleriyle ayrı dosyalara çıkarılır." },
        { title: "ZIP'i indirin", x: "Tüm görselleri tek bir ZIP arşivinde kaydedin." },
      ],
      useCases: [
        { title: "Katalogdan ürün fotoğrafı almak", x: "PDF kataloğa gömülü ürün görsellerini ayrı ayrı alın." },
        { title: "Logoyu geri kazanmak", x: "Elinizde yalnızca PDF kalan bir belgedeki logoyu özgün kalitesinde çıkarın." },
        { title: "Sunum ve rapor görselleri", x: "Bir raporun grafik ve fotoğraflarını başka bir belgede kullanmak için ayırın." },
      ],
      faq: [
        { q: "Sayfaları görsele çevirmekle farkı nedir?", a: "Bu araç sayfanın ekran görüntüsünü almaz, belgeye gömülü asıl görselleri çıkarır. Sayfaların tamamını resim yapmak için «PDF → Görsel» aracını kullanın." },
        { q: "Vektör grafikler de çıkar mı?", a: "Hayır. Yalnızca gömülü resim dosyaları (fotoğraf, logo gibi) ayıklanır; çizgi ve şekil olarak çizilmiş vektör grafikler resim olarak çıkmaz." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF whose images you want with «Choose file»." },
        { title: "Start the extraction", x: "Click the extract button. The file is uploaded for processing and deleted when it finishes." },
        { title: "Images are collected", x: "Photos and logos embedded in the PDF are pulled out as separate files in their original format." },
        { title: "Download the ZIP", x: "Save all the images in a single ZIP archive." },
      ],
      useCases: [
        { title: "Taking product photos from a catalogue", x: "Get the product images embedded in a PDF catalogue one by one." },
        { title: "Recovering a logo", x: "Extract the logo at its original quality from a document you only have as a PDF." },
        { title: "Slide and report visuals", x: "Separate the charts and photos of a report to use in another document." },
      ],
      faq: [
        { q: "How is this different from converting pages to images?", a: "This tool does not take a screenshot of the page; it extracts the original images embedded in the document. To turn whole pages into pictures, use the PDF to Image tool." },
        { q: "Are vector graphics extracted too?", a: "No. Only embedded image files such as photos and logos are extracted; graphics drawn as lines and shapes do not come out as pictures." },
      ],
    },
  },

  watermark: {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Filigran eklemek istediğiniz PDF'i «Dosya Seç» ile seçin." },
        { title: "Filigranı hazırlayın", x: "Metni yazın; rengi, yazı tipini, açıyı, boyutu ve şeffaflığı ayarlayın. Türkçe karakterler doğru çıkar." },
        { title: "Sayfaları seçin", x: "Filigranın tüm sayfalara mı yoksa yalnızca seçtiklerinize mi uygulanacağını belirleyin." },
        { title: "Uygulayın ve indirin", x: "Dosya işlem için sunucuya yüklenir ve işlem bitince silinir; filigranlı PDF'i kaydedin." },
      ],
      useCases: [
        { title: "Taslak belgeleri işaretlemek", x: "Henüz onaylanmamış sözleşme ya da raporu «TASLAK» filigranıyla paylaşın." },
        { title: "Gizlilik uyarısı", x: "İç kullanıma özel belgelere «GİZLİ» ibaresi ekleyin." },
        { title: "Telif ve sahiplik", x: "Paylaştığınız tasarım ya da portföy PDF'ine adınızı ya da markanızı işleyin." },
      ],
      faq: [
        { q: "Filigran sonradan silinebilir mi?", a: "Filigran sayfaya eklenir; özgün dosyanız değişmez. Başkalarının filigranı kaldırması mümkün olabileceğinden gerçek bir koruma yerine uyarı ve işaret olarak düşünün." },
        { q: "Filigran metnin okunmasını engeller mi?", a: "Şeffaflığı artırıp renk ve boyutu ayarlayarak metni okunur bırakabilirsiniz." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF you want to watermark with «Choose file»." },
        { title: "Design the watermark", x: "Type the text and set colour, font, angle, size and transparency. Turkish characters come out correctly." },
        { title: "Choose the pages", x: "Decide whether it goes on all pages or only the ones you select." },
        { title: "Apply and download", x: "The file is uploaded for processing and deleted when it finishes; save the watermarked PDF." },
      ],
      useCases: [
        { title: "Marking draft documents", x: "Share an unapproved contract or report with a «DRAFT» watermark." },
        { title: "Confidentiality notice", x: "Add «CONFIDENTIAL» to documents meant for internal use." },
        { title: "Copyright and ownership", x: "Put your name or brand on a design or portfolio PDF you share." },
      ],
      faq: [
        { q: "Can the watermark be removed later?", a: "It is added to the page and your original file is unchanged. Others may be able to remove it, so treat it as a notice and marker rather than real protection." },
        { q: "Will the watermark make the text hard to read?", a: "Raise the transparency and adjust colour and size to keep the text readable." },
      ],
    },
  },

  "flip-pdf": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Çevirmek istediğiniz PDF'i «Dosya Seç» ile seçin." },
        { title: "Yönü seçin", x: "Yatay (soldan sağa) ya da dikey (baş aşağı) çevirmeyi seçin." },
        { title: "Sayfaları belirleyin", x: "Tüm sayfaları ya da yalnızca seçtiğiniz sayfaları çevirin." },
        { title: "PDF'i indirin", x: "Dosya işlem için sunucuya yüklenir ve işlem bitince silinir; çevrilmiş kopyayı kaydedin." },
      ],
      useCases: [
        { title: "Ayna yazı gerektiren baskılar", x: "Ütü transferi ya da cam yüzeye yapıştırılacak baskı için sayfayı ayna görüntüsüne çevirin." },
        { title: "Ters taranan sayfalar", x: "Tarayıcıda yansımış ya da baş aşağı giren sayfaları düzeltin." },
        { title: "Tasarım denemeleri", x: "Bir tasarımın ayna görünümünü hızlıca görmek için sayfayı çevirin." },
      ],
      faq: [
        { q: "Çevirme ile döndürme aynı şey mi?", a: "Hayır. Döndürme sayfayı 90° katlarıyla çevirir; çevirme ise sayfayı ayna gibi yansıtır, yazı ters görünür." },
        { q: "Çevrilmiş sayfada metin hâlâ seçilebilir mi?", a: "Sayfa yansıtıldığı için metin ters görünür; yazı olarak okunabilir olmasını istiyorsanız döndürme aracını kullanın." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF you want to flip with «Choose file»." },
        { title: "Choose the direction", x: "Pick horizontal (left to right) or vertical (upside down) flipping." },
        { title: "Choose the pages", x: "Flip all pages or only the ones you select." },
        { title: "Download the PDF", x: "The file is uploaded for processing and deleted when it finishes; save the flipped copy." },
      ],
      useCases: [
        { title: "Prints that need mirrored text", x: "Mirror a page for an iron-on transfer or a print applied to glass." },
        { title: "Pages scanned reversed", x: "Fix pages that were mirrored or fed upside down in the scanner." },
        { title: "Design experiments", x: "Flip a page to see a layout's mirror image quickly." },
      ],
      faq: [
        { q: "Is flipping the same as rotating?", a: "No. Rotating turns the page in multiples of 90°; flipping mirrors it, so the writing looks reversed." },
        { q: "Is the text still selectable on a flipped page?", a: "The page is mirrored, so the text appears reversed. If you want it to read normally, use the rotate tool instead." },
      ],
    },
  },

  "page-numbers": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Numaralandırmak istediğiniz PDF'i «Dosya Seç» ile seçin." },
        { title: "Konumu ve biçimi seçin", x: "Numaranın sayfanın üstünde mi altında mı duracağını ve biçimini (örneğin yalnızca rakam) belirleyin." },
        { title: "Başlangıcı ayarlayın", x: "Numaralamanın kaçıncı sayfadan başlayacağını ve ilk numarayı belirleyin." },
        { title: "Uygulayın ve indirin", x: "Dosya işlem için sunucuya yüklenir ve işlem bitince silinir; numaralı PDF'i kaydedin." },
      ],
      useCases: [
        { title: "Tez ve rapor", x: "Kapak ve içindekiler sayfasını atlayıp numarayı ana metinden başlatın." },
        { title: "Birleştirilmiş belge", x: "Birden çok dosyayı birleştirdikten sonra baştan sona tek bir numaralama yapın." },
        { title: "Dava ve ihale dosyaları", x: "Sunulan evrakın sayfalarını takip edilebilir hâle getirin." },
      ],
      faq: [
        { q: "Kapak sayfası numaralanmasın istiyorum, olur mu?", a: "Evet. Numaralamayı kapaktan sonraki sayfadan başlatabilirsiniz." },
        { q: "Mevcut sayfa numaralarının üstüne yazar mı?", a: "Araç numarayı mevcut içeriğin üstüne ekler. Belgede zaten numara varsa konumu farklı seçerek çakışmayı önleyin." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF you want to number with «Choose file»." },
        { title: "Choose position and format", x: "Decide whether the number sits at the top or bottom of the page and pick its format (for example digits only)." },
        { title: "Set the start", x: "Choose which page numbering begins on and the first number." },
        { title: "Apply and download", x: "The file is uploaded for processing and deleted when it finishes; save the numbered PDF." },
      ],
      useCases: [
        { title: "Theses and reports", x: "Skip the cover and contents pages and start numbering at the main text." },
        { title: "Merged documents", x: "Number a combined file continuously from start to end after merging several files." },
        { title: "Court and tender files", x: "Make the pages of submitted papers easy to refer to." },
      ],
      faq: [
        { q: "Can I leave the cover page unnumbered?", a: "Yes. You can start numbering from the page after the cover." },
        { q: "Does it write over existing page numbers?", a: "The number is added on top of the existing content. If the document already has numbers, choose a different position to avoid overlap." },
      ],
    },
  },

  "resize-pdf": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Boyutunu değiştirmek istediğiniz PDF'i «Dosya Seç» ile seçin." },
        { title: "Hedef boyutu seçin", x: "A3, A4, A5, A6, Letter, Legal ya da kendi ölçünüzü seçin." },
        { title: "Boyutlandırın", x: "Dosya işlem için sunucuya yüklenir ve işlem bitince silinir. Sayfalar oranı korunarak yeni boyuta yerleşir." },
        { title: "PDF'i indirin", x: "Yazılar ve çizimler vektör olarak taşındığı için keskin kalır." },
      ],
      useCases: [
        { title: "Letter belgeyi A4'e getirmek", x: "Yurt dışından gelen Letter boyutlu belgeyi Türkiye'deki yazıcılara uygun A4 yapın." },
        { title: "Küçük kitapçık hazırlamak", x: "A4 belgeyi A5 sayfalara indirip kitapçık biçiminde basın." },
        { title: "Portal gereksinimi", x: "Belirli bir sayfa boyutu isteyen sisteme yükleyeceğiniz dosyayı ayarlayın." },
      ],
      faq: [
        { q: "Sayfa oranı farklıysa içerik kesilir mi?", a: "Hayır. İçerik oranı korunarak sığdırılır; oranlar farklıysa kenarlarda boşluk kalabilir." },
        { q: "Boyutlandırma dosya boyutunu (MB) küçültür mü?", a: "Hedef sayfa ölçüsünü değiştirir, dosya boyutunu küçültmek için tasarlanmamıştır. Megabayt küçültmek için «PDF Sıkıştır» aracını kullanın." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF whose page size you want to change with «Choose file»." },
        { title: "Choose the target size", x: "Pick A3, A4, A5, A6, Letter, Legal or your own dimensions." },
        { title: "Resize", x: "The file is uploaded for processing and deleted when it finishes. Pages are placed in the new size with their proportions kept." },
        { title: "Download the PDF", x: "Text and drawings are carried over as vectors, so they stay sharp." },
      ],
      useCases: [
        { title: "Turning a Letter document into A4", x: "Make a US Letter file suit printers that use A4." },
        { title: "Making a small booklet", x: "Reduce an A4 document to A5 pages and print it as a booklet." },
        { title: "A portal requirement", x: "Adjust a file for a system that demands a specific page size." },
      ],
      faq: [
        { q: "Is content cropped if the proportions differ?", a: "No. Content is fitted with its proportions kept; if the ratios differ, there may be empty margins." },
        { q: "Does resizing reduce the file size in MB?", a: "It changes the page dimensions and is not meant to shrink the file. Use the Compress PDF tool to reduce megabytes." },
      ],
    },
  },

  "alternate-mix-pdf": {
    tr: {
      steps: [
        { title: "İki PDF'i yükleyin", x: "Ön yüzleri içeren dosyayı birinci, arka yüzleri içeren dosyayı ikinci olarak seçin." },
        { title: "Sıra seçeneğini işaretleyin", x: "Arka yüzleri tersten taradıysanız ikinci dosyayı ters sırada okuma seçeneğini açın." },
        { title: "Serpiştirin", x: "Dosya işlem için sunucuya yüklenir ve işlem bitince silinir. Sayfalar 1. ön, 1. arka, 2. ön, 2. arka… diye dizilir." },
        { title: "Tek PDF'i indirin", x: "Sayfaları doğru sırada birleşmiş belgeyi kaydedin." },
      ],
      useCases: [
        { title: "Tek yüz tarayan tarayıcıda çift taraflı belge", x: "Önce ön yüzleri, sonra arka yüzleri taradıysanız ikisini doğru sırada tek belgeye çevirin." },
        { title: "Sözleşme ve el kitapları", x: "Çift taraflı basılı bir kitapçığı taratıp sırasını düzeltin." },
        { title: "İki ayrı kaynağı dönüşümlü dizmek", x: "İki belgenin sayfalarını bir A, bir B şeklinde karşılaştırmalı okumak için iç içe geçirin." },
      ],
      faq: [
        { q: "İki dosyanın sayfa sayısı farklıysa ne olur?", a: "Sayfalar sırayla dizilir; sayfası fazla olan dosyanın kalan sayfaları sona eklenir." },
        { q: "Arka yüzleri ters sırada taradım, ne yapmalıyım?", a: "İkinci dosyayı ters sırada oku seçeneğini işaretleyin; araç arka yüzleri doğru sıraya oturtur." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the two PDFs", x: "Choose the file with the front sides first and the file with the back sides second." },
        { title: "Set the order option", x: "If you scanned the backs in reverse, turn on reading the second file in reverse order." },
        { title: "Interleave", x: "The files are uploaded for processing and deleted when it finishes. Pages are arranged as 1st front, 1st back, 2nd front, 2nd back…" },
        { title: "Download the single PDF", x: "Save the document with its pages merged in the right order." },
      ],
      useCases: [
        { title: "Double-sided documents on a single-sided scanner", x: "If you scanned all fronts and then all backs, turn them into one document in the right order." },
        { title: "Contracts and manuals", x: "Scan a double-sided printed booklet and put its pages in order." },
        { title: "Alternating two sources", x: "Interleave two documents' pages as A, B, A, B to read them side by side." },
      ],
      faq: [
        { q: "What if the two files have different page counts?", a: "Pages are interleaved in turn; the remaining pages of the longer file are added at the end." },
        { q: "I scanned the backs in reverse — what do I do?", a: "Tick the option to read the second file in reverse order; the tool puts the backs in the right sequence." },
      ],
    },
  },
  "aranabilir-pdf": {
    tr: {
      steps: [
        { title: "Taranmış PDF'i ya da görselleri ekleyin", x: "«Dosya Seç» ile taranmış PDF'i ya da JPG/PNG belge görsellerini seçin; birden çok görsel tek PDF'te birleşir." },
        { title: "Dili seçin", x: "Belgenin diline göre Türkçe ve İngilizce tanımayı kullanın; ş, ğ, ı, İ gibi karakterler doğru tanınır." },
        { title: "Metni tanıtın", x: "OCR cihazınızda çalışır ve görüntünün üzerine görünmez bir metin katmanı ekler; belgeniz internete yüklenmez." },
        { title: "Aranabilir PDF'i indirin", x: "Sayfalar göze aynı görünür ama artık Ctrl+F ile aranabilir ve metin kopyalanabilir." },
      ],
      useCases: [
        { title: "Taranmış arşivde arama", x: "Yıllarca taranmış sözleşme, fatura ve dilekçeleri açmadan tek tek bakmak yerine içinde kelime arayın." },
        { title: "Telefonla çekilen belgeler", x: "Belge fotoğraflarını aranabilir ve kopyalanabilir tek bir PDF'e çevirin." },
        { title: "Metni başka yere aktarma", x: "Taranmış sayfadaki bir paragrafı yeniden yazmadan seçip kopyalayın." },
      ],
      faq: [],
    },
    en: {
      steps: [
        { title: "Add the scanned PDF or images", x: "Choose a scanned PDF or JPG/PNG document images with «Choose file»; several images are combined into one PDF." },
        { title: "Pick the language", x: "Use Turkish and English recognition for your document; characters such as ş, ğ, ı and İ are read correctly." },
        { title: "Run the OCR", x: "OCR runs on your device and adds an invisible text layer over the image; your document is not uploaded." },
        { title: "Download the searchable PDF", x: "The pages look the same, but you can now search with Ctrl+F and copy the text." },
      ],
      useCases: [
        { title: "Searching a scanned archive", x: "Search for a word across years of scanned contracts, invoices and petitions instead of opening each one." },
        { title: "Documents shot with a phone", x: "Turn document photos into one searchable, copyable PDF." },
        { title: "Reusing text", x: "Select and copy a paragraph from a scanned page instead of retyping it." },
      ],
      faq: [],
    },
  },
  "udf-to-pdf": {
    tr: {
      steps: [
        { title: "UDF dosyasını bırakın", x: "UYAP'tan indirdiğiniz .udf dosyasını alana sürükleyin ya da «Dosya Seç» ile seçin." },
        { title: "Dönüştürmeyi başlatın", x: "Dönüştürme tarayıcınızda yapılır; UYAP Doküman Editörü ya da Java kurmanız gerekmez." },
        { title: "PDF'i indirin", x: "Yazı tipleri, kalın ve altı çizili metin, tablolar ve gömülü görseller PDF'e aktarılır; metin seçilebilir ve aranabilirdir." },
      ],
      useCases: [
        { title: "Karar ve dilekçeyi paylaşma", x: "UDF açamayan müvekkile ya da muhasebeciye belgenin okunabilir PDF kopyasını gönderin." },
        { title: "Telefonda UDF açma", x: "Bilgisayarınız yokken UYAP'tan inen belgeyi telefondan PDF olarak görüntüleyin." },
        { title: "Arşivleme", x: "UDF dosyalarını her cihazda açılan PDF'e çevirerek arşivleyin; imzalı aslı ayrıca saklayın." },
      ],
      faq: [],
    },
    en: {
      steps: [
        { title: "Drop in the UDF file", x: "Drag the .udf file you downloaded from UYAP onto the area, or pick it with «Choose file»." },
        { title: "Start the conversion", x: "Conversion runs in your browser; you don't need the UYAP Document Editor or Java." },
        { title: "Download the PDF", x: "Fonts, bold and underlined text, tables and embedded images carry over; the text is selectable and searchable." },
      ],
      useCases: [
        { title: "Sharing a decision or petition", x: "Send a readable PDF copy to a client or accountant who can't open UDF files." },
        { title: "Opening a UDF on a phone", x: "View a document downloaded from UYAP as a PDF on your phone when you have no computer at hand." },
        { title: "Archiving", x: "Convert UDF files to a PDF that opens on any device, and keep the signed original separately." },
      ],
      faq: [],
    },
  },
  "pdf-kesit-al": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "Kesit almak istediğiniz PDF'i «Dosya Seç» ile açın ve sayfayı bulun." },
        { title: "Alanı seçin", x: "Sayfada kırpmak istediğiniz bölgeyi sürükleyerek seçin; tablo, grafik, şema ya da tek bir soru olabilir." },
        { title: "Kesiti sepete ekleyin", x: "«Kesiti Ekle» deyin; kesit seçtiğiniz çözünürlükte (1x, 2x, 3x) doğrudan belgeden çizilir. İstediğiniz kadar kesit ekleyebilirsiniz." },
        { title: "Biçimi seçip kaydedin", x: "PDF, PNG ya da JPEG olarak kaydedin. İşlem tarayıcınızda yapılır; belgeniz yüklenmez." },
      ],
      useCases: [
        { title: "Tablo ve grafik alma", x: "Raporun içindeki bir tabloyu ya da grafiği sunumunuza net bir görsel olarak alın." },
        { title: "Sınav sorusu kırpma", x: "Soru kitabından tek bir soruyu kesip çalışma kâğıdına ekleyin." },
        { title: "Belgenin bir bölümünü paylaşma", x: "Tüm PDF'i göndermeden yalnızca ilgili bölgeyi paylaşın." },
      ],
      faq: [],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Open the PDF with «Choose file» and go to the page you need." },
        { title: "Select the area", x: "Drag over the region you want to crop; it can be a table, chart, diagram or a single question." },
        { title: "Add the snip to the basket", x: "Click «Add snip»; it is rendered straight from the document at the resolution you choose (1x, 2x, 3x). Add as many snips as you like." },
        { title: "Pick a format and save", x: "Save as PDF, PNG or JPEG. Everything runs in your browser; your document is not uploaded." },
      ],
      useCases: [
        { title: "Grabbing a table or chart", x: "Pull a table or chart out of a report as a sharp image for your presentation." },
        { title: "Cropping an exam question", x: "Cut one question out of a question book and add it to a worksheet." },
        { title: "Sharing part of a document", x: "Share only the relevant region instead of sending the whole PDF." },
      ],
      faq: [],
    },
  },
};
