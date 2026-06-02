# Ödeme Audit Log Sistemi

> **Neden önemli:** Bir kullanıcı "para çektiniz ama plan vermediniz" dediğinde, elinde kanıt olmadan ne yapabilirsin? Hiçbir şey. Audit log sistemi hem savunma kalkanın hem de destek aracın.

---

## 🧠 Audit Log Nedir? Neden Gereklidir?

**Audit log (denetim kaydı):** Sistemde olan her önemli olayın değiştirilemez kaydı.

```
Olmadan:  Kullanıcı "para çektiniz" der → Sen "çekmedik" dersin → İspatlayamazsın
Olunca:   Kullanıcı "para çektiniz" der → 5 saniyede kaydı bulursun → "İşte kanıtlar"
```

**İyi bir audit log şunu gösterir:**
- KİM yaptı (user_id, email, IP)
- NE ZAMAN yaptı (UTC timestamp, milisaniye hassasiyetinde)
- NE YAPTI (event tipi)
- SONUÇ NE OLDU (başarılı/başarısız, hata mesajı)
- NEREDE YAPTI (hangi endpoint, hangi servis)
- REFERANS ID (iyzico payment ID, conversation ID)

---

## ⏰ UTC vs Yerel Saat — Asla Karıştırma

```
❌ YANLIŞ: "2024-01-15 13:30:00" (hangi saat dilimi?)
✅ DOĞRU:  "2024-01-15T10:30:00.000Z" (UTC, net)

Neden: Sunucun İstanbul'da, kullanıcın Tokyo'da, iyzico'nun sunucusu Frankfurt'ta.
       Üç farklı saat dilimi — sadece UTC karşılaştırılabilir.

PostgreSQL'de: TIMESTAMP WITH TIME ZONE (TIMESTAMPTZ) kullan
Node.js'de:   new Date().toISOString() → UTC döndürür
```

---

## 🗄️ Önerilen Veritabanı Şemaları

### 1. PaymentCheckouts Tablosu (Ana Ödeme Tablosu)

```sql
-- Prisma Schema:
model PaymentCheckout {
  id                    String    @id @default(cuid())
  
  -- Kullanıcı bilgisi
  userId                String
  user                  User      @relation(fields: [userId], references: [id])
  userEmail             String    -- Snapshot: kullanıcı emaili değişse bile kayıt doğru
  
  -- Ödeme detayları
  plan                  String    -- "PRO", "BUSINESS"
  billing               String    -- "monthly", "annual"
  amountExpected        Decimal   @db.Decimal(10,2) -- Senin beklediğin fiyat
  amountPaid            Decimal?  @db.Decimal(10,2) -- iyzico'nun onayladığı fiyat
  currency              String    @default("TRY")
  
  -- iyzico referansları
  conversationId        String    @unique -- Senin ürettiğin ID
  iyzicoToken           String?   -- iyzico'dan gelen form token
  iyzicoPaymentId       String?   -- iyzico'nun ödeme ID'si (en önemli referans)
  iyzicoPaymentGroupId  String?
  iyzicoConversationId  String?   -- iyzico'nun conversation ID'si (aynı olmalı)
  
  -- Durum takibi
  status                String    @default("PENDING")
  -- PENDING → CALLBACK_RECEIVED → COMPLETED / FAILED / REFUNDED
  
  -- Callback detayları
  callbackReceivedAt    DateTime?
  callbackRawPayload    Json?     -- Ham callback verisi (debug için)
  callbackSignatureValid Boolean?
  
  -- Retrieve detayları
  retrieveStatus        String?   -- iyzico retrieve response status
  retrievePaymentStatus String?   -- iyzico payment status (SUCCESS, FAILURE)
  
  -- Hata bilgisi
  errorCode             String?
  errorMessage          String?
  failureReason         String?
  
  -- Zaman damgaları (HEPSİ UTC)
  createdAt             DateTime  @default(now())
  completedAt           DateTime?
  failedAt              DateTime?
  refundedAt            DateTime?
  
  -- İzlenebilirlik
  clientIp              String?
  userAgent             String?
  requestId             String?   -- Correlation ID
  
  @@index([userId])
  @@index([conversationId])
  @@index([iyzicoPaymentId])
  @@index([status])
  @@index([createdAt])
}
```

### 2. PaymentEvents Tablosu (Ödeme Olayları — Immutable Log)

