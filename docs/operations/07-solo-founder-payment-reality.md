# Solo Kurucu — Ödeme Operasyonları Gerçeği

> **Bu belge kimler için:** Ödeme sistemini ilk kez çalıştıran, ne kadar zaman ayırması gerektiğini bilmeyen, neye dikkat edeceğini öğrenmek isteyen solo kurucu için.

---

## 🧠 MVP Aşamasında Gerçekten Önemli Olan

```
ÇOK ÖNEMLİ (Şimdi):
✅ Ödeme alındı → Plan güncellendi (bu %100 çalışmalı)
✅ Duplicate charge olmuyor (idempotency)
✅ Sahte callback reddediliyor (HMAC doğrulama)
✅ Fiyat sunucu tarafında (frontend'den gelemez)
✅ Her ödeme loglanıyor (conversation_id ile)
✅ Manuel müdahale yapabiliyorsun (bir şeyler bozulursa)

AZ ÖNEMLİ (100+ kullanıcıda bak):
→ Otomatik refund sistemi
→ Gelişmiş fraud detection
→ Chargeback otomatik itirazı
→ Fatura sistemi
→ Ödeme analytics dashboard

SONRAYA BIRAK (1000+ kullanıcı):
→ Çoklu PSP (iyzico + Stripe)
→ Subscription management sistemi (Stripe Billing gibi)
→ Revenue recognition muhasebesi
→ Otomatik tax hesaplama
```

---

## ⏱️ Gerçek Zaman Harcamaları

### Normal Haftada (0 sorun)
```
Sabah kontrol (günlük):    5 dakika
  → PENDING sayısı kontrol
  → Dünkü başarılı ödeme sayısı
  → Alarm geldi mi?

Haftalık kontrol:          15-20 dakika
  → Ödeme sağlığı raporu
  → İade var mı?
  → Şüpheli aktivite?
```

### Sorunlu Haftada
```
Bir kullanıcı şikayet etti: 30-60 dakika
  → Araştır → Düzelt → Yanıt yaz → Takip et

Callback kesintisi (örn. 5 kullanıcı etkilendi): 2-3 saat
  → Tespit → Düzelt → Manuel güncelleme × 5 → Email × 5

Chargeback geldi: 4-8 saat (ilk kez)
  → Delil topla → İtiraz dilekçesi → iyzico'ya gönder → Takip et
```

---

## 🔥 İlk 100 Kullanıcıda Karşılaşacakların

### Kesin Karşılaşacakların:

**1. "Plan değişmedi" şikayeti (ilk hafta)**
```
Sebebi: iyzico'da test ortamı geçiş sırasında callback kayıpları
Çözüm: RB-12'yi uygula, manuel düzelt, özür dile
Ders: Callback monitoring kur
```

**2. Kullanıcı yanlış plan aldı**
```
"PRO aldım ama BUSINESS istiyordum"
Çözüm: İkinci planı indirimli ver, birincisini iade et
Önlem: Plan değiştirme akışı ekle
```

**3. Email doğrulama olmadan ödeme denemesi**
```
Kullanıcı email'ini doğrulamadan ödeme yapmaya çalışıyor
Çözüm: Ödeme öncesi email doğrulamasını zorla
```

### Muhtemelen Karşılaşacakların:

**4. iyzico sandbox key production'a geçti**
```
Tüm ödemeler "invalid environment" hatası veriyor
Kontrol: grep "IYZICO_URI" web/api/.env
Düzelt: https://api.iyzipay.com yaz, yeniden başlat
```

**5. Callback URL'i HTTPS değil HTTP**
```
iyzico production'da HTTPS zorunlu
Kontrol: grep "PAYMENT_CALLBACK_BASE_URL" web/api/.env
Düzelt: https:// ile başlamalı
```

---

## 💆 Destek Stresi Nasıl Yönetilir?

### Duygusal Denge

```
Kural 1: Kullanıcı kızgın olabilir. Ama kızgınlığı seni hedeflemiyor.
         Sorunu hedefliyor. Sen sadece sorunun çözücüsüsün.

Kural 2: Cevabını hemen yazma. 10 dakika bekle, sonra yaz.
         Kızgın mesaja kızgın cevap vermek işi büyütür.

Kural 3: "Araştırıp döneceğim" = güçlü yanıt
         Bilmediğin şeyi biliyormuş gibi yapma.

Kural 4: Çözüm sunduğunda "özür dilerim" ekle.
         Özür dil = zayıflık değil, profesyonellik.
```

### Zaman Koruması

```
Destek saatleri belirle: "Destek soruları 09:00-18:00 arası yanıtlanır"
Auto-reply kur: "Mesajınız alındı. 4 saat içinde yanıtlayacağız."
Tekrarlanan soruları FAQ'a dönüştür (web sitesine ekle)
```

---

## 📊 Ödeme Sağlığı — Haftalık Kontrol Listesi

```
Pazar sabahı 15 dakika ayır:

ÖDEME METRİKLERİ:
□ Bu hafta kaç ödeme alındı?
□ Kaç başarısız oldu? (Oran: ___ %)
□ Kaç PENDING kaldı (2+ saat)?
□ Ortalama checkout süresi?

KULLANICI METRİKLERİ:
□ Kaç kullanıcı şikayet etti?
□ Kaç iade talebi geldi?
□ Kaç chargeback geldi?

GÜVENLİK:
□ İmza hatası sayısı?
□ Fiyat uyumsuzluğu sayısı?
□ Şüpheli aktivite var mı?

AKSİYONLAR:
□ [Bu hafta çözülmesi gereken]
□ [Bu hafta izlenmesi gereken]
```

---

## 🚫 Solo Kurucu Olarak Yapmaман Gerekenler

```
❌ 7/24 destek vaat etme (tükenir ve kullanıcı bekler)
❌ Hemen iade vaadinde bulunma (önce araştır)
❌ "Sistem mükemmel çalışıyor" de (her sistem bozulur)
❌ Tek bir sorun için saatler harca (time-box et: 30 dk → eskalasyon)
❌ Kötü gün geldiğinde sistemi tamamen değiştirmeye kalkış
❌ Audit log olmadan manuel değişiklik yap
❌ iyzico olmadan başka birinin ödeme bilgilerini işle
```

---

## ✅ Ödeme Operasyonları — Altın Kurallar

```
1. Her ödeme conversation_id ile loglan
2. Callback'te ASLA frontend'e güvenme
3. Her manuel değişikliği audit log'a yaz
4. İade yapmadan önce kanıtları kontrol et
5. Chargeback geldiğinde 24 saat içinde itiraz et
6. iyzico panelini haftada bir kontrol et
7. Ödeme kayıtlarını 5 yıl sakla
8. Test ödemelerini her deployment sonrası yap
```

---

## 📈 Ölçekleme Sinyalleri

```
Ne zaman "ödeme sistemi düşünme zamanı" geldi?

→ Haftada 5+ destek vakası (çoğu ödemeyle ilgili)
→ Aylık 10+ iade talebi
→ Herhangi bir chargeback
→ Ödemeler sistematik başarısız oluyor
→ Manuel müdahale rutin hale geldi

Bu noktada:
1. Kök nedenleri bul (tek tek değil, pattern)
2. Önce kodu düzelt, sonra process'i düzelt
3. Otomasyonu artır (bildirimler, raporlar)
4. Gerekirse ödeme uzmanı danışmanı al
```
