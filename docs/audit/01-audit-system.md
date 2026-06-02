# Audit Trail (Denetim İzi) Sistemi

> **Audit trail nedir:** Sistemde olan her önemli olayın kronolojik, değiştirilemez kaydı. Muhasebe defteri gibi düşün — her işlem kayıt altında, kim ne zaman ne yaptı belli.

---

## 🧠 Neden Bu Kadar Önemli?

### Yasal Açıdan
```
Türkiye'de tüketici hakları güçlü.
KVKK veri işleme faaliyetlerini kayıt altına almayı zorunlu kılar.
"Ödeme aldık mı almadık mı?" sorusu yasal süreçte gündeme gelirse:
→ Audit trail = senin avukatın
→ Yokluğu = senin aleyhine kanıt
```

### Operasyonel Açıdan
```
Destek sorusu: "3 Ocak'ta ödeme yaptım"
Audit trail olmadan: "Bakalım... sanırım..."
Audit trail ile: "3 Ocak 13:42:15 UTC, işlem: PRO plan, tutar: 99₺, sonuç: BAŞARILI"
```

### Güvenlik Açısından
```
Birisi sisteme yetkisiz erişim sağladı mı?
Admin yetkilerini kötüye kullandı mı?
Audit trail olmadan: Bilinmez
Audit trail ile: "Kim, ne zaman, ne yaptı" — dakikalar içinde tespit
```

---

## 🏗️ Audit Trail Katmanları

```
Katman 1: Sistem Log'ları
  → api.log — Her API isteği
  → nginx access log — Her HTTP isteği
  → systemd journal — Servis başlatma/durdurmalar

Katman 2: Uygulama Olayları (PaymentEvents tablosu)
  → Her ödeme adımı
  → Her önemli sistem olayı
  → Her kullanıcı eylemi (giriş, kayıt, plan değişimi)

Katman 3: Admin Eylemleri (AdminAuditLogs tablosu)
  → Her admin müdahalesi
  → Her manuel değişiklik
  → Her destek işlemi

Katman 4: İş Verileri (PaymentCheckouts, SubscriptionStatus)
  → Anlık durum
  → Geçmiş kayıtlar
```

---

## 🗄️ Admin Audit Log Şeması (Tam)

```sql
-- Mevcut AdminAuditLog modeline ek önerilen alanlar:
model AdminAuditLog {
  id              String   @id @default(cuid())
  
  -- Kim yaptı?
  adminEmail      String
  adminIp         String?
  adminUserAgent  String?
  adminSessionId  String?   -- Hangi giriş oturumunda yapıldı
  
  -- Ne yaptı?
  action          String    -- Enum benzeri değerler (aşağıda listesi)
  actionCategory  String    -- "payment", "user", "subscription", "security"
  
  -- Neye yaptı?
  targetUserId    String?
  targetUserEmail String?   -- Snapshot (user email sonradan değişebilir)
  targetKey       String?   -- conversation_id, payment_id, vs.
  targetTable     String?   -- "users", "payment_checkouts", vs.
  targetRecordId  String?   -- Etkilenen kayıt ID'si
  
  -- Ne değişti?
  previousState   Json?     -- Değişiklikten önce
  newState        Json?     -- Değişiklikten sonra
  
  -- Neden yapıldı?
  reason          String?   -- Destek ticket numarası veya açıklama
  summary         String    -- İnsan tarafından okunabilir özet
  supportTicketId String?   -- Varsa destek talep ID'si
  
  -- Sonuç
  outcome         String    -- "success", "failed", "partial"
  errorMessage    String?   -- Hata olduysa
  
  -- İzlenebilirlik
  requestId       String?   -- Correlation ID
  
  -- Zaman (UTC)
  createdAt       DateTime  @default(now())
  
  @@index([adminEmail])
  @@index([targetUserId])
  @@index([action])
  @@index([actionCategory])
  @@index([createdAt])
}

-- Action değerleri:
-- PAYMENT:
--   payment_manual_complete, payment_manual_refund, payment_manual_cancel
--   duplicate_payment_resolved, chargeback_received, chargeback_won, chargeback_lost
-- USER:
--   user_plan_manual_upgrade, user_plan_manual_downgrade
--   user_account_suspended, user_account_restored
--   user_email_verified_manually, user_credits_adjusted
-- SUBSCRIPTION:
--   subscription_extended, subscription_cancelled, subscription_paused
-- SECURITY:
--   suspicious_activity_flagged, ip_blocked, account_locked
-- SUPPORT:
--   support_investigation_started, support_investigation_resolved
```

---

## 📝 Admin Eylem Log Örnekleri (JSON)

