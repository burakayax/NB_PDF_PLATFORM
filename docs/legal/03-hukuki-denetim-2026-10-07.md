# Hukuki Denetim Raporu — PDF PLATFORM (NB Global Studio)

Tarih: 7 Ekim 2026
Kapsam: canlı site (pdfplatform.app), kaynak kodu, veritabanı şeması, yasal metinler, e-posta şablonları, ödeme ve abonelik akışı.
Yöntem: Her bulgu kodda, canlı sitede veya resmi kaynakta doğrulandı. Doğrulanamayan şeyler "SİZDEN GEREKEN" bölümüne ayrıldı; varsayım yapılmadı.

> Bu rapor bir hukuk bürosu görüşü değildir. Şirket avukatınızla ve mali müşavirinizle birlikte gözden geçirilmelidir. Mevzuat atıfları araştırmayla doğrulandı (kaynaklar sonda).

---

## Güncelleme (7 Ekim, aynı gün)

Şirket sahibinin yanıtları ve yapılan işler:

- **Şirket henüz kurulmadı.** nbpdf.app ve nbglobalstudio.com sahibine ait değil; metinlerden çıkarıldı (pdfplatform.app yazıldı). Ödemeler açılmadan önce şirket (veya en azından şahıs işletmesi/vergi mükellefiyeti) kurulmalı; aksi halde satıcı bilgisi, fatura ve iyzico üye işyeri başvurusu tamamlanamaz.
- **Otomatik yenileme (K2):** Abonelik Sözleşmeleri Yönetmeliği (kapsamında "yazılımlar ve diğer periyodik hizmetler" var) belirli süreli aboneliklerde "kendiliğinden uzar" hükmünü yasaklıyor; uzatma ancak sözleşme kurulduktan SONRA, süre bitmeden önce tüketicinin talebi/onayıyla yapılabilir; onaysız uzatmada bedel istenemez. Bu yüzden kurulacak sistem "otomatik tahsilat" değil **"onaylı yenileme"**: süre bitmeden hatırlatma + tek tıkla onay + kayıt. Metinler ve e-postalar buna göre düzeltildi (checkout, profil, hatırlatma e-postası, Hizmet Şartları, Mesafeli Satış).
- **Kayıt kaybı (K1):** Hesap silinirken ödeme/fatura satırları kullanıcıya bağlı olmayan `financial_record_archives` tablosuna kopyalanıyor (10 yıl). Yönetim panelinde yıllık muhasebe dökümü (CSV) eklendi. Kopya yazılamazsa hesap silinmiyor.

---

## 0. Özet

| Öncelik | Adet | Anlamı |
|---|---|---|
| KRİTİK | 5 | Para cezası, mahkeme veya kayıt kaybı riski doğrudan var |
| YÜKSEK | 8 | Kendi metinlerinizle çelişki, eksik zorunlu bilgi |
| ORTA | 7 | Düzeltilmesi gereken zayıflık |
| DÜŞÜK | 4 | İyileştirme |

**Genel tablo:** Teknik tarafta iyi şeyler yapılmış (ticari e-posta izin kapısı, imza modülündeki rıza ve denetim izi, TC kimlik şifreleme, kart bilgisi saklamama, ücretsiz araçlarda cihazda işleme, Sentry/GA çerez onayına bağlı). Asıl sorun **metinler ile gerçek arasındaki tutarsızlıklar** ve **şirket kimliğinin hiçbir yerde yazmaması**.

---

## 1. KRİTİK