```sql
-- Bu tablo SADECE INSERT yapılır. UPDATE/DELETE YASAK.
model PaymentEvent {
  id              String   @id @default(cuid())
  
  -- Bağlantı
  checkoutId      String   -- PaymentCheckout.id
  userId          String
  
  -- Olay bilgisi
  eventType       String
  -- Değerler: checkout_initiated, iyzico_request_sent, iyzico_response_received,
  --           callback_received, signature_verified, signature_failed,
  --           retrieve_requested, retrieve_success, retrieve_failed,
  --           price_mismatch_detected, duplicate_callback_detected,
  --           db_transaction_started, subscription_activated, subscription_failed,
  --           manual_repair, refund_initiated, refund_completed, chargeback_received
  
  -- Olay verisi
  eventData       Json     -- Olaya özel veriler (amount, plan, error, etc.)
  
  -- Kaynak
  triggeredBy     String   -- "system", "webhook", "admin:email@example.com", "support"
  
  -- İzlenebilirlik
  requestId       String?
  ipAddress       String?
  
  -- Zaman (UTC, milisaniye hassasiyetinde)
  occurredAt      DateTime @default(now())
  
  -- İndeksler
  @@index([checkoutId])
  @@index([userId])
  @@index([eventType])
  @@index([occurredAt])
}
```

### 3. AdminAuditLogs Tablosu (Admin/Operator Eylemleri)

```sql
model AdminAuditLog {
  id          String   @id @default(cuid())
  
  -- Kim yaptı
  adminEmail  String   -- Kim yaptı
  adminIp     String?
  
  -- Ne yaptı
  action      String
  -- Değerler: manual_plan_upgrade, manual_plan_downgrade, manual_refund,
  --           user_ban, user_unban, subscription_cancel, subscription_extend,
  --           credit_adjustment, support_investigation, payment_repair
  
  -- Neye yaptı
  targetUserId    String?
  targetUserEmail String?
  targetKey       String?  -- conversation_id, payment_id, vs.
  
  -- Detaylar
  summary         String   -- İnsan tarafından okunabilir açıklama
  previousValue   Json?    -- Değişiklik öncesi durum
  newValue        Json?    -- Değişiklik sonrası durum
  reason          String?  -- Neden yapıldı (support ticket ID, kullanıcı şikayeti, vs.)
  
  -- Zaman
  createdAt   DateTime @default(now())
  
  @@index([adminEmail])
  @@index([targetUserId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 📝 Structured Log Örnekleri (JSON Format)

### Başarılı Ödeme — Tam Log Dizisi

```json
// 1. Checkout başlatıldı
{
  "level": "info",
  "event": "checkout_initiated",
  "user_id": "clxyz123",
  "user_email": "kullanici@email.com",
  "plan": "PRO",
  "billing": "monthly",
  "amount_expected": "99.00",
  "currency": "TRY",
  "ip": "88.233.12.45",
  "request_id": "req_20240115_abc123",
  "timestamp": "2024-01-15T10:30:00.123Z"
}

// 2. iyzico'ya istek gönderildi
{
  "level": "info",
  "event": "iyzico_checkout_requested",
  "user_id": "clxyz123",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "request_id": "req_20240115_abc123",
  "timestamp": "2024-01-15T10:30:00.456Z"
}

// 3. iyzico yanıt verdi
{
  "level": "info",
  "event": "iyzico_checkout_response",
  "status": "success",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "iyzico_token": "TOKEN_REDACTED_IN_PROD",  // Prod'da loglama!
  "request_id": "req_20240115_abc123",
  "duration_ms": 234,
  "timestamp": "2024-01-15T10:30:00.690Z"
}

// 4. Callback alındı
{
  "level": "info",
  "event": "callback_received",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "payload_size_bytes": 512,
  "timestamp": "2024-01-15T10:31:15.000Z"
}

// 5. İmza doğrulandı
{
  "level": "info",
  "event": "callback_signature_verified",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "timestamp": "2024-01-15T10:31:15.023Z"
}

// 6. iyzico retrieve başarılı
{
  "level": "info",
  "event": "iyzico_retrieve_success",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "iyzico_payment_id": "pay_iyzico_987654321",
  "payment_status": "SUCCESS",
  "paid_price": "99.00",
  "timestamp": "2024-01-15T10:31:15.456Z"
}

// 7. Fiyat eşleşmesi onaylandı
{
  "level": "info",
  "event": "price_verification_passed",
  "amount_expected": "99.00",
  "amount_paid": "99.00",
  "timestamp": "2024-01-15T10:31:15.460Z"
}

