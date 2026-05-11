# Ödeme Sistemi Olay Müdahalesi

> **Ödeme sistemi diğer sistemlerden farklı:** Hata = para kaybı, güven kaybı, potansiyel chargeback. Bu nedenle ödeme olaylarına özel acil prosedürler gerekiyor.

---

## 🚨 Ödeme Olayı Seviyeleri

| Seviye | Tanım | Örnek | Tepki Süresi |
|--------|-------|-------|--------------|
| **P0 — Kritik** | Tüm ödemeler durdu | iyzico endpoint erişilemiyor | Hemen |
| **P1 — Yüksek** | Bazı ödemeler başarısız | Callback URL erişilemiyor | 30 dk |
| **P2 — Orta** | Tek kullanıcı etkilendi | Bir kişinin planı güncellemedi | 2 saat |
| **P3 — Düşük** | Potansiyel sorun | Yavaş checkout response süresi | 24 saat |

---

## 🔴 P0: Tüm Ödemeler Durdu

### Belirti Tespiti

```bash
# Son 30 dakikada başarılı checkout var mı?
grep "checkout_initiated" /var/log/nb-pdf-platform/api.log | \
  awk -v cutoff="$(date -u -d '30 minutes ago' '+%Y-%m-%dT%H:%M')" \
  '$0 > cutoff' | wc -l

# Son 30 dakikada iyzico isteği var mı?
grep "iyzico_checkout_requested\|iyzico_request_failed" /var/log/nb-pdf-platform/api.log | \
  tail -10

# iyzico API yanıt veriyor mu?
curl -s -o /dev/null -w "%{http_code}" https://api.iyzipay.com
```

### İnvestigasyon Ağacı

```
iyzico API yanıt veriyor mu?
├── HAYIR (timeout veya 5xx)
│   ├── iyzico'nun kendi kesintisi olabilir
│   ├── Kontrol: https://status.iyzico.com
│   └── Aksiyon: Bekle + Kullanıcıları bilgilendir
│
├── EVET ama kimlik doğrulama başarısız (401)
│   ├── IYZICO_API_KEY veya IYZICO_SECRET_KEY değişmiş/yanlış
│   ├── Kontrol: grep "IYZICO_API_KEY\|IYZICO_SECRET_KEY" web/api/.env
│   └── Aksiyon: iyzico panelden key'leri doğrula, .env güncelle
│
└── EVET ama uygulama hata veriyor
    ├── Node.js hata loglarını incele
    ├── grep "iyzico.*error\|payment.*error" /var/log/nb-pdf-platform/api.log | tail -20
    └── Aksiyon: Kod hatası, debug gerekiyor
```

### Geçici Mitigation (Kesinti Sırasında)

```bash
# Ödeme sayfasını geçici olarak kapat (kullanıcı denemesin):
# 1. Frontend'de ödeme butonu devre dışı bırak (hızlı yol)
# veya
# 2. Özel bir banner göster: "Ödeme sistemi geçici bakımda"

# Kullanıcılara bildirim gönder:
# (Henüz email sistemi yoksa sosyal medya/banner yeterli)

echo "Ödeme sistemi kesintisi başladı: $(date -u)" >> /var/log/nb-pdf-platform/incidents.log
```

---

## 🔴 P1: Callback URL Erişilemiyor

### Belirti
```
- payment_checkouts'ta çok PENDING kayıt birikmiş
- iyzico panelde "callback gönderildi" ama biz almadık
- Kullanıcılar "ödeme yaptım ama plan değişmedi" demeye başladı
```

### Araştırma

```bash
# Callback endpoint test:
curl -v -X POST https://siteadin.com/api/payment/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "test=1"

# nginx log'unda callback isteği görünüyor mu?
grep "POST /api/payment/callback" /var/log/nginx/access.log | tail -10

# Auth API callback endpoint çalışıyor mu?
curl -f http://localhost:4000/api/payment/callback -X POST
```

### Düzeltme

```bash
# Auth API'yi yeniden başlat:
systemctl restart nb-api
sleep 10

# Test:
curl -f http://localhost:4000/api/health
```

### Bekleyen Ödemeleri Temizle

```sql
-- Callback gelmemesi nedeniyle PENDING kalan ödemeleri bul:
SELECT conversation_id, user_id, plan, amount_expected, created_at
FROM payment_checkouts
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;

-- Her birini iyzico panelde kontrol et, SUCCESS ise → RB-12 Adım F uygula
```

---

## 🟠 Çift Fatura / Duplicate Billing Olayı

### Nasıl Tespit Edilir