### Manuel Plan Güncellemesi
```json
{
  "id": "log_abc123",
  "adminEmail": "nbglobalstudio@gmail.com",
  "adminIp": "192.168.1.1",
  "action": "user_plan_manual_upgrade",
  "actionCategory": "payment",
  "targetUserEmail": "kullanici@email.com",
  "targetKey": "conv_20240115_xxx_yyy",
  "previousState": {
    "user_plan": "FREE",
    "payment_status": "PENDING"
  },
  "newState": {
    "user_plan": "PRO",
    "payment_status": "COMPLETED",
    "plan_expires_at": "2024-02-15T10:30:00.000Z"
  },
  "reason": "Callback kayıp - iyzico'da ödeme SUCCESS doğrulandı",
  "summary": "Kullanıcı destek bildirimi sonrası manuel PRO aktivasyonu",
  "outcome": "success",
  "createdAt": "2024-01-15T11:45:22.123Z"
}
```

### İade İşlemi
```json
{
  "id": "log_def456",
  "adminEmail": "nbglobalstudio@gmail.com",
  "action": "payment_manual_refund",
  "actionCategory": "payment",
  "targetUserEmail": "baskakisi@email.com",
  "targetKey": "pay_iyzico_987654321",
  "previousState": {
    "payment_status": "COMPLETED",
    "user_plan": "PRO"
  },
  "newState": {
    "payment_status": "REFUNDED",
    "user_plan": "FREE",
    "refunded_at": "2024-01-20T09:15:00.000Z"
  },
  "reason": "Kullanıcı talebi: Satın aldıktan 1 gün sonra hiç kullanmadı",
  "summary": "İade işlemi - iyzico panelden yapıldı, DB güncellendi",
  "outcome": "success",
  "createdAt": "2024-01-20T09:15:33.456Z"
}
```

---

## 🔍 Audit Log Sorgulama — Pratik Örnekler

```sql
-- Bir kullanıcının tüm admin eylem geçmişi:
SELECT action, summary, admin_email, created_at
FROM admin_audit_logs
WHERE target_user_email = 'kullanici@email.com'
ORDER BY created_at DESC;

-- Son 24 saat admin eylemleri:
SELECT admin_email, action, target_user_email, summary, created_at
FROM admin_audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- İade eylemleri bu ay:
SELECT COUNT(*) as refund_count, SUM((new_state->>'amount')::numeric) as total_refunded
FROM admin_audit_logs
WHERE action = 'payment_manual_refund'
  AND created_at > DATE_TRUNC('month', NOW());

-- Belirli bir ödeme etrafındaki tüm olaylar:
SELECT 'payment_event' as source, event_type as action, event_data, occurred_at as ts
FROM payment_events
WHERE target_key LIKE '%CONV_ID%'
UNION ALL
SELECT 'admin_log', action, summary::json, created_at
FROM admin_audit_logs
WHERE target_key LIKE '%CONV_ID%'
ORDER BY ts;
```

---

## 📋 Günlük Audit Kontrol Listesi

```bash
#!/bin/bash
# Her sabah 5 dakika ayır:

echo "=== GÜNLÜK AUDIT KONTROLÜ ==="

# 1. Dünkü başarılı ödemeler:
psql -U postgres nb_pdf_platform -c "
SELECT COUNT(*) as completed_payments, SUM(amount_paid) as total_revenue
FROM payment_checkouts
WHERE status = 'COMPLETED' AND DATE(completed_at) = CURRENT_DATE - 1;"

# 2. Dünkü başarısız ödemeler:
psql -U postgres nb_pdf_platform -c "
SELECT COUNT(*) as failed_payments
FROM payment_checkouts
WHERE status = 'FAILED' AND DATE(failed_at) = CURRENT_DATE - 1;"

# 3. Hâlâ PENDING olanlar (2+ saatlik):
psql -U postgres nb_pdf_platform -c "
SELECT COUNT(*) as stuck_pending
FROM payment_checkouts
WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '2 hours';"

# 4. Dünkü admin eylemleri:
psql -U postgres nb_pdf_platform -c "
SELECT action, COUNT(*) FROM admin_audit_logs
WHERE DATE(created_at) = CURRENT_DATE - 1
GROUP BY action;"

# 5. Yeni kullanıcılar:
psql -U postgres nb_pdf_platform -c "
SELECT COUNT(*) as new_users FROM users
WHERE DATE(created_at) = CURRENT_DATE - 1;"
```

---

## ⚖️ Yasal Saklama Süreleri

```
Ödeme kayıtları:     Minimum 5 yıl (Vergi hukuku)
Kullanıcı verileri:  KVKK gereği: Hizmet sona erince + makul süre
Audit log'ları:      Minimum 5 yıl (Hukuki delil için)
Email iletişimleri:  Minimum 3 yıl
Şikayet kayıtları:   Minimum 2 yıl

Pratik öneri: Her şeyi 5 yıl tut.
```

```bash
# Log rotation'da 5 yıl saklama:
# /etc/logrotate.d/nb-pdf-platform
rotate 1825  # 365 × 5 = 1825 gün
```
