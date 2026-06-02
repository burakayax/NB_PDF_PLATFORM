# Ödeme Sistemi — Adım Adım Nasıl Çalışır?

> **Bu belge kimin için:** Ödeme sistemini ilk kez anlayan, "ne zaman ne oluyor" sorusunu sormak isteyen solo kurucu için yazıldı. Her adımda ne olabileceğini, neyin loglanması gerektiğini ve neden güvenilemeyeceğini öğreneceksin.

---

## 🧠 Terminoloji Sözlüğü (Önce Bunları Öğren)

| Terim | Türkçe Açıklama |
|-------|-----------------|
| **Checkout Session** | Kullanıcının ödeme yapmak için başlattığı oturum. iyzico'da buna "ödeme formu" deniyor. |
| **Callback / Webhook** | Ödeme tamamlandığında iyzico'nun senin sunucuna gönderdiği bildirim. |
| **Conversation ID** | iyzico'nun her ödeme için ürettiği benzersiz kimlik. Ödemeyi takip etmek için kullanırsın. |
| **Correlation ID** | Senin sisteminizin her isteğe verdiği benzersiz kimlik. Log'larda olayları birbirine bağlar. |
| **Idempotency** | Aynı işlemi iki kez yapsan bile sonucun tek olması. "Çift ödeme" sorununu önler. |
| **Race Condition** | İki işlemin aynı anda çalışıp birbirini bozması. Webhook + manuel güncelleme çakışması gibi. |
| **Reconciliation** | Senin veritabanındaki verilerle iyzico'nun verilerini karşılaştırma. "Eşleştirme" |
| **Chargeback** | Kullanıcının bankasına gidip "bu parayı iade edin" demesi. En tehlikeli durum. |
| **PCI DSS** | Kart verisi güvenliği standartları. Kart numarası loglamak yasak demek. |

---

## 📊 Büyük Resim: Ödeme Mimarisi

```
KULLANICI (Tarayıcı)
       │
       │ 1. "Satın Al" düğmesine basar
       ▼
REACT FRONTEND
       │
       │ 2. POST /api/payment/checkout-session
       ▼
EXPRESS AUTH API (Node.js :4000)
       │
       │ 3. Fiyatı SUNUCUDA hesapla (frontend'e güvenme!)
       │ 4. iyzico'ya checkout başlatma isteği gönder
       ▼
İYZİCO API (https://api.iyzipay.com)
       │
       │ 5. Ödeme formu URL'i döndür
       ▼
EXPRESS AUTH API
       │
       │ 6. Frontend'e checkout URL'i gönder
       ▼
REACT FRONTEND
       │
       │ 7. Kullanıcıyı iyzico ödeme formuna yönlendir
       ▼
İYZİCO ÖDEME FORMU (iyzico sayfası)
       │
       │ 8. Kullanıcı kart bilgilerini girer (kart datası HİÇBİR ZAMAN senin sunucuna gelmez!)
       │ 9. Ödeme başarılı veya başarısız
       ▼
İYZİCO CALLBACK SİSTEMİ
       │
       │ 10. iyzico senin CALLBACK_URL'ine POST isteği gönderir
       ▼
EXPRESS AUTH API /api/payment/callback
       │
       │ 11. İmzayı doğrula (HMAC-SHA256) — sahte callback reddet
       │ 12. iyzico'ya "retrieve" isteği gönder (doğrulama)
       │ 13. Ödeme başarılıysa veritabanını güncelle
       │ 14. Kullanıcının planını PRO yap
       │ 15. Audit log yaz
       ▼
VERİTABANI (PostgreSQL)
       │
       │ 16. User.plan = 'PRO'
       │ 17. SubscriptionStatus kayıt
       │ 18. PaymentCheckout kayıt (COMPLETED)
       │ 19. AuditLog kayıt
       ▼
KULLANICI
       │
       │ 20. iyzico kullanıcıyı success/fail sayfasına yönlendirir
       │ 21. Kullanıcı dashboard'a döner, PRO özellikler aktif
```

---

## 🔍 Her Adımın Detaylı Analizi

### ADIM 1-2: Kullanıcı Ödeme Düğmesine Basar

**Ne olur:**
```javascript
// Frontend'de:
const response = await fetch('/api/payment/checkout-session', {
  method: 'POST',
  body: JSON.stringify({ plan: 'PRO', billing: 'monthly' })
});
```

**Ne loglanmalı:**
```json
{
  "event": "checkout_initiated",
  "user_id": "usr_abc123",
  "plan": "PRO",
  "billing": "monthly",
  "ip": "1.2.3.4",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "correlation_id": "req_xyz789"
}
```

**⚠️ Ne Yanlış Gidebilir:**
- Kullanıcı oturumu süresi dolmuştu → 401 hatası
- Kullanıcı zaten aynı planı almaya çalışıyor
- Network bağlantısı kesildi

**🚫 Frontend'e ASLA Güvenme:**
```
❌ YANLIŞ: Fiyatı frontend'den al
  { plan: "PRO", price: "99" }  ← KULLANICI BUNU DEĞİŞTİREBİLİR!

✅ DOĞRU: Fiyatı sunucuda hesapla
  { plan: "PRO" } → Sunucu bakır 99₺ olduğunu biliyor
```

