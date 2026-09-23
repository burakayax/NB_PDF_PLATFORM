import type { Language } from "../../i18n/landing";

/**
 * ARAÇ ADIMLARI — "Nasıl çalışır?" kartının metinleri.
 *
 * KURAL: Bu metinler bilgisayarla hiç ilgisi olmayan biri için yazılır.
 *  • Teknik terim yok (çözünürlük, mime, sıkıştırma algoritması vb. yok).
 *  • Her adım kullanıcının EKRANDA GÖRECEĞİ şeyi söyler ("mavi düğmeye bas").
 *  • Kısa cümle, tek iş. Üç adım kuralı: seç → ayarla → al.
 *
 * Anahtar = SEO araç slug'ı (ör. "merge-pdf"). Yeni araç eklerken buraya bir
 * kayıt ekleyin; kart hem araç sayfasında hem panelde otomatik görünür.
 */

export type HowToStep = { title: string; detail: string };
type Entry = { tr: HowToStep[]; en: HowToStep[] };

const S = (tr: HowToStep[], en: HowToStep[]): Entry => ({ tr, en });

/** Her araçta tekrar eden son adım — dosyanın nereye indiğini söyler. */
const TR_DOWNLOAD: HowToStep = {
  title: "Dosyanı indir",
  detail: "İşlem bitince yeşil bir ekran çıkar. «İndir» düğmesine bas; dosya bilgisayarına iner.",
};
const EN_DOWNLOAD: HowToStep = {
  title: "Download your file",
  detail: "A green screen appears when it's done. Click «Download» and the file is saved to your computer.",
};

const PICK_TR = (what = "PDF dosyanı"): HowToStep => ({
  title: `${what} seç`,
  detail: "«Dosya Seç» düğmesine bas ve bilgisayarından dosyayı bul. Dilersen dosyayı sürükleyip alanın üstüne bırakabilirsin.",
});
const PICK_EN = (what = "your PDF"): HowToStep => ({
  title: `Choose ${what}`,
  detail: "Click «Choose file» and find the file on your computer. You can also drag the file onto the area.",
});

