// ────────────────────────────────────────────────────────────────────────
// PDF YATAY YAP REHBERLERİ — «PDF Yatay Yap» aracını anlatan üç yazı. Yalnızca
// aracın GERÇEK özelliklerine dayanır (içerik yeniden yazılmaz/OCR yok; yan yana
// düzende kesilen sayfanın metni dosyada iki parça olur). TR ve EN metinler ayrı
// yazılmıştır (çeviri değil). Kurum/başvuru kabul koşulları hakkında kesin iddia yok.
// ────────────────────────────────────────────────────────────────────────

const post = (meta, tr, en) => ({ ...meta, tr, en });

import { YATAY_EN_SLUGS } from "./blogSlugTables.mjs";
export { YATAY_EN_SLUGS };

export const YATAY_POSTS = [
  post(
    {
      slug: "pdf-yatay-yapma-dikey-pdf-yatay-sayfa",
      date: "2026-11-17",
      updated: "2026-11-17",
      readMinutes: 5,
      tags: { tr: ["PDF Yatay Yap", "Sayfa Yönü", "PDF Araçları"], en: ["PDF to Landscape", "Page Orientation", "PDF Tools"] },
      accent: "amber",
      tool: "/tools/pdf-yatay-yap",
    },
    {
      title: "PDF'i Yatay Yapma: Döndürmek Yetmediğinde",
      description:
        "Dikey PDF'i yatay yapmanın iki yolu: sayfayı döndürmek ve içeriği yatay sayfaya yerleştirmek. Farkları, hangisinin ne zaman işe yaradığı ve kontrol listesi.",
      excerpt:
        "PDF'i yatay yap dediğinizde çoğu araç sayfayı 90° çevirir ve yazı yan yatar. İçeriği yatay sayfaya gerçekten yerleştirmek için neler yapabilirsiniz?",
      blocks: [
        { t: "lead", x: "«PDF'i yatay yap» diye aratıp bulduğunuz araçların çoğu aslında sayfayı 90° döndürür. Sayfa hâlâ dikeydir; yalnızca yazı yan yatmıştır ve okumak için ekranı ya da başınızı eğmeniz gerekir. İçeriği gerçekten yatay bir sayfaya yerleştirmek ise başka bir iştir." },
        { t: "h2", x: "Döndürmek ile yatay sayfaya yerleştirmek aynı şey değil" },
        { t: "p", x: "Döndürme, sayfanın kendisini çevirir: kâğıt aynı kalır, içerik onunla birlikte yan döner. Yatay sayfaya yerleştirmede ise sayfa boyutu değişir. Yeni sayfa geniştir, yazılar normal yönde okunur ve içerik bu geniş alana oturur. Dikey bir A4'ün içeriğini yatay A4'e almak, sayfayı yan yatırmaktan farklı bir sonuç verir." },
        { t: "h2", x: "Hangi durumda hangisi?" },
        { t: "ul", items: [
          "Sayfanın içeriği zaten yan yazılmışsa (taramada dönük girmiş, tablo yan basılmış): döndürmek yeterlidir.",
          "İçerik normal yönde ama geniş bir tablo ya da düzen dikey sayfada küçük kalıyorsa: yatay sayfaya yerleştirmek daha okunur sonuç verir.",
          "Metin dolu çok sayfalı bir belgeyi yatay ekranda ya da projeksiyonda okuyacaksanız: içeriğin iki sütuna akması rahat okuma sağlar.",
          "Zaten yatay sayfalarla dikeyler karışıksa: yalnızca dikeyleri dönüştürmek gerekir.",
        ] },
        { t: "h2", x: "Adım adım: içeriği yatay sayfaya yerleştirmek" },
        { t: "steps", items: [
          { title: "PDF'i ekleyin", x: "Dikey PDF'i araca bırakın. Parolalıysa parolayı girin." },
          { title: "Yerleşimi seçin", x: "«Otomatik» çoğu belgede uygundur. «Yan yana» içeriği iki sütuna akıtır; «Sığdır» her sayfayı tek parça olarak yatay sayfaya yerleştirir." },
          { title: "Yatay Yap'a basın", x: "Yazı, tablo ve görseller yeniden yazılmaz; sayfanın kendisi yeni sayfaya taşınır." },
          { title: "Önizleyin ve indirin", x: "Sonucu gözden geçirin, uygunsa indirin." },
        ] },
        { t: "cta", title: "PDF Yatay Yap", x: "Dikey PDF'inizi içeriği bozmadan yatay sayfaya yerleştirin.", btn: "Aracı aç", tool: "/tools/pdf-yatay-yap" },
        { t: "h2", x: "Rakam ve harfler değişir mi?" },
        { t: "p", x: "Bu araç yazıyı okuyup yeniden üretmez; OCR ya da yapay zekâ kullanmaz. Sayfanın içeriği olduğu gibi taşınır, yalnızca konum ve ölçek değişir. Bu yüzden tablodaki bir rakamın yanlış yazılması ya da bir satırın düşmesi gibi bir risk yoktur. Yine de önemli bir belgede çıktıyı özgün dosyayla göz ucuyla karşılaştırmak iyi bir alışkanlıktır." },
        { t: "h2", x: "Dönüştürdükten sonra kontrol listesi" },
        { t: "ul", items: [
          "Sayfa sırası doğru mu, bölünen bir tablonun devamı sonraki sütunda mı?",
          "Yazı boyutu okunur mu? Küçültme gerektiren sayfalarda yazı küçülür.",
          "Form alanları ve bağlantılar çalışıyor mu?",
          "Taranmış bir belgeyse resmin kendi netliği değişmez; bulanık tarama bu işlemle netleşmez.",
        ] },
        { t: "tip", x: "Yan yana düzende bir sayfa iki sütuna bölünürse, o sayfanın metni dosyada iki parça olarak bulunur. Ekranda tek görünür; ama arama ya da kopyalamada o sayfanın kelimeleri çift çıkabilir." },
      ],
      faq: [
        { q: "PDF'i yatay yapmak ile döndürmek arasındaki fark nedir?", a: "Döndürme sayfayı yan yatırır, sayfa dikey kalır. Yatay yapmada içerik yatay bir sayfaya yerleşir ve yazı normal yönde okunur." },
        { q: "Yazıda ya da rakamlarda değişiklik olur mu?", a: "Hayır. İçerik yeniden yazılmaz; sayfa olduğu gibi taşınır." },
        { q: "Taranmış PDF'lerde çalışır mı?", a: "Evet. Taranmış sayfalar da yerleştirilir; resmin çözünürlüğü değişmez." },
        { q: "Zaten yatay olan sayfalara ne olur?", a: "Dokunulmaz. Karışık belgelerde yalnız dikey sayfalar dönüştürülür." },
        { q: "Bu araç hangi planlarda var?", a: "Plus, Pro ve Business planlarına dahildir." },
      ],
    },
    {
      title: "Make a PDF Landscape: When Rotating Is Not Enough",
      description:
        "Two ways to make a portrait PDF landscape: rotate the page or place the content on a landscape sheet. The differences, when each works, and a checklist.",
      excerpt:
        "Most «make PDF landscape» tools just rotate the page by 90° and leave the text on its side. Here is how to really place the content on a landscape sheet.",
      blocks: [
        { t: "lead", x: "Search for «make a PDF landscape» and most of what you find simply rotates the page 90°. The page is still portrait; the text just lies on its side and you tilt your head or your screen to read it. Putting the content onto a genuinely landscape page is a different job." },
        { t: "h2", x: "Rotating and re-laying out are not the same" },
        { t: "p", x: "Rotation turns the page itself: the sheet stays the same shape and the content turns with it. Placing the content on a landscape sheet changes the page shape. The new sheet is wide, the text reads upright, and the content settles into that wide area. Moving a portrait A4's content onto a landscape A4 gives a different result than laying the page on its side." },
        { t: "h2", x: "Which one for which situation?" },
        { t: "ul", items: [
          "The content itself is sideways (scanned turned, a table printed rotated): rotating is enough.",
          "The content is upright but a wide table or layout is tiny on a portrait page: placing it on a landscape sheet reads better.",
          "A long text document you will read on a landscape screen or projector: flowing the content into two columns is more comfortable.",
          "A file that mixes landscape and portrait pages: only the portrait ones need converting.",
        ] },
        { t: "h2", x: "Step by step: placing content on a landscape sheet" },
        { t: "steps", items: [
          { title: "Add the PDF", x: "Drop the portrait PDF into the tool. Enter the password if it has one." },
          { title: "Pick a layout", x: "«Auto» suits most documents. «Side by side» flows content into two columns; «Fit» places each page whole on a landscape sheet." },
          { title: "Press Make Landscape", x: "Text, tables and images are not retyped; the page itself is moved to the new sheet." },
          { title: "Preview and download", x: "Review the result and download it if it looks right." },
        ] },
        { t: "cta", title: "PDF to Landscape", x: "Place your portrait PDF on landscape pages without altering the content.", btn: "Open the tool", tool: "/tools/pdf-yatay-yap" },
        { t: "h2", x: "Can letters or digits change?" },
        { t: "p", x: "The tool does not read and regenerate your text; it uses no OCR and no AI. The page content is moved as it is and only position and scale change. So there is no risk of a digit being mistyped or a row being dropped. For an important document it is still a good habit to compare the output with the original at a glance." },
        { t: "h2", x: "Checklist after converting" },
        { t: "ul", items: [
          "Is the page order right, and does a table that was split continue in the next column?",
          "Is the text size readable? Pages that need shrinking get smaller text.",
          "Do form fields and links still work?",
          "For a scanned document the image's own sharpness does not change; a blurry scan does not become crisp.",
        ] },
        { t: "tip", x: "In side-by-side layout, if a page is split across two columns, that page's text is stored as two parts. It looks single on screen, but search or copy may return that page's words twice." },
      ],
      faq: [
        { q: "How is making a PDF landscape different from rotating it?", a: "Rotating lays the page on its side and it stays portrait. Making it landscape places the content on a landscape sheet and the text reads upright." },
        { q: "Can text or digits change?", a: "No. The content is not retyped; the page is moved as it is." },
        { q: "Does it work on scanned PDFs?", a: "Yes. Scanned pages are placed too; the image's resolution does not change." },
        { q: "What happens to pages that are already landscape?", a: "They are left untouched. In mixed files only the portrait pages are converted." },
        { q: "Which plans include this tool?", a: "It is included in the Plus, Pro and Business plans." },
      ],
    },
  ),

  post(
    {
      slug: "dikey-sayfada-kucuk-kalan-tablo-yatay-pdf",
      date: "2026-11-17",
      updated: "2026-11-17",
      readMinutes: 5,
      tags: { tr: ["Tablo", "Tarama", "PDF Yatay Yap"], en: ["Tables", "Scanning", "PDF to Landscape"] },
      accent: "cyan",
      tool: "/tools/pdf-yatay-yap",
    },
    {
      title: "Dikey Sayfada Küçük Kalan Tablo Nasıl Okunur Hâle Gelir?",
      description:
        "Banka dökümü, ödeme planı ya da geniş bir tablo dikey PDF sayfasında küçücük kalıyorsa: içeriği yatay sayfaya yerleştirerek okunur boyuta getirmenin yolu.",
      excerpt:
        "Geniş tablo dikey sayfanın ortasında ince bir şerit gibi duruyor, üstte ve altta boşluk var. Yazıyı yeniden yazmadan nasıl büyütürsünüz?",
      blocks: [
        { t: "lead", x: "Bankadan ya da bir kurum ekranından aldığınız ödeme planı, hesap dökümü veya geniş bir tablo çoğu zaman yatay hazırlanmıştır; ama PDF'e dikey sayfa olarak basılır. Sonuç: tablo sayfanın ortasında ince bir şerit olur, üstte ve altta büyük boşluk kalır, yazılar zor okunur." },
        { t: "h2", x: "Neden böyle oluyor?" },
        { t: "p", x: "Yazdırma ya da tarama sırasında sayfa yönü dikey seçili kalır. Geniş içerik sayfanın genişliğine sığdırılır ve küçülür; yüksekliği az olduğu için altta ve üstte kullanılmayan alan kalır. Sayfayı döndürmek de çözmez: bu kez tablo dikey sayfanın kısa kenarına yatık düşer." },
        { t: "h2", x: "Çözüm: içeriği yatay sayfaya yerleştirmek" },
        { t: "p", x: "«PDF Yatay Yap» aracı, sayfadaki asıl içeriği bulur, boş kenarları atar ve içeriği yatay sayfanın genişliğine oturtur. Yazı bu sayede belirgin biçimde büyür (denediğimiz taranmış bir ödeme planında yaklaşık 1,3 kat). İçerik yeniden yazılmaz; taranmış bir belgede resmin kendisi, metinli bir belgede metnin kendisi taşınır." },
        { t: "steps", items: [
          { title: "PDF'i ekleyin", x: "Tabloyu içeren dikey PDF'i araca bırakın." },
          { title: "«Otomatik» yerleşimi bırakın", x: "İçerik geniş olduğu için sayfa, yatay sayfaya sığdırılır." },
          { title: "Yatay Yap'a basın", x: "Sonuç yatay sayfada, yazılar normal yönde ve daha büyük çıkar." },
          { title: "Rakamları kontrol edin", x: "Özgün ile sonucu yan yana açıp birkaç satırı karşılaştırın." },
        ] },
        { t: "cta", title: "PDF Yatay Yap", x: "Geniş tabloyu yatay sayfada okunur boyuta getirin.", btn: "Aracı aç", tool: "/tools/pdf-yatay-yap" },
        { t: "h2", x: "Taranmış dökümlerde dikkat" },
        { t: "ul", items: [
          "Resmin kendi çözünürlüğü değişmez. Bulanık bir tarama büyütüldüğünde biraz yumuşak görünebilir; daha net olmaz.",
          "Yazıyı temiz ve seçilebilir hâle getirmek istiyorsanız, sonucu «Aranabilir PDF (OCR)» aracından geçirebilirsiniz. OCR sonucunu rakamlarda mutlaka kontrol edin.",
        ] },
        { t: "tip", x: "Rakamları değiştirmeden büyütmek ile rakamları yeniden okuyup tablo hâline getirmek farklı şeylerdir. Bu araç ilkini yapar: görüntüyü ya da metni olduğu gibi taşır, yeniden üretmez." },
        { t: "h2", x: "Metinli (dijital) PDF'lerde" },
        { t: "p", x: "Dijital bir tabloda yazılar vektör olarak kalır, büyütünce de keskin çıkar. Tablo bir sayfaya sığmayacak kadar uzunsa «Yan yana» yerleşimi tabloyu çizgi üzerinden iki sütuna böler; satırlar ortadan kesilmez." },
      ],
      faq: [
        { q: "Tablo dikey sayfada neden küçük kalıyor?", a: "Geniş içerik dikey sayfanın genişliğine sığdırıldığı için küçülür ve alt ile üstte boş alan kalır." },
        { q: "Sayfayı döndürmek çözer mi?", a: "Genellikle hayır. Tablo yan yatar ve dikey sayfanın kısa kenarına düşer; yazı yine küçük kalır." },
        { q: "Rakamlar yeniden mi yazılıyor?", a: "Hayır. Görüntü ya da metin olduğu gibi taşınır; yeniden üretilmez." },
        { q: "Bulanık taramayı netleştirir mi?", a: "Hayır. Resmin kendi çözünürlüğü değişmez." },
        { q: "Bu araç hangi planlarda var?", a: "Plus, Pro ve Business planlarına dahildir." },
      ],
    },
    {
      title: "Wide Table Tiny on a Portrait PDF Page? Make It Readable",
      description:
        "A statement or wide table looks tiny on a portrait PDF page. How to bring it to a readable size by placing the content on a landscape sheet.",
      excerpt:
        "The wide table sits as a thin strip in the middle of a portrait page with empty space above and below. How to enlarge it without retyping anything.",
      blocks: [
        { t: "lead", x: "A payment schedule, account statement or wide table from a bank or an official screen is usually laid out landscape, but it gets printed to PDF on a portrait page. The result: the table is a thin strip in the middle of the page, with large empty areas above and below, and the text is hard to read." },
        { t: "h2", x: "Why does this happen?" },
        { t: "p", x: "The page orientation stays on portrait when printing or scanning. The wide content is fitted to the page width and shrinks; because it is not tall, unused space is left above and below. Rotating the page does not fix it either: the table then lies along the short side of the portrait page." },
        { t: "h2", x: "The fix: place the content on a landscape sheet" },
        { t: "p", x: "The «PDF to Landscape» tool finds the real content on the page, trims the empty margins and fits the content to the width of a landscape sheet. The text grows noticeably (about 1.3 times on a scanned payment schedule we tried). Nothing is retyped: in a scanned document the image itself is moved, in a digital document the text itself." },
        { t: "steps", items: [
          { title: "Add the PDF", x: "Drop the portrait PDF containing the table into the tool." },
          { title: "Leave the layout on «Auto»", x: "Because the content is wide, the page is fitted onto a landscape sheet." },
          { title: "Press Make Landscape", x: "The result is a landscape page with upright, larger text." },
          { title: "Check the numbers", x: "Open the original and the result side by side and compare a few rows." },
        ] },
        { t: "cta", title: "PDF to Landscape", x: "Bring a wide table up to a readable size on a landscape sheet.", btn: "Open the tool", tool: "/tools/pdf-yatay-yap" },
        { t: "h2", x: "Things to watch on scanned statements" },
        { t: "ul", items: [
          "The image's own resolution does not change. A blurry scan may look slightly soft when enlarged; it will not get sharper.",
          "If you want clean, selectable text, run the result through the «Searchable PDF (OCR)» tool, and always check the digits in the OCR output.",
        ] },
        { t: "tip", x: "Enlarging numbers without changing them is different from re-reading them and rebuilding a table. This tool does the first: it moves the image or the text as it is and does not regenerate it." },
        { t: "h2", x: "For digital (text) PDFs" },
        { t: "p", x: "In a digital table the text stays vector, so it is sharp when enlarged. If the table is too long for one sheet, the «Side by side» layout splits it into two columns along a table line; rows are not cut in half." },
      ],
      faq: [
        { q: "Why is the table small on a portrait page?", a: "Wide content is fitted to the portrait width, so it shrinks and leaves empty space above and below." },
        { q: "Does rotating the page help?", a: "Usually not. The table lies on its side along the portrait page's short edge, and the text stays small." },
        { q: "Are the numbers retyped?", a: "No. The image or text is moved as it is, not regenerated." },
        { q: "Will it sharpen a blurry scan?", a: "No. The image's own resolution does not change." },
        { q: "Which plans include this tool?", a: "It is included in the Plus, Pro and Business plans." },
      ],
    },
  ),

  post(
    {
      slug: "dikey-yatay-karisik-pdf-sayfa-yonu",
      date: "2026-11-17",
      updated: "2026-11-17",
      readMinutes: 4,
      tags: { tr: ["Sayfa Yönü", "PDF Düzenleme", "PDF Yatay Yap"], en: ["Page Orientation", "PDF Editing", "PDF to Landscape"] },
      accent: "violet",
      tool: "/tools/pdf-yatay-yap",
    },
    {
      title: "Dikey ve Yatay Sayfaların Karıştığı PDF'i Düzene Sokmak",
      description:
        "PDF'te bazı sayfalar dikey, bazıları yatay ise okumak zorlaşır. Yatay sayfalara dokunmadan yalnız dikey olanları yatay düzene alma yolu ve sayfa sırası.",
      excerpt:
        "Birleştirdiğiniz dosyada sayfa yönleri karıştı. Sadece dikey olanları yatay düzene alıp yatay olanlara dokunmamak mümkün mü?",
      blocks: [
        { t: "lead", x: "Farklı kaynaklardan gelen dosyaları birleştirdiğinizde bir PDF'te dikey ve yatay sayfalar yan yana durabilir. Ekranda ya da projeksiyonda gezinirken bazı sayfalarda ekranı eğmek, bazılarında düz bakmak gerekir. Tüm belgeyi tek yöne getirmek isterseniz yatay sayfalara dokunmadan yalnız dikeyleri dönüştürmek yeterlidir." },
        { t: "h2", x: "Sayfa yönü karışıklığı nereden gelir?" },
        { t: "ul", items: [
          "Dikey bir rapora yatay bir tablo ya da grafik sayfasının eklenmesi.",
          "Birden çok kaynaktan gelen PDF'lerin tek dosyada birleştirilmesi.",
          "Taramalarda bazı sayfaların yan, bazılarının dik girmesi.",
        ] },
        { t: "h2", x: "Yalnız dikey sayfaları dönüştürmek" },
        { t: "p", x: "«PDF Yatay Yap» aracı, sayfa yatay ise ona dokunmaz ve olduğu gibi bırakır. Yalnız dikey sayfalar yatay düzene alınır; sayfa sırası değişmez. Ardışık dikey sayfalar tek bir akış olarak yan yana iki sütuna dizilir, araya giren bir yatay sayfa ise akışı böler ve yerinde kalır." },
        { t: "steps", items: [
          { title: "PDF'i ekleyin", x: "Karışık yönlü dosyayı araca bırakın." },
          { title: "Yerleşimi seçin", x: "«Otomatik» ya da «Yan yana»; yatay sayfalar her iki durumda da korunur." },
          { title: "Yatay Yap'a basın", x: "Sonuçta dikey sayfalar yatay düzene girmiş, yatay sayfalar aynı yerinde kalmış olur." },
          { title: "Sırayı kontrol edin", x: "Sayfa sırasının özgün dosyayla aynı olduğunu önizlemede doğrulayın." },
        ] },
        { t: "cta", title: "PDF Yatay Yap", x: "Karışık yönlü PDF'te yalnız dikey sayfaları yatay düzene alın.", btn: "Aracı aç", tool: "/tools/pdf-yatay-yap" },
        { t: "h2", x: "Bilmeniz gerekenler" },
        { t: "ul", items: [
          "Sayfa sayısı değişebilir: iki dikey sayfanın içeriği tek yatay sayfaya sığabilir.",
          "Bir yatay sayfa, onun öncesindeki ve sonrasındaki dikey sayfaların akışını böler; bu iki grup ayrı akış olarak yerleştirilir.",
          "Boş sayfalar olduğu gibi bırakılır.",
          "Form alanları ve bağlantılar yeni konumlarında çalışmaya devam eder.",
        ] },
        { t: "tip", x: "Tüm sayfaların yalnızca yönünü değiştirmek istiyorsanız «PDF Döndür» aracı yeterlidir. «PDF Yatay Yap» içeriği yatay sayfaya yerleştirmek istediğinizde işe yarar." },
      ],
      faq: [
        { q: "Yatay sayfalar da değişir mi?", a: "Hayır. Zaten yatay olan sayfalar olduğu gibi kalır." },
        { q: "Sayfa sırası bozulur mu?", a: "Hayır. Sıra korunur; yatay sayfalar yerinde kalır." },
        { q: "Çıktının sayfa sayısı neden azalabilir?", a: "İki dikey sayfanın içeriği tek yatay sayfaya iki sütun olarak sığabildiği için." },
        { q: "Bunun yerine sadece döndürebilir miyim?", a: "Evet, «PDF Döndür» aracı sayfaları çevirir; ama içerik yatay sayfaya yerleşmez, yazı yan yatar." },
        { q: "Bu araç hangi planlarda var?", a: "Plus, Pro ve Business planlarına dahildir." },
      ],
    },
    {
      title: "Fixing a PDF That Mixes Portrait and Landscape Pages",
      description:
        "Some PDF pages are portrait, others landscape, and reading gets awkward. How to convert only the portrait pages to a landscape layout and keep the order.",
      excerpt:
        "Your merged file ended up with mixed page orientations. Can you convert just the portrait ones and leave the landscape pages alone?",
      blocks: [
        { t: "lead", x: "Merge files from different sources and one PDF can end up with portrait and landscape pages side by side. Scrolling on a screen or a projector, you tilt your head on some pages and look straight on others. If you want one orientation throughout, converting only the portrait pages while leaving the landscape ones alone is enough." },
        { t: "h2", x: "Where does mixed orientation come from?" },
        { t: "ul", items: [
          "A landscape table or chart page added to a portrait report.",
          "PDFs from several sources merged into one file.",
          "Scans where some pages came in sideways and others upright.",
        ] },
        { t: "h2", x: "Converting only the portrait pages" },
        { t: "p", x: "The «PDF to Landscape» tool leaves a page untouched if it is already landscape. Only portrait pages move to a landscape layout and the page order does not change. Consecutive portrait pages are laid out as one flow in two columns; a landscape page in between breaks the flow and stays where it is." },
        { t: "steps", items: [
          { title: "Add the PDF", x: "Drop the mixed-orientation file into the tool." },
          { title: "Pick a layout", x: "«Auto» or «Side by side»; landscape pages are kept in both cases." },
          { title: "Press Make Landscape", x: "Portrait pages are converted and landscape pages stay where they were." },
          { title: "Check the order", x: "Confirm in the preview that the page order matches the original." },
        ] },
        { t: "cta", title: "PDF to Landscape", x: "Convert only the portrait pages of a mixed-orientation PDF.", btn: "Open the tool", tool: "/tools/pdf-yatay-yap" },
        { t: "h2", x: "Good to know" },
        { t: "ul", items: [
          "The page count can change: two portrait pages of content may fit on one landscape sheet.",
          "A landscape page splits the flow of the portrait pages before and after it; those two groups are laid out as separate flows.",
          "Empty pages are left as they are.",
          "Form fields and links keep working in their new positions.",
        ] },
        { t: "tip", x: "If you only want to change the orientation of every page, the «Rotate PDF» tool is enough. «PDF to Landscape» is for when you want the content placed on a landscape sheet." },
      ],
      faq: [
        { q: "Do landscape pages change too?", a: "No. Pages that are already landscape stay as they are." },
        { q: "Does the page order change?", a: "No. The order is kept and landscape pages stay in place." },
        { q: "Why can the output have fewer pages?", a: "Because two portrait pages of content can fit on one landscape sheet as two columns." },
        { q: "Can I just rotate instead?", a: "Yes, the «Rotate PDF» tool turns pages, but the content is not re-laid out onto a landscape sheet and the text lies sideways." },
        { q: "Which plans include this tool?", a: "It is included in the Plus, Pro and Business plans." },
      ],
    },
  ),
];