// 8. Abonelik aktive edildi
{
  "level": "info",
  "event": "subscription_activated",
  "user_id": "clxyz123",
  "plan": "PRO",
  "iyzico_payment_id": "pay_iyzico_987654321",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "expires_at": "2024-02-15T10:31:15.000Z",
  "timestamp": "2024-01-15T10:31:15.678Z"
}
```

### Başarısız Callback — Log Örneği

```json
{
  "level": "warn",
  "event": "callback_signature_invalid",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "remote_ip": "1.2.3.4",
  "reason": "HMAC signature mismatch",
  "timestamp": "2024-01-15T10:31:15.000Z"
}
```

### Duplicate Callback — Log Örneği

```json
{
  "level": "warn",
  "event": "duplicate_callback_detected",
  "conversation_id": "conv_20240115_clxyz123_x7k9",
  "iyzico_payment_id": "pay_iyzico_987654321",
  "already_processed_at": "2024-01-15T10:31:15.678Z",
  "current_attempt_at": "2024-01-15T10:36:20.000Z",
  "action": "ignored",
  "timestamp": "2024-01-15T10:36:20.005Z"
}
```

---

## 🔑 Correlation ID Sistemi

**Correlation ID (İstek Kimliği):** Bir kullanıcı eyleminden kaynaklanan tüm log kayıtlarını birbirine bağlayan benzersiz numara.

```typescript
// middleware/correlation.ts
export function correlationMiddleware(req, res, next) {
  // Frontend'den geliyorsa kullan, yoksa yeni üret
  const correlationId = req.headers['x-request-id'] || 
                        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.correlationId = correlationId;
  res.setHeader('x-request-id', correlationId); // Response'a da ekle
  
  next();
}

// Kullanım:
logger.info({
  event: 'payment_started',
  request_id: req.correlationId,  // ← Her log'a ekle
  user_id: req.user.id,
  ...
});
```

**Neden önemli:**
```
Kullanıcı şikayet ediyor: "Saat 13:30'da ödeme yaptım"
Sen: "request_id nedir?" veya konuşma ID'si ne?

Logda arama:
grep "conv_20240115_clxyz123" api.log
→ O ödemeye ait TÜM loglar kronolojik sırada gelir
→ Tam olarak ne olduğunu görürsün
```

---

## 🔒 Immutable (Değiştirilemez) Audit Log İlkesi

**Neden değiştirilemez olmalı:**
```
Senaryo: Kullanıcı şikayet ediyor, sen logları "düzeltiyorsun"
→ Mahkemede geçersiz kanıt
→ KVKK ihlali
→ Güvensiz sistem işareti

Kural: Audit log'lara UPDATE veya DELETE yapma.
Yanlış kayıt varsa: Yeni kayıt ekle ("correction" event'i ile)
```

```typescript
// ❌ YANLIŞ:
await db.paymentEvent.update({
  where: { id: eventId },
  data: { eventType: 'corrected_event' }
});

// ✅ DOĞRU:
await db.paymentEvent.create({
  data: {
    eventType: 'manual_correction',
    eventData: {
      originalEventId: eventId,
      correctionReason: 'Yanlış plan kodu yazılmıştı',
      correctedBy: 'admin@email.com'
    }
  }
});
```

---

## 📊 Ödeme Yaşam Döngüsü — Durum Geçişleri

```
payment_checkouts.status:

PENDING
  ↓ (iyzico callback alındı)
CALLBACK_RECEIVED
  ↓ (imza doğrulandı, retrieve başarılı, DB güncellendi)
COMPLETED
  ← Veya →
FAILED
  (imza hatalı, retrieve başarısız, DB hatası)

COMPLETED
  ↓ (iade talebi kabul edildi)
REFUNDED

COMPLETED
  ↓ (kullanıcı bankasına gitti, chargeback açtı)
CHARGEBACK_DISPUTED
```

---

## 🛠️ Log Sorgulama — Pratik Komutlar

```bash
# Bir kullanıcının tüm ödemelerini bul:
grep "usr_abc123" /var/log/nb-pdf-platform/api.log | grep "payment\|checkout\|subscription"

# Belirli bir conversation ID'yi takip et:
grep "conv_20240115_clxyz123_x7k9" /var/log/nb-pdf-platform/api.log | jq .

# Başarısız callback'leri bul (bugün):
grep "$(date +%Y-%m-%d)" /var/log/nb-pdf-platform/api.log | \
  jq 'select(.event == "callback_signature_invalid" or .event == "retrieve_failed")'

# Abonelik aktivasyonlarını say (bu ay):
grep "subscription_activated" /var/log/nb-pdf-platform/api.log | \
  grep "$(date +%Y-%m)" | wc -l

# Tamamlanmış ama plan güncellenmeyen ödemeleri bul (DB sorgusu):
psql -U postgres nb_pdf_platform -c "
SELECT pc.id, pc.user_id, pc.plan, pc.status, pc.completed_at, u.plan as user_current_plan
FROM payment_checkouts pc
JOIN users u ON u.id = pc.user_id
WHERE pc.status = 'COMPLETED'
  AND u.plan = 'FREE'
  AND pc.completed_at > NOW() - INTERVAL '7 days';"
```
