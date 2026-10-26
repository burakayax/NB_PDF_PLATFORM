/**
 * EN ÇOK ARANAN 10 ARAÇ İÇİN ZENGİN SAYFA İÇERİĞİ — "nasıl yapılır" adımları,
 * kullanım senaryoları ve ek SSS.
 *
 * Kurallar:
 *  - Burada yazılan her cümle aracın GERÇEKTEN yaptığı bir şey olmalı; araç
 *    sayfalarındaki mevcut açıklama/SSS metinleriyle çelişmemeli.
 *  - `steps` HowTo JSON-LD'yi besler, `useCases` görünür senaryo listesidir,
 *    `faq` mevcut SSS listesinin SONUNA eklenir (FAQPage şemasına da girer).
 *  - Statik prerender (generate-seo-files.mjs) ve React araç sayfası aynı kaynağı okur.
 */
import { TOOL_GUIDE_EXTRA } from "./toolGuidesExtra.mjs";

const TOOL_GUIDE_CORE = {
  "merge-pdf": {
    tr: {
      steps: [
        { title: "Dosyaları ekleyin", x: "«Dosya Seç» düğmesine basın ya da PDF'leri alanın üstüne sürükleyip bırakın. Bir seferde birden çok dosya seçebilirsiniz." },
        { title: "Sırayı belirleyin", x: "Listedeki dosyaları sürükleyerek istediğiniz sıraya dizin. Yeni belge tam bu sırayla oluşur." },
        { title: "Birleştirin", x: "«Birleştir» düğmesine basın. İşlem dosyalarınız cihazınızdan çıkmadan tarayıcıda yapılır." },
        { title: "Sonucu indirin", x: "Birleşik PDF saniyeler içinde hazır olur; «İndir» ile bilgisayarınıza ya da telefonunuza kaydedin." },
      ],
      useCases: [
        { title: "İhale ve başvuru dosyası", x: "Ayrı ayrı hazırlanan teklif, belge ve ek dosyalarını tek bir PDF'te toplayıp portala tek dosya olarak yükleyin." },
        { title: "Fatura ve dekontları tek dosyada toplama", x: "Ay boyunca biriken fatura ve dekontları sırayla birleştirip muhasebeciye ya da kuruma tek ek olarak gönderin." },
        { title: "Ders notları ve ödevler", x: "Farklı derslerin ya da haftaların PDF notlarını tek belgede birleştirip tek yerden çalışın." },
        { title: "Sözleşme ve ekleri", x: "Ana sözleşmeyi ek ve imza sayfalarıyla birlikte doğru sırada tek dosya hâline getirin." },
      ],
      faq: [
        { q: "Birleştirdiğim PDF çok büyük olursa ne yapmalıyım?", a: "Birleşik dosyayı PDF Sıkıştır aracına yükleyip boyutunu küçültebilirsiniz; e-posta ya da portal yükleme sınırlarına uymak için kullanışlıdır." },
        { q: "Birleştirdikten sonra sayfaların sırasını değiştirmek istersem?", a: "Sayfaları Düzenle aracıyla sayfaları sürükleyerek yeniden dizebilir, Sayfa Sil aracıyla gereksiz sayfaları çıkarabilirsiniz." },
      ],
    },
    en: {
      steps: [
        { title: "Add your files", x: "Click «Choose file» or drag your PDFs onto the area. You can select several files at once." },
        { title: "Set the order", x: "Drag the files in the list into the order you want. The new document follows exactly that order." },
        { title: "Merge", x: "Click «Merge». Your files are processed in your browser and never leave your device." },
        { title: "Download the result", x: "The merged PDF is ready in seconds; save it to your computer or phone with «Download»." },
      ],
      useCases: [
        { title: "Tender and application packages", x: "Combine the offer, supporting documents and attachments you prepared separately into one PDF for a single upload." },
        { title: "Collecting invoices and receipts", x: "Merge a month of invoices and receipts in order and send your accountant one attachment." },
        { title: "Class notes and assignments", x: "Join notes from different courses or weeks into one document and study from a single file." },
        { title: "Contracts with their annexes", x: "Put the main contract, annexes and signature pages into one file in the right order." },
      ],
      faq: [
        { q: "What if the merged PDF is too large?", a: "Upload the merged file to the Compress PDF tool to shrink it so it fits email and portal upload limits." },
        { q: "Can I reorder pages after merging?", a: "Yes. Use the Organize PDF tool to drag pages into a new order and the Delete Pages tool to remove the ones you don't need." },
      ],
    },
  },

  "split-pdf": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile PDF'inizi seçin. Sayfalar küçük resimler hâlinde ekrana gelir." },
        { title: "Bölme biçimini seçin", x: "Sayfa seçerek, «Her N sayfada bir», «Boyuta göre (MB)» ya da (üye girişiyle) «Yer imine göre» kipinden birini seçin." },
        { title: "Ayırın", x: "İstediğiniz sayfaları işaretleyip ayırma düğmesine basın. Seçilenler tek PDF'te toplanabilir ya da ayrı ayrı kaydedilebilir." },
        { title: "İndirin", x: "Sonuç tek dosya olarak ya da birden çok parça için ZIP hâlinde iner." },
      ],
      useCases: [
        { title: "Yükleme sınırına uymak", x: "Büyük bir PDF'i «Boyuta göre (MB)» kipiyle parçalara bölerek e-Devlet ve ihale sistemlerinin dosya boyutu sınırının altında kalın." },
        { title: "Tek sayfayı çıkarmak", x: "Yüzlerce sayfalık bir belgeden yalnızca ihtiyacınız olan sayfayı alıp ayrı PDF yapın." },
        { title: "Toplu taramayı bölmek", x: "Tek seferde taranan birden çok belgeyi «Her N sayfada bir» kipiyle ayrı dosyalara dağıtın." },
        { title: "Kitap ve rapor bölümleri", x: "Yer imi olan bir raporu bölümlerine ayırın; her dosya yer imi başlığını ad olarak alır." },
      ],
      faq: [],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose your PDF with «Choose file». The pages appear as thumbnails." },
        { title: "Pick a split mode", x: "Choose selected pages, «Every N pages», «By size (MB)» or, when signed in, «By bookmarks»." },
        { title: "Split", x: "Mark the pages you want and click split. The selection can be combined into one PDF or saved separately." },
        { title: "Download", x: "You get one file, or a ZIP when there are several parts." },
      ],
      useCases: [
        { title: "Meeting upload limits", x: "Split a large PDF with «By size (MB)» so every part stays under a portal's file-size limit." },
        { title: "Pulling out a single page", x: "Take just the page you need from a document of hundreds of pages and save it as its own PDF." },
        { title: "Separating a batch scan", x: "Use «Every N pages» to divide several documents scanned in one go into separate files." },
        { title: "Chapters of a report or book", x: "Split a PDF that has bookmarks into its sections; each file is named after its bookmark." },
      ],
      faq: [],
    },
  },

  compress: {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile küçültmek istediğiniz PDF'i seçin." },
        { title: "Düzeyi ya da hedef boyutu seçin", x: "Sıkıştırma düzeyini seçin veya «Hedef boyut» menüsünden bir sınır belirleyin (örneğin 1 MB)." },
        { title: "Sıkıştırın", x: "İşlemi başlatın. Dosyanız şifreli aktarılır, sunucuda işlenir ve işlem sonrası silinir." },
        { title: "Sonucu kontrol edip indirin", x: "Sonuç ekranı dosyanın kaç MB'tan kaç MB'a indiğini gösterir; memnunsanız indirin." },
      ],
      useCases: [
        { title: "E-posta ekine sığdırmak", x: "Bazı e-posta servisleri büyük ekleri reddeder; PDF'i küçültüp tek mesajda gönderin." },
        { title: "Başvuru ve portal yüklemeleri", x: "Kurumların koyduğu dosya boyutu sınırının altına inin; hedef boyutu seçerek tek seferde deneyin." },
        { title: "Taranmış belgeler", x: "Görsel ağırlıklı taranmış PDF'lerde sıkıştırma genellikle en büyük boyut kazancını sağlar." },
        { title: "Hızlı paylaşım", x: "Mesajlaşma uygulamalarında ve düşük hızlı bağlantılarda daha hızlı iletilen, hafif bir PDF elde edin." },
      ],
      faq: [],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF you want to shrink with «Choose file»." },
        { title: "Pick a level or target size", x: "Select a compression level, or set a limit from the «Target size» menu (for example 1 MB)." },
        { title: "Compress", x: "Start the process. Your file is sent over an encrypted connection, processed on the server and deleted afterwards." },
        { title: "Check and download", x: "The result screen shows how many MB the file went from and to; download it when you're happy." },
      ],
      useCases: [
        { title: "Fitting an email attachment", x: "Some mail services reject large attachments; shrink the PDF and send it in one message." },
        { title: "Applications and portal uploads", x: "Get under a portal's file-size limit; pick a target size and try it in one go." },
        { title: "Scanned documents", x: "Image-heavy scanned PDFs usually gain the most from compression." },
        { title: "Faster sharing", x: "Get a lighter PDF that travels faster in messaging apps and on slow connections." },
      ],
      faq: [],
    },
  },

  "pdf-to-word": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile Word'e çevirmek istediğiniz PDF'i seçin. Hesabınıza giriş yapmanız gerekebilir; hesap ücretsiz açılır." },
        { title: "Dönüştürün", x: "dönüştür düğmesine basın. Yazı tipleri, tablolar ve düzen korunarak .docx hazırlanır." },
        { title: "Önizleyin", x: "Sonucu indirmeden önce önizlemeden kontrol edin." },
        { title: "İndirip düzenleyin", x: "Dosyayı indirin ve Word, Google Dokümanlar ya da LibreOffice'te açıp metni düzenleyin." },
      ],
      useCases: [
        { title: "Eski belgeyi güncellemek", x: "Elinizde yalnızca PDF'i kalan bir sözleşme veya rapor şablonunu düzenlenebilir hâle getirip güncelleyin." },
        { title: "CV'yi yeniden düzenlemek", x: "PDF olarak aldığınız özgeçmişi Word'e çevirip bilgilerini değiştirin." },
        { title: "Metni başka yere taşımak", x: "PDF'teki paragrafları ve tabloları kopyalamak yerine tek seferde düzenlenebilir belgeye alın." },
        { title: "Form ve dilekçe taslakları", x: "Hazır bir dilekçe veya form PDF'ini Word'e alıp kendi bilgilerinize göre doldurun." },
      ],
      faq: [
        { q: "PDF'i Excel veya PowerPoint'e de çevirebilir miyim?", a: "Evet. Tablolu belgeler için PDF → Excel, sunumlar için PDF → PowerPoint araçlarımız var; ayrı sayfalarından kullanabilirsiniz." },
        { q: "Taranmış belgede sonuç iyi çıkmazsa ne yapmalıyım?", a: "Taranmış belge aslında bir resimdir. Önce Taranmış PDF (OCR) aracıyla metin katmanı oluşturmak sonucu iyileştirebilir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the PDF you want to convert with «Choose file». You may need to sign in; accounts are free." },
        { title: "Convert", x: "Click the convert button. A .docx is produced with fonts, tables and layout kept." },
        { title: "Preview", x: "Check the result in the preview before you download it." },
        { title: "Download and edit", x: "Download the file and open it in Word, Google Docs or LibreOffice to edit the text." },
      ],
      useCases: [
        { title: "Updating an old document", x: "Turn a contract or report template that only exists as a PDF into something you can edit and update." },
        { title: "Reworking a CV", x: "Convert the CV you received as a PDF to Word and change the details." },
        { title: "Moving text elsewhere", x: "Instead of copying paragraphs and tables one by one, get an editable document in one step." },
        { title: "Form and letter drafts", x: "Bring a ready-made petition or form PDF into Word and fill it in with your own details." },
      ],
      faq: [
        { q: "Can I also convert a PDF to Excel or PowerPoint?", a: "Yes. We have PDF to Excel for tables and PDF to PowerPoint for presentations, each on its own page." },
        { q: "What if a scanned document converts poorly?", a: "A scan is really a picture. Creating a text layer first with the OCR tool can improve the result." },
      ],
    },
  },

  "word-to-pdf": {
    tr: {
      steps: [
        { title: "Word dosyasını yükleyin", x: "«Dosya Seç» ile .doc veya .docx belgenizi seçin." },
        { title: "Dönüştürün", x: "dönüştür düğmesine basın. Yazı tipleri gömülür, sayfa düzeni korunur." },
        { title: "Önizleyin", x: "Çıktıyı indirmeden önce önizlemeden kontrol edin." },
        { title: "İndirin", x: "PDF'i kaydedin; artık her cihazda aynı görünür." },
      ],
      useCases: [
        { title: "Başvuru ve resmî evrak", x: "Dilekçe, özgeçmiş ve ekleri PDF yaparak karşı tarafta düzenin kaymasını önleyin." },
        { title: "Sözleşme ve teklif göndermek", x: "Müşteriye gidecek teklifi değiştirilemeyen, her cihazda aynı görünen PDF olarak iletin." },
        { title: "Ödev ve tez teslimi", x: "Okulun PDF istediği ödev veya raporu yazı tipleri bozulmadan teslim edin." },
        { title: "Yazdırmaya hazırlamak", x: "Baskıya gidecek belgeyi sabit düzenli PDF'e çevirip matbaaya ya da yazıcıya gönderin." },
      ],
      faq: [
        { q: "Dönüştürdüğüm PDF'in boyutu büyük çıkarsa ne yapmalıyım?", a: "Çıkan PDF'i PDF Sıkıştır aracıyla küçültebilirsiniz." },
        { q: "PDF'e sayfa numarası veya filigran ekleyebilir miyim?", a: "Evet. Dönüştürdükten sonra Sayfa Numarası ve Filigran Ekle araçlarını kullanabilirsiniz; kullanım koşulları ilgili araç sayfasında yazar." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the Word file", x: "Choose your .doc or .docx document with «Choose file»." },
        { title: "Convert", x: "Click the convert button. Fonts are embedded and the page layout is kept." },
        { title: "Preview", x: "Check the output in the preview before downloading." },
        { title: "Download", x: "Save the PDF; it now looks the same on every device." },
      ],
      useCases: [
        { title: "Applications and official paperwork", x: "Turn letters, CVs and attachments into PDF so the layout can't shift on the other side." },
        { title: "Sending contracts and offers", x: "Send the client an offer as a PDF that looks the same everywhere and is harder to alter by accident." },
        { title: "Handing in assignments and theses", x: "Submit the report your school wants as a PDF with fonts intact." },
        { title: "Preparing for print", x: "Convert a document going to print into a fixed-layout PDF before sending it to the printer." },
      ],
      faq: [
        { q: "What if the resulting PDF is large?", a: "Shrink it with the Compress PDF tool." },
        { q: "Can I add page numbers or a watermark?", a: "Yes. After converting, use the Page Numbers and Watermark tools; their terms of use are on each tool's page." },
      ],
    },
  },

  "pdf-to-image": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile PDF'inizi seçin." },
        { title: "Biçim ve çözünürlüğü seçin", x: "JPG, PNG ya da TIFF'ten birini; Ekran (150 DPI), Normal (300 DPI) veya Baskı (400 DPI) çözünürlüğünden birini seçin." },
        { title: "Sayfaları belirleyin", x: "Tüm sayfalar için alanı boş bırakın ya da «1-3, 5» gibi yazarak yalnızca istediğiniz sayfaları seçin." },
        { title: "Dönüştürüp indirin", x: "Her sayfa ayrı görsel olarak hazırlanır ve toplu indirilir; dosya adındaki numara gerçek sayfa numarasıdır." },
      ],
      useCases: [
        { title: "Sunuma ve web'e koymak", x: "PDF'teki bir grafik ya da sayfayı slayta veya web sayfasına görsel olarak ekleyin." },
        { title: "Sosyal medyada paylaşmak", x: "Belgenin bir sayfasını PDF yerine doğrudan paylaşılabilen JPG yapın." },
        { title: "Baskı ve arşiv", x: "Baskı çözünürlüğünde (400 DPI) ya da TIFF olarak çıktı alıp arşivleyin." },
        { title: "Yalnızca belirli sayfalar", x: "Uzun bir PDF'ten sadece birkaç sayfayı görsele çevirerek zaman kazanın." },
      ],
      faq: [
        { q: "Görsellerden tekrar PDF yapabilir miyim?", a: "Evet. Görsel → PDF aracı JPG, PNG ve WebP görsellerini tek PDF'te birleştirir." },
        { q: "Telefonda kullanabilir miyim?", a: "Evet. Araç tarayıcı tabanlıdır; kurulum gerektirmeden telefon ve tablette de çalışır." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose your PDF with «Choose file»." },
        { title: "Pick a format and resolution", x: "Choose JPG, PNG or TIFF, and Screen (150 DPI), Normal (300 DPI) or Print (400 DPI)." },
        { title: "Choose the pages", x: "Leave the field empty for every page, or type something like «1-3, 5» to convert only those." },
        { title: "Convert and download", x: "Each page becomes its own image and downloads together; the number in the file name is the real page number." },
      ],
      useCases: [
        { title: "Putting a page on a slide or website", x: "Add a chart or page from a PDF to a presentation or web page as an image." },
        { title: "Sharing on social media", x: "Turn one page of a document into a JPG you can post directly instead of a PDF." },
        { title: "Print and archive", x: "Export at print resolution (400 DPI) or as TIFF for printing and archiving." },
        { title: "Only certain pages", x: "Save time by converting just a few pages of a long PDF." },
      ],
      faq: [
        { q: "Can I turn the images back into a PDF?", a: "Yes. The JPG to PDF tool combines JPG, PNG and WebP images into one PDF." },
        { q: "Can I use it on a phone?", a: "Yes. The tool runs in your browser, so it works on phones and tablets without installing anything." },
      ],
    },
  },

  "image-to-pdf": {
    tr: {
      steps: [
        { title: "Görselleri ekleyin", x: "JPG, PNG veya WebP dosyalarını sürükleyip bırakın ya da «Dosya Seç» ile ekleyin. Telefon fotoğraflarını da seçebilirsiniz." },
        { title: "Sırayı düzenleyin", x: "Görselleri sürükleyerek PDF'te görünmesini istediğiniz sıraya dizin." },
        { title: "PDF'e çevirin", x: "Düğmeye basın. Dönüştürme tarayıcınızda yapılır; görselleriniz sunucuya gitmez." },
        { title: "İndirin", x: "Tek PDF hâlindeki dosyayı kaydedin." },
      ],
      useCases: [
        { title: "Kimlik ve belge fotoğrafları", x: "Telefonla çektiğiniz belge fotoğraflarını tek PDF yapıp başvuruya ekleyin." },
        { title: "Ekran görüntüsünü belgelemek", x: "Birkaç ekran görüntüsünü sırayla tek PDF'te toplayıp paylaşın." },
        { title: "Fatura ve fişleri toplamak", x: "Fiş ve fatura fotoğraflarını tek dosyada birleştirip masraf bildirimine ekleyin." },
        { title: "El yazısı notları arşivlemek", x: "Fotoğrafladığınız defter sayfalarını sıralı bir PDF'e dönüştürün." },
      ],
      faq: [
        { q: "Oluşan PDF çok büyük olursa ne yapmalıyım?", a: "PDF Sıkıştır aracıyla boyutunu küçültebilirsiniz; görselleriniz PDF'e orijinal kalitesiyle girer, küçültme sizin seçiminizdir." },
      ],
    },
    en: {
      steps: [
        { title: "Add your images", x: "Drag JPG, PNG or WebP files onto the area or add them with «Choose file». Phone photos work too." },
        { title: "Set the order", x: "Drag the images into the order you want in the PDF." },
        { title: "Convert to PDF", x: "Click the button. Conversion runs in your browser; your images are not uploaded." },
        { title: "Download", x: "Save the single PDF file." },
      ],
      useCases: [
        { title: "ID and document photos", x: "Turn photos of documents taken with your phone into one PDF for an application." },
        { title: "Documenting screenshots", x: "Collect several screenshots in order into one PDF and share it." },
        { title: "Gathering receipts", x: "Combine photos of receipts and invoices into one file for an expense report." },
        { title: "Archiving handwritten notes", x: "Convert photographed notebook pages into an ordered PDF." },
      ],
      faq: [
        { q: "What if the PDF ends up large?", a: "Shrink it with the Compress PDF tool; your images go into the PDF at their original quality, so reducing size is your choice." },
      ],
    },
  },

  "pdf-duzenle": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile PDF'inizi seçin; editör tam ekran açılır." },
        { title: "Değiştirilecek yazıyı işaretleyin", x: "«Metni Değiştir» ile düzeltmek istediğiniz yazının üstüne kutu çizin. Mevcut metin kutuya gelir." },
        { title: "Yeni metni yazın", x: "Yenisini yazın; boş bırakırsanız o yazı silinir. Gerekirse yeni metin kutusu ya da görsel ekleyin." },
        { title: "Hazırlayıp indirin", x: "«Tamam» → «PDF'i Hazırla» deyin ve düzenlenmiş PDF'i indirin." },
      ],
      useCases: [
        { title: "Yazım hatasını düzeltmek", x: "Gönderilmiş ya da basılmış bir belgedeki yanlış tarihi, ismi veya rakamı düzeltin." },
        { title: "Güncel bilgi eklemek", x: "Eski bir teklif ya da formdaki telefon, adres gibi bilgileri güncelleyin." },
        { title: "Yeni metin eklemek", x: "Boş bir alana not, açıklama ya da ek bilgi yazın." },
        { title: "Gereksiz bir ifadeyi kaldırmak", x: "Belgeden bir satırı ya da kelimeyi, boş metin yazarak gerçekten silin." },
      ],
      faq: [
        { q: "Düzenledikten sonra PDF'i imzalayabilir miyim?", a: "Evet. Düzenlenmiş PDF'i PDF İmzala aracına yükleyerek imza ekleyebilirsiniz." },
        { q: "Kişisel verileri belgeden kalıcı olarak silmek için bu aracı kullanmalı mıyım?", a: "Hassas bilgileri kapatmak için Hassas Veri Gizle aracı tasarlanmıştır; bu araç metin düzeltme ve ekleme içindir." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose your PDF with «Choose file»; the editor opens full screen." },
        { title: "Mark the text to change", x: "Use «Replace text» and draw a box over the text you want to correct. The current text appears in the box." },
        { title: "Type the new text", x: "Type the replacement; leave it empty to delete the text. Add a new text box or an image if needed." },
        { title: "Prepare and download", x: "Click «Done» → «Prepare PDF» and download the edited PDF." },
      ],
      useCases: [
        { title: "Fixing a typo", x: "Correct a wrong date, name or number in a document that was already sent or printed." },
        { title: "Updating information", x: "Update a phone number or address in an old offer or form." },
        { title: "Adding new text", x: "Write a note, explanation or extra detail in an empty area." },
        { title: "Removing a phrase", x: "Truly delete a line or word by leaving the replacement empty." },
      ],
      faq: [
        { q: "Can I sign the PDF after editing?", a: "Yes. Upload the edited PDF to the Sign PDF tool to add your signature." },
        { q: "Should I use this tool to permanently remove personal data?", a: "The Redact Sensitive Data tool is designed for covering sensitive information; this tool is for correcting and adding text." },
      ],
    },
  },

  "pdf-imzala": {
    tr: {
      steps: [
        { title: "PDF'i yükleyin", x: "«Dosya Seç» ile imzalanacak belgeyi seçin." },
        { title: "İmzanızı oluşturun", x: "«İmza Oluştur» ile imzanızı fare ya da parmağınızla çizin, adınızı imza yazı tipiyle yazın veya imza fotoğrafınızı (PNG/JPG) yükleyin." },
        { title: "Sayfaya yerleştirin", x: "İmzayı istediğiniz yere sürükleyin, köşesinden boyutlandırın. İsterseniz birden çok sayfaya yerleştirin ve tarih ekleyin." },
        { title: "Uygulayıp indirin", x: "«Uygula ve İndir» deyin. İşlem tarayıcınızda yapılır; dosyanız ve imzanız sunucuya gitmez." },
      ],
      useCases: [
        { title: "Sözleşmeyi hızlıca imzalamak", x: "Yazıcı ve tarayıcıya gerek kalmadan e-postayla gelen sözleşmeyi imzalayıp geri gönderin." },
        { title: "Form ve taahhütnameler", x: "Başvuru formu, taahhütname veya dilekçeye imza ve tarih ekleyin." },
        { title: "Çok sayfalı belgeler", x: "Her sayfanın altına imza ya da paraf yerleştirin ve tek seferde uygulayın." },
        { title: "Telefondan imza", x: "Parmağınızla imzanızı çizip belgeyi telefonunuzdan imzalayın." },
      ],
      faq: [
        { q: "Başkasından imza istemek için ne yapmalıyım?", a: "Bir belgeyi başkasına imzalatmak için İmza İste aracına bakabilirsiniz." },
        { q: "İmzaya tarih ekleyebilir miyim?", a: "Evet. İmzayla birlikte tarihi de sayfada istediğiniz yere yerleştirebilirsiniz." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the PDF", x: "Choose the document to sign with «Choose file»." },
        { title: "Create your signature", x: "Use «Create signature» to draw it with your mouse or finger, type your name in a signature font, or upload a photo of your signature (PNG/JPG)." },
        { title: "Place it on the page", x: "Drag the signature where you want it and resize it from the corner. Place it on several pages and add a date if needed." },
        { title: "Apply and download", x: "Click «Apply & download». Everything runs in your browser; your file and signature are never uploaded." },
      ],
      useCases: [
        { title: "Signing a contract quickly", x: "Sign a contract that arrived by email and send it back without a printer or scanner." },
        { title: "Forms and statements", x: "Add your signature and date to an application form, undertaking or petition." },
        { title: "Multi-page documents", x: "Place a signature or initials on each page and apply them all at once." },
        { title: "Signing from a phone", x: "Draw your signature with a finger and sign the document right on your phone." },
      ],
      faq: [
        { q: "How do I ask someone else to sign?", a: "To have someone else sign a document, look at the Request Signature tool." },
        { q: "Can I add a date next to the signature?", a: "Yes. You can place the date anywhere on the page along with the signature." },
      ],
    },
  },

  "taranmis-pdf-ocr": {
    tr: {
      steps: [
        { title: "Taranmış PDF'i yükleyin", x: "«Dosya Seç» ile fotoğraf ya da tarama olan PDF'i seçin." },
        { title: "OCR'ı başlatın", x: "Sayfa görüntülerindeki yazı tarayıcınızda (Türkçe + İngilizce) gerçek metne çevrilir; belgeniz sunucuya gitmez." },
        { title: "Metni kontrol edin", x: "Tanınan metni inceleyin. Basılı metinde doğruluk yüksektir; el yazısında ve çok bozuk taramalarda düşebilir." },
        { title: "Kullanın", x: "Metni arayın, kopyalayın, düzenleyin ya da yapay zekâ araçlarıyla özetleyin." },
      ],
      useCases: [
        { title: "Taranmış fatura ve resmî evrak", x: "Resim hâlindeki bir faturanın ya da yazının içinden arama yapabilir, metni kopyalayabilirsiniz." },
        { title: "Gazete ve eski belgeler", x: "Fotoğrafı çekilmiş gazete ya da eski belgeyi okunur ve aranabilir metne çevirin." },
        { title: "Uzun belgeyi özetletmek", x: "Taranmış raporun metnini çıkarıp ardından PDF Özetle ile ana noktalarına ulaşın." },
        { title: "Metni başka belgeye taşımak", x: "Resim hâlindeki paragrafları yeniden yazmak yerine metin olarak alın." },
      ],
      faq: [
        { q: "Taranmış belgeyi aranabilir bir PDF'e dönüştürebilir miyim?", a: "Evet. Aranabilir PDF aracı, taranmış belgeyi yazısı seçilebilen ve aranabilen PDF'e çevirir." },
        { q: "Telefonla çektiğim belgeyi nasıl PDF yaparım?", a: "Belge Tara aracıyla kamerayla belgeyi tarayıp PDF yapabilir, ardından OCR uygulayabilirsiniz." },
      ],
    },
    en: {
      steps: [
        { title: "Upload the scanned PDF", x: "Choose the photo or scanned PDF with «Choose file»." },
        { title: "Run OCR", x: "The text in the page images is turned into real text in your browser (Turkish + English); your document isn't uploaded." },
        { title: "Check the text", x: "Review the recognised text. Accuracy is high on printed text and can drop on handwriting or very poor scans." },
        { title: "Use it", x: "Search it, copy it, edit it, or summarise it with the AI tools." },
      ],
      useCases: [
        { title: "Scanned invoices and official papers", x: "Search inside an invoice or letter that is just an image and copy its text." },
        { title: "Newspapers and old documents", x: "Turn a photographed newspaper or old document into readable, searchable text." },
        { title: "Summarising a long document", x: "Extract the text of a scanned report, then use Summarize PDF to get the key points." },
        { title: "Moving text into another document", x: "Take paragraphs that are pictures as text instead of retyping them." },
      ],
      faq: [
        { q: "Can I turn a scan into a searchable PDF?", a: "Yes. The Searchable PDF tool converts a scanned document into a PDF whose text can be selected and searched." },
        { q: "How do I make a PDF from a document photographed with my phone?", a: "Use the Scan Document tool to capture it with the camera as a PDF, then run OCR on it." },
      ],
    },
  },
};

/** Tüm rehberler: ilk 10 araç (bu dosya) + içeriği kısa kalan araçlar (toolGuidesExtra.mjs). */
export const TOOL_GUIDE = { ...TOOL_GUIDE_CORE, ...TOOL_GUIDE_EXTRA };

/** Araç slug'ı + dil için rehber içeriği (yoksa null). */
export function getToolGuide(slug, lang) {
  return TOOL_GUIDE[slug]?.[lang] ?? null;
}
