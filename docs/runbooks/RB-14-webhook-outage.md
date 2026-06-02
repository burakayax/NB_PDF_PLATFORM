# RB-14: Webhook / Callback Kesintisi

> **Senaryo:** Kullanıcılar ödeme yapıyor ama hiçbiri plan almıyor. payment_checkouts tablosunda herkes PENDING. Callback'ler geliyor mu?

---

## 🚦 Belirtiler

```
- Son 30 dakikada hiç "subscription_activated" log yok
- payment_checkouts tablosunda çok PENDING kayıt birikti
- Kullanıcılar "ödeme yaptım ama plan değişmedi" diyor
- UptimeRobot site UP gösteriyor ama ödeme çalışmıyor
```

---

## 🔍 Adım 1: Callback Geliyor mu?

```bash
# Nginx log'larında callback POST isteği var mı?
grep "POST /api/payment/callback" /var/log/nginx/access.log | tail -20

# Sonuçlar:
# - Hiç kayıt yok → iyzico callback göndermiyor veya ulaşmıyor
# - 502/503 döndürüyor → Auth API çalışmıyor
# - 200 döndürüyor ama plan değişmiyor → Uygulama içi hata
```

```bash
# Uygulama log'larında callback kaydı var mı?
grep "callback_received" /var/log/nb-pdf-platform/api.log | tail -10

# Hiç yok → Callback endpoint'e ulaşmıyor
# Var ama "signature_invalid" → Secret key sorunu
# Var ama "retrieve_failed" → iyzico API sorunu
```

---

## 🔍 Adım 2: Callback URL Erişilebilir mi?

```bash
# Dışarıdan callback URL'ini test et:
curl -v -X POST https://siteadin.com/api/payment/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "test=1"

# Beklenen: 400 veya 422 (geçersiz imza hatası — bu NORMAL, URL erişilebilir demek)
# Endişelendirici: 502, 503, 404, timeout
```

---

## 🔍 Adım 3: iyzico Panel Kontrolü

```
1. https://merchant.iyzico.com → Giriş yap
2. Entegrasyon → Callback URL → Doğru URL yazılı mı?
3. Son işlemler → Callback durumları
   - "Callback gönderildi" → Ama bize ulaşmadı → Bizim tarafta sorun
   - "Callback gönderilmedi" → iyzico tarafında sorun
```

---

## 🛠️ Senaryo A: Auth API Çalışmıyor

```bash
systemctl status nb-api
# Failed veya inactive → Adım:
systemctl restart nb-api
sleep 10

# Test:
curl -f http://localhost:4000/api/health
```

---

## 🛠️ Senaryo B: Secret Key Yanlış

```bash
# İmza hataları var mı?
grep "callback_signature_invalid" /var/log/nb-pdf-platform/api.log | tail -5

# Eğer varsa → IYZICO_SECRET_KEY kontrol et
grep "IYZICO_SECRET_KEY" web/api/.env | wc -c
# 65+ olmalı (anahtar uzunluğu + = + newline)

# Sandbox key mi kullanıyorsun?
grep "IYZICO_URI" web/api/.env
# Prod: https://api.iyzipay.com
# Sandbox: https://sandbox-api.iyzipay.com → YANLIŞ (prod'da)
```

---

## 🛠️ Senaryo C: iyzico Tarafında Kesinti

```bash
# iyzico status sayfasını kontrol et:
curl -s https://api.iyzipay.com -o /dev/null -w "%{http_code}"
# 200 → iyzico çalışıyor
# 5xx, timeout → iyzico kesintisi var

# iyzico status: https://status.iyzico.com (varsa)
# Ya da: Twitter/X'te @iyzico hesabını kontrol et
```

**iyzico kesintisi varsa:**
```
1. Bekliyorsun. iyzico genellikle birkaç saat içinde toparlar.
2. Kullanıcılara bildirim gönder: "Ödeme sistemi geçici olarak bakımda"
3. iyzico toparlandığında otomatik retry yapacak.

NOT: iyzico callback'leri birkaç kez retry eder:
  - 0 dk (ilk gönderim)
  - 1 dk sonra
  - 5 dk sonra
  - 15 dk sonra
  - 30 dk sonra
  - 1 saat sonra
  Tüm retry'lar başarısız olursa → Manuel düzeltme gerekir
```

---

## 🛠️ Senaryo D: Sunucu Tamamen Çökmüştü

```
Belirti: Geçmişte downtime yaşandı, o sırada callback geldi, kaçırıldı.
Şimdi çalışıyor ama o sıradaki ödemeler hâlâ PENDING.
```

```sql
-- Kaçırılan callbackleri bul:
SELECT 
  conversation_id,
  iyzico_payment_id,
  user_id,
  plan,
  amount_expected,
  created_at
FROM payment_checkouts
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '2 hours'  -- 2 saatdir PENDING
ORDER BY created_at;
```

**Her kayıt için:** iyzico panel'de kontrol et. SUCCESS ise manuel güncelle (RB-12 Adım F).

---

## 🔄 Toplu Manuel Düzeltme (Çok Sayıda Etkilenen Kullanıcı Varsa)

```sql
-- Etkilenen kullanıcıları belirle:
SELECT 
  u.email,
  pc.conversation_id,
  pc.plan,
  pc.created_at
FROM payment_checkouts pc
JOIN users u ON u.id = pc.user_id
WHERE pc.status = 'PENDING'
  AND pc.created_at BETWEEN 'KESİNTİ_BAŞLANGIÇ' AND 'KESİNTİ_BİTİŞ'
ORDER BY pc.created_at;
```

**Sonraki adımlar:**
1. Her conversation_id için iyzico panelde teyit et
2. SUCCESS olanları listele
3. Toplu güncelleme yap (dikkatli, transaction içinde)
4. Etkilenen kullanıcılara özür emaili gönder

---

## 📧 Toplu Kesinti E-postası

```
Konu: Ödeme Sistemimizde Yaşanan Geçici Sorun Çözüldü

Merhaba,

[TARİH] [SAAT] ile [SAAT] arasında ödeme işlemlerinde teknik bir aksaklık yaşandı.

Bu süre içinde ödeme yapan tüm kullanıcılarımızın hesapları 
manuel olarak kontrol edilerek güncellendi.

Hesabınızın durumunu kontrol etmek için giriş yapabilirsiniz.
Hâlâ sorun yaşıyorsanız lütfen bize yazın.

Yaşanan aksaklık için özür dileriz.
```