### K1. Hesap silinince fatura ve ödeme kayıtları da siliniyor
- **Kanıt:** `auth.service.ts` hesap silme fonksiyonu kullanıcıyı doğrudan siliyor (`prisma.user.delete`). Şemada `PaymentCheckout`, `Invoice` ve `OperationLog` kullanıcıya bağlı ve silme zinciri "Cascade". Yani kullanıcı hesabını silerse ödeme kaydı ve fatura kaydı da silinir.
- **Neden risk:** Ticari defter ve belgelerin saklanması yasal zorunluluk (VUK md. 253: 5 yıl; TTK md. 82: 10 yıl). Ayrıca iyzico itirazında (chargeback) ispat aracınız olmaz.
- **Yapılacak:** Silme yerine **anonimleştirme**: kişisel alanlar temizlenir, ödeme/fatura satırları kalır. Hesap silme talebi KVKK md. 7 kapsamında "yasal saklama" istisnasıyla yanıtlanır.
- **Kim:** Ben yapabilirim (kod). Onay gerek.

### K2. Abonelik "otomatik yenileniyor" diye e-posta gidiyor, oysa yenilenmiyor
- **Kanıt:** `subscription.email.ts`: "Aboneliğiniz ${tarih} tarihinde **otomatik olarak yenilenecek**. Devam etmek için bir şey yapmanıza gerek yok." Mesafeli Satış Sözleşmesi md. 4: "Abonelik **otomatik olarak yenilenmez**." Kodda kayıtlı karttan otomatik tahsilat yok (her yenileme yeni ödeme).
- **Neden risk:** Tüketiciye yanlış bilgi verilmesi (yanıltıcı ticari uygulama). Ayrıca Hizmet Şartları md. 5 "iptal edilene kadar yenilenir" diyor: **üç metin birbiriyle çelişiyor**.
- **Yapılacak:** E-posta ve Hizmet Şartları metni gerçeğe uyarlanır: "süreniz bitiyor, devam etmek için yenileyin".
- **Kim:** Ben (metin + e-posta).

### K3. Çerez onayı olmadan IP adresi üçüncü taraf servislere gidiyor
- **Kanıt:** `main.tsx`, herkese açık arama (SEO) sayfaları dışındaki sayfalarda (giriş, kayıt, çalışma alanı, ödeme) ve fiyat/para birimi hesabında `getCountryCode()` çağırıyor. Bu fonksiyon (`lib/geoCountry.ts`) kullanıcının IP adresini **ipwho.is** ve **ipapi.co** servislerine gönderiyor. Çerez onayı beklemiyor. Gizlilik Politikası ve KVKK metninde bu iki servis hiç geçmiyor.
- **Neden risk:** IP kişisel veridir. Onaysız ve açıklanmadan yurt dışındaki üçüncü tarafa aktarım (KVKK md. 9, aydınlatma yükümlülüğü).
- **Yapılacak:** Ülke bilgisi sunucu tarafından (barındırıcının başlığından) alınır; üçüncü taraf çağrısı kaldırılır. Alternatif: onay sonrasına bağla ve metne ekle.
- **Kim:** Ben (kod).

### K4. "Yolculuk" ölçümü onaydan önce çalışıyor
- **Kanıt:** `trackFunnelEvent` → `trackJourneyEvent` (`api/analytics.ts`) çerez onayına bakmıyor. Misafire `localStorage`'a kalıcı oturum kimliği yazıyor ve olayları sunucuya gönderiyor. Gizlilik Politikası md. 4: "zorunlu olmayan analitik çerez bildirimini kabul ettikten sonra çalışır".
- **Neden risk:** Kendi yazdığınız vaatle çelişiyor; açık rıza olmadan izleme.
- **Yapılacak:** Bu çağrı da analitik onayına bağlanır (sayfa görüntüleme zaten bağlı).
- **Kim:** Ben (kod).

