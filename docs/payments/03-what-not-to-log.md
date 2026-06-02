# Ne Loglanmaz? — PCI ve Güvenli Loglama

> **Bu belge neden kritik:** Yanlış bir log satırı → Kart numarası log dosyasında → Sunucu ele geçirildi → Binlerce kullanıcının kartı çalındı → Hem hapis cezası hem iflas. Bu abartı değil. PCI ihlalleri için gerçek sonuçlar bunlar.

---

## 🚫 ASLA Loglanmaması Gerekenler

### Kategori 1: Kart Verisi (PCI DSS — Mutlak Yasak)

```
❌ Kart numarası (PAN - Primary Account Number)
   4532 1234 5678 9010  → YASAK

❌ CVV/CVC kodu
   123  → YASAK

❌ Kart son kullanma tarihi + kart sahibi birlikte
   12/26 + John Doe  → YASAK

❌ Kart sahibinin tam adı + kart numarası birlikte
```

**Neden:** Sen zaten bu veriyi ALMIYOR olmalısın. iyzico'nun formu bu veriyi doğrudan iyzico'ya gönderir. Eğer kart numarası senin loglarında görünüyorsa → Sistem yanlış kurulmuş.

```typescript
// ❌ YANLIŞ (bunu asla yapma):
logger.info('Ödeme isteği', {
  cardNumber: req.body.cardNumber,  // YASAK!
  cvv: req.body.cvv,               // YASAK!
  expiry: req.body.expiry          // YASAK!
});

// ✅ DOĞRU:
// Kart verisi sana gelmez. Geliyorsa → mimari yanlış.
logger.info('Ödeme isteği', {
  user_id: req.user.id,
  plan: req.body.plan,
  conversation_id: generatedId
});
```

---

### Kategori 2: Kimlik Doğrulama Sırları

```
❌ JWT token'ları (access token, refresh token)
❌ Şifreler (plaintext veya hash)
❌ API anahtarları (IYZICO_API_KEY, IYZICO_SECRET_KEY)
❌ JWT secret'lar
❌ OAuth access token'ları
❌ Session ID'leri
❌ Email doğrulama token'ları
❌ Şifre sıfırlama token'ları
```

**Tipik hata senaryosu:**
```typescript
// ❌ YANLIŞ — Bu sık yapılan hata:
logger.debug('Kullanıcı girişi', {
  email: req.body.email,
  password: req.body.password  // YASAK! Hash bile olsa loglama!
});

// ❌ YANLIŞ — Authorization header'ı loglama:
logger.info('İstek', {
  headers: req.headers  // Bearer TOKEN_BURAYA → Log'da JWT!
});

// ✅ DOĞRU:
logger.info('Kullanıcı girişi', {
  email: req.body.email,
  ip: req.ip,
  user_agent: req.headers['user-agent']
  // Şifre HİÇ loglama
});
```

---

### Kategori 3: iyzico Webhook Secret ve Token'lar

```
❌ IYZICO_SECRET_KEY (webhook imza doğrulama anahtarı)
❌ Ham iyzico checkout form token'ı (production'da)
❌ iyzico'nun tam response body'si (içinde hassas veri olabilir)
```

**Neden:**
```
iyzico callback imza doğrulaması için IYZICO_SECRET_KEY kullanılır.
Bu key logta görünürse → Sahte callback oluşturulabilir.
→ Sahte "başarılı ödeme" callback'i gönderilerek ücretsiz abonelik alınabilir.
```

```typescript
// ❌ YANLIŞ:
logger.info('iyzico callback', {
  body: req.body,  // İçinde iyzico imza parametreleri var
  secret: process.env.IYZICO_SECRET_KEY  // ASLA!
});

// ✅ DOĞRU:
logger.info('iyzico callback alındı', {
  conversation_id: req.body.conversationId,
  payment_id: req.body.paymentId,
  // body içindeki imza parametrelerini LOGLAMA
  // secret'ı ASLA loglama
});
```

---

### Kategori 4: Kişisel Veri (KVKK/GDPR)

```
Dikkatli logla (gerekmedikçe loglama):
⚠️ TC Kimlik numarası
⚠️ Telefon numarası
⚠️ Tam adres bilgisi
⚠️ Doğum tarihi

Log'da olabilir (tanımlayıcı amaçlı):
✅ Kullanıcı ID (anonim)
✅ Email (destek için gerekli)
✅ IP adresi (güvenlik için gerekli, ama gizlilik politikasında belirtilmeli)
```

---

## ✅ Güvenli Loglama Örnekleri

### Doğru: iyzico Request/Response Loglamak

