/** Elle yazılmış slayt metinleri — 2. bölüm (başvuru evrakı, UYAP, kişisel veri, rakip karşılaştırma). */
export const COPY_2 = {
  "osym-sinav-basvurusu-fotograf-boyutu": {
    hook: "Sınav başvurusunda fotoğraf yüklenmiyor mu?",
    slides: [
      ["İstenen şartlar", "Yaygın şart: 300×400 piksel, en fazla 60 KB, JPG, son altı ayda çekilmiş, beyaz arka planlı. Başvuru ekranındaki açıklama her zaman esastır."],
      ["Piksel ile KB aynı şey değil", "Piksel ölçüsü fotoğrafın eni ve boyu. Dosya boyutu KB. 300×400 bir fotoğraf yine de 400 KB tutabilir."],
      ["Önce kırpın, sonra küçültün", "Telefon fotoğrafı 4:3 ya da 16:9, vesikalık ise 3:4. Önce 3:4'e kırpın, yüz ortada kalsın; sonra 300×400'e getirin."],
      ["Hâlâ büyükse", "Dosyayı sıkıştırın ve kaliteyi kademeli düşürün. Sonra fotoğrafı tam boyutta açıp yüzün net olduğunu kontrol edin."],
      ["Sık yapılan hatalar", "Ekran görüntüsü kullanmak, küçük fotoğrafı büyütüp bulanıklaştırmak, krem ya da gri duvarı beyaz sanmak."],
    ],
  },
  "bordro-sayfalarini-ayirma": {
    hook: "Tek PDF'teki bordroyu kişi kişi ayırmak",
    slides: [
      ["Asıl risk hata", "Maaş bilgisi en hassas verilerden biri ve yanlış kişiye gitmesi geri alınamaz. Elle ayırmak bu yüzden riskli."],
      ["Sayfaları görerek seçin", "Bordro dosyasını bölme aracına verin. Sayfalar küçük görseller olarak listelenir, kör numara girmezsiniz."],
      ["Her sayfa ayrı dosya", "Sayfalar tek tek ayrılır ve bir ZIP içinde iner. Göndermeden önce dosyaları çalışanın adıyla adlandırın."],
      ["Bordro birden çok sayfaysa", "Sayfa aralığıyla çalışın: 1–2 bir dosya, 3–4 başka bir dosya."],
      ["Göndermeden kontrol", "Rastgele üç dosyayı açıp içindeki ismin dosya adıyla aynı olduğuna bakın. Dosya sayısı çalışan sayısına eşit mi?"],
      ["Toplu e-posta göndermeyin", "Yanlış seçilmiş bir alıcı listesi bütün şirketin maaşlarını ifşa edebilir. Herkese kendi dosyasını ayrı gönderin."],
    ],
  },
  "ihale-dosyasi-pdf-hazirlama": {
    hook: "İhale teklif dosyası PDF olarak nasıl hazırlanır?",
    slides: [
      ["Şartname ne diyorsa o", "Belge sırası, dosya biçimi, adlandırma, boyut sınırı. Şartnamedeki talimata harfi harfine uyun. «Dosya», «biçim», «imza», «boyut» kelimelerini arayın."],
      ["Şartname sırasıyla dizin", "Belgeleri tek tek PDF yapın, sonra listedeki numaralara göre sıralayıp tek dosyada birleştirin."],
      ["Sayfa numarası ekleyin", "Komisyon yüz sayfalık dosyada aradığı belgeyi hızla bulur. Başa bir içindekiler sayfası koymak da işi kolaylaştırır."],
      ["Boyut ve okunaklılık", "Belgeleri gri tonlamada, 300 DPI tarayın. Kaşe ya da renkli imza sayfalarını renkli bırakın. Okunmayan belge eksik sayılır."],
      ["İmza meselesi", "İdareler genelde ıslak imza ya da nitelikli elektronik imza ister. PDF'e imza resmi koymak bu şartları karşılamaz."],
      ["Teslimden önce", "Her madde dosyada var mı? Faaliyet belgesi gibi süreli belgeler güncel mi? Yüklemeyi son saate bırakmayın."],
    ],
  },
  "vize-basvurusu-evrak-hazirlama": {
    hook: "Vize başvurusu için evrak dosyası nasıl hazırlanır?",
    slides: [
      ["Önce güncel listeyi alın", "Her ülkenin ve vize türünün listesi farklı. Konsolosluğun ya da başvuru merkezinin kendi sayfasındaki listeyi indirip her maddeyi işaretleyin."],
      ["Belgeleri doğru yoldan alın", "e-Devlet belgelerini PDF olarak indirin, ekran görüntüsü almayın. Banka dökümünü bankanın uygulamasından PDF alın."],
      ["Kâğıt belgeleri tarayın", "Telefonla fotoğraf çekmek yerine belge tarayıcıyı kullanın. Pasaport sayfalarını tam çerçevede alın; köşesi kesilmiş sayfa sık geri döner."],
      ["Fotoğraf en çok geri dönen kalem", "Kimlik ve pasaportta yaygın ölçü 50×60 mm, Schengen'de 35×45 mm. Piksel ölçüsünü tutturmak biyometrik şartı sağladığınız anlamına gelmez."],
      ["Tek PDF isteniyorsa", "Belgeleri konsolosluğun listesindeki sırayla birleştirin. Dosya sınırın üstündeyse yalnızca taranmış sayfaları sıkıştırın."],
      ["Göndermeden önce", "Yan yatmış sayfa var mı, en küçük yazı okunuyor mu, listede olmayan bir belge karışmış mı? Bu kontrol beş dakika sürer."],
    ],
  },
  "tc-kimlik-numarasi-gizleme-belge": {
    hook: "Belgedeki TC kimlik numarasını gerçekten nasıl gizlersiniz?",
    slides: [
      ["Siyah kutu gizlemez", "PDF'te çizdiğiniz kutu belgenin üstüne eklenen bir şekildir. Altındaki yazı yerinde durur."],
      ["Kendiniz deneyin", "Kapattığınız alanı fareyle seçip kopyalayın, bir metin kutusuna yapıştırın. Bilgi geliyorsa gizlemiş değil, örtmüşsünüz."],
      ["Doğrusu: veriyi silmek", "Gizleme aracı, metni belgenin içinden kaldırır. Kopyalanacak ve aranacak bir şey kalmaz. TC, telefon, IBAN gibi kalıplar otomatik bulunur."],
      ["Neyi gizlemeli?", "Resmî kuruma verirken hiçbir şeyi. İşverene verirken adres ve sağlık verisini. Emlakçıya ya da bir siteye verirken kimlik numarası ve doğum tarihini."],
      ["Belki hiç gizlemeyin", "Sekiz sayfalık dökümün altı sayfasını karartmak yerine yalnızca gereken sayfayı ayırıp gönderin. Hem daha güvenli, hem daha nazik."],
    ],
  },
  "edevlet-belgelerini-tek-pdf-yapma": {
    hook: "e-Devlet belgelerini tek PDF'te birleştirmek",
    slides: [
      ["Barkod belgenin kimliği", "Kurum barkodu okutarak belgenin gerçekten sizin adınıza üretildiğini doğrular. Barkod okunabilir kalmalı."],
      ["Yazdırıp taramayın", "PDF zaten dijital ve net. Yazdırıp taramak boyutu şişirir ve barkodun okunma ihtimalini düşürür. «PDF olarak indir»i kullanın."],
      ["Birleştirin", "Belgeleri tek seferde seçin, kurumun istediği sıraya sürükleyin, tek PDF olarak indirin."],
      ["Dosya şiştiyse", "Sebep neredeyse her zaman araya karışan taranmış bir belge. Yalnızca onu küçültüp öyle birleştirin; e-Devlet çıktılarına dokunmayın."],
      ["Kişisel veriye dikkat", "Resmî kuruma verirken hiçbir şeyi gizlemeyin. Emlakçıya ya da işverene gidiyorsa gerekmeyen alanları gerçekten silin; siyah kutu yetmez."],
    ],
  },
  "udf-dosyasi-nasil-acilir": {
    hook: "UDF dosyası nasıl açılır? Program kurmadan",
    slides: [
      ["UDF nedir?", "UYAP'ın kendi belge biçimi. Dilekçe, müzekkere ve gerekçeli kararlar bu uzantıyla iner. Sistemin dışında çoğu program açamaz."],
      ["Klasik yolun sorunu", "UYAP Doküman Editörü ücretsiz ama kurulum ister, bazen Java gerekir. Karşı tarafın da aynı programı kurması gerekir."],
      ["Kurulumsuz yol", "UDF dosyasını alana bırakın, «PDF'e çevir»e dokunun. Dönüşüm tarayıcınızda yapılır; yazı biçimi, tablolar ve görseller korunur."],
      ["Metni ayrıca alın", "İsterseniz belgedeki yazıyı .txt olarak da indirip Word'e kopyalayabilirsiniz."],
      ["PDF imzalı asıl değildir", "Okumak, arşivlemek, müvekkile göndermek için uygundur. Resmî işlemde imzalı UDF aslını kullanın."],
      ["Karşı taraf açamıyor mu?", "Sistem dışına çıkan her belgeyi PDF gönderin."],
    ],
  },
  "uyap-belge-yukleme-boyut-hatasi": {
    hook: "UYAP'a belge yüklenmiyor mu? Boyut hatasının çaresi",
    slides: [
      ["Önce sebebi bulun", "Üç sebep olur: boyut sınırı aşılmış, biçim kabul edilmiyor ya da dosya bozuk veya parolalı. Küçük bir test PDF'iyle deneyin."],
      ["Şişiren şey eklerdir", "Dilekçe birkaç yüz KB'tır. Dosyayı onlarca MB yapan, yüksek çözünürlükte renkli taranmış ekler ve telefon fotoğraflarıdır."],
      ["Sıkıştırın, sonra gözle bakın", "Dosyayı sıkıştırın, en küçük puntolu sayfayı açıp okunduğundan emin olun. Hâlâ büyükse dilekçe ve ekleri ayrı yükleyin."],
      ["Baştan doğru tarayın", "Gri tonlama, 300 DPI. Renkli mühür yoksa renk dosyayı üç katına çıkarır. Telefonda fotoğraf yerine belge tarayıcıyı kullanın."],
      ["UDF'nin ayrı sınırı", "Uygulamada 10 MB üzerindeki UDF'ler kabul edilmiyor diye bildiriliyor. Sebep genelde yapıştırılmış görseller; onları ek olarak ayrı yükleyin."],
      ["Yüklemeden önce", "Dosya parolalı mı, sayfalar doğru yönde mi, konu dışı bir belge karışmış mı? Bir dakikalık kontrol son gün krizini önler."],
    ],
  },
  "sejda-alternatifi-saatlik-limit": {
    hook: "Sejda'da saatte 3 işlem sınırına mı takıldınız?",
    slides: [
      ["Sınır neyi kapsıyor?", "Sejda ücretsiz planda saatte 3 işlem veriyor ve bu tüm araçları kapsıyor. Üyelik gerekmemesi iyi bir taraf."],
      ["Sejda'nın iyi olduğu yerler", "Metni gerçekten düzenleyebilen az sayıdaki çevrimiçi araçtan biri, masaüstü sürümü var, haftalık 5 dolarlık geçiş kartı esnek."],
      ["Sayfa işleri sunucu istemez", "Birleştirme, bölme, döndürme, kırpma, silme, sıralama tarayıcıda yapılabilir. Dosya yüklenmez, sayacak bir sunucu işi de kalmaz."],
      ["Bizde nasıl?", "Bu araçlar PDF Platform'da tarayıcıda çalışır: saatlik ve günlük sınır yok, üyelik yok, dosya başına 80 MB'a kadar."],
      ["Dürüst olalım", "Word'e çevirme, OCR ve sıkıştırma bizde de sunucuda çalışır ve ücretsiz planda günlük hak var. Bu araçlarda biz de sınırlıyız."],
      ["Kendiniz deneyin", "Birleştirme aracını açın, interneti kesin, birleştirin. Tamamlanıyorsa işlem cihazınızda yapılıyor demektir."],
    ],
  },
};
