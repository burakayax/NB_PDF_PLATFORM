# RB-13: İade ve Chargeback Operasyonları

> **Chargeback (ters ibraz) nedir:** Kullanıcı kart bankasına gidip "bu ödemeyi tanımıyorum, paramı iade edin" der. Banka parayı senden zorla alır. Aynı zamanda iyzico'da "chargeback ücreti" kesilir. Yeterince fazla chargeback olursa iyzico hesabın kapatılır. Bu en tehlikeli senaryo.

---

## 🧠 İade Türleri — Farkları Anla

| Tür | Kim İsteyor | Süreç | Risk |
|-----|-------------|-------|------|
| **Gönüllü İade (Refund)** | Sen veya kullanıcı | Sen onaylarsın, iyzico iade eder | Düşük |
| **Chargeback (Ters İbraz)** | Kullanıcının bankası | Banka zorla alır | Çok Yüksek |
| **Ödeme İptali** | Sen (ödeme tamamlanmadan) | iyzico işlemi iptal eder | Yok |
| **Kısmi İade** | Sen | Ödemenin bir kısmını iade | Orta |

---

## 💸 İade Politikası — Karar Ağacı

```
Kullanıcı iade istiyor
│
├── Ödeme üzerinden kaç gün geçti?
│   ├── 0-3 gün → Koşulsuz iade düşün
│   ├── 4-14 gün → Araştır, genellikle iade
│   └── 15+ gün → Sadece teknik sorun varsa iade
│
├── Teknik sorun mu yaşadı?
│   ├── EVET (PDF işlenmedi, plan çalışmıyordu) → İade et
│   └── HAYIR (Kullanmadım, beğenmedim) → Politikana bak
│
├── Önceden iade aldı mı?
│   ├── EVET (Bu ay içinde) → Reddet + İncele (fraud?)
│   └── HAYIR → Normal süreci izle
│
└── Chargeback tehdidi mi?
    ├── EVET → Önce iade et, sonra araştır
    └── HAYIR → Normal süreci izle
```

**Chargeback tehdidiyle karşılaştığında:**
```
Kullanıcı dedi: "Banka şikayeti açacağım / Tüketici mahkemesine gideceğim"

→ Panikle. Ama hızlı karar ver.
→ Eğer haklıysa: Hemen iade et. Chargeback sürecini önle.
→ Eğer haksızsa: Kanıtlarını hazırla. Chargeback gelirse itiraz et.
```

---

## 🔍 İade Araştırması — Adım Adım

### Adım 1: Ödemeyi Doğrula

```sql
-- Ödeme gerçekten yapıldı mı?
SELECT 
  pc.id,
  pc.conversation_id,
  pc.iyzico_payment_id,
  pc.plan,
  pc.amount_paid,
  pc.status,
  pc.created_at,
  pc.completed_at,
  u.email,
  u.plan as current_plan
FROM payment_checkouts pc
JOIN users u ON u.id = pc.user_id
WHERE u.email = 'kullanici@email.com'
  AND pc.status = 'COMPLETED'
ORDER BY pc.created_at DESC;
```

### Adım 2: Kullanım Kontrolü

```sql
-- Kullanıcı servisi kullandı mı?
SELECT 
  tool_name,
  COUNT(*) as usage_count,
  MIN(created_at) as first_use,
  MAX(created_at) as last_use
FROM daily_usage
WHERE user_id = (SELECT id FROM users WHERE email = 'kullanici@email.com')
  AND created_at > (SELECT created_at FROM payment_checkouts 
                    WHERE user_id = (SELECT id FROM users WHERE email = 'kullanici@email.com')
                    ORDER BY created_at DESC LIMIT 1)
GROUP BY tool_name;
```

**Yorum:**
- Yoğun kullanım varsa → İade tartışmalı
- Hiç kullanım yoksa → İade mantıklı

### Adım 3: İnsan Değerlendirmesi

```
□ Kullanıcı haklı mı görünüyor?
□ İlk kez mi sorun bildiriyor?
□ Daha önce iade aldı mı?
□ Teknik sorun gerçekten var mıydı?
□ İade sonrası hesabı kapatılacak mı, devam edecek mi?
```

---

## ⚙️ İade Nasıl Yapılır?

### iyzico Panel Üzerinden İade:

```
1. https://merchant.iyzico.com → Giriş yap
2. Raporlar → İşlem Listesi
3. İyzico Payment ID ile işlemi bul
4. "İade Et" butonuna tıkla
5. Tam veya kısmi iade seç
6. Onayla

İade süresi: 3-7 iş günü (bankaya göre değişir)
```

### İade Sonrası Sistem Güncellemesi:

```sql
BEGIN;

-- 1. Ödeme kaydını güncelle
UPDATE payment_checkouts
SET status = 'REFUNDED',
    refunded_at = NOW(),
    refund_reason = 'Kullanıcı talebi - Teknik sorun',
    refunded_by = 'nbglobalstudio@gmail.com'
WHERE conversation_id = 'CONV_ID'
  AND status = 'COMPLETED';

-- 2. Kullanıcı planını FREE'ye düşür
UPDATE users
SET plan = 'FREE',
    plan_expires_at = NULL
WHERE email = 'kullanici@email.com';

-- 3. Subscription kaydını kapat
UPDATE subscription_status
SET ended_at = NOW(),
    end_reason = 'REFUNDED'
WHERE user_id = (SELECT id FROM users WHERE email = 'kullanici@email.com')
  AND ended_at IS NULL;

-- 4. Audit log
INSERT INTO admin_audit_logs (
  admin_email, action, target_user_email, target_key, summary, reason
) VALUES (
  'nbglobalstudio@gmail.com',
  'refund_processed',
  'kullanici@email.com',
  'CONV_ID',
  'İade yapıldı. iyzico üzerinden tam iade. Plan FREE''ye düşürüldü.',
  'Kullanıcı talebi: [kullanıcının açıkladığı neden]'
);

COMMIT;
```

