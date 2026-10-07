# İtiraz Karşılama Rehberi

Müşteri "hizmet çalışmadı", "dosyam bozuldu", "ihaleyi kaçırdım, zararımı ödeyin" veya "paramı iade edin" dediğinde adım adım ne yapılır.

> Hukuki görüş değildir; ciddi (yüksek tutarlı) taleplerde avukata danışın. Mevzuat atıfları genel çerçevedir.

---

## 1. Önce kim olduğunu belirle

| Müşteri | Hukuki çerçeve | Sorumluluk sınırı |
|---|---|---|
| **Ücretsiz kullanıcı** | Ücret alınmıyor; sözleşmesel sorumluluk çok dar | Kast/ağır kusur dışında yok |
| **Bireysel Pro/Plus (tüketici)** | Tüketicinin Korunması Hakkında Kanun (ayıplı hizmet, 7 gün iade garantimiz) | Tüketicide **işlemez**; yasal hakları saklı |
| **Şirket (Business/ticari)** | Borçlar Kanunu + Hizmet Şartları | Son 12 ayda ödenen tutar, hafif kusurda |

---

## 2. Müşteriden bunları iste (yazılı)

1. Hesabın e-postası ve hangi araç/özellik.
2. Sorunun yaşandığı **tarih ve saat** (saat dilimiyle).
3. Hata mesajının ekran görüntüsü; varsa indirilen/ürettiğimiz dosya.
4. Ne zarar gördüğünü ve **nasıl hesapladığını** (tutar, belgeler).
5. Zarar iddiasında: son tarih (ör. ihale kapanış saati), dosyayı başka yoldan gönderme imkânı olup olmadığı, bize ilk ne zaman bildirdiği.

---

## 3. Panelde ne kontrol edilir (iddia doğru mu?)

| Soru | Nereye bakılır | Ne gösterir |
|---|---|---|
| Müşteri gerçekten kullandı mı, işlemler başarılı mı? | Yönetim → Analitik → **İtiraz dosyası** (müşterinin e-postası) | İşlem, indirme, yapay zekâ kayıtları (başarılı/hata/iade), kabul kayıtları, ödeme, abonelik |
| Elindeki dosya bizim çıktımız mı, değiştirilmiş mi? | **Dosya doğrula** | Parmak izi eşleşiyor mu |
| O saatte sistem ayakta mıydı? | Dış uptime izleyici geçmişi (UptimeRobot/benzeri) + Render panelindeki olay geçmişi | Kesinti var mıydı, ne kadar sürdü |
| O saatte başkaları işlem yaptı mı? | Analitik → kullanım serisi | Aynı saatte başarılı işlem sayısı |
| Tarayıcıda hata var mıydı? | Sentry (yalnız onay veren kullanıcılar) | İstemci hataları |

**Bugünkü eksik:** Sistem kendi başına kesinti kaydı tutmuyor; işlem hataları da "başarısız" diye kaydedilmiyor. Bu yüzden şu an en güçlü bağımsız delil **dış uptime izleyicisidir** (ücretsiz kurulabilir). Önerilen: (a) UptimeRobot/Better Stack ile 1 dakikalık izleme ve herkese açık durum sayfası, (b) iç sağlık kaydı + başarısız işlem kaydı (yapılabilir, onayınızı bekliyor).

---

## 4. "İhaleyi bizim yüzümüzden kaçırdı" iddiası

Zararı iddia eden, bunu **ispat etmek zorundadır** (HMK md. 190, TMK md. 6). Müşterinin ispatlaması gerekenler:

1. **Hizmetimiz o anda gerçekten çalışmadı** (kayıtlarımız ve izleyici geçmişi bunu doğrular veya çürütür).
2. **Kaçırma doğrudan buna bağlı:** son tarihten ne kadar önce denedi, başka yol (başka araç, EKAP'ın kendi araçları, ofis bilgisayarı) vardı mı, hatayı bize ne zaman bildirdi.
3. **Zararın tutarı ve hesabı.**

Biz tarafta savunma:
- Kayıtlar: o saatte işlemler başarılı mıydı, müşterinin hesabında hata var mıydı.
- Müşterinin **zararı azaltma ve özen** yükümlülüğü: son dakikaya bırakmak, yedeksiz çalışmak, sonucu kontrol etmemek (Hizmet Şartları'ndaki "kontrol edin" maddesi ve ekrandaki uyarı).
- Sorumluluk sınırı (ticari müşteride) ve kâr kaybının kapsam dışı olması.

Pratik: "Başka sebeplerden kaçırmış olabilir" sorusunun cevabı **müşterinin getireceği belgelerde** ve bizim kayıtlarımızdadır. İddiayı kabul etmek zorunda değilsiniz; kanıt isteyin.

---

## 5. Bireysel Pro abonede savunmanın dayanakları

1. **Sözleşme:** Abonelik, araçlara erişim hizmetidir. Kayıtlarımız (işlem, indirme, parmak izi) hizmetin **sunulduğunu** gösterir; ayıp yoksa iade/tazminat yoktur.
2. **7 gün iade garantisi:** Süre içindeyse gerekçe aramadan iade (ticari garanti). Kötüye kullanım sınırları metinde yazılıdır.
3. **Ayıplı hizmet iddiası:** Gerçekten hizmet sunulamadıysa tüketicinin seçimlik hakları vardır (ücret iadesi, bedel indirimi, hizmetin yeniden ifası). Burada **kendiliğinden** düzeltmek en doğrusudur; kayıtlar bunu zaten gösterir.
4. **Kullanıcı kaynaklı sorun:** Bozuk/şifreli giriş dosyası, desteklenmeyen biçim; kayıtlarda hata tipiyle görünür.
5. **Yapay zekâ çıktısı:** Sonuç ekranındaki uyarı ve Şartlar'daki "kontrol edin" maddesi; kayıtta işlem tamamlanmış görünür.
6. **Tüketici hakem heyeti başvurusu gelirse:** itiraz dosyası ve kayıtlarla yazılı cevap verilir.

Not: Tüketicide "sorumluluk sınırı" ileri sürülmez; savunma **ayıp yok / hizmet sunuldu / kayıtlar** üzerinedir.

---

## 6. Hazır cevap iskeletleri

**A) Kayıtlar hizmetin çalıştığını gösteriyor:**
> Merhaba [Ad], talebinizi inceledik. [Tarih-saat] aralığında hesabınızda [N] işlem başarıyla tamamlanmış ve dosya [indirildi/üretildi]. Sistem o saatlerde kesintisiz çalışıyordu. Yaşadığınız sorunu tam anlayabilmemiz için hata mesajının ekran görüntüsünü ve kullandığınız dosyayı iletirseniz birlikte bakabiliriz.

**B) Kayıtlar sorunu doğruluyor:**
> Merhaba [Ad], kayıtlarımızda [tarih-saat] aralığında bir aksama yaşandığını doğruladık. Bunun için özür dileriz. Ücret iadesi / ek süre / yeniden işlem seçeneklerinden hangisini tercih edersiniz?

**C) Yüksek tutarlı zarar iddiası:**
> Merhaba [Ad], talebinizi aldık. Değerlendirebilmemiz için lütfen şunları iletin: sorunun tam zamanı, ekran görüntüleri, son tarih/teslim şartını gösteren belge, bize ilk bildirim zamanı ve zararın hesabı. Kayıtlarımız incelenecek ve yazılı yanıt verilecektir.

---

## 7. Altın kurallar

- **Yazılı kalın**, sakin yazın; tehdit karşısında panik yapmayın.
- **Küçük tutarda** (ör. bir aylık ücret) hızlı iade, uzun tartışmadan ucuzdur. Kanıt sistemi **yüksek tutarlı veya art niyetli** taleplerde devreye girer.
- Hiçbir cevapta "garanti ediyoruz, asla hata olmaz" demeyin.
- Müşteri kaydı sildirmeye çalışırsa: ödeme/fatura kayıtları yasal olarak saklanır (arşive alınır).
- Şirket kurulunca bu rehberdeki unvan ve iletişim bilgileri güncellenir.