export const TOOL_HOW_TO: Record<string, Entry> = {
  // ── Düzenle / organize ────────────────────────────────────────────────────
  "merge-pdf": S(
    [
      { title: "Dosyaları seç", detail: "Birleştirmek istediğin PDF'lerin hepsini seç. Bir kerede birkaç tane seçebilirsin." },
      { title: "Sırasını ayarla", detail: "Listedeki dosyaları sürükleyerek istediğin sıraya diz. Yeni belge bu sırayla oluşur." },
      TR_DOWNLOAD,
    ],
    [
      { title: "Choose your files", detail: "Select every PDF you want to join. You can pick several at once." },
      { title: "Put them in order", detail: "Drag the files in the list into the order you want. The new document follows that order." },
      EN_DOWNLOAD,
    ],
  ),
  "split-pdf": S(
    [
      PICK_TR(),
      { title: "Hangi sayfalar?", detail: "İstediğin sayfaların numaralarını yaz (örnek: 1-3, 7). Ya da sayfalara bakıp tıklayarak seç." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Which pages?", detail: "Type the page numbers you want (for example 1-3, 7), or click the pages you want in the preview." },
      EN_DOWNLOAD,
    ],
  ),
  "delete-pages": S(
    [
      PICK_TR(),
      { title: "Silinecek sayfaları seç", detail: "Çıkarmak istediğin sayfaların üstüne tıkla. Seçtiklerin işaretlenir, gerisi belgede kalır." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Pick the pages to remove", detail: "Click the pages you want gone. They get marked; everything else stays in the document." },
      EN_DOWNLOAD,
    ],
  ),
  "rotate-pdf": S(
    [
      PICK_TR(),
      { title: "Sayfaları çevir", detail: "Yan duran sayfanın üstündeki ok düğmelerine bas. Her basışta sayfa çeyrek tur döner." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Turn the pages", detail: "Use the arrow buttons on a sideways page. Each click turns it a quarter turn." },
      EN_DOWNLOAD,
    ],
  ),
  "organize-pdf": S(
    [
      PICK_TR(),
      { title: "Sayfaları yeniden diz", detail: "Yukarı-aşağı okları ile sayfayı taşı ya da kutuya kaçıncı sırada olsun istiyorsan onu yaz." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Rearrange the pages", detail: "Move a page with the up/down arrows, or type the position number you want it to have." },
      EN_DOWNLOAD,
    ],
  ),
  "pdf-kesit-al": S(
    [
      PICK_TR(),
      { title: "Sayfada bir alan seç", detail: "Almak istediğin yerin üstünde fareyi basılı tutup sürükle. Kutuyu köşelerinden büyütüp küçültebilirsin." },
      { title: "«Kesiti Ekle» düğmesine bas", detail: "Seçtiğin alan sağdaki listeye düşer. Başka sayfalardan da istediğin kadar ekleyebilirsin." },
      { title: "Nasıl kaydedileceğini seç ve indir", detail: "Sağ alttan biçimi seç: PDF (varsayılan) kesitleri tek belgede toplar, PNG ya da JPEG görsel verir. Sonra «İndir» de." },
    ],
    [
      PICK_EN(),
      { title: "Select an area on the page", detail: "Hold the mouse down and drag over the part you want. Resize the box from its corners." },
      { title: "Click «Add snip»", detail: "Your selection drops into the list on the right. Add as many as you like, from any page." },
      { title: "Pick how to save it, then download", detail: "Choose a format on the right: PDF (the default) collects the snips into one document, PNG or JPEG gives you images. Then click «Download»." },
    ],
  ),
  "pdf-duzenle": S(
    [
      PICK_TR(),
      { title: "Yazının üstüne tıkla", detail: "Değiştirmek istediğin yazıya tıkla ve yenisini yaz. Silmek için yazıyı seçip Delete tuşuna bas." },
      { title: "«Tamam» deyip indir", detail: "Düzenleme bitince «Tamam» de, sonra «PDF'i Hazırla» düğmesine bas ve dosyanı indir." },
    ],
    [
      PICK_EN(),
      { title: "Click on the text", detail: "Click the text you want to change and type the new version. To delete, select it and press Delete." },
      { title: "Click «Done», then download", detail: "When you're finished click «Done», then «Prepare PDF» and save your file." },
    ],
  ),
  "pdf-imzala": S(
    [
      PICK_TR(),
      { title: "İmzanı oluştur", detail: "İmzanı fareyle çiz, adını yaz ya da beyaz kâğıda attığın imzanın fotoğrafını yükle." },
      { title: "İmzayı yerine koy", detail: "İmzayı sürükleyerek imzalanacak yere getir, köşesinden boyutlandır. Sonra indir." },
    ],
    [
      PICK_EN(),
      { title: "Create your signature", detail: "Draw it with the mouse, type your name, or upload a photo of your signature on white paper." },
      { title: "Place it on the page", detail: "Drag the signature where it belongs and resize it from the corner. Then download." },
    ],
  ),
  "pdf-yorumla": S(
    [
      PICK_TR(),
      { title: "Bir araç seç", detail: "Üstteki çubuktan fosforlu kalem, kutu, ok ya da yazı seç; sonra sayfada sürükleyerek çiz." },
      { title: "Bitince indir", detail: "İşaretlemen bitince kaydet düğmesine bas; işaretlerin belgeye işlenmiş olarak iner." },
    ],
    [
      PICK_EN(),
      { title: "Pick a tool", detail: "Choose highlighter, box, arrow or text from the top bar, then drag on the page to draw." },
      { title: "Download when done", detail: "Press save and the file comes down with your marks baked into the document." },
    ],
  ),

  // ── Görsel araçları ───────────────────────────────────────────────────────
  "gorsel-sikistir": S(
    [
      PICK_TR("Görsellerini"),
      { title: "Ne kadar küçülsün?", detail: "«Kalite» çubuğunu sola çekersen dosya daha çok küçülür. %70 çoğu fotoğraf için iyidir." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN("your images"),
      { title: "How small?", detail: "Drag the «Quality» slider left for a smaller file. Around 70% works well for most photos." },
      EN_DOWNLOAD,
    ],
  ),
  "gorsel-boyutlandir": S(
    [
      PICK_TR("Görselini"),
      { title: "Ölçüyü seç", detail: "Listeden Instagram, Facebook gibi hazır bir ölçü seç; ya da genişlik ve yüksekliği kendin yaz." },
      { title: "«Boyutlandır» düğmesine bas", detail: "Görselin yeni ölçüsüne getirilir. Yeşil ekrandaki «İndir» ile bilgisayarına kaydet." },
    ],
    [
      PICK_EN("your image"),
      { title: "Choose the size", detail: "Pick a ready-made size like Instagram or Facebook, or type a width and height yourself." },
      { title: "Click «Resize»", detail: "Your image is set to the new size. Save it with «Download» on the green screen." },
    ],
  ),
  "image-to-pdf": S(
    [
      PICK_TR("Fotoğraflarını"),
      { title: "Sırasını ayarla", detail: "Fotoğrafları sürükleyerek istediğin sıraya diz. Her fotoğraf bir sayfa olur." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN("your photos"),
      { title: "Put them in order", detail: "Drag the photos into the order you want. Each photo becomes one page." },
      EN_DOWNLOAD,
    ],
  ),
  "pdf-to-image": S(
    [
      PICK_TR(),
      { title: "Düğmeye bas", detail: "Her sayfa ayrı bir resim dosyası olur; hepsi tek bir paket içinde gelir." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Click the button", detail: "Every page becomes its own image file, delivered together in one package." },
      EN_DOWNLOAD,
    ],
  ),
  "extract-images": S(
    [
      PICK_TR(),
      { title: "Düğmeye bas", detail: "Belgenin içindeki fotoğraf ve logolar tek tek çıkarılır; sayfanın kendisi resme çevrilmez." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Click the button", detail: "The photos and logos stored inside the document are pulled out; the page itself is not converted." },
      EN_DOWNLOAD,
    ],
  ),
  "belge-tara": S(
    [
      { title: "Kameraya izin ver", detail: "Telefonun kamerasını açar. Sorduğunda «İzin ver» de." },
      { title: "Belgeyi çerçeveye al", detail: "Kâğıdı düz bir zemine koy, telefonu üstünde tut. Pro'daysan kenarları canlı bulup kendi çeker; değilse yuvarlak düğmeye basıp çekersin." },
      { title: "Kullan, yeniden çek ya da kenarları düzelt", detail: "Çekim beğenildiyse «Kullan» de. Bulanıksa «Yeniden çek». Kenarlar yanlış bulunduysa «Kenarları düzelt» deyip mavi yuvarlakları köşelere sürükle." },
      { title: "PDF olarak kaydet", detail: "Sayfa eklemeye devam edebilir ya da bitirip PDF olarak indirebilirsin." },
    ],
    [
      { title: "Allow the camera", detail: "It opens your phone camera. Tap «Allow» when asked." },
      { title: "Frame the document", detail: "Put the paper on a flat surface and hold the phone above it. On Pro it finds the edges live and shoots by itself; otherwise tap the round button." },
      { title: "Use it, retake, or adjust the edges", detail: "Happy with it? Tap «Use this page». Blurry? «Retake». Edges wrong? Tap «Adjust edges» and drag the blue circles to the corners." },
      { title: "Save as PDF", detail: "Keep adding pages, or finish and download your PDF." },
    ],
  ),

  // ── Dönüştür ──────────────────────────────────────────────────────────────
  "pdf-to-word": S(
    [PICK_TR(), { title: "«Dönüştür» düğmesine bas", detail: "PDF'in Word belgesine çevrilir; yazıların üstünde değişiklik yapabilirsin." }, TR_DOWNLOAD],
    [PICK_EN(), { title: "Click «Convert»", detail: "Your PDF becomes a Word document you can edit." }, EN_DOWNLOAD],
  ),
  "word-to-pdf": S(
    [PICK_TR("Word belgeni"), { title: "«Dönüştür» düğmesine bas", detail: "Belgen herkeste aynı görünen bir PDF'e çevrilir." }, TR_DOWNLOAD],
    [PICK_EN("your Word file"), { title: "Click «Convert»", detail: "Your document becomes a PDF that looks the same for everyone." }, EN_DOWNLOAD],
  ),
  "excel-to-pdf": S(
    [PICK_TR("Excel dosyanı"), { title: "«Dönüştür» düğmesine bas", detail: "Tablon PDF'e çevrilir; sayfa düzeni bozulmadan paylaşabilirsin." }, TR_DOWNLOAD],
    [PICK_EN("your Excel file"), { title: "Click «Convert»", detail: "Your sheet becomes a PDF you can share without the layout breaking." }, EN_DOWNLOAD],
  ),
  "pdf-to-excel": S(
    [PICK_TR(), { title: "«Dönüştür» düğmesine bas", detail: "Belgedeki tablolar Excel dosyasına aktarılır; hücrelerde hesap yapabilirsin." }, TR_DOWNLOAD],
    [PICK_EN(), { title: "Click «Convert»", detail: "Tables in the document are moved into an Excel file you can calculate with." }, EN_DOWNLOAD],
  ),
  "pdf-to-ppt": S(
    [PICK_TR(), { title: "«Dönüştür» düğmesine bas", detail: "Her sayfa bir sunum slaydına dönüşür." }, TR_DOWNLOAD],
    [PICK_EN(), { title: "Click «Convert»", detail: "Each page becomes a presentation slide." }, EN_DOWNLOAD],
  ),
  "ppt-to-pdf": S(
    [PICK_TR("Sunum dosyanı"), { title: "«Dönüştür» düğmesine bas", detail: "Slaytların PDF sayfalarına çevrilir; yazı tipi kayması olmaz." }, TR_DOWNLOAD],
    [PICK_EN("your presentation"), { title: "Click «Convert»", detail: "Your slides become PDF pages with no font surprises." }, EN_DOWNLOAD],
  ),
  "pdf-to-text": S(
    [PICK_TR(), { title: "«Dönüştür» düğmesine bas", detail: "Belgedeki bütün yazılar düz bir metin dosyasına alınır; resimler ve düzen gelmez." }, TR_DOWNLOAD],
    [PICK_EN(), { title: "Click «Convert»", detail: "All the words are pulled into a plain text file; images and layout are left out." }, EN_DOWNLOAD],
  ),
  "html-to-pdf": S(
    [
      { title: "Adresi yapıştır", detail: "PDF'e çevirmek istediğin internet sayfasının adresini kutuya yapıştır." },
      { title: "«Dönüştür» düğmesine bas", detail: "Sayfa açılıp olduğu gibi PDF'e alınır." },
      TR_DOWNLOAD,
    ],
    [
      { title: "Paste the address", detail: "Paste the address of the web page you want as a PDF." },
      { title: "Click «Convert»", detail: "The page is opened and captured into a PDF as it looks." },
      EN_DOWNLOAD,
    ],
  ),

  // ── İyileştir ─────────────────────────────────────────────────────────────
  "compress": S(
    [
      PICK_TR(),
      { title: "Ne kadar küçülsün?", detail: "Orta seçenek çoğu belge için yeterlidir: e-postaya sığar, okunurluk bozulmaz." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "How small?", detail: "The middle option suits most documents: small enough to email, still easy to read." },
      EN_DOWNLOAD,
    ],
  ),
  "repair-pdf": S(
    [
      PICK_TR("Açılmayan PDF'ini"),
      { title: "«Onar» düğmesine bas", detail: "Bozulan kısımlar elden geçirilir ve belge yeniden açılabilir hale getirilir." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN("the PDF that won't open"),
      { title: "Click «Repair»", detail: "The broken parts are rebuilt so the document opens again." },
      EN_DOWNLOAD,
    ],
  ),
  "imza-iste": S(
    [
      PICK_TR(),
      { title: "İmzalayacak kişiyi yaz", detail: "E-posta adresini gir, istersen kısa bir not ekle; o kişiye yalnız kendisi için üretilmiş bir bağlantı gider." },
      { title: "İmzayı bekle", detail: "Listede belgenin görüntülendiğini ve imzalandığını takip edersin; imzalanınca e-posta gelir." },
      { title: "İmzalı belgeyi indir", detail: "Belgenin sonuna imzalama sürecinin zaman damgalı kaydı (denetim sertifikası) eklenir." },
    ],
    [
      PICK_EN(),
      { title: "Enter the signer", detail: "Type their email and optionally a short note; they receive a link generated only for them." },
      { title: "Track the signature", detail: "The list shows when the document was viewed and signed, and you get an email once it is done." },
      { title: "Download the signed file", detail: "A timestamped record of the signing process (audit certificate) is appended to the document." },
    ],
  ),
  "sayfa-duzeni": S(
    [
      PICK_TR(),
      { title: "Kipi seç", detail: "«Yaprağa sığdır» birden çok sayfayı tek kâğıda koyar; «Kitapçık» katlanınca sırayla okunan düzen üretir." },
      { title: "Ayarını yap", detail: "Yaprağa kaç sayfa gireceğini seç; istersen her sayfanın çevresine ince çerçeve çizdir." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Pick a mode", detail: "«Fit on sheet» puts several pages on one sheet; «Booklet» produces a foldable, in-order layout." },
      { title: "Set it up", detail: "Choose how many pages go on a sheet, and optionally draw a thin frame around each page." },
      EN_DOWNLOAD,
    ],
  ),
  "pdf-to-pdfa": S(
    [
      PICK_TR(),
      { title: "Uyumluluk düzeyini seç", detail: "Çoğu kurum için PDF/A-2b uygundur; kurum başka bir düzey istiyorsa onu seç." },
      { title: "«Arşive çevir» de", detail: "Yazı tipleri belgenin içine gömülür, renkler standart hale getirilir, dış bağlantılar kaldırılır." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Pick the conformance level", detail: "PDF/A-2b suits most institutions; choose another level only if yours asks for it." },
      { title: "Click «Convert»", detail: "Fonts are embedded in the file, colours are standardised and external dependencies are removed." },
      EN_DOWNLOAD,
    ],
  ),
  "ustveri-temizle": S(
    [
      PICK_TR(),
      { title: "Ne taşıdığını gör", detail: "Belgedeki yazar adı, üreten program, tarihler, XMP bloğu ve fotoğrafların EXIF/GPS bilgisi listelenir." },
      { title: "«Üstveriyi temizle» de", detail: "Tüm bu izler silinir; istersen gömülü fotoğrafların konum bilgisi de temizlenir." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "See what it carries", detail: "Author name, producing software, dates, the XMP block and photo EXIF/GPS data are listed." },
      { title: "Click «Remove metadata»", detail: "All of those traces are stripped, including GPS data in embedded photos if you want." },
      EN_DOWNLOAD,
    ],
  ),
  "form-doldur": S(
    [
      PICK_TR(),
      { title: "Alanları doldur", detail: "Formun doldurulabilir alanları otomatik bulunup listelenir; her birini yazıp seçersin." },
      { title: "İstersen kilitle", detail: "«Doldurduktan sonra kilitle» açıkken alanlar kalıcı içeriğe dönüşür; karşı taraf yazdıklarını değiştiremez." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Fill the fields", detail: "The form's fillable fields are detected and listed for you; type or pick a value for each." },
      { title: "Lock it if you want", detail: "With «Lock after filling» on, fields become permanent content so the recipient cannot change them." },
      EN_DOWNLOAD,
    ],
  ),
  "flatten-pdf": S(
    [
      PICK_TR(),
      { title: "«Düzleştir» düğmesine bas", detail: "Form kutuları ve notlar sayfanın bir parçası olur; artık kimse üstünde oynayamaz." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Click «Flatten»", detail: "Form boxes and notes become part of the page, so nobody can change them." },
      EN_DOWNLOAD,
    ],
  ),
  "aranabilir-pdf": S(
    [
      PICK_TR("Taranmış PDF'ini"),
      { title: "«Başlat» düğmesine bas", detail: "Sayfadaki yazılar tanınır. Biraz sürebilir, bekle." },
      { title: "Artık arayabilirsin", detail: "İnen dosyada Ctrl+F ile kelime aratabilir, yazıyı kopyalayabilirsin." },
    ],
    [
      PICK_EN("your scanned PDF"),
      { title: "Click «Start»", detail: "The words on the page are recognised. It can take a moment — wait for it." },
      { title: "Now it's searchable", detail: "In the file you download you can search with Ctrl+F and copy the text." },
    ],
  ),
  "taranmis-pdf-ocr": S(
    [
      PICK_TR("Taranmış belgeni"),
      { title: "«Başlat» düğmesine bas", detail: "Fotoğraf gibi duran sayfalardaki yazılar okunup metne çevrilir." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN("your scanned file"),
      { title: "Click «Start»", detail: "The words on the picture-like pages are read and turned into text." },
      EN_DOWNLOAD,
    ],
  ),

  // ── Güvenlik ──────────────────────────────────────────────────────────────
  "unlock-pdf": S(
    [
      PICK_TR("Şifreli PDF'ini"),
      { title: "Parolayı yaz", detail: "Belgeyi açarken kullandığın parolayı kutuya yaz. Parolayı bilmiyorsan bu araç işe yaramaz." },
      { title: "Parolasız halini indir", detail: "İnen dosya her açılışta parola sormaz." },
    ],
    [
      PICK_EN("your locked PDF"),
      { title: "Type the password", detail: "Enter the password you use to open it. Without the password this tool can't help." },
      { title: "Download the open copy", detail: "The file you get no longer asks for a password." },
    ],
  ),
  "encrypt": S(
    [
      PICK_TR(),
      { title: "Bir parola belirle", detail: "Belgeyi açacak kişinin gireceği parolayı yaz. Parolayı unutma — geri almanın yolu yok." },
      { title: "Kilitli halini indir", detail: "Artık belge parola girilmeden açılmaz." },
    ],
    [
      PICK_EN(),
      { title: "Set a password", detail: "Type the password people will need to open it. Don't forget it — there is no way back." },
      { title: "Download the locked file", detail: "The document can no longer be opened without the password." },
    ],
  ),
  "watermark": S(
    [
      PICK_TR(),
      { title: "Yazıyı ve rengini seç", detail: "«TASLAK», «GİZLİ» gibi bir yazı gir; rengini ve yazı tipini seç. Yazı her sayfaya açık renkli basılır." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Choose the text and colour", detail: "Type something like «DRAFT» or «CONFIDENTIAL» and pick a colour. It is printed faintly on every page." },
      EN_DOWNLOAD,
    ],
  ),
  "page-numbers": S(
    [
      PICK_TR(),
      { title: "Numaralar nereye gelsin?", detail: "Alt orta, sağ üst gibi bir yer seç. Kaçtan başlasın istiyorsan onu da yazabilirsin." },
      TR_DOWNLOAD,
    ],
    [
      PICK_EN(),
      { title: "Where should numbers go?", detail: "Pick a spot like bottom centre or top right. You can also set which number to start from." },
      EN_DOWNLOAD,
    ],
  ),
  "hassas-veri-gizle": S(
    [
      PICK_TR(),
      { title: "Gizlenecekleri seç", detail: "TC kimlik, telefon, IBAN gibi bilgiler otomatik bulunur. Listeden gizlemek istediklerini işaretle." },
      { title: "Karartılmış halini indir", detail: "Seçtiğin bilgiler belgeden tamamen çıkarılır; üstü boyanmış gibi değil, gerçekten silinir." },
    ],
    [
      PICK_EN(),
      { title: "Pick what to hide", detail: "ID numbers, phone numbers and bank details are found for you. Tick the ones to hide." },
      { title: "Download the redacted file", detail: "The selected details are removed for good — not just painted over." },
    ],
  ),

  "udf-to-pdf": S(
    [
      {
        title: "UDF dosyanı seç",
        detail:
          "UYAP'tan indirdiğin, sonu «.udf» ile biten dosyayı seç. Birkaç dosyayı aynı anda da bırakabilirsin.",
      },
      {
        title: "«PDF'e çevir» düğmesine bas",
        detail:
          "Belge bilgisayarının içinde çözülür; yazılar, tablolar ve varsa resimler olduğu gibi aktarılır.",
      },
      TR_DOWNLOAD,
    ],
    [
      {
        title: "Choose your UDF file",
        detail:
          "Pick the file ending in «.udf» that you downloaded from UYAP. You can drop several files at once.",
      },
      {
        title: "Click «Convert to PDF»",
        detail:
          "The document is decoded on your own computer; text, tables and any images carry over as they are.",
      },
      EN_DOWNLOAD,
    ],
  ),

  // ── Yapay zekâ ────────────────────────────────────────────────────────────
  "pdf-ozetle": S(
    [
      PICK_TR(),
      { title: "«Özetle» düğmesine bas", detail: "Belge okunur ve ana noktaları kısa maddeler halinde çıkarılır." },
      { title: "Özeti oku ya da kopyala", detail: "Beğendiğin özeti kopyalayıp e-postaya, nota yapıştırabilirsin." },
    ],
    [
      PICK_EN(),
      { title: "Click «Summarize»", detail: "The document is read and its main points are listed in short bullets." },
      { title: "Read it or copy it", detail: "Copy the summary into an email or your notes." },
    ],
  ),
  "pdf-sohbet": S(
    [
      PICK_TR(),
      { title: "Sorunu yaz", detail: "«Bu sözleşmede ceza maddesi var mı?» gibi normal bir cümleyle sor." },
      { title: "Cevabı oku", detail: "Cevap, belgenin içindeki bilgiye dayanır. İstediğin kadar soru sorabilirsin." },
    ],
    [
      PICK_EN(),
      { title: "Type your question", detail: "Ask in a normal sentence, like «Does this contract have a penalty clause?»." },
      { title: "Read the answer", detail: "The answer comes from what's inside the document. Ask as many questions as you like." },
    ],
  ),
  "pdf-veri-cikar": S(
    [
      PICK_TR(),
      { title: "Ne arıyorsun, söyle", detail: "«Fatura numarası, tarih, tutar» gibi istediğin bilgileri yaz." },
      { title: "Tablo olarak al", detail: "Bulunan bilgiler düzenli bir tabloya dizilir; Excel'e aktarabilirsin." },
    ],
    [
      PICK_EN(),
      { title: "Say what you need", detail: "Type the details you want, like «invoice number, date, total»." },
      { title: "Get it as a table", detail: "What's found is arranged into a tidy table you can move into Excel." },
    ],
  ),
  "pdf-ceviri": S(
    [
      PICK_TR(),
      { title: "Dili seç", detail: "Belgenin hangi dile çevrilmesini istediğini seç." },
      { title: "Çeviriyi al", detail: "Metin çevrilir; okuyup kopyalayabilir ya da dosya olarak indirebilirsin." },
    ],
    [
      PICK_EN(),
      { title: "Choose the language", detail: "Pick the language you want the document translated into." },
      { title: "Get the translation", detail: "The text is translated — read it, copy it, or download it as a file." },
    ],
  ),
  "pdf-karsilastir": S(
    [
      { title: "İki dosyayı da seç", detail: "Eski ve yeni belgeyi ayrı ayrı yükle." },
      { title: "«Karşılaştır» düğmesine bas", detail: "İki belge satır satır okunur." },
      { title: "Farkları gör", detail: "Eklenen, çıkarılan ve değişen yerler renkli olarak işaretlenir." },
    ],
    [
      { title: "Add both files", detail: "Upload the old and the new document separately." },
      { title: "Click «Compare»", detail: "The two documents are read line by line." },
      { title: "See the differences", detail: "What was added, removed or changed is highlighted in colour." },
    ],
  ),
  "ai-toplu-islem": S(
    [
      PICK_TR("Belgelerini"),
      { title: "Ne yapılsın, seç", detail: "Özetleme, veri çıkarma gibi bir iş seç. Aynı iş bütün dosyalara uygulanır." },
      { title: "Sonuçları al", detail: "Her dosyanın sonucu tek tek listelenir; hepsini birden indirebilirsin." },
    ],
    [
      PICK_EN("your documents"),
      { title: "Choose what to do", detail: "Pick a job like summarizing or extracting data. It runs on every file." },
      { title: "Collect the results", detail: "Each file's result is listed, and you can download them all at once." },
    ],
  ),
};

/** Aracın adımlarını dile göre verir; kayıt yoksa null. */
export function howToForTool(slug: string, language: Language): HowToStep[] | null {
  const entry = TOOL_HOW_TO[slug];
  if (!entry) return null;
  return language === "en" ? entry.en : entry.tr;
}
