# Rakip Karşılaştırma Raporu — iLovePDF ve Sejda

**Tarih:** 7 Ekim 2026 (güncellendi: 9 Ekim 2026 — eksik listesinin büyük bölümü kapatıldıktan sonra)
**Amaç:** Rakiplere eşit olmak değil, onları geçmek. Geçemediğimiz yerde en az onlar kadar kaliteli olmak.

## Nasıl ölçtük

Aynı test dosyalarını iLovePDF ve Sejda'nın ücretsiz sürümüne yükledik, çıkan dosyaları indirdik. Aynı dosyaları kendi motorumuzdan geçirdik. Sonra boyut, görsel kalite, yazı tipi, Türkçe karakter ve içerik kaybı açısından karşılaştırdık. Giriş yapmak gerekmedi.

**Sınırlar (okurken bilin):**
- Her araç için tek bir küçük test dosyası kullanıldı. Sonuçlar yön gösterir, kesin hüküm değildir.
- Word/Excel/PowerPoint→PDF'in bizim tarafı bu bilgisayarda gerçek Microsoft Office ile çalıştı. Canlı sunucumuz farklı bir motor (LibreOffice) kullanıyor, bu üç aracın sonucu canlıyı temsil etmiyor. HTML→PDF'in bizim tarafı bu bilgisayarda çalışmadı (bileşen kurulu değil), canlıda ayrıca denenmeli.
- Yapay zekâ araçları ve ücretli araçlar denenmedi.
- **Denenemeyenler:** Kırp (iLovePDF'te dosya seçme alanı yalnızca yerel dosya penceresiyle çalışıyor, otomasyonla yüklenemiyor), Organize, Düzenle, İmzala, Form doldur, Gizle (redact), Karşılaştır, ve Sejda'nın bizde olmayan araçları (n-up, üst/alt bilgi, gri tonlama, boyutlandırma, Bates, yer imi vb.). Bunlar için ayrı bir tur gerekir.

## İlk raporda yanlış söylediklerim (düzeltme)

- "Filigranda önizleme yok" demiştim. **Var**: arayüzde renk, yazı tipi ve saydamlığı gösteren küçük canlı önizleme mevcut. Eksik olan, gerçek sayfa üzerinde sürükleyip konumlandırma.
- "PDF→JPG'de çözünürlük ve PNG yok" demiştim. **Var**: Ekran/Normal/Baskı çözünürlüğü ve PNG zaten vardı. Gerçek eksikler sayfa seçimi, TIFF ve dosyaya çözünürlük etiketi yazılmasıydı.
- Sitedeki filigran SEO metni "logo/görsel filigranı eklenir" diyordu ama aracımızda böyle bir özellik **yoktu** (yanlış iddia). Bu oturumda özellik gerçekten eklendi ve metin gerçeğe uygun yeniden yazıldı.

## Genel tablo (güncel)

| Araç | Durum | Not |
|---|---|---|
| Sıkıştırma | **Düzeltildi → rakiplerin önünde** | Varsayılan 1103 KB / 32,8 dB: iLovePDF'ten (1136 KB / 32,3) hem küçük hem kaliteli, Sejda'dan (1238 KB / 33,5) %11 küçük, kalite farkı 0,7 dB |
| PDF→Word | **Önde** | Başlıklar, yazı tipi, puntolar korunuyor; rakipte başlık kaybı / satır satır parçalama |
| PDF→Excel | Önde (az farkla) | Veri aynı, bizim çıktı daha temiz |
| PDF→PowerPoint | Eşit | |
| PDF→JPG | **Düzeltildi → rakiple eşit/önde** | Sayfa seçimi, TIFF, DPI etiketi eklendi; çözünürlük seçimi zaten vardı |
| JPG→PDF | **Önde** | Rakip görseli sessizce bozuyor; bizde özgün JPG baytları korunuyor |
| Word/Excel/PPT→PDF | Eşit görünüyor (ölçüm sınırlı) | Bkz. sınırlar |
| Birleştir / Böl / Döndür / Kilit aç / PowerPoint→PDF | Eşit | Bizim çıktılar genelde biraz daha küçük |
| Şifrele | **Önde** | Biz AES-256, iLovePDF ücretsiz sürümde eski RC4 128-bit; çıktımız yarı boyutta |
| Sayfa sil | **Hata düzeltildi → önde** | Bitişik olmayan sayfalar silinince dosya iki katına çıkıyordu; şimdi 2109 KB → 574 KB (iLovePDF 1056 KB) |
| Sayfa numarası | **Düzeltildi → rakiple eşit** | 6 konum, yazı boyutu/rengi, sayfa aralığı, "Sayfa X / Y" biçimi eklendi. Eksik: kenar boşluğu ayarı, yazı tipi seçimi, karşılıklı sayfa modu |
| Filigran | **Düzeltildi → rakiple eşit/önde** | Açı, boyut, sayfa aralığı, %100 opaklık, **logo/görsel filigranı (saydam PNG dahil)** eklendi; dosya şişmesi giderildi (1223 → 674 KB). Eksik: sayfa üzerinde sürükleyerek konumlandırma |
| Onarım | **Düzeltildi** | Eskiden ilk yöntemin bozuk sayfasını teslim ediyordu; artık tüm yöntemleri kıyaslayıp en sağlamını seçiyor. Kesik dosyada 6 sayfanın hepsi kusursuz (bizde görseller yeniden sıkıştırılmıyor; iLovePDF yeniden sıkıştırıyor) |
| OCR (aranabilir yapma) | Eşit | İkisi de %99,9 doğruluk; ikisi de ₺ simgesini $ olarak okudu |
| PDF/A | **Fırsat** | iLovePDF'te ücretli ("Premium"); bizde hangi planda olduğunu kontrol edin |
| HTML→PDF | Ölçülemedi | iLovePDF yalnızca adres (URL) alıyor; bizimki canlıda denenmeli |

## Artılarımız (SEO'da kullanılabilir olanlar işaretli)

1. **Şifreleme güvenliği (AES-256).** ✅ SEO'ya yazıldı.
2. **PDF→Word kalitesi.** Tek dosyayla ölçüldü ve canlı motorun (Docling) bu testte kullanılıp kullanılmadığı doğrulanmadı; bu yüzden SEO'ya iddia olarak **yazılmadı**. Canlıda aynı testi yapınca yazılabilir.
3. **Görsel bozmama.** ✅ JPG→PDF (cihazda özgün JPG baytları korunuyor, kodla doğrulandı) ve Onarım (görseller yeniden sıkıştırılmaz) SEO'ya yazıldı.
4. **Dosya boyutu.** Birleştirme, kilit açma, şifreleme, sayfa silme, filigran çıktılarında rakiplerden küçük.
5. **Türkçe doğruluğu.** Filigranda İ, Ş, Ğ, ı eksiksiz ve seçilebilir gerçek metin (Sejda filigranı çizgi şekli olarak çiziyor, seçilemez). ✅ SEO'ya yazıldı.
6. **Rakipte ücretsiz sürümde olmayan araçlarımız.** Cihazda çalışan kesit alma, üstveri temizleme, belge tarama, sözleşme denetçisi, yapay zekâ özetleme/sohbet/veri çıkarma, UDF dönüştürme.

## Eksik araç listesi (Sejda ve iLovePDF'te olup bizde olmayanlar)

Kendi araç listemizle iki sitenin araç listelerini yan yana koydum. **Not:** "Kırpma" ve "üst/alt bilgi" için kullanıcının itirazı kısmen haklıydı: Kesit Al aracı bir alanı seçip resme/PDF'e çeviriyor, üst/alt bilgi yalnızca sayfa numarası olarak vardı. Tüm sayfaların kenarını kırpan ve serbest metin yazan araçlar yoktu; bu iki boşluk **8 Ekim'de kapatıldı** (aşağıda).

**Kapatılanlar (bu turda)**
| Araç | Nasıl |
|---|---|
| Sayfa Kırp (Sejda "Crop", iLovePDF "Crop") | Yeni araç: elle mm veya **otomatik içeriğe göre kırpma** (rakiplerde yok), sayfa aralığı, "hepsini aynı ölçüye", döndürülmüş sayfalarda doğru kenar |
| Üst / Alt Bilgi (Sejda "Header & Footer") | Sayfa Numarası aracına eklendi: 6 konuma serbest metin, `{sayfa} {toplam} {tarih} {dosya}` yer tutucuları, Türkçe karakter |
| Boyuta / her N sayfaya / yer imine göre bölme (Sejda) | Böl aracına 3 yeni kip eklendi. Boyuta göre bölme gerçek dosya boyutuyla ölçülüyor; tek sayfası sınırı aşan sayfa kendi dosyasına konup ZIP içine uyarı notu yazılıyor. **Not:** bu üç kip üye girişi ile sunucuda çalışıyor (misafir sayfası yalnızca tarayıcıdaki iki kipi bilir) |
| Gri Tonlama (Sejda) | Yeni araç: görseller griye, renk komutları gri komutlara çevriliyor; metin seçilebilir kalıyor (test: renk farkı 255 → 0) |
| Sayfa Boyutlandırma (Sejda) | Yeni araç: A3/A4/A5/A6/Letter/Legal/özel; yön, sığdır/doldur/esnet, kenar boşluğu; içerik vektör kalıyor |
| Ayna / Çevir (Sejda) | Yeni araç: yatay/dikey, sayfa aralığı; döndürülmüş sayfalarda ekrandaki yöne göre |
| Dönüşümlü Birleştirme (Sejda "Alternate & Mix") | Yeni araç: 2–10 PDF'i sırayla serpiştirir, "ikinciyi ters oku" (çift taraflı tarama) |

**Bu turda ayrıca yapılanlar (9 Ekim)**
| Madde | Karar / sonuç |
|---|---|
| **Bates numarası** | Ayrı araç yazılmadı. Sayfa Numarası / Üst-Alt Bilgi aracına sıfırla doldurma eklendi (`DAVA-{sayfa:6}` → `DAVA-000147`) ve kesintisiz numaralama için başlangıç numarası kullanımı arayüzde anlatıldı. |
| **Misafir için bölme (her N sayfa, boyuta göre)** | Artık giriş gerekmeden, tarayıcıda çalışıyor. Yalnızca "yer imine göre" bölme giriş gerektiriyor. |
| **Üstveri düzenleme** | Üstveri aracında Başlık/Yazar/Konu/Anahtar kelime alanlarına yeni değer yazma eklendi (boş bırakılan silinir, yazılan yeni değer olur). |
| **Eğri tarama düzeltme** | Yeni araç (Deskew): taranmış sayfaların eğriliğini otomatik bulup düzeltir; yazı katmanlı sayfalara dokunmaz. Sentetik testte ±7° içinde açıyı 0,00° hatayla buldu; gerçek taramalarda doğruluk ayrıca denenmeli. |
| **Dosya yeniden adlandırma** | Bilerek YAPILMADI: yalnızca çok sayıda belgeyi içeriğe göre adlandırmak isteyen küçük bir kitleye hitap ediyor. |
| **Yer imi düzenleme** | Şimdilik yapılmadı (düşük talep, büyük arayüz işi). Yer imleri "yer imine göre böl" kipinde kullanılıyor. |

**Hâlâ eksik olanlar**
| # | Araç | Kimde var | Not |
|---|---|---|---|
| 1 | **Yer imi düzenleme / başlıklardan otomatik yer imi üretme** | Sejda (düzenleme) | Düşük öncelik; otomatik üretme rakiplerde yok, fark yaratabilir ama emek ister |
| 2 | **Yer imine göre bölmenin tarayıcıda yapılması** | — | Şu an giriş gerekiyor |
| 3 | **PDF → Markdown** | iLovePDF | Küçük kitle |
| 4 | **Otomatik iş akışı** (araçları zincirleme) | Sejda "Workflows" | Büyük iş; bizde "sonraki araç" önerisi var |
| 5 | **Not/yorum silme** | Sejda | Düzleştir kısmen karşılıyor |

Bizde olup rakipte (ücretsizde) olmayanlar: cihazda kesit alma, üstveri temizleme, belge tarama, sözleşme denetçisi, yapay zekâ özetleme/sohbet/veri çıkarma, UDF dönüştürme, e-imza isteği, belge karşılaştırma (iLovePDF'te ücretli), hassas veri gizleme (iLovePDF'te ücretli).

## Diğer kalan eksikler

1. Sayfa numarasında kenar boşluğu ve yazı tipi seçimi, karşılıklı sayfa modu.
2. Filigranı gerçek sayfa üzerinde sürükleyip konumlandırma ve şablon kaydetme (Sejda'da var).
3. Onarım: bir sayfa gerçekten kurtarılamadığında kullanıcıyı uyarmıyoruz (en iyi sonuç sessizce teslim ediliyor).
4. Sıkıştırmada en yüksek kalite seviyesi ücretsiz planda kapalı.
5. Sayfa Kırp, kırpılan kısmı dosyadan silmez (rakipler de silmez); arayüzde bu açıkça yazıyor.

## Bu oturumda yapılan değişiklikler

**Kodda (hepsi test edildi; sunucu 258, ön yüz 983, API testleri geçiyor; henüz kaydedilmedi/canlıya alınmadı):**
- Sıkıştırma varsayılan kalitesi yükseltildi.
- Sayfa silme dosya şişmesi hatası düzeltildi.
- Sayfa numarası: 6 konum, boyut, renk, sayfa aralığı, yeni biçim (arayüz + sunucu + toplu işlem).
- Filigran: açı, boyut, sayfa aralığı, %100 opaklık, logo/görsel filigranı, dosya şişmesi giderildi (arayüz + sunucu + toplu işlem).
- PDF→görsel: sayfa seçimi, TIFF, DPI etiketi; toplu işlemde çözünürlük seçimi artık dikkate alınıyor (eskiden yok sayılıyordu).
- Onarım: en sağlam yöntemi seçme, eksik sayfa kontrolü.
- Sayfa numarası kutusu küçük kalınca numaranın sessizce çizilmemesi hatası düzeltildi.
- **Yeni araç: PDF Kırp** (elle / otomatik, aralık, aynı ölçü; sunucu ucu, kota ve kayıt tabloları, katalog, kenar çubuğu, arayüz, TR+EN SEO sayfası, sitemap).
- **Yeni araçlar (8 Ekim, 2. tur):** Gri Tonlama, Sayfa Boyutu, Çevir (Ayna), Dönüşümlü Birleştir — her biri sunucu ucu, kota/kayıt tabloları, katalog, kenar çubuğu, arayüz, TR+EN SEO sayfası ve testlerle.
- **Böl aracına 3 yeni kip:** her N sayfada bir, boyuta göre (MB), yer imine göre (arayüz + sunucu + testler + SEO).
- **9 Ekim:** Bates (sıfırla doldurma), misafir için tarayıcıda bölme kipleri, üstveri düzenleme, yeni araç Eğri Tarama Düzeltme.
- **Üst/alt bilgi:** Sayfa Numarası aracında serbest metin, 6 konum, yer tutucular, yalnızca-metin kipi (arayüz + sunucu + toplu işlem).
- Yeni testler: `tests/pdf/test_rakip_farklari.py` (motor), `tests/test_rakip_farklari_uclar.py` (sunucu uçları).

**SEO metinlerinde (`seoContent.mjs`, TR+EN) ve üretilen sayfalarda:** şifreleme (AES-256), JPG→PDF (özgün kalite), PDF→JPG, filigran (yanlış logo iddiası gerçek özellikle değiştirildi), sayfa numarası, onarım. Not: "Görsel filigran" iddiası yalnızca bu değişiklikler canlıya alınınca doğru olur; **canlıya alma ile SEO metinleri aynı anda yayınlanmalı.**

## Canlıya almadan önce

- Değişiklikler başka oturumların yarım işleriyle aynı dosyalarda (ön yüzün ana dosyası dahil). Birlikte kaydedilirse onların yarım işi de karışır; kaydetmeden önce ayrıştırılmalı.
- Canlıda ayrıca denenmesi gerekenler: filigran/numara arayüzü, görsel filigran yükleme, HTML→PDF, PDF→Word çıktısı (canlı motor).
- Sonra: Google Search Console'da değişen araç sayfalarının yeniden indekslenmesi istenebilir.
