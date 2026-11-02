/**
 * Araç videolarının açıklamalarındaki "bu araç NE İŞE YARAR" metni.
 *
 * Başlık + özet aracın adını söylüyor ama çoğu kişi "OCR ne?", "düzleştirmek ne demek?" diye soruyor.
 * Burada her araç için günlük hayattan, kısa ve doğrulanmış bir açıklama var: ne zaman gerekir, ne elde edilir.
 * Gizlilik iddiası YOK (o, kataloğun özetinde ve `onDeviceTools.ts` ile uyumlu); burada yalnız aracın işlevi anlatılır.
 * Her katalog satırının bir karşılığı olmalı (test bunu denetler). Uydurma iddia ekleme.
 */

export type ToolReelAbout = { tr: string; en: string };

export const TOOL_REEL_ABOUT: Record<string, ToolReelAbout> = {
  compress: {
    tr: "E-postaya, e-Devlet'e ya da bir başvuru formuna yüklerken “dosya çok büyük” hatası mı alıyorsun? PDF Sıkıştır, belgeyi gönderilebilir boyuta indirir. Hedef bir boyut belirleyebilir ya da kaliteyi kendin seçebilirsin.",
    en: "Getting a “file too large” error when you email a PDF or upload it to a form? Compress PDF brings the document down to a size you can send. Set a target size or choose the quality yourself.",
  },
  merge: {
    tr: "Fatura, sayfa, ek belge… elindeki birkaç PDF'i tek dosyada toplamak istediğinde işine yarar. Dosyaları sürükleyip istediğin sıraya dizersin; sonuç tek bir PDF olur. Başvuru ve ek belge göndermek için idealdir.",
    en: "Handy when you have several PDFs — invoices, pages, attachments — and want one file. Drag the files into the order you want and get a single PDF. Ideal for applications and sending supporting documents.",
  },
  "cv-olustur": {
    tr: "Sıfırdan CV tasarlamakla uğraşma: şablonu seç, bilgilerini gir, CV'n yanında canlı şekillensin. ATS röntgeni, başvuru sistemlerinin CV'ni okuyup okuyamayacağını gösterir. Sonuç PDF olarak iner, iş başvurusuna hazırdır.",
    en: "Skip designing a CV from scratch: pick a template, enter your details and watch it take shape live. The ATS X-ray shows whether recruiting systems can read your CV. It downloads as a PDF, ready for job applications.",
  },
  "grayscale-pdf": {
    tr: "Renkli bir belgeyi siyah-beyaza çevirir. Yazıcıda renkli mürekkep harcamamak, belgeyi sadeleştirmek ya da fotokopi gibi görünmesini istemek için kullanılır. Metin seçilebilir kalır.",
    en: "Turns a colour document black-and-white. Use it to save colour ink when printing, to simplify a document, or to get a photocopy look. The text stays selectable.",
  },
  "flatten-pdf": {
    tr: "Doldurulmuş formdaki alanlar ve notlar hâlâ değiştirilebilir durumdadır. Düzleştirme bunları sayfanın üzerine sabitler: gönderdiğin belge karşı tarafta kaymaz, bozulmaz, içindeki cevaplar tek tıkla silinemez.",
    en: "Fields and annotations in a filled-in form can still be changed. Flattening fixes them onto the page, so the document you send looks the same for the recipient and its answers can't be edited with a click.",
  },
  "pdf-to-word": {
    tr: "Elindeki PDF'te bir şeyi değiştirmen gerekiyorsa en kolay yol onu Word'e çevirmektir. Sonuç Word'de açılıp düzenlenebilen bir belge olur: metni düzeltir, ekleme yapar, sonra yeniden PDF alabilirsin.",
    en: "If you need to change something in a PDF, the easiest way is to turn it into Word. The result opens in Word as an editable document: fix the text, add to it, and save it as a PDF again.",
  },
  "pdf-to-excel": {
    tr: "PDF içindeki tabloyu elle Excel'e yazmak yerine aktar. Rakamlar hücrelere gelir; toplayabilir, sıralayabilir, formül yazabilirsin. Rapor, ekstre ve fiyat listesi gibi tablolu belgelerde işe yarar.",
    en: "Instead of retyping a table from a PDF into Excel, move it over. The numbers land in cells, so you can add, sort and use formulas. Useful for reports, statements and price lists.",
  },
  "pdf-to-ppt": {
    tr: "Elinde yalnızca PDF olan bir sunumu yeniden düzenlemek istiyorsan, sayfaları PowerPoint slaytlarına çevir. Slaytlar PowerPoint'te açılır ve değiştirilebilir; sıfırdan hazırlamak zorunda kalmazsın.",
    en: "If you only have a presentation as a PDF and want to rework it, turn the pages into PowerPoint slides. They open in PowerPoint and can be edited, so you don't have to rebuild the deck.",
  },
  "word-to-pdf": {
    tr: "Word dosyası açan kişinin bilgisayarına, yazı tiplerine ve sürümüne göre kayabilir. PDF her yerde aynı görünür. Özgeçmiş, dilekçe ya da sözleşme göndermeden önce Word belgeni PDF'e çevir.",
    en: "A Word file can shift depending on the recipient's computer, fonts and version. A PDF looks the same everywhere. Convert your Word document before sending a CV, a letter or a contract.",
  },
  "excel-to-pdf": {
    tr: "Excel tablosunu başkasına gönderirken sütunların kayması ya da hücrelerin değiştirilmesi sorun olabilir. PDF'e çevirince tablo olduğu gibi görünür ve kolayca paylaşılır; teklif, rapor ve listeler için uygundur.",
    en: "When you send an Excel sheet, columns can shift and cells can be changed. As a PDF the table looks as it should and is easy to share — good for quotes, reports and lists.",
  },
  "ppt-to-pdf": {
    tr: "Sunum dosyası başka bilgisayarda yazı tipi ya da düzen değiştirebilir. PDF yapınca slaytlar her cihazda aynı görünür; sunum öncesi göndermek ya da çıktı almak için kullanışlıdır.",
    en: "A presentation file can change fonts or layout on another computer. As a PDF the slides look the same on every device — handy for sending ahead of a talk or printing.",
  },
  "pdf-to-text": {
    tr: "Bir belgenin yalnızca yazısına ihtiyacın varsa onu düz metin olarak alırsın: kopyalayıp başka yere yapıştırabilir, notlarına ekleyebilir ya da bir düzenleyicide kullanabilirsin. Tablo, görsel ve düzen gelmez; sadece yazı gelir.",
    en: "If you only need the words of a document, get them as plain text: copy and paste them elsewhere, add them to your notes or use them in an editor. Tables, images and layout don't come along — just the text.",
  },
  "pdf-to-pdfa": {
    tr: "Bazı kurumlar belgeyi uzun süre saklanabilecek arşiv biçiminde (PDF/A) ister. Bu araç belgeni o biçime çevirir; yazı tipleri dosyanın içine gömülür, böylece belge yıllar sonra da aynı görünür.",
    en: "Some institutions ask for documents in a long-term archival format (PDF/A). This tool converts yours; the fonts are embedded in the file, so it still looks the same years later.",
  },
  "deskew-pdf": {
    tr: "Telefonla ya da tarayıcıyla çekilen sayfalar çoğu zaman hafif eğri çıkar. Bu araç eğri sayfaları düzeltip düz hâle getirir; belge daha okunaklı ve profesyonel görünür. Zaten yazı katmanı olan sayfalara dokunmaz.",
    en: "Pages shot with a phone or scanner often come out slightly crooked. This tool straightens them so the document is easier to read and looks more professional. Pages that already have a text layer are left alone.",
  },
  "repair-pdf": {
    tr: "“Dosya bozuk” ya da “açılamıyor” hatası veren PDF'i kurtarmayı dener. İndirme yarıda kesildiğinde ya da dosya zarar gördüğünde işe yarar; kurtarılabilen sayfalar yeni bir dosyada toplanır.",
    en: "Tries to rescue a PDF that says “file is damaged” or won't open. Useful when a download was cut off or a file got corrupted; whatever can be recovered is collected in a new file.",
  },
  "extract-images": {
    tr: "Bir PDF'in içindeki fotoğrafları tek tek ekran görüntüsü alarak kaydetmene gerek yok. Belgedeki tüm görseller ayrı dosyalar olarak çıkarılır ve ZIP içinde iner; sunum, tasarım ya da arşiv için kullanabilirsin.",
    en: "No need to screenshot pictures out of a PDF one by one. Every image in the document is extracted as its own file and downloaded in a ZIP — use them in presentations, designs or archives.",
  },
  "resize-pdf": {
    tr: "Sayfa boyutu uymayan bir belgeyi A4, A5 ya da Letter gibi standart bir ölçüye getirir. Yazıcıya göndermeden ya da bir kurumun istediği ölçüye uydurmadan önce kullanışlıdır; özel ölçü de girebilirsin.",
    en: "Brings a document with the wrong page size to a standard one like A4, A5 or Letter. Useful before printing or when an institution asks for a specific size; you can also enter a custom size.",
  },
  "flip-pdf": {
    tr: "Sayfaları yatay ya da dikey olarak ayna gibi çevirir. Ters taranmış ya da ters çıkmış bir belgeyi düzeltmek veya ayna görüntüsü gereken bir baskı için kullanılır.",
    en: "Mirrors pages horizontally or vertically. Use it to fix a document that was scanned or exported the wrong way round, or for a print that needs a mirror image.",
  },
  encrypt: {
    tr: "Kimlik, sözleşme ya da maaş bordrosu gibi gizli bir belgeyi göndermeden önce parolayla korursun; parolayı bilmeyen açamaz. İstersen yazdırma ve kopyalama gibi izinleri de sınırlayabilirsin.",
    en: "Before sending something private — an ID, a contract, a payslip — protect it with a password; only someone who knows it can open the file. You can also limit permissions such as printing and copying.",
  },
  "unlock-pdf": {
    tr: "Parolasını bildiğin ama her açışta şifre girmek zorunda kaldığın bir belgenin şifresini kaldırır. Yalnızca kendi belgelerin için kullan; sonuç şifresiz, rahat açılan bir PDF olur.",
    en: "Removes the password from a document you know the password for but are tired of typing every time. Use it only for your own files; the result is a PDF that opens without a password.",
  },
  "pdf-to-image": {
    tr: "PDF'in her sayfasını ayrı bir fotoğraf (görsel) olarak kaydeder. Bir sayfayı sosyal medyada paylaşmak, sunuma koymak ya da PDF açamayan bir yere görsel olarak yüklemek için kullanılır.",
    en: "Saves each page of a PDF as its own picture. Use it to share a page on social media, drop it into a presentation, or upload it somewhere that doesn't accept PDFs.",
  },
  "image-to-pdf": {
    tr: "Telefonla çektiğin fotoğrafları ya da görselleri tek bir PDF'e çevirir. Sıralarını belirlersin; başvuru için belge fotoğraflarını, makbuzları ya da notları tek dosyada göndermek için idealdir.",
    en: "Turns photos or images from your phone into a single PDF. You set the order — ideal for sending document photos, receipts or notes for an application in one file.",
  },
  "alternate-mix-pdf": {
    tr: "Çift taraflı tararken ön yüzler bir dosya, arka yüzler başka bir dosya olarak çıkar. Bu araç iki PDF'in sayfalarını sırayla birleştirir: 1. dosyadan bir, 2. dosyadan bir sayfa… Böylece belge doğru sayfa sırasına girer.",
    en: "When scanning double-sided, the fronts come out as one file and the backs as another. This tool interleaves the pages of the two PDFs — one from the first, one from the second — so the document ends up in the right order.",
  },
  "gorsel-sikistir": {
    tr: "Fotoğraf başvuru formuna ya da e-postaya yüklenemeyecek kadar büyükse boyutunu küçültür. Kaliteyi kendin ayarlarsın; ölçüyü küçültüp dosyayı hafifletebilirsin.",
    en: "If a photo is too big to upload to a form or attach to an email, this makes it smaller. You set the quality, and you can reduce the dimensions to make the file lighter.",
  },
  "gorsel-boyutlandir": {
    tr: "Bir fotoğrafı Instagram gönderisi, vesikalık ya da vize gibi istenen ölçüye getirir. Hazır ölçülerden seçebilir ya da genişlik ve yüksekliği kendin yazabilirsin.",
    en: "Resizes a photo to the size you need — an Instagram post, an ID photo, a visa photo. Pick a preset or type the width and height yourself.",
  },
  "udf-to-pdf": {
    tr: "UYAP'tan indirdiğin .udf uzantılı belge (dilekçe, karar, tebligat gibi) yalnızca özel bir programla açılır. Bu araç onu program kurmadan herkesin açabildiği PDF'e çevirir; kaydedebilir, yazdırabilir ve paylaşabilirsin.",
    en: "A .udf document from UYAP (a petition, a decision, a notice) normally needs special software to open. This tool turns it into a PDF anyone can open — without installing anything — so you can save, print and share it.",
  },
  "html-to-pdf": {
    tr: "Bir web sayfasını (makale, fatura, rezervasyon onayı) olduğu gibi PDF'e çevirir. Adresi yazarsın, sayfa PDF olur; çevrimdışı okumak, arşivlemek ya da kanıt olarak saklamak için kullanışlıdır.",
    en: "Turns a web page — an article, an invoice, a booking confirmation — into a PDF as it looks. Type the address and the page becomes a PDF; useful for reading offline, archiving or keeping as a record.",
  },
  "ustveri-temizle": {
    tr: "PDF'ler görünmeyen bilgiler taşır: yazarın adı, belgeyi hazırlayan program, tarihler, fotoğrafların çekildiği konum… Belgeyi paylaşmadan önce bu izleri silersin; ne taşıdığını da önceden görebilirsin.",
    en: "PDFs carry hidden details: the author's name, the program that made it, dates, the location photos were taken. Remove these traces before you share a document, and see in advance what it contains.",
  },
  "form-doldur": {
    tr: "Çıktı alıp elle doldurmak yerine, doldurulabilir PDF formunu bilgisayarında doldurursun. Araç form alanlarını kendisi bulur; adını, e-postanı, telefonunu yazar, onay kutularını işaretlersin. Sonra doldurulmuş PDF'i indirirsin.",
    en: "Instead of printing a form and filling it by hand, fill the PDF on your computer. The tool finds the form fields itself; type your name, email and phone and tick the boxes, then download the filled-in PDF.",
  },
  "taranmis-pdf-ocr": {
    tr: "Taranmış bir belge ya da telefonla çekilmiş sayfa aslında bir fotoğraftır: içindeki yazı seçilemez, kopyalanamaz, aranamaz. OCR (optik karakter tanıma) sayfadaki yazıyı okuyup görünmez bir metin katmanı ekler. Sonuçta Ctrl+F ile kelime arayabildiğin, metni kopyalayabildiğin bir PDF elde edersin.",
    en: "A scanned document or a photographed page is really just a picture: its text can't be selected, copied or searched. OCR (optical character recognition) reads the writing on the page and adds an invisible text layer. You end up with a PDF where you can search words with Ctrl+F and copy the text.",
  },
  "aranabilir-pdf": {
    tr: "Taranmış belgede bir kelimeyi bulmak için sayfaları tek tek gezmen gerekir. Bu araç, belgeyi aranabilir hâle getirir: Ctrl+F ile istediğin kelimeyi bulursun, metni kopyalayabilirsin. Uzun sözleşme, tutanak ve eski arşivler için çok işe yarar.",
    en: "In a scanned document you have to flip through pages to find a word. This tool makes the document searchable: find any word with Ctrl+F and copy the text. A big help with long contracts, minutes and old archives.",
  },
};
