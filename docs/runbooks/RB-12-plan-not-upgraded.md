# RB-12: "Ödeme Yaptım Ama Planım Hâlâ FREE"

> **Bu en sık karşılaşacağın destek sorunudur.** Hem kullanıcı için sinir bozucudur hem de hızlı çözülmezse chargeback riski taşır. Bu runbook seni adım adım götürür.

**Etki:** Ödeme yapan kullanıcı ücretli özelliklere erişemiyor.
**Süre hedefi:** 15 dakika içinde araştır, 30 dakika içinde çöz.

---

## 🚦 Hızlı Karar Ağacı

```
Kullanıcı "ödeme yaptım, plan değişmedi" diyor
│
├── Adım 1: iyzico'da ödeme var mı?
│   ├── HAYIR → Ödeme gerçekleşmemiş → Kullanıcıyı bilgilendir
│   └── EVET  → Devam et
│
├── Adım 2: Bizim DB'de payment_checkouts kaydı var mı?
│   ├── HAYIR → Checkout oluşturulmamış → Adım A'ya git
│   └── EVET  → Devam et
│
├── Adım 3: Kayıt durumu ne?
│   ├── PENDING   → Callback alınmamış → Adım B'ye git
│   ├── FAILED    → Callback alındı ama hata var → Adım C'ye git
│   └── COMPLETED → Callback başarılı ama plan güncellenmemiş → Adım D'ye git
│
└── Adım 4: User.plan güncel mi?
    ├── EVET → Kullanıcı önbelleği temizlemeli (Adım E)
    └── HAYIR → Manuel güncelleme gerekiyor (Adım F)
```

---

## 📋 Araştırma Kontrol Listesi

**Kullanıcıdan al:**
```
□ Email adresi
□ Ödeme tarihi ve saati (yaklaşık)
□ Kullandığı plan (PRO mu, BUSINESS mı?)
□ iyzico ödeme onay SMS'i veya emaili var mı?
□ Hangi kart ile ödedi? (sadece son 4 hane)
```

---

## 🔍 ADIM 1: iyzico'da Ödeme Kaydı Kontrol Et

**iyzico Merchant Panel:**
```
1. https://merchant.iyzico.com → Giriş yap
2. Raporlar → İşlem Listesi
3. Kullanıcının email'i veya tarihi ile filtrele
4. Ödeme durumunu kontrol et

Durumlar:
- SUCCESS → Ödeme gerçekleşti, bizim sistemde sorun var
- FAILURE → Ödeme başarısız (kartı reddedildi, limit yok, vs.)
- PENDING → Ödeme beklemede (nadir, banka onayı bekleniyor)
```

---

## 🔍 ADIM 2: Veritabanında Ödeme Kaydını Bul

```sql
-- Kullanıcının email'i ile ara:
SELECT 
  pc.id,
  pc.conversation_id,
  pc.iyzico_payment_id,
  pc.plan,
  pc.billing,
  pc.amount_expected,
  pc.amount_paid,
  pc.status,
  pc.created_at,
  pc.completed_at,
  pc.callback_received_at,
  pc.callback_signature_valid,
  pc.retrieve_status,
  pc.error_message,
  u.plan as user_current_plan
FROM payment_checkouts pc
JOIN users u ON u.id = pc.user_id
WHERE u.email = 'kullanici@email.com'
ORDER BY pc.created_at DESC
LIMIT 10;
```

**Sonuçları yorumla:**

| status | callback_received_at | Anlam | Aksiyon |
|--------|---------------------|-------|---------|
| PENDING | NULL | Callback hiç gelmedi | Adım B |
| PENDING | Dolu | Callback geldi ama işlenmedi | Adım C |
| FAILED | Dolu | İşleme hatası | Adım C |
| COMPLETED | Dolu | Her şey OK ama plan değişmedi | Adım D |
| Kayıt yok | - | Checkout başlatılmadı | Adım A |

---

## 🔍 ADIM 3: Log'larda Takip Et