---

## ⚡ Chargeback Geldi — Acil Prosedür

**Chargeback bildirimi aldın. Genellikle iyzico email ile bildirir.**

```
Zaman kritik! Chargeback itirazı için genellikle 7-14 gün var.
```

### Delil Toplama (Hızlıca Yap):

```bash
# Chargeback gelen iyzico payment ID ile araştır:
PAYMENT_ID="pay_iyzico_987654321"

# 1. Ödeme kaydını al:
psql -U postgres nb_pdf_platform -c "
SELECT pc.*, u.email, u.created_at as user_created_at
FROM payment_checkouts pc
JOIN users u ON u.id = pc.user_id
WHERE pc.iyzico_payment_id = '$PAYMENT_ID';" > chargeback_evidence_payment.txt

# 2. Kullanım loglarını al:
psql -U postgres nb_pdf_platform -c "
SELECT * FROM daily_usage
WHERE user_id = (SELECT user_id FROM payment_checkouts WHERE iyzico_payment_id = '$PAYMENT_ID')
ORDER BY created_at;" > chargeback_evidence_usage.txt

# 3. Log kayıtlarını al:
grep "$PAYMENT_ID\|CONV_ID" /var/log/nb-pdf-platform/api.log > chargeback_evidence_logs.txt

# 4. Admin audit log:
psql -U postgres nb_pdf_platform -c "
SELECT * FROM admin_audit_logs
WHERE target_key LIKE '%PAYMENT_ID%' OR target_key LIKE '%CONV_ID%'
ORDER BY created_at;" > chargeback_evidence_admin.txt

echo "Kanıtlar toplandı. iyzico'ya itiraz et."
```

### Chargeback İtiraz Dilekçesi:

```
iyzico'ya gönderilecek kanıtlar:
□ Kullanıcının kayıt tarihi ve IP adresi
□ Ödeme tarihi, tutarı, planı
□ Callback log kayıtları (ödemenin başarılı işlendiğinin kanıtı)
□ Kullanıcının servisimizi kullandığının logları
□ Kullanıcıya gönderilen e-postalar (kayıt, abonelik onayı)
□ İade talebi yapılmadığının kaydı
```

**Chargeback'i KAZANMAK için gereken:**
```
1. Ödemenin gerçek olduğunun kanıtı (iyzico retrieve log)
2. Hizmetin verildiğinin kanıtı (kullanım logları)
3. Kullanıcının sisteme eriştiğinin kanıtı (login logları)
4. İade talebi olmadığının kanıtı
```

---

## 🔄 Çift Ödeme (Duplicate Charge) Araştırması

**Kullanıcı diyor: "İki kez para çektiniz"**

```sql
-- Aynı kullanıcıdan aynı dönemde iki COMPLETED kayıt var mı?
SELECT 
  pc.conversation_id,
  pc.iyzico_payment_id,
  pc.amount_paid,
  pc.created_at,
  pc.completed_at
FROM payment_checkouts pc
WHERE user_id = (SELECT id FROM users WHERE email = 'kullanici@email.com')
  AND status = 'COMPLETED'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at;
```

**Senaryo A: İki ayrı iyzico payment ID var**
```
→ Gerçekten iki kez ödeme alındı
→ Hangisi sonraki ise onu iade et
→ Kullanıcıya özür dile
```

**Senaryo B: Tek iyzico payment ID ama iki kayıt**
```
→ Duplicate callback işlendi (idempotency hatası)
→ Para iki kez çekilmedi, sadece kayıt iki kez oluştu
→ Kullanıcıya açıkla: "Tek ödeme alındı"
→ Fazlalık kaydı temizle
```

**Senaryo C: iyzico'da tek ödeme, kullanıcı iki gördüğünü söylüyor**
```
→ Kullanıcının bankası "pending" ve "settled" olarak iki kez göstermiş olabilir
→ Genellikle 1-3 gün içinde "pending" düşer
→ Kullanıcıyı bilgilendir, beklemesini söyle
```

---

## 📧 İletişim Şablonları

### İade Onayı:
```
Konu: İade İşleminiz Başlatıldı

Merhaba [AD],

İade talebiniz onaylanmıştır.

Detaylar:
- Tutar: [X] TL
- İade Tarihi: [BUGÜN]
- Banka Hesabına Yansıma: 3-7 iş günü (bankaya göre değişir)

Aboneliğiniz bugün itibarıyla sonlandırılmıştır.
Tekrar kullanmak isterseniz her zaman bekleriz.
```

### İade Reddi:
```
Konu: İade Talebi Hakkında

Merhaba [AD],

İade talebinizi değerlendirdik. Ne yazık ki [NEDEN] nedeniyle
bu talep için iade yapamıyoruz.

Ancak şunu yapabiliriz: [ALTERNATİF ÇÖZÜM]

Herhangi bir sorunuz varsa lütfen bize yazın.
```

### Chargeback İtirazı (Kullanıcıya):
```
Konu: Ödeme İtirazı Hakkında

Merhaba [AD],

Bankanız aracılığıyla bir ödeme itirazı açıldığını gördük.

Sistemimizde kayıtlarımıza göre:
- [TARİH] tarihinde [X] TL tutarında ödeme alındı
- Hesabınız [PLAN] planına yükseltildi
- [TARİH]-[TARİH] arası servisimizi [N] kez kullandınız

Herhangi bir sorun yaşadıysanız lütfen doğrudan bizimle iletişime geçin.
Sorununuzu birlikte çözebiliriz.

Bize ulaşın: nbglobalstudio@gmail.com
```