```sql
-- Aynı kullanıcıdan kısa sürede iki COMPLETED ödeme:
SELECT user_id, COUNT(*) as payment_count, 
       SUM(amount_paid) as total_charged,
       MIN(created_at) as first_payment,
       MAX(created_at) as second_payment
FROM payment_checkouts
WHERE status = 'COMPLETED'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY payment_count DESC;
```

### Aksiyon

```
1. Her duplicate kullanıcıyı incele
2. İkinci ödeme gerçekten çift mi yoksa farklı plan mı?
3. Gerçek duplicate → İkincisini iade et
4. iyzico panelden iade işlemi
5. Kullanıcıya proaktif email gönder (şikayet etmeden önce bildir)
6. Neyi düzeltmen gerektiğini belirle (idempotency sorunu?)
```

---

## 🟠 İyzico API Key Süresi Doldu / Geçersiz

### Belirti
```json
{
  "level": "error",
  "event": "iyzico_auth_failed",
  "error_code": "401",
  "message": "API key unauthorized"
}
```

### Aksiyon

```
1. iyzico merchant panele giriş yap
2. Hesabım → API Anahtarları
3. Mevcut anahtar durumunu kontrol et
4. Gerekiyorsa yeni anahtar oluştur
5. web/api/.env'de güncelle:
   IYZICO_API_KEY=yeni_anahtar
   IYZICO_SECRET_KEY=yeni_secret
6. Servisi yeniden başlat:
   systemctl restart nb-api
7. Test checkout yap (sandbox)
```

---

## 🟡 Yavaş Checkout (Performance Sorunu)

### Ölçüm

```bash
# Checkout response sürelerini ölç:
grep "iyzico_checkout_response" /var/log/nb-pdf-platform/api.log | \
  jq '.duration_ms' | sort -n | awk '
    BEGIN { count=0; sum=0 }
    { count++; sum+=$1; vals[count]=$1 }
    END {
      print "Count:", count
      print "Average:", sum/count, "ms"
      print "P95:", vals[int(count*0.95)], "ms"
      print "Max:", vals[count], "ms"
    }'
```

**Alarm eşikleri:**
```
Ortalama > 500ms → İncele
P95 > 2000ms → Sorun var
Max > 10000ms → Timeout riski
```

---

## 📊 Ödeme Sağlığı Dashboard'u (Günlük)

```bash
#!/bin/bash
# /usr/local/bin/nb-payment-health.sh
# Her sabah çalıştır

DATE=$(date -d "yesterday" +%Y-%m-%d)

echo "============================================"
echo "  ÖDEME SAĞLIĞI RAPORU — $DATE"
echo "============================================"

psql -U postgres nb_pdf_platform -q << 'SQL'
-- Dünkü ödeme özeti
SELECT 
  status,
  COUNT(*) as count,
  SUM(COALESCE(amount_paid, amount_expected)) as total_amount
FROM payment_checkouts
WHERE DATE(created_at) = CURRENT_DATE - 1
GROUP BY status
ORDER BY count DESC;
SQL

echo ""
echo "--- PENDING (2+ saat) ---"
psql -U postgres nb_pdf_platform -q -c "
SELECT conversation_id, user_id, plan, created_at
FROM payment_checkouts
WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '2 hours'
LIMIT 10;"

echo ""
echo "--- BUGÜNKÜ ALARM METRİKLERİ ---"
# Log'dan çek
LOG="/var/log/nb-pdf-platform/api.log"
echo "İmza hatası: $(grep "$(date +%Y-%m-%d)" $LOG | grep -c 'callback_signature_invalid')"
echo "Fiyat uyumsuzluğu: $(grep "$(date +%Y-%m-%d)" $LOG | grep -c 'price_mismatch')"
echo "Abonelik aktivasyonu: $(grep "$(date +%Y-%m-%d)" $LOG | grep -c 'subscription_activated')"
```

---

## 📋 Ödeme Olay Postmortem Şablonu

```markdown
# Postmortem: [OLAY_ADI] — [TARİH]

## Özet
[2-3 cümle özet]

## Zaman Çizelgesi (UTC)
- HH:MM — İlk belirti
- HH:MM — Tespit edildi
- HH:MM — Araştırma başladı
- HH:MM — Kök neden bulundu
- HH:MM — Çözüm uygulandı
- HH:MM — Normal duruma dönüldü

## Etki
- Etkilenen kullanıcı sayısı: N
- Etkilenen ödeme tutarı: X₺
- Downtime: X dakika
- Kullanıcı şikayeti: Evet/Hayır

## Kök Neden
[Teknik açıklama]

## Düzeltme Yapılanlar
- [Yapılan 1]
- [Yapılan 2]

## Tekrar Olmaması İçin
- [Önlem 1]
- [Önlem 2]

## Açık Aksiyonlar
- [ ] [Aksiyon 1] — [Sorumlu] — [Tarih]
```
