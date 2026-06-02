# Ödeme Güvenliği ve Dolandırıcılık Önleme

> **Gerçek:** MVP aşamasında karmaşık fraud sistemlere gerek yok. Ama temel korumalar olmadan ilk ayda saldırıya uğrarsın. Bu belge neyi şimdi, neyi sonra yapacağını öğretir.

---

## 🎯 MVP'de Gerçekten Önemli Olan Tehditler

```
🔴 YÜKSEK RİSK (Şimdi Önle):
- Webhook replay attack (sahte callback ile ücretsiz abonelik)
- Price tampering (frontend'den fiyat değiştirme)
- Trial/free plan abuse (sürekli yeni hesap açma)
- Credential stuffing (başkasının hesabına giriş)

🟡 ORTA RİSK (100+ kullanıcıda bak):
- Refund abuse (al-iade-tekrar al döngüsü)
- Account sharing (bir hesabı birçok kişi kullanma)
- Rate limit bypass (VPN ile limit aşma)

🟢 DÜŞÜK RİSK (1000+ kullanıcıda düşün):
- Sophisticated card testing
- Organized fraud rings
- API scraping attacks
```

---

## 🔒 Webhook Replay Attack — En Kritik Tehdit

**Ne bu:** Saldırgan geçerli bir iyzico callback isteğini kaydeder ve tekrar gönderir. Eğer sisteminiz idempotency kontrolü yapmıyorsa → Ücretsiz abonelik.

```
Senaryo:
1. Saldırgan gerçek bir ödeme yapar (99₺)
2. iyzico callback'ini kaydeder (network sniffer ile)
3. Aboneliği iptal eder / iadesini alır
4. Kaydedilen callback'i senin sunucuna tekrar gönderir
5. Sistem tekrar COMPLETED işlerse → Bedava abonelik
```

**Önlem (zaten uygulanmalı):**
```typescript
// Callback handler'ında:
const existing = await db.paymentCheckout.findUnique({
  where: { conversationId: req.body.conversationId }
});

if (existing?.status === 'COMPLETED') {
  // ← Bu kontrol replay attack'i önler
  logger.warn({
    event: 'duplicate_callback_rejected',
    conversation_id: req.body.conversationId,
    already_completed_at: existing.completedAt
  });
  return res.send('already_processed');  // 200 döndür ama işleme
}
```

**Ekstra önlem — Zaman damgası kontrolü:**
```typescript
// Callback çok eski mi? (30 dakikadan eski callback'i reddet)
const callbackAge = Date.now() - new Date(req.body.systemTime).getTime();
if (callbackAge > 30 * 60 * 1000) {
  logger.warn({ event: 'stale_callback_rejected', age_minutes: callbackAge / 60000 });
  return res.status(400).send('callback_too_old');
}
```

---

## 💰 Price Tampering — Frontend'den Fiyat Değiştirme

**Ne bu:** Kullanıcı browser developer tools ile POST isteğini düzenler ve price alanını "0.01" yapar.

```
❌ YANLIŞ (Güvenlik açığı):
// Frontend:
fetch('/api/payment/checkout', {
  body: JSON.stringify({ plan: 'PRO', price: '0.01' })  ← Kullanıcı değiştirebilir!
})

// Backend:
const price = req.body.price;  ← YANLIŞ! Frontend'e güvenme!
```

```typescript
// ✅ DOĞRU (Sunucu taraflı fiyat):
const PLAN_PRICES = {
  PRO:      { monthly: '99.00',  annual: '990.00' },
  BUSINESS: { monthly: '199.00', annual: '1990.00' }
} as const;

// Backend'de:
const price = PLAN_PRICES[req.body.plan]?.[req.body.billing];
if (!price) throw new Error('Invalid plan or billing type');

// Ve callback'te fiyatı tekrar doğrula:
if (payment.paidPrice !== expectedAmount) {
  logger.error({ event: 'price_mismatch_detected', ... });
  // Ödemeyi reddet, refund başlat
}
```

---

## 🔄 Rate Limiting Stratejisi

### Ödeme Endpoint'leri İçin Limitler

```typescript
// payment.routes.ts — Sıkı limitler:

// Checkout başlatma: 5 deneme/saat/kullanıcı
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `checkout:${req.user?.id ?? req.ip}`,
  message: { message: 'Too many checkout attempts. Please wait.' }
});

// Callback endpoint: IP bazlı (iyzico'nun IP'leri sabit)
// Not: Callback'e rate limit koyarsan iyzico'nun retry'ları da engellenir
// Bu nedenle callback'i signature doğrulamasıyla koru, rate limit yerine
```

---

## 🚨 Şüpheli Aktivite Tespiti

### Günlük İzlemede Dikkat Edilecekler