### K5. Şirketin kim olduğu hiçbir yerde yazmıyor
- **Kanıt:** Canlı sitede alt bilgi sadece "© 2026 NB Global Studio". Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, KVKK ve Hizmet Şartları'nda: unvan, MERSİS no, vergi no, adres, telefon, KEP **yok**. Yalnız info@pdfplatform.app var.
- **Neden risk:** Elektronik Ticaret Yönetmeliği md. 5: ana sayfada "iletişim" altında ticaret unvanı, MERSİS no, merkez adresi, KEP, e-posta, telefon bulunmalı. Mesafeli Sözleşmeler Yönetmeliği: satıcı unvanı, adres, telefon ön bilgilendirmede olmalı. KVKK: veri sorumlusunun kimliği. İdari para cezası konusu.
- **Yapılacak:** Bilgileri siz verin; ben alt bilgiye, sözleşmelere ve KVKK metnine yerleştiririm. Sistemde bunun için zaten bir "gönderen kimliği" ayarı var (yönetim paneli), oradan okunacak şekilde bağlanabilir.
- **Kim:** **Siz** (bilgiler) + ben (yerleştirme).

---

## 2. YÜKSEK

### Y1. Yasal metinlerde var olmayan alan adları
- **Kanıt:** DNS sorgusu (Google DNS): **nbpdf.app** ve **nbglobalstudio.com** için "alan adı yok" (NXDOMAIN). Buna rağmen Mesafeli Satış Sözleşmesi "nbpdf.app adresinden", Ön Bilgilendirme "nbpdf.app/pricing" ve "Web sitesi: nbglobalstudio.com" diyor. Çerez adları da eski marka (`nbpdf-*`).
- **Risk:** Sözleşmenin konusu olan satış yeri yanlış gösteriliyor. Üstelik bu alan adlarını başkası kaydederse kimlik avı yapabilir.
- **Yapılacak:** Metinler pdfplatform.app olarak düzeltilir. İsterseniz nbpdf.app alan adını kendiniz kaydedin.
- **Kim:** Ben (metin). Alan adı kaydı: siz.

### Y2. Mesafeli Satış Sözleşmesi ödeme sırasında hiç gösterilmiyor
- **Kanıt:** Ödeme adımında yalnızca "Ön Bilgilendirme Formu" onay kutusu ve "Kullanım Koşulları + KVKK" kutusu var. Sözleşmenin kendisi (`/legal/mesafeli-satis`) alt bilgide ve ödeme akışında bağlantı olarak yok; satın alma sonrası e-postayla da gönderilmiyor.
- **Risk:** Tüketiciye ön bilgilendirme ve sözleşmenin kalıcı bir ortamda (e-posta) verilmesi gerekir. Cayma istisnasına dayanabilmek için de bu şart.
- **Yapılacak:** Ödeme adımına sözleşme bağlantısı + onay; satın alma e-postasına sözleşme ve ön bilgilendirme kopyası.
- **Kim:** Ben.

### Y3. Ödeme onayı sunucuda zorunlu tutulmuyor
- **Kanıt:** `distanceSalesConsentedAt` ve `withdrawalWaivedAt` alanları yalnızca ekrandaki kutular işaretlenince yazılıyor. Ödeme başlatma kodu bu alanların dolu olup olmadığına bakmıyor.
- **Risk:** Ekranı atlayan istek onaysız ödeme başlatabilir; cayma feragati kanıtı yok sayılır.
- **Yapılacak:** Ödeme başlatılmadan önce sunucuda kontrol; onay metninin sürümü ve IP'si de kaydedilir.
- **Kim:** Ben.

### Y4. "KVKK onayı" aslında alınmıyor ama kayıtta "onaylandı" yazıyor
- **Kanıt:** `billing-info.service.ts` fatura bilgisi kaydedilince kullanıcıyı koşulsuz `isKvkkConsented = true` yapıyor; ekranda KVKK için onay kutusu yok, yalnızca bilgi metni var.
- **Risk:** Aydınlatma bir bilgilendirmedir, onay değildir. Hiç alınmamış bir onayı "alındı" diye kaydetmek, mahkemede sizin aleyhinize delil hatası olur.
- **Yapılacak:** Alanın adı ve anlamı "aydınlatma gösterildi" olarak düzeltilir; itiraz dosyasındaki ifade zaten ona göre ayarlanır.
- **Kim:** Ben.

