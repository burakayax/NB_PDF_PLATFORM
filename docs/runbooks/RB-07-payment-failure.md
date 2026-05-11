# RB-07 — Ödeme Sistemi Arızası

> **Kritiklik:** 🟠 YÜKSEK — Gelir kaybı riski
> **Tipik çözüm süresi:** 5-120 dakika (iyzico kaynaklıysa bağımsız)

---

## 🔍 Belirtiler

- Kullanıcılar "ödeme başarısız" hatası alıyor
- "Checkout başlatılamadı" (502 / 503)
- Ödeme tamamlandı ama plan güncellenmiyor
- iyzico panelinde ödeme başarılı ama kullanıcı hâlâ FREE
- "Payment provider request failed" logu

---

## ✅ Adım 1: Türünü Belirle

```bash
# İyzico bağlantısı var mı?
curl -s https://api.iyzipay.com/  # Üretim
curl -s https://sandbox-api.iyzipay.com/  # Sandbox
# HTTP 200 gelmeli

# Logda ödeme hatası ne diyor?
grep -i "payment\|iyzico\|callback" /var/log/nb-pdf-platform/api.log | \
  tail -50 | grep -i "error\|failed\|rejected"
```

---

## 🔍 Senaryo A: Checkout Başlamıyor

**Belirti:** Kullanıcı "Abone Ol" tıklıyor → hata

```bash
# Logda ne var?
grep "createPaymentCheckoutSession\|Payment provider" \
  /var/log/nb-pdf-platform/api.log | tail -20

# İyzico API key doğru mu?
grep "IYZICO" /path/to/project/web/api/.env | grep -v SECRET | head -5
# KEY'ler dolu mu?

# İyzico API endpoint doğru mu?
grep "IYZICO_URI" /path/to/project/web/api/.env
# Sandbox: https://sandbox-api.iyzipay.com
# Üretim: https://api.iyzipay.com
# KESİNLİKLE sandbox üretimde kullanma!
```

**Çözüm:**
1. iyzico panelinden API key'lerin geçerli olduğunu doğrula
2. `.env`'deki `IYZICO_URI` üretim URL'i mi kontrol et
3. Node.js API'yi yeniden başlat: `sudo systemctl restart nb-api`

---

## 🔍 Senaryo B: Ödeme Tamamlandı Ama Plan Güncellenmiyor

**Bu en tehlikeli senaryo.** Kullanıcı ödedi ama aboneliği aktif değil.

```bash
# İyzico callback endpoint'ine istek geliyor mu?
grep "iyzico/callback\|POST received" /var/log/nb-pdf-platform/api.log | tail -20

# Callback geldi ama işlenemedi mi?
grep "PaymentFulfillmentDbError\|DB fulfillment FAILED" \
  /var/log/nb-pdf-platform/api.log | tail -10

# iyzico'nun gönderdiği conversationId veritabanında var mı?
npx prisma db execute --stdin <<'SQL'
SELECT conversation_id, status, plan, price_try, created_at, completed_at
FROM payment_checkouts
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
SQL
```

**Çözüm — Manuel Plan Güncelleme:**
```bash
# Kullanıcının e-postasını bul, durumu kontrol et:
npx prisma db execute --stdin <<'SQL'
SELECT u.id, u.email, u.plan, pc.conversation_id, pc.status, pc.price_try
FROM users u
JOIN payment_checkouts pc ON pc.user_id = u.id
WHERE u.email = 'kullanici@email.com'
ORDER BY pc.created_at DESC
LIMIT 5;
SQL

# Ödeme gerçekten tamamlandıysa (iyzico panelinde başarılı görünüyorsa):
# Admin panelinden kullanıcının planını manuel güncelle
# VEYA veritabanından:
npx prisma db execute --stdin <<'SQL'
-- DİKKAT: Sadece ödemenin gerçek olduğundan emin olunca yap!
BEGIN;
UPDATE payment_checkouts 
  SET status = 'completed', completed_at = NOW() 
  WHERE conversation_id = 'CONVERSATION_ID_BURAYA';
UPDATE users 
  SET plan = 'PRO'  -- veya BUSINESS
  WHERE id = 'USER_ID_BURAYA';
COMMIT;
SQL
```

---

## 🔍 Senaryo C: iyzico Servis Kesintisi

**iyzico'nun kendi sistemi düşmüş olabilir:**

```bash
# iyzico status sayfası:
# https://status.iyzico.com (böyle bir sayfa yoksa Twitter'dan kontrol et)

# Gelen callback'ler imza hatası mı veriyor?
grep "iyzico_signature_mismatch" /var/log/nb-pdf-platform/api.log | tail -10
# Çoksa: API key/secret yanlış ya da iyzico'da sorun var
```

**İyzico kesintisinde ne yaparsın?**
1. iyzico'nun restorasyon süresini bekle
2. Etkilenen kullanıcılara e-posta gönder: "Ödeme sistemi geçici olarak bakımda"
3. Kullanıcılara FREE plan limitlerini geçici olarak artır (admin panelinden)
4. iyzico düzelince bekleyen checkout'ları manuel onayla

---

## 🔍 Senaryo D: Callback URL Erişilemiyor

iyzico callback'i göndermeye çalışıyor ama ulaşamıyor.

```bash
# Callback URL doğru mu?
grep "PAYMENT_CALLBACK_BASE_URL" /path/to/project/web/api/.env
# Bu URL dışarıdan erişilebilir olmalı

# Test:
curl -X POST https://siteadın.com/api/payments/callback \
  -d "token=test" \
  -H "Content-Type: application/x-www-form-urlencoded"
# 303 veya başka yanıt gelmeli (boş 404 değil)

# Nginx'te route var mı?
grep -A5 "payments/callback\|payment/callback" /etc/nginx/sites-available/nb-pdf-platform
```

---

## 🛡️ Önleyici Aksiyonlar

```bash
# 1. İyzico'yu test modu'ndan prod modu'na geçmeden önce kontrol listesi:
echo "Kontrol listesi:"
grep "IYZICO_URI" /path/to/project/web/api/.env
grep "IYZICO_API_KEY" /path/to/project/web/api/.env | wc -c
grep "NODE_ENV" /path/to/project/web/api/.env

# 2. Periyodik callback test (her gün otomatik test ödemesi):
# Bu ileride eklenebilir - şimdilik manuel kontrol

# 3. Bekleyen ödeme alarmı:
# Her sabah şunu çalıştır:
npx prisma db execute --stdin <<'SQL'
SELECT COUNT(*) as bekleyen
FROM payment_checkouts
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '2 hours';
SQL
# 0 olmalı. Varsa araştır.
```

---

## 📞 İyzico ile İletişim

Sorun devam ederse:
- **iyzico Destek:** https://iyzico.com/destek
- **İyzico Merchant Portal:** https://merchant.iyzico.com
- **Telefon:** iyzico'nun destek hattını ara

Konuşmadan önce hazır bil:
- API Key (son 4 karakteri)
- Sorunlu `conversationId`
- Hata mesajının tam metni
- Hangi anda oluştu (tarih/saat)