---

### ADIM 3-4: Sunucu Checkout Oturumu Oluşturur

**Ne olur (Express/Node.js):**
```typescript
// payment.service.ts
async function createCheckoutSession(userId, plan, billing) {
  // 1. Fiyatı sunucu tarafında belirle
  const price = PLAN_PRICES[plan][billing]; // ← Sunucu hardcoded fiyat listesi
  
  // 2. Benzersiz conversation ID oluştur
  const conversationId = generateConversationId(); // req_timestamp_userid_random
  
  // 3. DB'ye "bekleyen ödeme" kaydet
  await db.paymentCheckout.create({
    userId,
    conversationId,
    plan,
    amount: price,
    status: 'PENDING',
    createdAt: new Date()
  });
  
  // 4. iyzico'ya gönder
  const iyzicoResponse = await iyzico.createCheckoutForm({
    conversationId,
    price: price.toString(),
    buyer: { id: userId, ... },
    callbackUrl: `${process.env.PAYMENT_CALLBACK_BASE_URL}/api/payment/callback`
  });
  
  return iyzicoResponse.checkoutFormContent; // Ödeme formu HTML/URL
}
```

**Ne loglanmalı:**
```json
{
  "event": "checkout_session_created",
  "user_id": "usr_abc123",
  "conversation_id": "conv_20240115_usr_abc123_x7k9",
  "plan": "PRO",
  "amount": "99.00",
  "currency": "TRY",
  "iyzico_token": "CHECKOUT_FORM_TOKEN_BURAYA",
  "timestamp": "2024-01-15T10:30:01.234Z"
}
```

**⚠️ Ne Yanlış Gidebilir:**
- iyzico API'ye bağlanılamadı (timeout)
- iyzico API key geçersiz (401)
- Yanlış fiyat formatı (iyzico virgül/nokta hassas)
- Kullanıcı bilgileri eksik (iyzico email/isim zorunlu tutabilir)

**🔑 Kritik Kural:**
```
Conversation ID'yi HER ZAMAN sen üret, iyzico'ya gönder.
Bu ID ile sonraki adımlarda ödemeyi bulacaksın.
DB'ye kaydet → iyzico'ya gönder → callback'te doğrula.
```

---

### ADIM 5-7: Kullanıcı iyzico Formunu Doldurur

**Bu adımda kart verisi ASLA sana gelmiyor.**

```
iyzico ödeme formu → Kart verisi SADECE iyzico'nun sunucusuna gidiyor
                   → Sana sadece "başarılı / başarısız" bildirimi geliyor
                   → Bu PCI uyumluluğu sağlar
```

**İki sonuç mümkün:**
1. ✅ Ödeme başarılı → iyzico callback URL'ine POST gönderir
2. ❌ Ödeme başarısız → iyzico callback URL'ine POST gönderir (status farklı)

---

### ADIM 10-13: Callback İşleme — EN KRİTİK ADIM

**Bu adım en sık bozulan yer.**

```typescript
// payment.controller.ts
async function handlePaymentCallback(req, res) {
  // ADIM A: İmzayı doğrula (Sahte callback'leri reddet)
  const isValid = verifyIyzicoSignature(req.body);
  if (!isValid) {
    logger.warn({ event: 'callback_signature_invalid', body: '[REDACTED]' });
    return res.status(400).send('Invalid signature');
  }
  
  // ADIM B: iyzico'ya retrieve isteği gönder (Double check)
  // Sadece callback'e güvenme! iyzico'yu teyit için ara.
  const payment = await iyzico.retrieve({
    conversationId: req.body.conversationId,
    paymentId: req.body.paymentId
  });
  
  // ADIM C: Ödeme gerçekten başarılı mı?
  if (payment.status !== 'success' || payment.paymentStatus !== 'SUCCESS') {
    logger.info({ event: 'payment_failed', conversationId: payment.conversationId });
    return res.send('payment_failed');
  }
  
  // ADIM D: Fiyatı teyit et (Price tampering kontrolü)
  const expectedAmount = getExpectedAmount(payment.conversationId);
  if (payment.paidPrice !== expectedAmount) {
    logger.error({ event: 'price_mismatch', expected: expectedAmount, received: payment.paidPrice });
    return res.status(400).send('price_mismatch');
  }
  
  // ADIM E: Idempotency - Daha önce işlendi mi?
  const existing = await db.paymentCheckout.findByConversationId(payment.conversationId);
  if (existing?.status === 'COMPLETED') {
    logger.warn({ event: 'duplicate_callback', conversationId: payment.conversationId });
    return res.send('already_processed'); // OK döndür ama işleme
  }
  
  // ADIM F: Transaction içinde güncelle
  await db.$transaction(async (tx) => {
    await tx.paymentCheckout.update({ status: 'COMPLETED', ... });
    await tx.user.update({ plan: targetPlan, ... });
    await tx.subscriptionStatus.upsert({ ... });
  });
  
  logger.info({ event: 'subscription_activated', userId, plan: targetPlan });
}
```

