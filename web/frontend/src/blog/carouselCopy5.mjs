/** Elle yazılmış slayt metinleri — 5. bölüm (gizlilik, karşılaştırma, onarım, dönüştürme, düzenleme). */
export const COPY_5 = {
  "dosya-yuklemeden-pdf-isleme-gizlilik": {
    hook: "PDF'inizi işlerken dosya sunucuya gitmesin",
    slides: [
      ["Çoğu araç ne yapıyor?", "Dosyanızı sunucusuna yükler, orada işler, sonucu geri verir. Sözleşme ya da kimlik için bu, tanımadığınız bir sunucuda kopyası oluşması demektir."],
      ["«Cihazda işleme» ne demek?", "İşin tamamı tarayıcınızın içinde yapılır; dosya internete gönderilmez. Yükleme beklemezsiniz, çevrimdışı da çalışır."],
      ["Hangileri cihazda?", "Birleştirme, bölme, döndürme, sayfa silme, sıralama, görselden PDF, imza, işaretleme ve belge tarama."],
      ["Her iş cihazda olmuyor", "Word ve Excel'e dönüştürme, OCR ve sıkıştırma gibi ağır işler sunucuda yapılır."],
      ["Nasıl sınarsınız?", "İşlemi internet bağlantısı kesikken deneyin. Tamamlanıyorsa dosya hiçbir yere gitmemiştir."],
      ["«1 saat sonra siliniyor» ne demek?", "Dürüst bir vaat ama dosya silinene kadar sunucuda durur ve ağdan geçer. Kimlik, sağlık, mali ve hukuki belgelerde mümkünse cihazda işleyin."],
    ],
  },
  "pdf-hassas-veri-gizleme-kvkk": {
    hook: "PDF'teki kişisel veriyi paylaşmadan önce gerçekten silin",
    slides: [
      ["Siyah kutu yetmez", "Yazının üstüne kutu çizseniz bile asıl yazı belgenin içinde durur. Kopyalayan ya da kutuyu kaldıran biri veriyi geri okur."],
      ["Gerçek gizleme", "Veriyi belgenin içeriğinden siler. TC, IBAN, telefon ve e-posta gibi kalıplar cihazınızda bulunur; belgeyi yükleyin, onaylayın, kalıcı olarak kaldırılır."],
      ["Ne zaman gerekir?", "Sözleşme ya da faturayı üçüncü kişiyle paylaşmadan önce, resmî başvuruda, ihale ve mahkeme dosyalarında, örnek olarak yayınlanacak belgelerde."],
      ["Gözden kaçanlar", "Üst ve alt bilgideki isim ve şube, imza bloğundaki doğrudan telefon, tabloda kalan üçüncü kişi kayıtları, faturadaki müşteri numarası."],
      ["Görünmeyenler de var", "Belgeyi oluşturanın adı, kullanılan program, oluşturma ve değiştirme tarihleri belge özelliklerinde durur."],
    ],
  },
  "pdf-karsilastirma-farklari-bulma": {
    hook: "«Küçük düzeltme yaptık» dendi. İki sürüm arasında ne değişti?",
    slides: [
      ["Elle karşılaştırmak riskli", "Sayfalarca metinde eklenen bir cümle, silinen bir istisna ya da değişen bir rakam kolayca kaçar. Numara kayması gerçek değişikliği gizler."],
      ["Üç adım", "Eski ve yeni sürümü yükleyin, karşılaştırın, farkları inceleyin. Eklenen, çıkarılan ve değiştirilen maddeler ayıklanır."],
      ["Önce şuralara bakın", "Tutarlar, tarihler ve süreler, sorumluluk üst sınırı ve cezai şart, taraflar, uygulanacak hukuk ve yetkili mahkeme."],
      ["Tek kelime kapsamı değiştirir", "«Hariç», «dâhil değildir», «sınırlıdır» gibi olumsuz ifadelerdeki küçük eklemelere dikkat edin."],
      ["Aynı bölümleri karşılaştırın", "Bir sürümde ekler varken diğerinde yoksa farkların çoğu eklerden gelir."],
    ],
  },
  "bozuk-pdf-onarma": {
    hook: "Açılmayan PDF'in içeriğini kurtarmak",
    slides: [
      ["Neden bozulur?", "Yarım kalan indirme, USB ya da disk hatası, uyumsuz programla düzenleme, e-posta eki sıkıştırması."],
      ["Önce gerçekten bozuk mu bakın", "Başka programda açın. Dosya birkaç KB ise indirme yarım kalmıştır, yeniden indirin. Parola isteniyorsa dosya şifrelidir, bozuk değil."],
      ["Onarım ne yapar?", "PDF'in sonunda nesnelerin yerini gösteren bir dizin bulunur. Dizin bozulunca dosya açılmaz ama sayfalar yerinde durur; araç yapıyı yeniden kurar."],
      ["Üç adım", "Bozuk dosyayı yükleyin, onarımı çalıştırın, sonucu indirip açın."],
      ["Garanti yok", "Başarı hasarın derecesine bağlı. Silinmiş ya da şifreli veriyi geri getiremez."],
      ["Onardıktan sonra kontrol", "Sayfa sayısı eksik mi, metin seçiliyor mu, görseller yerinde mi, son sayfa ve imza bölümü tam mı?"],
    ],
  },
  "pdf-sayfa-numarasi-ekleme": {
    hook: "PDF'e sayfa numarası nasıl eklenir?",
    slides: [
      ["Ne zaman gerekir?", "Rapor, tez ve akademik belgelerde atıf için. Sözleşme ve resmî evrakta bütünlük için. Baskıya giden uzun belgelerde sıra için."],
      ["Üç adım", "PDF'i yükleyin, numaranın konumunu ve biçimini seçin, indirin."],
      ["Hangi biçim?", "Sade rakam çoğu belgeye yeter. «1 / 12» sözleşme ve tekliflerde sayfa eksik mi anlaşılsın diye tercih edilir."],
      ["Kapakta numara olmasın", "Kapak neredeyse hiç numaralanmaz. Akademik işlerde yaygın düzen: kapak numarasız, ön bölümler roma rakamıyla, asıl metin 1'den."],
      ["Önce sırayı kesinleştirin", "Numara belgeye sabit basılır. Sonradan sayfa eklerseniz numaralar içerikle uyuşmaz. Birleştireceksiniz de önce birleştirin."],
    ],
  },
  "powerpoint-pdf-cevirme": {
    hook: "Sunumu PowerPoint olarak göndermeyin",
    slides: [
      ["Neden PDF?", "Karşı tarafta yazı tipleri kayabilir, animasyonlar bozulabilir, slaytlar yanlışlıkla değişebilir. PDF herkeste aynı görünür."],
      ["Üç adım", ".ppt ya da .pptx dosyasını yükleyin, dönüştürün, indirin. Tasarım korunur."],
      ["Neler kaybolur?", "Geçişler ve animasyonlar. Animasyonlu slayt, son hâliyle tek sayfa olur. Gömülü video ve ses de gider, yerinde kapak görüntüsü kalır."],
      ["Konuşmacı notları", "Varsayılan olarak çıktıya girmez."],
      ["Tersi: PDF'ten PowerPoint", "Her sayfa bir slayt olur, içeriği yeniden kullanabilirsiniz. Ama sunumun özgün düzenlenebilir hâli geri gelmez."],
      ["Göndermeden önce", "Animasyonla ortaya çıkan içerik doğru görünüyor mu, küçük yazılar okunuyor mu, gizli slayt çıktıya girmiş mi?"],
    ],
  },
  "excel-pdf-cevirme": {
    hook: "Excel tablonuz karşı tarafta kayıyor mu?",
    slides: [
      ["Neden PDF?", "Hücreler, sütun genişlikleri ve sayfa sonları herkeste aynı görünür. Yazdırma sorunları biter, tablo yanlışlıkla değiştirilmez."],
      ["Üç adım", "Excel dosyasını yükleyin, dönüştürün, önizleyip indirin. .xls, .xlsx, .ods ve .csv kabul edilir."],
      ["Çevirmeden önce Excel'de", "Sayfa yönünü yatay yapın, yazdırma alanını tanımlayın, «tüm sütunları tek sayfaya sığdır»ı seçin, başlık satırını her sayfada tekrarlatın."],
      ["Sekmelere dikkat", "Ara hesap, ham veri ve eski dönem sekmeleri çıktıya girerse belge şişer ve paylaşılmaması gereken bilgi taşıyabilir."],
      ["Gizli bilgi", "Excel göründüğünden fazlasını taşır: gizli satırlar, filtreyle saklanan veriler, hücre notları. Göndermeden önce çıktıyı açıp kontrol edin."],
    ],
  },
  "pdf-excel-tablo-cevirme": {
    hook: "PDF'teki tabloyu Excel'e düzgün aktarmak",
    slides: [
      ["Kopyala-yapıştır neden bozuyor?", "PDF'te tablo diye bir nesne yok. Gördüğünüz ızgara çizgiler ve hizalı metin parçalarından oluşan bir görüntü."],
      ["Üç adım", "PDF'i yükleyin, tablolar algılansın, .xlsx dosyasını indirip Excel'de düzenleyin."],
      ["Sorunlu tablolar", "Çizgisiz tablolar, birleştirilmiş hücreler, sayfaya yayılan başlık satırları. Taranmış belgede önce OCR gerekir."],
      ["Açtıktan sonra", "Sayıya dönmemiş sütunları biçimlendirin, binlik ayracı yüzünden metne dönen tutarları düzeltin, tarih biçimini kontrol edin."],
      ["Fatura ve irsaliyede", "Her biri farklı düzendeyse tablo değil alan çıkarmak daha doğru: fatura no, tarih, tutar, kalemler. Yapay zekâ ile veri çıkarma bunun için."],
      ["Yüz sayfalık rapor", "Yalnızca tek sayfadaki tablo lazımsa belgeyi önce bölün, o sayfayı dönüştürün."],
    ],
  },
  "pdf-metin-duzenleme-silme": {
    hook: "PDF'teki yazıyı gerçekten silip değiştirmek",
    slides: [
      ["Üzerini kapatmak silmek değildir", "Çoğu araç beyaz kutu koyar. Orijinal yazı belgede kalır; kopyalayınca ya da aratınca çıkar."],
      ["Gerçek silme", "Mevcut metni belgeden kaldırıp yerine yazdığınızı koyar. Türkçe karakterler tam desteklenir."],
      ["Dört adım", "PDF'i açın, değiştireceğiniz yazıya tıklayın, silin ya da yeniden yazın, indirin."],
      ["Ne zaman çalışır?", "Gerçek metin katmanı olan PDF'lerde, örneğin Word'den üretilenlerde. Taranmış belgede yazı resimdir; önce OCR gerekir."],
      ["Küçük düzeltmeler için", "Bir tarih, tutar, isim ya da yazım hatası için doğrudan düzenleme en temizi. Yeni metin eskisinden uzunsa satır sonuna taşabilir."],
      ["Resmî belgelerde dikkat", "Fatura, resmî yazı ya da imzalı sözleşmenin içeriğini değiştirmek belgenin niteliğini bozar ve ciddi sonuç doğurabilir."],
    ],
  },
};