/** Elle yazılmış Instagram slaytları (carouselCopy.mjs'e katılır). */
export const YATAY_CAROUSELS = {
  "pdf-yatay-yapma-dikey-pdf-yatay-sayfa": {
    hook: "PDF'i yatay yap derken yazı yan yatmasın",
    slides: [
      ["Döndürmek yetmez", "Döndürme sayfayı yan yatırır; sayfa dikey kalır, yazı yan durur. Okumak için başınızı eğmeniz gerekir."],
      ["Yatay sayfaya yerleştirmek", "İçerik geniş bir sayfaya oturur, yazı normal yönde okunur. Sayfanın kendisi taşınır, yeniden yazılmaz."],
      ["Üç yerleşim", "Otomatik çoğu belgeye yeter. Yan yana içeriği iki sütuna akıtır, Sığdır her sayfayı tek parça yerleştirir."],
      ["Rakamlar değişmez", "OCR ya da yapay zekâ yok. Metin ve görsel olduğu gibi taşınır; yalnız konum ve ölçek değişir."],
      ["Kontrol edin", "Sayfa sırasına, bölünen tabloların devamına ve yazı boyutuna bakın. Taranmış bulanık sayfa netleşmez."],
    ],
  },
  "dikey-sayfada-kucuk-kalan-tablo-yatay-pdf": {
    hook: "Tablo dikey sayfada ince bir şerit olmuş",
    slides: [
      ["Neden küçük kalıyor?", "Geniş tablo dikey sayfanın genişliğine sığdırılınca küçülür. Altta ve üstte kullanılmayan boşluk kalır."],
      ["Döndürmek çözmez", "Tablo bu kez dikey sayfanın kısa kenarına yatık düşer. Yazı yine küçük kalır."],
      ["Yatay sayfaya alın", "Araç asıl içeriği bulur, boş kenarları atar ve genişliğe oturtur. Denediğimiz taranmış planda yazı yaklaşık 1,3 kat büyüdü."],
      ["Rakamlar yeniden yazılmaz", "Görüntü ya da metin olduğu gibi taşınır. Netlik de aynı kalır: bulanık tarama daha net olmaz."],
      ["Önemli belgede kontrol", "Özgün ile sonucu yan yana açıp birkaç satırı karşılaştırın."],
    ],
  },
  "dikey-yatay-karisik-pdf-sayfa-yonu": {
    hook: "Dosyada dikey ve yatay sayfalar karıştı",
    slides: [
      ["Nereden gelir?", "Farklı dosyaları birleştirince, yatay tablo sayfası eklenince ya da taramada bazı sayfalar yan girince."],
      ["Yataylara dokunulmaz", "Zaten yatay olan sayfalar olduğu gibi kalır. Yalnız dikey sayfalar yatay düzene alınır."],
      ["Sıra bozulmaz", "Sayfa sırası aynı kalır. Araya giren yatay sayfa, dikey sayfaların akışını böler ve yerinde durur."],
      ["Sayfa sayısı azalabilir", "İki dikey sayfanın içeriği tek yatay sayfaya iki sütun olarak sığabilir."],
      ["Sadece yön lazımsa", "Tüm sayfaları yalnızca çevirmek istiyorsanız PDF Döndür yeterli. İçeriği yatay sayfaya yerleştirmek için PDF Yatay Yap."],
    ],
  },
};