### Y5. Vergi saklama süresi üç metinde üç farklı
- **Kanıt:** Gizlilik Politikası ve Mesafeli Satış: "VUK Madde 253 gereği **10 yıl**". KVKK Aydınlatma: "en az **5 yıl**". Kaynaklar: VUK md. 253 → **5 yıl**; TTK md. 82 → **10 yıl**. Yani atıf yanlış, süre de tutarsız.
- **Yapılacak:** Üç metin tek ifadeye bağlanır: "TTK md. 82 ve VUK md. 253 uyarınca 10 yıl".
- **Kim:** Ben.

### Y6. Veri saklama vaadi ile gerçek uygulama uyuşmuyor
- **Kanıt:** Politika "işlem ve indirme günlükleri 90 gün; süre dolunca silinir veya anonimleştirilir" diyor. `dataRetentionJobs.ts` bunları yalnızca **"arşivlendi" işaretliyor**, silmiyor; IP ve tarayıcı bilgisi sonsuza kadar kalıyor. `PageView`, `UserJourneyEvent` (politika: 13 ay) ve `ClientErrorLog` (politika: 30 gün) için **hiç temizleme işi yok**.
- **Risk:** KVKK md. 4 ve 7: amaç bitince silme/anonimleştirme; ilan ettiğiniz sürenin aşılması.
- **Yapılacak:** Temizleme işleri eklenir veya metin gerçeğe uyarlanır. Önerim: 90 gün sonra IP/tarayıcı alanları temizlenir, kayıtlar 1 yıl sonra silinir; sayfa/yolculuk 13 ay, hata günlüğü 30 gün.
- **Kim:** Ben (kod + metin).

### Y7. "Dosyalar 24 saat içinde silinir" doğru değil: bazı belgeler süresiz saklanıyor
- **Kanıt:** (a) **Belge Tarayıcı "Hesabıma kaydet"**: tarama dosyaları veritabanında (`ScannedDocument`), yalnızca adet sınırıyla (ücretsiz 3, Pro 10), süre sınırı yok. (b) **İmza İste**: özgün ve imzalı belge veritabanında (`SignatureRequest`), süresiz; `expiresAt` yalnızca bağlantı süresi. Gizlilik/KVKK metinleri: "Yüklenen belgeler 24 saat içinde silinir".
- **Risk:** Kimlik kartı gibi hassas belgeler tarandığında özellikle; metinle gerçek çelişiyor.
- **Yapılacak:** İki özelliği metinde ayrıca açıklayın (kullanıcı silene/limite kadar), imza belgeleri için saklama süresi belirleyin, imzalayan üçüncü kişiye aydınlatma bağlantısı ekleyin.
- **Kim:** Siz (süre kararı) + ben (kod ve metin).

### Y8. Hizmet Şartları büyük ölçüde çeviri şablonu ve tüketici aleyhine hükümler içeriyor
- **Kanıt:** Metinde (md. 6, 9, 5): sorumluluk **50 ABD doları** ile sınırlı; "kâr kaybı/veri kaybı için sorumlu değiliz"; "yenileme sonrası kullanım güncel şartların kabulü sayılabilir"; uygulanacak hukuk "faaliyet gösterdiği ülke" (Türkiye açıkça yazmıyor); **yetkili mahkeme/hakem heyeti yok**; yaş şartı yok; şirket kimliği yok.
- **Risk:** TKHK md. 5 ve Haksız Şartlar Yönetmeliği: tüketici aleyhine dengesizlik yaratan şartlar kesin hükümsüzdür; tek taraflı değişiklik şartı yönetmelik listesindedir. Metnin tüketicide geçersiz olması, ticari müşteride kalmasıyla ayrışmalıdır.
- **Yapılacak:** Metin Türk hukukuna göre yeniden yazılır (tüketici/ticari ayrımı, Türk hukuku, yetkili mahkeme, 18 yaş, gerçek şirket bilgileri). Bu iş **avukata** verilmeli; ben taslak hazırlayabilirim.
- **Kim:** Avukat + ben (taslak).