```bash
# Kullanıcının conversation ID'sini bul (DB'den aldıktan sonra):
CONV_ID="conv_20240115_xxx_yyy"

# O conversation ID ile ilgili tüm log kayıtları:
grep "$CONV_ID" /var/log/nb-pdf-platform/api.log | jq .

# Callback alındı mı?
grep "$CONV_ID" /var/log/nb-pdf-platform/api.log | jq 'select(.event == "callback_received")'

# İmza doğrulandı mı?
grep "$CONV_ID" /var/log/nb-pdf-platform/api.log | jq 'select(.event | contains("signature"))'

# Abonelik aktive edildi mi?
grep "$CONV_ID" /var/log/nb-pdf-platform/api.log | jq 'select(.event == "subscription_activated")'
```

---

## 🛠️ SENARYO A: Checkout Kaydı Hiç Yok

```
Anlam: Kullanıcı ödeme sayfasına geçemeden hata aldı.
       iyzico'ya hiç ulaşılmadı.

Kontrol:
□ O saat diliminde sunucu çalışıyor muydu?
  grep "server_started\|server_stopped" /var/log/nb-pdf-platform/api.log

□ iyzico API'ye bağlantı hatası var mıydı?
  grep "iyzico_request_failed\|iyzico_timeout" /var/log/nb-pdf-platform/api.log

□ Kullanıcının hesabında sorun var mıydı?
  SELECT * FROM users WHERE email = 'kullanici@email.com';

Aksiyon:
- iyzico'da ödeme SUCCESS ise → Manuel plan güncellemesi (Adım F)
- iyzico'da ödeme SUCCESS değilse → Ödeme alınmadı, kullanıcıyı bilgilendir
```

---

## 🛠️ SENARYO B: Callback Hiç Alınmadı (PENDING Durumda)

```
Anlam: iyzico callback gönderdi ama bize ulaşmadı.
       Muhtemel nedenler:
       - O an sunucu kapalıydı
       - Callback URL yanlış
       - Firewall engeli
       - Network hatası

Kontrol:
□ Callback URL iyzico panelinde doğru mu?
  iyzico merchant panel → Entegrasyon → Callback URL
  Değer: https://siteadin.com/api/payment/callback

□ O saatte nginx log'ları ne diyor?
  grep "POST /api/payment/callback" /var/log/nginx/access.log | \
    grep "2024-01-15" | tail -20
  → 200 görüyorsan callback ulaştı, bizde işlenmedi
  → Hiçbir şey görmüyorsan callback gelmedi

□ iyzico retry yaptı mı? (30 dakika, 1 saat, 2 saat sonra dener)
  Callback URL'i erişilebilir mi şu an?
  curl -X POST https://siteadin.com/api/payment/callback

Aksiyon:
iyzico'da ödeme SUCCESS ise → Manuel plan güncellemesi gerekiyor (Adım F)
```

---

## 🛠️ SENARYO C: Callback Alındı Ama İşlenmedi

```
Anlam: Callback geldi, ama işleme sırasında hata oluştu.

Kontrol:
□ İmza hatası mı?
  SELECT callback_signature_valid FROM payment_checkouts
  WHERE conversation_id = 'CONV_ID';
  → false ise: IYZICO_SECRET_KEY yanlış olabilir

□ Retrieve hatası mı?
  SELECT retrieve_status, error_message FROM payment_checkouts
  WHERE conversation_id = 'CONV_ID';

□ DB transaction hatası mı?
  grep "CONV_ID" /var/log/nb-pdf-platform/api.log | \
    jq 'select(.event | contains("error") or contains("failed"))'

Aksiyon:
- İmza hatası → IYZICO_SECRET_KEY'i kontrol et, düzelt, servisi yeniden başlat
- Retrieve hatası → iyzico API'de sorun olabilir, tekrar dene
- DB hatası → Manuel güncelleme (Adım F)
```

---

## 🛠️ SENARYO D: Callback Başarılı Ama Plan Değişmedi

```
Anlam: payment_checkouts.status = COMPLETED ama users.plan = FREE.
Bu kısmi güncelleme — transaction hatası olabilir.

Kontrol:
SELECT pc.status, u.plan, pc.completed_at
FROM payment_checkouts pc
JOIN users u ON u.id = pc.user_id
WHERE pc.conversation_id = 'CONV_ID';

□ subscription_status tablosunda kayıt var mı?
SELECT * FROM subscription_status WHERE user_id = 'USER_ID' ORDER BY created_at DESC;

Aksiyon: Manuel güncelleme (Adım F)
```

---

## 🛠️ SENARYO E: Sistem Doğru Ama Kullanıcı Görmüyor

