# İade Politikası ve Yönetim Kılavuzu

Bu belge; bir müşteri iade talep ettiğinde sistemin ne yaptığını, senin ne yapman gerektiğini ve olası sorunlarda nasıl müdahale edeceğini sade bir dille anlatır.

---

## Genel Bakış: Sistem Nasıl Çalışır?

Müşteri, **satın aldıktan sonraki 7 gün içinde** "Profilim → Aboneliği İptal Et" butonuna bastığında sistem şu adımları otomatik olarak tamamlar:

1. Müşterinin daha önce kaç kez iade aldığını kontrol eder.
2. iyzico üzerinden kartına parayı geri gönderir.
3. Hesabını ücretsiz plana düşürür.
4. Muhasebe için iade faturası (alacak dekontu) oluşturur.
5. Eğer bu kişinin 2. iadesiyse admin olarak seni işaretler.

**7 günü geçtikten sonra** iptal etmek isteyen müşteriler para iadesi alamaz; abonelikleri sadece mevcut süre sonunda biter. Bu durumda otomatik işlem yapılmaz, senden bir şey istenmez.

---

## İade Kuralları

| Durum | Ne Olur? |
|---|---|
| İlk kez iade | Otomatik onaylanır, para iade edilir |
| 2. iade (12 ayda) | Onaylanır ama hesap "inceleme gerekiyor" olarak işaretlenir |
| 3. iade ve sonrası (12 ayda) | Otomatik olarak reddedilir, müşteriye seni araması söylenir |
| Son iadeden 30 gün geçmeden | Sistem engeller, 30 gün beklenmesi söylenir |

---

## Senin Müdahale Etmen Gereken Durumlar

### Durum 1: "Admin İncelemesi Gerekiyor" Uyarısı

**Ne zaman olur:** Bir müşteri 12 ay içinde 2. kez iade talep ettiğinde.

**Sistemde ne görürsün:** Veritabanında o kullanıcının `refundAbuseFlagged` alanı `true` olur. Şu an bu durum log dosyalarına yazılır. Bunu takip etmek için admin panelinde filtreleme eklenebilir (ileride).

**Ne yapmalısın:**
- Müşterinin ödeme geçmişine bak.
- Gerçekten iki farklı satın alım mı yaptı, yoksa sistem hatası mı var, kontrol et.
- Anormal bir durum yoksa — müşteri sadece deneyip beğenmemiş olabilir — müdahale etmene gerek yoktur, sistem zaten iade işledi.
- Anormal görünüyorsa (örn: 2. satın alım çok kısa süre sonra yapılmış), o müşteriye e-posta atıp bilgi alabilirsin.

---

### Durum 2: "Manüel İade Gerekiyor" Uyarısı

**Ne zaman olur:** Çok nadir — sistem yükseltilmeden önce yapılmış eski ödemeler için, ya da çok istisnai teknik durumlarda. Bu durumlarda iyzico'ya otomatik iade gönderilemez çünkü eski ödeme kaydında gerekli bilgiler eksiktir.

**Log'da nasıl görünür:**
```
cancelSubscription: eski ödeme kaydı — iyzico manüel iade gerekiyor
conversationId: xxxxx
userId: xxxxx
```

