/** Elle yazılmış slayt metinleri — 7. bölüm (sayfa işleri, toplu işlem, özetleme, kira ve ihale). */
export const COPY_7 = {
  "pdf-bolme-sayfalara-ayirma": {
    hook: "PDF'in yalnızca gereken sayfalarını nasıl ayırırsınız?",
    slides: [
      ["Ne zaman gerekir?", "Sözleşmenin imza sayfası, raporun tek bölümü, e-postaya sığacak küçük bir parça. Belgenin tamamını göndermek çoğu zaman alışkanlık, gereklilik değil."],
      ["Üç adım", "PDF'i bırakın, çıkarmak istediğiniz sayfaları ya da aralığı işaretleyin, tek PDF ya da ayrı dosyalar (ZIP) olarak indirin."],
      ["Bölmek mi, silmek mi?", "Birkaç sayfa tutacaksanız bölün. Çoğunu tutup birkaçını atacaksanız sayfa silmek daha hızlı."],
      ["Aralığı bulun", "Uzun belgede bölümün nerede başlayıp bittiğini içindekiler listesinden okumak en hızlısı."],
      ["Parçaları adlandırın", "«sozlesme-s12-18.pdf» gibi: belge adı ve sayfa aralığı. Tarih ekleyecekseniz yıl-ay-gün yazın, kendiliğinden doğru sıralanır."],
      ["Geri birleştirebilirsiniz", "Böldükten sonra parçaları tekrar tek dosyada toplamak mümkün. İşlem tarayıcınızda, dosya internete çıkmaz."],
    ],
  },
  "pdf-sayfa-sirasi-degistirme": {
    hook: "PDF sayfalarının sırasını değiştirmek",
    slides: [
      ["Ne zaman gerekir?", "Tarayıcının ters sırayla verdiği sayfalar, başa ya da sona taşınacak ek ve kapak, birleştirmeden sonra akışı düzeltmek."],
      ["Üç adım", "PDF'i açın, sayfaları yukarı ya da aşağı düğmeleriyle taşıyın ya da hedef konum numarasını yazın, indirin."],
      ["Klasik tarayıcı hatası", "Çift taraflı tarayınca önce tüm ön yüzler, sonra desteyi ters çevirince tüm arka yüzler okunur. Sayfalar 1, 3, 5… 6, 4, 2 diye dizilir."],
      ["Önce planlayın", "Hedef sırayı kâğıt üstünde netleştirin: hangi bölüm başta, ekler nerede, imza sayfası nerede."],
      ["Sıralamadan sonra", "Basılı sayfa numaraları artık uyuşmaz, numaralandırmayı en sona bırakın. «Bkz. sayfa 12» gibi göndermeleri gözden geçirin."],
    ],
  },
  "pdf-dondurme-kaydetme": {
    hook: "PDF'i döndürdünüz ama yine yan açılıyor mu?",
    slides: [
      ["Neden kalıcı olmuyor?", "Çoğu PDF görüntüleyicide döndür düğmesi yalnızca ekrandaki görünümü çevirir, dosyaya yazılmaz. Paylaşınca ya da yazdırınca yine yan görünür."],
      ["Kalıcı döndürme", "PDF'i açın, her sayfa kartındaki sola ya da sağa düğmeleriyle 90 derecelik adımlarla çevirin, indirin. Yeni dosya her açılışta düzgün görünür."],
      ["Sayfalar neden yan çıkar?", "Belge tarayıcıya yatay konmuştur, otomatik besleyici bazı sayfaları ters çekmiştir ya da telefon fotoğraf yönünü kaydetmiş ama PDF'e çevrilirken kullanılmamıştır."],
      ["Yalnızca yanlış olanı çevirin", "Raporda geniş tablolar bilinçli olarak yatay olabilir. Hepsini aynı yöne çevirmek onları okunmaz yapar."],
      ["Baskıda gerçek sorun", "Yan duran sayfayı yazıcı küçültebilir, kenarlarını kesebilir ya da yatay basabilir."],
    ],
  },
  "pdf-sayfa-silme": {
    hook: "PDF'ten sayfa silmek için program ya da üyelik gerekmez",
    slides: [
      ["Ne zaman gerekir?", "Tarayıcının eklediği boş ve çift sayfalar, birleştirmeden sonra tekrar eden kapaklar, paylaşmadan önce çıkarılacak iç sayfalar."],
      ["Üç adım", "PDF'i bırakın, silinecek sayfalara tıklayarak işaretleyin, temizlenmiş PDF'i indirin. İndirmeden önce seçimi geri alabilirsiniz."],
      ["Cihazınızda çalışır", "Giriş yapmadan kullanıldığında dosya internete gönderilmez."],
      ["Paylaşmadan önce bakın", "İç fiyatlandırma ve kâr marjı sayfaları, eski müşteri bilgisi kalan şablon sayfaları, iç onay formları, eski sürüm damgalı sayfalar, kimlik kopyaları."],
      ["Sayfadaki birkaç satırı gizlemek?", "Sayfayı silmek yeni dosyada o içeriği taşımaz. Ama bir sayfadaki birkaç satırı gizlemek için siyah kutu yetmez; veriyi gerçekten silmek gerekir."],
    ],
  },
  "faturalari-toplu-muhasebeye-hazirlama": {
    hook: "Ay sonunda onlarca faturayı tek tek açmayın",
    slides: [
      ["Asıl dert toplu iş", "Tek fatura işlemek kolay. Onlarca faturayı arka arkaya işlemek zaman alır. Toplu işlem her faturadan fatura no, tarih, satıcı, tutar ve KDV'yi çıkarıp tek tabloda birleştirir."],
      ["Üç adım", "Faturaları yükleyin (en fazla 25 dosya), «Veri Çıkar»ı seçin, ilerlemeyi izleyin. Her satırı bir fatura olan tek bir CSV indirin."],
      ["Klasörü düzenleyin", "Çift kopyaları ayıklayın, irsaliye ve dekontları ayrı klasöre alın, fotoğrafla çekilen faturaları önce belge tarayıcıdan geçirin."],
      ["Tabloyu toplu kontrol edin", "Tutar toplamını dönem toplamıyla karşılaştırın, KDV'yi tutarla oranlayın, dönem dışı tarihlere ve beklemediğiniz satıcı adlarına bakın."],
      ["Hata riski yüksek olanlar", "Gölgeli ya da eğri fotoğraflar, ay/gün sırası farklı yabancı faturalar, çok kalemli faturalar, el yazısı not ve kaşe, iskonto ve iade içerenler."],
    ],
  },
  "akademik-makale-ozetleme-literatur": {
    hook: "Literatür taramasında yüz makaleyi nasıl elersiniz?",
    slides: [
      ["Bir makalede ne bakılır?", "Araştırma sorusu, yöntem, bulgular, sonuç ve katkı. Sınırlılıklar bölümü en değerli kısımlardan biri."],
      ["Üç aşamalı eleme", "Başlık ve özet: konuyla ilgisiz olanlar düşer. Yapılandırılmış özet: soru, yöntem, bulgu. Tam okuma: yalnızca gerçekten gireceklere."],
      ["Yapay zekâ özeti", "Akademik metni tanır, araştırma sorusu, yöntem, bulgular ve sonuç ekseninde özet verir. Makalenin işinize yarayıp yaramadığını okumadan görürsünüz."],
      ["Yöntemi atlamayın", "Elli kişilik anket ile binlerce kişilik boylamsal çalışmayı aynı ağırlıkta aktarmak en sık eleştirilen hata."],
      ["Notları kaynağa bağlı tutun", "Her makale için tek satırlık künye, üç dört maddelik özet ve sayfa numaralı alıntılar. Tez yazarken kaynağı yeniden aramazsınız."],
      ["Özet iddiayı aktarır", "Doğru olup olmadığını değerlendirmez. Kaynağı okumak ve doğru atıf yapmak yerine geçmez."],
    ],
  },
  "yabanci-dildeki-sozlesmeyi-anlama": {
    hook: "Yabancı dildeki sözleşmeyi hızlıca nasıl anlarsınız?",
    slides: [
      ["Önce çevirin, sonra özetleyin", "Belgeyi anadilinize çevirin; başlık, liste ve tablo yapısı korunur. Uzunsa özetleyin: taraflar, tarihler, yükümlülükler öne çıkar."],
      ["Baştan sona okumayın", "Risk birkaç maddede toplanır: taraflar ve yetki, süre ve yenileme, fesih, ödeme, sorumluluk sınırı, uygulanacak hukuk, gizlilik ve rekabet yasağı."],
      ["En kısa madde en belirleyici olabilir", "«Uygulanacak hukuk ve yetkili mahkeme» uyuşmazlıkta diğer maddelerden daha belirleyici olabilir. Başka ülkede hak aramak işin değerini aşabilir."],
      ["Terimler yanıltabilir", "İngilizce sözleşmede «shall» yükümlülük, «may» takdir yetkisi anlatır. «Indemnify», «warranty», «best efforts» hukuk sistemine göre özel anlam taşır."],
      ["Takıldığınız yeri sorun", "Belirli bir maddeyi anlamak için belgeye doğrudan soru sorabilirsiniz."],
      ["Çeviri yeminli tercümanın yerine geçmez", "Yapay zekâ çevirisi hızlı anlamak içindir. Resmî ve hukuki geçerlilik gereken belgede yeminli tercüman şart."],
    ],
  },
  "banka-ekstresi-excele-aktarma": {
    hook: "Banka ekstresini PDF'ten Excel'e nasıl aktarırsınız?",
    slides: [
      ["Neden zor?", "PDF ekstrede satırlar düzenli görünür ama arkada tablo yapısı yoktur. Kopyalayınca tarih, açıklama ve tutar tek hücreye ya da yanlış sütunlara düşer."],
      ["Önce bankaya bakın", "İnternet şubesinde ekstreyi CSV ya da Excel olarak indirebiliyorsanız en temiz yol odur."],
      ["PDF'ten çıkarmak", "Ekstreyi yükleyin, veriyi çıkarın. Hareketler tarih, açıklama ve tutar olarak tabloya dökülür; CSV indirin. Çok aylıysa toplu işlem hepsini tek CSV'de birleştirir."],
      ["Kontrol edin", "Satır sayısı ekstredeki toplamla aynı mı? Giriş ve çıkış toplamları özetle uyuşuyor mu? Gün/ay sırası, ondalık ayracı ve eksi işareti doğru mu?"],
      ["Excel'de açarken", "CSV'yi çift tıklamak Türkçe Windows'ta tutarları bozabilir. Excel'i boş açıp «Veri, Metin/CSV'den» ile içe aktarın."],
      ["Paylaşmadan önce", "Ekstre hesap numaranızı ve harcama alışkanlığınızı gösterir. Muhasebeciye giderken gerekmeyen bilgileri kaldırın."],
    ],
  },
  "kira-kontrati-dikkat-edilecek-maddeler": {
    hook: "Kira kontratını imzalamadan önce bakılacak 7 şey",
    slides: [
      ["Bedel ve artış", "Kira bedeli, ödeme günü ve şekli. Artış sabit bir yüzde mi, bir endekse mi bağlı, endeks hangi dönemin verisi?"],
      ["Depozito", "En sık anlaşmazlık çıkan madde. Ne zaman, hangi koşulla ve hangi kesintilerle iade edileceği yazmıyorsa tarafların hafızasına kalır."],
      ["Girişte durumu kayıt altına alın", "Taşınma günü boyayı, parkeyi, dolapları, banyo armatürlerini, mevcut çizik ve lekeleri fotoğraflayın. Sayaç değerlerini not edin."],
      ["Kim neyi öder?", "Aidat kalemleri, kombi ve klima bakımı, abonelikler kimin adına açılacak, tadilat ve boya için yazılı izin gerekiyor mu?"],
      ["Süre ve çıkış", "Yenileme ve fesih şartları, tahliye bildirim süresi. Bildirimi kaçırmak bir dönem daha bağlı kalmanıza yol açabilir."],
      ["İmzalı nüshayı saklayın", "Kira yardımı başvurusundan vergi beyanına kadar birçok yerde istenir."],
    ],
  },
  "ihale-sartnamesi-nasil-okunur": {
    hook: "İhale şartnamesi hangi sırayla okunur?",
    slides: [
      ["Önce teklif verip vermeyeceğinize karar verin", "Şartnameyi baştan sona okumadan önce birkaç dakikada karar verecek bilgiye bakın."],
      ["İlk bakılacak yer", "Yeterlilik kriterleri: iş deneyimi, ciro, kapasite. Şartları karşılamıyorsanız geri kalanını okumanın anlamı yok."],
      ["Sonra tarih ve kapsam", "Son teklif tarihi ve saati gerçekçi mi? İstenen işi yapabiliyor musunuz, taşeron gerekiyor mu?"],
      ["Teminat ve ödeme", "Geçici ve kesin teminat tutarı ve türü, ödeme koşulları. Nakit akışınız bunu kaldırıyor mu?"],
      ["Değerlendirme kriteri", "En düşük fiyat mı, ekonomik açıdan en avantajlı teklif mi? Cayma bedeli, gecikme cezası ve fesih şartlarına da bakın."],
      ["Biçimsel eksikten elenmeyin", "Eksik ya da süresi geçmiş belge, tutarı ya da süresi uymayan teminat mektubu. Bunların hepsi önlenebilir."],
    ],
  },
};