**⚠️ Race Condition Riski:**
```
Senaryo: Kullanıcı ödeme düğmesine iki kez bastı.
→ iyzico'dan iki ayrı callback gelebilir
→ İkisi aynı anda veritabanını güncelleyebilir
→ Sonuç: Çift plan güncelleme veya çift kredi ekleme

Çözüm: Idempotency check (yukarıdaki ADIM E)
Ve: Transaction kullan (tüm güncellemeler tek atomik işlem)
```

---

### ADIM 14-19: Veritabanı Güncellemeleri

**Hangi tablolar güncellenmeli:**

```sql
-- 1. Ödeme kaydını tamamla
UPDATE payment_checkouts
SET status = 'COMPLETED',
    iyzico_payment_id = 'iyzico_pay_123',
    completed_at = NOW()
WHERE conversation_id = 'conv_xyz';

-- 2. Kullanıcı planını yükselt
UPDATE users
SET plan = 'PRO',
    plan_expires_at = NOW() + INTERVAL '30 days'
WHERE id = 'usr_abc123';

-- 3. Abonelik kaydı oluştur
INSERT INTO subscription_status (user_id, plan, started_at, expires_at, payment_id)
VALUES ('usr_abc123', 'PRO', NOW(), NOW() + INTERVAL '30 days', 'iyzico_pay_123');

-- 4. Audit log yaz
INSERT INTO admin_audit_logs (user_email, action, target_key, summary, created_at)
VALUES ('user@email.com', 'subscription_activated', 'usr_abc123',
        'PRO plan iyzico callback ile aktive edildi. payment_id: iyzico_pay_123', NOW());
```

---

### ADIM 20-21: Kullanıcı Yönlendirilir

```
iyzico → Kullanıcıyı success URL'e yönlendirir (örn: /payment/success)
       → Kullanıcı dashboard'a döner
       → Frontend /api/auth/me çağırır → Plan artık PRO
```

**⚠️ Kritik Uyarı:**
```
Success sayfası güvenilmez bilgi kaynağıdır!
Kullanıcı success URL'ini manuel olarak açabilir.
Asıl güvenilir kaynak: Callback (iyzico'dan gelen) + Veritabanı
```

---

## 🚨 En Sık Görülen Hatalar ve Sebepleri

### Hata 1: Callback URL'i Ulaşılamaz

```
Belirti: Kullanıcı ödeme yaptı ama plan değişmedi.
Sebep:   iyzico callback gönderdi ama senin sunucun yanıt vermedi.
         (Sunucu kapalıydı, URL yanlıştı, 5xx döndürdü)

iyzico'nun davranışı: Callback başarısız olursa tekrar dener.
Retry pattern: 1 dk → 5 dk → 15 dk → 30 dk → sonra bırakır.
```

### Hata 2: Callback İmzası Doğrulaması Başarısız

```
Belirti: "callback_signature_invalid" log'ları var ama ödeme başarılı.
Sebep:   IYZICO_SECRET_KEY yanlış. Sandbox key ile production env karışmış.

Kontrol: grep "IYZICO_SECRET_KEY" web/api/.env
```

### Hata 3: Veritabanı Güncellemesi Transaction Dışında

```
Belirti: payment_checkouts COMPLETED ama users.plan hâlâ FREE.
Sebep:   Güncelleme sırasında hata oluştu, transaction yoktu, kısmi güncelleme kaldı.

Kontrol: 
  SELECT u.plan, pc.status 
  FROM users u 
  JOIN payment_checkouts pc ON pc.user_id = u.id 
  WHERE pc.status = 'COMPLETED' AND u.plan = 'FREE';
  -- Bu sorgu sonuç veriyorsa → broken state'te kullanıcılar var
```

### Hata 4: Duplicate Callback (İdempotency Yok)

```
Belirti: Kullanıcının subscription_status tablosunda iki kayıt var.
         DailyUsage sıfırlandı ama tekrar sıfırlandı.
Sebep:   iyzico aynı callback'i iki kez gönderdi. Sistemin iki kez işledi.

Önlem: Callback'in başında conversationId kontrolü yap.
```

---

## 📋 Ödeme Akışı — Adım Adım Kontrol Listesi

```
□ Checkout başlatıldı mı?          → payment_checkouts tablosunda PENDING kayıt
□ iyzico'ya ulaşıldı mı?           → iyzico_token null değil mi?
□ Callback alındı mı?              → payment_checkouts.callback_received_at dolu mu?
□ İmza geçerli mi?                 → callback_signature_valid = true?
□ Retrieve başarılı mı?            → iyzico_retrieve_status = 'SUCCESS'?
□ Fiyat eşleşiyor mu?              → amount_expected = amount_paid?
□ DB transaction başarılı mı?      → status = 'COMPLETED'?
□ User.plan güncellendi mi?        → users.plan = hedef plan?
□ Subscription kaydı var mı?       → subscription_status'ta kayıt?
□ Audit log yazıldı mı?            → admin_audit_logs'ta kayıt?
```