```
Anlam: users.plan = PRO ama kullanıcı hâlâ FREE görüyor.
Muhtemel neden: Tarayıcı önbelleği, JWT token yenilenmesi.

Kullanıcıya söyle:
1. Çıkış yap (Logout)
2. Tarayıcı önbelleğini temizle (Ctrl+Shift+Delete)
3. Tekrar giriş yap
4. Yenile

Eğer hâlâ olmuyorsa:
- JWT'de plan bilgisi var mı? (Token içindeki claim)
- /api/auth/me endpoint'i doğru plan dönüyor mu?

Test:
curl -H "Authorization: Bearer TOKEN" https://siteadin.com/api/auth/me | jq .plan
```

---

## ⚙️ ADIM F: Güvenli Manuel Plan Güncellemesi

**Bunu sadece iyzico'da ödeme SUCCESS olduğunu doğruladıktan sonra yap.**

```sql
BEGIN;

-- 1. Kullanıcı bilgilerini kontrol et
SELECT id, email, plan FROM users WHERE email = 'kullanici@email.com';

-- 2. Ödeme kaydını kontrol et
SELECT id, conversation_id, plan, status FROM payment_checkouts
WHERE user_id = (SELECT id FROM users WHERE email = 'kullanici@email.com')
ORDER BY created_at DESC LIMIT 3;

-- 3. Planı güncelle
UPDATE users
SET plan = 'PRO',  -- veya ödenen plan
    plan_expires_at = NOW() + INTERVAL '30 days'
WHERE email = 'kullanici@email.com';

-- 4. Abonelik kaydı oluştur
INSERT INTO subscription_status (user_id, plan, started_at, expires_at, payment_conversation_id, notes)
SELECT id, 'PRO', NOW(), NOW() + INTERVAL '30 days', 'CONV_ID_BURAYA', 'Manuel güncelleme - RB-12'
FROM users WHERE email = 'kullanici@email.com'
ON CONFLICT (user_id) DO UPDATE SET
  plan = 'PRO',
  started_at = NOW(),
  expires_at = NOW() + INTERVAL '30 days';

-- 5. Ödeme kaydını güncelle (eğer PENDING ise)
UPDATE payment_checkouts
SET status = 'COMPLETED',
    completed_at = NOW(),
    notes = 'Manuel tamamlama - Callback kayıp - RB-12'
WHERE conversation_id = 'CONV_ID_BURAYA'
  AND status != 'COMPLETED';

-- 6. Audit log yaz
INSERT INTO admin_audit_logs (admin_email, action, target_user_email, target_key, summary, reason)
VALUES (
  'nbglobalstudio@gmail.com',
  'manual_plan_upgrade',
  'kullanici@email.com',
  'CONV_ID_BURAYA',
  'Manuel PRO aktivasyon - Callback kayıp nedeniyle. iyzico''da ödeme doğrulandı.',
  'Kullanıcı destek bildirimi: Ödeme yaptı ama plan değişmedi.'
);

COMMIT;
```

**Güncellemeyi doğrula:**
```sql
SELECT email, plan, plan_expires_at FROM users WHERE email = 'kullanici@email.com';
```

---

## 📧 Kullanıcıya Gönderilecek E-posta Şablonu

```
Konu: Hesabınız Güncellendi — PRO Plan Aktif

Merhaba [AD],

Bildirdiğiniz sorun için özür dileriz. Teknik bir aksaklık nedeniyle 
ödemeniz sistemimize gecikmeli yansıdı.

Hesabınız şu anda kontrol ettiğimde:
- Plan: PRO ✓
- Geçerli: [TARİH]'e kadar

Lütfen çıkış yapıp tekrar giriş yapın. Sorun devam ederse 
lütfen bize tekrar yazın.

Anlayışınız için teşekkürler.
```

---

## 📊 Postmortem — Bu Neden Oldu?

```
Her RB-12 vakasından sonra şunu kaydet:
□ Kullanıcı: [email]
□ Conversation ID: [id]
□ Ödeme tarihi: [tarih]
□ Tespit tarihi: [tarih]
□ Çözüm tarihi: [tarih]
□ Kök neden: [Callback kayıp / İmza hatası / DB hatası / Önbellek]
□ Tekrar olmaması için: [Yapılan değişiklik]
```