```bash
#!/bin/bash
# /usr/local/bin/nb-fraud-check.sh
# Her sabah çalıştır

LOG="/var/log/nb-pdf-platform/api.log"
DATE=$(date -d "yesterday" +%Y-%m-%d)

echo "=== $DATE Fraud Kontrol Raporu ==="

# 1. Başarısız checkout denemeleri (tek IP'den çok)
echo ""
echo "❓ Çok checkout denemesi yapan IP'ler:"
grep "$DATE" $LOG | jq 'select(.event == "checkout_initiated")' | \
  jq -r '.ip' | sort | uniq -c | sort -rn | awk '$1 > 10 { print "UYARI: "$1" deneme → "$2 }'

# 2. Fiyat eşleşmeme uyarıları
echo ""
echo "🚨 Fiyat eşleşmeme olayları:"
grep "$DATE" $LOG | jq 'select(.event == "price_mismatch_detected")' | wc -l

# 3. İmza hatalı callback'ler
echo ""
echo "⚠️ Sahte/hatalı callback girişimleri:"
grep "$DATE" $LOG | jq 'select(.event == "callback_signature_invalid")' | wc -l

# 4. Kısa sürede çok hesap açma (aynı IP)
echo ""
echo "❓ Çok hesap açan IP'ler:"
grep "$DATE" $LOG | jq 'select(.event == "user_registered")' | \
  jq -r '.ip' | sort | uniq -c | sort -rn | awk '$1 > 3 { print "UYARI: "$1" kayıt → "$2 }'

# 5. Beklenmedik webhook IP'leri
# iyzico'nun IP aralıkları: 91.93.x.x ve 185.x.x.x (değişebilir, iyzico'dan teyit et)
echo ""
echo "⚠️ Şüpheli callback IP'leri:"
grep "$DATE" $LOG | jq 'select(.event == "callback_received")' | \
  jq -r '.remote_ip' | sort -u
```

---

## 🎭 Yaygın Fraud Desenleri ve Tespiti

### Desen 1: Trial Abuse

```
Belirti: Aynı IP'den kısa sürede çok hesap, hepsi FREE plan kullanıyor.
Muhtemelen: Birisi sınırları test etmek için bot ile hesap açıyor.

Tespit:
SELECT ip_address, COUNT(*) as count
FROM users
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING COUNT(*) > 5
ORDER BY count DESC;

Aksiyon: O IP'den kayıtları geçici olarak engelle (rate limit artır)
```

### Desen 2: Refund Abuse

```
Belirti: Kullanıcı satın alır, 1-2 gün kullanır, iade ister.
         Sonra tekrar satın alır, tekrar iade ister. Tekrar tekrar.

Tespit:
SELECT u.email, COUNT(pc.id) as total_purchases, COUNT(pc_refunded.id) as total_refunds
FROM users u
JOIN payment_checkouts pc ON pc.user_id = u.id
LEFT JOIN payment_checkouts pc_refunded ON pc_refunded.user_id = u.id AND pc_refunded.status = 'REFUNDED'
WHERE pc.created_at > NOW() - INTERVAL '90 days'
GROUP BY u.id, u.email
HAVING COUNT(pc_refunded.id) > 2
ORDER BY total_refunds DESC;

Aksiyon: Bu kullanıcıya iade reddet. Gerekirse hesabı askıya al.
```

### Desen 3: Credential Stuffing

```
Belirti: Kısa sürede çok sayıda başarısız giriş, farklı email'ler ama aynı IP.
Muhtemelen: Başka sitelerden çalınmış email/şifre listesi deneniyor.

Tespit:
grep "login_failed" /var/log/nb-pdf-platform/api.log | \
  grep "$(date +%Y-%m-%d)" | \
  jq -r '.ip' | sort | uniq -c | sort -rn | head -10

Aksiyon:
- CAPTCHA ekle (Google reCAPTCHA v3)
- Başarısız giriş limitini düşür (5 deneme/IP)
- Şüpheli IP'yi geçici engelle
```

---

## 📊 Günlük İzleme Metrikleri

```
Her sabah bu sayıları not et:

Dün:
□ Başarılı ödeme sayısı: ___
□ Başarısız ödeme sayısı: ___
□ Başarısız/Başarılı oranı: ___  (normal: %5 altı)
□ İmza hatalı callback sayısı: ___  (normal: 0)
□ Fiyat eşleşmeme sayısı: ___  (normal: 0)
□ Şüpheli çok deneme yapan IP sayısı: ___

Alarm tetiklenmesi gereken durumlar:
- Fiyat eşleşmeme > 0 → Hemen incele
- İmza hatalı callback > 5 → Saldırı olabilir
- Başarısız ödeme oranı > %15 → iyzico'da sorun olabilir
```