**Ne yapmalısın:**
1. [iyzico Merchant Panel](https://merchant.iyzico.com) adresine giriş yap.
2. Sol menüden **İşlemler → Ödemeler** bölümüne git.
3. Müşterinin adını, e-posta adresini ya da ödeme tarihini kullanarak işlemi bul.
4. İşlem detayına gir, **İade Et** butonuna bas ve tutarı gir.
5. İşlemi tamamladıktan sonra müşteriye e-posta at: "İadeniz işleme alınmıştır, 1-3 iş günü içinde kartınıza yansıyacaktır."

---

### Durum 3: Müşteri 3. Kez İade Talep Ediyor

**Ne zaman olur:** Bir müşteri 12 ay içinde 3. kez 7 günlük pencere içinde iptal etmeye çalışıyor.

**Müşteri ne görür:** "İade limitinize ulaştınız. Lütfen destek ekibiyle iletişime geçin."

**Ne yapmalısın:**
- Müşteri sana ulaşacak.
- Durumu değerlendir: gerçek bir sorun mu (ödeme sistemi hatası, fiyatlandırma karışıklığı) yoksa sistematik kötüye kullanım mı?
- Gerçek sorun varsa: iyzico panelinden manuel iade yap (Durum 2'deki adımlar) ve veritabanında `totalRefunds` sayacını elle düzeltebilirsin.
- Kötüye kullanım şüphesi varsa: iadeyi reddet ve hesabı değerlendirmeye al.

---

### Durum 4: iyzico İade Başarısız Oldu

**Ne zaman olur:** iyzico'nun kendi sisteminde geçici bir sorun olduğunda (nadiren).

**Müşteri ne görür:** "İade işlemi sırasında bir hata oluştu. Lütfen destek ekibiyle iletişime geçin."

**Log'da nasıl görünür:**
```
cancelSubscription: iyzico iade başarısız
error: [hata mesajı]
conversationId: xxxxx
```

**Ne yapmalısın:**
1. Müşteri sana ulaştığında iyzico panelinden manuel iade yap (Durum 2'deki adımlar).
2. Müşterinin hesabı bu durumda otomatik FREE'ye düşürülmez — veritabanından `plan` alanını `FREE`, `subscriptionExpiry`'yi `null` yapman gerekir.
3. Sonrasında iyzico destek hattını ara, tekrar eden bir sorun mu kontrol et.

---

## iyzico Panelinde Manuel İade Adımları (Hızlı Referans)

1. [merchant.iyzico.com](https://merchant.iyzico.com) → giriş yap
2. **İşlemler → Ödemeler** (sol menü)
3. Arama: müşteri adı, e-posta veya tarih aralığı
4. İşleme tıkla → **İade Et**
5. İade tutarını gir (tam tutar veya kısmi)
6. **Onayla**
7. Müşteriye bilgilendirme e-postası gönder

---

## İade Faturası (Alacak Dekontu)

Bir iade işlendiğinde sistem otomatik olarak Paraşüt üzerinden **alacak dekontu** oluşturur. Bu vergi açısından zorunlu bir belgedir.

**Dikkat etmen gereken durumlar:**
- Eğer iade faturası oluşturulamadıysa (Paraşüt bağlantı sorunu vb.) log'da `credit-note: failed` görürsün.
- Bu durumda Paraşüt panelinden manuel olarak o satış faturasına karşılık alacak dekontu oluştur.
- Muhasebecine bildirmeyi unutma.

---

## Sık Sorulan Durumlar

**"Müşteri parayı 10 gün içinde geri almak istiyor, 7 günü geçti"**
Sistem otomatik reddeder. Kararı sen verirsin: iyzico panelinden manuel iade yapabilirsin, ya da nazikçe ret edebilirsin. Bu tamamen sana kalmış.

**"Müşteri kartını kapattı, iade nereye gidecek?"**
iyzico bunu yönetir — kart kapatılmış olsa bile banka genellikle IBAN'a yönlendirir. Müşteriye bankasını aramasını söyle.

**"Aynı müşteri 30 gün içinde tekrar iade talep etti"**
Sistem "Son iade işleminizden 30 gün geçmesi gerekmektedir." der ve reddeder. Müşteri sana gelirse: haklı bir sebep varsa iyzico'dan manuel yap, yoksa 30 günü beklemelerini söyle.

**"Test ya da demo hesabı yanlışlıkla ücretlendi"**
iyzico panelinden hemen manual iade yap. Sonra o hesabı düzenle, bir daha ücretlendirmeyelim diye `plan = FREE` olarak bırak.

---

## Özet Akış Şeması

```
Müşteri iptal butonuna bastı
         │
         ▼
    7 gün içinde mi?
    ├── Hayır → "Süre bitti" mesajı, abonelik süre sonunda biter
    └── Evet ↓
         │
    Kaçıncı iade? (12 ayda)
    ├── 3. veya daha fazla → REDDEDİLİR → Müşteri seni arar
    └── 1. veya 2. ↓
         │
    Son iadeden 30+ gün geçti mi?
    ├── Hayır → "30 gün bekle" mesajı
    └── Evet ↓
         │
    iyzico kartına para gönderir
    Hesap FREE'ye düşer
    İade faturası oluşur
         │
    2. iade miydi?
    ├── Evet → Hesap "inceleme" olarak işaretlenir (sana bildirim ileride)
    └── Hayır → İşlem tamam
```

---

*Son güncelleme: Mayıs 2026*
