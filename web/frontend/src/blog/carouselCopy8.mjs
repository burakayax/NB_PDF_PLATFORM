/** Elle yazılmış slayt metinleri — 8. bölüm (OCR, özet, dönüştürme, birleştirme, fatura). */
export const COPY_8 = {
  "taranmis-pdf-metne-cevirme-ocr": {
    hook: "Taranmış PDF'teki yazıyı neden kopyalayamıyorsunuz?",
    slides: [
      ["Sebep", "Taranan sayfadaki yazı aslında bir fotoğraftır. Seçemez, arayamaz, kopyalayamazsınız. OCR harf ve kelimeleri tanıyıp düzenlenebilir metne çevirir."],
      ["Üç adım", "Taranmış PDF'i yükleyin, OCR yazıyı cihazınızda gerçek metne çevirsin (Türkçe ve İngilizce), metni arayın, kopyalayın, özet ya da çeviri aracına verin."],
      ["Sonucu girdi belirler", "300 DPI civarı net taramalar çok daha iyi okunur; 150 DPI altında hata hızla artar. Soluk mürekkep, eğik sayfa ve el yazısı sorun çıkarır."],
      ["Türkçe harflere dikkat", "ı ile i, İ ile I en sık karışanlar. Kimlik, tapu ve sözleşmede tek harf önemlidir; çıktıyı gözle doğrulayın."],
      ["Önce hazırlayın", "Eğri sayfaları döndürün, boş ve tekrar eden sayfaları silin, telefon fotoğraflarını önce belge tarayıcıdan geçirin."],
      ["Belgeniz sunucuya gitmez", "İşlem tamamen cihazınızda yapılır. Görünümü korumak istiyorsanız aranabilir PDF, yalnızca yazı lazımsa düz metin seçin."],
    ],
  },
  "uzun-belgeleri-ai-ile-ozetleme": {
    hook: "Uzun belge elinize geçti: neye dikkat etmelisiniz?",
    slides: [
      ["Türünü tanıyıp öne çıkarır", "İhale, sözleşme, akademik makale, mali rapor gibi türleri ayırt eder; tarafları, önemli tarihleri, tutarları ve yükümlülükleri vurgular."],
      ["Üç adım", "PDF'i yükleyin, taranmışsa OCR kendiliğinden devreye girer. «Özet Oluştur» deyin. Özeti PDF olarak indirin ya da paylaşın."],
      ["Belgeyi hazırlayın", "İki yüz sayfanın tamamı yerine ilgili bölümü vermek daha isabetli ve daha kısa bir özet verir."],
      ["Özeti belgeden doğrulayın", "Tutarlar, tarihler ve süreler, taraf adları, ceza ve fesih koşulları. «Hariçtir», «sınırlıdır» gibi olumsuz hükümler özette kolay silikleşir."],
      ["Özet yetmeyen belgeler", "İmzalayacağınız sözleşmeler, hukuki sonuç doğuran bildirimler, sağlık raporları ve resmî yazışmalar. Özet başlangıç noktasıdır."],
      ["Aklınızdaki somut soru", "«Cayma bedeli ne kadar?», «Bu madde bizi bağlıyor mu?» Belgeye doğrudan soru sorun; yanıt belgenin kendi metnine dayanır."],
    ],
  },
  "resimleri-pdf-yapma": {
    hook: "Evrak fotoğraflarını tek PDF yapmak",
    slides: [
      ["Neden tek PDF?", "Birden çok JPG göndermek yerine tek PDF daha düzenli: sıralı sayfalar, tek dosya, kolay yazdırma. Karşı taraf tek tıkla hepsini açar."],
      ["Üç adım", "JPG ve PNG dosyalarını bırakın, sırayı düzenleyin, «PDF'e Çevir» deyin. Görselleriniz cihazınızdan çıkmaz."],
      ["Asıl kalite çekimde", "Araç fotoğrafı düzeltmez. Dört kenar kadrajda olsun, gölge ve parlama olmasın, belge dik çekilsin, yazı okunsun."],
      ["Eğri ya da gölgeliyse", "Doğrudan PDF yapmayın, belge tarayıcıdan geçirin. Kenarları bulur, perspektifi düzeltir."],
      ["Sayfa sırası", "Galeri çekim saatine göre sıralar, belgenin mantığına göre değil. İki yüzlü evrakta ön ve arka yüz karışabilir."],
      ["Dosya büyük çıkarsa", "Yeni telefonların fotoğrafları 3–5 MB olabilir. On sayfa 30–50 MB eder ve e-posta sınırını aşar; sıkıştırın."],
    ],
  },
  "pdf-sifre-kaldirma-koyma": {
    hook: "PDF şifresi: kaldırmak mı, koymak mı?",
    slides: [
      ["Şifreyi kaldırmak", "Her açılışta parola girmek istemiyorsanız şifreyi kalıcı kaldırın. Şifreyi bilmeniz gerekir ve yalnızca yetkili olduğunuz belgelerde yapın."],
      ["Şifre koymak", "Sözleşme, sağlık raporu ya da mali belgeyi paylaşırken açılış şifresi ekleyin. Dosyayı yalnızca şifreyi bilenler açar."],
      ["İki ayrı parola var", "Açılış parolası belgeyi açmak için gerekir; içerik gerçekten şifrelidir. İzin parolası belgeyi açtırır ama yazdırma, kopyalama ya da düzenlemeyi kısıtlar; şifreleme kadar güçlü değildir."],
      ["Parolayı nasıl iletmeli?", "Dosyayı ve parolasını aynı e-postada göndermeyin. Dosya e-postayla, parola telefon, kısa mesaj ya da başka uygulamayla."],
      ["Parola seçerken", "Dosya adına yazmayın, her belgede aynısını kullanmayın, doğum tarihi ya da TC numarası gibi tahmin edilebilir dizi seçmeyin."],
    ],
  },
  "pdf-boyutu-kucultme-sikistirma": {
    hook: "PDF e-postaya sığmıyor mu? Boyut nasıl küçülür",
    slides: [
      ["Neden büyür?", "Boyutu en çok görseller belirler: yüksek çözünürlüklü taramalar, fotoğraflar, gömülü resimler. Metin çok az yer kaplar."],
      ["Önce gereksiz sayfa", "Taranmış belgelerde boş arka yüzler, iki kez taranmış sayfalar, işe yaramayan kapaklar birkaç MB tutabilir. Silmek çoğu zaman sıkıştırmaktan hızlıdır."],
      ["Ne kadar küçülür?", "Taranmış belgeler en çok kazandırır. Salt metin belge zaten küçüktür, 400 KB'lık sözleşmeyi 100 KB yapamazsınız. Daha önce sıkıştırılmış dosyada kazanç az, kayıp fazla."],
      ["Kaliteyi nasıl anlarsınız?", "Etki baskıda ve yakınlaştırmada görünür. En küçük yazının olduğu sayfayı %200 yakınlaştırın; harfler okunuyorsa kullanılabilir."],
      ["Yetmezse böl", "Belgeyi mantıklı parçalara ayırıp iki e-postada göndermek çoğu zaman en temiz çözümdür."],
      ["Baştan küçük tarayın", "600 DPI yerine 300 DPI, renkli yerine gri tonlama. Telefon fotoğraflarını belge tarayıcıdan geçirin. Aynı belgeyi defalarca sıkıştırmayın."],
    ],
  },
  "pdf-word-donusturme": {
    hook: "PDF'i düzenlenebilir Word'e çevirmek",
    slides: [
      ["Neden doğrudan düzenlenmez?", "PDF'te metin sabit konumlara yerleşir; bir kelimeyi değiştirince düzen bozulur. Word'de paragraflar ve tablolar yeniden akışkan olur."],
      ["Üç adım", "PDF'i yükleyin, dönüştürün, .docx dosyasını indirip Word ya da Google Docs'ta düzenleyin."],
      ["Hangi belgeler temiz döner?", "Tek sütunlu, metin ağırlıklı raporlar, dilekçeler ve sözleşmeler çok iyi. Çok sütunlu dergi düzenleri, iç içe tablolar ve metin kutusu bolluğu zorlanır."],
      ["Taranmış belge", "Önce OCR ile aranabilir hâle getirin, sonra Word'e çevirin. Aksi hâlde Word dosyasına metin değil resim gömülür."],
      ["Açar açmaz kontrol", "Tablolar bölünmüş mü, başlık stilleri doğru mu, sayfa sonları paragrafı kopardı mı, ı, ğ, ş, ç doğru geldi mi?"],
    ],
  },
  "pdf-baska-dile-cevirme": {
    hook: "Yabancı dildeki PDF'i düzeni bozmadan çevirmek",
    slides: [
      ["Kopyala-yapıştır neden yetmez?", "Başlıklar, listeler ve tablolar kaybolur; uzun belgede iş içinden çıkılmaz. Sayı, tarih ve özel isimlerin olduğu gibi kalması gerekir."],
      ["Üç adım", "PDF'i yükleyin, hedef dili seçin (12'den fazla dil), çevirin. Başlık, liste ve tablo korunur; çeviriyi kopyalayabilir ya da PDF indirebilirsiniz."],
      ["Neler çevrilmemeli?", "Kişi, kurum ve marka adları, adresler, ürün kodları ve seri numaraları, yasal metin adları ve madde numaraları, para birimi ve teknik birimler."],
      ["Teknik ve hukuki metin", "«Tazminat», «garanti», «sorumluluk» gibi kavramların karşılığı hukuk sistemine göre değişir. Aynı teknik kelime sektöre göre farklı anlaşılır."],
      ["Anlamak ile geçerlilik", "Yapay zekâ çevirisi hız ve anlama içindir. Noter, mahkeme ve resmî başvuruda yeminli tercüman şart."],
      ["İkisini yan yana tutun", "Asıl metin ile çeviriyi bir arada saklayın. Bir maddeyi tartışırken karşı tarafın gördüğüyle sizin okuduğunuz aynı olsun."],
    ],
  },
  "iki-pdf-birlestirme-ucretsiz": {
    hook: "PDF'leri kurulum ve üyelik olmadan birleştirmek",
    slides: [
      ["Dosyanız yüklenmez", "Birleştirme tamamen tarayıcınızda çalışır. İnternet kesilse bile işler."],
      ["Üç adım", "PDF'leri bırakın, yukarı ve aşağı okla sırayı ayarlayın, «Birleştir» deyin."],
      ["Sıra sorunu", "Bilgisayar dosya adlarını karakterle sıralar: «ek-10», «ek-2»'den önce gelir. Ekleri 01, 02, 10 diye numaralandırın."],
      ["Önce kapak, sonra ekler", "Kapak ya da dilekçe en başa, ekler sözleşmede geçtiği sırayla arkaya. Eklemeden önce her dosyanın ilk sayfasına bakın."],
      ["Birleştirdikten sonra", "Sayfa numarası ekleyin, boyut büyükse sıkıştırın, gereksiz boş sayfaları silin, hassas bilgi varsa göndermeden önce kalıcı kaldırın."],
      ["Şifreli PDF mi var?", "Önce şifresini kaldırmanız gerekir."],
    ],
  },
  "faturadan-excele-veri-aktarma": {
    hook: "PDF faturadaki bilgiyi Excel'e aktarmanın 3 yolu",
    slides: [
      ["Neden zor?", "PDF görüntüleme için tasarlandı. Fatura no, tarih, tutar ve kalemler sayfada görünür ama arkada düzenli bir tablo olarak durmaz."],
      ["1. Elle giriş", "Ayda birkaç fatura için olur. Onlarca faturada yavaş, yorucu ve hataya açık."],
      ["2. OCR ile metin", "Taranmış faturada önce OCR yazıyı metne çevirir. Ama hangi sayının hangi alan olduğunu yine siz kurarsınız."],
      ["3. Yapay zekâ ile çıkarma", "Fatura no, tarih, satıcı ve alıcı, vergi no, ara toplam, KDV, genel toplam ve varsa satır kalemleri yapılandırılmış çıkar. CSV ya da JSON indirin."],
      ["Onlarca fatura", "Bir seferde en fazla 25 dosya işlenir, her biri için canlı ilerleme görürsünüz. Hepsi tek CSV'de birleşir; her satır bir fatura."],
      ["Gizlilik", "PDF'inizin metni cihazınızda çıkarılır; yapay zekâya yalnızca metin gider, dosyanın kendisi yüklenmez."],
    ],
  },
};