---

## 3. ORTA

| # | Bulgu | Kanıt | Yapılacak |
|---|---|---|---|
| O1 | **"7 Gün Koşulsuz İade"** ifadesi gerçekle uyuşmuyor | Canlı sitede ve ödeme ekranında "koşulsuz/gerekçe gerekmez". Kodda iade suistimal kontrolü var (30 gün bekleme, iade limiti, `refundBlockedUntil`) | "Koşulsuz" kelimesini kaldırın veya sınırı ilan edin |
| O2 | **"GDPR uyumlu"** iddiası | Fiyat sayfasında "SSL şifreli · GDPR uyumlu". Böyle bir sertifika/denetim yok | "KVKK ve GDPR ilkelerine uygun tasarlandı" gibi yumuşatın |
| O3 | **"KVKK uyumlu paylaşım"** ve **"%100 gizli"** mutlak ifadeler | Blog ve araç sayfalarında. Şifreli (parolalı) veya 80 MB üstü dosyalar birleştirmede sunucuya düşüyor (`App.tsx`, `CLIENT_PDF_MAX_BYTES`) | "Dosyanız bu araçta sunucuya yüklenmez" gibi gerçeği anlatan ifade; istisnaları belirtin |
| O4 | **Yurt dışı aktarımın dayanağı yazılı değil** | KVKK metni "sözleşmenin ifası" diyor. 2024'ten beri md. 9: yeterlilik kararı, **standart sözleşme (imzadan sonra 5 iş günü içinde Kuruma bildirim)** veya benzeri güvence gerekir. Anthropic (ABD), Google Analytics (ABD), Gmail SMTP (ABD) | Anthropic'in veri işleme sözleşmesi + standart sözleşme bildirimi (SİZDEN GEREKEN). Metinde dayanağı yazın |
| O5 | **Başvuru kanalı yetersiz olabilir** | KVKK başvuruları yalnızca info@ adresine yönlendiriliyor | KEP/kayıtlı e-posta/yazılı adres seçeneği de eklenmeli |
| O6 | **Çerez bildiriminde yanlış madde atfı** | Çerez metni "KVKK Madde 7 gereği her kategori için ayrı onay" diyor; md. 7 silme/yok etmedir | Atıfı düzeltin |
| O7 | **Alt bilgide yasal sayfa bağlantıları eksik** | Yalnızca Şartlar, Gizlilik, KVKK. Mesafeli Satış, Ön Bilgilendirme, İade/Cayma, Çerez yok | Hepsi eklenmeli |

---

## 4. DÜŞÜK