```typescript
// ❌ YANLIŞ — Tüm response'u loglama:
const response = await iyzico.retrieve(request);
logger.info('iyzico response', { response });  // İçinde hassas bilgiler olabilir!

// ✅ DOĞRU — Sadece gerekli alanları logla:
const response = await iyzico.retrieve(request);
logger.info('iyzico retrieve completed', {
  event: 'iyzico_retrieve_success',
  conversation_id: response.conversationId,
  payment_id: response.paymentId,
  payment_status: response.paymentStatus,  // "SUCCESS" veya "FAILURE"
  paid_price: response.paidPrice,
  // ↓ BUNLARI LOGLAMA:
  // response.authCode        → Hassas
  // response.hostReference   → Gereksiz
  // response.binNumber       → Kart BIN numarası, loglanmamalı
  // response.cardAssociation → Gereksiz
  // response.signature       → Webhook imzası
});
```

### Doğru: Callback Loglamak

```typescript
app.post('/api/payment/callback', async (req, res) => {
  // ✅ DOĞRU: Sadece tanımlayıcıları logla
  logger.info({
    event: 'callback_received',
    conversation_id: req.body.conversationId,
    payment_id: req.body.paymentId,
    // status: req.body.status  → OK, başarı/başarısız
    timestamp: new Date().toISOString()
  });
  
  // ❌ YANLIŞ: Ham body'yi loglama
  // logger.info({ body: req.body });  // İmza parametreleri dahil!
});
```

### Doğru: Hata Loglamak

```typescript
// ✅ DOĞRU:
try {
  await processPayment(params);
} catch (error) {
  logger.error({
    event: 'payment_processing_failed',
    error_message: error.message,
    error_code: error.code,
    conversation_id: params.conversationId,
    user_id: params.userId,
    // ↓ BUNLARI EKLEME:
    // params  → İçinde kart bilgisi olabilir
    // error.stack → Hassas path bilgileri olabilir (production'da)
  });
}
```

---

## 🛡️ Log Dosyaları Güvenliği

### Dosya İzinleri

```bash
# Log dosyaları sadece uygulama kullanıcısı okuyabilmeli:
ls -la /var/log/nb-pdf-platform/
# -rw-r----- 1 nb-api nb-api api.log  ← Doğru
# -rw-rw-rw- 1 nb-api nb-api api.log  ← YANLIŞ (herkes okuyabilir)

# Düzelt:
chmod 640 /var/log/nb-pdf-platform/*.log
chown nb-api:nb-api /var/log/nb-pdf-platform/*.log
```

### Log Rotasyonu

```
Log dosyaları büyüdükçe risk artar:
- Disk dolabilir → Sistem durur
- Büyük dosyalar → Yetkisiz erişimde daha fazla veri açığa çıkar

Çözüm: logrotate ile günlük rotasyon + sıkıştırma
```

```bash
# /etc/logrotate.d/nb-pdf-platform
/var/log/nb-pdf-platform/*.log {
    daily
    rotate 90          # 90 gün tut (yasal gereklilik için)
    compress           # gzip ile sıkıştır
    delaycompress      # Bir gün bekle sonra sıkıştır (aktif log)
    missingok          # Dosya yoksa hata verme
    notifempty         # Boşsa rotate etme
    sharedscripts
    postrotate
        systemctl reload nb-api > /dev/null 2>&1 || true
    endscript
}
```

---

## 🔍 Güvenli Destek/Debug Araştırması

**Sorun:** Kullanıcı şikayet ediyor, log'lara bakman gerekiyor. Ama log'da hassas veri var mı?

```bash
# ✅ Güvenli: Sadece belirli alanları filtrele
grep "user_id.*clxyz123" /var/log/nb-pdf-platform/api.log | \
  jq 'del(.headers, .body, .password, .token)'

# ✅ Güvenli: Sadece event ve timestamp'i gör
grep "clxyz123" /var/log/nb-pdf-platform/api.log | \
  jq '{event: .event, timestamp: .timestamp, status: .status}'

# ❌ Tehlikeli: Tüm log'u ham olarak oku
cat /var/log/nb-pdf-platform/api.log | grep "clxyz123"
# Bu komut log'da hassas veri varsa ekrana basar
```

---

## 📋 Log Güvenliği Kontrol Listesi

```
□ Kart numarası hiçbir log dosyasında yok
  Test: grep -i "cardnumber\|card_number\|pan" /var/log/nb-pdf-platform/*.log

□ Şifreler log'da yok
  Test: grep -i "password\|passwd" /var/log/nb-pdf-platform/*.log

□ JWT token'lar log'da yok
  Test: grep -E "eyJ[a-zA-Z0-9_-]+" /var/log/nb-pdf-platform/*.log

□ iyzico secret key log'da yok
  Test: grep "$IYZICO_SECRET_KEY" /var/log/nb-pdf-platform/*.log

□ Log dosyaları sadece yetkili kullanıcı okuyabiliyor
  Test: ls -la /var/log/nb-pdf-platform/

□ logrotate kuruldu ve çalışıyor
  Test: logrotate -d /etc/logrotate.d/nb-pdf-platform

□ Eski log'lar şifreli arşivde veya sıkıştırılmış
  Test: ls /var/log/nb-pdf-platform/*.gz
```
