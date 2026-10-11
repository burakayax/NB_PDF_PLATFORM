/**
 * Elle yazılmış slayt metinleri — 1. bölüm (CV, fotoğraf, sözleşme, evrak yazıları).
 *
 * İLKELER (bkz. carouselCopy.mjs başlığı): her slaytta tek fikir, gündelik dil, yazının
 * kendi bilgisi dışında iddia yok. `hook` kapak başlığı, `slides` içerik slaytları.
 */
export const COPY_1 = {
  "cv-on-yazi-nasil-yazilir": {
    hook: "Ön yazı nasıl yazılır? Dört paragraf, tek sayfa",
    slides: [
      ["Açılış", "Hangi pozisyona başvurduğunuzu ve sizi neyin ilgilendirdiğini bir iki cümleyle söyleyin."],
      ["Kanıt", "İlandaki bir ya da iki gereksinimi, CV'nizdeki somut bir sonuçla bağlayın. Mümkünse rakamla."],
      ["Neden bu şirket?", "Bu işi ya da şirketi neden seçtiğinizi ve ona ne katacağınızı anlatın."],
      ["Kapanış", "Görüşme isteğinizi belirtin, teşekkür edin. Bir sayfayı geçmeyin; 250–350 kelime çoğu başvuruya yeter."],
      ["Bunlardan kaçının", "CV'nizi cümle cümle tekrar etmeyin, her şirkete gidebilecek genel cümleler yazmayın. Göndermeden önce yüksek sesle okuyun."],
    ],
  },
  "europass-tarzi-cv-nasil-hazirlanir": {
    hook: "Europass tarzı CV ne zaman işe yarar?",
    slides: [
      ["Düzenin mantığı", "Tarihler solda, görevler sağda. Gözünüz tarih sütunundan aşağı inerek kariyer sırasını ve boşlukları hemen görür."],
      ["Kimler tercih ediyor?", "Akademi, kamu, hukuk, sağlık ve uluslararası başvurular: Erasmus, burs ve araştırma programları gibi."],
      ["Size uyar mı?", "Kariyeriniz uzun ve düzenli ilerlediyse, tarih sıralaması sizin lehinize çalışır."],
      ["Küçük bir not", "Bu, AB'nin resmî Europass dosyası değil, ondan esinlenen bir düzen. Kurum özel şablon istiyorsa onu kullanın."],
      ["Başvuru sistemine yükleyecekseniz", "Sütunlu düzenleri bazı sistemler karıştırabilir. Emin değilseniz tek sütunlu bir şablon daha güvenli olabilir."],
    ],
  },
  "cv-is-ilanina-gore-nasil-uyarlanir": {
    hook: "Aynı CV'yi her ilana göndermeyin",
    slides: [
      ["İlanı iyi okuyun", "Zorunlu nitelikleri (\"en az 3 yıl\", \"Excel\") ve tercih sebeplerini ayrı ayrı not edin. Tekrar eden kelimeler işverenin önceliğidir."],
      ["İlanın kelimeleriyle yazın", "İlan \"paydaş yönetimi\" diyorsa ve siz \"birimlerle iletişim\" yazdıysanız, iş aynıysa ilanın kelimesini kullanın."],
      ["Ama uydurmayın", "Yalnızca ilanda geçiyor diye olmayan bir beceriyi eklemeyin. Mülakatta anlatamayacağınız bir cümle CV'de durmasın."],
      ["Eksik kelimeleri bulun", "CV Oluştur'a ilan metnini yapıştırın; hangi kelimelerin CV'nizde geçtiğini, hangilerinin geçmediğini görün."],
      ["Her ilana ayrı kopya", "Ana CV'nizi koruyun, her başvuru için bir kopya çıkarın. Aynı cihazda 12 CV'ye kadar saklanır."],
    ],
  },
  "linkedin-profil-fotografi-ipuclari": {
    hook: "LinkedIn profil fotoğrafı: ölçü ve çekim",
    slides: [
      ["Ölçü", "LinkedIn'in yardım sayfasına göre en az 400×400 piksel ve en çok 8 MB. 800×800 kare bir fotoğraf rahatça yeter."],
      ["Işık ve duvar", "Pencere önünde, düz bir duvara karşı çekin. Telefonu göz hizasında sabitleyin, arka kamerayı kullanın."],
      ["Kadraj", "Yüz kadrajın yaklaşık %60'ını kaplasın. Çok uzak da çok yakın da olmasın."],
      ["Arka plan", "Açık gri ya da açık mavi dikkati yüzünüze toplar. Fotoğraf Stüdyosu'nda arka planı kendiniz seçebilirsiniz."],
      ["Güncel olsun", "Bugünkü görünüşünüze benzesin. Yıllar önceki fotoğraf mülakatta şaşırtır."],
    ],
  },
  "vesikalik-fotograf-evde-nasil-cekilir": {
    hook: "Evde vesikalık fotoğraf nasıl çekilir?",
    slides: [
      ["Pencere ışığı", "Pencereye dönük durun, ışık yüzünüze yumuşak düşsün. Güneş sertse perde ya da tül kullanın."],
      ["Düz bir duvar", "Açık renkli, desensiz bir duvar seçin. Arka plan sonradan değişir ama düz zemin sonucu iyileştirir."],
      ["Telefonu sabitleyin", "Göz hizasında, bir yere dayayarak. Aşağıdan ya da yukarıdan çekim yüzü bozar. 1,5–2 metre uzaktan çekin."],
      ["Arka kamera, birkaç kare", "Ön kamera daha düşük kalitelidir; zamanlayıcıyla çekin. Gözün kırpılmadığı en iyi kareyi seçin."],
      ["Sonrası kolay", "Fotoğraf Stüdyosu başı doğru orana yerleştirir, arka planı beyaz yapar, ölçüye kırpar. KB sınırınız varsa yazın."],
    ],
  },
  "biyometrik-fotograf-olculeri-ve-kurallari": {
    hook: "Biyometrik fotoğraf ölçüleri: hangi ülke kaç milimetre?",
    slides: [
      ["Türkiye", "Kimlik, pasaport, ehliyet: 50×60 mm, düz beyaz arka plan. Yüz fotoğrafın yaklaşık %70–80'ini kaplar."],
      ["Schengen ve AB", "35×45 mm, baş yüksekliği yaklaşık 32–36 mm, açık ve düz arka plan."],
      ["ABD ve Birleşik Krallık", "ABD: 2×2 inç (51×51 mm). Birleşik Krallık: 35×45 mm. Başvurduğunuz yerin güncel şartını mutlaka kontrol edin."],
      ["Her yerde geçerli kurallar", "Karşıdan bakış, nötr ifade, gölgesiz düz arka plan. Filtre ve rötuş kabul edilmez; fotoğraf genelde son 6 ayda çekilmiş olmalı."],
      ["Ölçüyü kendiniz ayarlayın", "Fotoğraf Stüdyosu'nda ülkenin ön ayarını seçin, baş oranı kendiliğinden ayarlanır. e-Devlet KB sınırı koyuyorsa onu da girin."],
    ],
  },
  "cv-fotografi-nasil-olmali": {
    hook: "CV fotoğrafı nasıl olmalı?",
    slides: [
      ["Baş ve omuzlar", "Göğüs hizasına kadar bir kadraj. Yüz kadrajın yaklaşık yarısını kaplasın."],
      ["Düz ve sade arka plan", "Açık gri, açık mavi ya da beyaz. Dağınık bir oda ya da tatil manzarası dikkat dağıtır."],
      ["Yumuşak ışık", "Pencere ışığı idealdir. Arkadan gelen ışık yüzü karartır, doğrudan flaş parlama yapar."],
      ["Sık yapılan hatalar", "Grup fotoğrafını kırpmak (omuzda başka bir kol kalır), filtre kullanmak, düşük çözünürlük, yan dönük duruş."],
      ["Çerçeveye oturtun", "Çoğu şablon 3:4 dikey ya da kare alan kullanır. Fotoğrafı buna yakın oranda hazırlayın, CV'de kırpılma sorunu çıkmaz."],
    ],
  },
  "ats-uyumlu-cv-nasil-yazilir": {
    hook: "CV'nizi başvuru sistemi okuyabiliyor mu?",
    slides: [
      ["Gerçek metinli PDF", "PDF'te yazıyı fareyle seçebiliyorsanız doğru yoldasınız. Ekran görüntüsü ya da taranmış resim olarak kaydedilen CV'nin yazısı okunmayabilir."],
      ["Bilgiyi resme gömmeyin", "Telefon, e-posta ve becerileriniz logo ya da görsel değil, yazı olarak durmalı."],
      ["Bilinen başlıklar", "\"İş Deneyimi\", \"Eğitim\", \"Beceriler\". \"Yolculuğum\" gibi yaratıcı başlıklar sistemin bölümü tanımasını zorlaştırabilir."],
      ["Sade yerleşim", "Bazı sistemler çok sütunlu, tablolu ya da kutulu tasarımları yanlış sırada okur. Emin değilseniz tek sütun seçin."],
      ["İletişim bilgisi sayfa gövdesinde", "Bazı sistemler sayfanın üst ve alt kısmını okumaz. Telefon ve e-postanızı üst bilgi alanına koymayın."],
      ["1 dakikalık kontrol", "PDF'i açın, Ctrl+A ile tümünü seçip bir metin düzenleyiciye yapıştırın. Sıra ve içerik mantıklı mı, telefon ve e-posta okunuyor mu?"],
    ],
  },
  "cv-nasil-hazirlanir": {
    hook: "CV nasıl hazırlanır? Adım adım",
    slides: [
      ["Önce hedefi belirleyin", "İlanı okuyun, istenen becerileri not edin. İlanla örtüşen deneyimleri öne alın, ilgisizleri kısaltın."],
      ["Görevi değil sonucu yazın", "\"Satış raporlarını hazırladı\" bir görev. \"Fire oranını %12 düşürdü\" bir sonuç. Sayı yoksa ekip büyüklüğünü ya da ölçeği yazın."],
      ["Rakam uydurmayın", "Kesin sayı yoksa \"yaklaşık\" yazmak dürüst ve yeterli. Mülakatta sorulacağını varsayın."],
      ["Sade görünüm", "Birkaç yıllık deneyim için tek sayfa yeter. En fazla iki yazı tipi ve tek bir vurgu rengi kullanın."],
      ["PDF olarak kaydedin", "ad-soyad-cv.pdf gibi bir adla. Yazıyı fareyle seçebildiğinizi kontrol edin; başvuru sistemleri de okuyabilir demektir."],
      ["Son bir deneme", "CV'nizi bir arkadaşınıza gösterin, 30 saniye sonra neyi hatırladığını sorun. Öne çıkarmak istediğiniz şey bu değilse sıralamayı değiştirin."],
    ],
  },
  "yapay-zeka-ile-sozlesme-inceleme-nasil-calisir": {
    hook: "Yapay zekâ sözleşmeyi nasıl inceliyor? Neyi yapıp neyi yapamıyor?",
    slides: [
      ["Metin cihazınızda çıkarılır", "PDF'inizin kendisi gönderilmez; yalnızca metni analiz için sunucuya iletilir."],
      ["Önce belgeyi tanır", "Belgenin türünü ve taraflarını çıkarır, cevabı analizi değiştirecek birkaç soru sorar."],
      ["Her bulgu alıntıyla gelir", "Bulgu belgeden birebir alıntıyla verilir ve alıntı metinde aranır. Bulunamayan bulgu rapora girmez."],
      ["Sonuç belgenin üstünde", "Riskli yerler PDF'inizde boyanır; her biri için nedeni ve etkisi yazılır."],
      ["Sınırları açıkça", "Hata yapabilir, bir riski kaçırabilir. Bu bir ön değerlendirmedir, hukuki danışmanlık değil. Önemli sözleşmede avukata gösterin."],
    ],
  },
  "sozlesmede-ek-madde-celiski-oncelik": {
    hook: "Sözleşmede ek ile madde çelişirse hangisi geçerli?",
    slides: [
      ["Bir örnek", "Madde 4 teslimi 45 gün diyor, Ek-1 teknik şartname 30 gün. Madde 13 de \"çelişkide ekler geçerlidir\" diyor. Ne olur?"],
      ["Öncelik maddesini bulun", "\"Ekler geçerlidir\" yazıyorsa ekteki ayrıntı ana metni geçersiz kılabilir. Ekleri ana metin kadar dikkatle okuyun."],
      ["Madde hiç yoksa", "Hangisinin geçerli olacağı tartışmaya açıktır. Bu da uyuşmazlık demektir."],
      ["Çelişkiyi nasıl bulursunuz?", "Süre, bedel, ceza, vade gibi rakamlı konuları ana metinde işaretleyin, sonra her birini eklerde arayın."],
      ["İmzadan önce", "Çelişen yerleri karşı tarafa yazılı bildirin ve tek bir rakamda anlaşın. Görmediğiniz bir ekin sizi bağlamasına izin vermeyin."],
    ],
  },
  "ihale-sartnamesi-sozlesme-tasarisi-risk-kontrolu": {
    hook: "İhale sözleşmesinde teklif vermeden önce bakılacaklar",
    slides: [
      ["Pazarlık yok", "Teklif verdiğinizde şartnameyi ve sözleşme tasarısını kabul etmiş sayılırsınız. Asıl karar, belgeleri okurken verilir."],
      ["Belgeler birbirini tutuyor mu?", "İdari şartname 90 gün, teknik şartname 60 gün diyebilir. Önce rakamları yan yana koyun."],
      ["Gecikme cezası ve teminat", "Günlük oran, üst sınır, hangi bedel üzerinden hesaplandığı. Teminatların tutarı ve ne zaman gelir kaydedileceği."],
      ["Ödeme ve fiyat farkı", "Hakediş ne sıklıkla ödeniyor, gecikmede faiz var mı? Uzun işlerde girdi maliyeti artışına dair bir düzenleme var mı?"],
      ["Fesih", "İdare hangi hallerde feshedebilir? Feshin mali sonucu sizin için ne?"],
      ["İlk günlerde okuyun", "Açıklama ve itiraz süreleri kısadır. Belgeleri teklif gününe bırakmayın."],
    ],
  },
  "gecikme-cezasi-cezai-sart-hesaplama": {
    hook: "Gecikme cezası nasıl hesaplanır?",
    slides: [
      ["Formül", "Bedel × günlük oran × gecikilen gün. Bedeli 1.000.000 TL, günlük oranı %0,5 olan işte gün başına ceza 5.000 TL."],
      ["Küçük oran, büyük sonuç", "Günlük %0,5 ile 100 günde bedelin yarısı gider. Günlük %1'de 100 günde bedelin tamamı."],
      ["Tavan var mı?", "\"Toplam ceza bedelin %10'unu geçemez\" gibi bir üst sınır yoksa ceza bedeli aşabilir."],
      ["Hangi bedel?", "KDV dahil mi, hariç mi, yalnızca geciken kısım mı? Yazmıyorsa karşı taraf en yüksek rakamı esas alabilir."],
      ["Gecikme kimin yüzünden?", "Süre karşı tarafın onayına ya da belgesine bağlıysa, o gecikmenin size yazılmaması gerekir. Sözleşmede bunu düzenleyen bir hüküm arayın."],
      ["İmzadan önce konuşun", "Tacirler arasında cezanın sonradan indirilmesi kısıtlı olabilir. Tavan ve cezanın karşılıklı olmasını isteyin."],
    ],
  },
  "sozlesme-imzalamadan-once-kontrol-listesi": {
    hook: "Sözleşme imzalamadan önce 12 kontrol",
    slides: [
      ["Taraflar ve konu", "Unvan ve vergi numarası doğru mu? İmzayı atan şirketi bağlayabilir mi? \"Makul süre\" gibi belirsiz ifadeler sonradan tartışma çıkarır."],
      ["Bedel ve süreler", "Tutar KDV dahil mi? Vade kaç gün ve neresinden başlıyor? Teslim ve bildirim süreleri ne kadar, bildirim nasıl yapılacak?"],
      ["Ceza ve fesih", "Gecikme cezasının oranı ve üst sınırı var mı? Fesih hakkı karşılıklı mı, bildirim süresi kaç gün?"],
      ["Sorumluluk ve gizlilik", "Dolaylı zarar ve kâr kaybı nasıl düzenlenmiş? Üst sınır yalnızca bir taraf için mi? Gizlilik süresiz mi?"],
      ["Ekler ve yenileme", "Atıf yapılan her ek elinizde mi? Sözleşme kendiliğinden uzuyor mu, yenilememe için son tarih ne?"],
      ["Rakama dökün", "\"Günlük %1\" masum görünür. 2.400.000 TL'lik işte günde 24.000 TL demektir."],
    ],
  },
  "universite-kayit-evraklarini-hazirlama": {
    hook: "Üniversite kayıt evraklarını dijital hazırlamak",
    slides: [
      ["Fotoğraf çekmeyin, tarayın", "Masa görünür, kenarlar eğri, ışık bir köşeye vurur ve dosya gereksiz büyük olur. Belge tarayıcı kenarları bulup sayfayı düzleştirir."],
      ["e-Devlet'ten alınanları taramayın", "İkametgâh, nüfus kayıt örneği, adli sicil, askerlik durumu e-Devlet'ten doğrudan PDF inir. Yazdırıp taramak netliği ve barkod doğrulamasını bozar."],
      ["Fotoğraf ölçüsü", "Telefon fotoğrafı yanlış oranda ve gereğinden büyüktür. Önce vesikalık oranında kırpın, dosya hâlâ büyükse sıkıştırın."],
      ["Çok sayfa, tek dosya", "Diplomanın iki yüzü gibi çok sayfalı belgeleri tek PDF'te birleştirin. Sistem çoğu zaman alan başına tek dosya kabul eder."],
      ["Yükleme sınırına takılırsanız", "Taranmış belgeleri sıkıştırın, renk gerekmiyorsa gri tonlamada tarayın. Sıkıştırdıktan sonra en küçük yazıyı kontrol edin."],
      ["Son günü beklemeyin", "Kayıt sistemleri son gün yoğun olur. Yüklemeden önce belgeyi telefonunuzda açıp okuyun; siz zor okuyorsanız görevli hiç okuyamaz."],
    ],
  },
  "uyap-karari-word-e-aktarma": {
    hook: "UYAP kararını Word'e aktarmak",
    slides: [
      ["Neden doğrudan olmuyor?", "UDF, UYAP'ın kendi biçimi. Uzantıyı .doc yapmak işe yaramaz, yalnızca adı değişir. Aradaki köprü PDF."],
      ["Yalnızca metin lazımsa", "UDF aracının verdiği düz metni (.txt) alıp Word'e yapıştırın. En hızlısı bu; biçimlendirme gelmez ama metin gelir."],
      ["Biçim de lazımsa", "Önce UDF'yi PDF'ye, sonra PDF'i Word'e çevirin. Paragraf düzeni, kalın yazılar ve tablolar korunur."],
      ["Taranmış karar mı?", "Eski dosyalarda yazı aslında resimdir. Önce OCR'dan geçirip metne çevirmeniz gerekir."],
      ["Mutlaka karşılaştırın", "Esas ve karar numarası, tarihler, tutarlar, kanun maddeleri, taraf adları. Hukuki metinde tek bir rakam kayması ciddi sonuç doğurur."],
      ["PDF imzalı asıl değildir", "UDF'deki elektronik imza PDF'ye taşınmaz. Çevirdiğiniz dosya çalışmak ve alıntılamak için okunabilir bir kopyadır."],
    ],
  },
};