| # | Bulgu | Not |
|---|---|---|
| D1 | Ön Bilgilendirme "Yürürlük tarihi: 2024 yılı ve sonrası", Mesafeli Satış "Her satın almada geçerli" | Sürüm/tarih yok; onay kaydında hangi sürümün onaylandığı belli olmuyor |
| D2 | Cayma istisnası dayanağı | Yönetmelik md. 15/1-**ğ** "anında ifa edilen hizmet". Süreklilik arz eden abonelikte daha güçlü dayanak 15/1-**h** (onayla ifasına başlanan hizmet) olabilir; avukat karar versin |
| D3 | VERBİS ve ETBİS | Yıllık çalışan <50 ve bilanço <100 milyon TL ise VERBİS'ten muaf (özel nitelikli veri işleme ana faaliyet değilse). ETBİS: kendi sitesinde satış yapan hizmet sağlayıcı kayıt zorunlu olabilir. Şirket türünüzü bilmediğim için doğrulayın |
| D4 | Rakip karşılaştırma içerikleri | Örnek doğrulama: DocuSign Personal (5 zarf/ay) ve Microsoft Lens (9 Mart 2026'da yeni tarama durdu) iddiaları **doğru çıktı**. Diğer rakip iddialarını yayından önce bu şekilde doğrulamaya devam edin |

---

## 5. Doğru yapılmış olanlar (korunmalı)

- Ticari e-posta: tek izin kapısı, kutu varsayılan kapalı, çıkış bağlantısı, onay kanıt defteri.
- Çerez: GA4, Sentry ve sayfa görüntüleme analitiği onaya bağlı; "Yalnızca zorunlu" seçeneği var.
- Kart bilgisi sistemde saklanmıyor; TC kimlik ve adres alanları şifreli.
- E-imza (İmza İste): açık rıza kutusu, ayrı olay kayıtları, belge parmak izi, imzalayanın IP'sinin açık saklanmaması.
- Yapay zekâ: belge metni Anthropic'e gidiyor, dosya gitmiyor; politikadaki "30 gün saklama" ifadesi Anthropic'in güncel API şartlarıyla uyumlu.
- Ratings: sahte `aggregateRating` yok; puanlar gerçek oy; oy veren kişi kimliğe bağlanmıyor (yalnızca IP+tarayıcı karması tutuluyor).
- Sözleşme Denetçisi: onay, bedel, iade ve delil defteri; "hukuki danışmanlık değildir" uyarıları.
- Yeni eklenenler: çıktı parmak izi, yapay zekâ istek defteri, itiraz dosyası.

---

## 6. SİZDEN GEREKEN (ben bilmiyorum, uydurmayacağım)

1. Şirketin **hukuki türü ve unvanı** (şahıs işletmesi mi, Ltd./A.Ş. mi?), **MERSİS no / vergi no**, **merkez adresi**, **telefon**, **KEP adresi**.
2. **İYS** kaydı yapıldı mı? (Ticari e-posta gönderiyorsanız zorunlu.)
3. **ETBİS** kaydı yapıldı mı? **VERBİS** kapsamında mısınız? (Çalışan sayısı ve bilanço.)
4. **Anthropic ile veri işleme sözleşmesi** imzalandı mı? Google (GA4) ve e-posta sağlayıcısı için yurt dışı aktarım güvencesi nasıl sağlandı? Standart sözleşme Kuruma bildirildi mi?
5. Yurt dışı müşteriye KDV'siz satış (ihracat istisnası) için mali müşavir onayı var mı?
6. Marka tescili: "PDF Platform" adı tescilli mi?
7. İmza belgeleri ve taranmış belgeler için **saklama süresi kararı**.

---

## 7. Önerilen iş sırası

1. **Hemen (bu hafta):** K2 (e-posta ve şart çelişkisi), K3 (IP üçüncü tarafa), K4 (onaysız ölçüm), Y1 (alan adları), Y5 (süre atıfları), O1-O3 (iddialar). → Ben yaparım.
2. **Bilgi gelince:** K5 (şirket kimliği her yere), Y2-Y3 (ödeme onayı + sözleşme gösterimi).
3. **Karar gelince:** K1 (silme yerine anonimleştirme), Y6-Y7 (saklama).
4. **Avukat:** Y8 (Hizmet Şartları yeniden yazımı), O4, D2.

---

## Kaynaklar

- KVKK md. 9 ve standart sözleşmenin 5 iş günü içinde bildirimi: kvkk.gov.tr kamuoyu duyurusu (7499 sayılı Kanun, 1 Haziran 2024)
- VUK md. 253 (5 yıl) / TTK md. 82 (10 yıl): TÜRMOB ve ilgili meslek yayınları
- Mesafeli Sözleşmeler Yönetmeliği md. 15/1-ğ ve h: mevzuat metni
- 6563 sayılı Kanun md. 3 ve E-Ticaret Yönetmeliği md. 5: mevzuat.gov.tr
- TKHK md. 5 ve Haksız Şartlar Yönetmeliği
- Anthropic API veri saklama (30 gün) ve ticari şartlar
- VERBİS muafiyet eşikleri (50 çalışan / 100 milyon TL)
- DocuSign Personal planı, Microsoft Lens kapanış tarihleri

---

## Sorumluluk sınırı: piyasa karşılaştırması (7 Ekim)

Kaynaklar şartların kendisinden okundu. (Smallpdf şartlarına ulaşılamadı, doğrulanmadı.)

| Firma | Sınır |
|---|---|
| Adobe | **100 ABD doları** veya önceki 3 ayda ödenen tutar, hangisi büyükse. Kast, ağır kusur, ölüm/yaralanma hariç |
| DocuSign | Önceki **12 ayda ödenen tutar** veya **100 ABD doları**, hangisi büyükse. Tüketici için ülkelere göre istisnalar |
| iLovePDF | Ücretli ticari müşteri: önceki 16 ayın ödemesi. Ücretli tüketici: toplam ödemenin 1,5 katı. **Ücretsiz kullanıcı: kast/ağır kusur dışında sorumluluk yok**. Emredici hukuk saklı |
| Sejda | Önceki 12 ayda ödenen tutar; **ücretsiz ürünlerde 20 ABD doları** |

Sonuç: Sınır koymak sektör standardı; kaldırmak sizi korumasız bırakır (özellikle şirket kurulmadığı sürece sorumluluk **kişisel** olur). Bu yüzden kaldırılmadı, **yeniden yapılandırıldı**: ücretsiz / ücretli ticari / tüketici ayrımı, kast ve ağır kusur istisnası, emredici tüketici hukuku saklı. Avukat gözden geçirmeli.

---

## Şirket kurulunca yapılacaklar (sırayla)

1. Şirket veya şahıs işletmesi kur: unvan, MERSİS/vergi no, merkez adresi, telefon, KEP.
2. Bu bilgileri alt bilgiye ("İletişim"), Ön Bilgilendirme "Satıcı" bölümüne, Mesafeli Satış "Taraflar"a, KVKK "Veri sorumlusu"na ve e-posta alt bilgisine yerleştir. Yönetim panelindeki "Gönderen kimliği" ayarını doldur.
3. İYS kaydı (ticari e-posta için zorunlu). ETBİS kaydı. VERBİS muafiyet kontrolü (çalışan ve bilanço eşikleri).
4. iyzico üye işyeri başvurusu (şahıs işletmesi kabul ediliyor mu sor). Onay sonrası ödemeleri aç.
5. Fatura entegratörünü (Paraşüt veya BirFatura) gerçek hesapla bağla, deneme fatura kes. Mali müşavirle yurt dışı satış KDV (ihracat istisnası) teyidi.
6. Mesafeli Satış Sözleşmesi'ni ödeme adımına ekle, onayı sunucuda zorunlu kıl, satın alma e-postasına sözleşme + ön bilgilendirme kopyası koy.
7. "Onaylı yenileme" kur: süre bitmeden hatırlatma, "Yenile" düğmesi, onay kaydı (zaman, IP, fiyat, metin sürümü).
8. Hizmet Şartları'nı avukata yeniden yazdır: tüketici/ticari ayrımı, Türk hukuku, yetkili mahkeme ve tüketici hakem heyeti, 18 yaş şartı.
9. Anthropic ile veri işleme sözleşmesi; yurt dışı aktarım için standart sözleşme ve Kuruma 5 iş günü içinde bildirim; Google (GA4) ve e-posta sağlayıcısı için aynısı.
10. Muhasebeci ile aylık CSV dökümü rutini; Render veritabanı planı ve yedek kontrolü.
11. "PDF Platform" marka tescili (TÜRKPATENT).
12. Yürürlük tarihlerini yayın gününe çek.

### Şirketten bağımsız, bekleyen kod işleri
K3 (IP'yi üçüncü taraf servislere gönderme), K4 (onaysız yolculuk ölçümü), Y6 (eski kayıtların gerçekten silinmesi), Y7 (taranmış belge ve imza belgesi saklama metni/süresi), O1-O3 ("koşulsuz iade", "GDPR uyumlu", "%100 gizli" ifadeleri), O7 (alt bilgiye yasal sayfa bağlantıları).
