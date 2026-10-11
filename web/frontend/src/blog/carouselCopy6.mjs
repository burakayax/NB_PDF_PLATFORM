/** Elle yazılmış slayt metinleri — 6. bölüm (dönüştürme, tarama, OCR, işaretleme, filigran, imza). */
export const COPY_6 = {
  "pdf-jpg-resme-cevirme": {
    hook: "PDF'i JPG'ye çevirmek: her sayfa ayrı görsel",
    slides: [
      ["Ne zaman işe yarar?", "Tek bir sayfayı sosyal medyada paylaşmak, web sayfasına ya da sunuma koymak, PDF açamayan birine hızlıca göstermek."],
      ["Üç adım", "PDF'i yükleyin, her sayfa ayrı JPG ya da PNG olsun, tek tek ya da ZIP olarak indirin."],
      ["JPG mi, PNG mi?", "JPG küçüktür, fotoğraf ve yoğun sayfalarda iyi. PNG keskin kenarı ve yazıyı korur, logo, diyagram ve çok metinli sayfalarda daha iyi."],
      ["Sayfanın tamamı resim olur", "Yalnızca içindeki fotoğraf ya da logoyu özgün kalitede istiyorsanız sayfayı çevirmeyin, gömülü görselleri çıkarın."],
      ["Çözünürlük geri dönmez", "Düşük çözünürlükte üretilen görseli sonradan netleştiremezsiniz. Ekran görüntüsü de ekranınızın çözünürlüğüyle sınırlıdır."],
      ["Yazı artık metin değil", "Görsele çevrilen sayfadaki yazıyı arama motorları okuyamaz. Önemli metni ayrıca yazıyla da verin."],
    ],
  },
  "word-pdf-cevirme": {
    hook: "Word belgesini göndermeden önce PDF'e çevirin",
    slides: [
      ["Neden PDF?", "Karşıdaki farklı Office sürümü ya da eksik yazı tipi düzeni kaydırabilir. PDF herkeste birebir aynı görünür."],
      ["Üç adım", ".doc, .docx, .odt ya da .rtf dosyasını yükleyin, dönüştürün, önizleyip indirin."],
      ["Önce Word'de hazırlık", "Değişiklik izlemeyi kapatın ve düzeltmeleri kabul edin, yorumları temizleyin, içindekiler ve alan kodlarını güncelleyin."],
      ["Belge özellikleri", "Yazar adı ve şirket bilgisini gözden geçirin; PDF'e taşınabilir."],
      ["Yazı tipi neden kayar?", "Word dosyası yazı tipini içine gömmez, yalnızca adını taşır. Arial, Times New Roman ve Calibri gibi yaygın yazı tipleri en güvenlisi."],
      ["CV gönderiyorsanız", "Word'den doğrudan PDF üretin. Ekran görüntüsü ya da resim olarak dışa aktarırsanız yazı okunamaz."],
    ],
  },
  "camscanner-ucretsiz-gizli-alternatif": {
    hook: "Belge taramak için uygulama kurmak şart mı?",
    slides: [
      ["Uygulamalarda sık görülenler", "Üyelik, ücretsiz sürümde filigran, reklam ve belgeyi işlemek için bulutlarına yükleme. Hassas belgede sonuncusu tek başına yeterince rahatsız edici."],
      ["Tarayıcıda çalışıyor", "Telefonunuzun tarayıcısında açılır, kurulum yok. Kamera görüntüsü, kenar bulma, perspektif düzeltme ve PDF oluşturma cihazınızda yapılır."],
      ["Ücretsiz olanlar", "Tarama, kenar bulma, perspektif düzeltme, Renkli, Gri ve Siyah-Beyaz filtre, PDF kaydetme ve paylaşma. Üyelik istemez, tek taramada 3 sayfa."],
      ["Pro ne ekler?", "Gölgeleri temizleyen «Otomatik» filtre, tek taramada sınırsız sayfa ve Ctrl+F ile aranabilir PDF (OCR). Hepsi yine cihazınızda çalışır."],
      ["Kimler için?", "Ara sıra belge tarayan, telefona bir uygulama daha kurmak istemeyen, kimlik ve sözleşmeyi buluta yüklemeden dijitalleştirmek isteyenler için."],
    ],
  },
  "belge-fotografini-kaliteli-pdf-yapma": {
    hook: "Belge fotoğrafı neden «tarama» gibi durmuyor?",
    slides: [
      ["Eğri çıkıyor", "Belgeyi tam tepeden çekmediğiniz için kenarlar paralel çıkmaz. Tarayıcı dört köşeyi bulup belgeyi karşıdan bakılmış gibi düz bir dikdörtgene çevirir."],
      ["Gölge ve soluk zemin", "Işık eşit gelmez, bir kenar koyu kalır. «Otomatik» filtre arka plan aydınlatmasını dengeler, zemini beyaza yaklaştırır, yazıyı keskinleştirir."],
      ["Hangi filtre?", "Renkli: logolu ve renkli faturalar. Gri: metin ağırlıklı belgeler, daha küçük dosya. Siyah-Beyaz: en keskin yazı ve en küçük dosya."],
      ["İyi çekim için", "Belgeyi düz zemine koyun, üstten çekin, gölge düşürmeyin. Kamerayı sabit tutun; kenarlar yeşil çerçeveyle işaretlenir ve belge kendiliğinden yakalanır."],
      ["Sonrası", "Dosya büyükse sıkıştırın. Sayfaları yeniden sıralayabilir, döndürebilir ya da silebilirsiniz."],
    ],
  },
  "aranabilir-pdf-olusturma-ocr": {
    hook: "Taranmış PDF'te neden kelime aratamıyorsunuz?",
    slides: [
      ["Sebep", "Taranan PDF'teki yazı bilgisayar için metin değil, piksellerden oluşan bir resimdir. Kelime aratamaz, cümle kopyalayamazsınız."],
      ["Aranabilir PDF nedir?", "Görüntünün üstüne hizalanmış, gözle görünmeyen bir metin katmanı eklenmiş PDF. Göze aynı görünür ama arkada gerçek metin durur."],
      ["OCR ne yapar?", "Görüntüdeki yazıyı okur, her kelimenin metnini ve konumunu çıkarır, kelimeleri görüntünün üstüne görünmez olarak yerleştirir."],
      ["Cihazınızda yapılır", "Belgeyi tarayın ya da taranmış PDF'i açın, «Aranabilir PDF yap»ı seçin. Türkçe ve İngilizce tanınır; ş, ğ, ı, İ dahil. Belge sunucuya gitmez."],
      ["Nerede işe yarar?", "Yüzlerce taranmış belge arasında kelimeyle arama, sözleşme ya da faturada tutar bulma, ders notlarında konu arama, ekran okuyuculara erişilebilirlik."],
    ],
  },
  "telefonla-belge-tarama-pdf": {
    hook: "Telefonla belge tarayıp PDF yapmak",
    slides: [
      ["Uygulama kurmadan", "Telefonunuzda pdfplatform.app'i açıp «Belge Tara»ya dokunun. Kenar bulma, perspektif düzeltme ve PDF oluşturma cihazınızda çalışır."],
      ["Kamerayı belgeye tutun", "Belgenin kenarları canlı olarak yeşil çerçeveyle işaretlenir. Işık iyiyse ve belge zeminden ayrışıyorsa kenarlar hemen bulunur."],
      ["Köşeler tutmadıysa", "Köşeleri elle sürükleyerek düzeltin. Sonra Renkli, Gri ya da Siyah-Beyaz filtreyi seçin."],
      ["Çok sayfalı belge", "Sayfaları arka arkaya tarayın; her biri küçük önizleme olarak eklenir. Sırayı görür, istemediğinizi silersiniz. Sonunda «PDF Oluştur»."],
      ["Belgeniz cihazınızdan çıkmaz", "Kimlik, sözleşme ya da fatura tararken en büyük endişe dosyanın sunucuya gitmesi. Burada kamera görüntüsü ve PDF üretimi tarayıcınızda yapılır."],
    ],
  },
  "pdf-uzerine-yazma-isaretleme": {
    hook: "PDF'e fosforlu, not ve çizim ekleyin",
    slides: [
      ["Hangi araçlar var?", "Fosforlu, serbest kalem (düz çizgi modu da var), kutu, ok ve metin. Her biri için renk ve kalınlık seçebilirsiniz."],
      ["Dört adım", "PDF'i açın, aracı ve rengi seçin, sayfada çizin. «Seç» aracıyla işareti taşıyın, boyutlandırın, Ctrl+Z ile geri alın."],
      ["Yazı silinmez", "İşaretler belgenin üzerine eklenir. Fosforlu ve kalem yarı saydamdır, altındaki yazı okunmaya devam eder."],
      ["Karıştırmayın", "İşaretleme: katman ekler. Düzenleme: yazıyı gerçekten değiştirir. Kalıcı kaldırma: metni belgeden çıkarır; kişisel veri gizlemenin tek doğru yolu."],
      ["Başkası okuyacaksa", "Yalnızca fosforluyla boyanmış paragraf karşı tarafa «burada ne var?» sorusunu bırakır. Yanına bir not yazın."],
      ["Sözleşme incelerken", "Önce tutar, tarih ve süre içeren yerleri, sonra yükümlülük bildiren cümleleri, en sonda belirsiz bulduklarınızı işaretleyin."],
    ],
  },
  "pdf-filigran-ekleme": {
    hook: "PDF'e filigran nasıl eklenir? Metin, renk, saydamlık",
    slides: [
      ["Ne işe yarar?", "Belgenin durumunu belirtir (TASLAK, GİZLİ), şirketinizi ya da sitenizi basar, izinsiz paylaşımı caydırır."],
      ["Dört adım", "PDF'i yükleyin, filigran metnini yazın, rengi, yazı tipini ve saydamlığı ayarlayın, önizleyip indirin."],
      ["Saydamlık", "Çok koyu olursa yazıyı okumayı zorlaştırır, çok soluksa fark edilmez. %10–20 çoğu belge için ideal."],
      ["Ne yazmalı?", "Yalnızca «Kopya» pek bilgi vermez. «Kopya, 12.03.2026, Muhasebe» sızdığında nereden çıktığını anlatır."],
      ["Filigran engellemez, caydırır", "Kopyalamayı, yazdırmayı ya da paylaşmayı durdurmaz. Gerçek koruma için PDF'i parolayla şifreleyin."],
      ["Sürümleri ayırın", "Aynı sözleşmenin beş sürümü dolaşırken yanlış sürümü imzalamak gerçek bir risk. Taslaklara sürüm ve tarih filigranı koyun."],
    ],
  },
  "pdf-e-imza-atma-nasil-yapilir": {
    hook: "PDF'e yazdırmadan imza atmak",
    slides: [
      ["Yazdır, imzala, tara: gerek yok", "Hem zaman hem kalite kaybı. PDF'e doğrudan imza görselinizi yerleştirmek çok daha temiz."],
      ["İmzanız üç şekilde", "Parmak ya da fareyle çizin, adınızı el yazısı yazı tipiyle yazın, ya da hazır imza görselinizi yükleyin. Şeffaf PNG en iyisi."],
      ["Yerleştirin", "İmzayı sürükleyerek taşıyın, köşeden boyutlandırın, tutamakla döndürün. Çok sayfalıysa «Tüm sayfalara uygula» aynı yere kopyalar."],
      ["Tarih ve not ekleyin", "İmzanın yanına tarih ve «Okudum, onaylıyorum» gibi serbest metin de koyabilirsiniz."],
      ["Gizli belge olabilir", "İmzanız ve dosyanız sunucuya gitmez; imzalama tarayıcınızda yapılır."],
      ["Bilmeniz gereken", "Bu, görsel imzadır; kira formu, teklif ve dilekçe gibi belgelerin çoğuna yeter. Resmî kurumların istediği nitelikli elektronik imza (NES) ayrı bir e-imza cihazı ya da sertifikası ister."],
    ],
  },
};
